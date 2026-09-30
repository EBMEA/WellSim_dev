// Generates the WellSim icons with zero dependencies (raw PNG chunks + zlib).
// Motif: the nodal plot — declining IPR, rising VLP, white operating point —
// on the app's navy. ONE drawing feeds both deliverables:
//   src/ui/*.png          the website's PWA / touch icons
//   portable/wellsim.ico  the portable exe's Windows icon (build.ps1 sets it,
//                         so the exe stops wearing node.exe's hexagon)
// Run: node scripts/make-icons.mjs
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const UI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/ui');

const NAVY = [0x16, 0x32, 0x4f];
const GREEN = [0x4c, 0xbf, 0x7b];
const BLUE = [0x7f, 0xb3, 0xe0];
const WHITE = [0xff, 0xff, 0xff];

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// curves in unit coords (y down); crossing found numerically
const iprY = (t) => 0.26 + 0.52 * t * t;            // declines in pressure
const vlpY = (t) => 0.78 - 0.48 * t + 0.14 * t * t; // rises in pressure
let tX = 0.5;
for (let i = 0; i < 60; i++) {
  const f = (t) => iprY(t) - vlpY(t);
  tX -= f(tX) / ((f(tX + 1e-4) - f(tX - 1e-4)) / 2e-4);
}
const X0 = 0.14, X1 = 0.86;
const cross = { x: X0 + tX * (X1 - X0), y: iprY(tX) };

const smooth = (edge, w, d) => Math.max(0, Math.min(1, (edge - d) / w));

// line / ring / dot proportions. The PWA defaults suit 180-512 px; at
// Explorer and taskbar sizes (16-48 px) those lines are under a pixel, so the
// ICO's small frames use favicon.svg's own proportions (stroke 5, ring 8,
// dot 5 on a 64 grid) -- the logo the site shows in a browser tab.
const PWA = { th: 0.045, ring: 0.095, dot: 0.062 };
const FAVICON = { th: 5 / 64, ring: 8 / 64, dot: 5 / 64 };
// The PWA icons' edge ramp fades INWARD from the line edge over 1.5 px, so a
// line under ~3 px never reaches full colour -- invisible at 180-512 px,
// but at 16-24 px it left the curves as faint dashes. The ICO's small frames
// ramp across the edge instead (centred, 1 px) and get slightly bolder
// strokes, the usual treatment for small icons. The web PNGs keep the
// original ramp, so they regenerate byte-identical.
const icoStyle = (size) =>
  size <= 16 ? { th: 0.125, ring: 0.16, dot: 0.1, aa: 1, centred: true }
  : size <= 24 ? { th: 0.1, ring: 0.14, dot: 0.09, aa: 1, centred: true }
  : size <= 48 ? { ...FAVICON, aa: 1, centred: true }
  : PWA;

function draw(size, opts = {}) {
  return encodePng(size, rasterise(size, opts));
}

function rasterise(size, { fullBleed = false, scale = 1, th = PWA.th, ring: ringR = PWA.ring, dot: dotR = PWA.dot, aa = 1.5, centred = false } = {}) {
  // edge coverage: the PWA ramp (inward) or the small-icon ramp (centred)
  const cover = centred
    ? (edge, w, d) => Math.max(0, Math.min(1, 0.5 + (edge - d) / w))
    : smooth;
  const buf = Buffer.alloc(size * size * 4);
  const s = size;
  const r = fullBleed ? 0 : s * 0.18;
  const px = 1 / s;
  const cx = 0.5, cy = 0.5;
  const m = (v) => cx + (v - cx) * scale; // shrink motif toward center (maskable safe zone)
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = (x + 0.5) / s, v = (y + 0.5) / s;
      // rounded-rect coverage
      let bgA = 1;
      if (!fullBleed) {
        const qx = Math.max(Math.abs(u - 0.5) - (0.5 - r / s), 0);
        const qy = Math.max(Math.abs(v - 0.5) - (0.5 - r / s), 0);
        const d = Math.hypot(qx, qy) - r / s;
        bgA = smooth(0, 1.5 * px, d);
      }
      let [cr, cg, cb] = NAVY, ca = bgA;
      if (bgA > 0) {
        // motif in (possibly shrunken) coords
        const uu = cx + (u - cx) / scale, vv = cy + (v - cy) / scale;
        if (uu >= X0 - 0.02 && uu <= X1 + 0.02) {
          const t = Math.max(0, Math.min(1, (uu - X0) / (X1 - X0)));
          const dI = Math.abs(vv - iprY(t)), dV = Math.abs(vv - vlpY(t));
          const inRange = uu >= X0 && uu <= X1;
          const aI = inRange ? cover(th / 2, aa * px / scale, dI) : 0;
          const aV = inRange ? cover(th / 2, aa * px / scale, dV) : 0;
          if (aV > 0) { [cr, cg, cb] = BLUE.map((c2, i) => Math.round(NAVY[i] + (c2 - NAVY[i]) * aV)); }
          if (aI > 0) { [cr, cg, cb] = [cr, cg, cb].map((c2, i) => Math.round(c2 + (GREEN[i] - c2) * aI)); }
        }
        // operating point: navy ring + white dot
        const dC = Math.hypot(uu - cross.x, vv - cross.y);
        const ring = cover(ringR, aa * px / scale, dC);
        if (ring > 0) { [cr, cg, cb] = [cr, cg, cb].map((c2, i) => Math.round(c2 + (NAVY[i] - c2) * ring)); }
        const dot = cover(dotR, aa * px / scale, dC);
        if (dot > 0) { [cr, cg, cb] = [cr, cg, cb].map((c2, i) => Math.round(c2 + (WHITE[i] - c2) * dot)); }
      }
      const o = (y * s + x) * 4;
      buf[o] = cr; buf[o + 1] = cg; buf[o + 2] = cb; buf[o + 3] = Math.round(255 * ca);
    }
  }
  return buf;
}

