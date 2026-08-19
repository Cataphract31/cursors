import { spawn } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, dirname, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(webRoot));
const dist = join(webRoot, "dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error("FAILED: no dist/index.html — run `npm run build` first");
  process.exit(1);
}

const vercel = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"));
const rule = (vercel.headers || []).find(h => h.source === "/(.*)");
if (!rule) { console.error("FAILED: vercel.json has no `/(.*)` header rule — nothing is protected"); process.exit(1); }
const SEC = rule.headers.filter(h => h.key).map(h => [h.key, h.value]);
const csp = SEC.find(([k]) => k.toLowerCase() === "content-security-policy");
if (!csp) { console.error("FAILED: the `/(.*)` rule serves no Content-Security-Policy"); process.exit(1); }
for (const need of ["default-src", "frame-ancestors", "object-src", "base-uri", "form-action"])
  if (!csp[1].includes(need)) { console.error("FAILED: the CSP is missing " + need); process.exit(1); }
for (const need of ["X-Content-Type-Options", "Strict-Transport-Security", "Referrer-Policy", "X-Frame-Options"])
  if (!SEC.some(([k]) => k.toLowerCase() === need.toLowerCase())) { console.error("FAILED: missing header " + need); process.exit(1); }
console.log("headers under test, from vercel.json:");
for (const [k, v] of SEC) console.log("  " + k + ": " + (v.length > 100 ? v.slice(0, 100) + " …" : v));

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = normalize(join(dist, p));
  for (const [k, v] of SEC) res.setHeader(k, v);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const HOST = "cursors.csptest", EVIL_HOST = "attacker.csptest";
const origin = "http://" + HOST + ":" + server.address().port;

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9500 + Math.floor(Math.random() * 500);
const profile = join(tmpdir(), "edge-csp-" + port + "-" + Date.now());
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  "--host-resolver-rules=MAP " + HOST + " 127.0.0.1, MAP " + EVIL_HOST + " 127.0.0.1",
  "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const bail = (msg, code) => {
  try {
    for (const x of [...new Set(violations.filter(Boolean))]) console.error("  VIOLATION  " + x);
    for (const x of [...new Set(blocked.filter(Boolean))]) console.error("  BLOCKED    " + x);
  } catch {}
  console.error(msg);
  try { edge.kill(); server.close(); } catch {}
  process.exit(code);
};
setTimeout(() => bail("TIMEOUT: the harness did not finish in 240s", 3), 240000).unref();

let target = null;
for (let i = 0; i < 60 && !target; i++) {
  await new Promise(r => setTimeout(r, 250));
  try { target = (await (await fetch("http://127.0.0.1:" + port + "/json/list")).json()).find(t => t.type === "page"); } catch {}
}
if (!target) bail("FAILED: the DevTools port never came up", 2);

const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});

const violations = [];
const blocked = [];
const requestUrl = new Map();
const seenHosts = [];
let loadFired = () => {};
ws.addEventListener("message", ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    return m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  }
  if (m.method === "Page.loadEventFired") loadFired();
  if (m.method === "Network.requestWillBeSent") requestUrl.set(m.params.requestId, m.params.request.url);
  if (m.method === "Runtime.consoleAPICalled" && m.params.args && m.params.args[0] &&
      m.params.args[0].value === "__CSPV__")
    violations.push(m.params.args[1] && m.params.args[1].value);
  if (m.method === "Log.entryAdded" &&
      /Content Security Policy|Refused to/i.test(m.params.entry.text || ""))
    violations.push("log: " + m.params.entry.text.replace(/\s+/g, " ").slice(0, 200));
  if (m.method === "Network.responseReceived") {
    try {
      const h = new URL(m.params.response.url).host;
      if (h && !seenHosts.includes(h)) seenHosts.push(h);
    } catch (e) {}
  }
  if (m.method === "Network.loadingFailed" && m.params.blockedReason)
    blocked.push(m.params.blockedReason + ": " + m.params.type + " " +
      (requestUrl.get(m.params.requestId) || "?").slice(0, 90));
});
await new Promise(res => ws.addEventListener("open", res));

