import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, drawFn) {
  // A simple uncompressed/deflated raw RGBA to PNG generator
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    
    // CRC calculation
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);

    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // PNG Header
  const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bit depth
  ihdrData[9] = 6; // RGBA color type
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT Chunk
  const idat = makeChunk('IDAT', deflated);

  // IEND Chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xFF];
  }
  return (c ^ (-1)) >>> 0;
}

// Draw Luca Books Emerald Icon
function drawLucaIcon(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = w * (isMaskable ? 0.5 : 0.42);
  const cornerR = w * 0.22;

  // Background rounded rectangle
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  const halfW = w * (isMaskable ? 0.5 : 0.44);
  const halfH = h * (isMaskable ? 0.5 : 0.44);

  // Check if inside rounded rectangle
  let inBg = false;
  if (isMaskable) {
    inBg = true;
  } else {
    const qx = dx - (halfW - cornerR);
    const qy = dy - (halfH - cornerR);
    if (dx <= halfW && dy <= halfH) {
      if (qx <= 0 || qy <= 0 || (qx * qx + qy * qy <= cornerR * cornerR)) {
        inBg = true;
      }
    }
  }

  if (!inBg) return [0, 0, 0, 0];

  // Base background: Dark Velvet `#0e1012` with subtle emerald glow at center
  const distCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (w * 0.5);
  const bgR = Math.round(14 + (1 - distCenter) * 12);
  const bgG = Math.round(16 + (1 - distCenter) * 35);
  const bgB = Math.round(18 + (1 - distCenter) * 20);

  // Draw Book / Diamond Glyph
  const nx = (x - cx) / (w * 0.36);
  const ny = (y - cy) / (h * 0.36);

  // Open book shapes: left page, right page, spine glow
  const isLeftPage = nx < -0.05 && nx > -0.85 && Math.abs(ny - 0.15 * Math.sin(nx * 3.14)) < (0.55 + 0.1 * nx);
  const isRightPage = nx > 0.05 && nx < 0.85 && Math.abs(ny - 0.15 * Math.sin(nx * 3.14)) < (0.55 - 0.1 * nx);
  const isSpine = Math.abs(nx) <= 0.05 && Math.abs(ny) < 0.6;

  if (isLeftPage || isRightPage) {
    // Emerald gradient #10b981 to #34d399 to #059669
    const grad = 0.5 + 0.5 * ny;
    const r = Math.round(16 * (1 - grad) + 52 * grad);
    const g = Math.round(185 * (1 - grad) + 211 * grad);
    const b = Math.round(129 * (1 - grad) + 153 * grad);
    return [r, g, b, 255];
  }

  if (isSpine) {
    return [5, 150, 105, 255];
  }

  // Glow halo
  if (distCenter < 0.75) {
    const halo = (1 - distCenter / 0.75) * 0.25;
    return [
      Math.min(255, Math.round(bgR + halo * 16)),
      Math.min(255, Math.round(bgG + halo * 185)),
      Math.min(255, Math.round(bgB + halo * 129)),
      255
    ];
  }

  return [bgR, bgG, bgB, 255];
}

const iconsDir = path.resolve('public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Generating PNG icons for Luca Books PWA...');

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createPNG(192, 192, (x, y, w, h) => drawLucaIcon(x, y, w, h, false)));
console.log('Created icon-192.png');

fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createPNG(512, 512, (x, y, w, h) => drawLucaIcon(x, y, w, h, false)));
console.log('Created icon-512.png');

fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192.png'), createPNG(192, 192, (x, y, w, h) => drawLucaIcon(x, y, w, h, true)));
console.log('Created icon-maskable-192.png');

fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), createPNG(512, 512, (x, y, w, h) => drawLucaIcon(x, y, w, h, true)));
console.log('Created icon-maskable-512.png');

fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), createPNG(180, 180, (x, y, w, h) => drawLucaIcon(x, y, w, h, false)));
console.log('Created apple-touch-icon.png');

console.log('All PWA icons generated successfully!');
