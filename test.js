// End-to-end check of the game endpoints, signing exactly like Hmac.sign in the game.
// Run: node test.js   (starts its own server on a temp database)
'use strict';
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const SECRET = 'test-secret-0123456789abcdef';
const dbPath = path.join(os.tmpdir(), `tb-test-${process.pid}.db`);
process.env.GAME_WEBHOOK_SECRET = SECRET;
process.env.DB_PATH = dbPath;
process.env.PORT = '0';
const { server, db } = require('./server.js');

const sign = (body, key = SECRET) => crypto.createHmac('sha256', key).update(body).digest('hex');
let base;
async function post(p, obj, { key, sig, raw } = {}) {
  const body = raw ?? JSON.stringify(obj);
  const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TE-Signature': sig ?? sign(body, key) }, body });
  return { status: r.status, body: await r.json() };
}
const DEP = '/api/public/game/rodux-deposits', WD = '/api/public/game/rodux-withdrawals';
const user = id => db.prepare('SELECT * FROM users WHERE roblox_id = ?').get(id);

(async () => {
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);

  // Signature
  let r = await post(DEP, { idempotency_key: 'a', roblox_user_id: 1, amount: 5 }, { key: 'wrong-secret-xxxxxxxx' });
  assert.equal(r.status, 401); ok('wrong secret is refused (401)');
  r = await post(DEP, { idempotency_key: 'a', roblox_user_id: 1, amount: 5 }, { sig: 'nothex' });
  assert.equal(r.status, 401); ok('malformed signature is refused');
  const body = JSON.stringify({ idempotency_key: 'a', roblox_user_id: 1, amount: 5 });
  r = await post(DEP, null, { raw: body.replace('5', '50'), sig: sign(body) });
  assert.equal(r.status, 401); ok('tampered body is refused');
  assert.equal(user(1), undefined); ok('nothing was credited by refused requests');

  // Deposit
  r = await post(DEP, { idempotency_key: 'dep-1', roblox_user_id: 42, amount: 1000 });
  assert.equal(r.status, 200); assert.match(r.body.reference, /^TBD-/); ok('deposit applies, returns a reference');
  const ref = r.body.reference;
  r = await post(DEP, { idempotency_key: 'dep-1', roblox_user_id: 42, amount: 1000 });
  assert.equal(r.status, 200); assert.equal(r.body.reference, ref); assert.equal(user(42).balance, 1000); ok('repeat of the same key: same reference, credited once');
  r = await post(DEP, { idempotency_key: 'dep-1', roblox_user_id: 42, amount: 9999 });
  assert.equal(r.status, 422); assert.equal(user(42).balance, 1000); ok('same key with a different amount is refused, nothing applied');
  r = await post(DEP, { idempotency_key: 'dep-x', roblox_user_id: 42, amount: 1.5 });
  assert.equal(r.status, 400); ok('fractional amount is refused (400 = game returns it)');
  r = await post(DEP, { idempotency_key: 'dep-y', roblox_user_id: 42, amount: -5 });
  assert.equal(r.status, 400); ok('negative amount is refused');

  // Withdraw cap: deposited - withdrawn, and balance - bonus lock
  db.prepare('UPDATE users SET balance = balance + 5000 WHERE roblox_id = 42').run(); // winnings on site
  r = await post(WD, { idempotency_key: 'wd-1', roblox_user_id: 42, amount: 1500 });
  assert.equal(r.status, 422); assert.match(r.body.error, /1000/); ok('cannot withdraw more than deposited, even with winnings (422)');
  r = await post(WD, { idempotency_key: 'wd-1', roblox_user_id: 42, amount: 1500 });
  assert.equal(r.status, 422); ok('a refused key stays refused on repeat');
  r = await post(WD, { idempotency_key: 'wd-2', roblox_user_id: 42, amount: 600 });
  assert.equal(r.status, 200); assert.match(r.body.reference, /^TBW-/); ok('withdraw within the cap applies');
  r = await post(WD, { idempotency_key: 'wd-2', roblox_user_id: 42, amount: 600 });
  assert.equal(r.status, 200); assert.equal(user(42).withdrawn, 600); ok('repeat withdrawal is not debited twice');
  r = await post(WD, { idempotency_key: 'wd-3', roblox_user_id: 42, amount: 401 });
  assert.equal(r.status, 422); ok('cap is now 400');
  db.prepare('UPDATE users SET balance = 300, bonus_lock = 100 WHERE roblox_id = 42').run();
  r = await post(WD, { idempotency_key: 'wd-4', roblox_user_id: 42, amount: 201 });
  assert.equal(r.status, 422); ok('locked bonus Rodux cannot be withdrawn');
  r = await post(WD, { idempotency_key: 'wd-5', roblox_user_id: 42, amount: 200 });
  assert.equal(r.status, 200); assert.equal(user(42).balance, 100); ok('balance minus lock can be withdrawn');
  r = await post(WD, { idempotency_key: 'wd-6', roblox_user_id: 777, amount: 1 });
  assert.equal(r.status, 404); ok('unknown player cannot withdraw (404)');

  // Concurrency: 20 parallel withdrawals of 50 from a cap of 500 -> exactly 10 succeed
  db.prepare('INSERT INTO users (roblox_id, balance, deposited, created_at) VALUES (9, 500, 500, 0)').run();
  const res = await Promise.all(Array.from({ length: 20 }, (_, i) => post(WD, { idempotency_key: 'par-' + i, roblox_user_id: 9, amount: 50 })));
  assert.equal(res.filter(x => x.status === 200).length, 10); assert.equal(user(9).balance, 0); ok('parallel withdrawals never overdraw');

  // Session-gated endpoint
  const me = await fetch(base + '/api/me');
  assert.equal(me.status, 401); ok('/api/me requires a session');

  console.log(`\nAll ${n} checks passed.`);
  server.close(); db.close();
  for (const f of [dbPath, dbPath + '-wal', dbPath + '-shm']) fs.rmSync(f, { force: true });
})().catch(e => { console.error(e); process.exit(1); });
