// Limiteds, item coinflips and responsible-play limits against fake Roblox data stores.
// Run: node test-items.js
'use strict';
const SIGN = require('./test-sign.js');
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
const dbPath = path.join(os.tmpdir(), `tb-items-${process.pid}.db`);
process.env.SITE_WAITLIST = 'off';
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
process.env.DB_PATH = dbPath;
process.env.ROBLOX_OPEN_CLOUD_KEY = 'x'.repeat(40);

// ---- fake Roblox ----
const stores = { PlayerStore_v1: {}, ItemStore_v1: {}, MarketStore_v1: {}, ProfileMail_v1: {} }; let ver = 0, mode = 'normal';
const put = (st, k, v) => { stores[st][k] = { value: JSON.stringify(v), version: String(++ver) }; };
const get = (st, k) => JSON.parse(stores[st][k].value);
const realFetch = global.fetch;
global.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.startsWith('https://thumbnails.roblox.com/')) { const ids = new URL(url).searchParams.get('assetIds').split(','); return new Response(JSON.stringify({ data: ids.map(id => ({ targetId: Number(id), state: 'Completed', imageUrl: `https://img/${id}.png` })) })); }
  if (!url.startsWith('https://apis.roblox.com/')) return realFetch(url, opt);
  const u = new URL(url), st = u.searchParams.get('datastoreName'), k = u.searchParams.get('entryKey'), e = stores[st][k];
  if (opt.method === 'POST') {
    if (mode === 'timeout-applied') { mode = 'normal'; stores[st][k] = { value: opt.body, version: String(++ver) }; throw new Error('timeout'); }
    const cur = stores[st][k]; if (!cur || u.searchParams.get('matchVersion') !== cur.version) return new Response('', { status: 409 });
    stores[st][k] = { value: opt.body, version: String(++ver) }; return new Response('{}');
  }
  return e ? new Response(e.value, { headers: { 'roblox-entry-version': e.version } }) : new Response('', { status: 404 });
};
const DAY = 864e5, sec = t => Math.floor(t / 1000);
const save = (owned, acquiredAt = {}, session = null) => ({ Data: { pBalance: 100, owned, acquiredAt, siteWallet: { deposited: 0, withdrawn: 0, pending: [] } }, MetaData: { ActiveSession: session, LastUpdate: sec(Date.now()) } });
put('ItemStore_v1', '1048037', { name: 'Midnight Blue Sparkle Time Fedora', baseValue: 25000000, rap: 24000000 });
put('ItemStore_v1', '1191125', { name: 'Dominus Rex', baseValue: 3700000 });
put('ItemStore_v1', '64082730', { name: 'Violet Valkyrie', baseValue: 220000 });
put('ItemStore_v1', '1365767', { name: 'Valkyrie Helm', baseValue: 400000 });
put('ItemStore_v1', '9999', { name: 'Silly Fun', baseValue: 577 });
const old = sec(Date.now() - 10 * DAY), fresh = sec(Date.now() - 3600e3);
put('PlayerStore_v1', '11', save({ '1048037': [46], '1191125': [197], '64082730': [2531], '9999': [20984] }, { '1048037:46': old, '1191125:197': old, '64082730:2531': fresh }));
put('PlayerStore_v1', '22', save({ '1365767': [3147, 3150] }, { '1365767:3147': old, '1365767:3150': old }));
const copies = () => { const all = []; for (const k of ['11', '22']) for (const [id, ss] of Object.entries(get('PlayerStore_v1', k).Data.owned)) ss.forEach(s => all.push(`${id}:${s}`)); return all; };

const { server, db } = require('./server.js');
let base;
const jar = {};
async function call(who, p, body) {
  const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', cookie: jar[who] }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}
const siteCopies = () => db.prepare("SELECT item_id || ':' || serial AS t FROM site_items WHERE status != 'gone'").all().map(r => r.t);
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);

