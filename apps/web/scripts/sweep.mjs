import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.findIndex(a => a === "--" + name || a.startsWith("--" + name + "="));
  if (i < 0) return dflt;
  const a = argv[i];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : (argv[i + 1] ?? dflt);
};
const has = name => argv.includes("--" + name);
if (has("help")) {
  console.log("usage: sweep.mjs [--url U] [--out DIR] [--sizes WxH,...] [--states hash,...] [--settle ms] [--dsf n] [--balloon]");
  process.exit(0);
}

const BASE = flag("url", "http://localhost:5199/");
const OUT = flag("out", join(tmpdir(), "cursors-sweep"));
const SETTLE = +flag("settle", 3000);
const DSF = +flag("dsf", 1);
const KEEP_BALLOON = has("balloon");

const SIZES = flag("sizes", "1280x800,1024x768,390x844,844x390")
  .split(",").map(s => s.trim()).filter(Boolean)
  .map(s => { const [w, h] = s.toLowerCase().split("x").map(Number); return { w, h }; });

const STATES = flag("states", [
  "desktop",
  "desktop-cx",
  "desktop-cx-stats",
  "desktop-cx-hist",
  "desktop-start",
  "desktop-exp-c",
  "desktop-sys-cmd",
  "desktop-mine",
].join(",")).split(",").map(s => s.trim().replace(/^#/, "")).filter(Boolean);

if (SIZES.some(s => !s.w || !s.h)) { console.error("bad --sizes; want WxH,WxH"); process.exit(1); }

const EDGE = process.env.EDGE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9500 + Math.floor(Math.random() * 500);
const profile = join(tmpdir(), "edge-cdp-" + port + "-" + Date.now());
const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
  "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank",
], { stdio: "ignore" });
const bail = (msg, code) => { console.error(msg); try { edge.kill(); } catch {} process.exit(code); };

let target = null;
for (let i = 0; i < 60 && !target; i++) {
  await new Promise(r => setTimeout(r, 250));
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find(t => t.type === "page");
  } catch {}
}
if (!target) bail("FAILED: DevTools port never came up", 2);

const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});
let onLoad = () => {};
ws.addEventListener("message", ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  }
  if (m.method === "Page.loadEventFired") onLoad();
});
await new Promise(res => ws.addEventListener("open", res));
await send("Page.enable");

await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `try{ localStorage.clear(); localStorage.setItem("cursorsxp",'{"tourSeen":1}'); }catch(e){}`,
});

mkdirSync(OUT, { recursive: true });
const url = state => BASE.replace(/#.*$/, "") + "#" + state;
const kb = n => (n / 1024).toFixed(0) + " KB";
console.log(`sweep: ${STATES.length} states x ${SIZES.length} sizes = ${STATES.length * SIZES.length} shots -> ${OUT}`);

let failed = 0;
for (const state of STATES) {
  for (const { w, h } of SIZES) {
    const file = join(OUT, `${state}@${w}x${h}.png`);
    const t0 = Date.now();
    try {
      const phone = Math.min(w, h) < 800;
      await send("Emulation.setDeviceMetricsOverride", {
        width: w, height: h, deviceScaleFactor: DSF, mobile: phone,
        screenWidth: w, screenHeight: h,
      });
      await send("Emulation.setTouchEmulationEnabled", { enabled: phone, maxTouchPoints: 5 });
      await send("Page.navigate", { url: "about:blank" });
      const loaded = new Promise(res => { onLoad = res; });
      await send("Page.navigate", { url: url(state) });
      await Promise.race([loaded, new Promise(r => setTimeout(r, 15000))]);
      await new Promise(r => setTimeout(r, SETTLE));
      if (!KEEP_BALLOON)
        await send("Runtime.evaluate", { expression: `(()=>{const b=document.getElementById("balloon"); if(b) b.style.display="none";})()` });
      const shot = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(file, Buffer.from(shot.data, "base64"));
      console.log(`OK   ${String(w + "x" + h).padEnd(9)} #${state.padEnd(18)} ${kb(statSync(file).size).padStart(7)}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${file}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${String(w + "x" + h).padEnd(9)} #${state.padEnd(18)} ${e.message}`);
    }
  }
}

console.log(failed ? `sweep finished with ${failed} failed shot(s)` : `sweep OK — ${STATES.length * SIZES.length} shots in ${OUT}`);
edge.kill();
process.exit(failed ? 1 : 0);
