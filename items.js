// Trade Empire limiteds on TradeBlacket: read a player's items, move them between their save and
// the website, and run item coinflips between players.
//
// Where the game keeps things (read from the game's own code):
//   PlayerStore_v1 / <userId>   Data.owned = { [itemId]: [serial, ...] }
//                               Data.acquiredAt = { ["itemId:serial"]: unixSeconds }  (3-day hold)
//   ItemStore_v1 / <itemId>     { name, baseValue, rap, modelId, limitedType, ... }
//   MarketStore_v1 / <itemId>   { [serial]: { sellerId, price, ... } }   in-game market listings
//   ProfileMail_v1 / <userId>   [ { kind, payload } ]   changes waiting for the player's next join
//
// Rules this keeps so the game's item supply stays exactly the same:
//   - An item copy (itemId + serial) is in exactly one place: one player's save, or the website.
//     The database refuses a second live row for the same copy.
//   - Only copies in `owned` can leave a save. Copies in an open trade are already moved to the
//     game's trade escrow, so they cannot be picked.
//   - A copy still in its 3-day holding period cannot leave, the same rule the game trades by.
//   - A copy listed on the in-game market cannot leave, and nothing can leave while the player has
//     game mail waiting: a sale delivered by mail takes the copy on their next join, and moving it
//     out first would leave it in two places.
//   - A copy arriving in a save starts a fresh holding period, as it does after an in-game trade.
//   - Writes are conditional on the save version and stamped, exactly like Rodux transfers.
//   - Coinflips only move copies between players. The site never creates or destroys a copy.
'use strict';
const crypto = require('node:crypto');
const GB = require('./gamebridge.js');
const { BridgeError } = GB;

const HOLD_SECONDS = 3 * 24 * 60 * 60;
const STORES = { save: process.env.ROBLOX_DATASTORE || 'PlayerStore_v1', items: 'ItemStore_v1', market: 'MarketStore_v1', mail: 'ProfileMail_v1' };
const MAX_PER_MOVE = 20, FLIP_RANGE = [0.9, 1.1], FLIP_MAX_ITEMS = 10, FLIP_EXPIRE_MS = 24 * 36e5;

