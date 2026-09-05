// Run: node scripts/gen-icons.mjs
// Generates icon-192.png and icon-512.png using only Node built-ins
import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

// --- Palette ---------------------------------------------------------------
const BG = [0x11, 0x11, 0x16];        // flat dark background
const PEACH_LIGHT = [0xff, 0xd6, 0xa0];
const PEACH_DARK = [0xe2, 0x4c, 0x3e];
const PEACH_SHEEN = [0xff, 0xee, 0xd2];
const STEM = [0x6b, 0x3f, 0x2a];

const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// Geometry in normalized coords: (0,0) is the icon center, 1 unit = icon size.
// The peach body is the classic heart curve flipped vertically: tip at the top,
// two round lobes at the bottom with a cleft between them.
const HEART = { s: 0.30, cy: -0.0435 };
const STEM_A = [0.000, -0.322];
const STEM_B = [0.022, -0.386];
const STEM_W = 0.012;

function inHeart(u, v) {
  const x = u / HEART.s;
  const y = (v - HEART.cy) / HEART.s; // v grows downward, so this flips the heart
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0;
}

function distToSegment(u, v, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = clamp(((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(u - (a[0] + t * dx), v - (a[1] + t * dy));
}

// Color of a single sample point, in normalized coords.
function shade(u, v) {
  let col = BG;

  if (inHeart(u, v)) {
    // Diagonal gradient: warm highlight top-left, deep red bottom-right.
    col = mix(PEACH_LIGHT, PEACH_DARK, clamp((u + v + 0.34) / 0.68, 0, 1));

    // Soft sheen on the upper-left flank.
    const sheen = 1 - clamp(Math.hypot(u + 0.100, v + 0.030) / 0.100, 0, 1);
    if (sheen > 0) col = mix(col, PEACH_SHEEN, sheen * sheen * 0.55);

    // Crease rising out of the bottom cleft, fading out toward the tip.
    const creaseBottom = HEART.cy + HEART.s * 0.98;
    const creaseTop = HEART.cy - HEART.s * 0.35;
    if (v > creaseTop && v < creaseBottom) {
      const lineX = 0.016 * Math.sin((creaseBottom - v) * 4.0);
      const edge = 1 - clamp(Math.abs(u - lineX) / 0.018, 0, 1);
      const fade = clamp((v - creaseTop) / 0.14, 0, 1);
      col = mix(col, [0, 0, 0], edge * fade * 0.18);
    }
  }

  // Stem at the tip.
  if (distToSegment(u, v, STEM_A, STEM_B) < STEM_W) col = STEM;

  return col;
}

function makePNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize, 0);

  const SS = 4; // supersampling: SS x SS samples per pixel

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        const v = (y + (sy + 0.5) / SS) / size - 0.5;
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size - 0.5;
          const c = shade(u, v);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS;
      const i = y * rowSize + 1 + x * 3;
      raw[i] = Math.round(r / n);
      raw[i + 1] = Math.round(g / n);
      raw[i + 2] = Math.round(b / n);
    }
  }

  const idat = chunk('IDAT', deflateSync(raw, { level: 9 }));
  return Buffer.concat([sig, chunk('IHDR', ihdr), idat, chunk('IEND', Buffer.alloc(0))]);
}

writeFileSync('public/icon-192.png', makePNG(192));
writeFileSync('public/icon-512.png', makePNG(512));
console.log('Done: public/icon-192.png, public/icon-512.png');
