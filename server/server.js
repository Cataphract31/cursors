/* CURSORS.EXE beta server — one Node process, same shape as THIN ICE's:
   built-in node:sqlite, a ws server, no external database, single writer.
   Play money only: every visitor gets 5.000 SOL, bots are full economic
   participants, and the faucet refills anyone who busts. The sim (sim.js) is
   the single authority; this file is sockets, persistence, chat, the
   guestbook, the gallery, and the TV queue.

   Run: PORT=8788 DB_PATH=/var/lib/cursors/cursors.db node server.js
   Env: CORPSES=64 (deaths per epoch — the disk), FAST=1 (tiny epochs, dev) */

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";
import { createSim, BOT_NAMES } from "./sim.js";
import { openDb } from "./db.js";

const PORT = +(process.env.PORT || 8788);
const DB_PATH = process.env.DB_PATH || "./cursors.db";
const CORPSES = process.env.FAST ? 8 : +(process.env.CORPSES || 900);

const db = openDb(DB_PATH);
const conns = new Set();          /* live sockets with a completed hello */
const byKey = new Map();          /* token -> conn (latest wins) */
const chatLog = [];               /* ring buffer of {who,text,at} */
const saveTimers = new Map();

/* ---------- broadcast plumbing ---------- */
function send(c, msg) { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); }
/* A hidden tab cannot draw a snapshot, so it does not get one. Events (kills,
   banks, chat, the crash) still go to everyone: those are state, not frames,
   and a returning player must not have missed them. */
function watchers() { let n = 0; for (const c of conns) if (c.visible) n++; return n; }
function broadcastSnap(msg) {
  const s = JSON.stringify(msg);
  for (const c of conns) if (c.visible && c.ws.readyState === 1) c.ws.send(s);
}
function broadcast(msg) { const s = JSON.stringify(msg); for (const c of conns) if (c.ws.readyState === 1) c.ws.send(s); }
function sys(text) { pushChat("*", text); broadcast({ t: "sys", text }); }
function pushChat(who, text) { chatLog.push({ who, text, at: Date.now() }); if (chatLog.length > 40) chatLog.shift(); }

function onlineNames() {
  return [...byKey.values()].filter(c => c.hello)
    .map(c => sim.players.get(c.key)?.name).filter(Boolean);
}
function balMsg(key) {
  const p = sim.players.get(key); if (!p) return null;
  let glob = 0;
  for (const o of sim.players.values()) if (o !== p) glob += o.tickets;
  return { t: "bal", balance: p.balance, tickets: Math.round(p.tickets), glob: Math.round(glob), rake: p.rake };
}
function schedSave(key) {
  if (key.startsWith("bot:")) return;
  clearTimeout(saveTimers.get(key));
  saveTimers.set(key, setTimeout(() => persistPlayer(key), 2000));
}
function persistPlayer(key) {
  const p = sim.players.get(key); if (!p || p.bot) return;
  db.savePlayer({ token: key, name: p.name, balance: p.balance, tickets: p.tickets,
    ticketsAt: p.ticketsAt, rake: p.rake, totIn: p.totIn, totOut: p.totOut, created: p.created });
}

/* ---------- the sim ---------- */
const sim = createSim({
  corpses: CORPSES,
  emit(evt) {
    switch (evt.t) {
      case "money": {
        const c = byKey.get(evt.key);
        if (c) { const m = balMsg(evt.key); if (m) send(c, m); }
        schedSave(evt.key);
        break;
      }
      case "crash": {
        db.epochAdd(evt);
        for (const key of byKey.keys()) persistPlayer(key);
        broadcast(evt);
        pushChat("*", "it crashed again. everyone got banked. we go again");
        break;
      }
      case "sys": sys(evt.text); break;
      default: broadcast(evt);
    }
  },
});

/* Fixed timestep, and snapshots emitted FROM the loop rather than beside it.
   Both halves of that matter. A variable dt makes each step's displacement
   depend on timer jitter; and a snapshot interval that is not a whole multiple
   of the step lands alternately after one step or two, so a cursor appears to
   move a step, then two steps, then a step — measured at 33% speed variance,
   which reads as stutter no amount of client smoothing can hide.
   30Hz sim, snapshot every 2nd step = a true 15Hz, evenly spaced in sim time.
   Catch-up is capped at 3 steps: after a pause the world resyncs, it never
   fast-forwards through a burst (the THIN ICE lesson). */
