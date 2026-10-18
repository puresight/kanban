const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Draws the icon into a raw RGBA pixel buffer using per-pixel signed-distance
// evaluation. Grid is normalized to a 100x100 design space.
function renderIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const s = size / 100;
  const setPixel = (x, y, r, g, b, a) => {
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };

  // Background: rounded rect covering full canvas. For maskable, content must
  // stay in the inner 80% safe zone, so the background fills everything.
  const cornerRadius = maskable ? 0 : 22;

  // Column stripes (kanban board motif): three vertical bars.
  const bars = [
    { x: 26, w: 12, height: 42 },
    { x: 44, w: 12, height: 56 },
    { x: 62, w: 12, height: 34 },
  ];
  const barTop = 22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x / s;
      const dy = y / s;

      // Rounded-rect coverage for the background tile.
      const inTile = (() => {
        if (!cornerRadius) return true;
        const cx = Math.max(cornerRadius - dx, dx - (100 - cornerRadius), 0);
        const cy = Math.max(cornerRadius - dy, dy - (100 - cornerRadius), 0);
        return cx * cx + cy * cy <= cornerRadius * cornerRadius || (dx >= cornerRadius && dx <= 100 - cornerRadius) || (dy >= cornerRadius && dy <= 100 - cornerRadius);
      })();

      if (!inTile) {
        setPixel(x, y, 0, 0, 0, 0);
        continue;
      }

      // Vertical gradient indigo: #6366f1 -> #4338ca
      const t = dy / 100;
      const r = Math.round(99 + (67 - 99) * t);
      const g = Math.round(102 + (56 - 102) * t);
      const b = Math.round(241 + (202 - 241) * t);

      // Bars: white rounded caps.
      let inBar = false;
      for (const bar of bars) {
        if (dx >= bar.x && dx <= bar.x + bar.w && dy >= barTop && dy <= barTop + bar.height) {
          inBar = true;
        }
      }
      if (inBar) {
        setPixel(x, y, 255, 255, 255, 255);
      } else {
        setPixel(x, y, r, g, b, 255);
      }
    }
  }

  return px;
}

function encodePng(size, opts) {
  const raw = renderIcon(size, opts);
  const stride = size * 4;
  const filtered = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    filtered[y * (stride + 1)] = 0;
    raw.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(filtered, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const iconDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(iconDir, { recursive: true });
fs.writeFileSync(path.join(iconDir, 'icon-192.png'), encodePng(192));
fs.writeFileSync(path.join(iconDir, 'icon-512.png'), encodePng(512));
fs.writeFileSync(path.join(iconDir, 'icon-512-maskable.png'), encodePng(512, { maskable: true }));
fs.writeFileSync(path.join(iconDir, 'apple-touch-icon.png'), encodePng(180));
console.log('icons written to', iconDir);
