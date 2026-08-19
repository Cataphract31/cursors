import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

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
  .replace('import("webamp")', "Promise.resolve(globalThis.__WebampStub)");
if (src.includes('import("webamp")')) {
  console.error("SMOKE FAILED — the webamp dynamic import was not stubbed; update this replacer");
  process.exit(1);
}

const stub = new Proxy(function () {}, {
  get(t, p) {
    if (p === Symbol.iterator) return function* () {};
    if (p === Symbol.toPrimitive) return () => 0;
    if (p === "then") return undefined;
    return stub;
  },
  apply() { return stub; },
  construct() { return stub; },
  set() { return true; },
  has() { return true; }
});

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
g.screen = { width: 1280, height: 800 };
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
g.visualViewport = undefined;
g.location = { hash: "", href: "http://localhost/" };
g.WebSocket = undefined;
g.Audio = function () { return stub; };
g.OfflineAudioContext = function () { return stub; };
g.Response = g.Response || function () { return stub; };
if (!g.atob) g.atob = (s) => Buffer.from(s, "base64").toString("binary");

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
