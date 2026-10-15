// One player, one account (security.js) and Refer a friend (referrals.js).
// Run: node test-security.js
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path');
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
process.env.DB_PATH = path.join(os.tmpdir(), `tb-sec-${process.pid}.db`);
process.env.ADMIN_ROBLOX_IDS = '1';
const { server, db } = require('./server.js');
const { DatabaseSync } = require('node:sqlite');
let base; const jar = {};
async function call(who, p, body, headers = {}) { const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(who ? { cookie: jar[who] } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; }
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);
const req = (ip, dev, hw) => ({ headers: { 'x-real-ip': ip, ...(dev ? { 'x-tb-device': dev + '.' + (hw || 'ab'.repeat(16)) } : {}) }, socket: {} });
const D = c => c.repeat(32).slice(0, 32);

(async () => {
  /* ---------- security.js on its own ---------- */
  const sdb = new DatabaseSync(':memory:');
  sdb.exec('CREATE TABLE users (roblox_id INTEGER PRIMARY KEY, username TEXT, balance INTEGER NOT NULL DEFAULT 0, bonus_lock INTEGER NOT NULL DEFAULT 0, tos_version TEXT, created_at INTEGER NOT NULL); CREATE TABLE site_access (roblox_id INTEGER PRIMARY KEY, via TEXT, granted_at INTEGER); CREATE TABLE slot_access (roblox_id INTEGER PRIMARY KEY, via TEXT, granted_at INTEGER);');
  const stx = fn => { sdb.exec('BEGIN'); try { const r = fn(); sdb.exec('COMMIT'); return r; } catch (e) { sdb.exec('ROLLBACK'); throw e; } };
  const sec = require('./security.js').create({ db: sdb, tx: stx, secret: 's'.repeat(20), isAdmin: id => id === 1 });
  for (const [id, t] of [[1, 1], [10, 10], [11, 11], [12, 12], [13, 13], [14, 14], [15, 15]]) sdb.prepare('INSERT INTO users (roblox_id, username, created_at) VALUES (?,?,?)').run(id, 'P' + id, t);

  assert.equal(sec.onSignIn(10, req('1.1.1.1', D('a'), 'aa'.repeat(16)), true), null); ok('the first account on a network signs up normally');
  sdb.prepare("INSERT INTO site_access VALUES (11, 'code', 0)").run();
  let hit = sec.onSignIn(11, req('1.1.1.1', D('b'), 'bb'.repeat(16)), true);
  assert.equal(hit.kind, 'ip'); assert.equal(sec.isBanned(11), true); assert.equal(sec.isBanned(10), false);
  assert.equal(sdb.prepare('SELECT COUNT(*) n FROM site_access WHERE roblox_id = 11').get().n, 0); ok('a second account from the same network is banned, the first is not, and access is taken away');
  hit = sec.onSignIn(12, req('2.2.2.2', D('a'), 'cc'.repeat(16)), true); assert.equal(hit.kind, 'dev'); assert.equal(sec.isBanned(12), true); ok('a new account on a device another account uses is banned');
  hit = sec.onSignIn(13, req('3.3.3.3', D('c'), 'aa'.repeat(16)), true); assert.equal(hit.kind, 'hw'); assert.equal(sec.isBanned(13), true); ok('a new account on the same hardware (cleared browser) is banned');
  assert.equal(sec.onSignIn(14, req('4.4.4.4', D('d'), 'dd'.repeat(16)), true), null);
  assert.equal(sec.onSignIn(15, req('5.5.5.5', D('e'), 'ee'.repeat(16)), true), null);
  hit = sec.onSignIn(14, req('6.6.6.6', D('e'), 'ff'.repeat(16)), false); assert.equal(hit.ban, 15); assert.equal(sec.isBanned(15), true); assert.equal(sec.isBanned(14), false); ok('two existing accounts on one device: the newer one is banned');
  assert.equal(sec.onSignIn(1, req('1.1.1.1', D('z'), 'zz'.repeat(16)), true), null); assert.equal(sec.isBanned(1), false); ok('admins are never banned, even on a shared network');
  assert.equal(sec.onSignIn(10, req('1.1.1.1', D('a'), 'aa'.repeat(16)), false), null); assert.equal(sec.isBanned(10), false); ok('the original account keeps signing in from its own network and device');
  assert.equal(sec.shared(10, 1), true); assert.equal(sec.shared(10, 14), false); ok('shared() tells whether two accounts share a network or device');
  assert.equal(sec.ip({ headers: { 'x-real-ip': '7.7.7.7', 'x-forwarded-for': '9.9.9.9' }, socket: {} }), '7.7.7.7'); assert.equal(sec.ip({ headers: { 'x-forwarded-for': '9.9.9.9, 10.1.1.1' }, socket: {} }), '9.9.9.9'); ok('the address comes from X-Real-IP, then the first X-Forwarded-For entry');
  assert.equal(sec.ip({ headers: { 'x-real-ip': '2001:db8:1:2:aaaa::1' }, socket: {} }), '2001:db8:1:2::/64'); ok('an IPv6 address counts by its /64');
  sec.adminUnban(1, 11); assert.equal(sec.isBanned(11), false); assert.throws(() => sec.adminUnban(10, 12), /staff/); ok('only staff unban');
  sec.adminBan(1, 'P14', 'test'); assert.equal(sec.isBanned(14), true); assert.throws(() => sec.adminBan(1, '1'), /cannot be banned/); ok('admins ban by name; admins cannot be banned');
  const r0 = { headers: { 'x-real-ip': '8.8.8.8' }, socket: {} };
  for (let i = 0; i < 3; i++) sec.limit(r0, 't', 3, 6e4);
  assert.throws(() => sec.limit(r0, 't', 3, 6e4), e => e.code === 429); sec.limit({ headers: { 'x-real-ip': '8.8.4.4' }, socket: {} }, 't', 3, 6e4); ok('rate limits count per network');

  /* ---------- through the server ---------- */
  await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  for (const id of [1, 2, 3, 4, 5]) { db.prepare("INSERT INTO users (roblox_id, username, created_at, tos_version) VALUES (?, ?, ?, '2026-10-15.2')").run(id, 'U' + id, id); const t = String(id).repeat(64).slice(0, 64); db.prepare('INSERT INTO sessions VALUES (?, ?, 0)').run(t, id); jar[id] = 'tb_session=' + t; }
  let r;
  for (let i = 0; i < 8; i++) r = await call(null, '/api/auth/start', { username: '!' }, { 'x-real-ip': '10.0.0.9' });
  assert.equal(r.status, 400); r = await call(null, '/api/auth/start', { username: '!' }, { 'x-real-ip': '10.0.0.9' }); assert.equal(r.status, 429); assert.match(r.body.error, /Too many/); ok('sign-in attempts from one network are rate limited');
  r = await call(1, '/api/admin/site/codes', { count: 1, uses: 20 }); const code = r.body.codes[0];
  for (let i = 0; i < 10; i++) await call(3, '/api/site-waitlist/redeem', { code: 'TB-AAAAA-AAAAA' }, { 'x-real-ip': '10.0.0.3' });
  r = await call(3, '/api/site-waitlist/redeem', { code }, { 'x-real-ip': '10.0.0.3' }); assert.equal(r.status, 429); ok('guessing access codes is rate limited');

  // referral: 2 refers 4
  r = await call(2, '/api/referrals', null, { 'x-real-ip': '20.0.0.2', 'x-tb-device': D('2') + '.' + '22'.repeat(16) }); const rc = r.body.code; assert.match(rc, /^[A-Z2-9]{8}$/); assert.equal(r.body.reward, 450); ok('every player has a referral code worth 450 Rodux');
  await call(2, '/api/me', null, { 'x-real-ip': '20.0.0.2', 'x-tb-device': D('2') + '.' + '22'.repeat(16) });
  db.prepare("INSERT INTO referrals (friend_id, referrer_id, status, created_at) VALUES (4, 2, 'pending', 1)").run();
  db.prepare("INSERT INTO referrals (friend_id, referrer_id, status, created_at) VALUES (5, 2, 'pending', 1)").run();
  await call(4, '/api/me', null, { 'x-real-ip': '40.0.0.4', 'x-tb-device': D('4') + '.' + '44'.repeat(16) });
  await call(5, '/api/me', null, { 'x-real-ip': '20.0.0.2', 'x-tb-device': D('5') + '.' + '55'.repeat(16) });
  r = await call(2, '/api/referrals'); assert.equal(r.body.pending, 1); assert.equal(r.body.paid, 0);
  assert.equal(r.body.friends.find(f => f.name === 'U5').status, 'void'); ok('a friend on the same network as the referrer never pays out');
  r = await call(4, '/api/site-waitlist/redeem', { code }, { 'x-real-ip': '40.0.0.4' }); assert.equal(r.body.access, true);
  r = await call(2, '/api/referrals'); assert.equal(r.body.paid, 1); assert.equal(r.body.earned, 450); ok('the referrer is paid 450 Rodux once the friend is let in');
  r = await call(2, '/api/me'); assert.equal(r.body.balance, 450); assert.equal(r.body.bonusLock, 450); assert.equal(r.body.withdrawable, 0);
  assert.ok(r.body.transfers.some(t => t.kind === 'bonus' && t.amount === 450 && /^TBR-/.test(t.reference))); ok('the reward is bonus Rodux: playable, not withdrawable, and shows in the history');
  r = await call(2, '/api/referrals'); assert.equal(r.body.earned, 450); r = await call(2, '/api/me'); assert.equal(r.body.balance, 450); ok('a referral pays once');

  // bans through the server
  r = await call(1, '/api/admin/ban', { who: 'U3', reason: 'alt' }); assert.equal(r.body.ok, true);
  r = await call(3, '/api/me'); assert.equal(r.body.banned.reason, 'alt'); assert.equal(r.body.site.access, false); ok('a banned player sees why');
  r = await call(3, '/api/items/list', { uid: 'x', price: 5 }); assert.equal(r.status, 403); assert.match(r.body.error, /banned/i);
  r = await call(3, '/api/site-waitlist/join', {}); assert.equal(r.status, 403);
  r = await call(3, '/api/profile', { bio: 'x' }); assert.equal(r.status, 403); ok('a banned player cannot play, list, join the waitlist or edit a profile');
  r = await call(3, '/api/items/withdraw', { uids: [] }); assert.notEqual(r.status, 403); ok('a banned player can still withdraw');
  r = await call(1, '/api/admin/bans'); assert.equal(r.body.bans[0].username, 'U3'); r = await call(2, '/api/admin/bans'); assert.equal(r.status, 403); ok('only admins see the ban list');
  r = await call(1, '/api/admin/unban', { robloxId: 3 }); r = await call(3, '/api/me'); assert.equal(r.body.banned, null); ok('admins can unban');

  console.log(`\nAll ${n} checks passed.`); server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