/** One ICO frame as a 32-bit DIB: BITMAPINFOHEADER, bottom-up BGRA, then the
 *  1-bpp AND mask (all zero -- the alpha channel carries transparency). PNG
 *  frames are legal at every size since Vista, but ExtractIcon, GDI+ and
 *  .NET's Icon read only DIB frames below 256 px, so the small ones are DIB. */
function encodeDib(size, rgba) {
  const maskStride = Math.ceil(size / 32) * 4;
  const hdr = Buffer.alloc(40);
  hdr.writeUInt32LE(40, 0);        // biSize
  hdr.writeInt32LE(size, 4);       // biWidth
  hdr.writeInt32LE(size * 2, 8);   // biHeight: colour + mask
  hdr.writeUInt16LE(1, 12);        // biPlanes
  hdr.writeUInt16LE(32, 14);       // biBitCount
  hdr.writeUInt32LE(0, 16);        // BI_RGB
  hdr.writeUInt32LE(size * size * 4 + maskStride * size, 20);
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4, d = ((size - 1 - y) * size + x) * 4;
      px[d] = rgba[s + 2]; px[d + 1] = rgba[s + 1]; px[d + 2] = rgba[s]; px[d + 3] = rgba[s + 3];
    }
  }
  return Buffer.concat([hdr, px, Buffer.alloc(maskStride * size)]);
}

/** A Windows .ico from frames of { size, data } (DIB or PNG bytes). */
function encodeIco(frames) {
  const head = Buffer.alloc(6 + 16 * frames.length);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(frames.length, 4);
  let offset = head.length;
  frames.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head[e] = size >= 256 ? 0 : size; // 0 means 256
    head[e + 1] = size >= 256 ? 0 : size;
    head[e + 2] = 0; // palette
    head[e + 3] = 0;
    head.writeUInt16LE(1, e + 4); // planes
    head.writeUInt16LE(32, e + 6); // bits per pixel
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...frames.map((f) => f.data)]);
}

writeFileSync(path.join(UI, 'icon-192.png'), draw(192));
writeFileSync(path.join(UI, 'icon-512.png'), draw(512));
writeFileSync(path.join(UI, 'icon-maskable-512.png'), draw(512, { fullBleed: true, scale: 0.78 }));
writeFileSync(path.join(UI, 'apple-touch-icon.png'), draw(180, { fullBleed: true, scale: 0.92 }));
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
writeFileSync(
  path.resolve(UI, '../../portable/wellsim.ico'),
  encodeIco(ICO_SIZES.map((size) => {
    const opts = icoStyle(size);
    return { size, data: size >= 256 ? draw(size, opts) : encodeDib(size, rasterise(size, opts)) };
  }))
);
console.log('icons written to src/ui/: icon-192, icon-512, icon-maskable-512, apple-touch-icon');
console.log(`and portable/wellsim.ico: ${ICO_SIZES.join(', ')} px`);