const STEP = 1 / 30, STEP_MS = STEP * 1000;
let acc = 0, lastTick = Date.now(), steps = 0;
setInterval(() => {
  const t = Date.now();
  acc += t - lastTick;
  lastTick = t;
  if (acc > STEP_MS * 3) acc = STEP_MS * 3;
  while (acc >= STEP_MS) {
    acc -= STEP_MS;
    try { sim.tick(STEP); } catch (e) { console.error("sim tick failed:", e); }
    if (++steps % 2 === 0 && watchers()) broadcastSnap(sim.snapshot());
  }
}, 10);

/* ---------- TV: the lobby watches one video together ---------- */
const tv = { now: null, queue: [] };
function tvMsg() { return { t: "tv", now: tv.now, queue: tv.queue }; }
let skipVotes = new Set();
function tvAdvance() {
  tv.now = tv.queue.length ? { ...tv.queue.shift(), startedAt: Date.now() } : null;
  skipVotes = new Set();
  broadcast(tvMsg());
}

/* ---------- per-connection protocol ---------- */
function sanitizeName(raw) {
  return String(raw || "").trim().replace(/[^\w .$-]/g, "").slice(0, 14);
}
function uniqueName(want, token) {
  const base = sanitizeName(want) || "guest";
  const taken = n => BOT_NAMES.includes(n.toLowerCase())
    || [...sim.players.values()].some(p => p.key !== token && p.name.toLowerCase() === n.toLowerCase())
    || db.nameTaken(n, token);
  if (!taken(base)) return base;
  for (let i = 2; i <= 9; i++) if (!taken(base + i)) return base + i;
  return (base + "-" + randomBytes(2).toString("hex")).slice(0, 14);
}

