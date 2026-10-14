// Studio games (LuckyStreak seamless wallet) against a fake LuckyStreak.
// Run: node test-provider.js
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path');
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
process.env.DB_PATH = path.join(os.tmpdir(), `tb-provider-${process.pid}.db`);
process.env.LUCKYSTREAK_API_URL = 'https://ls.example/api';
process.env.LUCKYSTREAK_OPERATOR_ID = 'op-1';
process.env.LUCKYSTREAK_HAWK_ID = 'tb';
process.env.LUCKYSTREAK_HAWK_KEY = 'k'.repeat(32);

const realFetch = global.fetch; let launched = null;
global.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.startsWith('https://ls.example/api/games')) return new Response(JSON.stringify({ games: [{ gameId: 'g1', name: 'Gold Rush', provider: 'Kalamba', image: 'https://cdn/g1.png' }] }));
  if (url.startsWith('https://ls.example/api/game/launch')) { launched = JSON.parse(opt.body); assert.match(opt.headers.Authorization, /^Hawk id="tb"/); return new Response(JSON.stringify({ url: 'https://play.ls.example/g1?t=1' })); }
  return realFetch(url, opt);
};

const { server, db } = require('./server.js');
const P = require('./provider.js');
let base, port;
const sign = (method, p, body) => P.hawkHeader(method, `http://127.0.0.1:${port}${p}`, body);
async function wallet(action, body, o = {}) {
  const p = `/api/provider/luckystreak/${action}`, raw = JSON.stringify(body);
  const auth = o.auth !== undefined ? o.auth : sign('POST', p, raw);
  const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: o.tamper ? raw.replace('"amount":10', '"amount":99') : raw });
  return { status: r.status, body: await r.json(), auth };
}
const cookie = 'tb_session=' + 'a'.repeat(64);
async function site(p, body) { const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; }
const bal = () => db.prepare('SELECT balance FROM users WHERE roblox_id = 7').get().balance;
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);

