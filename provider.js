// Third-party casino games (LuckyStreak) on the TradeBlacket Rodux balance.
//
// LuckyStreak runs the games; TradeBlacket keeps the money. It is a seamless ("single") wallet:
// every bet, win and refund in a LuckyStreak game is a signed call from LuckyStreak to the
// wallet endpoints below, and the Rodux balance on this server is the only balance there is.
//
//   POST /api/provider/luckystreak/balance   { session|player }                     -> balance
//   POST /api/provider/luckystreak/debit     { session|player, transaction, round, amount, game }
//   POST /api/provider/luckystreak/credit    { session|player, transaction, round, amount, game }
//   POST /api/provider/luckystreak/rollback  { session|player, transaction, reference, round }
//
// Safety:
//   - Every request must carry a valid Hawk Authorization header (LuckyStreak's "Hawk security
//     layer"), signed with the shared key, with a fresh timestamp and an unused nonce. When an IP
//     allowlist is set, only those addresses are accepted.
//   - Every transaction id is applied once. A repeat returns the first answer, so retries are safe.
//   - A rollback undoes a debit at most once. A rollback that arrives before its debit is stored,
//     and the late debit is then refused, so a bet can never be taken after it was refunded.
//   - Bets respect the player's responsible-play limits, the Terms acceptance and self-exclusion.
//   - Wins only ever add to the balance; deposits and withdrawals keep their own rules, so a
//     player can still only withdraw up to what they deposited.
//
// LuckyStreak shares its exact API document after signing. The field names it uses are read in
// one place, FIELDS below, and every answer is built in reply(); matching their document means
// editing those two, not the wallet logic.
'use strict';
const crypto = require('node:crypto');

const ENV = process.env;
const CFG = {
  name: 'luckystreak',
  apiUrl: (ENV.LUCKYSTREAK_API_URL || '').replace(/\/+$/, ''),     // their API base, from onboarding
  operatorId: ENV.LUCKYSTREAK_OPERATOR_ID || '',
  hawkId: ENV.LUCKYSTREAK_HAWK_ID || '',
  hawkKey: ENV.LUCKYSTREAK_HAWK_KEY || '',
  currency: ENV.LUCKYSTREAK_CURRENCY || 'RDX',                      // the code they assign to Rodux
  allowIps: (ENV.LUCKYSTREAK_ALLOW_IPS || '').split(',').map(s => s.trim()).filter(Boolean),
  launchPath: ENV.LUCKYSTREAK_LAUNCH_PATH || '/game/launch',
  gamesPath: ENV.LUCKYSTREAK_GAMES_PATH || '/games',
  lobbyUrl: ENV.PUBLIC_URL || '',
  skewSec: 60,
};
const enabled = () => !!(CFG.apiUrl && CFG.operatorId && CFG.hawkId && CFG.hawkKey);

// Where LuckyStreak's field names are read. Adjust to their document; the first match wins.
const FIELDS = {
  session: ['session', 'sessionToken', 'token', 'playerToken'],
  player: ['player', 'playerId', 'userId', 'username'],
  transaction: ['transaction', 'transactionId', 'txId', 'transactionUuid', 'id'],
  reference: ['reference', 'referenceTransactionId', 'refTransactionId', 'originalTransactionId'],
  round: ['round', 'roundId', 'gameRoundId'],
  amount: ['amount', 'betAmount', 'winAmount'],
  game: ['game', 'gameId', 'gameCode'],
};
const pick = (b, k) => { for (const f of FIELDS[k]) if (b && b[f] !== undefined && b[f] !== null && b[f] !== '') return b[f]; return undefined; };

class WalletError extends Error { constructor(code, msg, http = 200) { super(msg); this.walletCode = code; this.http = http; } }

