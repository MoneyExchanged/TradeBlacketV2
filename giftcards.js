// Gift cards: $5, $10, $100 or $500 of Rodux, given away by the Trade Empire team and the content
// creators they hand codes to. Nobody can buy one on TradeBlacket: admins make them, players redeem.
//
// What a dollar is worth in Rodux comes from what Rodux costs in Trade Empire:
//   1. Read the game's Rodux developer products ("5,000 Cash" for 45 Robux, ...), at their base price.
//   2. Take Rodux per Robux for each pack and use the MEDIAN, so neither the small starter pack nor
//      a one-off bargain pack decides the rate.
//   3. Multiply by Robux per US dollar (ROBUX_PER_USD, default 80: Roblox sells 400 Robux for $4.99).
// The products are re-read every 6 hours; if Roblox does not answer, the last known packs are used.
// A card is worth what a dollar buys at the moment it is redeemed.
'use strict';
const crypto = require('node:crypto');

const VALUES = [5, 10, 100, 500];
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROBUX_PER_USD = Number(process.env.ROBUX_PER_USD) > 0 ? Number(process.env.ROBUX_PER_USD) : 80;
// The game's Rodux packs on 15 October 2026 (name, base price in Robux), used until the live list loads.
const KNOWN = [['5,000 Cash', 45], ['15,000 Cash', 129], ['25,000 Cash', 125], ['50,000 Cash', 349], ['75,000 Cash', 499], ['100,000 Cash', 649], ['500,000 Cash', 4000]];
class GiftError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }
const newCode = () => { const b = crypto.randomBytes(12); let s = ''; for (let i = 0; i < 12; i++) s += ALPHA[b[i] % 32]; return `TBG-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`; };
const norm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const mask = c => c.slice(0, 4) + '-••••-••••-' + c.slice(-4);

function packsFrom(list) {
  return list.map(([name, robux]) => {
    const m = /^\s*([\d,.]+)\s*(k)?\s*(cash|rodux)\b/i.exec(String(name));
    if (!m || !(robux > 0)) return null;
    const rodux = Math.round(Number(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1));
    return rodux > 0 ? { name: String(name), rodux, robux, perRobux: rodux / robux } : null;
  }).filter(Boolean);
}
const median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

