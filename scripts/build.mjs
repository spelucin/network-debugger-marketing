// Build script: bundles the extension with Vite, then copies static
// assets (manifest.json, icons) into dist/.
//
//   node scripts/build.mjs          → one-shot production build
//   node scripts/build.mjs --watch  → rebuild on source changes
import { execSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

function copyStatic() {
  mkdirSync(dist, { recursive: true });
  for (const file of ["manifest.json"]) {
    cpSync(resolve(root, file), resolve(dist, file));
  }
  if (existsSync(resolve(root, "public"))) {
    cpSync(resolve(root, "public"), dist, { recursive: true });
  }
}

// Content scripts are bundled as self-contained classic scripts (IIFE) with
// esbuild: manifest-declared content scripts cannot be ESM modules.
const CONTENT_SCRIPTS = [
  ["src/content/main-world.ts", "content-main.js"],
  ["src/content/relay.ts", "content-relay.js"],
];

function buildContentScripts() {
  for (const [entry, out] of CONTENT_SCRIPTS) {
    execSync(
      `npx esbuild ${entry} --bundle --format=iife --target=es2020 --outfile=dist/${out}`,
      { cwd: root, stdio: "inherit" }
    );
  }
}

function watchContentScripts() {
  return CONTENT_SCRIPTS.map(([entry, out]) =>
    spawn(
      "npx",
      [
        "esbuild",
        entry,
        "--bundle",
        "--format=iife",
        "--target=es2020",
        `--outfile=dist/${out}`,
        "--watch",
      ],
      { cwd: root, stdio: "inherit" }
    )
  );
}

function buildOnce() {
  execSync("npx vite build", { cwd: root, stdio: "inherit" });
  buildContentScripts();
  copyStatic();
  console.log("✓ build complete →", dist);
}

function buildWatch() {
  copyStatic();
  const watchers = watchContentScripts();
  const child = spawn("npx", ["vite", "build", "--watch"], {
    cwd: root,
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    for (const w of watchers) w.kill();
    process.exit(code ?? 0);
  });
}

const watch = process.argv.includes("--watch");
if (watch) {
  buildWatch();
} else {
  rmSync(dist, { recursive: true, force: true });
  buildOnce();
}