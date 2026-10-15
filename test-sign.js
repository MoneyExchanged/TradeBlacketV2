// A drawn signature for tests: a real 240x80 PNG with a scribble on it.
'use strict';
const zlib = require('node:zlib');
function png(w = 240, h = 80) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let x = 10; x < w - 10; x++) { const y = Math.round(h / 2 + Math.sin(x / 9) * 18); for (let t = -1; t <= 1; t++) { const o = (y + t) * (w * 4 + 1) + 1 + x * 4; raw[o + 3] = 255; } }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
module.exports = { name: 'Test Player', signature: 'data:image/png;base64,' + png().toString('base64'), strokes: 3, ink: 420, png };