function handle(c, m) {
  const now = Date.now();
  switch (m.t) {
    case "hello": {
      const token = /^[0-9a-f]{32}$/.test(m.token || "") ? m.token : randomBytes(16).toString("hex");
      c.key = token;
      const persisted = db.loadPlayer(token);
      const name = uniqueName(m.name || (persisted && persisted.name), token);
      const p = sim.registerPlayer(token, name, false, persisted ? {
        balance: persisted.balance, tickets: persisted.tickets, ticketsAt: persisted.ticketsAt,
        rake: persisted.rake, totIn: persisted.totIn, totOut: persisted.totOut, created: persisted.created,
      } : null);
      p.name = name;
      const old = byKey.get(token);
      if (old && old !== c) { send(old, { t: "err", msg: "signed in elsewhere" }); old.ws.close(); }
      byKey.set(token, c);
      c.hello = true;
      conns.add(c);
      persistPlayer(token);
      const b = balMsg(token);
      send(c, {
        t: "welcome", token, name,
        balance: b.balance, tickets: b.tickets, glob: b.glob, rake: b.rake,
        epoch: sim.welcomeState(), chat: chatLog.slice(-25),
        online: onlineNames(),
        tv: { now: tv.now, queue: tv.queue },
      });
      broadcast({ t: "join", name, online: onlineNames() });
      sys(`${name} signed in — ${conns.size} player${conns.size === 1 ? "" : "s"} online`);
      break;
    }
    case "deploy": { const err = sim.requestDeploy(c.key); if (err && err !== "deploys closed") send(c, { t: "err", msg: err }); break; }
    case "recall": sim.requestRecall(c.key); break;
    case "recallOne": if (Number.isInteger(m.id)) sim.recallOne(c.key, m.id); break;
    case "stance": sim.setStance(c.key, m.s); break;
    case "rake": sim.claimRake(c.key); break;
    case "chat": {
      const text = String(m.text || "").slice(0, 200).trim();
      if (!text || now - c.lastChat < 1200) return;
      c.lastChat = now;
      const who = sim.players.get(c.key)?.name || "?";
      pushChat(who, text);
      broadcast({ t: "chat", who, text });
      break;
    }
    case "guest": send(c, { t: "guest", list: db.guestList() }); break;
    case "guestPost": {
      if (now - c.lastGuest < 30000) return send(c, { t: "err", msg: "one entry per 30s" });
      const txt = String(m.text || "").slice(0, 220).trim();
      if (!txt) return;
      c.lastGuest = now;
      db.guestPost(sanitizeName(m.who) || sim.players.get(c.key)?.name || "anonymous", txt);
      broadcast({ t: "guest", list: db.guestList() });
      break;
    }
    case "gallery": send(c, { t: "gallery", list: db.galleryList() }); break;
    case "galleryPost": {
      if (now - c.lastGallery < 60000) return send(c, { t: "err", msg: "one painting per minute" });
      const png = String(m.png || "");
      if (!png.startsWith("data:image/png;base64,") || png.length > 400000)
        return send(c, { t: "err", msg: "png only, 400 KB max" });
      c.lastGallery = now;
      const title = String(m.name || "").replace(/[^\w .$'-]/g, "").slice(0, 28) || "untitled";
      db.galleryPost(title, sim.players.get(c.key)?.name || "?", png);
      broadcast({ t: "gallery", list: db.galleryList() });
      sys(`${sim.players.get(c.key)?.name} published a painting to the gallery`);
      break;
    }
    case "tvQueue": {
      const vid = String(m.vid || "");
      if (!/^[\w-]{11}$/.test(vid)) return send(c, { t: "err", msg: "that is not a youtube video id" });
      const who = sim.players.get(c.key)?.name || "?";
      if (tv.queue.filter(q => q.by === who).length >= 3) return send(c, { t: "err", msg: "3 queued max — let it rotate" });
      tv.queue.push({ vid, by: who });
      if (!tv.now) tvAdvance(); else broadcast(tvMsg());
      break;
    }
    case "tvEnded":
      if (tv.now && tv.now.vid === m.vid && now - tv.now.startedAt > 20000) tvAdvance();
      break;
    case "tvSkip": {
      if (!tv.now) return;
      skipVotes.add(c.key);
      const need = conns.size <= 2 ? 1 : Math.ceil(conns.size / 3);
      if (skipVotes.size >= need) { sys("the lobby voted to skip"); tvAdvance(); }
      else broadcast({ t: "sys", text: `skip vote: ${skipVotes.size}/${need}` });
      break;
    }
    case "vis":
      c.visible = m.on !== false;
      /* coming back needs the whole world, not the next 66ms of it */
      if (c.visible) send(c, { t: "resync", epoch: sim.welcomeState() });
      break;
    case "ping": send(c, { t: "pong" }); break;
  }
}

/* ---------- http + ws ---------- */
const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({
      ok: true, game: "cursors", epoch: sim.epochNo(), phase: sim.phase(),
      players: conns.size, cursors: sim.cursCount(),
      disk: { used: sim.diskUsed(), total: sim.DISK_TOTAL },
    }));
    return;
  }
  res.writeHead(404); res.end("CURSORS.EXE beta server. The game is elsewhere; this is only the wire.");
});
/* Egress is the scarce resource on a free-tier box: uncompressed JSON
   snapshots measured 10.9 MB per player-hour, which spends the 1 GB monthly
   allowance in 92 player-hours. Snapshots are extremely repetitive, so
   permessage-deflate pays for itself several times over; windowBits is dialled
   down because 20 zlib contexts on a 1 GB VM matter more than the last few
   percent of ratio. */
const wss = new WebSocketServer({
  server: http, maxPayload: 512 * 1024,
  perMessageDeflate: {
    zlibDeflateOptions: { level: 6, memLevel: 7, windowBits: 13 },
    clientNoContextTakeover: false, serverNoContextTakeover: false,
    threshold: 128,
  },
});

wss.on("connection", ws => {
  const c = { ws, key: null, hello: false, lastChat: 0, lastGuest: 0, lastGallery: 0, alive: true, visible: true };
  ws.on("pong", () => { c.alive = true; });
  ws.on("message", data => {
    let m; try { m = JSON.parse(data); } catch { return; }
    if (!c.hello && m.t !== "hello") return;
    try { handle(c, m); } catch (e) { console.error("handle failed:", m.t, e); }
  });
  ws.on("close", () => {
    conns.delete(c);
    if (c.key) {
      persistPlayer(c.key);
      if (byKey.get(c.key) === c) {
        byKey.delete(c.key);
        const name = sim.players.get(c.key)?.name;
        if (name && c.hello) broadcast({ t: "part", name, online: onlineNames() });
      }
    }
  });
});
setInterval(() => {
  for (const c of conns) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false;
    try { c.ws.ping(); } catch {}
  }
}, 30000);

function shutdown() {
  for (const key of byKey.keys()) persistPlayer(key);
  db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

http.listen(PORT, () => console.log(`CURSORS.EXE beta server on :${PORT} — epoch ${sim.epochNo()}, ${CORPSES} corpses to a crash`));
