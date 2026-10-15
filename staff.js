// Staff ranks, side roles and permissions.
//
// Ranks are a ladder: Trial Moderator, Moderator, Senior Moderator, Admin, Head Admin, HR, Owner.
// Side roles add permissions on top of a rank (or on their own): Support Agent, Partner Manager,
// Finance, Developer, Trust & Safety.
//
// What each rank and role may do comes from DEFAULTS below; HR can switch single permissions on or
// off per rank or role (staff_perm_overrides). HR and Owner always have every permission.
// The Owner accounts are ADMIN_ROBLOX_IDS and cannot be changed from the site.
//
// Rules everywhere: a staff member only acts on accounts below their own level (players are level 0),
// and can only hand out ranks below their own. Every staff action is written to the audit log.
'use strict';

const OWNERS = new Set(String(process.env.ADMIN_ROBLOX_IDS || '496295513').split(',').map(s => Number(s.trim())).filter(Boolean));

const PERMS = {
  'dash.view': 'See the staff dashboard',
  'tickets.view': 'Read support tickets',
  'tickets.reply': 'Reply to, close and reopen tickets, and add staff notes',
  'tickets.assign': 'Assign tickets to staff',
  'players.view': 'Look up players, their logs and account standing',
  'bans.view': 'See the ban list',
  'mod.note': 'Add staff notes to an account',
  'mod.warn': 'Warn players',
  'mod.kick': 'Kick players (sign them out everywhere)',
  'mod.suspend': 'Suspend players for a set time',
  'mod.ban': 'Ban players',
  'mod.unban': 'Lift bans and suspensions',
  'mod.terminate': 'Terminate accounts',
  'mod.grant': 'Give or take away site access',
  'site.waitlist': 'Run the site and slots waitlists and access codes',
  'site.settings': 'Change site settings',
  'gifts.manage': 'Make and void gift cards',
  'biz.review': 'Approve or decline Business members',
  'biz.tepp': 'Approve or decline Trade Empire Partners',
  'biz.pay': 'Pay Business Cards and hand out giveaway codes',
  'biz.wage': 'Set partner monthly wages',
  'biz.requests': 'Answer Business feature requests',
  'biz.youtube': 'Verify YouTube channels by hand',
  'legal.view': 'See signed agreements',
  'audit.view': 'See the staff audit log',
  'staff.manage': 'Hire, promote, demote and remove staff',
  'staff.perms': 'Change what each rank and role may do',
};
const ALL = Object.keys(PERMS);

const RANKS = [
  { key: 'trial', name: 'Trial Moderator', level: 10 },
  { key: 'mod', name: 'Moderator', level: 20 },
  { key: 'senior', name: 'Senior Moderator', level: 30 },
  { key: 'admin', name: 'Admin', level: 40 },
  { key: 'head', name: 'Head Admin', level: 50 },
  { key: 'hr', name: 'HR', level: 60 },
  { key: 'owner', name: 'Owner', level: 100 },
];
const ROLES = [
  { key: 'support', name: 'Support Agent' },
  { key: 'partners', name: 'Partner Manager' },
  { key: 'finance', name: 'Finance' },
  { key: 'dev', name: 'Developer' },
  { key: 'safety', name: 'Trust & Safety' },
];
const SIDE_LEVEL = 5;   // staff with only a side role sit just above players

const trial = ['dash.view', 'tickets.view', 'players.view', 'bans.view', 'mod.note', 'mod.warn'];
const mod = [...trial, 'mod.kick', 'mod.suspend', 'biz.review', 'biz.requests'];
const senior = [...mod, 'mod.ban', 'mod.grant', 'site.waitlist', 'biz.youtube'];
const admin = [...senior, 'tickets.reply', 'tickets.assign', 'mod.unban', 'gifts.manage', 'biz.tepp', 'audit.view'];
const head = [...admin, 'mod.terminate', 'biz.pay', 'biz.wage', 'site.settings', 'legal.view'];
const DEFAULTS = {
  trial, mod, senior, admin, head, hr: ALL, owner: ALL,
  support: ['dash.view', 'tickets.view', 'tickets.reply', 'players.view', 'mod.note'],
  partners: ['dash.view', 'players.view', 'biz.review', 'biz.tepp', 'biz.pay', 'biz.wage', 'biz.requests', 'biz.youtube'],
  finance: ['dash.view', 'players.view', 'gifts.manage', 'biz.pay', 'biz.wage', 'audit.view'],
  dev: ['dash.view', 'site.settings', 'site.waitlist', 'audit.view'],
  safety: ['dash.view', 'players.view', 'bans.view', 'mod.note', 'mod.warn', 'mod.suspend', 'mod.ban', 'mod.unban', 'legal.view'],
};
const LOCKED = new Set(['hr', 'owner']);   // always everything

