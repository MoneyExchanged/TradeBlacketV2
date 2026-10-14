// TradeBlacket server.
//
// What it does
//   - Signs players in by Roblox profile bio                  POST /api/auth/start, /api/auth/verify
//   - Moves Rodux between a player's Trade Empire save and the site    /api/game/*   (gamebridge.js)
//   - Moves limiteds between a save and the site, and runs item flips  /api/items/*, /api/flips/* (items.js)
//   - Responsible-play limits a player sets on themselves              /api/limits/*  (limits.js)
//   - Records which version of the Terms, License and Deduction Service a player accepted
//   - Serves the website from ./public
//
// The game itself takes no part: everything goes through Roblox Open Cloud while the player is
// out of the game. The signed endpoints below are what the game's old SiteWallet bridge called.
// That bridge is switched off; they stay so that any transfer it started before can still finish.
//
// Signed game endpoints, matching ReplicatedStorage.Modules.SiteWalletRules:
//   - Body is {idempotency_key, roblox_user_id, amount}, signed as lowercase hex HMAC-SHA256 of the
//     raw body in the X-TE-Signature header, keyed with GAME_WEBHOOK_SECRET.
//   - 200/201 with a JSON body = applied. Any other 4xx (except 408/409/425/429) = refused for good,
//     and the game hands a refused deposit back. 5xx = the game asks again later with the same key.
//   - Every key is applied once. A repeat gets the same answer it got the first time.
//   - A withdrawal can never exceed what that player deposited minus what they already withdrew.
//
// Requires Node 22.5+ (uses the built-in node:sqlite). No npm packages.
'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const CFG = {
  port: Number(process.env.PORT || 8080),
  secret: process.env.GAME_WEBHOOK_SECRET || '',
  db: process.env.DB_PATH || path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname, 'tradeblacket.db'),
  publicDir: process.env.PUBLIC_DIR || path.join(__dirname, 'public'),
  cookieSecure: process.env.COOKIE_SECURE !== 'false',
  maxBody: 4096,
};
if (CFG.secret.length < 16) {
  console.error('GAME_WEBHOOK_SECRET must be set (16+ characters) and match SECRET in ServerStorage.SiteWalletConfig.');
  process.exit(1);
}