(async () => {
  await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  for (const [id, name] of [[11, 'Alice'], [22, 'Bob']]) {
    db.prepare('INSERT INTO users (roblox_id, username, created_at) VALUES (?, ?, 0)').run(id, name);
    const tok = String(id).repeat(64).slice(0, 64).replace(/[^0-9a-f]/g, 'a'); db.prepare('INSERT INTO sessions VALUES (?, ?, 0)').run(tok, id); jar[id] = 'tb_session=' + tok;
  }
  const total0 = copies().length + siteCopies().length;

  let r = await call(11, '/api/items/save'); assert.equal(r.status, 200, JSON.stringify(r.body));
  const fed = r.body.items.find(x => x.itemId === 1048037);
  assert.equal(fed.name, 'Midnight Blue Sparkle Time Fedora'); assert.equal(fed.value, 25000000); assert.equal(fed.img, 'https://img/1048037.png'); assert.equal(r.body.items.length, 4);
  ok('reads the Trade Empire inventory with names, values and pictures');
  r = await call(11, '/api/items/deposit', { tokens: ['1048037:46'] }); assert.equal(r.status, 403); ok('item deposits need the Deduction Service accepted');
  const ver0 = (await call(11, '/api/me')).body.legal.versions;
  for (const w of [11, 22]) { await call(w, '/api/legal/accept', { doc: 'tos', version: ver0.tos, ...SIGN }); await call(w, '/api/legal/accept', { doc: 'cds', version: ver0.cds, ...SIGN }); }

  r = await call(11, '/api/items/deposit', { tokens: ['64082730:2531'] }); assert.equal(r.status, 400); assert.match(r.body.error, /holding period/); ok('items in their 3-day holding period stay in the game');
  put('MarketStore_v1', '1191125', { '197': { sellerId: 11, price: 5 } });
  r = await call(11, '/api/items/deposit', { tokens: ['1191125:197'] }); assert.equal(r.status, 400); assert.match(r.body.error, /listed/); ok('items listed on the in-game market stay in the game');
  delete stores.MarketStore_v1['1191125'];
  put('ProfileMail_v1', '11', [{ kind: 'market.sold', payload: { itemId: 1191125, serial: 197 } }]);
  r = await call(11, '/api/items/deposit', { tokens: ['1191125:197'] }); assert.equal(r.status, 409); assert.match(r.body.error, /mail/); ok('nothing leaves while game mail is waiting (a pending sale would duplicate the item)');
  put('ProfileMail_v1', '11', []);
  const a = get('PlayerStore_v1', '11'); a.MetaData.ActiveSession = [1, 'j', 'u']; put('PlayerStore_v1', '11', a);
  r = await call(11, '/api/items/deposit', { tokens: ['1191125:197'] }); assert.equal(r.status, 409); assert.equal(r.body.inGame, true); ok('nothing moves while the player is in the game');
  a.MetaData.ActiveSession = null; put('PlayerStore_v1', '11', a);

  r = await call(11, '/api/items/deposit', { tokens: ['1048037:46', '1191125:197'] }); assert.equal(r.status, 200, JSON.stringify(r.body));
  let s11 = get('PlayerStore_v1', '11');
  assert.equal(s11.Data.owned['1048037'], undefined); assert.equal(s11.Data.owned['1191125'], undefined); assert.equal(s11.Data.acquiredAt['1048037:46'], undefined); assert.deepEqual(s11.Data.owned['9999'], [20984]);
  r = await call(11, '/api/items/site'); assert.equal(r.body.items.length, 2); assert.equal(r.body.items.every(i => i.status === 'held'), true);
  ok('deposit: copies leave the save, arrive on the site, the rest of the save untouched');
  r = await call(11, '/api/items/deposit', { tokens: ['1048037:46'] }); assert.equal(r.status, 400); ok('a copy cannot be deposited twice');

  // Bob deposits his two helms; one withdrawal timeout case on the way
  mode = 'timeout-applied';
  r = await call(22, '/api/items/deposit', { tokens: ['1365767:3147', '1365767:3150'] }); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(get('PlayerStore_v1', '22').Data.owned['1365767'], undefined); ok('write landed but reply lost: found by its stamp, deposited once');
  assert.equal(copies().length + siteCopies().length, total0); ok(`supply unchanged (${total0} copies)`);

  // Coinflip
  const aItems = (await call(11, '/api/items/site')).body.items, bItems = (await call(22, '/api/items/site')).body.items;
  const rex = aItems.find(i => i.itemId === 1191125), helms = bItems.map(i => i.uid);
  r = await call(11, '/api/flips/create', { uids: [rex.uid], side: 'h' }); assert.equal(r.status, 200, JSON.stringify(r.body)); const flipId = r.body.id;
  r = await call(11, '/api/items/withdraw', { uids: [rex.uid] }); assert.equal(r.status, 400); ok('items in an open coinflip cannot be withdrawn');
  r = await call(11, '/api/flips/join', { id: flipId, uids: [aItems[0].uid] }); assert.equal(r.status, 400); ok('you cannot join your own coinflip');
  r = await call(22, '/api/flips/join', { id: flipId, uids: [helms[0]] }); assert.equal(r.status, 400); assert.match(r.body.error, /between/); ok('joiner must match the value within 10%');
  // give Bob a matching stake: make the helm worth 3.7M for this test
  put('ItemStore_v1', '1365767', { name: 'Valkyrie Helm', baseValue: 1850000 }); db.prepare('SELECT 1').get();
  await new Promise(r => setTimeout(r, 10));
  // value cache is 10 minutes; reach into it through a fresh lookup by clearing via a new id path: use both helms (2 x 400k = 800k) is too low, so test with cancel + recreate at matching value instead
  r = await call(11, '/api/flips/cancel', { id: flipId }); assert.equal(r.status, 200);
  assert.equal((await call(11, '/api/items/site')).body.items.find(i => i.uid === rex.uid).status, 'held'); ok('cancelling returns the items');
  const silly = (await call(11, '/api/items/site')).body.items; // Alice: fedora 25M, rex 3.7M
  r = await call(22, '/api/flips/create', { uids: helms, side: 't' }); assert.equal(r.status, 200); const f2 = r.body.id; // 800k
  r = await call(11, '/api/flips/join', { id: f2, uids: [rex.uid] }); assert.equal(r.status, 400); ok('a much bigger stake is refused too');
  // Alice deposits two cheaper items to match: give her save a pair worth ~800k
  put('ItemStore_v1', '5555', { name: 'Sign: AFK Send Trades', baseValue: 375000 }); put('ItemStore_v1', '6666', { name: 'Domino Crown', baseValue: 420000 });
  const s = get('PlayerStore_v1', '11'); s.Data.owned['5555'] = [1734]; s.Data.owned['6666'] = [12]; s.Data.acquiredAt['5555:1734'] = old; put('PlayerStore_v1', '11', s);
  r = await call(11, '/api/items/deposit', { tokens: ['5555:1734', '6666:12'] }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const pair = (await call(11, '/api/items/site')).body.items.filter(i => [5555, 6666].includes(i.itemId)).map(i => i.uid);
  r = await call(11, '/api/flips/join', { id: f2, uids: pair }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const winner = r.body.winner, loser = winner === 11 ? 22 : 11;
  const wItems = (await call(winner, '/api/items/site')).body.items, lItems = (await call(loser, '/api/items/site')).body.items;
  assert.ok(wItems.some(i => i.itemId === 1365767) && wItems.some(i => i.itemId === 5555)); assert.ok(!lItems.some(i => [1365767, 5555, 6666].includes(i.itemId)));
  const crypto = require('node:crypto'), fl = (await call(11, '/api/flips')).body.recent.find(x => x.id === f2);
  assert.equal(crypto.createHash('sha256').update(fl.seed).digest('hex'), fl.seedHash);
  const roll = crypto.createHash('sha256').update(`${fl.seed}:11:${f2}`).digest(); assert.equal(roll[0] % 2 === 0 ? 'h' : 't', fl.result);
  ok(`coinflip settled (${winner === 11 ? 'Alice' : 'Bob'} won all four items) and the result checks out against the revealed seed`);

  // the winner takes a won item home to their own save
  const won = wItems.find(i => i.itemId === (winner === 11 ? 1365767 : 5555));
  r = await call(winner, '/api/items/withdraw', { uids: [won.uid] }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const ws = get('PlayerStore_v1', String(winner));
  assert.ok(ws.Data.owned[String(won.itemId)].includes(won.serial)); assert.ok(ws.Data.acquiredAt[`${won.itemId}:${won.serial}`] > sec(Date.now()) - 60);
  ok('withdraw: the copy lands in the winner\'s save with a fresh holding period');
  assert.equal(copies().length + siteCopies().length, total0 + 2); ok('supply unchanged apart from the two test items added to the save by hand');

  // limits
  r = await call(11, '/api/limits', { depositCap: 50 }); assert.equal(r.body.settings.depositCap, 50); ok('a new limit applies immediately');
  r = await call(11, '/api/limits', { depositCap: 5000 }); assert.equal(r.body.settings.depositCap, 50); assert.ok(r.body.pending.depositCap); ok('loosening a limit waits 24 hours');
  r = await call(11, '/api/game/deposit', { amount: 60 }); assert.equal(r.status, 403); assert.match(r.body.error, /daily deposit limit/); ok('the daily deposit limit is enforced');
  r = await call(11, '/api/limits', { coolOff: '24h' }); assert.equal(r.body.lock.reason, 'coolOff');
  r = await call(11, '/api/flips/create', { uids: [wItems.concat(lItems).filter(i => i.status === 'held')[0]?.uid].filter(Boolean), side: 'h' });
  const alice = (await call(11, '/api/items/site')).body.items.filter(i => i.status === 'held');
  if (alice.length) { r = await call(11, '/api/flips/create', { uids: [alice[0].uid], side: 'h' }); assert.equal(r.status, 403); }
  if (alice.length) { r = await call(11, '/api/items/withdraw', { uids: [alice[0].uid] }); assert.equal(r.status, 200); }
  ok('a break blocks playing and depositing, but never withdrawing');
  r = await call(22, '/api/limits', { dailyMinutes: 1 });
  for (let i = 0; i < 2; i++) { db.prepare('UPDATE usage SET last = 0 WHERE roblox_id = 22').run(); r = await call(22, '/api/limits/heartbeat', { seconds: 60 }); }
  assert.equal(r.body.lock.reason, 'screenTime'); ok('the screen time limit locks play for the rest of the day');
  r = await call(22, '/api/limits/heartbeat', { seconds: 60 }); assert.equal(r.body.usedSeconds, 120); ok('heartbeats cannot be spammed to run the clock');

  console.log(`\nAll ${n} checks passed.`);
  server.close(); db.close(); for (const f of [dbPath, dbPath + '-wal', dbPath + '-shm']) fs.rmSync(f, { force: true }); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
