// The staff player log (playerlog.js).
// Run: node test-playerlog.js
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path');
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
process.env.DB_PATH = path.join(os.tmpdir(), `tb-plog-${process.pid}.db`);
process.env.ADMIN_ROBLOX_IDS = '1';
const { server, db } = require('./server.js');
let base; const jar = {};
async function call(who, p, body, headers = {}) { const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(who ? { cookie: jar[who] } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; }
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);
const T = Date.now();

(async () => {
  await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  for (const [id, name] of [[1, 'Owner'], [2, 'Alice'], [3, 'Bobby'], [4, 'Carla']]) { db.prepare("INSERT INTO users (roblox_id, username, created_at, tos_version, balance) VALUES (?, ?, ?, '2026-10-15', 1000)").run(id, name, T - 10 * 864e5); const t = String(id).repeat(64).slice(0, 64); db.prepare('INSERT INTO sessions VALUES (?, ?, 0)').run(t, id); jar[id] = 'tb_session=' + t; }
  db.prepare("INSERT INTO site_access VALUES (2, 'code', ?)").run(T); db.prepare("INSERT INTO site_access VALUES (3, 'code', ?)").run(T);
  // Rodux: one in-game deposit, two website deposits (one refused), one website withdrawal
  db.prepare("INSERT INTO transfers VALUES ('k1','deposit',2,500,'ok',200,'TBD-AAA',NULL,?)").run(T - 9 * 864e5);
  db.prepare("INSERT INTO offline_transfers VALUES ('ot-1','deposit',2,1200,'ok',?,?,NULL)").run(T - 5 * 864e5, T - 5 * 864e5);
  db.prepare("INSERT INTO offline_transfers VALUES ('ot-2','deposit',2,300,'cancelled',?,?,'in game')").run(T - 4 * 864e5, T - 4 * 864e5);
  db.prepare("INSERT INTO offline_transfers VALUES ('ot-3','withdraw',2,200,'ok',?,?,NULL)").run(T - 3 * 864e5, T - 3 * 864e5);
  // items: deposited two copies, one listed and bought by Bobby
  db.prepare("INSERT INTO site_items VALUES ('u1', 101, 7, 2, 'held', 2, ?, ?)").run(T - 6 * 864e5, T - 6 * 864e5);
  db.prepare("INSERT INTO site_items VALUES ('u2', 202, 3, 2, 'held', 2, ?, ?)").run(T - 6 * 864e5, T - 6 * 864e5);
  db.prepare("INSERT INTO item_moves VALUES ('mv-1','deposit',2,'[\"u1\",\"u2\"]',900,'ok',?,?,NULL)").run(T - 6 * 864e5, T - 6 * 864e5);
  let r = await call(2, '/api/items/list', { uid: 'u2', price: 400 }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const lid = db.prepare('SELECT id FROM item_listings WHERE uid = ?').get('u2').id;
  r = await call(3, '/api/items/buy', { id: lid }); assert.equal(r.status, 200, JSON.stringify(r.body));
  await call(2, '/api/legal/accept', { doc: 'tos', version: '2026-10-15' });
  await call(2, '/api/support', { category: 'deposit', subject: 'Late deposit', body: 'My 300 Rodux did not arrive.' });
  await call(1, '/api/admin/mod', { robloxId: 2, action: 'warn', reason: 'Spam' });
  await call(2, '/api/me', null, { 'x-real-ip': '7.7.7.7', 'x-tb-device': 'a'.repeat(32) + '.' + 'b'.repeat(32) });
  await call(4, '/api/me', null, { 'x-real-ip': '7.7.7.7', 'x-tb-device': 'c'.repeat(32) + '.' + 'd'.repeat(32) });

  r = await call(2, '/api/admin/player?id=2'); assert.equal(r.status, 403); ok('only admins can open the player log');
  r = await call(1, '/api/admin/player?id=Alice'); assert.equal(r.status, 200, JSON.stringify(r.body)); const L = r.body;
  const ev = L.events, find = (k, f = () => true) => ev.find(e => e.kind === k && f(e));
  assert.equal(L.username, 'Alice'); assert.match(L.walletId, /^TBW-/);
  assert.equal(find('deposit', e => /In game/.test(e.method)).amount, 500);
  assert.equal(find('deposit', e => e.ref === 'ot-1').method, 'Website wallet (Trade Empire save, out of game)');
  assert.equal(find('deposit', e => e.ref === 'ot-2').status, 'cancelled'); assert.equal(find('withdraw').amount, -200); ok('every Rodux deposit and withdrawal is listed with how it was made and whether it went through');
  assert.equal(L.totals.roduxIn, 1700); assert.equal(L.totals.roduxInGame, 500); assert.equal(L.totals.roduxInWeb, 1200); assert.equal(L.totals.roduxOut, 200); assert.equal(L.totals.refused, 1); ok('totals split by method, and refused transfers are counted');
  const dep = find('item-deposit'); assert.deepEqual(dep.items.map(i => [i.itemId, i.serial]).sort(), [[101, 7], [202, 3]]); assert.equal(L.totals.itemsIn, 2); ok('item deposits list the exact copies (item and serial)');
  assert.equal(find('list').value, 400); const sold = find('sold'); assert.equal(sold.amount, 400); assert.equal(sold.items[0].itemId, 202); assert.match(sold.title, /Bobby/); ok('listings and marketplace sales show the item, the price and the buyer');
  assert.ok(find('legal')); assert.ok(find('ticket')); assert.equal(find('mod-warn').note, 'Spam'); assert.ok(find('wait-in')); ok('Terms, tickets, staff actions and access are in the log');
  const net = L.seen.find(s => s.kind === 'ip'); assert.match(net.label, /^N-[0-9A-F]{6}$/); assert.equal(net.others[0].username, 'Carla'); ok('networks show as labels, with the other accounts seen on them');
  assert.ok(L.holdings.some(h => h.itemId === 101)); assert.ok(L.snapshot.tradeBlacket); ok('the log includes current holdings and the full account');
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i - 1].at >= ev[i].at); ok('the log is newest first');
  r = await call(1, '/api/admin/player?id=Bobby'); assert.equal(r.body.events.find(e => e.kind === 'item-buy').items[0].serial, 3); ok("the buyer's log shows the copy they bought");

  r = await call(1, '/api/admin/search?q=ali'); assert.equal(r.body.players[0].username, 'Alice');
  r = await call(1, '/api/admin/search?q=' + L.walletId); assert.equal(r.body.players[0].robloxId, 2);
  const tk = db.prepare('SELECT id FROM tickets WHERE roblox_id = 2').get().id; r = await call(1, '/api/admin/search?q=' + tk); assert.equal(r.body.players[0].robloxId, 2);
  r = await call(1, '/api/admin/search?q='); assert.ok(r.body.players.length >= 3); ok('staff find players by name, Roblox id, wallet ID or ticket, or see recent players');

  console.log(`\nAll ${n} checks passed.`); server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
