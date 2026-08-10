// Post-build: armor and audit the dist/ that Vercel serves.
//
// Vercel builds this repo itself now (root vercel.json: `npm run build`,
// outputDirectory apps/web/dist) — nothing built is committed anymore.
//
// The U+FFFD escaping stays: webamp's string_decoder ships literal "" chars
// and at least one hosting pipeline rejected them. Escaping inside JS string
// literals is proven safe, so the shipped JS keeps it as armor.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(webRoot, "dist");

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

// 2. report what a first-time visitor actually pays for
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const files = walk(dist);
const size = f => statSync(f).size;
const total = files.reduce((s, f) => s + size(f), 0);
const eager = files.filter(f => !/[\\/](media|pinball|solitaire)[\\/]/.test(f)).reduce((s, f) => s + size(f), 0);
console.log(`postbuild: escaped ${escaped} U+FFFD; dist/ — ${files.length} files, ` +
  `${(total / 1e6).toFixed(1)} MB total, ${(eager / 1e6).toFixed(2)} MB on first paint ` +
  `(media and the games stream on demand)`);
for (const f of files.map(f => [relative(dist, f), size(f)]).sort((a, b) => b[1] - a[1]).slice(0, 6))
  console.log(`  ${(f[1] / 1e6).toFixed(2)} MB  ${f[0]}`);
