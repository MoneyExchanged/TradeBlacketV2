// Legal documents and electronic signatures.
// Run: node test-legal.js
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto');
process.env.GAME_WEBHOOK_SECRET = 'test-secret-0123456789abcdef';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-legal-'));
process.env.DB_PATH = path.join(dir, 'tb.db');
process.env.ADMIN_ROBLOX_IDS = '1';
const { server, db } = require('./server.js');
const SIGN = require('./test-sign.js');
const D = require('./public/legaldocs.js');
let base; const jar = {};
async function call(who, p, body) { const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(who ? { cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined }); const ct = r.headers.get('content-type') || ''; if (ct.startsWith('image/')) return { status: r.status, type: ct, bytes: Buffer.from(await r.arrayBuffer()) }; const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; }
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);

(async () => {
  await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  // 1 owner, 2 player who accepted the old terms by checkbox, 3 new player, 4 trial mod
  for (const [id, tos] of [[1, null], [2, '2026-10-15'], [3, null], [4, null]]) { db.prepare('INSERT INTO users (roblox_id, username, created_at, tos_version) VALUES (?, ?, ?, ?)').run(id, 'U' + id, id, tos); const t = String(id).repeat(64).slice(0, 64); db.prepare('INSERT INTO sessions VALUES (?, ?, 0)').run(t, id); jar[id] = 'tb_session=' + t; }
  let r;
  r = await call(1, '/api/admin/staff', { who: 'U4', rank: 'trial' }); assert.equal(r.status, 200);

  assert.ok(D.order.length >= 9); for (const k of D.order) assert.ok(D[k].b.length >= 4, k);
  assert.ok(D.business.b.some(([h, p]) => /Monthly Wage/.test(h) && /official TradeBlacket moderator/.test(p)));
  assert.ok(D.business.b.some(([h, p]) => /whole wage/i.test(h) && /not to give away all of your wages/.test(p))); ok('nine documents, including the Business agreement with the Monthly Wage and the promise not to give it all away');

  r = await call(2, '/api/me'); assert.equal(r.body.legal.tos, false); ok('players who ticked the old terms have to sign the new version');

  const base0 = { docs: D.packs.site, name: 'Pat Example', strokes: 3, ink: 420 };
  r = await call(3, '/api/legal/sign', { ...base0 }); assert.equal(r.status, 400); assert.match(r.body.error, /Draw/);
  r = await call(3, '/api/legal/sign', { ...base0, signature: 'data:image/png;base64,' + Buffer.from('not a png at all, really not').toString('base64') }); assert.equal(r.status, 400);
  r = await call(3, '/api/legal/sign', { ...base0, signature: 'data:image/png;base64,' + SIGN.png(100, 30).toString('base64') }); assert.equal(r.status, 400);
  r = await call(3, '/api/legal/sign', { ...base0, signature: SIGN.signature, ink: 10 }); assert.equal(r.status, 400); assert.match(r.body.error, /too short/);
  r = await call(3, '/api/legal/sign', { ...base0, signature: SIGN.signature, name: 'x' }); assert.equal(r.status, 400);
  r = await call(3, '/api/legal/sign', { ...base0, signature: SIGN.signature, name: '<script>' }); assert.equal(r.status, 400); ok('no drawing, a fake image, a tiny image, a dot or a made-up name are refused');

  r = await call(3, '/api/legal/sign', { ...base0, signature: SIGN.signature, versions: { tos: '2020-01-01' } }); assert.equal(r.status, 409); ok('signing an out-of-date version is refused');

  r = await call(3, '/api/legal/sign', { docs: ['tos', 'license'], name: 'Pat Example', signature: SIGN.signature, strokes: 3, ink: 420 }); assert.equal(r.status, 400); ok('the site documents are signed together, not one by one');

  r = await call(3, '/api/legal/sign', { ...base0, signature: SIGN.signature }); assert.equal(r.status, 200); assert.equal(r.body.pack, 'site'); assert.equal(r.body.ids.length, D.packs.site.length);
  r = await call(3, '/api/me'); assert.equal(r.body.legal.tos, true); assert.equal(r.body.legal.cds, false); assert.equal(r.body.legal.business, false); ok('signing the site pack accepts the Terms and everything that goes with them');

  r = await call(3, '/api/legal'); const sig = r.body.signatures.find(s => s.doc === 'tos'); assert.ok(sig.current); assert.equal(sig.name, 'Pat Example');
  assert.equal(sig.docHash, crypto.createHash('sha256').update(D.text('tos')).digest('hex')); ok('each signature records the version and the SHA-256 of the exact text signed');
  r = await call(3, `/api/legal/signature/${sig.id}.png`); assert.equal(r.status, 200); assert.equal(r.type, 'image/png'); assert.equal(r.bytes.toString('base64'), SIGN.signature.split(',')[1]);
  r = await call(3, `/api/legal/record/${sig.id}`); assert.equal(r.body.text, D.text('tos')); assert.equal(r.body.net, undefined); ok('players can see their drawn signature and the full signed text');
  r = await call(2, `/api/legal/signature/${sig.id}.png`); assert.equal(r.status, 404); r = await call(2, `/api/legal/record/${sig.id}`); assert.equal(r.status, 404); ok('nobody else can');

  r = await call(4, '/api/admin/signatures'); assert.equal(r.status, 403);
  r = await call(1, '/api/admin/signatures?who=U3'); assert.equal(r.status, 200); assert.equal(r.body.signatures.length, D.packs.site.length);
  r = await call(1, `/api/legal/record/${sig.id}`); assert.ok('net' in r.body); r = await call(1, `/api/legal/signature/${sig.id}.png`); assert.equal(r.status, 200); ok('staff with the agreements permission can look them up; a Trial Moderator cannot');

  r = await call(3, '/api/game/deposit', { amount: 10 }); assert.notEqual(r.status, 200);
  r = await call(3, '/api/legal/accept', { doc: 'cds', version: D.cds.v, ...SIGN }); assert.equal(r.status, 200); assert.equal(r.body.pack, 'cds');
  r = await call(3, '/api/me'); assert.equal(r.body.legal.cds, true); ok('the Currency Deduction Service is signed on its own before depositing');

  r = await call(3, '/api/legal/sign', { docs: ['business'], ...SIGN }); r = await call(3, '/api/me'); assert.equal(r.body.legal.business, true); ok('creators sign the Business agreement');

  r = await call(2, '/api/legal/accept', { doc: 'tos', version: D.tos.v }); assert.equal(r.status, 400); ok('a checkbox alone no longer accepts the Terms');

  console.log(`\nAll ${n} checks passed.`); server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
