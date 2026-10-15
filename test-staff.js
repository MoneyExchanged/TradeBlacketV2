// Staff ranks, side roles, permissions, the audit log and the ticket queue.
// Run: node test-staff.js
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-staff-'));
process.env.DB_PATH = path.join(dir, 'tb.db');
process.env.ADMIN_ROBLOX_IDS = '1';
const { server, db } = require('./server.js');
let base; const jar = {};
async function call(who, p, body) { const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(who ? { cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; }
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);
// 1 Owner, 2 HR, 3 Admin, 4 Trial Mod, 5 Support Agent, 6 Moderator, 7..9 players
const NAMES = { 1: 'Owner', 2: 'Hilde', 3: 'Adam', 4: 'Tom', 5: 'Sara', 6: 'Mo', 7: 'Pat', 8: 'Quin', 9: 'Rae' };

(async () => {
  await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  for (const id of Object.keys(NAMES).map(Number)) { db.prepare("INSERT INTO users (roblox_id, username, created_at, tos_version) VALUES (?, ?, ?, '2026-10-15.2')").run(id, NAMES[id], id); const t = String(id).repeat(64).slice(0, 64); db.prepare('INSERT INTO sessions VALUES (?, ?, 0)').run(t, id); jar[id] = 'tb_session=' + t; }
  let r;

  r = await call(1, '/api/me'); assert.equal(r.body.staff.rank, 'owner'); assert.ok(r.body.staff.perms.includes('staff.perms')); ok('the owner has every permission');
  r = await call(7, '/api/me'); assert.equal(r.body.staff, null); r = await call(7, '/api/admin/dashboard'); assert.equal(r.status, 403); ok('players are not staff and cannot open the panel');

  r = await call(1, '/api/admin/staff', { who: 'Hilde', rank: 'hr' }); assert.equal(r.status, 200);
  r = await call(2, '/api/admin/staff', { who: 'Adam', rank: 'admin' }); assert.equal(r.status, 200);
  r = await call(2, '/api/admin/staff', { who: 'Tom', rank: 'trial' }); assert.equal(r.status, 200);
  r = await call(2, '/api/admin/staff', { who: 'Sara', roles: ['support'] }); assert.equal(r.status, 200);
  r = await call(2, '/api/admin/staff', { who: 'Mo', rank: 'mod', title: 'Night shift' }); assert.equal(r.status, 200);
  assert.equal(r.body.staff.length, 6); ok('HR hires an Admin, a Trial Moderator, a Support Agent and a Moderator');

  r = await call(2, '/api/admin/staff', { who: 'Pat', rank: 'hr' }); assert.equal(r.status, 403);
  r = await call(3, '/api/admin/staff', { who: 'Pat', rank: 'trial' }); assert.equal(r.status, 403);
  r = await call(2, '/api/admin/staff', { who: 'Owner', rank: 'trial' }); assert.equal(r.status, 400);
  r = await call(2, '/api/admin/staff', { who: 'Hilde', rank: 'head' }); assert.equal(r.status, 400); ok('nobody gives a rank at or above their own, Admins cannot hire, Owners and yourself cannot be changed');

  r = await call(2, '/api/me'); assert.equal(r.body.staff.perms.length, Object.keys(require('./staff.js').PERMS).length); ok('HR gets everything');
  r = await call(3, '/api/me'); assert.ok(r.body.staff.perms.includes('tickets.reply')); assert.ok(!r.body.staff.perms.includes('mod.terminate')); assert.ok(!r.body.staff.perms.includes('staff.manage'));
  r = await call(4, '/api/me'); assert.ok(r.body.staff.perms.includes('tickets.view')); assert.ok(!r.body.staff.perms.includes('tickets.reply')); ok('Admins answer tickets; Trial Moderators can only read them');

  r = await call(7, '/api/support', { category: 'account', subject: 'Lost my Rodux', body: 'My deposit did not arrive yesterday.' }); const tk = r.body.id; assert.ok(tk);
  r = await call(4, '/api/admin/tickets'); assert.equal(r.status, 200); assert.equal(r.body.tickets.length, 1); assert.equal(r.body.canReply, false);
  r = await call(4, `/api/support/${tk}/reply`, { body: 'Looking into it' }); assert.equal(r.status, 403);
  r = await call(3, `/api/support/${tk}/reply`, { body: 'Looking into it now.' }); assert.equal(r.status, 200); ok('a Trial Moderator sees the ticket queue but cannot reply; an Admin can');
  r = await call(5, `/api/support/${tk}/reply`, { body: 'Support here, found it.' }); assert.equal(r.status, 200); ok('a Support Agent (side role, no rank) answers tickets too');

  r = await call(3, '/api/admin/tickets/assign', { ticketId: tk, staffId: 5 }); assert.equal(r.status, 200); assert.equal(r.body.assigned[tk].staffId, 5);
  r = await call(5, '/api/admin/tickets/assign', { ticketId: tk, staffId: 3 }); assert.equal(r.status, 403);
  r = await call(5, '/api/admin/tickets/assign', { ticketId: tk }); assert.equal(r.status, 200); assert.equal(r.body.assigned[tk].staffId, 5); ok('Admins assign tickets to others; agents can only take tickets themselves');

  r = await call(4, '/api/admin/mod', { robloxId: 8, action: 'warn', reason: 'Spamming chat' }); assert.equal(r.status, 200);
  r = await call(4, '/api/admin/mod', { robloxId: 8, action: 'ban', reason: 'Spamming chat' }); assert.equal(r.status, 403);
  r = await call(6, '/api/admin/mod', { robloxId: 8, action: 'suspend', reason: 'Spamming chat', days: 1 }); assert.equal(r.status, 200);
  r = await call(3, '/api/admin/mod', { robloxId: 8, action: 'terminate', reason: 'Spamming chat' }); assert.equal(r.status, 403);
  r = await call(2, '/api/admin/mod', { robloxId: 9, action: 'terminate', reason: 'Scamming players' }); assert.equal(r.status, 200); ok('each rank can only use its own actions: Trial warns, Mod suspends, only Head Admin and up terminate');

  r = await call(6, '/api/admin/mod', { robloxId: 3, action: 'warn', reason: 'Testing ranks' }); assert.equal(r.status, 403);
  r = await call(3, '/api/admin/mod', { robloxId: 6, action: 'warn', reason: 'Be on time' }); assert.equal(r.status, 200);
  r = await call(3, '/api/admin/ban', { who: 'Hilde', reason: 'nope' }); assert.equal(r.status, 403); ok('staff can only act on accounts below their own rank');

  r = await call(4, '/api/admin/staff/perm', { role: 'trial', perm: 'tickets.reply', allowed: true }); assert.equal(r.status, 403);
  r = await call(2, '/api/admin/staff/perm', { role: 'trial', perm: 'tickets.reply', allowed: true }); assert.equal(r.status, 200);
  r = await call(4, `/api/support/${tk}/reply`, { body: 'Trial here, all sorted.' }); assert.equal(r.status, 200);
  r = await call(2, '/api/admin/staff/perm', { role: 'hr', perm: 'tickets.reply', allowed: false }); assert.equal(r.status, 400);
  r = await call(2, '/api/admin/staff/perm', { role: 'trial', perm: 'tickets.reply', reset: true }); r = await call(4, '/api/me'); assert.ok(!r.body.staff.perms.includes('tickets.reply')); ok('HR switches single permissions per rank, and back to the default; HR itself stays locked');

  r = await call(4, '/api/admin/audit'); assert.equal(r.status, 403);
  r = await call(3, '/api/admin/audit'); assert.equal(r.status, 200);
  const acts = r.body.log.map(a => a.action);
  for (const a of ['staff.hire', 'mod.warn', 'mod.suspend', 'mod.terminate', 'ticket.reply', 'ticket.assign', 'staff.perm']) assert.ok(acts.includes(a), a);
  assert.ok(!acts.includes('mod.ban')); ok('every staff action that worked is in the audit log, and refused ones are not');

  r = await call(2, '/api/admin/dashboard'); assert.equal(r.status, 200); assert.equal(r.body.openTickets, 1); assert.equal(r.body.staffCount, 6); assert.ok(r.body.recent.length > 0); ok('the dashboard counts tickets, players and staff');
  r = await call(7, '/api/profile/Adam'); assert.equal(r.body.staff.rank, 'Admin'); r = await call(7, '/api/profile/Sara'); assert.equal(r.body.staff.rank, 'Support Agent'); ok('profiles show the staff rank or role');

  r = await call(2, '/api/admin/staff', { who: 'Tom' }); assert.equal(r.status, 200); r = await call(4, '/api/me'); assert.equal(r.body.staff, null); r = await call(4, '/api/admin/tickets'); assert.equal(r.status, 403); ok('removing someone from staff takes every permission away');
  r = await call(2, '/api/admin/ban', { who: 'Tom', reason: 'Leaked tickets' }); assert.equal(r.status, 200); r = await call(4, '/api/me'); assert.ok(r.body.banned); ok('former staff can be banned like anyone else');

  console.log(`\nAll ${n} checks passed.`); server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
