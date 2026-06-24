#!/usr/bin/env node
// Generates PNG icons for the ScootRoute PWA.
// No external dependencies — uses Node.js zlib + raw PNG encoding.
// Design: black background, white navigation arrow (communicates "routing app").

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── Raw PNG encoder ──────────────────────────────────────────────────────────
function writePNG(w, h, rgba, outPath) {
  // Build raw scanlines: filter byte (0 = None) + RGB per pixel
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      row[1 + x * 3]     = rgba[i];
      row[1 + x * 3 + 1] = rgba[i + 1];
      row[1 + x * 3 + 2] = rgba[i + 2];
    }
    rows.push(row);
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9 });

  function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(tag, data) {
    const t = Buffer.from(tag, 'ascii');
    const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const body = Buffer.concat([t, d]);
    const len = Buffer.allocUnsafe(4); len.writeUInt32BE(d.length);
    const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGB

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  fs.writeFileSync(outPath, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]));
  console.log(`  ${path.basename(outPath)}  (${w}×${h})`);
}

// ── Icon pixel painter ───────────────────────────────────────────────────────
function drawIcon(size) {
  const px = new Uint8Array(size * size * 4); // RGBA, zeroed = transparent black

  // Fill solid black
  for (let i = 3; i < px.length; i += 4) px[i] = 255;

  const put = (x, y, r, g, b) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = 255;
  };

  const fillRect = (x0, y0, x1, y1, r, g, b) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        put(x, y, r, g, b);
  };

  // Draw a white rounded-square background (slightly inset)
  const pad = Math.round(size * 0.08);
  const rad = Math.round(size * 0.22);
  const x0 = pad, y0 = pad, x1 = size - pad - 1, y1 = size - pad - 1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // Rounded corners
      const dx = Math.max(0, Math.max(x0 + rad - x, x - (x1 - rad)));
      const dy = Math.max(0, Math.max(y0 + rad - y, y - (y1 - rad)));
      if (dx * dx + dy * dy <= rad * rad) {
        put(x, y, 15, 15, 15); // very dark grey — card background
      }
    }
  }

  // Navigation arrow pointing up — white, centred
  const cx = size / 2;
  const arrowTop  = size * 0.20;
  const arrowMid  = size * 0.55;
  const arrowBot  = size * 0.80;
  const headHalf  = size * 0.28;
  const stemHalf  = size * 0.10;

  // Arrow head (filled triangle)
  for (let y = arrowTop; y <= arrowMid; y++) {
    const t = (y - arrowTop) / (arrowMid - arrowTop);
    const hw = headHalf * t;
    for (let x = cx - hw; x <= cx + hw; x++) put(x, y, 255, 255, 255);
  }
  // Arrow stem (rectangle)
  fillRect(
    Math.round(cx - stemHalf), Math.round(arrowMid),
    Math.round(cx + stemHalf), Math.round(arrowBot),
    255, 255, 255
  );

  // Small blue dot at arrow tip to hint at scooter profile
  const dotR = size * 0.06;
  const dotCx = cx, dotCy = size * 0.72;
  for (let y = dotCy - dotR; y <= dotCy + dotR; y++) {
    for (let x = dotCx - dotR; x <= dotCx + dotR; x++) {
      const d = Math.sqrt((x - dotCx) ** 2 + (y - dotCy) ** 2);
      if (d <= dotR) put(x, y, 59, 130, 246); // #3b82f6 blue
    }
  }

  return px;
}

// ── Generate ─────────────────────────────────────────────────────────────────
const OUT = path.join(__dirname, '../api/public/icons');
console.log('Generating ScootRoute PWA icons…');
for (const size of [192, 512, 180, 144, 96]) {
  writePNG(size, size, drawIcon(size), path.join(OUT, `icon-${size}.png`));
}
console.log('Done.');
