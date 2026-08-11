/* Does the screen agree with the server?
 *
 *   node scripts/agree.mjs [seconds]
 *
 * Every "the bar is stale / lit / lying" bug is the same shape: the socket said
 * one thing and the HUD painted another. The rules tests in server/test cover
 * what the server decides; this covers whether the client tells you the truth
 * about it.
 *
 * It is deliberately black-box. A recorder is installed before any page script
 * runs, wrapping WebSocket and building `__truth` from inbound frames ONLY —
 * balance from welcome/bal, cursors from spawn/snap/bank/kill/refund. Nothing
 * reads the app's own variables, so the app cannot agree with itself by
 * construction; it has to agree with the wire.
 *
 * Boots its own server (FAST=1 → short epochs) and its own vite, drives real
 * clicks, and only reports a disagreement that PERSISTS — the wallet counter
 * animates toward its target, and a number mid-roll is not a lie. */
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SECS = +(process.argv[2] || 45);
const VITE_PORT = 5199, WS_PORT = 8788;
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9500 + Math.floor(Math.random() * 500);
const profile = join(tmpdir(), "edge-agree-" + port);
const kids = [];
const die = (msg, code) => { console.error(msg); cleanup(); process.exit(code); };
/* npm spawns vite as a grandchild through a shell, so killing the child we hold
   leaves the dev server running and the next run fails on --strictPort.
   taskkill /T takes the whole tree. */
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  for (const k of kids) {
    try {
      if (process.platform === "win32" && k.pid)
        spawnSync("taskkill", ["/PID", String(k.pid), "/T", "/F"], { stdio: "ignore" });
      else k.kill();
    } catch {}
  }
}
process.on("exit", cleanup);

/* ---- the recorder, installed before the app's own scripts ---- */
const RECORDER = `(() => {
  const T = { name: null, balance: null, curs: {}, frames: 0, epoch: 0, welcomes: 0, sockets: 0 };
  window.__truth = T;
  const Native = window.WebSocket;
  window.WebSocket = function (...a) {
    const ws = new Native(...a); T.sockets++; T.live = ws;
    ws.addEventListener("message", ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      T.frames++;
      switch (m.t) {
        case "welcome":
          T.welcomes++; T.name = m.name; T.balance = m.balance; T.curs = {};
          for (const c of (m.epoch && m.epoch.curs) || [])
            T.curs[c.id] = { owner: c.owner, bounty: c.bounty, mode: c.mode };
          break;
        case "bal": T.balance = m.balance; break;
        case "spawn": T.curs[m.id] = { owner: m.owner, bounty: m.bounty, mode: "r" }; break;
        case "bank": case "refund": delete T.curs[m.id]; break;
        case "kill": delete T.curs[m.l]; break;
        case "epoch": T.curs = {}; T.epoch = m.no; break;
        case "snap":
          /* the snapshot is the whole field: anything absent is gone */
          { const seen = {};
            for (const [id, x, y, bounty, mode] of m.p || []) {
              const prev = T.curs[id];
              seen[id] = { owner: prev ? prev.owner : null, bounty, mode };
            }
            T.curs = seen; }
          break;
      }
    });
    return ws;
  };
  window.WebSocket.prototype = Native.prototype;
  Object.assign(window.WebSocket, Native);
})()`;

/* ---- the comparison, run in the page ---- */
const COMPARE = `(() => {
  const T = window.__truth;
  if (!T || !T.name || T.balance === null) return { skip: "no server truth yet" };
  const fmt = u => ((u < 0 ? "-" : "") + (Math.abs(u) / 1000).toFixed(3));
  const mine = Object.entries(T.curs)
    .filter(([, c]) => c.owner === T.name)
    .map(([id, c]) => ({ id: +id, bounty: c.bounty, mode: c.mode }))
    .sort((a, b) => a.id - b.id);

  const walletEl = document.getElementById("walletamt");
  const domBal = walletEl ? Math.round(parseFloat(walletEl.textContent) * 1000) : null;
  const slots = [...document.querySelectorAll("#cx-strip .cslot[data-cid]")]
    .map(s => ({ id: +s.dataset.cid, txt: (s.querySelector("i") || {}).textContent || "" }))
    .sort((a, b) => a.id - b.id);
  const liveEl = document.getElementById("livecount");

  const bad = [];
  if (domBal !== T.balance) bad.push({ what: "wallet", screen: domBal, server: T.balance });
  const ids = a => a.map(x => x.id).join(",");
  if (ids(slots) !== ids(mine)) bad.push({ what: "strip ids", screen: ids(slots), server: ids(mine) });
  else for (const m of mine) {
    const s = slots.find(x => x.id === m.id);
    if (s && s.txt !== fmt(m.bounty))
      bad.push({ what: "slot " + m.id, screen: s.txt, server: fmt(m.bounty) });
  }
  if (liveEl && +liveEl.textContent !== mine.length)
    bad.push({ what: "live count", screen: liveEl.textContent, server: mine.length });
  return { bad, frames: T.frames, mine: mine.length, bal: T.balance,
    sockets: T.sockets, welcomes: T.welcomes };
})()`;

/* ---- one round of play, so the numbers actually move ---- */
const PLAY = `(() => {
  const d = document.getElementById("btn-deploy");
  const slots = [...document.querySelectorAll("#cx-strip .cslot[data-cid]")];
  const act = [];
  if (d && !d.disabled && slots.length < 5) { d.click(); act.push("deploy"); }
  else if (slots.length) { slots[0].click(); act.push("recall " + slots[0].dataset.cid); }
  return act;
})()`;