class StaffError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }

function create({ db, log = () => {} }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (roblox_id INTEGER PRIMARY KEY, rank TEXT, roles TEXT NOT NULL DEFAULT '[]', title TEXT, note TEXT, hired_by INTEGER, hired_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS staff_perm_overrides (role TEXT NOT NULL, perm TEXT NOT NULL, allowed INTEGER NOT NULL, by_id INTEGER, at INTEGER NOT NULL, PRIMARY KEY (role, perm));
    CREATE TABLE IF NOT EXISTS staff_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor INTEGER NOT NULL, action TEXT NOT NULL, target INTEGER, detail TEXT, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS staff_audit_at ON staff_audit (at DESC);
    CREATE TABLE IF NOT EXISTS ticket_assign (ticket_id TEXT PRIMARY KEY, staff_id INTEGER, by_id INTEGER, at INTEGER NOT NULL);
  `);
  const q = {
    get: db.prepare('SELECT * FROM staff WHERE roblox_id = ?'),
    all: db.prepare('SELECT s.*, u.username FROM staff s LEFT JOIN users u ON u.roblox_id = s.roblox_id ORDER BY s.hired_at'),
    put: db.prepare('INSERT INTO staff (roblox_id, rank, roles, title, note, hired_by, hired_at, updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(roblox_id) DO UPDATE SET rank = excluded.rank, roles = excluded.roles, title = excluded.title, note = excluded.note, updated_at = excluded.updated_at'),
    del: db.prepare('DELETE FROM staff WHERE roblox_id = ?'),
    overrides: db.prepare('SELECT * FROM staff_perm_overrides'),
    setOverride: db.prepare('INSERT INTO staff_perm_overrides (role, perm, allowed, by_id, at) VALUES (?,?,?,?,?) ON CONFLICT(role, perm) DO UPDATE SET allowed = excluded.allowed, by_id = excluded.by_id, at = excluded.at'),
    clearOverride: db.prepare('DELETE FROM staff_perm_overrides WHERE role = ? AND perm = ?'),
    audit: db.prepare('INSERT INTO staff_audit (actor, action, target, detail, at) VALUES (?,?,?,?,?)'),
    auditList: db.prepare('SELECT a.*, u.username AS actor_name, t.username AS target_name FROM staff_audit a LEFT JOIN users u ON u.roblox_id = a.actor LEFT JOIN users t ON t.roblox_id = a.target WHERE (? IS NULL OR a.actor = ? OR a.target = ?) ORDER BY a.at DESC LIMIT ?'),
    user: db.prepare('SELECT roblox_id, username FROM users WHERE roblox_id = ? OR lower(username) = lower(?)'),
    assign: db.prepare('INSERT INTO ticket_assign (ticket_id, staff_id, by_id, at) VALUES (?,?,?,?) ON CONFLICT(ticket_id) DO UPDATE SET staff_id = excluded.staff_id, by_id = excluded.by_id, at = excluded.at'),
    assigned: db.prepare('SELECT a.*, u.username FROM ticket_assign a LEFT JOIN users u ON u.roblox_id = a.staff_id'),
  };
  const now = () => Date.now();
  const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
  const rankOf = key => RANKS.find(r => r.key === key) || null;

  // Permissions for one rank or role key, with HR's overrides applied.
  let cache = null;
  function matrix() {
    if (cache) return cache;
    const m = {};
    for (const k of [...RANKS.map(r => r.key), ...ROLES.map(r => r.key)]) m[k] = new Set(DEFAULTS[k] || []);
    for (const o of q.overrides.all()) if (m[o.role] && !LOCKED.has(o.role) && PERMS[o.perm]) o.allowed ? m[o.role].add(o.perm) : m[o.role].delete(o.perm);
    return (cache = m);
  }

  // Who someone is on staff: rank, side roles, level and permissions. Players get null.
  function member(id) {
    id = Number(id);
    if (OWNERS.has(id)) return { robloxId: id, rank: 'owner', rankName: 'Owner', roles: [], level: 100, perms: new Set(ALL), owner: true };
    const s = q.get.get(id); if (!s) return null;
    const roles = parse(s.roles, []).filter(r => ROLES.some(x => x.key === r));
    const rk = rankOf(s.rank);
    if (!rk && !roles.length) return null;
    const M = matrix(), perms = new Set();
    for (const k of [rk && rk.key, ...roles].filter(Boolean)) for (const p of M[k]) perms.add(p);
    return { robloxId: id, rank: rk ? rk.key : null, rankName: rk ? rk.name : null, roles, level: rk ? rk.level : SIDE_LEVEL, perms, title: s.title || null, hiredAt: s.hired_at };
  }
  const isStaff = id => !!member(id);
  const isOwner = id => OWNERS.has(Number(id));
  const level = id => { const m = member(id); return m ? m.level : 0; };
  const can = (id, perm) => { const m = member(id); return !!m && m.perms.has(perm); };
  const outranks = (actor, target) => level(actor) > level(target);
  function must(id, perm) { if (!can(id, perm)) throw new StaffError(`Your staff rank cannot do that (${PERMS[perm] ? PERMS[perm].toLowerCase() : perm}).`, 403); }
  function mustOutrank(actor, target) { if (Number(actor) === Number(target)) throw new StaffError('You cannot do that to your own account.'); if (!outranks(actor, target)) throw new StaffError('You can only act on accounts below your own staff rank.', 403); }

  // What the signed-in person's browser needs.
  function view(id) {
    const m = member(id); if (!m) return null;
    return { rank: m.rank, rankName: m.rankName, roles: m.roles, roleNames: m.roles.map(r => ROLES.find(x => x.key === r).name), level: m.level, perms: [...m.perms].sort(), owner: !!m.owner, title: m.title || null };
  }
  // The badge players see in chat and on profiles.
  function badge(id) { const m = member(id); if (!m) return null; return { rank: m.rankName || (m.roles[0] && ROLES.find(x => x.key === m.roles[0]).name), title: m.title || null, level: m.level }; }

  function audit(actor, action, target = null, detail = null) {
    q.audit.run(Number(actor), String(action).slice(0, 80), target == null ? null : Number(target) || null, detail ? JSON.stringify(detail).slice(0, 2000) : null, now());
  }

  /* ---------- HR: the team ---------- */
  function list(actor) {
    must(actor, 'dash.view');
    const rows = q.all.all().map(s => ({ ...s, m: member(s.roblox_id) })).filter(s => s.m);
    const owners = [...OWNERS].map(id => ({ robloxId: id, username: (q.user.get(id, '') || {}).username || String(id), rank: 'owner', rankName: 'Owner', roles: [], level: 100, owner: true }));
    return {
      ranks: RANKS, roles: ROLES, perms: PERMS, matrix: Object.fromEntries(Object.entries(matrix()).map(([k, v]) => [k, [...v].sort()])), locked: [...LOCKED],
      defaults: DEFAULTS,
      staff: owners.concat(rows.map(s => ({ robloxId: s.roblox_id, username: s.username || String(s.roblox_id), rank: s.m.rank, rankName: s.m.rankName, roles: s.m.roles, level: s.m.level, title: s.title, note: can(actor, 'staff.manage') ? s.note : null, hiredBy: s.hired_by, hiredAt: s.hired_at, updatedAt: s.updated_at }))),
      me: view(actor),
    };
  }
  // Hire, promote, demote or change side roles. rank null + no roles = removed from staff.
  function set(actor, b) {
    must(actor, 'staff.manage');
    const u = q.user.get(Number(b.who) || -1, String(b.who || '').trim());
    if (!u) throw new StaffError('No TradeBlacket account with that name or id. They need to sign in once first.', 404);
    const id = u.roblox_id;
    if (isOwner(id)) throw new StaffError('Owners are set on the server and cannot be changed here.');
    if (id === Number(actor)) throw new StaffError('You cannot change your own rank.');
    const before = member(id), A = level(actor);
    if (before && before.level >= A) throw new StaffError('You can only change staff below your own rank.', 403);
    const rk = b.rank ? rankOf(b.rank) : null;
    if (b.rank && (!rk || rk.key === 'owner')) throw new StaffError('Pick a rank.');
    if (rk && rk.level >= A) throw new StaffError('You can only give ranks below your own.', 403);
    const roles = [...new Set((Array.isArray(b.roles) ? b.roles : []).filter(r => ROLES.some(x => x.key === r)))];
    const title = String(b.title || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) || null;
    const note = String(b.note || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 500) || null;
    if (!rk && !roles.length) {
      if (!before) throw new StaffError('They are not on staff.');
      q.del.run(id); cache = null;
      audit(actor, 'staff.remove', id, { was: before.rankName, roles: before.roles });
      return list(actor);
    }
    const old = q.get.get(id);
    q.put.run(id, rk ? rk.key : null, JSON.stringify(roles), title, note, old ? old.hired_by : Number(actor), old ? old.hired_at : now(), now());
    cache = null;
    audit(actor, before ? 'staff.change' : 'staff.hire', id, { from: before ? before.rankName : null, to: rk ? rk.name : null, roles, title });
    return list(actor);
  }
  // HR: switch one permission on or off for a rank or role ("reset" goes back to the default).
  function setPerm(actor, b) {
    must(actor, 'staff.perms');
    const role = String(b.role || ''), perm = String(b.perm || '');
    if (!DEFAULTS[role]) throw new StaffError('Pick a rank or role.');
    if (LOCKED.has(role)) throw new StaffError('HR and Owner always have every permission.');
    if (!PERMS[perm]) throw new StaffError('Unknown permission.');
    const rk = rankOf(role);
    if (rk && rk.level >= level(actor)) throw new StaffError('You can only change ranks below your own.', 403);
    if (b.reset) q.clearOverride.run(role, perm); else q.setOverride.run(role, perm, b.allowed ? 1 : 0, Number(actor), now());
    cache = null;
    audit(actor, 'staff.perm', null, { role, perm, allowed: b.reset ? 'default' : !!b.allowed });
    return list(actor);
  }
  function auditLog(actor, who, limit = 200) {
    must(actor, 'audit.view');
    const id = who ? (q.user.get(Number(who) || -1, String(who)) || {}).roblox_id || -1 : null;
    return q.auditList.all(id, id, id, Math.min(500, Math.max(1, Number(limit) || 200))).map(a => ({ id: a.id, actor: a.actor, actorName: a.actor_name, action: a.action, target: a.target, targetName: a.target_name, detail: parse(a.detail, null), at: a.at }));
  }

  /* ---------- tickets: who is handling what ---------- */
  function assignments() { const o = {}; for (const a of q.assigned.all()) if (a.staff_id) o[a.ticket_id] = { staffId: a.staff_id, name: a.username, at: a.at }; return o; }
  function assign(actor, ticketId, staffId) {
    const self = staffId == null || Number(staffId) === Number(actor);
    if (self) must(actor, 'tickets.reply'); else must(actor, 'tickets.assign');
    if (staffId && !can(staffId, 'tickets.reply')) throw new StaffError('That person cannot answer tickets.');
    if (!/^TKT-[0-9A-F]{8}$/.test(String(ticketId))) throw new StaffError('Ticket not found.', 404);
    q.assign.run(ticketId, staffId === 0 ? null : Number(staffId == null ? actor : staffId), Number(actor), now());
    audit(actor, 'ticket.assign', staffId || actor, { ticket: ticketId });
    return assignments();
  }

  return { PERMS, RANKS, ROLES, member, view, badge, isStaff, isOwner, level, can, must, outranks, mustOutrank, audit, list, set, setPerm, auditLog, assignments, assign, StaffError };
}

module.exports = { create, PERMS, RANKS, ROLES, DEFAULTS };
