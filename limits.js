// Responsible play: limits a player sets on themselves, enforced by the server.
//
//   dailyMinutes    screen time per day. When it runs out, playing and depositing stop until tomorrow.
//   reminderMinutes a "you've been playing for X minutes" check-in.
//   depositCap      Rodux that can be deposited per day.
//   itemCap         value of limiteds that can be deposited per day.
//   maxBet          largest single bet the site will place for you.
//   lossLimit       net Rodux you can lose per day before play stops.
//   coolOff         a break of 24 hours, 3 days or a week. Cannot be undone early.
//   selfExclude     30, 90 or 180 days away. Cannot be undone early.
//
// Making a limit stricter works immediately. Making one looser, or removing it, waits 24 hours,
// so a limit set with a clear head cannot be undone in the heat of the moment. Withdrawals are never
// blocked: a player can always take their Rodux and items back.
'use strict';

const DAY = 864e5;
const NUMERIC = { dailyMinutes: [0, 24 * 60], reminderMinutes: [0, 240], depositCap: [0, 1e12], itemCap: [0, 1e12], maxBet: [0, 1e12], lossLimit: [0, 1e12] };
const COOL = { '24h': DAY, '72h': 3 * DAY, '7d': 7 * DAY };
const EXCLUDE = { '30d': 30 * DAY, '90d': 90 * DAY, '180d': 180 * DAY };
const dayKey = t => new Date(t).toISOString().slice(0, 10);