const evaluate = async expression =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: 'document.addEventListener("securitypolicyviolation", e => {' +
      'console.log("__CSPV__", e.violatedDirective + " blocked " + (e.blockedURI || "inline") +' +
      '(e.sourceFile ? " @ " + e.sourceFile + ":" + e.lineNumber : ""));});'
  });
  await send("Emulation.setDeviceMetricsOverride",
    { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false, screenWidth: 1280, screenHeight: 800 });

  console.log("\npass 1 — cold visit: boot, login, desktop, live game websocket");
  let loaded = new Promise(r => (loadFired = r));
  await send("Page.navigate", { url: origin + "/" });
  await Promise.race([loaded, sleep(20000)]);
  await sleep(1500);
  await evaluate('document.getElementById("boot").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}))');
  await sleep(1200);
  await evaluate('document.getElementById("tile-guest").click()');
  await sleep(9000);

  const mounted = await evaluate('(()=>{ const cs = getComputedStyle(document.body); return {' +
    'sheets: document.styleSheets.length, bg: cs.backgroundColor,' +
    'taskbar: !!document.getElementById("taskbar"),' +
    'login: document.getElementById("login").style.display,' +
    'icons: document.querySelectorAll("#icons > *").length,' +
    'wallpaper: performance.getEntriesByType("resource")' +
    '.filter(r=>/bliss.*\\.jpg/.test(r.name)).map(r=>r.decodedBodySize)[0] || 0,' +
    'subresources: performance.getEntriesByType("resource").length }; })()');
  console.log("  mounted: " + JSON.stringify(mounted));
  if (mounted.bg !== "rgb(90, 126, 220)")
    bail("FAILED: the stylesheet did not apply — body background is " + mounted.bg +
      ", expected rgb(90, 126, 220). This is the silent-breakage case: an unstyled page for " +
      "every visitor whose cache is cold.", 1);
  if (!mounted.taskbar || mounted.login === "flex")
    bail("FAILED: the app never reached the desktop", 1);
  if (!mounted.icons)
    bail("FAILED: the desktop rendered no icons — the shell did not finish building", 1);
  if (!mounted.wallpaper)
    bail("FAILED: the Bliss wallpaper never loaded — img-src is blocking the CSS background", 1);

  console.log("  " + mounted.subresources + " subresources, " + mounted.sheets +
    " stylesheets applied, desktop reached");

  console.log("");
  console.log("pass 1b — the live wss:// socket, and same-origin media under media-src");
  const sock = await evaluate('(()=>{ const n=document.getElementById("netico");' +
    'return { trayLit: !!n && getComputedStyle(n).display !== "none" }; })()');
  console.log("  socket: " + JSON.stringify(sock));
  if (!sock.trayLit)
    bail("FAILED: the arena socket never connected — connect-src is blocking wss://, " +
      "or the beta server is down. Nothing that needs a live socket got tested.", 1);

  await evaluate('(()=>{ window.__cspMedia = "pending";' +
    'const v = document.createElement("video"); v.preload = "metadata"; v.muted = true;' +
    'v.onloadedmetadata = () => { window.__cspMedia = v.videoWidth > 0 ? "ok" : "zero-size"; };' +
    'v.onerror = () => { window.__cspMedia = "blocked"; };' +
    'v.src = "video/i-am-a-pc.webm"; })()');
  let media = "pending";
  for (let i = 0; i < 20; i++) {
    await sleep(700);
    media = await evaluate("window.__cspMedia");
    if (media !== "pending") break;
  }
  console.log("  media: " + media);
  if (media !== "ok")
    bail("FAILED: a same-origin clip did not load (" + media + ") — media-src is blocking " +
      "the files Winamp and Media Player exist to play.", 1);


  console.log("\npass 2 — Winamp (data: skin, blob: icons) and Solitaire (same-origin iframe + injected <style>)");
  await send("Page.navigate", { url: "about:blank" });
  await sleep(500);
  loaded = new Promise(r => (loadFired = r));
  await send("Page.navigate", { url: origin + "/#desktop" });
  await Promise.race([loaded, sleep(20000)]);
  await sleep(5000);

  await evaluate('document.querySelector(\'[data-app="win-amp"]\').click()');
  await sleep(5000);
  const amp = await evaluate('(()=>{ try { return window.__amp ? String(window.__amp.gain()) : "no hook"; }' +
    'catch(e){ return "err " + e.message; } })()');
  const wamp = await evaluate('(()=>({ mounted: !!document.querySelector("#webamp-wrap #webamp, #webamp"),' +
    'imgs: [...document.querySelectorAll("img")].filter(i=>/^(data|blob):/.test(i.src)).length }))()');
  console.log("  winamp: gain=" + amp + " " + JSON.stringify(wamp));

  await evaluate('(()=>{ const f=document.getElementById("solitaire-frame");' +
    'if(f && !f.dataset.live){ f.dataset.live="1"; f.src="solitaire/"; } })()');
  await sleep(4000);
  const sol = await evaluate('(()=>{ const f=document.getElementById("solitaire-frame");' +
    'if(!f) return "no frame"; try { const d=f.contentDocument; if(!d) return "no doc";' +
    'const st=d.createElement("style"); st.textContent=".window__heading{display:none!important}";' +
    'd.head.appendChild(st);' +
    'return { url:d.URL.slice(-16), sheets:d.styleSheets.length, injected: st.sheet ? "applied" : "BLOCKED",' +
    'scripted: typeof d.defaultView.requestAnimationFrame }; } catch(e){ return "err " + e.message; } })()');
  console.log("  solitaire: " + JSON.stringify(sol));
  if (sol && sol.injected === "BLOCKED")
    bail("FAILED: style-src blocked the <style> the app injects into the Solitaire iframe", 1);

  console.log("\npass 3 — an attacker's page tries to frame the game");
  const vBefore = violations.length, bBefore = blocked.length;
  const attacker = createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end('<!doctype html><title>evil</title><iframe id="f" src="' + origin +
      '/" width="800" height="600"></iframe>');
  });
  await new Promise(r => attacker.listen(0, "127.0.0.1", r));
  const evil = "http://" + EVIL_HOST + ":" + attacker.address().port + "/";
  loaded = new Promise(r => (loadFired = r));
  await send("Page.navigate", { url: evil });
  await Promise.race([loaded, sleep(10000)]);
  await sleep(4000);
  const framed = await evaluate('(()=>{ const f=document.getElementById("f");' +
    'try { const d=f.contentDocument; return { reachable: !!d,' +
    'body: d ? (d.body ? d.body.innerHTML.length : 0) : 0 }; }' +
    'catch(e){ return { reachable:false, crossOrigin:true }; } })()');
  const refused = !framed.reachable || framed.body === 0;
  console.log("  framed from " + evil + " → " + (refused ? "REFUSED" : "RENDERED") +
    " " + JSON.stringify(framed));
  attacker.close();
  if (!refused)
    bail("FAILED: a foreign origin framed the live game — frame-ancestors is not doing its job. " +
      "This is the clickjacking case: the real game at the real address, with someone else's " +
      "buttons floating on top.", 1);
  const isExpected = s => /frame-ancestors/i.test(s || "") ||
    s === "other: Document " + origin + "/";
  const prune = (arr, from) => {
    const keep = arr.slice(from).filter(x => !isExpected(x));
    arr.length = from;
    arr.push(...keep);
  };
  prune(violations, vBefore);
  prune(blocked, bBefore);

  await sleep(1000);
} catch (e) {
  bail("FAILED: " + (e.stack || e.message), 2);
}

const uniq = a => [...new Set(a.filter(Boolean))];
const v = uniq(violations), b = uniq(blocked);
console.log("\n" + v.length + " CSP violations, " + b.length + " blocked requests");
for (const x of v) console.log("  VIOLATION  " + x);
for (const x of b) console.log("  BLOCKED    " + x);
edge.kill();
server.close();
if (v.length || b.length) {
  console.error("\nFAILED: the policy that ships breaks the app that ships.");
  process.exit(1);
}
console.log("hosts contacted: " + (seenHosts.join(", ") || "(none)"));
console.log("OK — every header in vercel.json served, 0 violations, 0 blocked requests, app mounted and styled.");
process.exit(0);
