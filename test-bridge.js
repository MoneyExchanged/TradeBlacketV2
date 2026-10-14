// Offline transfers against a fake Roblox Open Cloud data store. Run: node test-bridge.js
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
const dbPath = path.join(os.tmpdir(), `tb-bridge-${process.pid}.db`);
process.env.SITE_WAITLIST = 'off';
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
process.env.DB_PATH = dbPath;
process.env.ROBLOX_OPEN_CLOUD_KEY = 'x'.repeat(40);

// ---- fake data store ----
const store = {}; let version = 0, mode = 'normal';
function save(uid, value) { store[uid] = { value: JSON.stringify(value), version: String(++version) }; }
const realFetch = global.fetch;
global.fetch = async (url, opt = {}) => {
  if (!String(url).startsWith('https://apis.roblox.com/')) return realFetch(url, opt);
  const u = new URL(url), key = u.searchParams.get('entryKey'), e = store[key];
  if (opt.method === 'POST') {
    if (mode === 'timeout-applied') { store[key] = { value: opt.body, version: String(++version) }; mode = 'normal'; throw new Error('timeout'); }
    if (mode === 'timeout-lost') { mode = 'normal'; throw new Error('timeout'); }
    if (mode === 'race') { const v = JSON.parse(e.value); v.Data.pBalance += 1; save(key, v); mode = 'normal'; }
    const cur = store[key];
    if (!cur || u.searchParams.get('matchVersion') !== cur.version) return new Response('conflict', { status: 409 });
    store[key] = { value: opt.body, version: String(++version) };
    return new Response(JSON.stringify({ version: store[key].version }), { status: 200 });
  }
  if (!e) return new Response('not found', { status: 404 });
  return new Response(e.value, { status: 200, headers: { 'roblox-entry-version': e.version, 'roblox-entry-attributes': '{}', 'roblox-entry-userids': `[${key}]` } });
};
const profile = (bal, sw, session) => ({ Data: { pBalance: bal, siteWallet: sw, inventory: { '12': 3 }, settings: [] }, MetaData: { ActiveSession: session || null, LastUpdate: Math.floor(Date.now() / 1000) }, RobloxMetaData: {}, Extra: 'kept' });

const { server, db } = require('./server.js');
let base, cookie;
async function call(p, body) {
  const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}
const site = id => db.prepare('SELECT * FROM users WHERE roblox_id = ?').get(id);
const game = id => JSON.parse(store[id].value);
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);

(async () => {
  await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  db.prepare('INSERT INTO users (roblox_id, username, created_at) VALUES (77, ?, 0)').run('Tester');
  db.prepare('INSERT INTO sessions VALUES (?, 77, 0)').run('c'.repeat(64)); cookie = 'tb_session=' + 'c'.repeat(64);
  save('77', profile(1000, { deposited: 0, withdrawn: 0, pending: [] }));

  let r = await call('/api/game/wallet'); assert.equal(r.body.balance, 1000); assert.equal(r.body.inGame, false); ok('reads the Trade Empire balance while offline');
  r = await call('/api/game/deposit', { amount: 400 }); assert.equal(r.status, 403); assert.match(r.body.error, /Deduction Service/); assert.equal(game('77').Data.pBalance, 1000); ok('deposits are refused until the Deduction Service is accepted');
  const me0 = await call('/api/me'); await call('/api/legal/accept', { doc: 'tos', version: me0.body.legal.versions.tos }); await call('/api/legal/accept', { doc: 'cds', version: me0.body.legal.versions.cds });
  r = await call('/api/game/deposit', { amount: 400 }); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(game('77').Data.pBalance, 600); assert.equal(game('77').Data.siteWallet.deposited, 400); assert.equal(site(77).balance, 400);
  assert.equal(game('77').Extra, 'kept'); assert.deepEqual(game('77').Data.inventory, { '12': 3 }); ok('offline deposit: game -400, site +400, the rest of the save untouched');
  r = await call('/api/game/deposit', { amount: 5000 }); assert.equal(r.status, 400); assert.equal(site(77).balance, 400); ok('cannot deposit more than the game balance');
  r = await call('/api/game/withdraw', { amount: 500 }); assert.equal(r.status, 400); ok('cannot withdraw more than was deposited');
  r = await call('/api/game/withdraw', { amount: 150 }); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(game('77').Data.pBalance, 750); assert.equal(game('77').Data.siteWallet.withdrawn, 150); assert.equal(site(77).balance, 250); assert.equal(site(77).withdrawn, 150); ok('offline withdrawal: site -150, game +150, both books agree');

  // online: refused, nothing moves
  save('77', { ...game('77'), MetaData: { ActiveSession: [1, 'job', 'x'], LastUpdate: Math.floor(Date.now() / 1000) } });
  const before = store['77'].value;
  r = await call('/api/game/deposit', { amount: 10 }); assert.equal(r.status, 409); assert.equal(r.body.inGame, true); assert.equal(store['77'].value, before); ok('refused while the player is in the game (save untouched)');
  // stale session mark from a crashed server is treated as offline
  save('77', { ...game('77'), MetaData: { ActiveSession: [1, 'job', 'x'], LastUpdate: Math.floor(Date.now() / 1000) - 3600 } });
  r = await call('/api/game/deposit', { amount: 10 }); assert.equal(r.status, 200); ok('a session mark an hour old (dead server) counts as offline');

  // version race: a game server touched the save between our read and write
  mode = 'race'; const bal0 = game('77').Data.pBalance;
  r = await call('/api/game/deposit', { amount: 20 }); assert.equal(r.status, 200);
  assert.equal(game('77').Data.pBalance, bal0 + 1 - 20); ok('a version race is retried on fresh data, not overwritten');

  // the write landed but the answer was lost
  mode = 'timeout-applied'; const s0 = site(77).balance, g0 = game('77').Data.pBalance;
  r = await call('/api/game/deposit', { amount: 30 }); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(site(77).balance, s0 + 30); assert.equal(game('77').Data.pBalance, g0 - 30); ok('write landed but reply lost: found by its stamp and credited once');
  // the write never landed
  mode = 'timeout-lost'; const s1 = site(77).balance, g1 = game('77').Data.pBalance;
  r = await call('/api/game/withdraw', { amount: 5 }); assert.equal(r.status, 502);
  assert.equal(site(77).balance, s1); assert.equal(game('77').Data.pBalance, g1); ok('write never landed: withdrawal refunded, nothing moved');

  // the in-game bridge still agrees with these numbers
  const u = site(77), g = game('77').Data.siteWallet;
  assert.equal(u.deposited, g.deposited); assert.equal(u.withdrawn, g.withdrawn); ok(`site and game books match (deposited ${u.deposited}, withdrawn ${u.withdrawn})`);

  r = await call('/api/health'); assert.equal(r.body.offlineTransfers, true);
  console.log(`\nAll ${n} checks passed.`);
  server.close(); db.close(); for (const f of [dbPath, dbPath + '-wal', dbPath + '-shm']) fs.rmSync(f, { force: true }); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