/* ---------- Hawk (https://github.com/mozilla/hawk) ---------- */
function hawkParse(h) {
  if (!h || !/^Hawk\s/i.test(h)) return null;
  const out = {}; h.replace(/^Hawk\s+/i, '').replace(/(\w+)="([^"]*)"/g, (_, k, v) => { out[k] = v; });
  return out;
}
const payloadHash = (type, body) => crypto.createHash('sha256').update(`hawk.1.payload\n${(type || '').split(';')[0].trim().toLowerCase()}\n${body}\n`).digest('base64');
function hawkMac(key, a) {
  const norm = `hawk.1.header\n${a.ts}\n${a.nonce}\n${a.method.toUpperCase()}\n${a.resource}\n${a.host.toLowerCase()}\n${a.port}\n${a.hash || ''}\n${a.ext || ''}\n`;
  return crypto.createHmac('sha256', key).update(norm).digest('base64');
}
function hawkHeader(method, url, body, contentType = 'application/json') {
  const u = new URL(url), ts = Math.floor(Date.now() / 1000), nonce = crypto.randomBytes(6).toString('base64url');
  const hash = body != null ? payloadHash(contentType, body) : '';
  const mac = hawkMac(CFG.hawkKey, { ts, nonce, method, resource: u.pathname + u.search, host: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), hash });
  return `Hawk id="${CFG.hawkId}", ts="${ts}", nonce="${nonce}"${hash ? `, hash="${hash}"` : ''}, mac="${mac}"`;
}
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function create({ db, tx, log, guard, limits }) {
  db.exec(`CREATE TABLE IF NOT EXISTS provider_tx (
    provider TEXT NOT NULL, tx_id TEXT NOT NULL, kind TEXT NOT NULL, roblox_id INTEGER, amount INTEGER NOT NULL DEFAULT 0,
    round_id TEXT, game TEXT, ref_tx TEXT, status TEXT NOT NULL, response TEXT, created_at INTEGER NOT NULL,
    PRIMARY KEY (provider, tx_id))`);
  db.exec('CREATE INDEX IF NOT EXISTS provider_tx_user ON provider_tx (roblox_id, created_at)');
  db.exec(`CREATE TABLE IF NOT EXISTS provider_sessions (token TEXT PRIMARY KEY, roblox_id INTEGER NOT NULL, game TEXT, created_at INTEGER NOT NULL, last INTEGER NOT NULL)`);
  db.exec('CREATE TABLE IF NOT EXISTS provider_nonces (nonce TEXT PRIMARY KEY, at INTEGER NOT NULL)');
  const q = {
    user: db.prepare('SELECT * FROM users WHERE roblox_id = ?'),
    play: db.prepare('UPDATE users SET balance = balance + ? WHERE roblox_id = ?'),
    tx: db.prepare('SELECT * FROM provider_tx WHERE provider = ? AND tx_id = ?'),
    addTx: db.prepare('INSERT INTO provider_tx (provider, tx_id, kind, roblox_id, amount, round_id, game, ref_tx, status, response, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'),
    setTx: db.prepare('UPDATE provider_tx SET status = ? WHERE provider = ? AND tx_id = ?'),
    recent: db.prepare("SELECT tx_id, kind, amount, game, status, created_at FROM provider_tx WHERE roblox_id = ? AND kind IN ('debit','credit','rollback') AND status IN ('ok','rolled_back') ORDER BY created_at DESC LIMIT 50"),
    session: db.prepare('SELECT * FROM provider_sessions WHERE token = ?'),
    addSession: db.prepare('INSERT INTO provider_sessions (token, roblox_id, game, created_at, last) VALUES (?,?,?,?,?)'),
    touch: db.prepare('UPDATE provider_sessions SET last = ? WHERE token = ?'),
    nonce: db.prepare('INSERT OR IGNORE INTO provider_nonces (nonce, at) VALUES (?, ?)'),
    dropNonces: db.prepare('DELETE FROM provider_nonces WHERE at < ?'),
  };
  const now = () => Date.now();
  setInterval(() => q.dropNonces.run(now() - 10 * 60e3), 60e3).unref();

  /* ---------- verifying LuckyStreak's calls ---------- */
  function verify(req, raw) {
    if (CFG.allowIps.length) {
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().replace(/^::ffff:/, '');
      if (!CFG.allowIps.includes(ip)) throw new WalletError('FORBIDDEN', 'Address not allowed', 403);
    }
    const a = hawkParse(req.headers.authorization);
    if (!a || !a.id || !a.ts || !a.nonce || !a.mac) throw new WalletError('UNAUTHORIZED', 'Missing Hawk header', 401);
    if (!safeEq(a.id, CFG.hawkId)) throw new WalletError('UNAUTHORIZED', 'Unknown id', 401);
    if (Math.abs(now() / 1000 - Number(a.ts)) > CFG.skewSec) throw new WalletError('UNAUTHORIZED', 'Stale request', 401);
    const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
    const hostH = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
    const [host, portH] = hostH.split(':');
    const port = portH || (proto === 'https' ? 443 : 80);
    const body = raw ? raw.toString('utf8') : '';
    if (a.hash && !safeEq(a.hash, payloadHash(req.headers['content-type'], body))) throw new WalletError('UNAUTHORIZED', 'Body does not match', 401);
    if (!a.hash && body) throw new WalletError('UNAUTHORIZED', 'Body must be signed', 401);
    const mac = hawkMac(CFG.hawkKey, { ts: a.ts, nonce: a.nonce, method: req.method, resource: req.url, host, port, hash: a.hash, ext: a.ext });
    if (!safeEq(mac, a.mac)) throw new WalletError('UNAUTHORIZED', 'Bad signature', 401);
    if (!q.nonce.run(`${a.id}:${a.nonce}`, now()).changes) throw new WalletError('UNAUTHORIZED', 'Replayed request', 401);
  }

  /* ---------- the wallet ---------- */
  const balanceOf = id => { const u = q.user.get(id); return u ? Math.max(0, Math.floor(u.balance)) : 0; };
  function playerOf(b) {
    const token = pick(b, 'session');
    if (token) {
      const s = q.session.get(String(token));
      if (!s) throw new WalletError('INVALID_SESSION', 'Unknown session');
      q.touch.run(now(), s.token);
      return s.roblox_id;
    }
    const id = Number(pick(b, 'player'));
    if (!Number.isSafeInteger(id) || !q.user.get(id)) throw new WalletError('INVALID_PLAYER', 'Unknown player');
    return id;
  }
  function amountOf(b) {
    const a = Number(pick(b, 'amount'));
    if (!Number.isFinite(a) || a < 0 || a > 1e12) throw new WalletError('INVALID_AMOUNT', 'Bad amount');
    if (!Number.isInteger(a)) throw new WalletError('INVALID_AMOUNT', 'Rodux has no decimals');
    return a;
  }
  const reply = (id, txId, extra = {}) => ({ status: 'OK', balance: balanceOf(id), currency: CFG.currency, transaction: txId, ...extra });
  // Applies one transaction exactly once; a repeat gets the stored answer back.
  function once(txId, fn) {
    if (!txId) throw new WalletError('INVALID_TRANSACTION', 'Missing transaction id');
    const prev = q.tx.get(CFG.name, String(txId));
    if (prev && prev.response) return JSON.parse(prev.response);
    return fn(prev);
  }

  function balance(b) { const id = playerOf(b); return { status: 'OK', balance: balanceOf(id), currency: CFG.currency }; }

  function debit(b) {
    const id = playerOf(b), amount = amountOf(b), txId = String(pick(b, 'transaction') || ''), round = pick(b, 'round'), game = pick(b, 'game');
    return once(txId, prev => {
      if (prev && prev.kind === 'rollback-first') {   // refunded before it arrived: never take it
        const r = { status: 'ERROR', code: 'TRANSACTION_ROLLED_BACK', balance: balanceOf(id), currency: CFG.currency, transaction: txId };
        q.setTx.run('refused', CFG.name, txId); return r;
      }
      const why = guard(id, 'bet', amount);
      if (why) throw new WalletError('PLAYER_LIMIT', typeof why === 'string' ? why : 'Play is paused for this player');
      return tx(() => {
        const u = q.user.get(id);
        if (!u || u.balance < amount) throw new WalletError('INSUFFICIENT_FUNDS', 'Not enough Rodux');
        q.play.run(-amount, id);
        const r = reply(id, txId);
        q.addTx.run(CFG.name, txId, 'debit', id, amount, round == null ? null : String(round), game == null ? null : String(game), null, 'ok', JSON.stringify(r), now());
        limits && limits.addServerNet(id, -amount);
        return r;
      });
    });
  }

  function credit(b) {
    const id = playerOf(b), amount = amountOf(b), txId = String(pick(b, 'transaction') || ''), round = pick(b, 'round'), game = pick(b, 'game');
    return once(txId, () => tx(() => {
      q.play.run(amount, id);
      const r = reply(id, txId);
      q.addTx.run(CFG.name, txId, 'credit', id, amount, round == null ? null : String(round), game == null ? null : String(game), null, 'ok', JSON.stringify(r), now());
      limits && limits.addServerNet(id, amount);
      return r;
    }));
  }

  function rollback(b) {
    const id = playerOf(b), txId = String(pick(b, 'transaction') || ''), ref = String(pick(b, 'reference') || '');
    if (!ref) throw new WalletError('INVALID_TRANSACTION', 'Missing reference');
    return once(txId, () => tx(() => {
      const orig = q.tx.get(CFG.name, ref);
      let refunded = 0;
      if (!orig) {
        // The bet never reached us (or hasn't yet). Remember it so it is refused if it arrives late.
        q.addTx.run(CFG.name, ref, 'rollback-first', id, 0, null, null, txId, 'void', null, now());
      } else if (orig.kind === 'debit' && orig.status === 'ok') {
        if (orig.roblox_id !== id) throw new WalletError('INVALID_TRANSACTION', 'Reference belongs to another player');
        q.play.run(orig.amount, id); q.setTx.run('rolled_back', CFG.name, ref); refunded = orig.amount;
        limits && limits.addServerNet(id, orig.amount);
      } else if (orig.kind === 'credit') {
        throw new WalletError('INVALID_TRANSACTION', 'Wins cannot be rolled back');
      }
      const r = reply(id, txId, { refunded });
      q.addTx.run(CFG.name, txId, 'rollback', id, refunded, null, null, ref, 'ok', JSON.stringify(r), now());
      return r;
    }));
  }

  // Entry point for LuckyStreak's calls. Always answers JSON, with HTTP 200 for wallet-level
  // refusals (insufficient funds and so on), which is what seamless-wallet providers expect.
  async function handle(req, raw, action) {
    if (!enabled()) return { http: 503, body: { status: 'ERROR', code: 'DISABLED', message: 'Provider not configured' } };
    try {
      verify(req, raw);
      let b; try { b = JSON.parse(raw.toString('utf8') || '{}'); } catch { throw new WalletError('BAD_REQUEST', 'Body must be JSON', 400); }
      const fn = { balance, debit, credit, rollback }[action];
      if (!fn) throw new WalletError('NOT_FOUND', 'Unknown action', 404);
      return { http: 200, body: fn(b) };
    } catch (e) {
      if (e instanceof WalletError) {
        if (e.http >= 400) log('provider refused', action, e.walletCode, e.message);
        return { http: e.http, body: { status: 'ERROR', code: e.walletCode, message: e.message } };
      }
      log('provider error', action, e && e.stack || e);
      return { http: 500, body: { status: 'ERROR', code: 'INTERNAL', message: 'Try again' } };
    }
  }

  /* ---------- lobby and launching games (TradeBlacket -> LuckyStreak) ---------- */
  async function call(method, pathname, body) {
    const url = CFG.apiUrl + pathname, raw = body == null ? null : JSON.stringify(body);
    const r = await fetch(url, { method, headers: { Authorization: hawkHeader(method, url, raw), ...(raw ? { 'Content-Type': 'application/json' } : {}) }, body: raw, signal: AbortSignal.timeout(10000) });
    const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {}
    if (!r.ok) throw new Error(`LuckyStreak ${pathname} answered ${r.status}`);
    return j;
  }
  let gamesCache = null, gamesAt = 0;
  async function games() {
    if (!enabled()) return { enabled: false, games: [] };
    if (gamesCache && now() - gamesAt < 10 * 60e3) return gamesCache;
    const j = await call('GET', `${CFG.gamesPath}?operatorId=${encodeURIComponent(CFG.operatorId)}`);
    const list = (Array.isArray(j) ? j : j && (j.games || j.data || j.items) || []).map(g => ({
      id: String(g.id ?? g.gameId ?? g.code), name: g.name ?? g.gameName ?? g.title ?? 'Game',
      studio: g.provider ?? g.providerName ?? g.studio ?? g.vendor ?? 'LuckyStreak', type: g.type ?? g.category ?? g.gameType ?? 'slots',
      img: g.image ?? g.thumbnail ?? g.imageUrl ?? g.icon ?? null,
    })).filter(g => g.id && g.id !== 'undefined');
    gamesCache = { enabled: true, games: list }; gamesAt = now();
    return gamesCache;
  }
  async function launch(robloxId, username, gameId, mobile) {
    if (!enabled()) throw new WalletError('DISABLED', 'Studio games are not switched on yet.', 503);
    const why = guard(robloxId, 'bet', 0);
    if (why) throw new WalletError('PLAYER_LIMIT', typeof why === 'string' ? why : 'Play is paused.', 403);
    const token = crypto.randomBytes(24).toString('base64url');
    q.addSession.run(token, robloxId, String(gameId), now(), now());
    const j = await call('POST', CFG.launchPath, {
      operatorId: CFG.operatorId, gameId: String(gameId), playerId: String(robloxId), nickname: username,
      sessionToken: token, currency: CFG.currency, language: 'en', mode: 'real', platform: mobile ? 'mobile' : 'desktop', lobbyUrl: CFG.lobbyUrl,
    });
    const url = j && (j.url || j.gameUrl || j.launchUrl || (j.data && (j.data.url || j.data.gameUrl)));
    if (!url || !/^https:\/\//.test(url)) throw new Error('LuckyStreak did not return a game link');
    return { url };
  }
  const recent = id => q.recent.all(id);

  return { enabled, handle, games, launch, recent, WalletError, _test: { hawkHeader, hawkMac, payloadHash, CFG } };
}

module.exports = { create, CFG, enabled, hawkHeader, payloadHash, hawkMac };
