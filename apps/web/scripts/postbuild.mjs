// Post-build: mirror the finished build into upload/cursors/, the folder the
// owner's Vercel project serves. Vercel runs no build step — it just serves
// these files — so what is committed is exactly what ships.
//
// The U+FFFD escaping stays: webamp's string_decoder ships literal "" chars
// and at least one hosting pipeline rejected them. Escaping inside JS string
// literals is proven safe, so the deploy copy keeps it as armor.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(webRoot));
const dist = join(webRoot, "dist");
const out = join(repoRoot, "upload", "cursors");

// 1. escape U+FFFD in every emitted JS file
const FFFD = String.fromCharCode(0xfffd);
let escaped = 0;
for (const f of readdirSync(join(dist, "assets"))) {
  if (!f.endsWith(".js")) continue;
  const p = join(dist, "assets", f);
  const s = readFileSync(p, "utf8");
  const n = s.split(FFFD).length - 1;
  if (n) { writeFileSync(p, s.replaceAll(FFFD, "\\ufffd")); escaped += n; }
}

// 2. refresh the deploy folder. README.md (Vercel setup) and vercel.json (cache
// headers) are hand-written and stay. Only generated entries are removed, and
// the folder itself is never deleted — on Windows any shell or static server
// sitting in it locks the directory and rmdir fails with EBUSY.
const KEEP = new Set(["README.md", "vercel.json"]);
mkdirSync(out, { recursive: true });
for (const e of readdirSync(out)) if (!KEEP.has(e)) rmSync(join(out, e), { recursive: true, force: true });
cpSync(dist, out, { recursive: true });

// 3. report what a first-time visitor actually pays for
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const files = walk(out).filter(f => !KEEP.has(relative(out, f)));
const size = f => statSync(f).size;
const total = files.reduce((s, f) => s + size(f), 0);
const eager = files.filter(f => !/[\\/]media[\\/]/.test(f)).reduce((s, f) => s + size(f), 0);
console.log(`postbuild: escaped ${escaped} U+FFFD; wrote upload/cursors/ — ${files.length} files, ` +
  `${(total / 1e6).toFixed(1)} MB total, ${(eager / 1e6).toFixed(2)} MB on first paint ` +
  `(audio streams on demand)`);
for (const f of files.map(f => [relative(out, f), size(f)]).sort((a, b) => b[1] - a[1]).slice(0, 6))
  console.log(`  ${(f[1] / 1e6).toFixed(2)} MB  ${f[0]}`);