/* ---------- storage ---------- */
const db = new DatabaseSync(CFG.db);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    roblox_id INTEGER PRIMARY KEY,
    username TEXT,
    balance INTEGER NOT NULL DEFAULT 0,      -- Rodux on the site, whole units
    bonus_lock INTEGER NOT NULL DEFAULT 0,   -- bonus Rodux that must be wagered before withdrawal
    deposited INTEGER NOT NULL DEFAULT 0,    -- confirmed in from the game, all time
    withdrawn INTEGER NOT NULL DEFAULT 0,    -- confirmed back to the game, all time
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transfers (
    idempotency_key TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('deposit','withdraw')),
    roblox_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ok','refused')),
    status_code INTEGER NOT NULL,
    reference TEXT,
    reason TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS transfers_user ON transfers (roblox_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS challenges (
    token TEXT PRIMARY KEY, roblox_id INTEGER NOT NULL, username TEXT NOT NULL, phrase TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, roblox_id INTEGER NOT NULL, created_at INTEGER NOT NULL
  );
`);
{ const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('tos_version')) db.exec('ALTER TABLE users ADD COLUMN tos_version TEXT');
  if (!cols.includes('cds_version')) db.exec('ALTER TABLE users ADD COLUMN cds_version TEXT'); }
// Bump these when a document changes in a way players must agree to again.
const LEGAL = { tos: '2026-10-14.2', cds: '2026-10-14' }; // tos .2: TradeBlacket is 18+
const now = () => Date.now();
const tx = fn => { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
const q = {
  user: db.prepare('SELECT * FROM users WHERE roblox_id = ?'),
  addUser: db.prepare('INSERT OR IGNORE INTO users (roblox_id, username, created_at) VALUES (?, ?, ?)'),
  setName: db.prepare('UPDATE users SET username = ? WHERE roblox_id = ?'),
  credit: db.prepare('UPDATE users SET balance = balance + ?, deposited = deposited + ? WHERE roblox_id = ?'),
  debit: db.prepare('UPDATE users SET balance = balance - ?, withdrawn = withdrawn + ? WHERE roblox_id = ?'),
  transfer: db.prepare('SELECT * FROM transfers WHERE idempotency_key = ?'),
  addTransfer: db.prepare('INSERT INTO transfers (idempotency_key, kind, roblox_id, amount, status, status_code, reference, reason, created_at) VALUES (?,?,?,?,?,?,?,?,?)'),
  recent: db.prepare('SELECT kind, amount, status, reference, reason, created_at FROM transfers WHERE roblox_id = ? ORDER BY created_at DESC LIMIT 25'),
  addChallenge: db.prepare('INSERT INTO challenges (token, roblox_id, username, phrase, created_at) VALUES (?,?,?,?,?)'),
  challenge: db.prepare('SELECT * FROM challenges WHERE token = ?'),
  dropChallenge: db.prepare('DELETE FROM challenges WHERE token = ?'),
  addSession: db.prepare('INSERT INTO sessions (token, roblox_id, created_at) VALUES (?,?,?)'),
  session: db.prepare('SELECT * FROM sessions WHERE token = ?'),
  dropSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
};

/* ---------- the game's rules, mirrored ---------- */
const withdrawable = u => Math.max(0, Math.min(u.balance - u.bonus_lock, u.deposited - u.withdrawn));
const reference = kind => (kind === 'deposit' ? 'TBD-' : 'TBW-') + crypto.randomBytes(5).toString('hex').toUpperCase();

function verifySignature(raw, header) {
  if (typeof header !== 'string' || !/^[0-9a-f]{64}$/.test(header)) return false;
  const expected = crypto.createHmac('sha256', CFG.secret).update(raw).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(header, 'hex'));
}
function parseTransfer(raw) {
  let b;
  try { b = JSON.parse(raw.toString('utf8')); } catch { return null; }
  if (!b || typeof b !== 'object') return null;
  const key = b.idempotency_key, uid = b.roblox_user_id, amount = b.amount;
  if (typeof key !== 'string' || key.length < 1 || key.length > 64) return null;
  if (!Number.isSafeInteger(uid) || uid < 1) return null;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1e12) return null;
  return { key, uid, amount };
}
// The answer a key got the first time, sent again for a repeat.
function replay(res, t, t2) {
  if (t.kind !== t2.kind || t.roblox_id !== t2.uid || t.amount !== t2.amount) {
    // Same key, different transfer: a bug on the sender's side. Refused, never applied.
    return send(res, 422, { error: 'This transfer id was already used for a different transfer' });
  }
  if (t.status === 'ok') return send(res, 200, { reference: t.reference, duplicate: true });
  return send(res, t.status_code, { error: t.reason });
}

function handleDeposit(res, raw) {
  const t = parseTransfer(raw);
  if (!t) return send(res, 400, { error: 'Malformed transfer' });
  const result = tx(() => {
    const seen = q.transfer.get(t.key);
    if (seen) return { replay: seen };
    // A deposit for a player who has never signed in still lands: their account is their Roblox
    // id, and it is waiting for them when they first verify on the site. Refusing would bounce
    // the Rodux back for no reason.
    q.addUser.run(t.uid, null, now());
    q.credit.run(t.amount, t.amount, t.uid);
    const ref = reference('deposit');
    q.addTransfer.run(t.key, 'deposit', t.uid, t.amount, 'ok', 200, ref, null, now());
    return { ref };
  });
  if (result.replay) return replay(res, result.replay, { ...t, kind: 'deposit' });
  log('deposit', t.uid, t.amount, result.ref);
  return send(res, 200, { reference: result.ref });
}

function handleWithdraw(res, raw) {
  const t = parseTransfer(raw);
  if (!t) return send(res, 400, { error: 'Malformed transfer' });
  const result = tx(() => {
    const seen = q.transfer.get(t.key);
    if (seen) return { replay: seen };
    const u = q.user.get(t.uid);
    const refuse = (code, reason) => { q.addTransfer.run(t.key, 'withdraw', t.uid, t.amount, 'refused', code, null, reason, now()); return { code, reason }; };
    if (!u) return refuse(404, 'No TradeBlacket account for this player');
    const can = withdrawable(u);
    if (t.amount > can) return refuse(422, can > 0 ? `Only ${can} Rodux can be withdrawn right now` : 'No Rodux available to withdraw');
    q.debit.run(t.amount, t.amount, t.uid);
    const ref = reference('withdraw');
    q.addTransfer.run(t.key, 'withdraw', t.uid, t.amount, 'ok', 200, ref, null, now());
    return { ref };
  });
  if (result.replay) return replay(res, result.replay, { ...t, kind: 'withdraw' });
  if (result.code) { log('withdraw refused', t.uid, t.amount, result.reason); return send(res, result.code, { error: result.reason }); }
  log('withdraw', t.uid, t.amount, result.ref);
  return send(res, 200, { reference: result.ref });
}

/* ---------- sign-in by Roblox bio ---------- */
const WORDS = ['amber','harbor','otter','quiet','copper','lantern','maple','orbit','velvet','cobalt','meadow','tundra','pixel','summit','ember','willow','fable','granite'];
const pickWord = () => WORDS[crypto.randomInt(WORDS.length)];
async function robloxUserByName(name) {
  const r = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [name], excludeBannedUsers: true }),
  });
  if (!r.ok) throw new Error('roblox ' + r.status);
  const j = await r.json();
  return j.data && j.data[0] ? { id: j.data[0].id, name: j.data[0].name } : null;
}
async function robloxDescription(id) {
  const r = await fetch(`https://users.roblox.com/v1/users/${id}`);
  if (!r.ok) throw new Error('roblox ' + r.status);
  return (await r.json()).description || '';
}
async function authStart(req, res) {
  const b = await readJson(req);
  const name = b && typeof b.username === 'string' ? b.username.trim() : '';
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return send(res, 400, { error: 'Roblox usernames are 3 to 20 letters, numbers or underscores.' });
  let u;
  try { u = await robloxUserByName(name); } catch { return send(res, 502, { error: 'Roblox did not answer. Try again in a moment.' }); }
  if (!u) return send(res, 404, { error: 'No Roblox account has that username.' });
  const phrase = `TB ${pickWord()} ${pickWord()} ${pickWord()} ${crypto.randomInt(10, 100)}`;
  const token = crypto.randomBytes(24).toString('hex');
  q.addChallenge.run(token, u.id, u.name, phrase, now());
  return send(res, 200, { token, phrase, username: u.name, robloxId: u.id });
}
async function authVerify(req, res) {
  const b = (await readJson(req)) || {};
  const c = b && typeof b.token === 'string' ? q.challenge.get(b.token) : null;
  if (!c || now() - c.created_at > 15 * 60e3) return send(res, 410, { error: 'That phrase has expired. Start again.' });
  let desc;
  try { desc = await robloxDescription(c.roblox_id); } catch { return send(res, 502, { error: 'Roblox did not answer. Try again in a moment.' }); }
  if (!desc.includes(c.phrase)) return send(res, 409, { error: 'The phrase is not in your About section yet. Save it on Roblox, then verify again.' });
  q.dropChallenge.run(c.token);
  tx(() => { q.addUser.run(c.roblox_id, c.username, now()); q.setName.run(c.username, c.roblox_id); if (b.acceptTos === LEGAL.tos) db.prepare('UPDATE users SET tos_version = ? WHERE roblox_id = ?').run(LEGAL.tos, c.roblox_id); });
  const token = crypto.randomBytes(32).toString('hex');
  q.addSession.run(token, c.roblox_id, now());
  res.setHeader('Set-Cookie', `tb_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${CFG.cookieSecure ? '; Secure' : ''}`);
  return send(res, 200, { ok: true, username: c.username, robloxId: c.roblox_id });
}
function sessionUser(req) {
  const m = /(?:^|;\s*)tb_session=([0-9a-f]{64})/.exec(req.headers.cookie || '');
  const s = m && q.session.get(m[1]);
  return s ? { token: m[1], user: q.user.get(s.roblox_id) } : null;
}
function me(req, res) {
  const s = sessionUser(req);
  if (!s || !s.user) return send(res, 401, { error: 'Not signed in' });
  const u = s.user;
  return send(res, 200, {
    robloxId: u.roblox_id, username: u.username, balance: u.balance, bonusLock: u.bonus_lock,
    deposited: u.deposited, withdrawn: u.withdrawn, withdrawable: withdrawable(u),
    legal: { tos: u.tos_version === LEGAL.tos, cds: u.cds_version === LEGAL.cds, versions: LEGAL },
    limits: limits.status(u.roblox_id), itemValue: items.siteItemValue(u.roblox_id),
    studio: provider.recent(u.roblox_id), slots: waitlist.status(u.roblox_id),
    // in-game transfers and website (offline) transfers together, newest first
    transfers: q.recent.all(u.roblox_id).concat(db.prepare("SELECT kind, amount, CASE status WHEN 'ok' THEN 'ok' ELSE 'refused' END AS status, id AS reference, note AS reason, created_at FROM offline_transfers WHERE roblox_id = ? AND status != 'staged' ORDER BY created_at DESC LIMIT 25").all(u.roblox_id))
      .sort((a, b) => b.created_at - a.created_at).slice(0, 25),
  });
}
function logout(req, res) {
  const s = sessionUser(req);
  if (s) q.dropSession.run(s.token);
  res.setHeader('Set-Cookie', 'tb_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return send(res, 200, { ok: true });
}

/* ---------- offline transfers (website <-> Trade Empire save, through Roblox Open Cloud) ---------- */
// Deposits need the Deduction Service accepted; everything except withdrawals respects limits.
function guard(robloxId, kind, amount) {
  const u = q.user.get(robloxId);
  if ((kind === 'deposit' || kind === 'items') && (!u || u.cds_version !== LEGAL.cds)) return 'Please read and accept the Trade Empire Currency Deduction Service first.';
  if (kind !== 'withdraw' && (!u || u.tos_version !== LEGAL.tos)) return 'Please accept the Terms of Service and License Agreement first.';
  return limits.guard(robloxId, kind, amount);
}
const bridge = require('./gamebridge.js').create({
  db, tx, log: (...a) => log(...a), guard: (...a) => guard(...a),
  siteWithdrawable: robloxId => { const u = q.user.get(robloxId); return u ? withdrawable(u) : 0; }
});
const items = require('./items.js').create({ db, tx, log: (...a) => log(...a), guard: (...a) => guard(...a) });
const limits = require('./limits.js').create({ db, tx });
// Studio games (LuckyStreak) on the Rodux balance, through a signed seamless wallet. Off until configured.
const waitlist = require('./waitlist.js').create({ db, tx });
async function waitlistRoute(req, res, p) {
  if (req.method === 'GET' && p === '/api/waitlist') { const s = sessionUser(req); return send(res, 200, waitlist.status(s && s.user ? s.user.roblox_id : null)); }
  const u = authed(req, res); if (!u) return;
  const b = (await readJson(req)) || {};
  try {
    if (req.method === 'POST' && p === '/api/waitlist/join') return send(res, 200, waitlist.join(u.roblox_id));
    if (req.method === 'POST' && p === '/api/waitlist/redeem') return send(res, 200, waitlist.redeem(u.roblox_id, b.code));
    if (req.method === 'GET' && p === '/api/admin/waitlist') return send(res, 200, waitlist.adminView(u.roblox_id));
    if (req.method === 'POST' && p === '/api/admin/codes') return send(res, 200, waitlist.makeCodes(u.roblox_id, b.count, b.uses, b.note));
    if (req.method === 'POST' && p === '/api/admin/grant') return send(res, 200, waitlist.grantNext(u.roblox_id, b.count));
    if (req.method === 'POST' && p === '/api/admin/revoke') return send(res, 200, waitlist.revoke(u.roblox_id, b.robloxId));
  } catch (e) { if (e instanceof waitlist.WaitError) return send(res, e.code, { error: e.message }); throw e; }
  return send(res, 404, { error: 'Not found' });
}
const provider = require('./provider.js').create({ db, tx, log: (...a) => log(...a), guard: (...a) => guard(...a), limits });
async function gamesLaunch(req, res) {
  const u = authed(req, res); if (!u) return;
  const b = (await readJson(req)) || {};
  if (!b.gameId || String(b.gameId).length > 100) return send(res, 400, { error: 'Pick a game.' });
  if (!waitlist.hasAccess(u.roblox_id)) return send(res, 403, { error: 'Slots are invite-only for now. Join the waitlist or enter an access code.', waitlist: true });
  try { return send(res, 200, await provider.launch(u.roblox_id, u.username, b.gameId, !!b.mobile)); }
  catch (e) {
    if (e instanceof provider.WalletError) return send(res, e.http >= 400 ? e.http : 403, { error: e.message, limit: e.walletCode === 'PLAYER_LIMIT' });
    log('launch', e.message); return send(res, 502, { error: 'The game could not be started. Try again in a moment.' });
  }
}

/* ---------- player routes that need a session ---------- */
function authed(req, res) { const s = sessionUser(req); if (!s || !s.user) { send(res, 401, { error: 'Not signed in' }); return null; } return s.user; }
async function run(res, fn) {
  try { return send(res, 200, await fn()); }
  catch (e) {
    if (e instanceof bridge.BridgeError) return send(res, e.code, { error: e.message, ...(e.extra || {}) });
    log('route', (e && e.stack) || e);
    return send(res, 500, { error: 'Something went wrong. Nothing was moved.' });
  }
}
const busyItems = new Set();
async function itemsRoute(req, res, p) {
  const u = authed(req, res); if (!u) return;
  const id = u.roblox_id, name = u.username || String(id);
  if (req.method === 'GET' && p === '/api/items/save') return run(res, () => items.saveInventory(id));
  if (req.method === 'GET' && p === '/api/items/site') return run(res, () => items.siteInventory(id));
  if (req.method === 'GET' && p === '/api/flips') return run(res, () => items.flipList(id));
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const b = (await readJson(req)) || {};
  if (p === '/api/flips/cancel') return run(res, () => items.flipCancel(id, b.id));
  if (busyItems.has(id)) return send(res, 409, { error: 'Your last item action is still finishing.' });
  busyItems.add(id);
  try {
    if (p === '/api/items/deposit') return await run(res, () => items.deposit(id, b.tokens));
    if (p === '/api/items/withdraw') return await run(res, () => items.withdraw(id, b.uids));
    if (p === '/api/flips/create') return await run(res, () => items.flipCreate(id, name, b.uids, b.side));
    if (p === '/api/flips/join') return await run(res, () => items.flipJoin(id, name, b.id, b.uids));
    return send(res, 404, { error: 'Not found' });
  } finally { busyItems.delete(id); }
}
async function limitsRoute(req, res, p) {
  const u = authed(req, res); if (!u) return;
  if (req.method === 'GET' && p === '/api/limits') return send(res, 200, limits.status(u.roblox_id));
  const b = (await readJson(req)) || {};
  if (req.method === 'POST' && p === '/api/limits/heartbeat') return send(res, 200, limits.heartbeat(u.roblox_id, b.seconds, b.net));
  if (req.method === 'POST' && p === '/api/limits') { try { return send(res, 200, limits.update(u.roblox_id, b)); } catch (e) { return send(res, 400, { error: e.message }); } }
  return send(res, 404, { error: 'Not found' });
}
async function legalRoute(req, res) {
  const u = authed(req, res); if (!u) return;
  const b = (await readJson(req)) || {};
  if (b.doc === 'tos' && b.version === LEGAL.tos) db.prepare('UPDATE users SET tos_version = ? WHERE roblox_id = ?').run(LEGAL.tos, u.roblox_id);
  else if (b.doc === 'cds' && b.version === LEGAL.cds) db.prepare('UPDATE users SET cds_version = ? WHERE roblox_id = ?').run(LEGAL.cds, u.roblox_id);
  else return send(res, 400, { error: 'Unknown document or version.' });
  log('accepted', b.doc, b.version, u.roblox_id);
  return send(res, 200, { ok: true });
}
const moving = new Set();
async function gameWallet(req, res) {
  const s = sessionUser(req); if (!s || !s.user) return send(res, 401, { error: 'Not signed in' });
  try { return send(res, 200, await bridge.status(s.user.roblox_id)); }
  catch (e) { log('game wallet', e.message); return send(res, 502, { error: 'Could not read your Trade Empire save right now.' }); }
}
async function gameMove(req, res, kind) {
  const s = sessionUser(req); if (!s || !s.user) return send(res, 401, { error: 'Not signed in' });
  const b = await readJson(req), amount = b ? Number(b.amount) : NaN, id = s.user.roblox_id;
  if (moving.has(id)) return send(res, 409, { error: 'Your last transfer is still finishing.' });
  moving.add(id);
  try { const r = await bridge[kind](id, amount); return send(res, 200, r); }
  catch (e) { if (e instanceof bridge.BridgeError) return send(res, e.code, { error: e.message, ...(e.extra || {}) }); log('game move', e.stack || e); return send(res, 500, { error: 'Something went wrong. Nothing was moved.' }); }
  finally { moving.delete(id); }
}

/* ---------- item icons ---------- */
// /img/asset/<id> redirects to the current Roblox icon for that asset. Roblox's icon links expire,
// so they are looked up on demand, batched, and cached for six hours.
const icons = new Map(); let iconQueue = new Map(), iconTimer = null;
function iconUrl(id) {
  const c = icons.get(id);
  if (c && Date.now() - c.at < 6 * 36e5) return Promise.resolve(c.url);
  return new Promise(resolve => {
    if (!iconQueue.has(id)) iconQueue.set(id, []);
    iconQueue.get(id).push(resolve);
    if (!iconTimer) iconTimer = setTimeout(flushIcons, 60);
  });
}
async function flushIcons() {
  const batch = iconQueue; iconQueue = new Map(); iconTimer = null;
  const ids = [...batch.keys()];
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100); let found = {};
    try {
      const r = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${part.join(',')}&returnPolicy=PlaceHolder&size=420x420&format=Webp&isCircular=false`);
      if (r.ok) for (const x of (await r.json()).data || []) if (x.imageUrl) found[x.targetId] = x.imageUrl;
    } catch (e) { log('icons', e.message); }
    for (const id of part) { const url = found[id] || null; if (url) icons.set(id, { url, at: Date.now() }); batch.get(id).forEach(f => f(url)); }
  }
}
async function assetImage(req, res, raw) {
  if (!/^\d{1,20}$/.test(raw)) return send(res, 404, { error: 'Not found' });
  const url = await iconUrl(raw);
  if (!url) return send(res, 404, { error: 'No icon' });
  res.writeHead(302, { Location: url, 'Cache-Control': 'public, max-age=21600' });
  return res.end();
}

/* ---------- http plumbing ---------- */
function send(res, code, body) {
  if (res.headersSent) return;
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function log(...a) { console.log(new Date().toISOString(), ...a); }
function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > CFG.maxBody) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) { try { return JSON.parse((await readRaw(req)).toString('utf8')); } catch { return null; } }
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.md': 'text/plain; charset=utf-8' };
function serveStatic(req, res) {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.normalize(path.join(CFG.publicDir, url === '/' ? 'index.html' : url));
  if (!file.startsWith(CFG.publicDir)) return send(res, 404, { error: 'Not found' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(CFG.publicDir, 'index.html');
  if (!fs.existsSync(file)) return send(res, 404, { error: 'Not found' });
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const p = new URL(req.url, 'http://x').pathname;
    if (req.method === 'POST' && (p === '/api/public/game/rodux-deposits' || p === '/api/public/game/rodux-withdrawals')) {
      let raw;
      try { raw = await readRaw(req); } catch { return send(res, 413, { error: 'Body too large' }); }
      if (!verifySignature(raw, req.headers['x-te-signature'])) { log('bad signature', p); return send(res, 401, { error: 'Bad signature' }); }
      return p.endsWith('deposits') ? handleDeposit(res, raw) : handleWithdraw(res, raw);
    }
    if (req.method === 'POST' && p.startsWith('/api/provider/luckystreak/')) {
      let raw;
      try { raw = await readRaw(req); } catch { return send(res, 413, { error: 'Body too large' }); }
      const r = await provider.handle(req, raw, p.slice('/api/provider/luckystreak/'.length));
      return send(res, r.http, r.body);
    }
    if (req.method === 'GET' && p === '/api/games') { try { return send(res, 200, await provider.games()); } catch (e) { log('games', e.message); return send(res, 200, { enabled: true, games: [], error: 'Games are loading. Try again shortly.' }); } }
    if (req.method === 'POST' && p === '/api/games/launch') return await gamesLaunch(req, res);
    if (p === '/api/waitlist' || p.startsWith('/api/waitlist/') || p.startsWith('/api/admin/')) return await waitlistRoute(req, res, p);
    if (req.method === 'POST' && p === '/api/auth/start') return await authStart(req, res);
    if (req.method === 'POST' && p === '/api/auth/verify') return await authVerify(req, res);
    if (req.method === 'POST' && p === '/api/auth/logout') return logout(req, res);
    if (req.method === 'GET' && p === '/api/me') return me(req, res);
    if (req.method === 'GET' && p === '/api/health') return send(res, 200, { ok: true, storage: CFG.db.startsWith('/data') || (process.env.RAILWAY_VOLUME_MOUNT_PATH && CFG.db.startsWith(process.env.RAILWAY_VOLUME_MOUNT_PATH)) ? 'volume' : 'local', offlineTransfers: bridge.enabled(), studioGames: provider.enabled() });
    if (req.method === 'GET' && p === '/api/game/wallet') return await gameWallet(req, res);
    if (p.startsWith('/api/items/') || p === '/api/flips' || p.startsWith('/api/flips/')) return await itemsRoute(req, res, p);
    if (p === '/api/limits' || p.startsWith('/api/limits/')) return await limitsRoute(req, res, p);
    if (req.method === 'POST' && p === '/api/legal/accept') return await legalRoute(req, res);
    if (req.method === 'POST' && p === '/api/game/deposit') return await gameMove(req, res, 'deposit');
    if (req.method === 'POST' && p === '/api/game/withdraw') return await gameMove(req, res, 'withdraw');
    if (p.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (req.method === 'GET' && p.startsWith('/img/asset/')) return await assetImage(req, res, p.slice(11));
    if (req.method === 'GET') return serveStatic(req, res);
    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    log('error', e && e.stack || e);
    // 5xx: the game treats this as "ask again later", which is the only safe answer when the
    // transaction may not have finished.
    return send(res, 500, { error: 'Server error' });
  }
});
if (require.main === module) server.listen(CFG.port, () => log(`TradeBlacket server on :${CFG.port} · database ${CFG.db} · offline transfers ${bridge.enabled() ? 'on' : 'off (no ROBLOX_OPEN_CLOUD_KEY)'}`));
module.exports = { server, db };