function create({ db, tx, log, guard }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_items (
      uid TEXT PRIMARY KEY, item_id INTEGER NOT NULL, serial INTEGER NOT NULL, owner INTEGER NOT NULL,
      status TEXT NOT NULL,          -- in (arriving) | held | flip | out (leaving) | gone
      origin INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS site_items_copy ON site_items (item_id, serial) WHERE status != 'gone';
    CREATE INDEX IF NOT EXISTS site_items_owner ON site_items (owner, status);
    CREATE TABLE IF NOT EXISTS item_moves (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, roblox_id INTEGER NOT NULL, uids TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL, created_at INTEGER NOT NULL, done_at INTEGER, note TEXT);
    CREATE TABLE IF NOT EXISTS flips (
      id TEXT PRIMARY KEY, creator INTEGER NOT NULL, creator_name TEXT, side TEXT NOT NULL, c_items TEXT NOT NULL, c_value INTEGER NOT NULL,
      joiner INTEGER, joiner_name TEXT, j_items TEXT, j_value INTEGER, status TEXT NOT NULL, result TEXT, winner INTEGER,
      seed TEXT NOT NULL, seed_hash TEXT NOT NULL, created_at INTEGER NOT NULL, done_at INTEGER);
    CREATE INDEX IF NOT EXISTS flips_status ON flips (status, created_at DESC);
  `);
  const q = {
    mine: db.prepare("SELECT * FROM site_items WHERE owner = ? AND status IN ('held','flip','in','out') ORDER BY created_at DESC"),
    byUid: db.prepare('SELECT * FROM site_items WHERE uid = ?'),
    live: db.prepare("SELECT * FROM site_items WHERE item_id = ? AND serial = ? AND status != 'gone'"),
    addItem: db.prepare('INSERT INTO site_items (uid, item_id, serial, owner, status, origin, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'),
    setStatus: db.prepare('UPDATE site_items SET status = ?, updated_at = ? WHERE uid = ?'),
    setOwner: db.prepare("UPDATE site_items SET owner = ?, status = 'held', updated_at = ? WHERE uid = ?"),
    addMove: db.prepare('INSERT INTO item_moves (id, kind, roblox_id, uids, value, status, created_at) VALUES (?,?,?,?,?,?,?)'),
    move: db.prepare('SELECT * FROM item_moves WHERE id = ?'),
    setMove: db.prepare('UPDATE item_moves SET status = ?, done_at = ?, note = ? WHERE id = ?'),
    staged: db.prepare("SELECT * FROM item_moves WHERE status = 'staged' AND created_at < ?"),
    busy: db.prepare("SELECT COUNT(*) AS n FROM item_moves WHERE status = 'staged' AND roblox_id = ?"),
    recentMoves: db.prepare("SELECT id, kind, value, status, created_at, uids FROM item_moves WHERE roblox_id = ? AND status != 'staged' ORDER BY created_at DESC LIMIT 20"),
    addFlip: db.prepare('INSERT INTO flips (id, creator, creator_name, side, c_items, c_value, status, seed, seed_hash, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'),
    flip: db.prepare('SELECT * FROM flips WHERE id = ?'),
    openFlips: db.prepare("SELECT * FROM flips WHERE status = 'open' ORDER BY c_value DESC LIMIT 100"),
    doneFlips: db.prepare("SELECT * FROM flips WHERE status = 'done' ORDER BY done_at DESC LIMIT 20"),
    myOpen: db.prepare("SELECT COUNT(*) AS n FROM flips WHERE status = 'open' AND creator = ?"),
    finishFlip: db.prepare("UPDATE flips SET joiner = ?, joiner_name = ?, j_items = ?, j_value = ?, status = 'done', result = ?, winner = ?, done_at = ? WHERE id = ? AND status = 'open'"),
    cancelFlip: db.prepare("UPDATE flips SET status = 'cancelled', done_at = ? WHERE id = ? AND status = 'open'"),
    expired: db.prepare("SELECT * FROM flips WHERE status = 'open' AND created_at < ?")
  };
  const now = () => Date.now();
  const newId = p => p + crypto.randomBytes(12).toString('hex');
  const token = (itemId, serial) => `${itemId}:${serial}`;

  /* ---------- catalog: names, values, pictures ---------- */
  const cat = new Map(); let catalogError = null;
  async function itemInfo(itemId) {
    const c = cat.get(itemId);
    if (c && now() - c.at < 10 * 60e3) return c;
    try {
      const e = await GB.ocGet(itemId, STORES.items);
      const v = (e && e.value) || {};
      const info = { itemId, name: typeof v.name === 'string' ? v.name : `Item #${itemId}`, value: Math.max(0, Math.floor(Number(v.baseValue) || 0)), rap: Math.max(0, Math.floor(Number(v.rap) || 0)), modelId: Number(v.modelId) || null, limitedType: v.limitedType || null, at: now(), known: !!e };
      cat.set(itemId, info); catalogError = null; return info;
    } catch (err) {
      catalogError = err.message;
      if (c) return c;
      return { itemId, name: `Item #${itemId}`, value: 0, rap: 0, modelId: null, at: 0, known: false };
    }
  }
  async function infos(ids) { const out = {}; await Promise.all([...new Set(ids)].map(async id => { out[id] = await itemInfo(id); })); return out; }
  // Pictures come from Roblox's public thumbnail service: the item id first, then its model id.
  const thumbs = new Map();
  async function thumbFor(list) {
    const want = [...new Set(list.flatMap(x => [x.itemId, x.modelId]).filter(id => id && !thumbs.has(id)))];
    for (let i = 0; i < want.length; i += 100) {
      const chunk = want.slice(i, i + 100);
      try {
        const r = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${chunk.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`, { signal: AbortSignal.timeout(8000) });
        const j = r.ok ? await r.json() : { data: [] };
        (j.data || []).forEach(d => thumbs.set(d.targetId, d.state === 'Completed' ? d.imageUrl : null));
        chunk.forEach(id => { if (!thumbs.has(id)) thumbs.set(id, null); });
      } catch { /* pictures are decoration; try again next time */ }
    }
    const pic = x => thumbs.get(x.itemId) || (x.modelId && thumbs.get(x.modelId)) || null;
    return pic;
  }
  async function describe(rows) {
    const I = await infos(rows.map(r => r.itemId));
    const list = rows.map(r => ({ ...r, ...I[r.itemId], itemId: r.itemId }));
    const pic = await thumbFor(list);
    return list.map(x => ({ ...x, img: pic(x), at: undefined, known: undefined }));
  }

  /* ---------- reading a save ---------- */
  function ownedCopies(value) {
    const d = (value && value.Data) || {}, owned = d.owned && typeof d.owned === 'object' ? d.owned : {}, acq = d.acquiredAt && typeof d.acquiredAt === 'object' ? d.acquiredAt : {};
    const out = [];
    for (const [k, serials] of Object.entries(owned)) {
      const itemId = Number(k); if (!Number.isSafeInteger(itemId) || !Array.isArray(serials)) continue;
      for (const s of serials) { const serial = Number(s); if (!Number.isSafeInteger(serial)) continue; const at = Number(acq[token(itemId, serial)]) || 0; out.push({ token: token(itemId, serial), itemId, serial, acquiredAt: at, heldUntil: at > 0 ? (at + HOLD_SECONDS) * 1000 : 0 }); }
    }
    return out;
  }
  async function mailWaiting(robloxId) {
    const e = await GB.ocGet(robloxId, STORES.mail);
    const v = e && e.value;
    return Array.isArray(v) ? v.length : 0;
  }
  async function listedSerials(robloxId, itemIds) {
    const listed = new Set();
    await Promise.all([...new Set(itemIds)].map(async id => {
      const e = await GB.ocGet(id, STORES.market);
      const map = (e && e.value) || {};
      for (const [serial, l] of Object.entries(map)) if (l && Number(l.sellerId) === Number(robloxId)) listed.add(token(id, Number(serial)));
    }));
    return listed;
  }

  async function saveInventory(robloxId) {
    if (!GB.enabled()) return { available: false };
    const entry = await GB.ocGet(robloxId);
    if (!entry) return { available: true, hasSave: false, items: [] };
    const s = GB.readSave(entry, now()), copies = ownedCopies(entry.value);
    let listed = new Set(), mail = 0, checks = null;
    try { [listed, mail] = await Promise.all([listedSerials(robloxId, copies.map(c => c.itemId)), mailWaiting(robloxId)]); }
    catch (e) { checks = e.message; }
    const items = (await describe(copies)).map(x => ({ token: x.token, itemId: x.itemId, serial: x.serial, name: x.name, value: x.value, rap: x.rap, img: x.img, limitedType: x.limitedType, heldUntil: x.heldUntil, listed: listed.has(x.token) }));
    return { available: true, hasSave: true, inGame: s.inGame, mail, checks, catalogError, items };
  }
  async function siteInventory(robloxId) {
    const rows = q.mine.all(robloxId).map(r => ({ uid: r.uid, itemId: r.item_id, serial: r.serial, status: r.status, since: r.updated_at }));
    return { items: (await describe(rows)).map(x => ({ uid: x.uid, itemId: x.itemId, serial: x.serial, name: x.name, value: x.value, rap: x.rap, img: x.img, limitedType: x.limitedType, status: x.status })), catalogError, moves: q.recentMoves.all(robloxId).map(m => ({ ...m, count: JSON.parse(m.uids).length, uids: undefined })) };
  }

  /* ---------- moving items ---------- */
  function finish(m, status, note) {
    tx(() => {
      const uids = JSON.parse(m.uids);
      for (const u of uids) {
        if (m.kind === 'deposit') status === 'ok' ? q.setStatus.run('held', now(), u) : q.setStatus.run('gone', now(), u);
        else status === 'ok' ? q.setStatus.run('gone', now(), u) : q.setStatus.run('held', now(), u);
      }
      q.setMove.run(status === 'ok' ? 'ok' : 'cancelled', now(), note || null, m.id);
    });
    log(`items ${m.kind} ${status}`, m.roblox_id, m.id, note || '');
  }
  async function settleMove(m) {
    if (!m || m.status !== 'staged') return m && m.status === 'ok';
    let entry; try { entry = await GB.ocGet(m.roblox_id); } catch { return null; }
    if (entry && GB.stamped(entry.value, m.id)) { finish(m, 'ok'); return true; }
    finish(m, 'cancelled', 'not found in the save'); return false;
  }
  async function recover() { if (!GB.enabled()) return; for (const m of q.staged.all(now() - 20000)) { try { await settleMove(m); } catch (e) { log('item recover', m.id, e.message); } } }
  setInterval(() => { recover().catch(() => {}); expireFlips(); }, 60e3).unref();
  setTimeout(() => { recover().catch(() => {}); }, 6000).unref();

  async function write(m, entry) {
    const res = await GB.ocSet(m.roblox_id, entry);
    if (res === 'ok') { finish(m, 'ok'); return 'ok'; }
    if (res === 'unknown') { await GB.sleep(1500); const ok = await settleMove(q.move.get(m.id)); if (ok === true) return 'ok'; if (ok === null) return 'pending'; throw new BridgeError('Roblox did not confirm the move, so nothing moved. Try again.', 502); }
    return 'conflict';
  }

  async function deposit(robloxId, tokens) {
    if (!GB.enabled()) throw new BridgeError('Moving items is not set up yet.', 503);
    if (!Array.isArray(tokens) || !tokens.length) throw new BridgeError('Pick at least one item.');
    if (tokens.length > MAX_PER_MOVE) throw new BridgeError(`Move up to ${MAX_PER_MOVE} items at a time.`);
    if (new Set(tokens).size !== tokens.length) throw new BridgeError('Each item can only be picked once.');
    if (q.busy.get(robloxId).n > 0) throw new BridgeError('Your last item move is still finishing.', 409);
    const id = newId('itm-'); let staged = null;
    try { return await depositLoop(); }
    catch (e) { const cur = staged && q.move.get(id); if (cur && cur.status === 'staged') finish(cur, 'cancelled', e.message); throw e; }
    async function depositLoop() {
    for (let attempt = 0; attempt < 4; attempt++) {
      const entry = await GB.ocGet(robloxId);
      if (!entry) throw new BridgeError('We could not find your Trade Empire save.', 404);
      const s = GB.readSave(entry, now());
      if (s.inGame) throw new BridgeError('You are in Trade Empire right now, and the game keeps your save open while you play. Leave the game, wait a few seconds, then try again.', 409, { inGame: true });
      if (await mailWaiting(robloxId)) throw new BridgeError('You have game mail waiting, such as a market sale or a finished trade. Join Trade Empire once to receive it, then try again.', 409);
      const copies = new Map(ownedCopies(entry.value).map(c => [c.token, c]));
      const picked = tokens.map(t => { const c = copies.get(String(t)); if (!c) throw new BridgeError('One of those items is no longer in your Trade Empire inventory.'); return c; });
      const held = picked.find(c => c.heldUntil > now());
      if (held) throw new BridgeError(`One of those items is still in its 3-day holding period (until ${new Date(held.heldUntil).toUTCString()}).`);
      const listed = await listedSerials(robloxId, picked.map(c => c.itemId));
      if (picked.some(c => listed.has(c.token))) throw new BridgeError('One of those items is listed on the Trade Empire market. Cancel the listing first.');
      const I = await infos(picked.map(c => c.itemId));
      if (picked.some(c => !I[c.itemId].known)) throw new BridgeError(catalogError || 'Could not look up those items. Try again in a moment.', 503);
      const value = picked.reduce((a, c) => a + I[c.itemId].value, 0);
      if (attempt === 0) {
        if (guard) { const why = guard(robloxId, 'items', value); if (why) throw new BridgeError(why, 403, { limit: true }); }
        tx(() => {
          const uids = [];
          for (const c of picked) {
            if (q.live.get(c.itemId, c.serial)) throw new BridgeError(`${I[c.itemId].name} #${c.serial} is already on TradeBlacket.`, 409);
            const u = newId('it-'); uids.push(u); q.addItem.run(u, c.itemId, c.serial, robloxId, 'in', robloxId, now(), now());
          }
          q.addMove.run(id, 'deposit', robloxId, JSON.stringify(uids), value, 'staged', now());
        });
        staged = q.move.get(id);
      }
      // take the copies out of the save, exactly as Ownership.remove does
      const d = entry.value.Data; d.acquiredAt = d.acquiredAt && typeof d.acquiredAt === 'object' ? d.acquiredAt : {};
      for (const c of picked) {
        const key = String(c.itemId), list = d.owned[key], i = list.findIndex(x => Number(x) === c.serial);
        list.splice(i, 1); if (!list.length) delete d.owned[key];
        delete d.acquiredAt[c.token];
      }
      GB.stamp(entry.value, id);
      const r = await write(staged, entry);
      if (r === 'ok') return { id, count: picked.length, value };
      if (r === 'pending') return { id, count: picked.length, value, pending: true };
      await GB.sleep(300 + attempt * 400);
    }
    throw new BridgeError('Your save kept changing. If you just joined Trade Empire, leave it and try again.', 409);
    }
  }

  async function withdraw(robloxId, uids) {
    if (!GB.enabled()) throw new BridgeError('Moving items is not set up yet.', 503);
    if (!Array.isArray(uids) || !uids.length) throw new BridgeError('Pick at least one item.');
    if (uids.length > MAX_PER_MOVE) throw new BridgeError(`Move up to ${MAX_PER_MOVE} items at a time.`);
    if (q.busy.get(robloxId).n > 0) throw new BridgeError('Your last item move is still finishing.', 409);
    const id = newId('itm-');
    let rows;
    tx(() => {
      rows = uids.map(u => { const r = q.byUid.get(String(u)); if (!r || r.owner !== robloxId || r.status !== 'held') throw new BridgeError('One of those items is not available to withdraw.'); return r; });
      if (new Set(rows.map(r => r.uid)).size !== rows.length) throw new BridgeError('Each item can only be picked once.');
      rows.forEach(r => q.setStatus.run('out', now(), r.uid));
      q.addMove.run(id, 'withdraw', robloxId, JSON.stringify(rows.map(r => r.uid)), 0, 'staged', now());
    });
    const m = q.move.get(id);
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const entry = await GB.ocGet(robloxId);
        if (!entry) throw new BridgeError('We could not find your Trade Empire save. Join Trade Empire once first.', 404);
        if (GB.readSave(entry, now()).inGame) throw new BridgeError('You are in Trade Empire right now, and the game keeps your save open while you play. Leave the game, wait a few seconds, then try again.', 409, { inGame: true });
        const d = entry.value.Data; d.owned = d.owned && typeof d.owned === 'object' ? d.owned : {}; d.acquiredAt = d.acquiredAt && typeof d.acquiredAt === 'object' ? d.acquiredAt : {};
        const at = Math.floor(now() / 1000);
        for (const r of rows) {
          const key = String(r.item_id), list = Array.isArray(d.owned[key]) ? d.owned[key] : (d.owned[key] = []);
          if (list.some(x => Number(x) === r.serial)) throw new BridgeError('Your save already has one of those copies. Nothing was moved; please contact support.', 409);
          list.push(r.serial); d.acquiredAt[token(r.item_id, r.serial)] = at;   // a fresh holding period, as after a trade
        }
        GB.stamp(entry.value, id);
        const res = await write(m, entry);
        if (res === 'ok') return { id, count: rows.length };
        if (res === 'pending') return { id, count: rows.length, pending: true };
        await GB.sleep(300 + attempt * 400);
      }
      throw new BridgeError('Your save kept changing. If you just joined Trade Empire, leave it and try again.', 409);
    } catch (e) {
      const cur = q.move.get(id);
      if (cur && cur.status === 'staged') finish(cur, 'cancelled', e.message);
      throw e;
    }
  }

  /* ---------- item coinflip (player against player) ---------- */
  function expireFlips() {
    for (const f of q.expired.all(now() - FLIP_EXPIRE_MS)) tx(() => { if (q.cancelFlip.run(now(), f.id).changes) JSON.parse(f.c_items).forEach(u => q.setStatus.run('held', now(), u)); });
  }
  async function stake(robloxId, uids) {
    if (!Array.isArray(uids) || !uids.length) throw new BridgeError('Pick at least one item.');
    if (uids.length > FLIP_MAX_ITEMS) throw new BridgeError(`Use up to ${FLIP_MAX_ITEMS} items.`);
    if (new Set(uids).size !== uids.length) throw new BridgeError('Each item can only be picked once.');
    const rows = uids.map(u => { const r = q.byUid.get(String(u)); if (!r || r.owner !== robloxId || r.status !== 'held') throw new BridgeError('One of those items is not available.'); return r; });
    const I = await infos(rows.map(r => r.item_id));
    if (rows.some(r => !I[r.item_id].known)) throw new BridgeError(catalogError || 'Could not look up item values right now.', 503);
    return { rows, value: rows.reduce((a, r) => a + I[r.item_id].value, 0) };
  }
  async function flipCreate(robloxId, name, uids, side) {
    if (!['h', 't'].includes(side)) throw new BridgeError('Pick Crown or Tower.');
    if (q.myOpen.get(robloxId).n >= 5) throw new BridgeError('You can have 5 open coinflips at once.');
    const { rows, value } = await stake(robloxId, uids);
    if (value < 1) throw new BridgeError('Those items have no value yet.');
    if (guard) { const why = guard(robloxId, 'play', value); if (why) throw new BridgeError(why, 403, { limit: true }); }
    const id = newId('flp-'), seed = crypto.randomBytes(32).toString('hex'), hash = crypto.createHash('sha256').update(seed).digest('hex');
    tx(() => {
      rows.forEach(r => { const cur = q.byUid.get(r.uid); if (cur.status !== 'held' || cur.owner !== robloxId) throw new BridgeError('One of those items is not available.'); q.setStatus.run('flip', now(), r.uid); });
      q.addFlip.run(id, robloxId, name, side, JSON.stringify(rows.map(r => r.uid)), value, 'open', seed, hash, now());
    });
    log('flip open', robloxId, id, value);
    return { id, value, seedHash: hash };
  }
  async function flipJoin(robloxId, name, id, uids) {
    const f = q.flip.get(String(id));
    if (!f || f.status !== 'open') throw new BridgeError('That coinflip is no longer open.');
    if (f.creator === robloxId) throw new BridgeError('You cannot join your own coinflip.');
    const { rows, value } = await stake(robloxId, uids);
    const lo = Math.ceil(f.c_value * FLIP_RANGE[0]), hi = Math.floor(f.c_value * FLIP_RANGE[1]);
    if (value < lo || value > hi) throw new BridgeError(`Your items must be worth between ${lo.toLocaleString('en-US')} and ${hi.toLocaleString('en-US')}.`);
    if (guard) { const why = guard(robloxId, 'play', value); if (why) throw new BridgeError(why, 403, { limit: true }); }
    // The result is fixed by the seed committed when the flip opened, plus the joiner's id and the
    // flip id. Anyone can check it afterwards: sha256(seed:joinerId:flipId), first byte, even = Crown.
    const roll = crypto.createHash('sha256').update(`${f.seed}:${robloxId}:${f.id}`).digest();
    const result = roll[0] % 2 === 0 ? 'h' : 't', winner = result === f.side ? f.creator : robloxId;
    tx(() => {
      const cur = q.flip.get(f.id); if (cur.status !== 'open') throw new BridgeError('That coinflip is no longer open.');
      rows.forEach(r => { const c = q.byUid.get(r.uid); if (c.status !== 'held' || c.owner !== robloxId) throw new BridgeError('One of your items is not available.'); });
      [...JSON.parse(f.c_items), ...rows.map(r => r.uid)].forEach(u => q.setOwner.run(winner, now(), u));
      q.finishFlip.run(robloxId, name, JSON.stringify(rows.map(r => r.uid)), value, result, winner, now(), f.id);
    });
    log('flip done', f.id, 'winner', winner, 'pot', f.c_value + value);
    return { id: f.id, result, winner, won: winner === robloxId, pot: f.c_value + value, seed: f.seed };
  }
  function flipCancel(robloxId, id) {
    const f = q.flip.get(String(id));
    if (!f || f.creator !== robloxId) throw new BridgeError('Only the creator can cancel this coinflip.');
    tx(() => { if (!q.cancelFlip.run(now(), f.id).changes) throw new BridgeError('That coinflip already finished.'); JSON.parse(f.c_items).forEach(u => q.setStatus.run('held', now(), u)); });
    return { id: f.id };
  }
  async function flipList(robloxId) {
    expireFlips();
    const open = q.openFlips.all(), done = q.doneFlips.all();
    const uids = [...open, ...done].flatMap(f => [...JSON.parse(f.c_items), ...(f.j_items ? JSON.parse(f.j_items) : [])]);
    const rows = uids.map(u => q.byUid.get(u)).filter(Boolean).map(r => ({ uid: r.uid, itemId: r.item_id, serial: r.serial }));
    const D = Object.fromEntries((await describe(rows)).map(x => [x.uid, { itemId: x.itemId, serial: x.serial, name: x.name, value: x.value, img: x.img }]));
    const out = f => ({
      id: f.id, side: f.side, creator: f.creator_name, mine: f.creator === robloxId || f.joiner === robloxId, own: f.creator === robloxId,
      cItems: JSON.parse(f.c_items).map(u => D[u]).filter(Boolean), cValue: f.c_value,
      joiner: f.joiner_name, jItems: f.j_items ? JSON.parse(f.j_items).map(u => D[u]).filter(Boolean) : [], jValue: f.j_value,
      status: f.status, result: f.result, won: f.winner && (f.creator === robloxId || f.joiner === robloxId) ? f.winner === robloxId : null, winnerName: f.winner ? (f.winner === f.creator ? f.creator_name : f.joiner_name) : null,
      seedHash: f.seed_hash, seed: f.status === 'done' ? f.seed : undefined, range: [Math.ceil(f.c_value * FLIP_RANGE[0]), Math.floor(f.c_value * FLIP_RANGE[1])], created: f.created_at, done: f.done_at
    });
    return { open: open.map(out), recent: done.map(out) };
  }
  function siteItemValue(robloxId) {
    let total = 0; for (const r of q.mine.all(robloxId)) { const c = cat.get(r.item_id); if (c) total += c.value; } return total;
  }

  return { saveInventory, siteInventory, deposit, withdraw, flipCreate, flipJoin, flipCancel, flipList, siteItemValue, _test: { ownedCopies } };
}

module.exports = { create, STORES, HOLD_SECONDS };
