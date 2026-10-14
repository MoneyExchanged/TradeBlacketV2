// Offline transfers: the website moves Rodux to and from a player's Trade Empire save directly,
// through Roblox Open Cloud, while that player is NOT in the game.
//
// Why this is safe:
//   - It only writes a save nobody has open. ProfileStore marks a save as in use while a game
//     server holds it (MetaData.ActiveSession). If that mark is there, we refuse and the player
//     uses the in-game TradeBlacket button instead.
//   - Every write is conditional on the exact version we read (matchVersion). If a game server
//     opened the save in between, the write is rejected and nothing changes.
//   - It keeps the game's own books: siteWallet.deposited / siteWallet.withdrawn change exactly as
//     they do when the game settles a transfer, so the game's withdrawal cap stays correct.
//   - Each transfer id is stamped into the save (value.TradeBlacket.applied) in the same write.
//     After a crash or timeout we read the save back: if the id is there the transfer happened,
//     if it is not, it did not. Nothing is ever guessed.
//
// Order of operations (so a failure in the middle never creates Rodux):
//   deposit   1. record the transfer as 'staged' (no balance change)  2. write the save (Rodux leaves
//             the game)  3. credit the site.  A deposit whose write we cannot confirm is credited
//             only once the stamp is seen in the save.
//   withdraw  1. take the Rodux off the site and record 'staged'  2. write the save (Rodux enters the
//             game)  3. mark done.  A withdrawal whose write definitely failed is refunded to the site.
'use strict';
const crypto = require('node:crypto');

const CFG = {
  key: process.env.ROBLOX_OPEN_CLOUD_KEY || '',
  universe: process.env.ROBLOX_UNIVERSE_ID || '10108739296',
  store: process.env.ROBLOX_DATASTORE || 'PlayerStore_v1',
  staleSessionMs: 30 * 60e3,   // a session mark older than this is a server that died, not a player
  maxPending: 5
};
const enabled = () => CFG.key.length > 20;
const BASE = () => `https://apis.roblox.com/datastores/v1/universes/${CFG.universe}/standard-datastores/datastore/entries/entry`;

class BridgeError extends Error { constructor(msg, code, extra) { super(msg); this.code = code || 400; this.extra = extra; } }

async function ocGet(userId) {
  const url = `${BASE()}?datastoreName=${encodeURIComponent(CFG.store)}&entryKey=${encodeURIComponent(String(userId))}`;
  const r = await fetch(url, { headers: { 'x-api-key': CFG.key } });
  if (r.status === 404) return null;
  if (!r.ok) throw new BridgeError(`Roblox answered ${r.status} reading the save`, 502);
  const text = await r.text();
  return {
    value: JSON.parse(text),
    version: r.headers.get('roblox-entry-version'),
    attrs: r.headers.get('roblox-entry-attributes'),
    userIds: r.headers.get('roblox-entry-userids')
  };
}
// 'ok' | 'conflict' | 'unknown' (we cannot tell whether it landed)
async function ocSet(userId, entry) {
  const body = JSON.stringify(entry.value);
  const url = `${BASE()}?datastoreName=${encodeURIComponent(CFG.store)}&entryKey=${encodeURIComponent(String(userId))}&matchVersion=${encodeURIComponent(entry.version)}`;
  const headers = { 'x-api-key': CFG.key, 'content-type': 'application/json', 'content-md5': crypto.createHash('md5').update(body).digest('base64') };
  if (entry.attrs) headers['roblox-entry-attributes'] = entry.attrs;
  if (entry.userIds) headers['roblox-entry-userids'] = entry.userIds;
  let r;
  try { r = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(15000) }); }
  catch { return 'unknown'; }
  if (r.ok) return 'ok';
  if (r.status === 409 || r.status === 412) return 'conflict';
  if (r.status >= 500 || r.status === 429) return 'unknown';
  throw new BridgeError(`Roblox refused the write (${r.status})`, 502);
}

