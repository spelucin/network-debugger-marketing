// Generates the extension toolbar icons (16/32/48/128 PNG) from a small
// vector description using only Node's built-in zlib. No native deps.
//
// The glyph is a bold white signal trace (a request being intercepted)
// crossing a deep charcoal squircle, terminating in an indigo beacon dot —
// the same accent the panel UI uses. Flat, dark, legible in light and dark
// toolbars alike.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public/icons");
mkdirSync(outDir, { recursive: true });

const SS = 4; // supersampling factor for anti-aliasing

function makeCanvas(size) {
  const W = size * SS;
  const H = size * SS;
  const px = new Float64Array(W * H * 4); // premultiplied, 0..255
  return { W, H, px };
}

function blendPx(buf, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= buf.W || y >= buf.H) return;
  const i = (y * buf.W + x) * 4;
  const sa = a / 255;
  const da = buf.px[i + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa === 0) return;
  buf.px[i] = (r * sa + buf.px[i] * da * (1 - sa)) / oa;
  buf.px[i + 1] = (g * sa + buf.px[i + 1] * da * (1 - sa)) / oa;
  buf.px[i + 2] = (b * sa + buf.px[i + 2] * da * (1 - sa)) / oa;
  buf.px[i + 3] = oa * 255;
}

// Rounded-rect coverage via signed distance field (1 inside, 0 outside)
function roundedCoverage(x, y, x0, y0, x1, y1, r) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const qx = Math.abs(x - cx) - ((x1 - x0) / 2 - r);
  const qy = Math.abs(y - cy) - ((y1 - y0) / 2 - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  const d = Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
  return Math.max(0, Math.min(1, 0.5 - d));
}

function fillCircle(buf, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= cy + radius; y++) {
    for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        const cov = Math.min(1, (r2 - (dx * dx + dy * dy)) * 2);
        blendPx(buf, x, y, [color[0], color[1], color[2], color[3] * cov]);
      }
    }
  }
}

function fillLine(buf, x0, y0, x1, y1, thickness, color) {
  const steps = Math.max(1, Math.abs(x1 - x0) + Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(buf, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thickness / 2, color);
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawIcon(size) {
  const buf = makeCanvas(size);
  const S = size * SS; // logical size in supersampled units
  const pad = S * 0.04;

  // Background rounded square with a subtle vertical gradient (charcoal with
  // a cool undertone — reads as "dev tool", survives both toolbar themes).
  const radius = S * 0.24;
  const top = [38, 40, 47]; // #26282f
  const bottom = [18, 19, 24]; // #121318
  for (let y = 0; y < buf.W; y++) {
    for (let x = 0; x < buf.H; x++) {
      const cov = roundedCoverage(x, y, pad, pad, S - pad, S - pad, radius);
      if (cov > 0) {
        const t = y / S;
        blendPx(buf, x, y, [
          lerp(top[0], bottom[0], t),
          lerp(top[1], bottom[1], t),
          lerp(top[2], bottom[2], t),
          255 * cov,
        ]);
      }
    }
  }

  const white = [245, 246, 250, 255];
  const beacon = [78, 124, 202, 255]; // denim blue — matches the panel accent

  // Signal trace: flat → spike → settle → beacon. The waveform reads as an
  // intercepted request; the indigo dot is the tracker being caught.
  const trace = [
    [0.16, 0.5],
    [0.32, 0.5],
    [0.42, 0.26],
    [0.53, 0.74],
    [0.63, 0.5],
    [0.78, 0.5],
  ];
  const lw = S * 0.095;
  for (let i = 0; i < trace.length - 1; i++) {
    fillLine(
      buf,
      S * trace[i][0],
      S * trace[i][1],
      S * trace[i + 1][0],
      S * trace[i + 1][1],
      lw,
      white
    );
  }

  // Beacon dot at the end of the trace — slightly larger than the stroke so
  // it reads as a bead, not a blob.
  fillCircle(buf, S * 0.815, S * 0.5, S * 0.088, beacon);

  // Downsample to target size
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * buf.W + (x * SS + sx)) * 4;
          const aa = buf.px[i + 3] / 255;
          r += buf.px[i] * aa;
          g += buf.px[i + 1] * aa;
          b += buf.px[i + 2] * aa;
          a += aa;
        }
      }
      const n = SS * SS;
      const aAvg = a / n;
      const o = (y * size + x) * 4;
      if (aAvg > 0) {
        out[o] = Math.round(r / (aAvg * n));
        out[o + 1] = Math.round(g / (aAvg * n));
        out[o + 2] = Math.round(b / (aAvg * n));
      }
      out[o + 3] = Math.round(aAvg * 255);
    }
  }
  return encodePNG(size, size, out);
}

// ---- Minimal PNG encoder ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  const png = drawIcon(size);
  writeFileSync(resolve(outDir, `icon-${size}.png`), png);
  console.log(`✓ icon-${size}.png`);
}