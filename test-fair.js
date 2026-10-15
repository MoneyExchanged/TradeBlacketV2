// Provably fair seeds and client seed automation.
// Run: node test-fair.js
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto');
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-fair-'));
process.env.DB_PATH = path.join(dir, 'tb.db');
process.env.ADMIN_ROBLOX_IDS = '1';
const { server, db } = require('./server.js');
const { floats } = require('./fair.js');
let base; const jar = {};
async function call(who, p, body) { const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(who ? { cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; }
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

(async () => {
  await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  for (const id of [2, 3]) { db.prepare("INSERT INTO users (roblox_id, username, created_at, tos_version) VALUES (?, ?, ?, '2026-10-15.2')").run(id, 'P' + id, id); const t = String(id).repeat(64).slice(0, 64); db.prepare('INSERT INTO sessions VALUES (?, ?, 0)').run(t, id); jar[id] = 'tb_session=' + t; }
  let r;

  // known answer: the maths is the documented one
  const f = floats('a'.repeat(64), 'client', 0); const d = crypto.createHmac('sha256', 'a'.repeat(64)).update('client:0:0').digest();
  assert.equal(f.length, 64); assert.equal(f[0], d[0] / 256 + d[1] / 65536 + d[2] / 16777216 + d[3] / 4294967296); assert.ok(f.every(x => x >= 0 && x < 1)); ok('64 numbers per nonce from HMAC-SHA256, 4 bytes each, all in [0, 1)');

  r = await call(null, '/api/fair'); assert.equal(r.status, 401);
  r = await call(2, '/api/fair'); const s0 = r.body; assert.match(s0.serverSeedHash, /^[0-9a-f]{64}$/); assert.ok(s0.clientSeed.length >= 8); assert.equal(s0.nonce, 0); assert.equal(s0.auto.mode, 'nonces'); assert.equal(s0.auto.every, 1000); assert.equal(s0.auto.autoClient, true); ok('a new player gets a hashed server seed, a random client seed and automatic rotation every 1,000 nonces');

  r = await call(2, '/api/fair/batch', { rounds: 3 }); assert.equal(r.body.rounds.length, 3); assert.deepEqual(r.body.rounds.map(x => x.nonce), [0, 1, 2]);
  const got = r.body.rounds; r = await call(2, '/api/fair'); assert.equal(r.body.nonce, 3); ok('numbers come in batches of nonces, and the nonce moves on');

  r = await call(2, '/api/fair/rotate', {}); const rev = r.body.revealed;
  assert.equal(sha(rev.serverSeed), s0.serverSeedHash); assert.equal(rev.nonces, 3);
  for (const g of got) assert.deepEqual(floats(rev.serverSeed, s0.clientSeed, g.nonce), g.floats); ok('rotating reveals the server seed: it matches the hash shown before, and every number checks out');
  assert.equal(r.body.serverSeedHash, s0.nextServerSeedHash); assert.notEqual(r.body.clientSeed, s0.clientSeed); assert.equal(r.body.nonce, 0); ok('the next server seed was announced by its hash, and a fresh client seed is picked automatically');

  r = await call(2, '/api/fair/verify'.replace('verify', `verify?server=${rev.serverSeed}&client=${encodeURIComponent(s0.clientSeed)}&nonce=1`)); assert.deepEqual(r.body.floats, got[1].floats); assert.equal(r.body.serverSeedHash, s0.serverSeedHash);
  r = await call(null, `/api/fair/verify?server=${rev.serverSeed}&client=${encodeURIComponent(s0.clientSeed)}&nonce=1`); assert.equal(r.status, 200); ok('anyone can verify a revealed seed, signed in or not');

  r = await call(2, '/api/fair/client-seed', { clientSeed: 'my lucky seed' }); assert.equal(r.status, 400);
  r = await call(2, '/api/fair/client-seed', { clientSeed: 'MyLuckySeed!42' }); assert.equal(r.body.clientSeed, 'MyLuckySeed!42'); assert.ok(r.body.revealed); ok('players can pick their own client seed, which starts a new pair');

  r = await call(2, '/api/fair/settings', { mode: 'nonces', every: 10, autoClient: false }); assert.equal(r.body.auto.every, 10);
  r = await call(2, '/api/fair/batch', { rounds: 10 }); assert.equal(r.body.rotated, null);
  r = await call(2, '/api/fair/batch', { rounds: 2 }); assert.ok(r.body.rotated); assert.equal(r.body.rotated.reason, 'auto'); assert.equal(r.body.rotated.nonces, 10); assert.equal(r.body.clientSeed, 'MyLuckySeed!42'); assert.equal(r.body.rounds[0].nonce, 0); ok('automatic rotation after N nonces, keeping your own client seed when you ask it to');

  r = await call(2, '/api/fair/settings', { mode: 'daily', autoClient: true });
  db.prepare('UPDATE fair_pairs SET created_at = ? WHERE roblox_id = 2 AND revealed_at IS NULL').run(Date.now() - 25 * 36e5);
  r = await call(2, '/api/fair/batch', { rounds: 1 }); assert.ok(r.body.rotated); assert.notEqual(r.body.clientSeed, 'MyLuckySeed!42'); ok('daily rotation, with a new random client seed');

  r = await call(2, '/api/fair/settings', { mode: 'off' });
  r = await call(2, '/api/fair/batch', { rounds: 16 }); r = await call(2, '/api/fair/batch', { rounds: 99 }); assert.equal(r.body.rounds.length, 16); assert.equal(r.body.rotated, null); ok('rotation can be switched off; at most 16 nonces per batch');

  r = await call(3, '/api/fair'); assert.notEqual(r.body.serverSeedHash, (await call(2, '/api/fair')).body.serverSeedHash); assert.equal(r.body.nonce, 0); ok('every player has their own seeds');
  r = await call(2, '/api/fair'); assert.ok(r.body.history.length >= 4); assert.ok(r.body.history.every(h => sha(h.serverSeed) === h.serverSeedHash)); ok('the history lists every revealed seed');

  console.log(`\nAll ${n} checks passed.`); server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
