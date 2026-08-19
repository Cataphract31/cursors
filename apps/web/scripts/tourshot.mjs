import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, out, w = "1280", h = "800", settle = "3000", dsf = "1"] = process.argv.slice(2);
if (!url || !out) { console.error("usage: shot.mjs <url> <out.png> [w] [h] [settleMs] [deviceScaleFactor]"); process.exit(1); }

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9500 + Math.floor(Math.random() * 500);
const profile = join(tmpdir(), "edge-cdp-" + port + "-" + Date.now());

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
  "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank",
], { stdio: "ignore" });
const bail = (msg, code) => { console.error(msg); try { edge.kill(); } catch {} process.exit(code); };
setTimeout(() => bail("TIMEOUT: screenshot did not complete in 40s", 3), 40000).unref();

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
  const phone = Math.min(+w, +h) < 800;
  await send("Emulation.setDeviceMetricsOverride", {
    width: +w, height: +h, deviceScaleFactor: +dsf, mobile: phone,
    screenWidth: +w, screenHeight: +h,
  });
  if (phone) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Page.navigate", { url });
  await Promise.race([loaded, new Promise(r => setTimeout(r, 15000))]);
  await new Promise(r => setTimeout(r, +settle));
  if (process.env.ROTATE) {
    const [rw, rh] = process.env.ROTATE.split("x").map(Number);
    await send("Emulation.setDeviceMetricsOverride", {
      width: rw, height: rh, deviceScaleFactor: +dsf, mobile: Math.min(rw, rh) < 800,
      screenWidth: rw, screenHeight: rh,
    });
    await new Promise(r => setTimeout(r, +(process.env.ROTATE_WAIT || 2500)));
  }
  if (process.env.EXPR) {
    await send("Runtime.evaluate", { expression: process.env.EXPR, awaitPromise: true });
    await new Promise(r => setTimeout(r, +(process.env.EXPR_WAIT || 1500)));
  }
  let clip;
  if (process.env.SEL) {
    const pad = +(process.env.PAD || 0);
    const r = await send("Runtime.evaluate", {
      expression: `(()=>{const e=document.querySelector(${JSON.stringify(process.env.SEL)});
        if(!e) return "null"; const b=e.getBoundingClientRect();
        return JSON.stringify({x:b.x,y:b.y,width:b.width,height:b.height});})()`,
      returnByValue: true,
    });
    const box = r.result.value === "null" ? null : JSON.parse(r.result.value);
    if (!box) bail("FAILED: SEL matched nothing: " + process.env.SEL, 2);
    clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
             width: box.width + pad * 2, height: box.height + pad * 2, scale: +dsf };
  }
  const shot = await send("Page.captureScreenshot", clip ? { format: "png", clip } : { format: "png" });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("OK " + out + (clip ? ` (clip ${Math.round(clip.width)}x${Math.round(clip.height)} @${dsf}x)` : " (" + w + "x" + h + ")"));
} catch (e) {
  bail("FAILED: " + e.message, 2);
}
edge.kill();
process.exit(0);