(async () => {
  await new Promise(r => server.listen(0, r)); port = server.address().port; base = `http://127.0.0.1:${port}`;
  db.prepare('INSERT INTO users (roblox_id, username, created_at, balance, deposited) VALUES (7, ?, 0, 1000, 1000)').run('Player');
  db.prepare('INSERT INTO sessions VALUES (?, 7, 0)').run('a'.repeat(64));

  let r = await site('/api/games'); assert.equal(r.body.enabled, true); assert.equal(r.body.games[0].name, 'Gold Rush'); assert.equal(r.body.games[0].studio, 'Kalamba');
  ok('lists studio games from LuckyStreak');
  r = await site('/api/games/launch', { gameId: 'g1' }); assert.equal(r.status, 403); ok('games need the Terms accepted first');
  const v = (await site('/api/me')).body.legal.versions; await site('/api/legal/accept', { doc: 'tos', version: v.tos });
  r = await site('/api/games/launch', { gameId: 'g1' }); assert.equal(r.status, 403); assert.equal(r.body.waitlist, true);
  db.prepare("INSERT INTO slot_access (roblox_id, via, granted_at) VALUES (7, 'code', 0)").run();
  r = await site('/api/games/launch', { gameId: 'g1' }); assert.equal(r.status, 200); assert.equal(r.body.url, 'https://play.ls.example/g1?t=1');
  const session = launched.sessionToken; assert.ok(session && launched.currency === 'RDX' && launched.playerId === '7');
  ok('launches a game with a fresh player session, signed with Hawk');

  r = await wallet('balance', { session }); assert.equal(r.body.balance, 1000); ok('balance call returns the Rodux balance');
  r = await wallet('balance', { session }, { auth: null }); assert.equal(r.status, 401); ok('unsigned calls are refused');
  r = await wallet('debit', { session, transaction: 't1', round: 'r1', amount: 10 }, { tamper: true }); assert.equal(r.status, 401); assert.equal(bal(), 1000); ok('a call whose body was changed after signing is refused');
  const p1 = '/api/provider/luckystreak/balance', raw1 = JSON.stringify({ session }), a1 = sign('POST', p1, raw1);
  await fetch(base + p1, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: a1 }, body: raw1 });
  const rep = await fetch(base + p1, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: a1 }, body: raw1 }); assert.equal(rep.status, 401); ok('a replayed signed request is refused');

  r = await wallet('debit', { session, transaction: 't1', round: 'r1', amount: 10, game: 'g1' }); assert.equal(r.body.status, 'OK'); assert.equal(r.body.balance, 990); assert.equal(bal(), 990);
  r = await wallet('debit', { session, transaction: 't1', round: 'r1', amount: 10, game: 'g1' }); assert.equal(r.body.balance, 990); assert.equal(bal(), 990); ok('a bet is taken once even if LuckyStreak retries it');
  r = await wallet('credit', { session, transaction: 'w1', round: 'r1', amount: 25 }); assert.equal(bal(), 1015);
  r = await wallet('credit', { session, transaction: 'w1', round: 'r1', amount: 25 }); assert.equal(bal(), 1015); ok('a win is paid once');
  r = await wallet('debit', { session, transaction: 't2', amount: 5000 }); assert.equal(r.body.code, 'INSUFFICIENT_FUNDS'); assert.equal(bal(), 1015); ok('bets above the balance are refused');
  r = await wallet('debit', { session, transaction: 't3', amount: 1.5 }); assert.equal(r.body.code, 'INVALID_AMOUNT'); ok('fractional Rodux is refused');

  r = await wallet('debit', { session, transaction: 't4', amount: 100 }); assert.equal(bal(), 915);
  r = await wallet('rollback', { session, transaction: 'rb1', reference: 't4' }); assert.equal(r.body.refunded, 100); assert.equal(bal(), 1015);
  r = await wallet('rollback', { session, transaction: 'rb1', reference: 't4' }); assert.equal(bal(), 1015);
  r = await wallet('rollback', { session, transaction: 'rb2', reference: 't4' }); assert.equal(bal(), 1015); ok('a refund returns the bet exactly once');
  r = await wallet('rollback', { session, transaction: 'rb3', reference: 't5' }); assert.equal(r.body.refunded, 0);
  r = await wallet('debit', { session, transaction: 't5', amount: 50 }); assert.equal(r.body.code, 'TRANSACTION_ROLLED_BACK'); assert.equal(bal(), 1015); ok('a bet that was refunded before it arrived is never taken');
  r = await wallet('rollback', { session, transaction: 'rb4', reference: 'w1' }); assert.equal(r.body.code, 'INVALID_TRANSACTION'); ok('wins cannot be rolled back');

  await site('/api/limits', { maxBet: 50 });
  r = await wallet('debit', { session, transaction: 't6', amount: 60 }); assert.equal(r.body.code, 'PLAYER_LIMIT'); assert.equal(bal(), 1015); ok('the largest-bet limit applies to studio games');
  await site('/api/limits', { lossLimit: 40 });
  r = await wallet('debit', { session, transaction: 't7', amount: 40 }); assert.equal(r.body.status, 'OK');
  r = await wallet('debit', { session, transaction: 't8', amount: 30 }); assert.equal(r.body.code, 'PLAYER_LIMIT'); ok('studio losses count toward the daily loss limit');
  await site('/api/limits', { coolOff: '24h' });
  r = await wallet('debit', { session, transaction: 't9', amount: 1 }); assert.equal(r.body.code, 'PLAYER_LIMIT');
  r = await site('/api/games/launch', { gameId: 'g1' }); assert.equal(r.status, 403); ok('a break stops both new games and bets');

  r = await site('/api/me'); assert.equal(r.body.balance, bal()); assert.ok(r.body.studio.some(t => t.tx_id === 't1' && t.kind === 'debit'));
  assert.equal(r.body.withdrawable, Math.min(bal(), 1000)); assert.ok(r.body.withdrawable <= 1000); ok('withdrawals stay capped at what was deposited, whatever studio games pay');
  r = await wallet('balance', { session: 'nope' }); assert.equal(r.body.code, 'INVALID_SESSION'); ok('unknown sessions are refused');

  console.log(`\nAll ${n} checks passed.`);
  server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
