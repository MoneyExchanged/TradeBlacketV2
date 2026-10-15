// Provably fair numbers, with client seed automation.
//
// Every player has a seed pair: a secret server seed (only its SHA-256 hash is shown) and a client
// seed the player controls. Each nonce gives 64 numbers in [0, 1):
//
//   for cursor 0..7:  HMAC-SHA256(key = serverSeed, message = `${clientSeed}:${nonce}:${cursor}`)
//   each 32-byte digest gives 8 numbers, 4 bytes each:  b0/256 + b1/256^2 + b2/256^3 + b3/256^4
//
// Games on the site take numbers from this stream in order. When the pair is rotated the server seed
// is revealed, so anyone can recompute every number and check it against the hash shown beforehand.
// The hash of the NEXT server seed is shown too, so the player knows it before it is used.
//
// Automation (per player): rotate after N nonces or once a day, and pick a fresh random client seed
// at every rotation (or keep the player's own). Rotation happens on the server before a batch.
'use strict';
const crypto = require('node:crypto');

const PER_NONCE = 64, CURSORS = 8;
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const randSeed = () => crypto.randomBytes(32).toString('hex');
const randClient = () => crypto.randomBytes(10).toString('base64url');

// The 64 numbers for one nonce (shared with the browser's verifier, same maths).
function floats(serverSeed, clientSeed, nonce) {
  const out = [];
  for (let c = 0; c < CURSORS; c++) {
    const d = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${c}`).digest();
    for (let i = 0; i < 32; i += 4) out.push(d[i] / 256 + d[i + 1] / 65536 + d[i + 2] / 16777216 + d[i + 3] / 4294967296);
  }
  return out;
}

class FairError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }

function create({ db, tx }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fair_pairs (id INTEGER PRIMARY KEY AUTOINCREMENT, roblox_id INTEGER NOT NULL, server_seed TEXT NOT NULL, server_hash TEXT NOT NULL,
      client_seed TEXT NOT NULL, nonce INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, revealed_at INTEGER, reason TEXT);
    CREATE INDEX IF NOT EXISTS fair_pairs_user ON fair_pairs (roblox_id, id DESC);
    CREATE TABLE IF NOT EXISTS fair_settings (roblox_id INTEGER PRIMARY KEY, next_seed TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'nonces', every INTEGER NOT NULL DEFAULT 1000, auto_client INTEGER NOT NULL DEFAULT 1);
  `);
  const q = {
    active: db.prepare('SELECT * FROM fair_pairs WHERE roblox_id = ? AND revealed_at IS NULL ORDER BY id DESC LIMIT 1'),
    add: db.prepare('INSERT INTO fair_pairs (roblox_id, server_seed, server_hash, client_seed, created_at) VALUES (?,?,?,?,?)'),
    reveal: db.prepare('UPDATE fair_pairs SET revealed_at = ?, reason = ? WHERE id = ?'),
    bump: db.prepare('UPDATE fair_pairs SET nonce = nonce + ? WHERE id = ?'),
    history: db.prepare('SELECT * FROM fair_pairs WHERE roblox_id = ? AND revealed_at IS NOT NULL ORDER BY id DESC LIMIT ?'),
    settings: db.prepare('SELECT * FROM fair_settings WHERE roblox_id = ?'),
    addSettings: db.prepare('INSERT OR IGNORE INTO fair_settings (roblox_id, next_seed) VALUES (?, ?)'),
    setNext: db.prepare('UPDATE fair_settings SET next_seed = ? WHERE roblox_id = ?'),
    setAuto: db.prepare('UPDATE fair_settings SET mode = ?, every = ?, auto_client = ? WHERE roblox_id = ?'),
  };
  const now = () => Date.now();
  const settings = id => { q.addSettings.run(id, randSeed()); return q.settings.get(id); };
  function pair(id) {
    let p = q.active.get(id);
    if (!p) { const s = settings(id); q.add.run(id, s.next_seed, sha256(s.next_seed), randClient(), now()); q.setNext.run(randSeed(), id); p = q.active.get(id); }
    return p;
  }
  // Reveal the current server seed and start the next pair.
  function rotate(id, clientSeed, reason = 'player') {
    return tx(() => {
      const p = pair(id), s = settings(id);
      q.reveal.run(now(), reason, p.id);
      const cs = clientSeed != null ? cleanSeed(clientSeed) : (s.auto_client ? randClient() : p.client_seed);
      q.add.run(id, s.next_seed, sha256(s.next_seed), cs, now()); q.setNext.run(randSeed(), id);
      return revealed(q.history.all(id, 1)[0]);
    });
  }
  const revealed = p => ({ serverSeed: p.server_seed, serverSeedHash: p.server_hash, clientSeed: p.client_seed, nonces: p.nonce, createdAt: p.created_at, revealedAt: p.revealed_at, reason: p.reason });
  function cleanSeed(s) {
    s = String(s == null ? '' : s).trim();
    if (!/^[\x21-\x7e]{1,64}$/.test(s)) throw new FairError('A client seed is 1 to 64 letters, numbers or symbols, without spaces.');
    return s;
  }
  function state(id) {
    const p = pair(id), s = settings(id);
    return { serverSeedHash: p.server_hash, nextServerSeedHash: sha256(s.next_seed), clientSeed: p.client_seed, nonce: p.nonce, since: p.created_at,
      auto: { mode: s.mode, every: s.every, autoClient: !!s.auto_client }, perNonce: PER_NONCE,
      history: q.history.all(id, 20).map(revealed) };
  }
  // The next `rounds` nonces of numbers. Automation runs first.
  function batch(id, rounds) {
    rounds = Math.max(1, Math.min(16, Math.floor(Number(rounds) || 1)));
    let rotated = null;
    const s = settings(id), p0 = pair(id);
    if ((s.mode === 'nonces' && p0.nonce >= s.every) || (s.mode === 'daily' && now() - p0.created_at >= 864e5)) rotated = rotate(id, null, 'auto');
    return tx(() => {
      const p = pair(id), out = [];
      for (let i = 0; i < rounds; i++) out.push({ nonce: p.nonce + i, floats: floats(p.server_seed, p.client_seed, p.nonce + i) });
      q.bump.run(rounds, p.id);
      return { serverSeedHash: p.server_hash, clientSeed: p.client_seed, rounds: out, rotated };
    });
  }
  function setClient(id, seed) { const r = rotate(id, cleanSeed(seed), 'new client seed'); return { ...state(id), revealed: r }; }
  function setAuto(id, b) {
    const mode = ['off', 'nonces', 'daily'].includes(b.mode) ? b.mode : 'nonces';
    const every = Math.max(10, Math.min(1e6, Math.floor(Number(b.every) || 1000)));
    settings(id); q.setAuto.run(mode, every, b.autoClient === false ? 0 : 1, id);
    return state(id);
  }
  // Anyone can check numbers once a seed is revealed.
  function verify(serverSeed, clientSeed, nonce) {
    serverSeed = String(serverSeed || ''); if (!/^[0-9a-f]{64}$/.test(serverSeed)) throw new FairError('A server seed is 64 hex characters.');
    const n = Math.floor(Number(nonce)); if (!(n >= 0)) throw new FairError('Enter a nonce of 0 or more.');
    return { serverSeedHash: sha256(serverSeed), clientSeed: cleanSeed(clientSeed), nonce: n, floats: floats(serverSeed, cleanSeed(clientSeed), n) };
  }
  return { state, batch, rotate: (id, seed) => { const revealed = rotate(id, seed == null || seed === '' ? null : seed); return { ...state(id), revealed }; }, setClient, setAuto, verify, FairError };
}

module.exports = { create, floats, PER_NONCE };
