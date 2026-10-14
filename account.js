// A player's whole account in one place, and what staff can do about it.
//
// snapshot(id) puts together:
//   roblox        the public Roblox profile: name, display name, account age, verified, banned on Roblox
//   tradeEmpire   the Trade Empire save (read only): Rodux, value, RAP, items, play time, trades,
//                 TradePlus, and the game's own Account Standing worked out from Data.violations with
//                 the same rules as ReplicatedStorage.Modules.AccountStandingRules
//   tradeBlacket  the account on this site: balance, deposits, withdrawals, items, access, bans,
//                 staff actions and the standing they add up to
//   staff only    other accounts on the same network, device or hardware, internal notes
// Roblox does not let other sites read a player's Roblox moderation history, so "warnings" means
// the Trade Empire record and the TradeBlacket record.
//
// moderate() applies a staff action: warn, suspend (days), kick (signs out everywhere), ban,
// terminate, unban, grant / revoke site access, or an internal note. Every action is logged.
// Actions apply to TradeBlacket only; the Trade Empire save is never written here.
'use strict';

const DAY = 864e5, WINDOW = 90 * DAY;
class AccountError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }

/* ---------- standing, as the game works it out ---------- */
const LEVELS = {
  excellent: { level: 'excellent', label: 'Excellent', step: 1, message: 'In excellent standing. No violations, ever.' },
  good: { level: 'good', label: 'Good', step: 2, message: 'In good standing. Past violations no longer count against it.' },
  warning: { level: 'warning', label: 'Warning', step: 3, message: 'Has an active violation. Further violations will restrict it.' },
  restricted: { level: 'restricted', label: 'Restricted', step: 4, message: 'Restricted after repeated violations, and at risk of a ban.' },
  suspended: { level: 'suspended', label: 'Suspended', step: 5, message: 'Suspended for breaking the rules.' },
  terminated: { level: 'terminated', label: 'Banned', step: 5, message: 'Terminated for breaking the rules.' },
};
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
// v: [{ action: 'Warning'|'Suspension'|'Termination', issuedAt (ms), expiresAt (ms), appeal }]
function standing(v, now = Date.now()) {
  v = Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : [];
  const over = x => x.appeal === 'accepted';
  const counts = x => !over(x) && now - num(x.issuedAt) < WINDOW;
  const terminated = v.some(x => x.action === 'Termination' && !over(x));
  const suspendedUntil = v.filter(x => x.action === 'Suspension' && !over(x)).reduce((m, x) => (num(x.expiresAt) > now ? Math.max(m, num(x.expiresAt)) : m), 0);
  const active = v.filter(counts).length, history = v.some(x => !over(x));
  const L = terminated ? LEVELS.terminated : suspendedUntil ? LEVELS.suspended : active >= 2 ? LEVELS.restricted : active === 1 ? LEVELS.warning : history ? LEVELS.good : LEVELS.excellent;
  const kind = a => v.filter(x => x.action === a).length;
  return {
    ...L, steps: 5, activeCount: active, terminated, suspendedUntil, spotless: !history,
    totals: { all: v.length, warnings: kind('Warning'), suspensions: kind('Suspension'), terminations: kind('Termination'), overturned: v.filter(over).length },
    violations: v.slice().sort((a, b) => num(b.issuedAt) - num(a.issuedAt)).map(x => ({
      id: String(x.id || ''), action: x.action || 'Warning', reason: String(x.reason || 'Violation of the rules'), note: String(x.moderatorNote || x.note || ''),
      issuedAt: num(x.issuedAt), expiresAt: num(x.expiresAt), appeal: x.appeal || 'none', counts: counts(x),
    })),
  };
}