function create({ db, tx }) {
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('settings')) db.exec("ALTER TABLE users ADD COLUMN settings TEXT NOT NULL DEFAULT '{}'");
  db.exec(`CREATE TABLE IF NOT EXISTS usage (roblox_id INTEGER NOT NULL, day TEXT NOT NULL, seconds INTEGER NOT NULL DEFAULT 0, net INTEGER NOT NULL DEFAULT 0, last INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (roblox_id, day))`);
  // snet: the day's result in studio games, counted by the server itself (net is what the browser reports).
  if (!db.prepare('PRAGMA table_info(usage)').all().some(c => c.name === 'snet')) db.exec('ALTER TABLE usage ADD COLUMN snet INTEGER NOT NULL DEFAULT 0');
  const q = {
    get: db.prepare('SELECT settings FROM users WHERE roblox_id = ?'),
    put: db.prepare('UPDATE users SET settings = ? WHERE roblox_id = ?'),
    usage: db.prepare('SELECT * FROM usage WHERE roblox_id = ? AND day = ?'),
    ensure: db.prepare('INSERT OR IGNORE INTO usage (roblox_id, day) VALUES (?, ?)'),
    addTime: db.prepare('UPDATE usage SET seconds = seconds + ?, last = ? WHERE roblox_id = ? AND day = ?'),
    setNet: db.prepare('UPDATE usage SET net = ? WHERE roblox_id = ? AND day = ?'),
    addSnet: db.prepare('UPDATE usage SET snet = snet + ? WHERE roblox_id = ? AND day = ?'),
    depRodux: db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM offline_transfers WHERE roblox_id = ? AND kind = 'deposit' AND status IN ('ok','staged') AND created_at >= ?"),
    depItems: db.prepare("SELECT COALESCE(SUM(value),0) AS n FROM item_moves WHERE roblox_id = ? AND kind = 'deposit' AND status IN ('ok','staged') AND created_at >= ?")
  };
  const now = () => Date.now();
  const startOfDay = t => Date.parse(dayKey(t) + 'T00:00:00Z');

  function raw(id) { try { return JSON.parse((q.get.get(id) || {}).settings || '{}'); } catch { return {}; } }
  // Settings as they apply right now: loosening changes that have waited 24 hours are applied.
  function effective(id) {
    const s = raw(id), t = now(); let changed = false;
    for (const [k, p] of Object.entries(s.pending || {})) if (t >= p.at) { s[k] = p.value; delete s.pending[k]; changed = true; }
    if (changed) q.put.run(JSON.stringify(s), id);
    return s;
  }
  function update(id, patch) {
    const s = effective(id), t = now(); s.pending = s.pending || {};
    for (const [k, [lo, hi]] of Object.entries(NUMERIC)) {
      if (!(k in patch)) continue;
      const v = patch[k] === null || patch[k] === '' ? 0 : Math.floor(Number(patch[k]));
      if (!Number.isFinite(v) || v < lo || v > hi) throw new Error(`That ${k} is out of range.`);
      const cur = s[k] || 0;
      // 0 means "no limit". Stricter = adding a limit, or lowering one.
      const stricter = k === 'reminderMinutes' ? true : (v > 0 && (cur === 0 || v < cur));
      if (stricter || v === cur) { s[k] = v; delete s.pending[k]; }
      else s.pending[k] = { value: v, at: t + DAY };
    }
    if (patch.coolOff) { const d = COOL[patch.coolOff]; if (!d) throw new Error('Pick a break length.'); s.coolOffUntil = Math.max(s.coolOffUntil || 0, t + d); }
    if (patch.selfExclude) { const d = EXCLUDE[patch.selfExclude]; if (!d) throw new Error('Pick how long to stay away.'); s.selfExcludedUntil = Math.max(s.selfExcludedUntil || 0, t + d); }
    q.put.run(JSON.stringify(s), id);
    return status(id);
  }
  function usageToday(id) { const d = dayKey(now()); q.ensure.run(id, d); return q.usage.get(id, d); }
  function heartbeat(id, seconds, net) {
    const d = dayKey(now()), t = now(); q.ensure.run(id, d);
    const u = q.usage.get(id, d);
    // At most one heartbeat a minute counts, so the counter cannot be run up by spamming it.
    const add = Math.max(0, Math.min(Number(seconds) || 0, 70, Math.floor((t - (u.last || 0)) / 1000)));
    tx(() => { q.addTime.run(add, t, id, d); if (Number.isFinite(Number(net))) q.setNet.run(Math.round(Number(net)), id, d); });
    return status(id);
  }
  function status(id) {
    const s = effective(id), u = usageToday(id), t = now();
    let lock = null;
    if ((s.selfExcludedUntil || 0) > t) lock = { reason: 'selfExclude', until: s.selfExcludedUntil };
    else if ((s.coolOffUntil || 0) > t) lock = { reason: 'coolOff', until: s.coolOffUntil };
    else if (s.dailyMinutes && u.seconds >= s.dailyMinutes * 60) lock = { reason: 'screenTime', until: startOfDay(t) + DAY };
    else if (s.lossLimit && -(u.net + (u.snet || 0)) >= s.lossLimit) lock = { reason: 'lossLimit', until: startOfDay(t) + DAY };
    const dayStart = startOfDay(t);
    return {
      settings: { dailyMinutes: s.dailyMinutes || 0, reminderMinutes: s.reminderMinutes || 0, depositCap: s.depositCap || 0, itemCap: s.itemCap || 0, maxBet: s.maxBet || 0, lossLimit: s.lossLimit || 0, coolOffUntil: s.coolOffUntil || 0, selfExcludedUntil: s.selfExcludedUntil || 0 },
      pending: s.pending || {}, usedSeconds: u.seconds, net: u.net + (u.snet || 0), lock,
      depositedToday: q.depRodux.get(id, dayStart).n, itemsToday: q.depItems.get(id, dayStart).n
    };
  }
  // Called before anything that spends or brings in value. Returns a reason to refuse, or null.
  function guard(id, kind, amount) {
    const st = status(id), s = st.settings;
    if (kind === 'withdraw') return null;
    if (st.lock) {
      const until = new Date(st.lock.until).toUTCString();
      return { selfExclude: `You excluded yourself until ${until}.`, coolOff: `You are on a break until ${until}.`, screenTime: 'You reached your daily screen time limit. It resets at midnight UTC.', lossLimit: 'You reached your daily loss limit. It resets at midnight UTC.' }[st.lock.reason];
    }
    if (kind === 'bet' && s.maxBet && amount > s.maxBet) return `That bet is above your largest-bet limit of ${s.maxBet.toLocaleString('en-US')} Rodux.`;
    if (kind === 'bet' && s.lossLimit && amount > 0 && -st.net + amount > s.lossLimit) return `That bet could take you past your daily loss limit (${Math.max(0, s.lossLimit + st.net).toLocaleString('en-US')} Rodux left today).`;
    if (kind === 'deposit' && s.depositCap && st.depositedToday + amount > s.depositCap) return `That would go over your daily deposit limit of ${s.depositCap.toLocaleString('en-US')} Rodux (${Math.max(0, s.depositCap - st.depositedToday).toLocaleString('en-US')} left today).`;
    if (kind === 'items' && s.itemCap && st.itemsToday + amount > s.itemCap) return `That would go over your daily item deposit limit of ${s.itemCap.toLocaleString('en-US')} in value.`;
    return null;
  }
  function addServerNet(id, delta) { const d = dayKey(now()); q.ensure.run(id, d); q.addSnet.run(Math.round(delta), id, d); }
  return { status, update, heartbeat, guard, addServerNet };
}

module.exports = { create };
