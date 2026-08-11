// CSP harness: serve the real build under the exact shipped headers, drive it
// in a real browser, fail on any violation.
//
// The policy lives in vercel.json and this harness parses that file, so what
// it tests is always what ships. Do not document it with a "//" key inside
// vercel.json: Vercel validates the schema before it runs anything and
// rejects unknown properties, which fails the DEPLOY while the build and the
// git push both look green. Add new external hosts to the CSP there, then
// re-run this. `npm run build` now refuses a config Vercel would reject.
//
//   node scripts/csp.mjs            (needs a build: npm run build)
//
// Why this exists. A Content-Security-Policy is the one header that can break
// the site it protects, and it breaks it *silently for the author only*: your
// browser already has the stylesheet and the Winamp skin cached, so you see a
// working page while a first-time visitor gets unstyled HTML. Reading the
// policy and nodding at it is not verification.
//
// So this serves dist/ over HTTP with the headers parsed straight out of
// ../../vercel.json — the same file Vercel reads, so the policy under test
// cannot drift from the policy that ships — and then exercises the parts of
// the app that actually touch the network: the cold boot and login, the live
// game websocket, Winamp's data:-URI skin, the same-origin Solitaire iframe
// (which gets a <style> injected into it), and the TV (a script from
// youtube.com, an oembed fetch, a youtube-nocookie iframe). Every
// securitypolicyviolation, every blocked request and every security log entry
// is collected and printed.
//
// Same CDP plumbing as shot.mjs — see that file for why headless Edge is
// driven over the DevTools protocol rather than with --screenshot.
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

/* ---- 1. the headers, read from the file Vercel actually serves from ---- */
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

/* ---- 2. serve dist/ under exactly those headers ---- */
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = normalize(join(dist, p));
  for (const [k, v] of SEC) res.setHeader(k, v);           // every response, exactly as prod
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
// Not http://127.0.0.1 — mpUrl() in main.js returns a null socket for any
// localhost/127./192.168. hostname, so serving on loopback would quietly put
// the app in single-player and the whole wss:// and YouTube half of the policy
// would go untested while the run still looked green. The browser is launched
// with a resolver rule mapping this name to 127.0.0.1, so it stays hermetic:
// no DNS, no network, but an origin the app treats as production.
const HOST = "cursors.csptest", EVIL_HOST = "attacker.csptest";
const origin = "http://" + HOST + ":" + server.address().port;

/* ---- 3. a real browser ---- */
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9500 + Math.floor(Math.random() * 500);
const profile = join(tmpdir(), "edge-csp-" + port + "-" + Date.now());
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  "--host-resolver-rules=MAP " + HOST + " 127.0.0.1, MAP " + EVIL_HOST + " 127.0.0.1",
  "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
// on the way out, always show what the browser complained about — a failure
// whose evidence is discarded costs another full run to diagnose
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

/* ---- 4. every channel the browser has for saying "I blocked that" ---- */
const violations = [];     // the policy stopped the page from doing something
const blocked = [];        // a request never left the browser
const requestUrl = new Map();
const thirdParty = [];   // youtube/ytimg responses, for diagnosing an unverified TV leg
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
  // the in-page listener, from the main frame and any same-process iframe
  if (m.method === "Runtime.consoleAPICalled" && m.params.args && m.params.args[0] &&
      m.params.args[0].value === "__CSPV__")
    violations.push(m.params.args[1] && m.params.args[1].value);
  // the browser's own log, which also covers frames we could not install into
  if (m.method === "Log.entryAdded" &&
      /Content Security Policy|Refused to/i.test(m.params.entry.text || ""))
    violations.push("log: " + m.params.entry.text.replace(/\s+/g, " ").slice(0, 200));
  // keep the third-party traffic, so an unverified TV leg can say whether
  // YouTube answered badly or never answered at all
  if (m.method === "Network.responseReceived" && /youtube|ytimg/i.test(m.params.response.url))
    thirdParty.push(m.params.response.status + " " + m.params.response.url.slice(0, 78));
  if (m.method === "Network.loadingFailed" && requestUrl.get(m.params.requestId) &&
      /youtube|ytimg/i.test(requestUrl.get(m.params.requestId)))
    thirdParty.push("FAILED(" + (m.params.errorText || m.params.blockedReason) + ") " +
      requestUrl.get(m.params.requestId).slice(0, 70));
  if (m.method === "Network.loadingFailed" && m.params.blockedReason)
    blocked.push(m.params.blockedReason + ": " + m.params.type + " " +
      (requestUrl.get(m.params.requestId) || "?").slice(0, 90));
});
await new Promise(res => ws.addEventListener("open", res));