const whole = v => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
function readSave(entry, now) {
  const v = entry.value || {}, data = v.Data || {}, meta = v.MetaData || {};
  const sw = data.siteWallet && typeof data.siteWallet === 'object' ? data.siteWallet : {};
  const pending = Array.isArray(sw.pending) ? sw.pending : [];
  const session = meta.ActiveSession;
  const last = whole(meta.LastUpdate) * 1000;
  const inGame = !!session && (now - last < CFG.staleSessionMs);
  const withdrawing = pending.filter(p => p && p.kind === 'withdraw').reduce((s, p) => s + whole(p.amount), 0);
  const depositing = pending.filter(p => p && p.kind === 'deposit').reduce((s, p) => s + whole(p.amount), 0);
  const deposited = whole(sw.deposited), withdrawn = whole(sw.withdrawn);
  return {
    inGame, balance: whole(data.pBalance), deposited, withdrawn, pendingCount: pending.length, withdrawing, depositing,
    // the game's own rule (SiteWalletRules.withdrawable): confirmed in, minus out, minus requests under way
    gameWithdrawable: Math.max(0, deposited - withdrawn - withdrawing)
  };
}
function stamp(value, id) {
  const tb = value.TradeBlacket && typeof value.TradeBlacket === 'object' ? value.TradeBlacket : {};
  const applied = Array.isArray(tb.applied) ? tb.applied.slice(-29) : [];
  applied.push(id); value.TradeBlacket = { applied };
}
const stamped = (value, id) => !!(value && value.TradeBlacket && Array.isArray(value.TradeBlacket.applied) && value.TradeBlacket.applied.includes(id));

