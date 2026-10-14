// One player, one account.
//
// Every sign-in records three one-way fingerprints of where it came from:
//   ip   the network address (an IPv6 address counts by its /64, as that is one connection)
//   dev  a random device id the browser keeps (cookie and localStorage)
//   hw   a hash of the device's hardware and browser traits (graphics card, screen, cores, ...)
// Only HMACs keyed with the server secret are stored, never the address or traits themselves.
//
// Rules
//   - Sign-in attempts are rate limited per network.
//   - A NEW account that registers from a network, device or hardware already used by another
//     account in the last 30 days (device id: ever) is banned on the spot.
//   - An existing account that signs in on a device id another account already uses: the newer of
//     the two accounts is banned.
//   - Admins are never banned. Admins can ban and unban by hand.
// A banned account can still sign in and bring its own Rodux and items back to Trade Empire, and
// nothing else: no deposits, games, cases, trading, waitlist or referrals.
'use strict';
const crypto = require('node:crypto');

const DAY = 864e5, WINDOW = 30 * DAY;
class SecError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }

function create({ db, tx, secret, isAdmin, log = () => {} }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sightings (kind TEXT NOT NULL, hash TEXT NOT NULL, roblox_id INTEGER NOT NULL, first_at INTEGER NOT NULL, last_at INTEGER NOT NULL, PRIMARY KEY (kind, hash, roblox_id));
    CREATE INDEX IF NOT EXISTS sightings_user ON sightings (roblox_id);
    CREATE TABLE IF NOT EXISTS bans (roblox_id INTEGER PRIMARY KEY, reason TEXT NOT NULL, linked_id INTEGER, by_id INTEGER, created_at INTEGER NOT NULL);
  `);
  const q = {
    seen: db.prepare(`INSERT INTO sightings (kind, hash, roblox_id, first_at, last_at) VALUES (?,?,?,?,?) ON CONFLICT (kind, hash, roblox_id) DO UPDATE SET last_at = excluded.last_at`),
    others: db.prepare(`SELECT roblox_id, last_at FROM sightings WHERE kind = ? AND hash = ? AND roblox_id != ? ORDER BY first_at`),
    mine: db.prepare(`SELECT kind, hash FROM sightings WHERE roblox_id = ?`),
    ban: db.prepare(`INSERT OR IGNORE INTO bans (roblox_id, reason, linked_id, by_id, created_at) VALUES (?,?,?,?,?)`),
    unban: db.prepare(`DELETE FROM bans WHERE roblox_id = ?`),
    banned: db.prepare(`SELECT * FROM bans WHERE roblox_id = ?`),
    list: db.prepare(`SELECT b.*, u.username, l.username AS linked_name FROM bans b LEFT JOIN users u ON u.roblox_id = b.roblox_id LEFT JOIN users l ON l.roblox_id = b.linked_id ORDER BY b.created_at DESC LIMIT 300`),
    user: db.prepare(`SELECT roblox_id, created_at FROM users WHERE roblox_id = ?`),
    byName: db.prepare(`SELECT roblox_id FROM users WHERE lower(username) = lower(?)`),
    dropAccess: [db.prepare(`DELETE FROM site_access WHERE roblox_id = ?`), db.prepare(`DELETE FROM slot_access WHERE roblox_id = ?`)],
  };
  const h = (kind, v) => crypto.createHmac('sha256', secret).update(kind + ':' + v).digest('hex').slice(0, 40);

  /* ---------- where a request came from ---------- */
  // Railway's edge sets X-Real-IP to the visitor's address and rewrites X-Forwarded-For so it starts
  // with it; a visitor's own copies of either header are replaced (checked on the live site).
  function ip(req) {
    let a = String(req.headers['x-real-ip'] || '').trim();
    if (!a) a = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (!a) a = (req.socket && req.socket.remoteAddress) || '';
    a = a.replace(/^::ffff:/, '');
    if (a.includes(':')) a = a.split(':').slice(0, 4).join(':') + '::/64';
    return a;
  }
  // The browser sends "X-TB-Device: <device id>.<hardware hash>" and keeps the id in the tb_dev cookie.
  function device(req) {
    const hdr = String(req.headers['x-tb-device'] || '');
    const ck = /(?:^|;\s*)tb_dev=([0-9a-f]{32})/.exec(req.headers.cookie || '');
    const m = /^([0-9a-f]{32})\.([0-9a-f]{16,64})$/.exec(hdr);
    return { dev: (ck && ck[1]) || (m && m[1]) || null, hw: m ? m[2] : null };
  }
  function marks(req) {
    const out = [], a = ip(req), d = device(req);
    if (a) out.push(['ip', h('ip', a)]);
    if (d.dev) out.push(['dev', h('dev', d.dev)]);
    if (d.hw) out.push(['hw', h('hw', d.hw)]);
    return out;
  }

  /* ---------- rate limits (in memory, per network) ---------- */
  const hits = new Map();
  function limit(req, what, max, windowMs) {
    const key = what + ':' + h('ip', ip(req)), t = Date.now();
    const arr = (hits.get(key) || []).filter(x => t - x < windowMs);
    if (arr.length >= max) { hits.set(key, arr); const wait = Math.ceil((windowMs - (t - arr[0])) / 60e3); throw new SecError(`Too many attempts from your network. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`, 429); }
    arr.push(t); hits.set(key, arr);
    if (hits.size > 50000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > DAY) hits.delete(k);
  }

  /* ---------- bans ---------- */
  const isBanned = id => !isAdmin(id) && !!q.banned.get(id);
  const banInfo = id => (isAdmin(id) ? null : q.banned.get(id) || null);
  function ban(id, reason, linked = null, by = null) {
    if (isAdmin(id)) return false;
    const r = q.ban.run(id, reason, linked, by, Date.now()).changes > 0;
    if (r) { q.dropAccess.forEach(s => { try { s.run(id); } catch {} }); log('ban', id, reason, linked || ''); }
    return r;
  }
  const REASON = { ip: 'Another account already signed up from this network', dev: 'Another account already uses this device', hw: 'Another account already uses this hardware' };

  // Called when a player signs in. isNew: this sign-in created the account.
  function onSignIn(id, req, isNew) {
    const ms = marks(req), t = Date.now();
    let hit = null;
    if (!isAdmin(id)) for (const [kind, hash] of ms) {
      // a new account is checked against every account; a returning one only against accounts
      // that are not banned already (its own banned alts are dealt with)
      const other = q.others.all(kind, hash, id).find(o => (kind === 'dev' || t - o.last_at < WINDOW) && (isNew || !q.banned.get(o.roblox_id)));
      if (!other) continue;
      if (isNew) { hit = { kind, other: other.roblox_id, ban: id }; break; }
      if (kind === 'dev') {
        // two existing accounts on one device: the newer one goes
        const a = q.user.get(id), b = q.user.get(other.roblox_id);
        const newer = !b || (a && a.created_at >= b.created_at) ? id : other.roblox_id;
        const target = isAdmin(newer) ? (newer === id ? other.roblox_id : id) : newer;
        if (!isAdmin(target)) { hit = { kind, other: target === id ? other.roblox_id : id, ban: target }; break; }
      }
    }
    tx(() => { for (const [kind, hash] of ms) q.seen.run(kind, hash, id, t, t); if (hit) ban(hit.ban, REASON[hit.kind], hit.other); });
    return hit;
  }
  // Called on every signed-in request that carries a device: keeps "last seen" fresh, and catches a
  // device id that turns up on a second account.
  const lastTouch = new Map();
  function touch(id, req) {
    const k = id + ':' + (req.headers['x-tb-device'] || '') + ':' + ip(req);
    if (Date.now() - (lastTouch.get(k) || 0) < 10 * 60e3) return;
    lastTouch.set(k, Date.now());
    if (lastTouch.size > 100000) lastTouch.clear();
    onSignIn(id, req, false);
  }
  // Do two accounts share a network, device or hardware? (used for referrals)
  function shared(a, b) {
    const mine = q.mine.all(a);
    return mine.some(m => q.others.all(m.kind, m.hash, a).some(o => o.roblox_id === b));
  }

  /* ---------- admin ---------- */
  function adminBan(admin, who, reason) {
    if (!isAdmin(admin)) throw new SecError('Only admins can do that.', 403);
    const id = /^\d+$/.test(String(who)) ? Number(who) : (q.byName.get(String(who || '').trim()) || {}).roblox_id;
    if (!id) throw new SecError('No TradeBlacket account with that name or id.', 404);
    if (isAdmin(id)) throw new SecError('Admins cannot be banned.');
    ban(id, String(reason || 'Banned by an admin').slice(0, 120), null, admin);
    return { ok: true };
  }
  function adminUnban(admin, id) {
    if (!isAdmin(admin)) throw new SecError('Only admins can do that.', 403);
    q.unban.run(Number(id)); log('unban', id, 'by', admin);
    return { ok: true };
  }
  function adminList(admin) {
    if (!isAdmin(admin)) throw new SecError('Only admins can do that.', 403);
    return { bans: q.list.all() };
  }

  return { ip, device, limit, onSignIn, touch, shared, isBanned, banInfo, ban, adminBan, adminUnban, adminList, SecError };
}

module.exports = { create, SecError };
