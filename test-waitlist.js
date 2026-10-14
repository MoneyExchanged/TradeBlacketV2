// Slots waitlist and access codes.
// Run: node test-waitlist.js
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path');
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
process.env.DB_PATH = path.join(os.tmpdir(), `tb-wait-${process.pid}.db`);
process.env.ADMIN_ROBLOX_IDS = '1';
const { server, db } = require('./server.js');
let base; const jar = {};
async function call(who, p, body) { const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(who ? { cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; }
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);
(async () => {
  await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  for (const id of [1, 2, 3, 4]) { db.prepare('INSERT INTO users (roblox_id, username, created_at) VALUES (?, ?, 0)').run(id, 'U' + id); const t = String(id).repeat(64).slice(0, 64).replace(/[^0-9a-f]/g, 'a'); db.prepare('INSERT INTO sessions VALUES (?, ?, 0)').run(t, id); jar[id] = 'tb_session=' + t; }
  let r = await call(null, '/api/waitlist'); assert.equal(r.body.waiting, 0); assert.equal(r.body.access, false); ok('anyone can see how many are waiting');
  r = await call(2, '/api/waitlist/join', {}); assert.equal(r.body.place, 1); assert.equal(r.body.ahead, 0); ok('the first player to join is #1');
  r = await call(3, '/api/waitlist/join', {}); assert.equal(r.body.place, 2); assert.equal(r.body.ahead, 1);
  r = await call(3, '/api/waitlist/join', {}); assert.equal(r.body.place, 2); ok('joining twice keeps your place');
  r = await call(1, '/api/waitlist'); assert.equal(r.body.access, true); assert.equal(r.body.admin, true); ok('admins always have access');
  r = await call(2, '/api/admin/codes', { count: 1 }); assert.equal(r.status, 403); ok('only admins can make codes');
  r = await call(1, '/api/admin/codes', { count: 2, uses: 1, note: 'friends' }); assert.equal(r.body.codes.length, 2); assert.match(r.body.codes[0], /^TB-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  const [c1, c2] = r.body.codes;
  r = await call(4, '/api/waitlist/redeem', { code: 'TB-NOPE0-NOPE0' }); assert.equal(r.status, 400); ok('wrong codes are refused');
  r = await call(4, '/api/waitlist/redeem', { code: c1.toLowerCase().replace(/-/g, ' ') }); assert.equal(r.body.access, true); assert.equal(r.body.via, 'code'); ok('a code gives access, typed in any case or spacing');
  r = await call(3, '/api/waitlist/redeem', { code: c1 }); assert.equal(r.status, 400); assert.match(r.body.error, /used up/); ok('a single-use code works once');
  r = await call(3, '/api/waitlist'); assert.equal(r.body.ahead, 1); assert.equal(r.body.waiting, 2);
  r = await call(1, '/api/admin/grant', { count: 1 }); assert.equal(r.body.granted, 1);
  r = await call(2, '/api/waitlist'); assert.equal(r.body.access, true); r = await call(3, '/api/waitlist'); assert.equal(r.body.access, false); assert.equal(r.body.ahead, 0); ok('admins let players in, in waitlist order');
  r = await call(1, '/api/admin/waitlist'); assert.equal(r.body.list[0].username, 'U2'); assert.equal(r.body.codes.find(c => c.code === c1).used, 1); ok('admins see the list and code use');
  r = await call(1, '/api/admin/revoke', { robloxId: 2 }); r = await call(2, '/api/waitlist'); assert.equal(r.body.access, false); assert.equal(r.body.place, 1); ok('access can be taken away; the place is kept');
  r = await call(3, '/api/waitlist/redeem', { code: c2 }); assert.equal(r.body.access, true); ok('a second code works for another player');
  console.log(`\nAll ${n} checks passed.`); server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
