// Support tickets with screenshots and account snapshots, staff actions, and account standing.
// Run: node test-support.js
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-sup-'));
process.env.DB_PATH = path.join(dir, 'tb.db');
process.env.ADMIN_ROBLOX_IDS = '1';
const { server, db } = require('./server.js');
const { standing } = require('./account.js');
let base; const jar = {};
async function call(who, p, body, headers = {}) { const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(who ? { cookie: jar[who] } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j, type: r.headers.get('content-type') }; }
async function up(who, buf) { const r = await fetch(base + '/api/support/upload', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', cookie: jar[who] }, body: buf }); return { status: r.status, body: await r.json() }; }
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);
const DAY = 864e5, now = Date.now();
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);

(async () => {
  /* ---------- standing, the game's rules ---------- */
  assert.equal(standing([]).level, 'excellent');
  assert.equal(standing([{ action: 'Warning', issuedAt: now - DAY }]).level, 'warning');
  assert.equal(standing([{ action: 'Warning', issuedAt: now - DAY }, { action: 'Warning', issuedAt: now - 2 * DAY }]).level, 'restricted');
  assert.equal(standing([{ action: 'Warning', issuedAt: now - 100 * DAY }]).level, 'good'); ok('warnings count for 90 days: excellent, warning, restricted, then good');
  assert.equal(standing([{ action: 'Suspension', issuedAt: now - DAY, expiresAt: now + DAY }]).level, 'suspended');
  assert.equal(standing([{ action: 'Termination', issuedAt: now - 400 * DAY }]).level, 'terminated');
  assert.equal(standing([{ action: 'Termination', issuedAt: now, appeal: 'accepted' }]).level, 'excellent'); ok('suspensions, terminations and accepted appeals work like the game');
  const st = standing([{ action: 'Warning', issuedAt: now - DAY }, { action: 'Suspension', issuedAt: now - 9 * DAY, expiresAt: now - 2 * DAY }, { action: 'Warning', issuedAt: now - 200 * DAY }]);
  assert.deepEqual(st.totals, { all: 3, warnings: 2, suspensions: 1, terminations: 0, overturned: 0 }); assert.equal(st.activeCount, 2); assert.equal(st.violations[0].counts, true); ok('every warning is counted, and the active ones are marked');

  /* ---------- reading the Trade Empire save ---------- */
  const { DatabaseSync } = require('node:sqlite'); const mdb = new DatabaseSync(':memory:'); mdb.exec('CREATE TABLE users (roblox_id INTEGER PRIMARY KEY, username TEXT); CREATE TABLE sessions (token TEXT, roblox_id INTEGER); CREATE TABLE tickets (id TEXT, roblox_id INTEGER); CREATE TABLE referrals (friend_id INTEGER, referrer_id INTEGER, status TEXT);');
  const t0 = Math.floor(now / 1000);
  const save = { Data: { pBalance: 1250, totalValue: 98000, totalRAP: 87000, owned: { 101: [1, 2], 202: [7] }, playSeconds: 7200, tradeHistory: [1, 2, 3], activeTrades: [9], previousNames: ['OldName'],
    subscription: { tier: 'Silver', expiration: t0 + 86400 }, violations: [{ id: 'v1', action: 'Warning', reason: 'Spam', issuedAt: t0 - 3600, expiresAt: 0, appeal: 'none' }, { id: 'v2', action: 'Warning', reason: 'Scam attempt', issuedAt: t0 - 86400 * 200, appeal: 'none' }],
    valueHistory: [{ t: t0 - 86400, v: 90000 }, { t: t0, v: 98000 }], siteWallet: { deposited: 500, withdrawn: 100, pending: [] } }, MetaData: {} };
  const GB = { enabled: () => true, ocGet: async () => ({ value: save }), readSave: require('./gamebridge.js').readSave };
  const A = require('./account.js').create({ db: mdb, tx: f => f(), isAdmin: () => false, security: {}, siteList: {}, items: {}, GB, social: {}, referrals: {}, withdrawable: () => 0 });
  const te = await A.tradeEmpire(5);
  assert.equal(te.rodux, 1250); assert.equal(te.totalValue, 98000); assert.equal(te.items, 3); assert.equal(te.uniqueItems, 2); assert.equal(te.trades, 3); assert.equal(te.tradePlus.tier, 'Silver');
  assert.equal(te.standing.level, 'warning'); assert.equal(te.standing.totals.warnings, 2); assert.equal(te.standing.activeCount, 1); assert.equal(te.siteWallet.deposited, 500); ok('the Trade Empire save is read: Rodux, value, items, TradePlus and every warning');

  await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  for (const id of [1, 2, 3, 4]) { db.prepare("INSERT INTO users (roblox_id, username, created_at, tos_version) VALUES (?, ?, ?, '2026-10-15.2')").run(id, 'U' + id, id); const t = String(id).repeat(64).slice(0, 64); db.prepare('INSERT INTO sessions VALUES (?, ?, 0)').run(t, id); jar[id] = 'tb_session=' + t; }

  /* ---------- screenshots ---------- */
  let r = await up(2, Buffer.from('<script>alert(1)</script>'.repeat(4))); assert.equal(r.status, 415); ok('only real images can be uploaded');
  r = await up(2, Buffer.alloc(5 * 1024 * 1024 + 10, 1)); assert.equal(r.status, 413); ok('uploads are capped at 5 MB');
  r = await up(2, PNG); assert.equal(r.status, 200); const f1 = r.body.id; assert.match(f1, /^[0-9a-f]{24}$/);
  r = await call(2, `/api/support/file/${f1}`); assert.equal(r.status, 200); assert.equal(r.type, 'image/png');
  r = await call(3, `/api/support/file/${f1}`); assert.equal(r.status, 404); ok('a screenshot is private to whoever sent it');

  /* ---------- a ticket carries the account ---------- */
  r = await call(2, '/api/support', { category: 'report', subject: 'Scam', body: 'This player scammed me in a flip.' }); assert.equal(r.status, 400); assert.match(r.body.error, /username/);
  r = await call(2, '/api/support', { category: 'report', reported: 'Player3', subject: 'Scam report', body: 'This player scammed me in a flip.', files: [f1, 'f'.repeat(24)] });
  assert.equal(r.status, 200, JSON.stringify(r.body)); const tk = r.body.id; assert.equal(r.body.reported, 'Player3'); ok('reports name the player being reported');
  const acc = r.body.messages.find(m => m.kind === 'account'); assert.ok(acc && acc.account.tradeBlacket.walletId); assert.equal(acc.account.tradeBlacket.linked, undefined);
  assert.deepEqual(r.body.messages.find(m => m.kind === 'msg').files.map(f => f.id), [f1]); ok('the whole account and the screenshots go into the ticket');
  r = await call(1, '/api/support'); const st1 = r.body.tickets.find(t => t.id === tk); assert.ok(Array.isArray(st1.account.tradeBlacket.linked)); assert.equal(st1.robloxId, 2); ok('staff see more of the account, including linked accounts');
  r = await call(1, `/api/support/file/${f1}`); assert.equal(r.status, 200); r = await call(3, `/api/support/file/${f1}`); assert.equal(r.status, 404); ok('staff can open the screenshot, other players cannot');
  r = await call(3, `/api/support/${tk}/reply`, { body: 'hi' }); assert.equal(r.status, 404); ok('nobody else can write in a ticket');

  /* ---------- staff actions ---------- */
  r = await call(2, '/api/admin/mod', { robloxId: 3, action: 'warn', reason: 'nope' }); assert.equal(r.status, 403); ok('only admins moderate');
  r = await call(1, '/api/admin/mod', { robloxId: 2, action: 'warn', reason: 'Spamming chat', ticketId: tk }); assert.equal(r.body.ok, true);
  r = await call(1, '/api/admin/mod', { robloxId: 2, action: 'note', note: 'Seems to be a repeat reporter', ticketId: tk });
  r = await call(1, `/api/support/${tk}/reply`, { body: 'checking their trades', internal: true });
  r = await call(2, '/api/support'); let t2 = r.body.tickets[0];
  assert.ok(t2.messages.some(m => m.kind === 'system' && /Warning issued: Spamming chat/.test(m.body))); assert.ok(!t2.messages.some(m => /repeat reporter|checking their trades/.test(m.body || ''))); ok('the player sees a warning in the ticket, but not staff notes');
  r = await call(1, '/api/support'); assert.ok(r.body.tickets.find(t => t.id === tk).messages.some(m => m.internal && /repeat reporter/.test(m.body))); ok('staff see their internal notes');
  r = await call(2, '/api/account'); assert.equal(r.body.tradeBlacket.standing.level, 'warning'); assert.equal(r.body.tradeBlacket.standing.totals.warnings, 1); assert.equal(r.body.tradeBlacket.actions.some(a => a.action === 'note'), false); ok('a warning shows on the player\'s own account standing');

  r = await call(1, '/api/admin/mod', { who: 'U3', action: 'suspend', days: 3, reason: 'Scamming' }); assert.equal(r.body.ok, true);
  r = await call(3, '/api/me'); assert.equal(r.status, 401); ok('a suspension signs the player out everywhere');
  db.prepare('INSERT INTO sessions VALUES (?, 3, 0)').run('3'.repeat(64));
  r = await call(3, '/api/me'); assert.equal(r.body.banned.kind, 'suspend'); assert.ok(r.body.banned.until > Date.now() + 2 * DAY);
  r = await call(3, '/api/items/list', { uid: 'x', price: 5 }); assert.equal(r.status, 403); assert.match(r.body.error, /suspended until/); ok('a suspended player is told until when, and cannot play');
  db.prepare('UPDATE bans SET expires_at = ? WHERE roblox_id = 3').run(Date.now() - 1000);
  r = await call(3, '/api/me'); assert.equal(r.body.banned, null); ok('a suspension ends by itself');
  r = await call(1, '/api/admin/mod', { robloxId: 3, action: 'terminate', reason: 'Repeated scamming' }); db.prepare('INSERT INTO sessions VALUES (?, 3, 0)').run('3'.repeat(64));
  r = await call(3, '/api/me'); assert.equal(r.body.banned.kind, 'terminate'); r = await call(3, '/api/account'); assert.equal(r.body.tradeBlacket.standing.level, 'terminated'); ok('terminate closes the account for good');
  r = await call(3, '/api/support', { category: 'appeal', subject: 'Appeal please', body: 'I did not scam anyone, here is proof.' }); assert.equal(r.status, 200); ok('a terminated player can still appeal through Support');
  r = await call(1, '/api/admin/mod', { robloxId: 3, action: 'unban', reason: 'Appeal accepted' }); r = await call(3, '/api/account'); assert.equal(r.body.tradeBlacket.banned, null); assert.notEqual(r.body.tradeBlacket.standing.level, 'terminated'); ok('unban lifts it and the lifted ban stops counting');
  r = await call(1, '/api/admin/mod', { robloxId: 4, action: 'kick' }); r = await call(4, '/api/me'); assert.equal(r.status, 401); ok('kick signs a player out');
  r = await call(1, '/api/admin/mod', { robloxId: 1, action: 'ban', reason: 'test' }); assert.equal(r.status, 403); ok('staff cannot moderate their own account');
  r = await call(1, '/api/admin/mod', { robloxId: 2, action: 'grant' }); r = await call(2, '/api/me'); assert.equal(r.body.site.access, true);
  r = await call(1, '/api/admin/mod', { robloxId: 2, action: 'revoke' }); r = await call(2, '/api/me'); assert.equal(r.body.site.access, false); ok('staff let players in and take access away');
  r = await call(1, '/api/admin/account?who=U2'); assert.equal(r.body.robloxId, 2); assert.ok(r.body.tradeBlacket.actions.some(a => a.action === 'note')); r = await call(2, '/api/admin/account?who=U2'); assert.equal(r.status, 403); ok('staff can look up any account');

  console.log(`\nAll ${n} checks passed.`); server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