/* ---------------------------------------------------------------- boot ---- */
console.log("booting server (FAST=1) and vite…");
kids.push(spawn(process.execPath, ["server.js"], {
  cwd: new URL("../../../server", import.meta.url).pathname.replace(/^\//, ""),
  env: { ...process.env, FAST: "1", PORT: String(WS_PORT) }, stdio: "ignore", shell: false,
}));
kids.push(spawn("npm.cmd", ["run", "dev", "--", "--port", String(VITE_PORT), "--strictPort"], {
  cwd: new URL("..", import.meta.url).pathname.replace(/^\//, ""), stdio: "ignore", shell: true,
}));

const up = async (url, tries) => {
  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, 400));
    try { await fetch(url); return true; } catch {}
  }
  return false;
};
if (!await up(`http://localhost:${VITE_PORT}/`, 40)) die("vite never came up", 2);
if (!await up(`http://localhost:${WS_PORT}/health`, 40)) die("server never came up", 2);

const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
  "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
kids.push(edge);

let target = null;
for (let i = 0; i < 60 && !target; i++) {
  await new Promise(r => setTimeout(r, 250));
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === "page"); } catch {}
}
if (!target) die("devtools port never came up", 2);

const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0; const pending = new Map();
const cdp = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq; pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});
ws.addEventListener("message", ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  }
});
await new Promise(res => ws.addEventListener("open", res));
const evalIn = async expr => (await cdp("Runtime.evaluate",
  { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

await cdp("Page.enable");
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: RECORDER });
await cdp("Page.navigate", { url: `http://localhost:${VITE_PORT}/#desktop-mp` });
await new Promise(r => setTimeout(r, 6000));

/* SELFTEST=wallet|strip plants a lie on purpose. A detector that has never
   been seen to fail is not evidence of anything, so this is how you check the
   harness still works after touching it. Both modes must come back FAIL. */
if (process.env.SELFTEST) {
  const mode = process.env.SELFTEST;
  console.log(`selftest: planting a false ${mode} — this run MUST fail`);
  await evalIn(`(() => {
    setInterval(() => {
      if (${JSON.stringify(mode)} === "wallet") {
        const el = document.getElementById("walletamt");
        if (el) el.textContent = "9.999 SOL";
      } else {
        const s = document.querySelector("#cx-strip .cslot[data-cid] i");
        if (s) s.textContent = "9.999";
      }
    }, 60);
  })()`);
}

/* --------------------------------------------------------------- drive ---- */
/* A disagreement counts only if the SAME one is still there after this long.
   Below it, the wallet counter is simply still rolling toward its target. */
const GRACE_MS = 2000;
const open = new Map();          /* key -> { since, sample } */
const confirmed = [];
let samples = 0, skipped = 0, acted = 0;

/* FLAP=1 kills the live socket every ~12s and lets the client's own backoff
   bring it back. A dead socket is where the stuck "recalling…" latch lived:
   both the screen and this recorder go blind together, so they must still
   agree while blind and must re-agree once the welcome lands. Reconnect gets a
   longer grace — a resync may take a moment, it just may not settle wrong.

   Note this closes the page's actual WebSocket rather than using CDP's offline
   emulation, which does not disturb a connection that is already open. */
const FLAP = !!process.env.FLAP;
let flapAt = Date.now(), flaps = 0, resyncGraceUntil = 0;

const t0 = Date.now();
while (Date.now() - t0 < SECS * 1000) {
  if (FLAP && Date.now() - flapAt > 12000) {
    flapAt = Date.now();
    const killed = await evalIn(`(() => { const w = window.__truth && window.__truth.live;
      if (!w || w.readyState !== 1) return false; w.close(); return true; })()`);
    if (killed) { flaps++; resyncGraceUntil = Date.now() + 12000; }
  }
  if (samples % 5 === 0) { const a = await evalIn(PLAY); if (a && a.length) acted++; }
  const r = await evalIn(COMPARE);
  samples++;
  if (!r || r.skip) { skipped++; await new Promise(r2 => setTimeout(r2, 250)); continue; }

  const now = Date.now();
  const grace = now < resyncGraceUntil ? 12000 : GRACE_MS;
  const live = new Set();
  for (const b of r.bad) {
    const key = b.what + "|" + b.screen + "|" + b.server;
    live.add(key);
    if (!open.has(key)) open.set(key, { since: now, sample: b });
    else if (now - open.get(key).since >= grace && !confirmed.some(c => c.key === key))
      confirmed.push({ key, ...b, heldMs: now - open.get(key).since });
  }
  for (const k of [...open.keys()]) if (!live.has(k)) open.delete(k);
  await new Promise(r2 => setTimeout(r2, 250));
}

if (FLAP) await new Promise(r => setTimeout(r, 6000));   /* let the last reconnect land */
const last = (await evalIn(COMPARE)) || {};
console.log(`\nsamples ${samples} · actions ${acted} · frames ${last.frames} · skipped ${skipped}`
  + `${FLAP ? ` · drops ${flaps} · reconnects ${(last.welcomes || 1) - 1}` : ""}`);
if (skipped === samples) die("FAILED: the client never connected to the local server", 2);
/* a flap run that never actually broke the socket proves nothing, so it is a
   harness failure rather than a pass */
if (FLAP && (last.welcomes || 0) < 2)
  die(`FAILED: ${flaps} drops produced no reconnect — the flap never bit`, 2);
if (!confirmed.length) { console.log("PASS — screen and server agreed at every sample"); cleanup(); process.exit(0); }
console.log(`FAIL — ${confirmed.length} disagreement(s) held longer than ${GRACE_MS}ms:`);
for (const c of confirmed) console.log(`  ${c.what}: screen ${JSON.stringify(c.screen)} vs server ${JSON.stringify(c.server)} (held ${c.heldMs}ms)`);
cleanup(); process.exit(1);