function create({ db, tx, log, siteWithdrawable }) {
  db.exec(`CREATE TABLE IF NOT EXISTS offline_transfers (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, roblox_id INTEGER NOT NULL, amount INTEGER NOT NULL,
    status TEXT NOT NULL, created_at INTEGER NOT NULL, done_at INTEGER, note TEXT)`);
  const q = {
    user: db.prepare('SELECT * FROM users WHERE roblox_id = ?'),
    add: db.prepare('INSERT INTO offline_transfers (id, kind, roblox_id, amount, status, created_at) VALUES (?,?,?,?,?,?)'),
    get: db.prepare('SELECT * FROM offline_transfers WHERE id = ?'),
    set: db.prepare('UPDATE offline_transfers SET status = ?, done_at = ?, note = ? WHERE id = ?'),
    staged: db.prepare("SELECT * FROM offline_transfers WHERE status = 'staged' AND created_at < ?"),
    busy: db.prepare("SELECT COUNT(*) AS n FROM offline_transfers WHERE status = 'staged' AND roblox_id = ?"),
    credit: db.prepare('UPDATE users SET balance = balance + ?, deposited = deposited + ? WHERE roblox_id = ?'),
    debit: db.prepare('UPDATE users SET balance = balance - ?, withdrawn = withdrawn + ? WHERE roblox_id = ?'),
    undebit: db.prepare('UPDATE users SET balance = balance + ?, withdrawn = withdrawn - ? WHERE roblox_id = ?'),
    recent: db.prepare('SELECT id, kind, amount, status, created_at FROM offline_transfers WHERE roblox_id = ? ORDER BY created_at DESC LIMIT 10')
  };
  const now = () => Date.now();
  const newId = () => 'web-' + crypto.randomBytes(12).toString('hex');

  function finishDeposit(t) { tx(() => { q.credit.run(t.amount, t.amount, t.roblox_id); q.set.run('ok', now(), null, t.id); }); log('offline deposit', t.roblox_id, t.amount, t.id); }
  function finishWithdraw(t) { q.set.run('ok', now(), null, t.id); log('offline withdraw', t.roblox_id, t.amount, t.id); }
  function cancel(t, note) {
    tx(() => { if (t.kind === 'withdraw') q.undebit.run(t.amount, t.amount, t.roblox_id); q.set.run('cancelled', now(), note, t.id); });
    log('offline transfer cancelled', t.id, note);
  }

  async function status(robloxId) {
    if (!enabled()) return { available: false };
    const entry = await ocGet(robloxId);
    if (!entry) return { available: true, hasSave: false };
    const s = readSave(entry, now());
    return { available: true, hasSave: true, inGame: s.inGame, balance: s.balance, gameWithdrawable: s.gameWithdrawable, depositing: s.depositing, withdrawing: s.withdrawing, recent: q.recent.all(robloxId) };
  }

  // Shared by both directions: read, check, change, write; retry on a version race.
  async function move(kind, robloxId, amount) {
    if (!enabled()) throw new BridgeError('Transfers from the website are not set up yet.', 503);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1e12) throw new BridgeError('Enter a whole amount of Rodux.');
    if (q.busy.get(robloxId).n > 0) throw new BridgeError('Your last transfer is still finishing. Try again in a moment.', 409);
    const id = newId();
    for (let attempt = 0; attempt < 4; attempt++) {
      const entry = await ocGet(robloxId);
      if (!entry) throw new BridgeError('We could not find your Trade Empire save. Join Trade Empire once first.', 404);
      const s = readSave(entry, now());
      if (s.inGame) throw new BridgeError('You are in Trade Empire right now. Use the TradeBlacket button in the game, or leave the game and try again here.', 409, { inGame: true });
      if (s.pendingCount >= CFG.maxPending) throw new BridgeError('You have transfers waiting in Trade Empire. Join the game once so they can finish.', 409);
      const data = entry.value.Data;
      data.siteWallet = data.siteWallet && typeof data.siteWallet === 'object' ? data.siteWallet : { deposited: 0, withdrawn: 0, pending: [] };
      if (!Array.isArray(data.siteWallet.pending)) data.siteWallet.pending = [];
      if (kind === 'deposit') {
        if (s.balance < amount) throw new BridgeError(`You only have ${s.balance.toLocaleString('en-US')} Rodux in Trade Empire.`);
        data.pBalance = s.balance - amount;
        data.siteWallet.deposited = s.deposited + amount;
      } else {
        const cap = Math.min(s.gameWithdrawable, siteWithdrawable(robloxId));
        if (amount > cap) throw new BridgeError(cap > 0 ? `You can bring back up to ${cap.toLocaleString('en-US')} Rodux right now.` : 'You have no Rodux available to bring back.');
        data.pBalance = s.balance + amount;
        data.siteWallet.withdrawn = s.withdrawn + amount;
      }
      stamp(entry.value, id);

      // Stage it. A withdrawal takes the Rodux off the site now, so it cannot be bet meanwhile.
      if (attempt === 0) tx(() => {
        const u = q.user.get(robloxId); if (!u) throw new BridgeError('No TradeBlacket account.', 404);
        if (kind === 'withdraw') { if (u.balance - u.bonus_lock < amount || u.deposited - u.withdrawn < amount) throw new BridgeError('That is more than you can bring back right now.'); q.debit.run(amount, amount, robloxId); }
        q.add.run(id, kind, robloxId, amount, 'staged', now());
      });

      let res;
      try { res = await ocSet(robloxId, entry); }
      catch (e) { cancel(q.get.get(id), e.message); throw e; }
      if (res === 'ok') { const t = q.get.get(id); kind === 'deposit' ? finishDeposit(t) : finishWithdraw(t); return { id, amount, kind }; }
      if (res === 'unknown') {
        // We cannot tell whether the write landed. Read the save back and decide from the stamp;
        // never write again with this id, because a cancelled withdrawal has already been refunded.
        await sleep(1500);
        const ok = await settleOne(q.get.get(id));
        if (ok === true) return { id, amount, kind };
        if (ok === null) return { id, amount, kind, pending: true };
        throw new BridgeError('Roblox did not confirm the transfer, so nothing moved. Try again.', 502);
      }
      // conflict (or definitely not applied): the save changed under us; read again and retry
      await sleep(300 + attempt * 400);
    }
    cancel(q.get.get(id), 'gave up after repeated version conflicts');
    throw new BridgeError('Your save kept changing. If you just joined Trade Empire, use the button in the game.', 409);
  }

  // Decide a staged transfer by reading the save: stamped = it happened, not stamped = it did not.
  // Returns true (finished), false (cancelled) or null (could not read; try later).
  async function settleOne(t) {
    if (!t || t.status !== 'staged') return t && t.status === 'ok';
    let entry; try { entry = await ocGet(t.roblox_id); } catch { return null; }
    if (entry && stamped(entry.value, t.id)) { t.kind === 'deposit' ? finishDeposit(t) : finishWithdraw(t); return true; }
    cancel(t, 'not found in the save'); return false;
  }
  async function recover() {
    if (!enabled()) return;
    for (const t of q.staged.all(now() - 20000)) { try { await settleOne(t); } catch (e) { log('recover failed', t.id, e.message); } }
  }
  setInterval(() => { recover().catch(() => {}); }, 60e3).unref();
  setTimeout(() => { recover().catch(() => {}); }, 5000).unref();

  return { enabled, status, deposit: (id, amt) => move('deposit', id, amt), withdraw: (id, amt) => move('withdraw', id, amt), BridgeError, _test: { readSave, stamp, stamped } };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = { create, CFG, BridgeError };
