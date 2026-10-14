// TradeBlacket Business (business.js).
// Run: node test-business.js
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path');
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
process.env.DB_PATH = path.join(os.tmpdir(), `tb-biz-${process.pid}.db`);
process.env.ADMIN_ROBLOX_IDS = '1';
const { server, db } = require('./server.js');
let base; const jar = {};
async function call(who, p, body) { const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(who ? { cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; }
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);
const APP = { name: 'Builder Bob', links: [{ platform: 'youtube', url: 'https://www.youtube.com/@builderbob' }], audience: 12000, discord: 'bob#1', why: 'I make weekly Trade Empire trading videos and live streams for my community.', agree: true };

(async () => {
  await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  for (const id of [1, 2, 3]) { db.prepare("INSERT INTO users (roblox_id, username, created_at, tos_version) VALUES (?, ?, 0, '2026-10-15')").run(id, 'U' + id); const t = String(id).repeat(64).slice(0, 64); db.prepare('INSERT INTO sessions VALUES (?, ?, 0)').run(t, id); jar[id] = 'tb_session=' + t; }
  let r = await call(2, '/api/business/me'); assert.equal(r.body.status, 'none'); assert.match(r.body.cardNo, /^TBB [A-Z0-9]{4} [A-Z0-9]{4} [A-Z0-9]{4}$/); ok('a signed-in player can open Business');
  r = await call(2, '/api/business/apply', { ...APP, links: [{ platform: 'youtube', url: 'not a link' }] }); assert.equal(r.status, 400);
  r = await call(2, '/api/business/apply', { ...APP, agree: false }); assert.equal(r.status, 400); ok('applications need real links and the terms accepted');
  r = await call(2, '/api/business/apply', APP); assert.equal(r.body.status, 'pending'); r = await call(2, '/api/business/apply', APP); assert.equal(r.status, 400); ok('applying once puts you in review');
  r = await call(2, '/api/business/tepp', { plan: 'x'.repeat(50), cadence: 'weekly', agree: true }); assert.equal(r.status, 403); ok('TEPP needs an approved membership');
  r = await call(3, '/api/admin/business/decide', { robloxId: 2, approve: true }); assert.equal(r.status, 403); ok('only moderators decide');
  r = await call(1, '/api/admin/business/decide', { robloxId: 2, approve: true, note: 'Welcome' }); assert.equal(r.body.members[0].status, 'approved');
  r = await call(2, '/api/me'); assert.equal(r.body.business.role, 'Business'); assert.equal(r.body.site.access, true); ok('approval gives the Business role and site access');
  r = await call(3, '/api/profile/U2'); assert.equal(r.body.business.role, 'Business'); ok('everyone sees the role on the profile');
  r = await call(2, '/api/business/card', { name: 'Bob' }); assert.equal(r.status, 403); ok('Business Cards wait for TEPP');
  r = await call(2, '/api/business/tepp', { plan: 'Weekly trading guides, value updates and giveaways for Trade Empire players.', cadence: 'Twice a week', sample: 'https://youtu.be/abc', code: 'bob', agree: true }); assert.equal(r.body.tepp, 'pending');
  r = await call(1, '/api/admin/business/decide', { robloxId: 2, stage: 'tepp', approve: true }); r = await call(2, '/api/me'); assert.equal(r.body.business.role, 'Partner'); ok('TEPP approval makes them a Partner');
  r = await call(2, '/api/business/card', { name: 'Builder Bob', tagline: 'Trading every day', accent: 'gold', links: [{ platform: 'youtube', url: 'https://www.youtube.com/@builderbob' }] }); assert.equal(r.body.card.name, 'Builder Bob'); ok('partners create their Business Card');
  r = await call(1, '/api/admin/business/payout', { robloxId: 2, currency: 'usd', amount: 25 }); r = await call(1, '/api/admin/business/payout', { robloxId: 2, currency: 'rodux', amount: 5000 });
  r = await call(2, '/api/business/me'); assert.equal(r.body.balance.usd, 25); assert.equal(r.body.balance.rodux, 5000); ok('staff pay the card in dollars and in Rodux');
  const per = r.body.roduxPerUsd;
  r = await call(2, '/api/business/withdraw', { from: 'usd', amount: 30 }); assert.equal(r.status, 400); ok('you cannot take more than the card holds');
  r = await call(2, '/api/business/withdraw', { from: 'usd', amount: 10 }); assert.equal(r.body.paid.rodux, 10 * per); assert.equal(r.body.balance.usd, 15);
  let me = (await call(2, '/api/me')).body; assert.equal(me.balance, 10 * per); assert.equal(me.withdrawable, 10 * per); assert.ok(me.transfers.some(t => t.reason === 'Business card payout')); ok('dollars become withdrawable Rodux on TradeBlacket at the gift card rate');
  // a limited TradeBlacket owns
  db.prepare("INSERT INTO site_items VALUES ('h1', 101, 9, 0, 'market', 3, 0, 0)").run(); db.prepare("INSERT INTO item_listings VALUES ('lst-h1', 'h1', 0, 7000, 0)").run();
  r = await call(2, '/api/business/shop'); assert.equal(r.body.listings[0].id, 'lst-h1');
  r = await call(2, '/api/business/withdraw-items', { listings: ['lst-h1'] }); assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.balance.rodux, 0); assert.ok(Math.abs(r.body.balance.usd - (15 - Math.ceil(2000 * 100 / per) / 100)) < 0.001);
  assert.equal(db.prepare("SELECT owner, status FROM site_items WHERE uid = 'h1'").get().owner, 2); ok('card money buys limiteds TradeBlacket owns (Rodux first, then dollars), and they land in the creator\'s inventory');
  r = await call(1, '/api/admin/business/codes', { robloxId: 2, usd: 10, count: 3 }); r = await call(2, '/api/business/me'); assert.equal(r.body.codes.length, 3); ok('staff hand partners giveaway gift cards');
  r = await call(2, '/api/business/requests', { title: 'Creator codes', body: 'Let viewers use my creator code for a bonus.' }); assert.equal(r.body.requests.length, 1);
  r = await call(2, `/api/business/requests/${r.body.requests[0].id}/vote`, {}); assert.equal(r.body.requests[0].votes, 1);
  r = await call(1, '/api/admin/business/request', { id: r.body.requests[0].id, status: 'planned', reply: 'Coming soon' }); assert.equal(r.body.requests[0].status, 'planned'); ok('members request features and staff answer');
  r = await call(3, '/api/business/requests', { title: 'Hello there', body: 'I am not a member of the program.' }); assert.equal(r.status, 403); ok('non-members cannot');
  r = await call(2, '/api/business/youtube', { channel: '@builderbob' }); assert.match(r.body.youtube.phrase, /^TradeBlacket-[0-9A-F]{8}$/); assert.equal(r.body.youtube.url, 'https://www.youtube.com/@builderbob');
  r = await call(1, '/api/admin/business/youtube', { robloxId: 2, verified: true }); r = await call(2, '/api/me'); assert.equal(r.body.business.verified, true); ok('YouTube channels get a phrase to prove ownership, and staff can verify');
  r = await call(1, '/api/admin/player?id=2'); assert.ok(r.body.events.some(e => /Business: Became a Trade Empire Partner/.test(e.title))); ok('every step is in the player log');
  console.log(`\nAll ${n} checks passed.`); server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
