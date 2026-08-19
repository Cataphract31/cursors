import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(webRoot, "dist");

const FFFD = String.fromCharCode(0xfffd);
const DEFUSE = [
  [/eval\(`require`\)/g, '(function(){throw new ReferenceError("require is not defined")})()'],
  [/Function\(`return this`\)\(\)/g, "globalThis"],
];
const EVALISH = /[^a-zA-Z_.$](?:eval|Function)\(/g;
let escaped = 0, devalued = 0;
const unknown = new Set();
for (const f of readdirSync(join(dist, "assets"))) {
  if (!f.endsWith(".js")) continue;
  const p = join(dist, "assets", f);
  const s = readFileSync(p, "utf8");
  const n = s.split(FFFD).length - 1;
  let out = s.replaceAll(FFFD, "\\ufffd");
  let e = 0;
  for (const [re, to] of DEFUSE) { e += (out.match(re) || []).length; out = out.replace(re, to); }
  for (const m of out.matchAll(EVALISH)) unknown.add(f + ": …" + out.slice(m.index + 1, m.index + 60) + "…");
  if (n || e) writeFileSync(p, out);
  escaped += n; devalued += e;
}
for (const u of unknown)
  console.warn("postbuild: WARNING — un-defused eval-shaped call, CSP will block it if it runs:\n  " + u);

const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const files = walk(dist);
const size = f => statSync(f).size;
const total = files.reduce((s, f) => s + size(f), 0);
const eager = files.filter(f => !/[\\/](media|music|video|tour|pinball|solitaire)[\\/]/.test(f)).reduce((s, f) => s + size(f), 0);
console.log(`postbuild: escaped ${escaped} U+FFFD, defused ${devalued} eval; dist/ — ${files.length} files, ` +
  `${(total / 1e6).toFixed(1)} MB total, ${(eager / 1e6).toFixed(2)} MB on first paint ` +
  `(media, music, video and the games stream on demand)`);
for (const f of files.map(f => [relative(dist, f), size(f)]).sort((a, b) => b[1] - a[1]).slice(0, 6))
  console.log(`  ${(f[1] / 1e6).toFixed(2)} MB  ${f[0]}`);
