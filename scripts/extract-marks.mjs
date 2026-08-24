// One-shot extractor: converts sourced official brand SVGs into a TS module
// for PlatformIcon. Run from repo root: node scripts/extract-marks.mjs
import { readFileSync, writeFileSync } from "node:fs";

const SOURCES = [
  ["adobe", "/tmp/opencode/logos/adobe-icon.svg", "gilbarbara/logos (MIT), official Adobe mark", null],
  ["amplitude", "/tmp/opencode/logos/amplitude-icon.svg", "gilbarbara/logos (MIT), official Amplitude mark", null],
  ["heap", "/tmp/opencode/logos/heap-icon.svg", "gilbarbara/logos (MIT), official Heap mark", null],
  ["linkedin", "/tmp/opencode/logos/linkedin-icon.svg", "gilbarbara/logos (MIT), official LinkedIn mark", null],
  ["optimizely", "/tmp/opencode/logos/optimizely-icon.svg", "gilbarbara/logos (MIT), official Optimizely mark", null],
  ["segment", "/tmp/opencode/logos/segment-icon.svg", "gilbarbara/logos (MIT), official Segment mark", null],
  ["bing", "/tmp/opencode/logos/microsoftbing.svg", "simple-icons v11.14.0 (CC0), official Microsoft Bing", "#008373"],
  ["microsoft", "/tmp/opencode/logos/microsoft.svg", "simple-icons v11.14.0 (CC0), official Microsoft mark", "#5E5E5E"],
];

function extractInner(src) {
  const svgStart = src.indexOf("<svg");
  const openEnd = src.indexOf(">", svgStart);
  return src
    .slice(openEnd + 1, src.lastIndexOf("</svg>"))
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<defs>[\s\S]*?<\/defs>/g, "")
    .replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function squareViewBox(vb) {
  let [x, y, w, h] = vb.split(/\s+/).map(Number);
  if (w > h) {
    y -= (w - h) / 2;
    h = w;
  } else if (h > w) {
    x -= (h - w) / 2;
    w = h;
  }
  return [x, y, w, h].map((n) => Math.round(n * 100) / 100).join(" ");
}

function extract(file, monoFill) {
  const src = readFileSync(file, "utf8");
  const vb = src.match(/viewBox="([^"]+)"/)?.[1];
  if (!vb) throw new Error(`no viewBox in ${file}`);
  let body = extractInner(src);
  if (monoFill && !/fill=/.test(body)) {
    body = body.replace(/<path /, `<path fill="${monoFill}" `);
  }
  return { viewBox: squareViewBox(vb), body };
}

// Criteo: pull the mark path (the one starting near x=12) out of the
// official wordmark; its group transforms cancel out, so the coordinates
// already live in the 118x24 space.
function criteoMark() {
  const src = readFileSync("/tmp/opencode/criteo.svg", "utf8");
  const paths = [...src.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  const mark = paths.find((d) => d.startsWith("M12.35"));
  if (!mark) throw new Error("criteo mark path not found");
  const nums = mark.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const xs = [];
  const ys = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    xs.push(nums[i]);
    ys.push(nums[i + 1]);
  }
  const pad = 1;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const side = Math.ceil(Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) + pad);
  return {
    viewBox: `0 0 ${side} ${side}`,
    body: `<path fill="#FE5000" d="${mark}"/>`,
  };
}

const out = [];
out.push(`// Official platform marks, extracted from the sources named per entry.
// Generated once by scripts/extract-marks.mjs — regenerate after updating
// a source file, or edit by hand. 'hex' is the brand color for contexts
// that need a flat color (list dots); bodies carry their own fills.
export interface PlatformMark {
  viewBox: string;
  body: string;
  hex: string;
}

export const PLATFORM_MARKS = {`);

const HEXES = {
  adobe: "#FA0F00",
  amplitude: "#10069F",
  heap: "#31D891",
  linkedin: "#0A66C2",
  optimizely: "#0037FF",
  segment: "#4FB58B",
  bing: "#008373",
  microsoft: "#5E5E5E",
  criteo: "#FE5000",
};

for (const [name, file, provenance, monoFill] of SOURCES) {
  const mark = name === "criteo" ? criteoMark() : extract(file, monoFill);
  const withHex = { ...mark, hex: HEXES[name] };
  out.push(`  // ${provenance}`);
  out.push(`  ${name}: ${JSON.stringify(withHex, null, 2).replace(/\n/g, "\n  ")},`);
}

{
  const mark = criteoMark();
  out.push(`  // criteo.com official wordmark, mark path extracted`);
  out.push(`  criteo: ${JSON.stringify({ ...mark, hex: HEXES.criteo }, null, 2).replace(/\n/g, "\n  ")},`);
}

out.push(`} as const;
`);

writeFileSync(
  new URL("../src/sidepanel/components/platform-marks.ts", import.meta.url),
  out.join("\n")
);
console.log("✓ platform-marks.ts written");
