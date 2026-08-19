// Smoke test: execute src/main.js under a stub DOM in node.
// Catches strict-mode violations (undeclared assignments), ReferenceErrors,
// and load-time crashes that a syntax check cannot see.
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/* ---- the arcade's wallet, which is a URL and not a file in this repo ----

   src/wallet.js imports "/arcade/web/wallet.js": a real URL on the site this
   game is served from, marked external so the bundler leaves it alone (see
   serveArcade in vite.config.js). Node resolves a leading slash against the
   FILESYSTEM root, so without this the smoke run dies on C:rcade\web\.

   Resolved to the arcade checkout next door, same ARCADE variable the vite
   plugin uses, so this test executes the REAL wallet rather than a stub --
   better coverage than it had when the file was copied in here, since a copy
   could only ever be as current as its last sync.

   WITHOUT A CHECKOUT IT IS STUBBED RATHER THAN FATAL. This build runs where
   GIELINOR may not be cloned, and this test exists to catch load-time crashes
   in THIS game's code. Refusing to run at all because a neighbouring
   repository is absent would turn a missing convenience into a broken build --
   the same reasoning the sync script used for its own --check. It says which
   one it did, out loud, because a silent stub is how a test stops meaning
   anything. */
const arcadeWeb = resolve(root, process.env.ARCADE ?? "../../../GIELINOR", "arcade/web");
const haveArcade = existsSync(join(arcadeWeb, "wallet.js"));
registerHooks({
  resolve(specifier, context, next) {
    if (!specifier.startsWith("/arcade/web/")) return next(specifier, context);
    const rel = specifier.slice("/arcade/web/".length);
    if (haveArcade) {
      return { url: pathToFileURL(join(arcadeWeb, rel)).href, shortCircuit: true };
    }
    return { url: `data:text/javascript,export%20const%20__stub=1`, shortCircuit: true };
  },
});
console.log(haveArcade
  ? `smoke: arcade wallet from ${arcadeWeb}`
  : "smoke: NO arcade checkout — /arcade/web/* stubbed, this run does not cover it");

let src = readFileSync(join(root, "src", "main.js"), "utf8");

// Strip browser-only imports; stub the Webamp constructor and the asset module
// (it imports binary files and uses import.meta.glob, neither of which node can
// resolve). Sibling source modules are left alone so they get real coverage —
// which is why the temp file is written into src/ rather than a temp dir.
src = src
  .replace(/^import\s+"[^"]*";\s*$/gm, "")
  .replace(
    /^import\s*\{([^}]*)\}\s*from\s*"\.\/assets\.js";\s*$/m,
    (_, names) =>
      names
        .split(",")
        .map((n) => `const ${n.trim()} = globalThis.__AssetStub;`)
        .join(" ")
  )
  // Webamp is loaded on demand now (a dynamic import inside openWinamp), so
  // there is no top-level import to strip — only the loader to neutralise, or
  // node would try to resolve the real package at first launch.
  .replace('import("webamp")', "Promise.resolve(globalThis.__WebampStub)");
if (src.includes('import("webamp")')) {
  console.error("SMOKE FAILED — the webamp dynamic import was not stubbed; update this replacer");
  process.exit(1);
}

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
