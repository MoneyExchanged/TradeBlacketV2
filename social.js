// Wallet IDs, TradePlus status, profiles and support tickets.
//
//   Wallet ID   A stable, public id for each account (TBW-XXXX-XXXX), shown in the wallet and used by
//               support to find an account without asking for anything private.
//   TradePlus   Read from the player's Trade Empire save: Data.subscription = { tier, expiration }.
//               Any active tier (TradePlus, Essential, Silver, Platinum, Diamond) unlocks profile
//               customisation on TradeBlacket. Cached for 10 minutes.
//   Profiles    Bio, pronouns and, for TradePlus members, banner, accent colours, profile effect and
//               name style. Everyone can view anyone's profile.
//   Support     Tickets with a conversation; admins see every ticket and reply as TradeBlacket Support.
'use strict';
const crypto = require('node:crypto');

const TIERS = ['TradePlus', 'Essential', 'Silver', 'Platinum', 'Diamond'];
const B32 = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const BANNERS = ['aurora', 'ocean', 'sunset', 'ember', 'matrix', 'royal', 'gold', 'obsidian', 'sapphire', 'emerald'];
const EFFECTS = ['none', 'sparkle', 'glow', 'orbit', 'rain'];
const NAMESTYLES = ['plain', 'gold', 'gradient', 'glow'];
const hex = v => /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : null;
class SocialError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }

