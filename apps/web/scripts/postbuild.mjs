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

// 1. escape U+FFFD, and defuse the bundled evals, in every emitted JS file
//
// The evals are not ours — they come in with webamp's dependency tree, and
// each one is a CommonJS-era trick a bundler cannot follow:
//
//   eval(`require`)(`stream`)  — file-type's node-only fileType.stream(). In a
//     browser this has never worked: `require` is not defined, so it throws
//     inside a Promise executor and the promise rejects. Under our CSP it
//     throws an EvalError at the same spot and rejects identically.
//   Function(`return this`)()  — the pre-globalThis global lookup, already
//     guarded by a `try`/`||` that falls through to `window`.
//
// So the policy does not change what the app does. What it does change is the
// violation report, and a report that is never zero is a report nobody reads.
// Rewriting each to the thing it already resolves to is exactly faithful and
// keeps `unsafe-eval` — which would undo most of what the CSP is for — out of
// the header. Anything eval-shaped we do NOT recognise is left alone and
// announced, because guessing at a stranger's semantics is worse than a
// warning; scripts/csp.mjs is the gate that fails if one actually fires.
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

// 2. report what a first-time visitor actually pays for
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const files = walk(dist);
const size = f => statSync(f).size;
const total = files.reduce((s, f) => s + size(f), 0);
const eager = files.filter(f => !/[\\/](media|pinball|solitaire)[\\/]/.test(f)).reduce((s, f) => s + size(f), 0);
console.log(`postbuild: escaped ${escaped} U+FFFD, defused ${devalued} eval; dist/ — ${files.length} files, ` +
  `${(total / 1e6).toFixed(1)} MB total, ${(eager / 1e6).toFixed(2)} MB on first paint ` +
  `(media and the games stream on demand)`);
for (const f of files.map(f => [relative(dist, f), size(f)]).sort((a, b) => b[1] - a[1]).slice(0, 6))
  console.log(`  ${(f[1] / 1e6).toFixed(2)} MB  ${f[0]}`);
