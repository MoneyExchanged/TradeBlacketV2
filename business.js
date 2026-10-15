// TradeBlacket Business: the program for content creators (tradeblacket.com/business).
//
//   1. Sign in with Roblox (the same bio verification as the site).
//   2. Join the Business registry: a short application that moderators approve or reject.
//      Approved members get the Business role (a gold badge on their profile and in chat), direct
//      support, the feature request board, YouTube channel verification, and site access.
//   3. Apply for TEPP, the Trade Empire Partner Program. Moderators decide again.
//   4. Partners create their Business Card. Staff pay out to the card in US dollars or Rodux, and
//      hand partners giveaway gift cards. A partner withdraws card money as Rodux to their
//      TradeBlacket balance (withdrawable to Trade Empire like deposited Rodux) or as limiteds that
//      TradeBlacket owns. Dollars become Rodux at the gift card rate (the game's own Rodux prices).
// The card is also a way to pay: a partner can top it up from their TradeBlacket balance, and choose
// (Settings) to pay withdrawals and purchases with the card instead of the balance. Each card payment
// is confirmed the way they chose: nothing, a 4 to 6 digit code, or their device (Windows Hello,
// Touch ID, Face ID: a WebAuthn passkey verified on the server).
// Every decision, payout, top-up, payment and withdrawal is logged.
'use strict';
const crypto = require('node:crypto');

class BizError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
const URLRE = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?$/i;
const PLATFORMS = ['youtube', 'tiktok', 'twitch', 'x', 'discord', 'other'];
const ACCENTS = ['gold', 'champagne', 'rose', 'platinum', 'emerald'];
const B32 = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