function create({ db, tx, log, isAdmin, readSave, secret }) {
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('profile')) db.exec("ALTER TABLE users ADD COLUMN profile TEXT NOT NULL DEFAULT '{}'");
  if (!cols.includes('tier')) db.exec('ALTER TABLE users ADD COLUMN tier TEXT');
  if (!cols.includes('tier_at')) db.exec('ALTER TABLE users ADD COLUMN tier_at INTEGER NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, roblox_id INTEGER NOT NULL, subject TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS tickets_user ON tickets (roblox_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS ticket_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT NOT NULL, staff INTEGER NOT NULL DEFAULT 0, author INTEGER NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL);`);
  const q = {
    user: db.prepare('SELECT * FROM users WHERE roblox_id = ?'),
    byName: db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)'),
    setProfile: db.prepare('UPDATE users SET profile = ? WHERE roblox_id = ?'),
    setTier: db.prepare('UPDATE users SET tier = ?, tier_at = ? WHERE roblox_id = ?'),
    myTickets: db.prepare('SELECT * FROM tickets WHERE roblox_id = ? ORDER BY updated_at DESC LIMIT 50'),
    allTickets: db.prepare("SELECT t.*, u.username FROM tickets t LEFT JOIN users u ON u.roblox_id = t.roblox_id ORDER BY (t.status = 'closed'), t.updated_at DESC LIMIT 200"),
    ticket: db.prepare('SELECT * FROM tickets WHERE id = ?'),
    addTicket: db.prepare('INSERT INTO tickets (id, roblox_id, subject, category, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'),
    touch: db.prepare('UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?'),
    msgs: db.prepare('SELECT staff, body, at FROM ticket_msgs WHERE ticket_id = ? ORDER BY id'),
    addMsg: db.prepare('INSERT INTO ticket_msgs (ticket_id, staff, author, body, at) VALUES (?,?,?,?,?)'),
    openCount: db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE roblox_id = ? AND status != 'closed'"),
  };
  const now = () => Date.now();

  function walletId(robloxId) {
    const h = crypto.createHmac('sha256', String(secret || 'tb')).update('wallet:' + robloxId).digest();
    let s = ''; for (let i = 0; i < 8; i++) s += B32[h[i] % B32.length];
    return `TBW-${s.slice(0, 4)}-${s.slice(4)}`;
  }

  async function tier(robloxId, force) {
    const u = q.user.get(robloxId); if (!u) return null;
    if (!force && u.tier_at && now() - u.tier_at < 10 * 60e3) return u.tier || null;
    let t = null;
    try {
      const save = await readSave(robloxId);
      const sub = save && save.Data && save.Data.subscription;
      if (sub && TIERS.includes(sub.tier) && Number(sub.expiration) * 1000 > now()) t = sub.tier;
    } catch (e) { log('tier', e.message); return u.tier || null; }
    if (!t && isAdmin(robloxId)) t = 'Diamond';
    q.setTier.run(t, now(), robloxId);
    return t;
  }

  function parse(u) { try { return JSON.parse(u.profile || '{}'); } catch { return {}; } }
  function publicProfile(u, viewer) {
    const p = parse(u), plus = !!u.tier;
    return {
      robloxId: u.roblox_id, username: u.username, walletId: walletId(u.roblox_id), tier: u.tier || null, joined: u.created_at,
      bio: p.bio || '', pronouns: p.pronouns || '', status: p.status || '',
      banner: plus ? p.banner || 'gold' : 'default', accent: plus ? p.accent || null : null, accent2: plus ? p.accent2 || null : null,
      effect: plus ? p.effect || 'none' : 'none', nameStyle: plus ? p.nameStyle || 'plain' : 'plain',
      showcase: Array.isArray(p.showcase) ? p.showcase.slice(0, 6) : [], me: viewer === u.roblox_id,
      admin: isAdmin(u.roblox_id),
    };
  }
  async function getProfile(name, viewer) {
    const u = q.byName.get(String(name || '')); if (!u) throw new SocialError('No player with that name.', 404);
    if (viewer === u.roblox_id) await tier(u.roblox_id);
    return publicProfile(q.user.get(u.roblox_id), viewer);
  }
  async function updateProfile(robloxId, b) {
    const u = q.user.get(robloxId); if (!u) throw new SocialError('Sign in first.', 401);
    const t = await tier(robloxId), p = parse(u);
    const text = (v, n) => String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
    if ('bio' in b) p.bio = text(b.bio, 190);
    if ('pronouns' in b) p.pronouns = text(b.pronouns, 24);
    if ('status' in b) p.status = text(b.status, 60);
    if ('showcase' in b && Array.isArray(b.showcase)) p.showcase = b.showcase.map(String).slice(0, 6);
    const perks = ['banner', 'accent', 'accent2', 'effect', 'nameStyle'].filter(k => k in b);
    if (perks.length && !t) throw new SocialError('Profile themes are a TradePlus perk. Subscribe in Trade Empire to unlock them.', 403);
    if ('banner' in b) { if (!BANNERS.includes(b.banner)) throw new SocialError('Pick a banner from the list.'); p.banner = b.banner; }
    if ('accent' in b) p.accent = b.accent ? hex(b.accent) : null;
    if ('accent2' in b) p.accent2 = b.accent2 ? hex(b.accent2) : null;
    if ('effect' in b) { if (!EFFECTS.includes(b.effect)) throw new SocialError('Pick an effect from the list.'); p.effect = b.effect; }
    if ('nameStyle' in b) { if (!NAMESTYLES.includes(b.nameStyle)) throw new SocialError('Pick a name style from the list.'); p.nameStyle = b.nameStyle; }
    q.setProfile.run(JSON.stringify(p), robloxId);
    return publicProfile(q.user.get(robloxId), robloxId);
  }

  /* ---------- support ---------- */
  const CATS = ['deposit', 'withdraw', 'limiteds', 'game', 'account', 'other'];
  function view(t, viewer) { return { id: t.id, subject: t.subject, category: t.category, status: t.status, created: t.created_at, updated: t.updated_at, player: t.username, walletId: walletId(t.roblox_id), messages: q.msgs.all(t.id) }; }
  function tickets(viewer) {
    if (isAdmin(viewer)) return { admin: true, tickets: q.allTickets.all().map(t => view(t, viewer)) };
    return { admin: false, tickets: q.myTickets.all(viewer).map(t => view(t, viewer)) };
  }
  function openTicket(viewer, b) {
    const subject = String(b.subject || '').trim().slice(0, 90), body = String(b.body || '').trim().slice(0, 4000);
    const category = CATS.includes(b.category) ? b.category : 'other';
    if (subject.length < 4) throw new SocialError('Give your ticket a short subject.');
    if (body.length < 10) throw new SocialError('Tell us a little more about what happened.');
    if (q.openCount.get(viewer).n >= 5) throw new SocialError('You have 5 open tickets. Wait for a reply or close one first.');
    const id = 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    tx(() => { q.addTicket.run(id, viewer, subject, category, 'open', now(), now()); q.addMsg.run(id, 0, viewer, body, now()); });
    log('ticket', id, viewer, category);
    return view({ ...q.ticket.get(id), username: q.user.get(viewer).username }, viewer);
  }
  function reply(viewer, id, body) {
    const t = q.ticket.get(String(id)); body = String(body || '').trim().slice(0, 4000);
    const staff = isAdmin(viewer);
    if (!t || (t.roblox_id !== viewer && !staff)) throw new SocialError('Ticket not found.', 404);
    if (body.length < 1) throw new SocialError('Write a message first.');
    const asStaff = staff && t.roblox_id !== viewer ? 1 : 0;
    tx(() => { q.addMsg.run(t.id, asStaff, viewer, body, now()); q.touch.run(asStaff ? 'answered' : 'open', now(), t.id); });
    return view({ ...q.ticket.get(t.id), username: q.user.get(t.roblox_id).username }, viewer);
  }
  function close(viewer, id) {
    const t = q.ticket.get(String(id));
    if (!t || (t.roblox_id !== viewer && !isAdmin(viewer))) throw new SocialError('Ticket not found.', 404);
    q.touch.run('closed', now(), t.id); return { ok: true };
  }

  return { walletId, tier, getProfile, updateProfile, tickets, openTicket, reply, close, SocialError, BANNERS, EFFECTS, NAMESTYLES };
}

module.exports = { create, TIERS };
