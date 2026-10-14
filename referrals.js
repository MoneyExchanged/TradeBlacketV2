// Refer a friend.
//
// Every player has a referral code and link (tradeblacket.com/?ref=CODE). A friend who signs up with
// it is linked to them. The referrer gets REFERRAL_REWARD (default 450) Rodux once the friend is
// actually in: the friend has site access, accepted the Terms, and neither of them is banned.
// A friend on the same network, device or hardware as the referrer never pays out.
//
// The reward is bonus Rodux: it plays on the site like any other Rodux but is locked from
// withdrawal (users.bonus_lock), so referrals can never create Rodux in Trade Empire itself.
'use strict';
const crypto = require('node:crypto');

const REWARD = Math.max(0, Math.floor(Number(process.env.REFERRAL_REWARD || 450)));
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function create({ db, tx, secret, siteOk, isBanned, shared, tosOk, log = () => {} }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ref_codes (code TEXT PRIMARY KEY, roblox_id INTEGER NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS referrals (friend_id INTEGER PRIMARY KEY, referrer_id INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending','paid','void')), reason TEXT, reward INTEGER NOT NULL DEFAULT 0, ref TEXT, created_at INTEGER NOT NULL, paid_at INTEGER);
    CREATE INDEX IF NOT EXISTS referrals_by ON referrals (referrer_id, created_at DESC);
  `);
  const q = {
    codeOf: db.prepare('SELECT code FROM ref_codes WHERE roblox_id = ?'),
    owner: db.prepare('SELECT roblox_id FROM ref_codes WHERE code = ?'),
    addCode: db.prepare('INSERT OR IGNORE INTO ref_codes (code, roblox_id) VALUES (?, ?)'),
    add: db.prepare("INSERT OR IGNORE INTO referrals (friend_id, referrer_id, status, created_at) VALUES (?, ?, 'pending', ?)"),
    get: db.prepare('SELECT * FROM referrals WHERE friend_id = ?'),
    pendingBy: db.prepare("SELECT friend_id FROM referrals WHERE referrer_id = ? AND status = 'pending'"),
    pay: db.prepare("UPDATE referrals SET status = 'paid', reward = ?, ref = ?, paid_at = ? WHERE friend_id = ? AND status = 'pending'"),
    void: db.prepare("UPDATE referrals SET status = 'void', reason = ? WHERE friend_id = ? AND status = 'pending'"),
    credit: db.prepare('UPDATE users SET balance = balance + ?, bonus_lock = bonus_lock + ? WHERE roblox_id = ?'),
    list: db.prepare('SELECT r.friend_id, u.username, r.status, r.reason, r.reward, r.created_at, r.paid_at FROM referrals r LEFT JOIN users u ON u.roblox_id = r.friend_id WHERE r.referrer_id = ? ORDER BY r.created_at DESC LIMIT 200'),
    payouts: db.prepare("SELECT 'bonus' AS kind, reward AS amount, 'ok' AS status, ref AS reference, 'Referral reward' AS reason, paid_at AS created_at FROM referrals WHERE referrer_id = ? AND status = 'paid' ORDER BY paid_at DESC LIMIT 25"),
  };
  // A short code made from the player's id, stable for that player.
  function codeFor(id) {
    const row = q.codeOf.get(id); if (row) return row.code;
    for (let salt = 0; salt < 20; salt++) {
      const d = crypto.createHmac('sha256', secret).update(`ref:${id}:${salt}`).digest();
      let c = ''; for (let i = 0; i < 8; i++) c += ALPHA[d[i] % ALPHA.length];
      if (q.addCode.run(c, id).changes) return c;
      if ((q.codeOf.get(id) || {}).code) return q.codeOf.get(id).code;
    }
    throw new Error('could not make a referral code');
  }
  const clean = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

  // A new account signed up with a referral code.
  function attach(friendId, code) {
    const c = clean(code); if (c.length !== 8) return null;
    const o = q.owner.get(c); if (!o || o.roblox_id === friendId) return null;
    q.add.run(friendId, o.roblox_id, Date.now());
    log('referral', o.roblox_id, '->', friendId);
    return o.roblox_id;
  }
  // Pay a pending referral once the friend is in, or close it if it can never pay.
  function settle(friendId) {
    const r = q.get.get(friendId);
    if (!r || r.status !== 'pending') return r;
    if (isBanned(friendId) || isBanned(r.referrer_id)) { q.void.run('Account banned', friendId); return q.get.get(friendId); }
    if (shared(r.referrer_id, friendId)) { q.void.run('Same network or device as you', friendId); return q.get.get(friendId); }
    if (!siteOk(friendId) || !tosOk(friendId)) return r;
    const ref = 'TBR-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    tx(() => { if (q.pay.run(REWARD, ref, Date.now(), friendId).changes) q.credit.run(REWARD, REWARD, r.referrer_id); });
    log('referral paid', r.referrer_id, REWARD, ref);
    return q.get.get(friendId);
  }
  function settleFor(referrerId) { for (const r of q.pendingBy.all(referrerId)) settle(r.friend_id); }

  function view(id) {
    settleFor(id);
    const list = q.list.all(id);
    return {
      code: codeFor(id), reward: REWARD,
      invited: list.length, paid: list.filter(r => r.status === 'paid').length,
      pending: list.filter(r => r.status === 'pending').length,
      earned: list.reduce((s, r) => s + (r.status === 'paid' ? r.reward : 0), 0),
      friends: list.map(r => ({ name: r.username || 'New player', status: r.status, reason: r.reason, reward: r.reward, at: r.created_at, paidAt: r.paid_at })),
    };
  }
  return { REWARD, codeFor, attach, settle, settleFor, view, payouts: id => q.payouts.all(id) };
}

module.exports = { create };
