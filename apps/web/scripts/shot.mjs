// Screenshot driver: node scripts/shot.mjs <url> <out.png> [width] [height] [settleMs]
//
// Why not plain `msedge --headless --screenshot`? On this machine headless Edge
// clamps the window to ~500px wide and steals ~95px of height for chrome, so
// `--window-size=390,844` yields a 492x749 CSS viewport — phone layouts never
// render at phone width. This drives the DevTools protocol instead and uses
// Emulation.setDeviceMetricsOverride, which emulates the exact viewport.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, out, w = "1280", h = "800", settle = "3000"] = process.argv.slice(2);
if (!url || !out) { console.error("usage: shot.mjs <url> <out.png> [w] [h] [settleMs]"); process.exit(1); }

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9500 + Math.floor(Math.random() * 500);
const profile = join(tmpdir(), "edge-cdp-" + port + "-" + Date.now());

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
  "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank",
], { stdio: "ignore" });
const bail = (msg, code) => { console.error(msg); try { edge.kill(); } catch {} process.exit(code); };
setTimeout(() => bail("TIMEOUT: screenshot did not complete in 40s", 3), 40000).unref();

// find the page target (poll: the browser needs a beat to open the port)
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
const loaded = new Promise(res => {
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
    if (m.method === "Page.loadEventFired") res();
  });
});
await new Promise(res => ws.addEventListener("open", res));

try {
  await send("Page.enable");
  // Phone-ness is the SHORT side, not the width — a landscape phone is 844px
  // wide and must still emulate as a phone. screenWidth/screenHeight matter
  // because the app picks its shell from window.screen, and touch emulation
  // matters because it picks it from (pointer:coarse).
  const phone = Math.min(+w, +h) < 800;
  await send("Emulation.setDeviceMetricsOverride", {
    width: +w, height: +h, deviceScaleFactor: 1, mobile: phone,
    screenWidth: +w, screenHeight: +h,
  });
  if (phone) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Page.navigate", { url });
  await Promise.race([loaded, new Promise(r => setTimeout(r, 15000))]);
  await new Promise(r => setTimeout(r, +settle)); // boot animations, arena, fonts
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("OK " + out + " (" + w + "x" + h + ")");
} catch (e) {
  bail("FAILED: " + e.message, 2);
}
edge.kill();
process.exit(0);