function create({ db, tx, log = () => {}, isAdmin, security, siteList, items, GB, social, referrals, withdrawable }) {
  db.exec(`CREATE TABLE IF NOT EXISTS mod_actions (id INTEGER PRIMARY KEY AUTOINCREMENT, roblox_id INTEGER NOT NULL, action TEXT NOT NULL, reason TEXT, note TEXT, by_id INTEGER, at INTEGER NOT NULL, expires_at INTEGER, ticket_id TEXT);
    CREATE INDEX IF NOT EXISTS mod_actions_user ON mod_actions (roblox_id, at DESC);`);
  const q = {
    user: db.prepare('SELECT * FROM users WHERE roblox_id = ?'),
    byName: db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)'),
    log: db.prepare('INSERT INTO mod_actions (roblox_id, action, reason, note, by_id, at, expires_at, ticket_id) VALUES (?,?,?,?,?,?,?,?)'),
    actions: db.prepare('SELECT a.*, u.username AS by_name FROM mod_actions a LEFT JOIN users u ON u.roblox_id = a.by_id WHERE a.roblox_id = ? ORDER BY a.at DESC LIMIT 100'),
    kick: db.prepare('DELETE FROM sessions WHERE roblox_id = ?'),
    sessions: db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE roblox_id = ?'),
    tickets: db.prepare('SELECT COUNT(*) AS n FROM tickets WHERE roblox_id = ?'),
    refs: db.prepare("SELECT COUNT(*) AS n, SUM(status = 'paid') AS paid FROM referrals WHERE referrer_id = ?"),
    referredBy: db.prepare('SELECT r.referrer_id, u.username FROM referrals r LEFT JOIN users u ON u.roblox_id = r.referrer_id WHERE r.friend_id = ?'),
  };

  /* ---------- Roblox public profile (cached 10 minutes) ---------- */
  const rbx = new Map();
  async function roblox(id) {
    const c = rbx.get(id); if (c && Date.now() - c.at < 10 * 60e3) return c.v;
    let v;
    try {
      const r = await fetch(`https://users.roblox.com/v1/users/${id}`, { signal: AbortSignal.timeout(8000) });
      if (r.status === 404) v = { id, exists: false };
      else if (!r.ok) throw new Error('roblox ' + r.status);
      else { const j = await r.json(); v = { id, exists: true, name: j.name, displayName: j.displayName, created: Date.parse(j.created) || null, isBanned: !!j.isBanned, verified: !!j.hasVerifiedBadge }; }
    } catch (e) { return { id, error: 'Roblox did not answer.' }; }
    rbx.set(id, { at: Date.now(), v }); if (rbx.size > 5000) rbx.clear();
    return v;
  }

  /* ---------- the Trade Empire save ---------- */
  async function tradeEmpire(id) {
    if (!GB.enabled()) return { available: false, error: 'The site is not connected to Trade Empire saves yet.' };
    let entry;
    try { entry = await GB.ocGet(id); } catch (e) { return { available: false, error: e.message }; }
    if (!entry) return { available: true, hasSave: false };
    const d = (entry.value && entry.value.Data) || {}, s = GB.readSave(entry, Date.now());
    const owned = d.owned && typeof d.owned === 'object' ? d.owned : {};
    const copies = Object.values(owned).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);
    const sub = d.subscription || {}, subOn = sub.tier && sub.tier !== 'None' && num(sub.expiration) * 1000 > Date.now();
    const vio = (Array.isArray(d.violations) ? d.violations : []).map(x => ({ ...x, issuedAt: num(x && x.issuedAt) * 1000, expiresAt: num(x && x.expiresAt) * 1000 }));
    const hist = Array.isArray(d.valueHistory) ? d.valueHistory.filter(p => p && num(p.t)).slice(-60).map(p => ({ t: num(p.t) * 1000, v: num(p.v) })) : [];
    return {
      available: true, hasSave: true, inGame: s.inGame,
      rodux: num(d.pBalance), totalValue: num(d.totalValue), totalRAP: num(d.totalRAP), items: copies, uniqueItems: Object.keys(owned).length,
      playSeconds: num(d.playSeconds), trades: Array.isArray(d.tradeHistory) ? d.tradeHistory.length : 0, activeTrades: Array.isArray(d.activeTrades) ? d.activeTrades.length : 0,
      previousNames: Array.isArray(d.previousNames) ? d.previousNames.slice(-10).map(String) : [],
      tradePlus: subOn ? { tier: String(sub.tier), expires: num(sub.expiration) * 1000 } : null,
      earned: num(d.earned), purchases: num(d.purchases), soldLimiteds: num(d.soldLimiteds), dailyStreak: num(d.dailyRewardTotalDays), giftCredit: num(d.giftCredit),
      siteWallet: { deposited: s.deposited, withdrawn: s.withdrawn }, valueHistory: hist,
      standing: standing(vio),
    };
  }

  /* ---------- TradeBlacket ---------- */
  function siteStanding(id) {
    const acts = q.actions.all(id), b = security.banInfo(id);
    const lifted = acts.filter(a => a.action === 'unban').map(a => a.at);
    const v = acts.filter(a => ['warn', 'suspend', 'ban', 'terminate'].includes(a.action)).map(a => ({
      id: 'TB-' + a.id, action: a.action === 'warn' ? 'Warning' : a.action === 'suspend' ? 'Suspension' : 'Termination',
      reason: a.reason, issuedAt: a.at, expiresAt: a.expires_at || 0,
      // a ban or suspension lifted by staff stops counting, like an accepted appeal in the game
      appeal: a.action !== 'warn' && lifted.some(u => u >= a.at && (!a.expires_at || u < a.expires_at)) ? 'accepted' : 'none',
    }));
    // an automatic ban (one account per player) is on the bans table only
    if (b && !b.by_id) v.push({ id: 'TB-auto', action: 'Termination', reason: b.reason, issuedAt: b.created_at, expiresAt: 0, appeal: 'none' });
    return standing(v);
  }
  function tradeBlacket(id, staff) {
    const u = q.user.get(id); if (!u) return null;
    const b = security.banInfo(id), refs = q.refs.get(id) || {}, by = q.referredBy.get(id);
    const acts = q.actions.all(id).filter(a => staff || a.action !== 'note');
    return {
      username: u.username, walletId: social.walletId(id), joined: u.created_at,
      balance: u.balance, bonusLock: u.bonus_lock, deposited: u.deposited, withdrawn: u.withdrawn, withdrawable: withdrawable(u),
      itemValue: items.siteItemValue(id), access: !b && siteList.hasAccess(id), admin: isAdmin(id),
      banned: b ? { kind: b.kind || 'ban', reason: b.reason, at: b.created_at, until: b.expires_at || null, automatic: !b.by_id } : null,
      standing: siteStanding(id),
      actions: acts.map(a => ({ action: a.action, reason: a.reason, note: staff ? a.note : undefined, by: staff ? a.by_name || (a.by_id ? String(a.by_id) : 'System') : 'TradeBlacket staff', at: a.at, until: a.expires_at, ticket: a.ticket_id })),
      referrals: { invited: refs.n || 0, paid: refs.paid || 0, referredBy: by ? by.username || String(by.referrer_id) : null },
      tickets: q.tickets.get(id).n,
      ...(staff ? { sessions: q.sessions.get(id).n, seen: security.seenCounts(id), linked: security.linked(id) } : {}),
    };
  }

  async function snapshot(id, { staff = false } = {}) {
    const [r, te] = await Promise.all([roblox(id), tradeEmpire(id)]);
    return { robloxId: id, at: Date.now(), roblox: r, tradeEmpire: te, tradeBlacket: tradeBlacket(id, staff) };
  }
  // The part a player may see of their own snapshot (no linked accounts, no internal notes).
  function forPlayer(s) {
    if (!s || !s.tradeBlacket) return s;
    const { sessions, seen, linked, ...tb } = s.tradeBlacket;
    return { ...s, tradeBlacket: { ...tb, actions: (tb.actions || []).filter(a => a.action !== 'note').map(a => ({ ...a, note: undefined, by: 'TradeBlacket staff' })) } };
  }

  /* ---------- staff actions ---------- */
  const ACTIONS = ['warn', 'suspend', 'kick', 'ban', 'terminate', 'unban', 'grant', 'revoke', 'note'];
  function find(who) {
    const s = String(who == null ? '' : who).trim();
    const u = /^\d{1,20}$/.test(s) ? q.user.get(Number(s)) : q.byName.get(s);
    if (!u) throw new AccountError('No TradeBlacket account with that name or id.', 404);
    return u.roblox_id;
  }
  // Returns { ok, action, message } where message is the line shown in the ticket.
  function moderate(admin, b) {
    if (!isAdmin(admin)) throw new AccountError('Only admins can do that.', 403);
    const action = String(b.action || ''); if (!ACTIONS.includes(action)) throw new AccountError('Pick an action.');
    const id = find(b.robloxId != null ? b.robloxId : b.who);
    if (isAdmin(id) && action !== 'note') throw new AccountError('Admins cannot be moderated.');
    const reason = String(b.reason || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 160);
    const note = String(b.note || '').trim().slice(0, 1000) || null;
    const ticket = b.ticketId ? String(b.ticketId).slice(0, 20) : null;
    if (['warn', 'suspend', 'ban', 'terminate'].includes(action) && reason.length < 3) throw new AccountError('Give a reason. The player sees it.');
    if (action === 'note' && !note && !reason) throw new AccountError('Write the note first.');
    const days = Math.min(365, Math.max(1, Math.floor(Number(b.days) || 0)));
    const t = Date.now(); let until = null, msg;
    tx(() => {
      if (action === 'warn') msg = `Warning issued: ${reason}`;
      if (action === 'suspend') { until = t + days * DAY; security.ban(id, reason, null, admin, 'suspend', until, true); q.kick.run(id); msg = `Suspended for ${days} day${days === 1 ? '' : 's'}: ${reason}`; }
      if (action === 'kick') { q.kick.run(id); msg = 'Signed out of TradeBlacket on every device.'; }
      if (action === 'ban') { security.ban(id, reason, null, admin, 'ban', null, true); q.kick.run(id); msg = `Banned: ${reason}`; }
      if (action === 'terminate') { security.ban(id, reason, null, admin, 'terminate', null, true); q.kick.run(id); msg = `Account terminated: ${reason}`; }
      if (action === 'unban') { db.prepare('DELETE FROM bans WHERE roblox_id = ?').run(id); msg = 'Ban lifted. The account is back in good order.'; }
      if (action === 'grant') { siteList.grant(admin, id); msg = 'Let into TradeBlacket.'; }
      if (action === 'revoke') { siteList.revoke(admin, id); msg = 'Access to TradeBlacket removed.'; }
      if (action === 'note') msg = null;
      q.log.run(id, action, reason || null, note, admin, t, until, ticket);
    });
    log('mod', action, id, 'by', admin, reason);
    return { ok: true, action, robloxId: id, message: msg, internal: action === 'note' ? (note || reason) : null };
  }

  return { snapshot, forPlayer, roblox, tradeEmpire, tradeBlacket, moderate, find, standing, AccountError, ACTIONS };
}

module.exports = { create, standing, AccountError };
