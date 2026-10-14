// Gift cards (giftcards.js).
// Run: node test-gifts.js
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path');
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
process.env.DB_PATH = path.join(os.tmpdir(), `tb-gift-${process.pid}.db`);
process.env.ADMIN_ROBLOX_IDS = '1';
const { server, db } = require('./server.js');
const { packsFrom, median } = require('./giftcards.js');
let base; const jar = {};
async function call(who, p, body, headers = {}) { const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(who ? { cookie: jar[who] } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; }
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);

(async () => {
  const P = packsFrom([['5,000 Cash', 45], ['15,000 Cash', 129], ['25,000 Cash', 125], ['50,000 Cash', 349], ['75,000 Cash', 499], ['100,000 Cash', 649], ['500,000 Cash', 4000], ['Remove wait periods', 79]]);
  assert.equal(P.length, 7); assert.equal(P[0].rodux, 5000); ok('Rodux packs are read from the product names, other products are ignored');
  assert.equal(Math.round(median(P.map(p => p.perRobux)) * 100) / 100, 143.27); ok('the rate is the median pack, so neither the starter pack nor the bargain pack decides it');

  await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  for (const id of [1, 2, 3, 4]) { db.prepare("INSERT INTO users (roblox_id, username, created_at, tos_version) VALUES (?, ?, 0, '2026-10-15')").run(id, 'U' + id); const t = String(id).repeat(64).slice(0, 64); db.prepare('INSERT INTO sessions VALUES (?, ?, 0)').run(t, id); jar[id] = 'tb_session=' + t; }
  db.prepare("INSERT INTO site_access VALUES (2, 'code', 0)").run(); db.prepare("INSERT INTO site_access VALUES (3, 'code', 0)").run();
  let r = await call(null, '/api/rates'); const perUsd = r.body.roduxPerUsd; assert.ok(perUsd > 1000); assert.equal(r.body.robuxPerUsd, 80);
  assert.equal(r.body.values.find(v => v.usd === 10).rodux, Math.round(10 * perUsd)); ok('anyone can see what a dollar is worth in Rodux');
  r = await call(2, '/api/admin/giftcards', { usd: 10 }); assert.equal(r.status, 403); ok('players cannot make gift cards');
  r = await call(1, '/api/admin/giftcards', { usd: 7 }); assert.equal(r.status, 400); ok('only $5, $10, $100 and $500 exist');
  r = await call(1, '/api/admin/giftcards', { usd: 10, count: 2, note: 'Creator giveaway' }); const [c1, c2] = r.body.codes; assert.match(c1, /^TBG-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  r = await call(1, '/api/admin/giftcards', { usd: 5, withdrawable: true }); const cw = r.body.codes[0];
  r = await call(4, '/api/giftcards/redeem', { code: c1 }); assert.equal(r.status, 403); assert.match(r.body.error, /Get into TradeBlacket/); ok('players behind the waitlist cannot redeem yet');
  r = await call(2, '/api/giftcards/redeem', { code: c1.toLowerCase().replace(/-/g, ' ') }); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.usd, 10); assert.equal(r.body.rodux, Math.round(10 * perUsd)); assert.equal(r.body.withdrawable, false); ok('a $10 card pays ten dollars of Rodux, typed in any case');
  let me = (await call(2, '/api/me')).body; assert.equal(me.balance, r.body.rodux); assert.equal(me.bonusLock, r.body.rodux); assert.equal(me.withdrawable, 0);
  assert.ok(me.transfers.some(t => t.kind === 'bonus' && t.reason === '$10 gift card')); ok('it lands on the balance as bonus Rodux and shows in the history');
  r = await call(3, '/api/giftcards/redeem', { code: c1 }); assert.equal(r.status, 400); assert.match(r.body.error, /already been redeemed/);
  r = await call(2, '/api/giftcards/redeem', { code: c1 }); assert.match(r.body.error, /You already redeemed/); ok('each card works once');
  r = await call(3, '/api/giftcards/redeem', { code: cw }); me = (await call(3, '/api/me')).body; assert.equal(me.bonusLock, 0); assert.equal(me.deposited, r.body.rodux); ok('a card made as withdrawable can go back to Trade Empire');
  r = await call(1, '/api/admin/giftcards/void', { code: c2 }); r = await call(3, '/api/giftcards/redeem', { code: c2 }); assert.match(r.body.error, /no longer valid/); ok('admins can cancel a card that was not used');
  db.prepare("INSERT INTO gift_cards (code, usd, created_at, expires_at) VALUES ('TBG-AAAA-BBBB-CCCC', 5, 0, 1)").run();
  r = await call(3, '/api/giftcards/redeem', { code: 'TBG-AAAA-BBBB-CCCC' }); assert.match(r.body.error, /expired/); ok('expired cards are refused');
  r = await call(1, '/api/admin/giftcards'); assert.equal(r.body.totals.redeemed, 2); assert.equal(r.body.cards.find(c => c.code === c1).redeemedBy, 'U2'); assert.ok(r.body.rate.packs.length); ok('admins see every card, who redeemed it and the rate behind it');
  for (let i = 0; i < 10; i++) await call(3, '/api/giftcards/redeem', { code: 'TBG-ZZZZ-ZZZZ-ZZZZ' }, { 'x-real-ip': '9.9.9.9' });
  r = await call(3, '/api/giftcards/redeem', { code: 'TBG-ZZZZ-ZZZZ-ZZZZ' }, { 'x-real-ip': '9.9.9.9' }); assert.equal(r.status, 429); ok('guessing codes is rate limited');
  r = await call(1, '/api/admin/player?id=2'); assert.ok(r.body.events.some(e => /gift card/.test(e.title))); ok('redeemed cards show in the player log');
  console.log(`\nAll ${n} checks passed.`); server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