function create({ db, tx, log = () => {}, isAdmin, universe, isBanned, siteOk, note = () => {} }) {
  db.exec(`CREATE TABLE IF NOT EXISTS gift_cards (code TEXT PRIMARY KEY, usd INTEGER NOT NULL, withdrawable INTEGER NOT NULL DEFAULT 0, note TEXT, created_by INTEGER, created_at INTEGER NOT NULL, expires_at INTEGER,
    status TEXT NOT NULL DEFAULT 'active', redeemed_by INTEGER, redeemed_at INTEGER, rodux INTEGER, ref TEXT);
    CREATE INDEX IF NOT EXISTS gift_cards_user ON gift_cards (redeemed_by, redeemed_at DESC);`);
  const q = {
    get: db.prepare('SELECT * FROM gift_cards WHERE code = ?'),
    add: db.prepare('INSERT INTO gift_cards (code, usd, withdrawable, note, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?)'),
    redeem: db.prepare("UPDATE gift_cards SET status = 'redeemed', redeemed_by = ?, redeemed_at = ?, rodux = ?, ref = ? WHERE code = ? AND status = 'active'"),
    void: db.prepare("UPDATE gift_cards SET status = 'void' WHERE code = ? AND status = 'active'"),
    list: db.prepare('SELECT g.*, u.username AS redeemed_name, c.username AS created_name FROM gift_cards g LEFT JOIN users u ON u.roblox_id = g.redeemed_by LEFT JOIN users c ON c.roblox_id = g.created_by ORDER BY g.created_at DESC LIMIT 500'),
    bonus: db.prepare('UPDATE users SET balance = balance + ?, bonus_lock = bonus_lock + ? WHERE roblox_id = ?'),
    real: db.prepare('UPDATE users SET balance = balance + ?, deposited = deposited + ? WHERE roblox_id = ?'),
    mine: db.prepare("SELECT * FROM gift_cards WHERE redeemed_by = ? AND status = 'redeemed' ORDER BY redeemed_at DESC LIMIT 25"),
  };

  /* ---------- the rate ---------- */
  let packs = packsFrom(KNOWN), source = 'Rodux packs as of 15 October 2026', fetchedAt = 0;
  async function refresh() {
    if (Date.now() - fetchedAt < 6 * 36e5) return;
    fetchedAt = Date.now();
    try {
      const r = await fetch(`https://apis.roblox.com/developer-products/v2/universes/${universe}/developerproducts?limit=50`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('roblox ' + r.status);
      const j = await r.json();
      const live = packsFrom((j.developerProducts || []).filter(p => p.IsForSale).map(p => [p.Name || p.displayName, Number(p.UserBasePriceInRobux || p.PriceInRobux)]));
      if (live.length) { packs = live; source = 'Trade Empire Rodux packs, read live from Roblox'; }
    } catch (e) { log('gift rate', e.message); }
  }
  function rate() {
    const perRobux = median(packs.map(p => p.perRobux));
    const perUsd = Math.round(perRobux * ROBUX_PER_USD);
    return { roduxPerUsd: perUsd, roduxPerRobux: Math.round(perRobux * 100) / 100, robuxPerUsd: ROBUX_PER_USD, packs, source,
      values: VALUES.map(usd => ({ usd, rodux: Math.round(usd * perUsd) })) };
  }
  refresh().catch(() => {}); setInterval(() => refresh().catch(() => {}), 36e5).unref();

  /* ---------- admin ---------- */
  function make(admin, b) {
    if (!isAdmin(admin)) throw new GiftError('Only admins can make gift cards.', 403);
    const usd = Number(b.usd); if (!VALUES.includes(usd)) throw new GiftError('Pick $5, $10, $100 or $500.');
    const count = Math.min(100, Math.max(1, Math.floor(Number(b.count) || 1)));
    const days = Math.floor(Number(b.days) || 0), expires = days > 0 ? Date.now() + Math.min(days, 3650) * 864e5 : null;
    const noteTxt = String(b.note || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80) || null;
    const out = [];
    tx(() => { for (let i = 0; i < count; i++) { const c = newCode(); q.add.run(c, usd, b.withdrawable ? 1 : 0, noteTxt, admin, Date.now(), expires); out.push(c); } });
    log('gift cards made', admin, count, '$' + usd);
    return { codes: out, usd, rodux: Math.round(usd * rate().roduxPerUsd), withdrawable: !!b.withdrawable, expires };
  }
  function voidCard(admin, code) {
    if (!isAdmin(admin)) throw new GiftError('Only admins can do that.', 403);
    const c = 'TBG' + norm(code).replace(/^TBG/, '');
    const fmtd = `TBG-${c.slice(3, 7)}-${c.slice(7, 11)}-${c.slice(11, 15)}`;
    if (!q.void.run(fmtd).changes) throw new GiftError('That card is not active.');
    return { ok: true };
  }
  function adminView(admin) {
    if (!isAdmin(admin)) throw new GiftError('Only admins can do that.', 403);
    const rows = q.list.all();
    return { rate: rate(), cards: rows.map(g => ({ code: g.code, usd: g.usd, withdrawable: !!g.withdrawable, note: g.note, by: g.created_name, at: g.created_at, expires: g.expires_at,
      status: g.status === 'active' && g.expires_at && g.expires_at < Date.now() ? 'expired' : g.status, redeemedBy: g.redeemed_name, redeemedId: g.redeemed_by, redeemedAt: g.redeemed_at, rodux: g.rodux })),
      totals: { made: rows.length, redeemed: rows.filter(g => g.status === 'redeemed').length, usdRedeemed: rows.filter(g => g.status === 'redeemed').reduce((s, g) => s + g.usd, 0), roduxRedeemed: rows.reduce((s, g) => s + (g.rodux || 0), 0) } };
  }

  /* ---------- players ---------- */
  function redeem(id, raw) {
    const c = norm(raw), body = c.startsWith('TBG') ? c.slice(3) : c;
    if (body.length !== 12) throw new GiftError('Enter the whole gift card code, like TBG-ABCD-EFGH-JKLM.');
    if (isBanned(id)) throw new GiftError('This account is banned, so it cannot redeem gift cards.', 403);
    if (!siteOk(id)) throw new GiftError('Get into TradeBlacket first, then redeem your gift card.', 403);
    const code = `TBG-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
    const r = rate();
    const res = tx(() => {
      const g = q.get.get(code);
      if (!g) throw new GiftError('That gift card code does not exist. Check it and try again.');
      if (g.status === 'redeemed') throw new GiftError(g.redeemed_by === id ? 'You already redeemed this gift card.' : 'This gift card has already been redeemed.');
      if (g.status !== 'active') throw new GiftError('This gift card is no longer valid.');
      if (g.expires_at && g.expires_at < Date.now()) throw new GiftError('This gift card has expired.');
      const rodux = Math.round(g.usd * r.roduxPerUsd), ref = 'TBGC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      if (!q.redeem.run(id, Date.now(), rodux, ref, code).changes) throw new GiftError('This gift card has already been redeemed.');
      (g.withdrawable ? q.real : q.bonus).run(rodux, rodux, id);
      return { usd: g.usd, rodux, ref, withdrawable: !!g.withdrawable };
    });
    log('gift card redeemed', id, '$' + res.usd, res.rodux);
    note(id, 'gift', { usd: res.usd, rodux: res.rodux, ref: res.ref, withdrawable: res.withdrawable });
    return { ...res, code: mask(code) };
  }
  // for the wallet history (the browser adds these to the play balance once each)
  const payouts = id => q.mine.all(id).map(g => ({ kind: g.withdrawable ? 'deposit' : 'bonus', amount: g.rodux, status: 'ok', reference: g.ref, reason: `USD $${g.usd} gift card`, created_at: g.redeemed_at }));

  return { VALUES, rate, refresh, make, voidCard, adminView, redeem, payouts, GiftError, _packsFrom: packsFrom };
}

module.exports = { create, packsFrom, median, VALUES };
