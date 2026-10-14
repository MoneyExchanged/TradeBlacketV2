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

function create({ db, tx, log, isAdmin, readSave, secret, uploadDir, forPlayer = s => s, badge = () => null }) {
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('profile')) db.exec("ALTER TABLE users ADD COLUMN profile TEXT NOT NULL DEFAULT '{}'");
  if (!cols.includes('tier')) db.exec('ALTER TABLE users ADD COLUMN tier TEXT');
  if (!cols.includes('tier_at')) db.exec('ALTER TABLE users ADD COLUMN tier_at INTEGER NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, roblox_id INTEGER NOT NULL, subject TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS tickets_user ON tickets (roblox_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS ticket_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT NOT NULL, staff INTEGER NOT NULL DEFAULT 0, author INTEGER NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, owner INTEGER NOT NULL, ticket_id TEXT, mime TEXT NOT NULL, size INTEGER NOT NULL, at INTEGER NOT NULL);`);
  { const t = db.prepare('PRAGMA table_info(tickets)').all().map(c => c.name);
    if (!t.includes('snapshot')) db.exec('ALTER TABLE tickets ADD COLUMN snapshot TEXT');
    if (!t.includes('reported')) db.exec('ALTER TABLE tickets ADD COLUMN reported TEXT');
    const m = db.prepare('PRAGMA table_info(ticket_msgs)').all().map(c => c.name);
    // kind: 'msg' (someone wrote it), 'system' (a staff action), 'account' (an account snapshot, body is JSON)
    if (!m.includes('kind')) db.exec("ALTER TABLE ticket_msgs ADD COLUMN kind TEXT NOT NULL DEFAULT 'msg'");
    if (!m.includes('internal')) db.exec('ALTER TABLE ticket_msgs ADD COLUMN internal INTEGER NOT NULL DEFAULT 0');
    if (!m.includes('files')) db.exec("ALTER TABLE ticket_msgs ADD COLUMN files TEXT NOT NULL DEFAULT '[]'"); }
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
    msgs: db.prepare('SELECT m.id, m.staff, m.author, m.body, m.at, m.kind, m.internal, m.files, u.username AS author_name FROM ticket_msgs m LEFT JOIN users u ON u.roblox_id = m.author WHERE m.ticket_id = ? ORDER BY m.id'),
    addMsg: db.prepare("INSERT INTO ticket_msgs (ticket_id, staff, author, body, at, kind, internal, files) VALUES (?,?,?,?,?,?,?,?)"),
    setSnap: db.prepare('UPDATE tickets SET snapshot = ? WHERE id = ?'),
    addFile: db.prepare('INSERT INTO attachments (id, owner, ticket_id, mime, size, at) VALUES (?,?,NULL,?,?,?)'),
    file: db.prepare('SELECT * FROM attachments WHERE id = ?'),
    claim: db.prepare('UPDATE attachments SET ticket_id = ? WHERE id = ? AND owner = ? AND ticket_id IS NULL'),
    recentFiles: db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE owner = ? AND at > ?'),
    staleFiles: db.prepare('SELECT id FROM attachments WHERE ticket_id IS NULL AND at < ?'),
    dropFile: db.prepare('DELETE FROM attachments WHERE id = ?'),
    userTickets: db.prepare('SELECT * FROM tickets WHERE roblox_id = ? ORDER BY updated_at DESC LIMIT 50'),
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
      admin: isAdmin(u.roblox_id), business: badge(u.roblox_id),
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
  const CATS = ['deposit', 'withdraw', 'limiteds', 'game', 'account', 'appeal', 'report', 'bug', 'business', 'other'];
  const fs = require('node:fs'), path = require('node:path');
  if (uploadDir) try { fs.mkdirSync(uploadDir, { recursive: true }); } catch {}
  const parseFiles = f => { try { const a = JSON.parse(f || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
  function msgView(m, staffViewer, t) {
    const base = { id: m.id, kind: m.kind || 'msg', staff: !!m.staff, at: m.at, internal: !!m.internal, files: parseFiles(m.files).map(id => ({ id, url: `/api/support/file/${id}` })) };
    if (base.kind === 'account') { let snap = null; try { snap = JSON.parse(m.body); } catch {} return { ...base, account: staffViewer ? snap : forPlayer(snap) }; }
    const who = m.staff ? (staffViewer ? `${m.author_name || 'Staff'} (staff)` : 'TradeBlacket Support') : (staffViewer ? (t.username || 'Player') : 'You');
    return { ...base, author: base.kind === 'system' ? 'TradeBlacket' : who, body: m.body };
  }
  function view(t, viewer) {
    const staffViewer = isAdmin(viewer) && t.roblox_id !== viewer;
    let snap = null; try { snap = t.snapshot ? JSON.parse(t.snapshot) : null; } catch {}
    return {
      id: t.id, subject: t.subject, category: t.category, status: t.status, created: t.created_at, updated: t.updated_at,
      player: t.username, robloxId: staffViewer ? t.roblox_id : undefined, walletId: walletId(t.roblox_id), reported: t.reported || null,
      account: staffViewer ? snap : forPlayer(snap), staffView: staffViewer,
      messages: q.msgs.all(t.id).filter(m => staffViewer || !m.internal).map(m => msgView(m, staffViewer, t)),
    };
  }
  function tickets(viewer) {
    if (isAdmin(viewer)) return { admin: true, tickets: q.allTickets.all().map(t => view(t, viewer)) };
    const u = q.user.get(viewer) || {};
    return { admin: false, tickets: q.myTickets.all(viewer).map(t => view({ ...t, username: u.username }, viewer)) };
  }
  // Attachments the sender uploaded and has not used yet; anything else is ignored.
  function claimFiles(viewer, ticketId, ids) {
    const out = [];
    for (const id of (Array.isArray(ids) ? ids : []).slice(0, 4)) if (/^[0-9a-f]{24}$/.test(String(id)) && q.claim.run(ticketId, String(id), viewer).changes) out.push(String(id));
    return out;
  }
  const clean = (v, n) => String(v || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
  // snapshot: the player's account, taken when the ticket is opened (see account.js)
  function openTicket(viewer, b, snapshot) {
    const subject = clean(b.subject, 90), body = clean(b.body, 4000);
    const category = CATS.includes(b.category) ? b.category : 'other';
    const reported = category === 'report' ? clean(b.reported, 20) : null;
    if (subject.length < 4) throw new SocialError('Give your ticket a short subject.');
    if (body.length < 10) throw new SocialError('Tell us a little more about what happened.');
    if (category === 'report' && !/^[A-Za-z0-9_]{3,20}$/.test(reported || '')) throw new SocialError('Enter the Roblox username of the player you are reporting.');
    if (q.openCount.get(viewer).n >= 5) throw new SocialError('You have 5 open tickets. Wait for a reply or close one first.');
    const id = 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    tx(() => {
      q.addTicket.run(id, viewer, subject, category, 'open', now(), now());
      if (reported) db.prepare('UPDATE tickets SET reported = ? WHERE id = ?').run(reported, id);
      if (snapshot) { q.setSnap.run(JSON.stringify(snapshot), id); q.addMsg.run(id, 0, viewer, JSON.stringify(snapshot), now(), 'account', 0, '[]'); }
      const files = claimFiles(viewer, id, b.files);
      q.addMsg.run(id, 0, viewer, body, now(), 'msg', 0, JSON.stringify(files));
    });
    log('ticket', id, viewer, category);
    return view({ ...q.ticket.get(id), username: (q.user.get(viewer) || {}).username }, viewer);
  }
  function reply(viewer, id, body, files, internal) {
    const t = q.ticket.get(String(id)); body = clean(body, 4000);
    const staff = isAdmin(viewer);
    if (!t || (t.roblox_id !== viewer && !staff)) throw new SocialError('Ticket not found.', 404);
    const asStaff = staff && t.roblox_id !== viewer ? 1 : 0, inner = asStaff && internal ? 1 : 0;
    if (t.status === 'closed' && !asStaff) throw new SocialError('This ticket is closed. Open a new one if you still need help.');
    tx(() => {
      const f = claimFiles(viewer, t.id, files);
      if (body.length < 1 && !f.length) throw new SocialError('Write a message or attach a screenshot first.');
      q.addMsg.run(t.id, asStaff, viewer, body, now(), 'msg', inner, JSON.stringify(f));
      if (!inner) q.touch.run(asStaff ? 'answered' : 'open', now(), t.id);
    });
    return view({ ...q.ticket.get(t.id), username: q.user.get(t.roblox_id).username }, viewer);
  }
  // A line from TradeBlacket in the conversation, e.g. a staff action. internal: staff only.
  function system(ticketId, author, text, internal) {
    const t = q.ticket.get(String(ticketId)); if (!t || !text) return;
    q.addMsg.run(t.id, 1, author, String(text).slice(0, 1000), now(), 'system', internal ? 1 : 0, '[]');
    if (!internal) q.touch.run(t.status === 'closed' ? 'closed' : 'answered', now(), t.id);
  }
  function pushAccount(viewer, ticketId, snapshot) {
    const t = q.ticket.get(String(ticketId));
    if (!t || !isAdmin(viewer)) throw new SocialError('Ticket not found.', 404);
    tx(() => { q.setSnap.run(JSON.stringify(snapshot), t.id); q.addMsg.run(t.id, 1, viewer, JSON.stringify(snapshot), now(), 'account', 1, '[]'); });
    return view({ ...q.ticket.get(t.id), username: q.user.get(t.roblox_id).username }, viewer);
  }
  function ticketOwner(id) { const t = q.ticket.get(String(id)); return t ? t.roblox_id : null; }
  function close(viewer, id) {
    const t = q.ticket.get(String(id));
    if (!t || (t.roblox_id !== viewer && !isAdmin(viewer))) throw new SocialError('Ticket not found.', 404);
    q.touch.run('closed', now(), t.id); return { ok: true };
  }
  function reopen(viewer, id) {
    const t = q.ticket.get(String(id));
    if (!t || !isAdmin(viewer)) throw new SocialError('Ticket not found.', 404);
    q.touch.run('open', now(), t.id); return { ok: true };
  }

  /* ---------- screenshots ---------- */
  // Images only, checked by their first bytes, at most 5 MB, 40 a day per player. Stored on the
  // volume and only ever served to the player who sent them, the ticket's owner and staff.
  const MAGIC = [['image/png', b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47], ['image/jpeg', b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
    ['image/gif', b => b.slice(0, 4).toString('latin1') === 'GIF8'], ['image/webp', b => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP']];
  const MAX_FILE = 5 * 1024 * 1024;
  function upload(viewer, buf) {
    if (!uploadDir) throw new SocialError('Uploads are not set up.', 503);
    if (!buf || buf.length < 16) throw new SocialError('That file is empty.');
    if (buf.length > MAX_FILE) throw new SocialError('Screenshots can be up to 5 MB.', 413);
    const m = MAGIC.find(([, f]) => f(buf)); if (!m) throw new SocialError('Only PNG, JPEG, GIF or WebP images can be attached.', 415);
    if (q.recentFiles.get(viewer, now() - 864e5).n >= 40) throw new SocialError('You have uploaded a lot today. Try again tomorrow.', 429);
    const id = crypto.randomBytes(12).toString('hex');
    fs.writeFileSync(path.join(uploadDir, id), buf);
    q.addFile.run(id, viewer, m[0], buf.length, now());
    return { id, url: `/api/support/file/${id}`, mime: m[0], size: buf.length };
  }
  function file(viewer, id) {
    const f = /^[0-9a-f]{24}$/.test(String(id)) ? q.file.get(String(id)) : null;
    if (!f) return null;
    const owner = f.ticket_id ? ticketOwner(f.ticket_id) : null;
    if (f.owner !== viewer && owner !== viewer && !isAdmin(viewer)) return null;
    return { path: path.join(uploadDir, f.id), mime: f.mime, size: f.size };
  }
  // uploads never attached to a ticket are removed after a day
  setInterval(() => { try { for (const r of q.staleFiles.all(now() - 864e5)) { try { fs.unlinkSync(path.join(uploadDir, r.id)); } catch {} q.dropFile.run(r.id); } } catch {} }, 36e5).unref();

  return { walletId, tier, getProfile, updateProfile, tickets, openTicket, reply, close, reopen, system, pushAccount, ticketOwner, upload, file, MAX_FILE, SocialError, BANNERS, EFFECTS, NAMESTYLES };
}

module.exports = { create, TIERS };