const evaluate = async expression =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ytVerified = true;   // set false if the TV leg could not be exercised

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  // installed into every document — main frame and same-origin iframes — before
  // any of their own script runs, so a violation at parse time still lands
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: 'document.addEventListener("securitypolicyviolation", e => {' +
      'console.log("__CSPV__", e.violatedDirective + " blocked " + (e.blockedURI || "inline") +' +
      '(e.sourceFile ? " @ " + e.sourceFile + ":" + e.lineNumber : ""));});'
  });
  await send("Emulation.setDeviceMetricsOverride",
    { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false, screenWidth: 1280, screenHeight: 800 });

  /* --- pass 1: a first-time visitor. cold cache, boot, login, live socket. --- */
  console.log("\npass 1 — cold visit: boot, login, desktop, live game websocket");
  let loaded = new Promise(r => (loadFired = r));
  await send("Page.navigate", { url: origin + "/" });
  await Promise.race([loaded, sleep(20000)]);
  await sleep(1500);
  await evaluate('document.getElementById("boot").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}))');
  await sleep(1200);
  // a first visit is two steps: the tile reveals a name field, the name commits
  // the logon — and committing is what dials the game server (mpHello)
  await evaluate('document.getElementById("tile-admin").click()');
  await sleep(800);
  await evaluate('(()=>{ const u=document.getElementById("lg-user"); u.value="cspbot";' +
    'u.dispatchEvent(new Event("input",{bubbles:true}));' +
    'document.getElementById("lg-go").click(); })()');
  await sleep(9000);   // logon's 1500ms chime, enterDesktop's fade, the socket dial

  // the failure this harness exists to catch: a policy that blocks the app's
  // own stylesheet. #5A7EDC is body's background in src/style.css.
  const mounted = await evaluate('(()=>{ const cs = getComputedStyle(document.body); return {' +
    'sheets: document.styleSheets.length, bg: cs.backgroundColor,' +
    'taskbar: !!document.getElementById("taskbar"),' +
    'login: document.getElementById("login").style.display,' +
    'icons: document.querySelectorAll("#icons > *").length,' +
    // computed style reports url(...) whether or not the file arrived, so ask
    // the network instead: a nonzero transfer means img-src really let it in
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

  /* --- pass 1b: the TV, which is only reachable with the live socket up --- */
  // cursorTV renders only when multiplayer is connected, so reaching #tv-in is
  // itself the proof that connect-src let the wss:// through — and that leg
  // cannot be done behind #desktop, which deliberately returns a null socket.
  // The YouTube half (script-src, frame-src, the oembed connect-src) is then
  // proved by fetching those resources directly, WITHOUT queueing anything:
  // the deck is shared with every live player and a test must not broadcast.
  console.log("\npass 1b — cursorTV over the live socket: youtube.com script, oembed fetch, nocookie iframe");
  await evaluate('document.querySelector(\'#startmenu [data-app="win-ie"]\').click()');
  await sleep(2500);
  await evaluate('document.getElementById("dl-connect").click()');
  await sleep(12000);      // the dial-up handshake is 8.1s of theatre, then it navigates home
  const tvUp = await evaluate('(()=>({ input: !!document.getElementById("tv-in"),' +
    'stage: !!document.getElementById("tv-stage"),' +
    'page: (document.getElementById("ie-page")||{}).textContent?.slice(0,40) }))()');
  console.log("  tv page: " + JSON.stringify(tvUp));
  if (!tvUp.input)
    bail("FAILED: cursorTV never came up, so the websocket never connected — connect-src is " +
      "blocking wss://, or the beta server is down. Either way the YouTube paths went untested.", 1);

  // NEVER queue into the deck here. cursorTV is one shared channel: a harness
  // that submits a video broadcasts it to every player online, and this one
  // rickrolled the live lobby for real. The policy legs this pass exists for —
  // script-src youtube.com, frame-src nocookie, connect-src for the oembed —
  // are all provable by pulling the same resources ourselves, with no message
  // on the wire. If a video happens to be playing already, the page's own
  // player exercises the identical paths and this only adds redundancy.
  await evaluate('(()=>{' +
    'window.__cspYt={oembed:null};' +
    'const s=document.createElement("script");' +
    's.src="https://www.youtube.com/iframe_api";' +          /* script-src */
    'document.head.appendChild(s);' +
    'const f=document.createElement("iframe");' +
    'f.id="csp-yt-frame";f.style.cssText="position:fixed;left:-9999px;width:320px;height:180px";' +
    'f.src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&mute=1";' +   /* frame-src */
    'document.body.appendChild(f);' +
    'fetch("https://www.youtube.com/oembed?url=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ&format=json")' +
    '.then(r=>{window.__cspYt.oembed=r.ok?"ok":("http "+r.status);})' +
    '.catch(e=>{window.__cspYt.oembed="failed: "+e.message;});' +   /* connect-src */
    '})()');
  // poll rather than sleep a fixed span: the oembed round trip, the api script
  // and the player iframe are three real network hops, and a fixed wait that is
  // merely usually long enough turns a pass/fail gate into a coin toss
  const probeYt = '(()=>({ api: typeof window.YT,' +
    'apiScript: !!document.querySelector(\'script[src*="youtube.com/iframe_api"]\'),' +
    'frames: [...document.querySelectorAll("iframe")].map(f=>(f.src||("#"+f.id)).slice(0,56)) }))()';
  let yt;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    yt = await evaluate(probeYt);
    if (yt.api === "object" && yt.frames.some(f => f.indexOf("youtube-nocookie.com") >= 0)) break;
  }
  const oem = await evaluate('(window.__cspYt||{}).oembed');
  console.log("  youtube: " + JSON.stringify(yt) + " oembed=" + oem);
  if (typeof oem === "string" && oem.indexOf("failed") === 0) {
    const blockedFetch = [...violations, ...blocked].some(x => /oembed|youtube\.com/i.test(x || ""));
    if (blockedFetch) bail("FAILED: connect-src blocked the oembed request the TV uses for titles.", 1);
    console.warn("  UNVERIFIED: the oembed fetch failed with no CSP objection (" + oem + ")");
  }

  // This leg leans on a third party that sometimes just does not answer inside
  // the 12s the app itself allows before it gives up. Failing the *policy* for
  // that would make the gate cry wolf, and a gate that cries wolf gets ignored
  // — which costs more than it ever saves. So split the two cases on evidence:
  // if the browser said it blocked something YouTube-shaped, the policy is
  // wrong and this fails. If it said nothing and YouTube simply never showed
  // up, the leg is unverified — say so, loudly, and do not call it a pass.
  const ytEvidence = [...violations, ...blocked].filter(s => /youtube|ytimg/i.test(s || ""));
  const ytOk = yt.api === "object" && yt.frames.some(f => f.indexOf("youtube-nocookie.com") >= 0);
  if (!ytOk && ytEvidence.length)
    bail("FAILED: the policy blocked the TV's YouTube traffic —\n    " + ytEvidence.join("\n    "), 1);
  if (!yt.apiScript) {
    ytVerified = false;
    console.warn("  UNVERIFIED: the TV never requested youtube.com/iframe_api at all, so this run " +
      "did not reach the code path script-src and frame-src exist for.");
  } else if (!ytOk) {
    ytVerified = false;
    console.warn("  UNVERIFIED: youtube.com/iframe_api was requested and the browser reported no " +
      "CSP objection, but window.YT never initialised. The policy is not implicated; this leg " +
      "simply went untested. What YouTube actually returned:");
    for (const t of [...new Set(thirdParty)]) console.warn("      " + t);
  }

  /* --- pass 2: the network-touching apps, behind the #desktop dev hash --- */
  console.log("\npass 2 — Winamp (data: skin, blob: icons) and Solitaire (same-origin iframe + injected <style>)");
  // via about:blank: adding a #hash to the current URL is a same-document
  // navigation, so the module would never re-run and the dev hooks it gates
  // behind the hash would never exist
  await send("Page.navigate", { url: "about:blank" });
  await sleep(500);
  loaded = new Promise(r => (loadFired = r));
  await send("Page.navigate", { url: origin + "/#desktop" });
  await Promise.race([loaded, sleep(20000)]);
  await sleep(5000);

  // Winamp mounts on open; __amp is the dev hook that reads its audio graph,
  // which only exists if the data:-URI skin was fetched and unzipped.
  await evaluate('document.querySelector(\'[data-app="win-amp"]\').click()');
  await sleep(5000);
  const amp = await evaluate('(()=>{ try { return window.__amp ? String(window.__amp.gain()) : "no hook"; }' +
    'catch(e){ return "err " + e.message; } })()');
  const wamp = await evaluate('(()=>({ mounted: !!document.querySelector("#webamp-wrap #webamp, #webamp"),' +
    'imgs: [...document.querySelectorAll("img")].filter(i=>/^(data|blob):/.test(i.src)).length }))()');
  console.log("  winamp: gain=" + amp + " " + JSON.stringify(wamp));

  // Solitaire: a same-origin iframe the app injects a <style> element into
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

  /* --- pass 3: the claim the framing headers actually make --- */
  // A policy is only worth having if the attack it names is really refused, so
  // stand up a second origin — a different hostname, the way a real attacker's
  // domain would be — that frames the live game the way a clickjacking page
  // would, and prove the browser refuses it. `frame-ancestors 'self'` has to be
  // exact here: it must still allow the app's own Solitaire iframe, which pass
  // 2 covers. That pairing is the whole point — 'none' passes this test and
  // breaks Solitaire; a missing directive keeps Solitaire and fails this.
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
  // The refusal reports itself as a violation and a blocked request — here that
  // is the pass, not a failure. Drop only the entries this pass added, and only
  // the two that describe the framing of the app root; anything else pass 3
  // turned up is a real finding and still counts.
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

/* ---- 5. the verdict ---- */
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
console.log("OK — every header in vercel.json served, 0 violations, 0 blocked requests, app mounted and styled." +
  (ytVerified ? "" : "\nNOTE: green everywhere it looked, but the YouTube leg above went unverified — " +
    "script-src https://www.youtube.com and frame-src https://www.youtube-nocookie.com are unproven " +
    "by THIS run. Re-run before trusting them."));
process.exit(0);
