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

function makePNG(size) {
  // Colors: background #111116, accent circle #7b6cff, letter T in white
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  // Draw icon pixel by pixel
  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize, 0);

  const cx = size / 2, cy = size / 2;
  const outerR = size * 0.48;
  const innerR = size * 0.42;

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = y * rowSize + 1 + x * 3;

      // Background: deep navy
      let r = 0x0a, g = 0x0a, b = 0x0c;

      // Purple circle fill
      if (dist < innerR) {
        r = 0x11; g = 0x11; b = 0x16;
      }

      // Accent ring
      if (dist >= innerR && dist < outerR) {
        r = 0x3d; g = 0x36; b = 0x80;
      }

      // Draw "T" letter in the center
      // Horizontal bar: y in [cy-0.28*size, cy-0.15*size], x in [cx-0.25*size, cx+0.25*size]
      const normX = dx / size, normY = dy / size;
      const inHBar = normY >= -0.28 && normY <= -0.14 && normX >= -0.22 && normX <= 0.22;
      // Vertical bar: x in [cx-0.07*size, cx+0.07*size], y in [cy-0.28*size, cy+0.22*size]
      const inVBar = normX >= -0.07 && normX <= 0.07 && normY >= -0.28 && normY <= 0.22;

      if ((inHBar || inVBar) && dist < innerR) {
        r = 0x7b; g = 0x6c; b = 0xff;
      }

      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }

  const idat = chunk('IDAT', deflateSync(raw, { level: 6 }));
  return Buffer.concat([sig, chunk('IHDR', ihdr), idat, chunk('IEND', Buffer.alloc(0))]);
}

writeFileSync('public/icon-192.png', makePNG(192));
writeFileSync('public/icon-512.png', makePNG(512));
console.log('Done: public/icon-192.png, public/icon-512.png');
