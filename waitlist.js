// Waitlists and access codes, for the whole site ("site") and for slots ("slots").
//
// Players sign in, join a waitlist and keep the place they joined in: the first to join is #1.
// Access is given in waitlist order by an admin, or straight away with an access code made for that
// list. Admins are the Roblox accounts in ADMIN_ROBLOX_IDS and always have access.
'use strict';
const crypto = require('node:crypto');

const ADMINS = new Set(String(process.env.ADMIN_ROBLOX_IDS || '496295513').split(',').map(s => Number(s.trim())).filter(Boolean));
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I
const newCode = () => { const b = crypto.randomBytes(10); let s = ''; for (let i = 0; i < 10; i++) s += ALPHA[b[i] % ALPHA.length]; return `TB-${s.slice(0, 5)}-${s.slice(5)}`; };
const norm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

class WaitError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }

function create({ db, tx, scope = 'slots', blocked = () => false }) {
  const W = scope === 'site' ? 'site_waitlist' : 'waitlist', A = scope === 'site' ? 'site_access' : 'slot_access';
  db.exec(`CREATE TABLE IF NOT EXISTS ${W} (pos INTEGER PRIMARY KEY AUTOINCREMENT, roblox_id INTEGER NOT NULL UNIQUE, joined_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS ${A} (roblox_id INTEGER PRIMARY KEY, via TEXT NOT NULL, granted_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS access_codes (code TEXT PRIMARY KEY, uses_left INTEGER NOT NULL, note TEXT, created_by INTEGER, created_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS code_uses (code TEXT NOT NULL, roblox_id INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (code, roblox_id))`);
  if (!db.prepare('PRAGMA table_info(access_codes)').all().some(c => c.name === 'scope')) db.exec("ALTER TABLE access_codes ADD COLUMN scope TEXT NOT NULL DEFAULT 'slots'");
  const q = {
    entry: db.prepare(`SELECT * FROM ${W} WHERE roblox_id = ?`),
    join: db.prepare(`INSERT OR IGNORE INTO ${W} (roblox_id, joined_at) VALUES (?, ?)`),
    total: db.prepare(`SELECT COUNT(*) AS n FROM ${W}`),
    waitingAhead: db.prepare(`SELECT COUNT(*) AS n FROM ${W} w WHERE w.pos < ? AND NOT EXISTS (SELECT 1 FROM ${A} a WHERE a.roblox_id = w.roblox_id)`),
    waiting: db.prepare(`SELECT COUNT(*) AS n FROM ${W} w WHERE NOT EXISTS (SELECT 1 FROM ${A} a WHERE a.roblox_id = w.roblox_id)`),
    access: db.prepare(`SELECT * FROM ${A} WHERE roblox_id = ?`),
    grant: db.prepare(`INSERT OR IGNORE INTO ${A} (roblox_id, via, granted_at) VALUES (?, ?, ?)`),
    revoke: db.prepare(`DELETE FROM ${A} WHERE roblox_id = ?`),
    granted: db.prepare(`SELECT COUNT(*) AS n FROM ${A}`),
    code: db.prepare(`SELECT * FROM access_codes WHERE code = ?`),
    addCode: db.prepare(`INSERT INTO access_codes (code, uses_left, note, created_by, created_at, scope) VALUES (?, ?, ?, ?, ?, '${scope}')`),
    useCode: db.prepare(`UPDATE access_codes SET uses_left = uses_left - 1 WHERE code = ? AND uses_left > 0`),
    addUse: db.prepare(`INSERT INTO code_uses (code, roblox_id, at) VALUES (?, ?, ?)`),
    codes: db.prepare(`SELECT c.code, c.uses_left, c.note, c.created_at, (SELECT COUNT(*) FROM code_uses u WHERE u.code = c.code) AS used FROM access_codes c WHERE c.scope = '${scope}' ORDER BY c.created_at DESC LIMIT 100`),
    next: db.prepare(`SELECT w.roblox_id FROM ${W} w WHERE NOT EXISTS (SELECT 1 FROM ${A} a WHERE a.roblox_id = w.roblox_id) ORDER BY w.pos LIMIT ?`),
    list: db.prepare(`SELECT w.pos, w.roblox_id, u.username, w.joined_at, a.via, a.granted_at FROM ${W} w LEFT JOIN users u ON u.roblox_id = w.roblox_id LEFT JOIN ${A} a ON a.roblox_id = w.roblox_id ORDER BY w.pos LIMIT 500`),
  };
  const now = () => Date.now();
  const isAdmin = id => ADMINS.has(Number(id));
  // A banned player (blocked) never has access and cannot join or redeem.
  const hasAccess = id => isAdmin(id) || (!blocked(id) && !!q.access.get(id));
  const BANNED = 'This account is banned, so it cannot join the waitlist.';

  // A player's place. "place" is the order they joined in; "ahead" is how many still wait before them.
  function status(id) {
    const e = id ? q.entry.get(id) : null, a = id ? q.access.get(id) : null;
    return {
      open: false,
      access: id ? hasAccess(id) : false, via: a ? a.via : (id && isAdmin(id) ? 'admin' : null),
      joined: !!e, place: e ? e.pos : null, ahead: e ? q.waitingAhead.get(e.pos).n : null,
      waiting: q.waiting.get().n, total: q.total.get().n, admin: id ? isAdmin(id) : false,
    };
  }
  function join(id) { if (blocked(id) && !isAdmin(id)) throw new WaitError(BANNED, 403); q.join.run(id, now()); return status(id); }
  function redeem(id, raw) {
    const c = norm(raw), body = c.length === 12 && c.startsWith('TB') ? c.slice(2) : c;
    if (blocked(id) && !isAdmin(id)) throw new WaitError(BANNED, 403);
    if (body.length !== 10) throw new WaitError('Enter the full access code, like TB-ABCDE-FGHJK.');
    const code = `TB-${body.slice(0, 5)}-${body.slice(5)}`;
    tx(() => {
      const row = q.code.get(code);
      if (!row || (row.scope || 'slots') !== scope) throw new WaitError('That access code does not exist. Check it and try again.');
      if (hasAccess(id)) return;
      if (!q.useCode.run(code).changes) throw new WaitError('That access code has been used up.');
      q.addUse.run(code, id, now()); q.join.run(id, now()); q.grant.run(id, 'code', now());
    });
    return status(id);
  }
  // Admin
  function makeCodes(admin, count, uses, note) {
    if (!isAdmin(admin)) throw new WaitError('Only admins can do that.', 403);
    count = Math.min(50, Math.max(1, Math.floor(Number(count) || 1))); uses = Math.min(10000, Math.max(1, Math.floor(Number(uses) || 1)));
    const out = []; tx(() => { for (let i = 0; i < count; i++) { const c = newCode(); q.addCode.run(c, uses, String(note || '').slice(0, 80) || null, admin, now()); out.push(c); } });
    return { codes: out };
  }
  function grantNext(admin, count) {
    if (!isAdmin(admin)) throw new WaitError('Only admins can do that.', 403);
    count = Math.min(1000, Math.max(1, Math.floor(Number(count) || 1)));
    const ids = q.next.all(count * 2 + 50).map(r => r.roblox_id).filter(r => !blocked(r)).slice(0, count); tx(() => ids.forEach(r => q.grant.run(r, 'waitlist', now())));
    return { granted: ids.length };
  }
  function adminView(admin) {
    if (!isAdmin(admin)) throw new WaitError('Only admins can do that.', 403);
    return { waiting: q.waiting.get().n, total: q.total.get().n, granted: q.granted.get().n, list: q.list.all(), codes: q.codes.all() };
  }
  function grant(admin, id) { if (!isAdmin(admin)) throw new WaitError('Only admins can do that.', 403); q.join.run(Number(id), now()); q.grant.run(Number(id), 'admin', now()); return { ok: true }; }
  function revoke(admin, id) { if (!isAdmin(admin)) throw new WaitError('Only admins can do that.', 403); q.revoke.run(Number(id)); return { ok: true }; }

  return { scope, status, join, redeem, makeCodes, grantNext, adminView, grant, revoke, hasAccess, isAdmin, WaitError };
}

module.exports = { create };
