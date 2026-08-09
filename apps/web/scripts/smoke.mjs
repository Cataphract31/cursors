// Smoke test: execute src/main.js under a stub DOM in node.
// Catches strict-mode violations (undeclared assignments), ReferenceErrors,
// and load-time crashes that a syntax check cannot see.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
let src = readFileSync(join(root, "src", "main.js"), "utf8");

// strip browser-only imports; stub the Webamp constructor and asset maps.
// css imports vanish; named-import lines from local modules become stub consts.
src = src
  .replace(/^import\s+"[^"]*";\s*$/gm, "")
  .replace('import WebampImport from "webamp";', "")
  .replace(
    'import { IMG, SNDF, TRACKS } from "./assets.js";',
    "const IMG = globalThis.__AssetStub; const SNDF = globalThis.__AssetStub; const TRACKS = [];"
  )
  .replace(
    "const Webamp = (WebampImport && WebampImport.default) ? WebampImport.default : WebampImport;",
    "const Webamp = globalThis.__WebampStub;"
  );

// universal stub: callable, constructible, iterable, coercible
const stub = new Proxy(function () {}, {
  get(t, p) {
    if (p === Symbol.iterator) return function* () {};
    if (p === Symbol.toPrimitive) return () => 0;
    if (p === "then") return undefined; // don't look thenable to await/Promise.resolve
    return stub;
  },
  apply() { return stub; },
  construct() { return stub; },
  set() { return true; },
  has() { return true; }
});

// asset stub: any property access returns a data: URI string
const assetStub = new Proxy({}, { get: () => "data:,", has: () => true });

const g = globalThis;
g.__WebampStub = stub;
g.__AssetStub = assetStub;
g.window = stub;
g.document = stub;
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
g.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
g.addEventListener = () => {};
g.removeEventListener = () => {};
g.requestAnimationFrame = () => 0;
g.cancelAnimationFrame = () => {};
g.innerWidth = 1280;
g.innerHeight = 800;
g.location = { hash: "", href: "http://localhost/" };
g.Audio = function () { return stub; };
g.OfflineAudioContext = function () { return stub; };
g.Response = g.Response || function () { return stub; };
if (!g.atob) g.atob = (s) => Buffer.from(s, "base64").toString("binary");

// neuter timers so queued work (track renders, boot timeouts) never runs
g.setTimeout = () => 0;
g.setInterval = () => 0;
g.clearTimeout = () => {};
g.clearInterval = () => {};

const dir = mkdtempSync(join(tmpdir(), "cursors-smoke-"));
const tmp = join(dir, "main.smoke.mjs");
writeFileSync(tmp, src);

try {
  await import(pathToFileURL(tmp).href);
  console.log("SMOKE OK — module executed to completion under strict mode");
} catch (e) {
  console.error("SMOKE FAILED:", e && e.stack ? e.stack.split("\n").slice(0, 6).join("\n") : e);
  process.exit(1);
}
