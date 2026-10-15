// Legal documents and electronic signatures.
//
// The documents live in public/legaldocs.js (the same file the website shows). A signature is a typed
// name plus a drawn signature (PNG from the scribble pad). For every document signed we keep:
// the version, a SHA-256 hash of the exact text, the name, the image and its hash, how it was drawn
// (strokes, ink length), hashed network/device labels and the time.
//
// Packs are signed together: "site" (Terms, License, Privacy, Cookies, Community Rules, Responsible
// Play, Gift Card Terms), "cds" (Currency Deduction Service, before depositing) and "business"
// (Business and Partner Program Agreement, before a Business Card and wages).
'use strict';
const crypto = require('node:crypto');

class LegalError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

function create({ db, docs, can = () => false, log = () => {}, onSigned = () => {} }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS signatures (id TEXT PRIMARY KEY, pack TEXT NOT NULL, roblox_id INTEGER NOT NULL, doc TEXT NOT NULL, version TEXT NOT NULL, doc_hash TEXT NOT NULL,
      name TEXT NOT NULL, png TEXT NOT NULL, png_hash TEXT NOT NULL, strokes INTEGER NOT NULL, ink INTEGER NOT NULL, net TEXT, dev TEXT, ua TEXT, signed_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS signatures_user ON signatures (roblox_id, doc, signed_at DESC);
  `);
  const q = {
    add: db.prepare('INSERT INTO signatures (id, pack, roblox_id, doc, version, doc_hash, name, png, png_hash, strokes, ink, net, dev, ua, signed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'),
    latest: db.prepare('SELECT id, doc, version, doc_hash, name, signed_at FROM signatures WHERE roblox_id = ? AND doc = ? ORDER BY signed_at DESC LIMIT 1'),
    mine: db.prepare('SELECT id, pack, doc, version, doc_hash, name, png_hash, strokes, signed_at FROM signatures WHERE roblox_id = ? ORDER BY signed_at DESC LIMIT 100'),
    one: db.prepare('SELECT * FROM signatures WHERE id = ?'),
    recent: db.prepare("SELECT s.id, s.pack, s.roblox_id, u.username, s.doc, s.version, s.name, s.strokes, s.net, s.dev, s.signed_at FROM signatures s LEFT JOIN users u ON u.roblox_id = s.roblox_id WHERE (? = '' OR lower(u.username) = lower(?) OR CAST(s.roblox_id AS TEXT) = ? OR s.id = upper(?)) ORDER BY s.signed_at DESC LIMIT 200"),
  };
  const hashOf = k => sha256(docs.text(k));
  const HASH = Object.fromEntries(docs.order.map(k => [k, hashOf(k)]));
  const versions = Object.fromEntries(docs.order.map(k => [k, docs[k].v]));

  // Signed the current version of this document?
  const signed = (id, doc) => { const s = q.latest.get(id, doc); return !!s && s.version === docs[doc].v && s.doc_hash === HASH[doc]; };
  function status(id) {
    const o = {};
    for (const k of docs.order) { const s = q.latest.get(id, k); o[k] = s ? { version: s.version, signedAt: s.signed_at, current: s.version === docs[k].v && s.doc_hash === HASH[k], id: s.id } : null; }
    return o;
  }
  function packOf(list) {
    const set = [...new Set((Array.isArray(list) ? list : [list]).map(String))];
    for (const [name, p] of Object.entries(docs.packs)) if (p.length === set.length && p.every(d => set.includes(d))) return name;
    // one document of a pack means the whole pack
    for (const [name, p] of Object.entries(docs.packs)) if (set.length === 1 && p.includes(set[0])) return name;
    throw new LegalError('Pick the documents to sign.');
  }
  function checkPng(dataUrl) {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) throw new LegalError('Draw your signature first.');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length < 300 || buf.length > 150000) throw new LegalError(buf.length < 300 ? 'Draw your signature first.' : 'That signature image is too large. Clear it and sign again.');
    if (buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('ascii', 12, 16) !== 'IHDR') throw new LegalError('That signature could not be read. Clear it and sign again.');
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w < 200 || h < 60 || w > 2400 || h > 1200) throw new LegalError('That signature could not be read. Clear it and sign again.');
    return buf;
  }
  // Sign a pack. b = { docs | doc, name, signature (PNG data URL), strokes, ink, versions? }
  function sign(id, b, labels = {}, ua = '') {
    const pack = packOf(b.docs || b.doc), list = docs.packs[pack];
    if (b.version && b.doc && b.version !== docs[b.doc].v) throw new LegalError('That version is out of date. Reload the page and read the new one.', 409);
    if (b.versions) for (const k of list) if (b.versions[k] && b.versions[k] !== docs[k].v) throw new LegalError('A document changed while you were reading. Reload the page and read the new version.', 409);
    const name = String(b.name || '').replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 60 || (name.match(/\p{L}/gu) || []).length < 2 || /[<>{}\[\]\\\/@#$%^*=+|~`"0-9]/.test(name)) throw new LegalError('Type your full name, as you want it on the agreement.');
    const png = checkPng(b.signature);
    const strokes = Math.floor(Number(b.strokes) || 0), ink = Math.floor(Number(b.ink) || 0);
    if (strokes < 1 || ink < 80) throw new LegalError('That signature is too short. Sign the way you normally would.');
    const at = Date.now(), pngB64 = png.toString('base64'), pngHash = sha256(png), ids = [];
    for (const k of list) {
      const sid = 'SIG-' + crypto.randomBytes(5).toString('hex').toUpperCase();
      q.add.run(sid, pack, id, k, docs[k].v, HASH[k], name, pngB64, pngHash, Math.min(strokes, 9999), Math.min(ink, 1e7), labels.net || null, labels.dev || null, String(ua || '').slice(0, 160), at);
      ids.push(sid);
    }
    onSigned(id, pack, list);
    log('signed', id, pack);
    return { ok: true, pack, ids, status: status(id) };
  }
  function mine(id) { return { versions, hashes: HASH, status: status(id), signatures: q.mine.all(id).map(s => ({ id: s.id, pack: s.pack, doc: s.doc, title: docs[s.doc] ? docs[s.doc].t : s.doc, version: s.version, docHash: s.doc_hash, name: s.name, signatureHash: s.png_hash, signedAt: s.signed_at, current: s.version === (docs[s.doc] || {}).v && s.doc_hash === HASH[s.doc] })) }; }
  // The drawn signature, for its owner and for staff allowed to see agreements.
  function image(viewer, sid) {
    const s = q.one.get(String(sid || '').toUpperCase());
    if (!s || (s.roblox_id !== viewer && !can(viewer, 'legal.view'))) return null;
    return Buffer.from(s.png, 'base64');
  }
  // One signed agreement as a record (with the full text that was signed, if it is still the current version).
  function record(viewer, sid) {
    const s = q.one.get(String(sid || '').toUpperCase());
    if (!s || (s.roblox_id !== viewer && !can(viewer, 'legal.view'))) throw new LegalError('Signature not found.', 404);
    const d = docs[s.doc];
    return { id: s.id, pack: s.pack, robloxId: s.roblox_id, doc: s.doc, title: d ? d.t : s.doc, version: s.version, docHash: s.doc_hash, name: s.name, signatureHash: s.png_hash, strokes: s.strokes, net: can(viewer, 'legal.view') ? s.net : undefined, dev: can(viewer, 'legal.view') ? s.dev : undefined, signedAt: s.signed_at,
      text: d && d.v === s.version && HASH[s.doc] === s.doc_hash ? docs.text(s.doc) : null };
  }
  function adminList(viewer, who) {
    if (!can(viewer, 'legal.view')) throw new LegalError('Your staff rank cannot see signed agreements.', 403);
    const w = String(who || '').trim();
    return { signatures: q.recent.all(w, w, w, w).map(s => ({ id: s.id, pack: s.pack, robloxId: s.roblox_id, username: s.username, doc: s.doc, title: docs[s.doc] ? docs[s.doc].t : s.doc, version: s.version, name: s.name, strokes: s.strokes, net: s.net, dev: s.dev, signedAt: s.signed_at })) };
  }
  return { signed, status, sign, mine, image, record, adminList, versions, hashes: HASH, LegalError };
}

module.exports = { create };
