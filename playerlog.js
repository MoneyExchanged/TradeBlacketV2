// Everything a player has done, for staff (Admin, then Players).
//
// Most of it is read back from the tables that already hold it: Rodux transfers (in game and
// through the website wallet), item deposits, withdrawals, buys and sales with the exact copies,
// Limited Flips, studio game rounds, referrals, waitlists and codes, tickets, staff actions, bans,
// sign-in networks and devices, and daily play time. What no table kept (sign-ins, sign-outs,
// listings, profile and limit changes, Terms accepted) is written to `activity` as it happens.
// The Trade Empire save adds the game's own transaction ledger and moderation record.
//
// Networks, devices and hardware are shown as short labels made from their hashes (N-xxxxxx,
// D-xxxxxx, H-xxxxxx), so staff can match them across accounts without ever seeing an address.
'use strict';

const LBL = { ip: 'N-', dev: 'D-', hw: 'H-' };
const KIND_NAME = { ip: 'Network', dev: 'Device', hw: 'Hardware' };
const TE_KIND = { sale: ['Sold a limited', 1], earned: ['Earned', 1], purchase: ['Bought', -1], transfer: ['Sent Rodux to a player', -1] };
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

function create({ db, isAdmin, security, items, GB, social, account }) {
  db.exec(`CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, roblox_id INTEGER NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS activity_user ON activity (roblox_id, at DESC);`);
  const has = t => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
  const all = (sql, ...a) => { try { return db.prepare(sql).all(...a); } catch { return []; } };
  const one = (sql, ...a) => { try { return db.prepare(sql).get(...a); } catch { return null; } };
  const addQ = db.prepare('INSERT INTO activity (roblox_id, kind, data, at) VALUES (?,?,?,?)');

  // Write one entry. data is small and never holds an address or a secret.
  function add(id, kind, data = {}) { try { addQ.run(Number(id), String(kind), JSON.stringify(data), Date.now()); } catch {} }
  const label = (kind, hash) => (LBL[kind] || '?') + String(hash || '').slice(0, 6).toUpperCase();

  async function player(id) {
    id = Number(id);
    const u = one('SELECT * FROM users WHERE roblox_id = ?', id);
    if (!u) return null;
    const ev = [];
    const push = e => ev.push(e);

    /* ---------- Rodux ---------- */
    for (const t of all('SELECT * FROM transfers WHERE roblox_id = ? ORDER BY created_at DESC LIMIT 500', id))
      push({ at: t.created_at, cat: 'money', kind: t.kind, title: t.kind === 'deposit' ? 'Deposited Rodux' : 'Withdrew Rodux', amount: t.kind === 'deposit' ? t.amount : -t.amount, method: 'In game (old SiteWallet bridge)', status: t.status, ref: t.reference || t.idempotency_key, note: t.reason });
    for (const t of all('SELECT * FROM offline_transfers WHERE roblox_id = ? ORDER BY created_at DESC LIMIT 500', id))
      push({ at: t.created_at, cat: 'money', kind: t.kind, title: t.kind === 'deposit' ? 'Deposited Rodux' : 'Withdrew Rodux', amount: t.kind === 'deposit' ? t.amount : -t.amount, method: 'Website wallet (Trade Empire save, out of game)', status: t.status === 'ok' ? 'ok' : t.status, ref: t.id, note: t.note, doneAt: t.done_at });

    /* ---------- items ---------- */
    const moves = all('SELECT * FROM item_moves WHERE roblox_id = ? ORDER BY created_at DESC LIMIT 500', id);
    const flips = all('SELECT * FROM flips WHERE creator = ? OR joiner = ? ORDER BY created_at DESC LIMIT 300', id, id);
    const uids = new Set();
    moves.forEach(m => parse(m.uids, []).forEach(x => uids.add(x)));
    flips.forEach(f => [...parse(f.c_items, []), ...parse(f.j_items || '[]', [])].forEach(x => uids.add(x)));
    const held = all("SELECT * FROM site_items WHERE owner = ? AND status != 'gone' ORDER BY updated_at DESC LIMIT 500", id);
    held.forEach(r => uids.add(r.uid));
    const listings = all('SELECT * FROM item_listings WHERE seller = ?', id);
    const acts = all('SELECT * FROM activity WHERE roblox_id = ? ORDER BY at DESC LIMIT 1000', id).map(a => ({ ...a, data: parse(a.data, {}) }));
    acts.forEach(a => (a.data.uids || (a.data.uid ? [a.data.uid] : [])).forEach(x => uids.add(x)));
    const rows = [...uids].map(x => one('SELECT uid, item_id, serial FROM site_items WHERE uid = ?', x)).filter(Boolean);
    let D = {};
    try { D = Object.fromEntries((await items.describe(rows.map(r => ({ uid: r.uid, itemId: r.item_id, serial: r.serial })))).map(x => [x.uid, { itemId: x.itemId, serial: x.serial, name: x.name, value: x.value, img: x.img }])); }
    catch { rows.forEach(r => { D[r.uid] = { itemId: r.item_id, serial: r.serial }; }); }
    const itemsOf = list => list.map(x => D[x] || { uid: x });
    const MOVE = { deposit: ['Deposited limiteds', 'Website wallet (Trade Empire save, out of game)'], withdraw: ['Withdrew limiteds', 'Website wallet (Trade Empire save, out of game)'], sell: ['Sold limiteds to TradeBlacket', 'Marketplace, sold for 90% of value'], buy: ['Bought a limited', 'Marketplace'] };
    for (const m of moves) {
      const [title, method] = MOVE[m.kind] || [m.kind, ''];
      const its = itemsOf(parse(m.uids, []));
      push({ at: m.created_at, cat: 'items', kind: 'item-' + m.kind, title: `${title} (${its.length})`, amount: m.kind === 'sell' ? m.value : m.kind === 'buy' ? -m.value : undefined, value: ['deposit', 'withdraw'].includes(m.kind) ? m.value || its.reduce((s, i) => s + num(i.value), 0) : undefined, method, status: m.status === 'ok' ? 'ok' : m.status, ref: m.id, note: m.note, items: its });
    }
    for (const f of flips) {
      const mine = f.creator === id, stake = itemsOf(parse(mine ? f.c_items : f.j_items || '[]', [])), theirs = itemsOf(parse(mine ? f.j_items || '[]' : f.c_items, []));
      const other = mine ? f.joiner_name : f.creator_name, myV = mine ? f.c_value : f.j_value, thV = mine ? f.j_value : f.c_value;
      if (mine) push({ at: f.created_at, cat: 'games', kind: 'flip-open', title: 'Opened a Limited Flip', value: f.c_value, items: stake, ref: f.id, status: f.status === 'open' ? 'open' : 'ok', method: `Called ${f.side === 'h' ? 'heads' : 'tails'}` });
      if (f.status === 'done') {
        const won = f.winner === id;
        push({ at: f.done_at, cat: 'games', kind: won ? 'flip-won' : 'flip-lost', title: `${won ? 'Won' : 'Lost'} a Limited Flip against ${other || 'a player'}`, value: won ? thV : -myV, items: won ? theirs : stake, ref: f.id, status: 'ok', note: `Pot ${num(f.c_value) + num(f.j_value)}, result ${f.result === 'h' ? 'heads' : 'tails'}` });
      } else if (f.status === 'cancelled' || f.status === 'expired') push({ at: f.done_at || f.created_at, cat: 'games', kind: 'flip-cancel', title: `Limited Flip ${f.status}`, items: stake, ref: f.id, status: f.status });
    }

    /* ---------- studio games ---------- */
    const rounds = has('provider_tx') ? all("SELECT kind, amount, game, round_id, status, created_at, tx_id FROM provider_tx WHERE roblox_id = ? AND kind IN ('debit','credit','rollback') ORDER BY created_at DESC LIMIT 500", id) : [];
    for (const r of rounds) push({ at: r.created_at, cat: 'games', kind: 'studio-' + r.kind, title: r.kind === 'debit' ? `Bet in ${r.game || 'a studio game'}` : r.kind === 'credit' ? `Won in ${r.game || 'a studio game'}` : `Refunded in ${r.game || 'a studio game'}`, amount: r.kind === 'debit' ? -r.amount : r.amount, status: r.status, ref: r.round_id || r.tx_id, method: 'LuckyStreak' });

    /* ---------- account, waitlists, referrals ---------- */
    push({ at: u.created_at, cat: 'account', kind: 'created', title: 'Account created', method: u.username ? 'Signed in with Roblox' : 'Rodux arrived before first sign-in' });
    const wl = (t, name) => { const r = one(`SELECT * FROM ${t} WHERE roblox_id = ?`, id); if (r) push({ at: r.joined_at, cat: 'waitlist', kind: 'wait-join', title: `Joined the ${name} waitlist`, note: `Place #${r.pos}` }); };
    const ac = (t, name) => { const r = one(`SELECT * FROM ${t} WHERE roblox_id = ?`, id); if (r) push({ at: r.granted_at, cat: 'waitlist', kind: 'wait-in', title: `Got ${name} access`, method: r.via === 'code' ? 'Access code' : r.via === 'waitlist' ? 'Let in from the waitlist' : 'Let in by an admin' }); };
    wl('site_waitlist', 'site'); ac('site_access', 'site'); wl('waitlist', 'slots'); ac('slot_access', 'slots');
    for (const c of all('SELECT c.code, c.at, a.scope, a.note FROM code_uses c LEFT JOIN access_codes a ON a.code = c.code WHERE c.roblox_id = ?', id)) push({ at: c.at, cat: 'waitlist', kind: 'code', title: `Used a ${c.scope || 'slots'} access code`, ref: c.code, note: c.note });
    for (const r of all('SELECT r.*, u.username FROM referrals r LEFT JOIN users u ON u.roblox_id = r.friend_id WHERE r.referrer_id = ?', id)) {
      push({ at: r.created_at, cat: 'account', kind: 'ref-invite', title: `Referred ${r.username || 'a new player'}`, status: r.status, note: r.reason, link: r.friend_id });
      if (r.status === 'paid') push({ at: r.paid_at, cat: 'money', kind: 'ref-paid', title: `Referral reward for ${r.username || 'a friend'}`, amount: r.reward, method: 'Bonus Rodux (cannot be withdrawn)', ref: r.ref, status: 'ok' });
    }
    const rb = one('SELECT r.*, u.username FROM referrals r LEFT JOIN users u ON u.roblox_id = r.referrer_id WHERE r.friend_id = ?', id);
    if (rb) push({ at: rb.created_at, cat: 'account', kind: 'ref-by', title: `Signed up with ${rb.username || 'a player'}'s invite link`, link: rb.referrer_id, status: rb.status });

    /* ---------- recorded as it happened ---------- */
    const ACT = {
      signin: a => ({ cat: 'security', title: a.data.isNew ? 'Signed up' : 'Signed in', method: [a.data.net && `from ${a.data.net}`, a.data.dev && `on ${a.data.dev}`].filter(Boolean).join(' '), status: a.data.banned ? 'banned' : 'ok', note: a.data.banned || undefined }),
      signout: () => ({ cat: 'security', title: 'Signed out' }),
      legal: a => ({ cat: 'account', title: `Accepted the ${a.data.doc === 'cds' ? 'Currency Deduction Service' : 'Terms of Service'}`, ref: a.data.version }),
      list: a => ({ cat: 'items', title: 'Listed a limited on the marketplace', amount: undefined, value: a.data.price, items: itemsOf([a.data.uid]), method: `Price ${a.data.price}` }),
      unlist: a => ({ cat: 'items', title: 'Took a listing down', items: itemsOf(a.data.uid ? [a.data.uid] : []) }),
      sold: a => ({ cat: 'items', title: `Sold a limited to ${a.data.buyer || 'a player'}`, amount: a.data.price, items: itemsOf([a.data.uid]), method: 'Marketplace', link: a.data.buyerId }),
      profile: a => ({ cat: 'account', title: 'Edited their profile', note: (a.data.fields || []).join(', ') }),
      limits: a => ({ cat: 'account', title: 'Changed responsible-play limits', note: (a.data.fields || []).join(', ') }),
      ticket: a => ({ cat: 'support', title: `Opened ticket ${a.data.id}`, ref: a.data.id, note: a.data.category }),
      gift: a => ({ cat: 'money', title: `Redeemed a $${a.data.usd} gift card`, amount: a.data.rodux, method: a.data.withdrawable ? 'Gift card, can be withdrawn' : 'Gift card, bonus Rodux (cannot be withdrawn)', ref: a.data.ref, status: 'ok' }),
    };
    for (const a of acts) { const f = ACT[a.kind]; if (f) push({ at: a.at, kind: a.kind, ...f(a) }); }

    /* ---------- support and staff ---------- */
    const tickets = all('SELECT t.*, (SELECT COUNT(*) FROM ticket_msgs m WHERE m.ticket_id = t.id) AS msgs, (SELECT COUNT(*) FROM attachments f WHERE f.ticket_id = t.id) AS files FROM tickets t WHERE t.roblox_id = ? ORDER BY t.created_at DESC', id);
    if (!acts.some(a => a.kind === 'ticket')) for (const t of tickets) push({ at: t.created_at, cat: 'support', kind: 'ticket', title: `Opened ticket ${t.id}`, ref: t.id, note: t.subject });
    for (const m of all('SELECT a.*, u.username AS by_name FROM mod_actions a LEFT JOIN users u ON u.roblox_id = a.by_id WHERE a.roblox_id = ? ORDER BY a.at DESC', id))
      push({ at: m.at, cat: 'staff', kind: 'mod-' + m.action, title: { warn: 'Warned', suspend: 'Suspended', kick: 'Kicked', ban: 'Banned', terminate: 'Terminated', unban: 'Unbanned', grant: 'Let in', revoke: 'Access removed', note: 'Staff note' }[m.action] || m.action, note: [m.reason, m.note].filter(Boolean).join(' · '), method: `by ${m.by_name || m.by_id || 'staff'}`, ref: m.ticket_id, until: m.expires_at });
    const ban = one('SELECT * FROM bans WHERE roblox_id = ?', id);
    if (ban && !ban.by_id) push({ at: ban.created_at, cat: 'staff', kind: 'autoban', title: 'Banned automatically', note: ban.reason, link: ban.linked_id, method: 'One account per player' });

    /* ---------- networks and devices ---------- */
    const seen = all('SELECT kind, hash, first_at, last_at FROM sightings WHERE roblox_id = ? ORDER BY last_at DESC', id).map(s => ({
      kind: s.kind, name: KIND_NAME[s.kind], label: label(s.kind, s.hash), first: s.first_at, last: s.last_at,
      others: all('SELECT o.roblox_id, u.username, o.last_at FROM sightings o LEFT JOIN users u ON u.roblox_id = o.roblox_id WHERE o.kind = ? AND o.hash = ? AND o.roblox_id != ?', s.kind, s.hash, id).map(o => ({ robloxId: o.roblox_id, username: o.username, last: o.last_at, banned: security.isBanned(o.roblox_id) })),
    }));

    /* ---------- Trade Empire ---------- */
    let te = { available: false };
    if (GB.enabled()) {
      try {
        const e = await GB.ocGet(id);
        const d = (e && e.value && e.value.Data) || {};
        const txs = Array.isArray(d.transactions) ? d.transactions.slice(-300).reverse() : [];
        const sw = d.siteWallet || {};
        te = { available: true, hasSave: !!e, transactions: txs.map(t => ({ at: num(t && t.t) * 1000, kind: t && t.k, label: (TE_KIND[t && t.k] || [String(t && t.k)])[0], amount: num(t && t.a) * ((TE_KIND[t && t.k] || [0, 1])[1]) })),
          pending: Array.isArray(sw.pending) ? sw.pending.map(p => ({ id: p.id, kind: p.kind, amount: num(p.amount), at: num(p.at) * 1000 })) : [],
          totals: { earned: num(d.earned), purchases: num(d.purchases), soldLimiteds: num(d.soldLimiteds), totalIncoming: num(d.totalIncoming), totalOutgoing: num(d.totalOutgoing), transferredRodux: num(d.transferredRodux) },
          redeemedCodes: Array.isArray(d.redeemedCodes) ? d.redeemedCodes.length : 0, blocked: Array.isArray(d.blockedUserIds) ? d.blockedUserIds.length : 0 };
        for (const t of te.transactions.slice(0, 150)) push({ at: t.at, cat: 'tradeempire', kind: 'te-' + t.kind, title: `In Trade Empire: ${t.label}`, amount: t.amount, method: 'Trade Empire' });
      } catch (err) { te = { available: false, error: err.message }; }
    }

    /* ---------- totals ---------- */
    const ok = e => e.status === 'ok' || e.status === undefined;
    const sum = (f, k = 'amount') => ev.filter(e => ok(e) && f(e)).reduce((s, e) => s + Math.abs(num(e[k])), 0);
    const cnt = f => ev.filter(e => ok(e) && f(e)).length;
    const totals = {
      roduxIn: sum(e => e.cat === 'money' && e.kind === 'deposit'), roduxOut: sum(e => e.cat === 'money' && e.kind === 'withdraw'),
      roduxInWeb: sum(e => e.cat === 'money' && e.kind === 'deposit' && /Website/.test(e.method)), roduxInGame: sum(e => e.cat === 'money' && e.kind === 'deposit' && /In game/.test(e.method)),
      deposits: cnt(e => e.cat === 'money' && e.kind === 'deposit'), withdrawals: cnt(e => e.cat === 'money' && e.kind === 'withdraw'),
      refused: ev.filter(e => e.cat === 'money' && e.status && e.status !== 'ok' && e.status !== 'staged').length,
      itemsIn: ev.filter(e => e.kind === 'item-deposit' && ok(e)).reduce((s, e) => s + (e.items || []).length, 0), itemsInValue: sum(e => e.kind === 'item-deposit', 'value'),
      itemsOut: ev.filter(e => e.kind === 'item-withdraw' && ok(e)).reduce((s, e) => s + (e.items || []).length, 0), itemsOutValue: sum(e => e.kind === 'item-withdraw', 'value'),
      bought: cnt(e => e.kind === 'item-buy'), boughtFor: sum(e => e.kind === 'item-buy'), soldHouse: sum(e => e.kind === 'item-sell'), soldPlayers: sum(e => e.kind === 'sold'),
      flipsWon: cnt(e => e.kind === 'flip-won'), flipsLost: cnt(e => e.kind === 'flip-lost'), flipNet: ev.filter(e => e.kind === 'flip-won' || e.kind === 'flip-lost').reduce((s, e) => s + num(e.value), 0),
      studioBet: sum(e => e.kind === 'studio-debit'), studioWon: sum(e => e.kind === 'studio-credit'),
      signIns: cnt(e => e.kind === 'signin'), networks: seen.filter(s => s.kind === 'ip').length, devices: seen.filter(s => s.kind === 'dev').length,
      tickets: tickets.length, staffActions: cnt(e => e.cat === 'staff'),
    };
    const usage = has('usage') ? all('SELECT day, seconds, net FROM usage WHERE roblox_id = ? ORDER BY day DESC LIMIT 60', id).reverse() : [];

    ev.sort((a, b) => num(b.at) - num(a.at));
    const snapshot = await account.snapshot(id, { staff: true });
    return {
      robloxId: id, username: u.username, walletId: social.walletId(id), joined: u.created_at,
      lastSeen: Math.max(0, ...seen.map(s => s.last)), legal: { tos: u.tos_version, cds: u.cds_version },
      snapshot, totals, events: ev.slice(0, 3000), seen, usage, tradeEmpire: te,
      holdings: held.map(r => ({ ...(D[r.uid] || { itemId: r.item_id, serial: r.serial }), status: r.status, since: r.updated_at, listed: (listings.find(l => l.uid === r.uid) || {}).price })),
      tickets: tickets.map(t => ({ id: t.id, subject: t.subject, category: t.category, status: t.status, created: t.created_at, updated: t.updated_at, messages: t.msgs, files: t.files })),
    };
  }

  /* ---------- finding a player ---------- */
  function search(q) {
    q = String(q || '').trim();
    const out = new Map(), addU = u => { if (u && !out.has(u.roblox_id)) out.set(u.roblox_id, u); };
    if (q) {
      if (/^\d{1,20}$/.test(q)) addU(one('SELECT * FROM users WHERE roblox_id = ?', Number(q)));
      const t = /^TKT-[0-9A-F]{8}$/i.test(q) && one('SELECT roblox_id FROM tickets WHERE id = ?', q.toUpperCase()); if (t) addU(one('SELECT * FROM users WHERE roblox_id = ?', t.roblox_id));
      const r = /^[A-Z2-9]{8}$/i.test(q) && one('SELECT roblox_id FROM ref_codes WHERE code = ?', q.toUpperCase()); if (r) addU(one('SELECT * FROM users WHERE roblox_id = ?', r.roblox_id));
      if (/^TBW-/i.test(q)) { const w = q.toUpperCase(); for (const u of all('SELECT * FROM users')) if (social.walletId(u.roblox_id) === w) { addU(u); break; } }
      for (const u of all("SELECT * FROM users WHERE username LIKE ? ESCAPE '\\' ORDER BY (lower(username) = lower(?)) DESC, created_at DESC LIMIT 25", '%' + q.replace(/[\\%_]/g, m => '\\' + m) + '%', q)) addU(u);
    } else for (const u of all('SELECT u.* FROM users u LEFT JOIN (SELECT roblox_id, MAX(last_at) AS l FROM sightings GROUP BY roblox_id) s ON s.roblox_id = u.roblox_id WHERE u.username IS NOT NULL ORDER BY COALESCE(s.l, u.created_at) DESC LIMIT 25')) addU(u);
    return [...out.values()].slice(0, 25).map(u => ({ robloxId: u.roblox_id, username: u.username, walletId: social.walletId(u.roblox_id), joined: u.created_at, balance: u.balance, banned: !!security.banInfo(u.roblox_id), admin: isAdmin(u.roblox_id),
      lastSeen: (one('SELECT MAX(last_at) AS l FROM sightings WHERE roblox_id = ?', u.roblox_id) || {}).l || null }));
  }

  return { add, player, search };
}

module.exports = { create };
