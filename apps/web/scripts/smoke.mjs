// Smoke test: execute src/main.js under a stub DOM in node.
// Catches strict-mode violations (undeclared assignments), ReferenceErrors,
// and load-time crashes that a syntax check cannot see.
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
let src = readFileSync(join(root, "src", "main.js"), "utf8");

// Strip browser-only imports; stub the Webamp constructor and the asset module
// (it imports binary files and uses import.meta.glob, neither of which node can
// resolve). Sibling source modules are left alone so they get real coverage —
// which is why the temp file is written into src/ rather than a temp dir.
src = src
  .replace(/^import\s+"[^"]*";\s*$/gm, "")
  .replace('import WebampImport from "webamp";', "")
  .replace(
    /^import\s*\{([^}]*)\}\s*from\s*"\.\/assets\.js";\s*$/m,
    (_, names) =>
      names
        .split(",")
        .map((n) => `const ${n.trim()} = globalThis.__AssetStub;`)
        .join(" ")
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
// the shell picks phone-vs-desktop from the DEVICE (screen's short side and
// pointer:coarse), so the stub has to be a plausible desktop, not just a width
g.screen = { width: 1280, height: 800 };
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
g.visualViewport = undefined;
g.location = { hash: "", href: "http://localhost/" };
// node 22 ships a real global WebSocket — without this the smoke run would
// genuinely dial the production game server and never exit
g.WebSocket = undefined;
g.Audio = function () { return stub; };
g.OfflineAudioContext = function () { return stub; };
g.Response = g.Response || function () { return stub; };
if (!g.atob) g.atob = (s) => Buffer.from(s, "base64").toString("binary");

// neuter timers so queued work (track renders, boot timeouts) never runs
g.setTimeout = () => 0;
g.setInterval = () => 0;
g.clearTimeout = () => {};
g.clearInterval = () => {};

const tmp = join(root, "src", ".main.smoke.mjs");
writeFileSync(tmp, src);

try {
  await import(pathToFileURL(tmp).href);
  console.log("SMOKE OK — module executed to completion under strict mode");
} catch (e) {
  console.error("SMOKE FAILED:", e && e.stack ? e.stack.split("\n").slice(0, 6).join("\n") : e);
  process.exitCode = 1;
} finally {
  rmSync(tmp, { force: true });
}

/* ---- vercel.json must be something Vercel will actually accept ----
   A stray key here does not fail the build, it fails the DEPLOY: Vercel
   validates the schema before it ever runs npm, so the site silently keeps
   serving the last good commit while every push "succeeds" in git. That is
   how a `"//"` comment key in headers[0] swallowed two days of work. JSON has
   no comments; document the policy in this file instead of in the config. */
try {
  const vpath = join(root, "..", "..", "vercel.json");
  const v = JSON.parse(readFileSync(vpath, "utf8"));
  const ROUTE_KEYS = new Set(["source", "headers", "has", "missing"]);
  const bad = [];
  for (const [i, r] of (v.headers || []).entries()) {
    for (const k of Object.keys(r)) if (!ROUTE_KEYS.has(k)) bad.push(`headers[${i}].${k}`);
    for (const [j, kv] of (r.headers || []).entries()) {
      const extra = Object.keys(kv).filter(k => k !== "key" && k !== "value");
      if (extra.length) bad.push(`headers[${i}].headers[${j}].${extra.join(",")}`);
    }
  }
  if (bad.length) {
    console.error("VERCEL CONFIG INVALID — deploy would be rejected, not the build:\n  " +
      bad.join("\n  ") + "\n  (Vercel rejects unknown properties; remove them.)");
    process.exitCode = 1;
  } else console.log("vercel.json OK — no properties Vercel would reject");
} catch (e) {
  console.error("vercel.json unreadable:", e.message);
  process.exitCode = 1;
}