function create({ db, tx, log = () => {}, isAdmin, can = () => true, signed = () => true, staffName = () => null, secret, rate, items, siteList, isBanned, note = () => {}, gifts, withdrawable = () => 0, origins = [] }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS biz_members (roblox_id INTEGER PRIMARY KEY, status TEXT NOT NULL, form TEXT NOT NULL, applied_at INTEGER NOT NULL, decided_at INTEGER, decided_by INTEGER, note TEXT,
      tepp TEXT NOT NULL DEFAULT 'none', tepp_form TEXT, tepp_at INTEGER, tepp_decided_at INTEGER, tepp_note TEXT,
      card TEXT, card_at INTEGER, usd_cents INTEGER NOT NULL DEFAULT 0, rodux INTEGER NOT NULL DEFAULT 0,
      yt_url TEXT, yt_phrase TEXT, yt_verified INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS biz_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, roblox_id INTEGER NOT NULL, kind TEXT NOT NULL, currency TEXT NOT NULL, amount INTEGER NOT NULL, rodux INTEGER NOT NULL DEFAULT 0, note TEXT, by_id INTEGER, ref TEXT, items TEXT, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS biz_ledger_user ON biz_ledger (roblox_id, at DESC);
    CREATE TABLE IF NOT EXISTS biz_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, roblox_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', reply TEXT, votes TEXT NOT NULL DEFAULT '[]', at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
  `);
  if (!db.prepare('PRAGMA table_info(gift_cards)').all().some(c => c.name === 'assigned_to')) db.exec('ALTER TABLE gift_cards ADD COLUMN assigned_to INTEGER');
  { const c = db.prepare('PRAGMA table_info(biz_members)').all().map(x => x.name);
    for (const [col, def] of [['pay_source', "TEXT NOT NULL DEFAULT 'balance'"], ['pay_auth', "TEXT NOT NULL DEFAULT 'none'"], ['pin_hash', 'TEXT'], ['pin_fail', 'INTEGER NOT NULL DEFAULT 0'], ['pin_lock', 'INTEGER NOT NULL DEFAULT 0'], ['pk_id', 'TEXT'], ['pk_pub', 'TEXT'], ['pk_alg', 'INTEGER'], ['pk_count', 'INTEGER NOT NULL DEFAULT 0'], ['wage_amount', 'INTEGER NOT NULL DEFAULT 0'], ['wage_currency', "TEXT NOT NULL DEFAULT 'USD'"], ['wage_note', 'TEXT'], ['wage_set_by', 'INTEGER'], ['wage_set_at', 'INTEGER'], ['wage_next_at', 'INTEGER'], ['wage_paused', 'INTEGER NOT NULL DEFAULT 0'], ['wage_last_at', 'INTEGER']])
      if (!c.includes(col)) db.exec(`ALTER TABLE biz_members ADD COLUMN ${col} ${def}`); }
  const q = {
    get: db.prepare('SELECT * FROM biz_members WHERE roblox_id = ?'),
    add: db.prepare("INSERT INTO biz_members (roblox_id, status, form, applied_at) VALUES (?, 'pending', ?, ?) ON CONFLICT(roblox_id) DO UPDATE SET status = 'pending', form = excluded.form, applied_at = excluded.applied_at, note = NULL, decided_at = NULL"),
    decide: db.prepare('UPDATE biz_members SET status = ?, decided_at = ?, decided_by = ?, note = ? WHERE roblox_id = ?'),
    tepp: db.prepare("UPDATE biz_members SET tepp = 'pending', tepp_form = ?, tepp_at = ?, tepp_note = NULL WHERE roblox_id = ?"),
    teppDecide: db.prepare('UPDATE biz_members SET tepp = ?, tepp_decided_at = ?, tepp_note = ? WHERE roblox_id = ?'),
    card: db.prepare('UPDATE biz_members SET card = ?, card_at = COALESCE(card_at, ?) WHERE roblox_id = ?'),
    yt: db.prepare('UPDATE biz_members SET yt_url = ?, yt_phrase = ?, yt_verified = 0 WHERE roblox_id = ?'),
    ytOk: db.prepare('UPDATE biz_members SET yt_verified = ? WHERE roblox_id = ?'),
    money: db.prepare('UPDATE biz_members SET usd_cents = usd_cents + ?, rodux = rodux + ? WHERE roblox_id = ?'),
    led: db.prepare('INSERT INTO biz_ledger (roblox_id, kind, currency, amount, rodux, note, by_id, ref, items, at) VALUES (?,?,?,?,?,?,?,?,?,?)'),
    ledger: db.prepare('SELECT * FROM biz_ledger WHERE roblox_id = ? ORDER BY at DESC LIMIT 100'),
    all: db.prepare('SELECT b.*, u.username FROM biz_members b LEFT JOIN users u ON u.roblox_id = b.roblox_id ORDER BY b.applied_at DESC LIMIT 500'),
    credit: db.prepare('UPDATE users SET balance = balance + ?, deposited = deposited + ? WHERE roblox_id = ?'),
    reqAdd: db.prepare('INSERT INTO biz_requests (roblox_id, title, body, at, updated_at) VALUES (?,?,?,?,?)'),
    reqs: db.prepare('SELECT r.*, u.username FROM biz_requests r LEFT JOIN users u ON u.roblox_id = r.roblox_id ORDER BY (r.status IN (\'done\',\'declined\')), r.updated_at DESC LIMIT 200'),
    req: db.prepare('SELECT * FROM biz_requests WHERE id = ?'),
    reqSet: db.prepare('UPDATE biz_requests SET status = ?, reply = ?, updated_at = ? WHERE id = ?'),
    reqVotes: db.prepare('UPDATE biz_requests SET votes = ? WHERE id = ?'),
    codes: db.prepare('SELECT g.code, g.usd, g.status, g.redeemed_at, u.username AS redeemed_name, g.expires_at FROM gift_cards g LEFT JOIN users u ON u.roblox_id = g.redeemed_by WHERE g.assigned_to = ? ORDER BY g.created_at DESC LIMIT 200'),
    assign: db.prepare('UPDATE gift_cards SET assigned_to = ? WHERE code = ?'),
    // what the browser adds to (or takes from) the play balance, once each
    payouts: db.prepare("SELECT CASE kind WHEN 'topup' THEN 'card-topup' ELSE 'deposit' END AS kind, rodux AS amount, 'ok' AS status, ref AS reference, CASE kind WHEN 'topup' THEN 'Moved to your Business Card' WHEN 'card-pay' THEN 'Paid with your Business Card' ELSE 'Business card payout' END AS reason, at AS created_at FROM biz_ledger WHERE roblox_id = ? AND kind IN ('withdraw-rodux','card-pay','topup') ORDER BY at DESC LIMIT 25"),
    user: db.prepare('SELECT * FROM users WHERE roblox_id = ?'),
    setWage: db.prepare('UPDATE biz_members SET wage_amount = ?, wage_currency = ?, wage_note = ?, wage_set_by = ?, wage_set_at = ?, wage_next_at = ?, wage_paused = ? WHERE roblox_id = ?'),
    wageDue: db.prepare("SELECT * FROM biz_members WHERE status = 'approved' AND tepp = 'approved' AND wage_amount > 0 AND wage_paused = 0 AND wage_next_at IS NOT NULL AND wage_next_at <= ?"),
    wagePaid: db.prepare('UPDATE biz_members SET wage_next_at = ?, wage_last_at = ? WHERE roblox_id = ?'),
    takeSite: db.prepare('UPDATE users SET balance = balance - ?, deposited = MAX(withdrawn, deposited - ?) WHERE roblox_id = ?'),
    setPay: db.prepare('UPDATE biz_members SET pay_source = ? WHERE roblox_id = ?'),
    setAuth: db.prepare('UPDATE biz_members SET pay_auth = ?, pin_hash = COALESCE(?, pin_hash) WHERE roblox_id = ?'),
    pinFail: db.prepare('UPDATE biz_members SET pin_fail = ?, pin_lock = ? WHERE roblox_id = ?'),
    setPk: db.prepare('UPDATE biz_members SET pk_id = ?, pk_pub = ?, pk_alg = ?, pk_count = 0 WHERE roblox_id = ?'),
    pkCount: db.prepare('UPDATE biz_members SET pk_count = ? WHERE roblox_id = ?'),
    waitMember: db.prepare("SELECT decided_at - applied_at AS d FROM biz_members WHERE decided_at IS NOT NULL AND status IN ('approved','rejected','suspended') ORDER BY decided_at DESC LIMIT 25"),
    waitTepp: db.prepare("SELECT tepp_decided_at - tepp_at AS d FROM biz_members WHERE tepp_decided_at IS NOT NULL AND tepp_at IS NOT NULL ORDER BY tepp_decided_at DESC LIMIT 25"),
    aheadMember: db.prepare("SELECT COUNT(*) AS n FROM biz_members WHERE status = 'pending' AND applied_at < ?"),
    aheadTepp: db.prepare("SELECT COUNT(*) AS n FROM biz_members WHERE tepp = 'pending' AND tepp_at < ?"),
    pendingMember: db.prepare("SELECT COUNT(*) AS n FROM biz_members WHERE status = 'pending'"),
    pendingTepp: db.prepare("SELECT COUNT(*) AS n FROM biz_members WHERE tepp = 'pending'"),
  };
  const now = () => Date.now();
  const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
  const cardNo = id => { const h = crypto.createHmac('sha256', String(secret)).update('biz:' + id).digest(); let s = ''; for (let i = 0; i < 12; i++) s += B32[h[i] % 30]; return `TBB ${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8)}`; };
  const perUsd = () => rate().roduxPerUsd;
  const member = id => { const m = q.get.get(id); return m && m.status === 'approved' ? m : null; };
  const partner = id => { const m = member(id); return m && m.tepp === 'approved' ? m : null; };

  // The role other players see: on profiles and in chat.
  function badge(id) { const m = member(id); if (!m) return null; return { role: m.tepp === 'approved' ? 'Partner' : 'Business', verified: !!m.yt_verified }; }

  function view(id) {
    const m = q.get.get(id);
    const base = { cardNo: cardNo(id), roduxPerUsd: perUsd(), platforms: PLATFORMS, accents: ACCENTS };
    if (!m) return { ...base, status: 'none' };
    const card = parse(m.card, null);
    const review = m.status === 'pending' ? queue('member', m.applied_at) : m.status === 'approved' && m.tepp === 'pending' ? queue('tepp', m.tepp_at) : null;
    return {
      review, pay: { source: m.pay_source, method: m.pay_auth, hasPin: !!m.pin_hash, hasDevice: !!m.pk_id, locked: m.pin_lock > now() ? m.pin_lock : null },
      ...base, status: m.status, appliedAt: m.applied_at, decidedAt: m.decided_at, note: m.note, form: parse(m.form, {}),
      tepp: m.tepp, teppAt: m.tepp_at, teppNote: m.tepp_note, teppForm: parse(m.tepp_form, null),
      card, cardAt: m.card_at, balance: { usd: m.usd_cents / 100, rodux: m.rodux, roduxValue: m.rodux + Math.floor(m.usd_cents * perUsd() / 100) },
      youtube: { url: m.yt_url, phrase: m.yt_verified ? null : m.yt_phrase, verified: !!m.yt_verified },
      agreement: { signed: signed(id, 'business') },
      wage: wageView(m),
      ledger: q.ledger.all(id).map(l => ({ kind: l.kind, currency: l.currency, amount: l.currency === 'USD' ? l.amount / 100 : l.amount, rodux: l.rodux, note: l.note, ref: l.ref, items: parse(l.items, null), at: l.at })),
      codes: m.status === 'approved' ? q.codes.all(id).map(c => ({ code: c.code, usd: c.usd, status: c.status === 'active' && c.expires_at && c.expires_at < now() ? 'expired' : c.status, redeemedBy: c.redeemed_name, redeemedAt: c.redeemed_at })) : [],
      requests: m.status === 'approved' ? requests(id) : [],
    };
  }

  /* ---------- the Monthly Wage of TradeBlacket ---------- */
  // Set by staff with the wage permission; paid once a month onto the card, only while the partner
  // has signed the current Business and Partner Program Agreement.
  const addMonth = t => { const d = new Date(t); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); return d.getTime(); };
  function wageView(m) {
    if (!m.wage_amount) return null;
    const usd = m.wage_currency === 'USD', by = m.wage_set_by ? staffName(m.wage_set_by) : null;
    return { amount: usd ? m.wage_amount / 100 : m.wage_amount, currency: m.wage_currency, next: m.wage_paused ? null : m.wage_next_at, last: m.wage_last_at, paused: !!m.wage_paused, note: m.wage_note, setAt: m.wage_set_at, setBy: by, roduxValue: usd ? Math.floor(m.wage_amount * perUsd() / 100) : m.wage_amount, needsSignature: !signed(m.roblox_id, 'business') };
  }
  function setWage(admin, b) {
    must(admin, 'biz.wage');
    const id = Number(b.robloxId), m = partner(id); if (!m) throw new BizError('Wages go to Trade Empire Partners.');
    const usd = String(b.currency || 'USD').toUpperCase() !== 'RODUX', amt = usd ? Math.round(Number(b.amount) * 100) : Math.floor(Number(b.amount));
    if (!(amt >= 0) || amt > (usd ? 1e7 : 1e10)) throw new BizError(usd ? 'Enter a monthly wage in dollars (0 ends it).' : 'Enter a whole number of Rodux (0 ends it).');
    const paused = b.paused ? 1 : 0, why = clean(b.note, 160) || null;
    // first payment: on the chosen day, or now; a changed amount keeps the existing schedule
    const start = b.start ? Date.parse(b.start) : NaN, next = amt === 0 ? null : (Number.isFinite(start) && start > now() - 864e5 ? start : (m.wage_next_at && m.wage_amount ? m.wage_next_at : now()));
    q.setWage.run(amt, usd ? 'USD' : 'RODUX', why, admin, now(), next, paused, id);
    note(id, 'biz', { step: amt === 0 ? 'Monthly wage ended' : `Monthly wage set to ${usd ? '$' + (amt / 100).toFixed(2) : amt + ' Rodux'}${paused ? ' (paused)' : ''}`, note: why });
    log('biz wage', id, amt, usd ? 'USD' : 'RODUX', 'by', admin);
    return adminView(admin);
  }
  // Runs every hour. Pays each due wage once and moves the date on by a month.
  function payWages() {
    const paid = [];
    for (const m of q.wageDue.all(now())) {
      if (!signed(m.roblox_id, 'business')) continue;
      const usd = m.wage_currency === 'USD', amt = m.wage_amount, ref = 'TBBW-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      const month = new Date(m.wage_next_at).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      tx(() => {
        q.money.run(usd ? amt : 0, usd ? 0 : amt, m.roblox_id);
        q.led.run(m.roblox_id, 'wage', usd ? 'USD' : 'RODUX', amt, usd ? Math.floor(amt * perUsd() / 100) : amt, `Monthly wage, ${month}`, m.wage_set_by, ref, null, now());
        let next = addMonth(m.wage_next_at); while (next <= now()) next = addMonth(next);
        q.wagePaid.run(next, now(), m.roblox_id);
      });
      note(m.roblox_id, 'biz', { step: `Monthly wage paid: ${usd ? '$' + (amt / 100).toFixed(2) : amt + ' Rodux'}`, ref });
      paid.push({ robloxId: m.roblox_id, amount: amt, currency: m.wage_currency, ref });
    }
    if (paid.length) log('biz wages paid', paid.length);
    return paid;
  }

  /* ---------- where an application stands ---------- */
  // Estimated wait: the median time moderators took on the last 25 decisions at this stage
  // (2 days when there is no history yet), plus a little for each application ahead in the queue.
  function queue(stage, since) {
    const ds = (stage === 'tepp' ? q.waitTepp : q.waitMember).all().map(r => r.d).filter(d => d > 0).sort((a, b) => a - b);
    const med = ds.length ? ds[Math.floor(ds.length / 2)] : 48 * 36e5;
    const ahead = (stage === 'tepp' ? q.aheadTepp : q.aheadMember).get(since || now()).n;
    const total = Math.max(med + ahead * 4 * 36e5, 36e5);
    return { stage, since, ahead, position: ahead + 1, pending: (stage === 'tepp' ? q.pendingTepp : q.pendingMember).get().n,
      estimateMs: total, expectedBy: (since || now()) + total, basedOn: ds.length };
  }

  /* ---------- applying ---------- */
  function apply(id, b) {
    if (isBanned(id)) throw new BizError('This account is banned, so it cannot join TradeBlacket Business.', 403);
    const m = q.get.get(id);
    if (m && (m.status === 'pending' || m.status === 'approved')) throw new BizError(m.status === 'pending' ? 'Your application is already being reviewed.' : 'You are already a member.');
    if (m && m.status === 'rejected' && now() - (m.decided_at || 0) < 7 * 864e5) throw new BizError('You can apply again 7 days after your last application was declined.');
    if (m && m.status === 'suspended') throw new BizError('Your membership is suspended. Contact support.', 403);
    const name = clean(b.name, 40), why = clean(b.why, 1000), discord = clean(b.discord, 40), audience = Math.max(0, Math.min(1e9, Math.floor(Number(b.audience) || 0)));
    const links = (Array.isArray(b.links) ? b.links : []).slice(0, 6).map(l => ({ platform: PLATFORMS.includes(l && l.platform) ? l.platform : 'other', url: clean(l && l.url, 200) })).filter(l => l.url);
    if (name.length < 2) throw new BizError('Enter your creator name.');
    if (!links.length) throw new BizError('Add at least one channel or profile link.');
    if (links.some(l => !URLRE.test(l.url))) throw new BizError('Links must be full addresses starting with https://');
    if (why.length < 30) throw new BizError('Tell us a bit more about your content (at least a couple of sentences).');
    if (!b.agree) throw new BizError('Accept the TradeBlacket Business terms to apply.');
    q.add.run(id, JSON.stringify({ name, links, audience, discord, why }), now());
    note(id, 'biz', { step: 'Applied to TradeBlacket Business' });
    log('biz apply', id);
    return view(id);
  }
  function applyTepp(id, b) {
    const m = member(id); if (!m) throw new BizError('Join TradeBlacket Business first.', 403);
    if (m.tepp === 'pending' || m.tepp === 'approved') throw new BizError(m.tepp === 'pending' ? 'Your TEPP application is being reviewed.' : 'You are already a Trade Empire Partner.');
    if (m.tepp === 'rejected' && now() - (m.tepp_decided_at || 0) < 14 * 864e5) throw new BizError('You can apply for TEPP again 14 days after it was declined.');
    const plan = clean(b.plan, 1500), cadence = clean(b.cadence, 60), sample = clean(b.sample, 200), code = clean(b.code, 16).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (plan.length < 40) throw new BizError('Describe the Trade Empire content you plan to make.');
    if (!cadence) throw new BizError('Say how often you post.');
    if (sample && !URLRE.test(sample)) throw new BizError('The example video must be a full https:// link.');
    if (!b.agree) throw new BizError('Accept the Partner Program rules to apply.');
    q.tepp.run(JSON.stringify({ plan, cadence, sample, code }), now(), id);
    note(id, 'biz', { step: 'Applied for TEPP' });
    return view(id);
  }
  function saveCard(id, b) {
    const m = partner(id); if (!m) throw new BizError('Business cards are for Trade Empire Partners.', 403);
    const card = { name: clean(b.name, 32), tagline: clean(b.tagline, 70), accent: ACCENTS.includes(b.accent) ? b.accent : 'gold',
      links: (Array.isArray(b.links) ? b.links : []).slice(0, 4).map(l => ({ platform: PLATFORMS.includes(l && l.platform) ? l.platform : 'other', url: clean(l && l.url, 200) })).filter(l => l.url && URLRE.test(l.url)),
      currency: b.currency === 'usd' ? 'usd' : 'rodux' };
    if (card.name.length < 2) throw new BizError('Put a name on your card.');
    if (!m.card && !signed(id, 'business')) throw new BizError('Sign the Business and Partner Program Agreement first.', 403);
    q.card.run(JSON.stringify(card), now(), id);
    if (!m.card) note(id, 'biz', { step: 'Created their Business Card' });
    return view(id);
  }

  /* ---------- YouTube: prove the channel is yours ---------- */
  function ytUrl(raw) {
    let s = clean(raw, 200); if (!s) return null;
    if (/^@[\w.-]{3,30}$/.test(s)) s = 'https://www.youtube.com/' + s;
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    const m = /^https?:\/\/(?:www\.|m\.)?youtube\.com\/(@[\w.-]{3,30}|channel\/UC[\w-]{20,24}|c\/[\w.-]{2,60}|user\/[\w.-]{2,60})\/?/i.exec(s);
    return m ? 'https://www.youtube.com/' + m[1] : null;
  }
  function ytStart(id, raw) {
    if (!member(id)) throw new BizError('Join TradeBlacket Business first.', 403);
    const url = ytUrl(raw); if (!url) throw new BizError('Enter your YouTube channel link, like https://www.youtube.com/@yourname');
    const phrase = 'TradeBlacket-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    q.yt.run(url, phrase, id); return view(id);
  }
  async function ytVerify(id) {
    const m = member(id); if (!m || !m.yt_url) throw new BizError('Add your channel first.');
    if (m.yt_verified) return view(id);
    let html = '';
    try { const r = await fetch(m.yt_url + '/about', { headers: { 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': 'Mozilla/5.0 TradeBlacketBusiness/1.0' }, signal: AbortSignal.timeout(10000) }); html = await r.text(); }
    catch { throw new BizError('YouTube did not answer. Try again in a minute.', 502); }
    if (!html.includes(m.yt_phrase)) throw new BizError(`We could not find ${m.yt_phrase} in your channel description yet. Save it on YouTube, wait a minute, then check again.`, 409);
    q.ytOk.run(1, id); note(id, 'biz', { step: 'Verified their YouTube channel' }); log('biz yt verified', id, m.yt_url);
    return view(id);
  }

  /* ---------- the card's money ---------- */
  // Withdraw card money as Rodux on TradeBlacket. from: 'usd' (amount in dollars) or 'rodux'.
  function withdrawRodux(id, from, amount) {
    if (!partner(id)) throw new BizError('Payouts are for Trade Empire Partners.', 403);
    if (isBanned(id)) throw new BizError('This account is banned.', 403);
    const ref = 'TBBP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    let rodux, cents = 0, rx = 0;
    if (from === 'usd') { cents = Math.round(Number(amount) * 100); if (!(cents >= 100)) throw new BizError('Withdraw at least $1.00.'); rodux = Math.floor(cents * perUsd() / 100); }
    else { rx = Math.floor(Number(amount)); if (!(rx >= 1)) throw new BizError('Enter a whole amount of Rodux.'); rodux = rx; }
    tx(() => {
      const m = q.get.get(id);
      if (cents > m.usd_cents || rx > m.rodux) throw new BizError('That is more than your card holds.');
      q.money.run(-cents, -rx, id); q.credit.run(rodux, rodux, id);
      q.led.run(id, 'withdraw-rodux', from === 'usd' ? 'USD' : 'RODUX', from === 'usd' ? -cents : -rx, rodux, from === 'usd' ? `$${(cents / 100).toFixed(2)} as Rodux` : 'To TradeBlacket balance', null, ref, null, now());
    });
    note(id, 'biz', { step: `Withdrew ${rodux} Rodux from their Business Card`, rodux, ref });
    return { ...view(id), paid: { rodux, ref } };
  }
  async function shop() {
    const L = items.houseListings();
    const d = await items.describe(L.map(l => ({ uid: l.uid, itemId: l.item_id, serial: l.serial })));
    const D = Object.fromEntries(d.map(x => [x.uid, x]));
    return { listings: L.map(l => ({ id: l.id, price: l.price, itemId: l.item_id, serial: l.serial, name: D[l.uid] && D[l.uid].name, img: D[l.uid] && D[l.uid].img, value: D[l.uid] && D[l.uid].value })), roduxPerUsd: perUsd() };
  }
  // Withdraw card money as limiteds TradeBlacket owns. Rodux on the card is used first, then dollars.
  function withdrawItems(id, listingIds) {
    if (!partner(id)) throw new BizError('Payouts are for Trade Empire Partners.', 403);
    if (isBanned(id)) throw new BizError('This account is banned.', 403);
    const pu = perUsd(), ref = 'TBBI-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    let spent = null;
    let r;
    try {
      r = items.houseGive(id, listingIds, total => {
        const m = q.get.get(id);
        const fromRodux = Math.min(m.rodux, total), restRodux = total - fromRodux, cents = Math.ceil(restRodux * 100 / pu);
        if (cents > m.usd_cents) throw new BizError(`Those items cost ${total.toLocaleString('en-US')} Rodux, more than your card holds.`);
        q.money.run(-cents, -fromRodux, id);
        spent = { total, fromRodux, cents };
      });
    } catch (e) { if (e instanceof BizError) throw e; throw new BizError(e.message || 'Those items could not be paid out.'); }
    q.led.run(id, 'withdraw-items', spent.cents ? 'USD' : 'RODUX', spent.cents ? -spent.cents : -spent.fromRodux, spent.total, `${r.uids.length} limited${r.uids.length === 1 ? '' : 's'}${spent.cents && spent.fromRodux ? ` (${spent.fromRodux} Rodux + $${(spent.cents / 100).toFixed(2)})` : ''}`, null, ref, JSON.stringify(r.uids), now());
    note(id, 'biz', { step: `Took ${r.uids.length} limited${r.uids.length === 1 ? '' : 's'} from their Business Card`, uids: r.uids, ref });
    return { ...view(id), items: r.uids.length };
  }

  /* ---------- feature requests ---------- */
  function requests(viewer) {
    return q.reqs.all().map(r => { const v = parse(r.votes, []); return { id: r.id, title: r.title, body: r.body, status: r.status, reply: r.reply, by: r.username, mine: r.roblox_id === viewer, votes: v.length, voted: v.includes(viewer), at: r.at, updated: r.updated_at }; });
  }
  function addRequest(id, b) {
    if (!member(id)) throw new BizError('Feature requests are for Business members.', 403);
    const title = clean(b.title, 90), body = clean(b.body, 1500);
    if (title.length < 6) throw new BizError('Give your request a short title.');
    if (body.length < 20) throw new BizError('Explain what you need and why.');
    const n = db.prepare('SELECT COUNT(*) AS n FROM biz_requests WHERE roblox_id = ? AND at > ?').get(id, now() - 864e5).n;
    if (n >= 5) throw new BizError('You can send 5 requests a day.');
    q.reqAdd.run(id, title, body, now(), now()); return requests(id);
  }
  function vote(id, rid) {
    if (!member(id)) throw new BizError('Voting is for Business members.', 403);
    const r = q.req.get(Number(rid)); if (!r) throw new BizError('Request not found.', 404);
    const v = parse(r.votes, []); const i = v.indexOf(id); if (i >= 0) v.splice(i, 1); else v.push(id);
    q.reqVotes.run(JSON.stringify(v), r.id); return requests(id);
  }

  /* ---------- paying with the card ---------- */
  const b64u = b => Buffer.from(b).toString('base64url');
  const unb64u = s => Buffer.from(String(s || ''), 'base64url');
  const sha = b => crypto.createHash('sha256').update(b).digest();
  const challenges = new Map();
  function challenge(id, kind) { const c = b64u(crypto.randomBytes(32)); challenges.set(id + ':' + kind, { c, exp: now() + 5 * 60e3 }); return c; }
  function takeChallenge(id, kind, c) { const k = id + ':' + kind, v = challenges.get(k); challenges.delete(k); return !!v && v.exp > now() && v.c === c; }
  const ORIGINS = new Set(['https://tradeblacket.com', 'https://www.tradeblacket.com', 'https://tradeblacketv2-production.up.railway.app', ...origins]);
  function clientData(raw, type, id, kind) {
    let cd; try { cd = JSON.parse(unb64u(raw).toString('utf8')); } catch { throw new BizError('Your device sent something unexpected. Try again.'); }
    if (cd.type !== type) throw new BizError('Your device sent something unexpected. Try again.');
    if (!ORIGINS.has(cd.origin)) throw new BizError('Device confirmation only works on tradeblacket.com.');
    if (!takeChallenge(id, kind, cd.challenge)) throw new BizError('That confirmation expired. Try again.');
    return cd;
  }
  const pinHash = pin => { const salt = crypto.randomBytes(16); return salt.toString('hex') + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex'); };
  const pinOk = (pin, h) => { if (!h) return false; const [s, v] = h.split(':'); const x = crypto.scryptSync(String(pin), Buffer.from(s, 'hex'), 32); return crypto.timingSafeEqual(x, Buffer.from(v, 'hex')); };
  // Proves a passkey assertion came from the device registered to this card.
  function deviceOk(m, a) {
    if (!a || !m.pk_id || a.id !== m.pk_id) throw new BizError('Confirm with the device you set up for your card.');
    const cd = clientData(a.clientDataJSON, 'webauthn.get', m.roblox_id, 'pay');
    const auth = unb64u(a.authenticatorData);
    if (auth.length < 37 || !auth.subarray(0, 32).equals(sha(new URL(cd.origin).hostname))) throw new BizError('Your device confirmed for a different site.');
    if ((auth[32] & 0x05) !== 0x05) throw new BizError('Your device did not confirm it was you. Try again.');
    const key = crypto.createPublicKey({ key: Buffer.from(m.pk_pub, 'base64'), format: 'der', type: 'spki' });
    const data = Buffer.concat([auth, sha(unb64u(a.clientDataJSON))]);
    const good = crypto.verify(m.pk_alg === -257 ? 'sha256' : 'sha256', data, m.pk_alg === -257 ? key : { key, dsaEncoding: 'der' }, unb64u(a.signature));
    if (!good) throw new BizError('Your device confirmation did not match. Try again.');
    const count = auth.readUInt32BE(33);
    if (count && m.pk_count && count <= m.pk_count) throw new BizError('That confirmation was already used.');
    q.pkCount.run(count, m.roblox_id);
    return true;
  }
  // Checks the confirmation the partner chose. auth: { pin } or { assertion }.
  function authorize(m, auth = {}) {
    if (m.pay_auth === 'none') return true;
    if (m.pay_auth === 'pin') {
      if (m.pin_lock > now()) throw new BizError(`Too many wrong codes. Try again in ${Math.ceil((m.pin_lock - now()) / 60e3)} minutes.`, 429);
      if (!/^\d{4,6}$/.test(String(auth.pin || ''))) throw new BizError('Enter your card code.');
      if (!pinOk(auth.pin, m.pin_hash)) { const f = m.pin_fail + 1; q.pinFail.run(f >= 5 ? 0 : f, f >= 5 ? now() + 15 * 60e3 : 0, m.roblox_id); throw new BizError(f >= 5 ? 'Too many wrong codes. Card payments are paused for 15 minutes.' : 'That code is not right.', f >= 5 ? 429 : 403); }
      if (m.pin_fail) q.pinFail.run(0, 0, m.roblox_id);
      return true;
    }
    if (m.pay_auth === 'device') return deviceOk(m, auth.assertion);
    throw new BizError('Set up how you confirm card payments first.');
  }
  const withCard = id => { const m = partner(id); if (!m) throw new BizError('Card payments are for Trade Empire Partners.', 403); if (!m.card) throw new BizError('Create your Business Card first.'); if (isBanned(id)) throw new BizError('This account is banned.', 403); return m; };

  function setSource(id, source) { withCard(id); q.setPay.run(source === 'card' ? 'card' : 'balance', id); return view(id); }
  // Change how payments are confirmed. Changing away from a code or device needs that code or device.
  function setSecurity(id, b) {
    const m = withCard(id), method = ['none', 'pin', 'device'].includes(b.method) ? b.method : null;
    if (!method) throw new BizError('Pick how you want to confirm payments.');
    if (m.pay_auth !== 'none') authorize(m, b.current || {});
    let hash = null;
    if (method === 'pin') { if (!/^\d{4,6}$/.test(String(b.pin || ''))) throw new BizError('Choose a code of 4 to 6 digits.'); hash = pinHash(b.pin); }
    if (method === 'device' && !m.pk_id) throw new BizError('Set up your device first.');
    q.setAuth.run(method, hash, id); note(id, 'biz', { step: `Card payments now confirmed with ${method === 'pin' ? 'a code' : method === 'device' ? 'their device' : 'nothing'}` });
    return view(id);
  }
  function passkeyOptions(id, kind) {
    const m = withCard(id);
    if (kind === 'pay') return { challenge: challenge(id, 'pay'), credentialId: m.pk_id };
    return { challenge: challenge(id, 'register'), userId: b64u(crypto.createHmac('sha256', String(secret)).update('pk:' + id).digest().subarray(0, 16)), name: (q.user.get(id) || {}).username || String(id) };
  }
  // Save the device's passkey. The browser hands over the public key (SPKI); the server keeps it and
  // checks every later confirmation against it.
  function passkeyRegister(id, b) {
    const m = withCard(id);
    if (m.pay_auth !== 'none' && m.pk_id) authorize(m, b.current || {});
    clientData(b.clientDataJSON, 'webauthn.create', id, 'register');
    const alg = Number(b.alg); if (alg !== -7 && alg !== -257) throw new BizError('This device uses a kind of key TradeBlacket does not support.');
    let pub; try { pub = crypto.createPublicKey({ key: unb64u(b.publicKey), format: 'der', type: 'spki' }).export({ format: 'der', type: 'spki' }); } catch { throw new BizError('Your device sent a key we could not read.'); }
    if (!/^[A-Za-z0-9_-]{16,512}$/.test(String(b.id || ''))) throw new BizError('Your device sent a key we could not read.');
    q.setPk.run(String(b.id), pub.toString('base64'), alg, id);
    note(id, 'biz', { step: 'Set up their device for card payments' });
    return view(id);
  }
  // Top up: withdrawable Rodux from the TradeBlacket balance onto the card.
  function topUp(id, amount) {
    withCard(id);
    const rx = Math.floor(Number(amount)); if (!(rx >= 1)) throw new BizError('Enter a whole amount of Rodux.');
    const ref = 'TBBT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    tx(() => {
      const u = q.user.get(id), can = withdrawable(u);
      if (rx > can) throw new BizError(can > 0 ? `You can move up to ${can.toLocaleString('en-US')} Rodux. Bonus Rodux stays on your balance.` : 'You have no Rodux that can go on the card. Bonus Rodux stays on your balance.');
      q.takeSite.run(rx, rx, id); q.money.run(0, rx, id);
      q.led.run(id, 'topup', 'RODUX', rx, rx, 'From TradeBlacket balance', null, ref, null, now());
    });
    note(id, 'biz', { step: `Topped up their card with ${rx} Rodux`, rodux: rx, ref });
    return { ...view(id), toppedUp: rx, ref };
  }
  // Pay with the card: the exact amount moves from the card to the balance, confirmed, so the
  // withdrawal or purchase that follows uses it. Rodux on the card first, then dollars.
  function pay(id, amount, auth, purpose) {
    const m = withCard(id), rx = Math.floor(Number(amount));
    if (!(rx >= 1)) throw new BizError('Nothing to pay.');
    authorize(m, auth);
    const pu = perUsd(), ref = 'TBBP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    tx(() => {
      const c = q.get.get(id), fromRodux = Math.min(c.rodux, rx), cents = Math.ceil((rx - fromRodux) * 100 / pu);
      if (cents > c.usd_cents) throw new BizError('Your card does not hold enough for this.');
      q.money.run(-cents, -fromRodux, id); q.credit.run(rx, rx, id);
      q.led.run(id, 'card-pay', cents ? 'USD' : 'RODUX', cents ? -cents : -fromRodux, rx, clean(purpose, 60) || 'Card payment', null, ref, null, now());
    });
    note(id, 'biz', { step: `Paid ${rx} Rodux with their Business Card`, rodux: rx, ref, note: clean(purpose, 60) });
    return { ...view(id), paid: rx, ref };
  }

  /* ---------- moderators ---------- */
  const must = (a, perm) => { if (!isAdmin(a) || (perm && !can(a, perm))) throw new BizError('Your staff rank cannot do that.', 403); };
  function adminView(admin) {
    must(admin);
    const rows = q.all.all();
    return { roduxPerUsd: perUsd(), members: rows.map(m => ({ robloxId: m.roblox_id, username: m.username, status: m.status, appliedAt: m.applied_at, decidedAt: m.decided_at, note: m.note, form: parse(m.form, {}),
      tepp: m.tepp, teppAt: m.tepp_at, teppForm: parse(m.tepp_form, null), teppNote: m.tepp_note, card: parse(m.card, null), cardNo: cardNo(m.roblox_id),
      balance: { usd: m.usd_cents / 100, rodux: m.rodux }, youtube: { url: m.yt_url, verified: !!m.yt_verified }, codes: q.codes.all(m.roblox_id).length, wage: wageView(m), agreement: signed(m.roblox_id, 'business') })), requests: requests(admin) };
  }
  function decide(admin, b) {
    must(admin);
    const id = Number(b.robloxId), m = q.get.get(id); if (!m) throw new BizError('No application from that player.', 404);
    const approve = !!b.approve, why = clean(b.note, 300) || null;
    if (b.stage === 'tepp') {
      if (m.status !== 'approved') throw new BizError('Approve their Business membership first.');
      q.teppDecide.run(approve ? 'approved' : 'rejected', now(), why, id);
      note(id, 'biz', { step: approve ? 'Became a Trade Empire Partner' : 'TEPP application declined', note: why });
    } else if (b.stage === 'suspend') {
      q.decide.run('suspended', now(), admin, why, id); note(id, 'biz', { step: 'Business membership suspended', note: why });
    } else {
      q.decide.run(approve ? 'approved' : 'rejected', now(), admin, why, id);
      // approved creators get into the site too
      if (approve) try { siteList.grant(admin, id); } catch {}
      note(id, 'biz', { step: approve ? 'Approved for TradeBlacket Business' : 'Business application declined', note: why });
    }
    log('biz decide', b.stage || 'member', id, approve, 'by', admin);
    return adminView(admin);
  }
  function payout(admin, b) {
    must(admin);
    const id = Number(b.robloxId); if (!partner(id)) throw new BizError('Payouts go to Trade Empire Partners.');
    const usd = b.currency === 'usd', amt = usd ? Math.round(Number(b.amount) * 100) : Math.floor(Number(b.amount));
    if (!(amt > 0) || amt > (usd ? 1e8 : 1e10)) throw new BizError(usd ? 'Enter an amount in dollars.' : 'Enter a whole amount of Rodux.');
    const why = clean(b.note, 120) || 'Partner payout', ref = 'TBBC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    tx(() => { q.money.run(usd ? amt : 0, usd ? 0 : amt, id); q.led.run(id, 'payout', usd ? 'USD' : 'RODUX', amt, usd ? Math.floor(amt * perUsd() / 100) : amt, why, admin, ref, null, now()); });
    note(id, 'biz', { step: `Business Card paid ${usd ? '$' + (amt / 100).toFixed(2) : amt + ' Rodux'}`, note: why, ref });
    log('biz payout', id, usd ? '$' + amt / 100 : amt + ' Rodux', 'by', admin);
    return adminView(admin);
  }
  function giveCodes(admin, b) {
    must(admin);
    const id = Number(b.robloxId); if (!member(id)) throw new BizError('Giveaway codes go to Business members.');
    const r = gifts.make(admin, { usd: b.usd, count: b.count, note: `Giveaway for ${(db.prepare('SELECT username FROM users WHERE roblox_id = ?').get(id) || {}).username || id}`, days: b.days });
    tx(() => r.codes.forEach(c => q.assign.run(id, c)));
    note(id, 'biz', { step: `Received ${r.codes.length} USD $${r.usd} giveaway code${r.codes.length === 1 ? '' : 's'}` });
    return adminView(admin);
  }
  function setRequest(admin, b) {
    must(admin);
    const r = q.req.get(Number(b.id)); if (!r) throw new BizError('Request not found.', 404);
    const st = ['open', 'planned', 'building', 'done', 'declined'].includes(b.status) ? b.status : r.status;
    q.reqSet.run(st, clean(b.reply, 600) || null, now(), r.id); return adminView(admin);
  }
  function setYoutube(admin, b) { must(admin); q.ytOk.run(b.verified ? 1 : 0, Number(b.robloxId)); return adminView(admin); }

  return { setWage, payWages, setSource, setSecurity, passkeyOptions, passkeyRegister, topUp, pay, badge, view, apply, applyTepp, saveCard, ytStart, ytVerify, withdrawRodux, withdrawItems, shop, requests, addRequest, vote,
    adminView, decide, payout, giveCodes, setRequest, setYoutube, payouts: id => q.payouts.all(id), cardNo, BizError };
}

module.exports = { create };
