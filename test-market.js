// Limiteds market, selling to TradeBlacket, profiles, support and wallet IDs.
// Run: node test-market.js
'use strict';
const SIGN = require('./test-sign.js');
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
const dbPath = path.join(os.tmpdir(), `tb-market-${process.pid}.db`);
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

  const v = (await call(11, '/api/me')).body.legal.versions;
  for (const w of [11, 22]) { await call(w, '/api/legal/accept', { doc: 'tos', version: v.tos, ...SIGN }); await call(w, '/api/legal/accept', { doc: 'cds', version: v.cds, ...SIGN }); }
  // Alice deposits the fedora (25,000,000) and Dominus Rex (3,700,000)
  let r = await call(11, '/api/items/deposit', { tokens: ['1048037:46', '1191125:197'] }); assert.equal(r.status, 200, JSON.stringify(r.body));
  let site = (await call(11, '/api/items/site')).body.items; const fed = site.find(i => i.itemId === 1048037), rex = site.find(i => i.itemId === 1191125);

  r = await call(11, '/api/items/sell-quote', { uids: [rex.uid] }); assert.equal(r.body.value, 3700000); assert.equal(r.body.payout, 3330000); ok('selling quotes 90% of the Trade Empire value');
  const before = db.prepare('SELECT * FROM users WHERE roblox_id = 11').get();
  r = await call(11, '/api/items/sell', { uids: [rex.uid] }); assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.payout, 3330000);
  const after = db.prepare('SELECT * FROM users WHERE roblox_id = 11').get();
  assert.equal(after.balance - before.balance, 3330000); assert.equal(after.deposited - before.deposited, 3330000);
  assert.equal((await call(11, '/api/me')).body.withdrawable, Math.min(after.balance, after.deposited - after.withdrawn)); ok('the Rodux is paid out and can be withdrawn like deposited Rodux');
  let m = (await call(22, '/api/items/market')).body.listings; const houseRex = m.find(l => l.uid === rex.uid);
  assert.equal(houseRex.seller, 'TradeBlacket'); assert.equal(houseRex.price, 3700000); ok('TradeBlacket lists the sold copy at its full value');

  r = await call(11, '/api/items/list', { uid: fed.uid, price: 20000000 }); assert.equal(r.status, 200);
  site = (await call(11, '/api/items/site')).body.items; assert.equal(site.find(i => i.uid === fed.uid).status, 'market');
  r = await call(11, '/api/items/withdraw', { uids: [fed.uid] }); assert.notEqual(r.status, 200); ok('a listed item cannot be withdrawn or flipped while listed');

  m = (await call(22, '/api/items/market')).body.listings; const fl = m.find(l => l.uid === fed.uid);
  r = await call(22, '/api/items/buy', { id: fl.id }); assert.equal(r.status, 400); assert.match(r.body.error, /Not enough Rodux/); ok('buying needs enough Rodux');
  db.prepare('UPDATE users SET balance = 30000000, deposited = 30000000 WHERE roblox_id = 22').run();
  r = await call(11, '/api/items/buy', { id: fl.id }); assert.equal(r.status, 400); ok('you cannot buy your own listing');
  const a0 = db.prepare('SELECT balance, deposited FROM users WHERE roblox_id = 11').get();
  r = await call(22, '/api/items/buy', { id: fl.id }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const b1 = db.prepare('SELECT balance, deposited FROM users WHERE roblox_id = 22').get(), a1 = db.prepare('SELECT balance, deposited FROM users WHERE roblox_id = 11').get();
  assert.equal(b1.balance, 10000000); assert.equal(b1.deposited, 10000000); assert.equal(a1.balance - a0.balance, 20000000); assert.equal(a1.deposited - a0.deposited, 20000000);
  ok('the buyer pays, the seller is paid in withdrawable Rodux');
  const bob = (await call(22, '/api/items/site')).body.items.find(i => i.uid === fed.uid); assert.equal(bob.status, 'held');
  r = await call(22, '/api/items/buy', { id: fl.id }); assert.equal(r.status, 400); ok('the bought copy is in the buyer\'s limiteds and cannot be bought twice');
  r = await call(22, '/api/items/withdraw', { uids: [fed.uid] }); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(get('PlayerStore_v1', '22').Data.owned['1048037'].includes(46)); ok('the buyer withdraws the exact copy into their Trade Empire save');
  assert.equal(copies().length + siteCopies().length, total0); ok('no item was created or lost');
  r = await call(22, '/api/items/buy', { id: houseRex.id }); assert.equal(r.status, 200);
  r = await call(11, '/api/items/list', { uid: rex.uid, price: 5 }); assert.notEqual(r.status, 200); ok('a sold copy belongs to the buyer, not the old owner');

  // wallet IDs, profiles, support
  const me11 = (await call(11, '/api/me')).body; assert.match(me11.walletId, /^TBW-[A-Z2-9]{4}-[A-Z2-9]{4}$/); assert.equal((await call(11, '/api/me')).body.walletId, me11.walletId); ok('every account has a stable wallet ID');
  r = await call(11, '/api/profile', { bio: 'Collecting Valkyries', pronouns: 'she/her' }); assert.equal(r.body.bio, 'Collecting Valkyries');
  r = await call(11, '/api/profile', { banner: 'royal' }); assert.equal(r.status, 403); ok('profile themes need TradePlus');
  const s11 = get('PlayerStore_v1', '11'); s11.Data.subscription = { tier: 'Silver', expiration: sec(Date.now()) + 86400 }; put('PlayerStore_v1', '11', s11);
  db.prepare('UPDATE users SET tier_at = 0 WHERE roblox_id = 11').run();
  r = await call(11, '/api/profile', { banner: 'royal', accent: '#E7C77F', effect: 'sparkle', nameStyle: 'gold' }); assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.tier, 'Silver'); assert.equal(r.body.banner, 'royal');
  ok('an active TradePlus tier in the Trade Empire save unlocks profile themes');
  r = await call(22, '/api/profile/alice'); assert.equal(r.body.username, 'Alice'); assert.equal(r.body.banner, 'royal'); assert.equal(r.body.me, false); ok('anyone can view a profile');
  r = await call(22, '/api/support', { subject: 'Missing item', category: 'limiteds', body: 'My fedora did not arrive in game.' }); assert.equal(r.status, 200); const tk = r.body.id;
  r = await call(11, '/api/support'); assert.equal(r.body.tickets.length, 0); ok('players only see their own tickets');
  process.env.__noop = '';
  db.prepare('INSERT OR IGNORE INTO users (roblox_id, username, created_at) VALUES (496295513, ?, 0)').run('Owner'); db.prepare('INSERT INTO sessions VALUES (?, 496295513, 0)').run('f'.repeat(64)); jar.own = 'tb_session=' + 'f'.repeat(64);
  r = await call('own', '/api/support'); assert.equal(r.body.admin, true); assert.ok(r.body.tickets.some(t => t.id === tk && t.walletId));
  r = await call('own', `/api/support/${tk}/reply`, { body: 'Leave the game and check again in a minute.' }); assert.equal(r.body.status, 'answered'); assert.equal(r.body.messages.at(-1).staff, true);
  r = await call(22, '/api/support'); assert.equal(r.body.tickets[0].messages.filter(m => m.kind === 'msg').length, 2); ok('admins see every ticket and reply as support');
  r = await call(22, `/api/support/${tk}/close`, {}); r = await call(22, '/api/support'); assert.equal(r.body.tickets[0].status, 'closed'); ok('players can close their tickets');

  console.log(`\nAll ${n} checks passed.`);
  server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
