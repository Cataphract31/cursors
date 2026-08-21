import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";
import { createSim, STAKE } from "./sim.js";
const GALLERY_DEPLOYS = 10;
const SKIN_IDS = new Set(["", "std-l", "std-xl", "black", "black-l", "black-xl", "inv", "inv-l", "inv-xl",
  "magnified", "animated", "bronze", "white", "dinosaur", "hands", "conductor", "oldfashioned", "variations"]);
import { openDb } from "./db.js";
import { createLedger, LedgerError } from "./ledger.js";
import { validGalleryPng } from "./png.js";

const PORT = +(process.env.PORT || 8788);
const DB_PATH = process.env.DB_PATH || "./cursors.db";
const CORPSES = process.env.FAST ? 8 : +(process.env.CORPSES || 900);

const LAMPORTS_PER_UNIT = 1_000_000;
const toLamports = (units) => Math.round(units) * LAMPORTS_PER_UNIT;

const toUnits = (lamports) => Math.floor((lamports || 0) / LAMPORTS_PER_UNIT);

const ledger = createLedger();
if (!ledger.enabled) {
  console.warn("NO LEDGER_KEY: nobody can deploy. Every attempt will be refused.");
}

const ARCADE_AUTH_URL = process.env.ARCADE_AUTH_URL || "http://127.0.0.1:8080/api/auth/me";

async function arcadeWallet(token) {
  try {
    const res = await fetch(ARCADE_AUTH_URL, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.wallet === "string" && body.wallet ? body.wallet : null;
  } catch {
    return null;
  }
}

const balances = new Map();
async function refreshBalance(wallet) {
  if (!wallet || !isWallet(wallet)) return;
  try {
    const b = await ledger.balanceOf(wallet);
    balances.set(wallet, b.freeLamports);
    const conn = byKey.get(wallet);
    if (conn) send(conn, { t: "bal", balance: toUnits(b.freeLamports) });
  } catch {}
}

const isWallet = (id) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(id || ""));

const db = openDb(DB_PATH);
const conns = new Set();
const byKey = new Map();

const saveTimers = new Map();

const MAX_BUFFER = 1 << 20;
function lagging(c) {
  if (c.ws.bufferedAmount <= MAX_BUFFER) return false;
  try { c.ws.terminate(); } catch {}
  return true;
}
function send(c, msg) { if (c.ws.readyState === 1 && !lagging(c)) c.ws.send(JSON.stringify(msg)); }
function watchers() { let n = 0; for (const c of conns) if (c.visible) n++; return n; }
function broadcastSnap(msg) {
  const s = JSON.stringify(msg);
  for (const c of conns) if (c.visible && c.ws.readyState === 1 && !lagging(c)) c.ws.send(s);
}
function broadcast(msg) { const s = JSON.stringify(msg); for (const c of conns) if (c.ws.readyState === 1 && !lagging(c)) c.ws.send(s); }
function sys(text) { pushChat("*", text); broadcast({ t: "sys", text }); }
function pushChat(who, text) { if (who !== "*") { try { db.chatPost(who, text); } catch (e) {} } }
function chatHistory() {
  return db.chatList().slice(-25).map(r => ({ who: r.who, text: r.txt, at: r.at }));
}

function onlineNames() {
  return [...byKey.values()].filter(c => c.hello)
    .map(c => sim.players.get(c.key)?.name).filter(Boolean);
}
function shortWallet(w) {
  return `${String(w).slice(0, 4)}..${String(w).slice(-4)}`;
}

function balMsg(key) {
  const p = sim.players.get(key); if (!p) return null;
  return { t: "bal", balance: toUnits(balances.get(key)) };
}
function schedSave(key) {
  clearTimeout(saveTimers.get(key));
  saveTimers.set(key, setTimeout(() => { saveTimers.delete(key); persistPlayer(key); }, 2000));
}
function persistPlayer(key) {
  const p = sim.players.get(key); if (!p) return;
  db.savePlayer({ token: key, name: p.name,
    totIn: p.totIn, totOut: p.totOut,
    published: p.published, created: p.created });
}

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
      case "bank": {
        broadcast(evt);
        if (!isWallet(evt.key)) break;
        const ref = ledger.refFor(evt.epoch, evt.id);
        const lamports = toLamports(evt.amt);
        db.settleOpen(ref, evt.key, lamports);
        ledger.settleRef(ref, lamports, `epoch ${evt.epoch}`)
          .then(() => { db.settleDone(ref); refreshBalance(evt.key); })
          .catch((e) => console.error(`settle deferred ${ref}: ${e.message}`));
        break;
      }
      case "refund": {
        broadcast(evt);
        if (!isWallet(evt.key)) break;
        ledger.release(evt.epoch, evt.id, "recalled inside spawn grace")
          .then(() => refreshBalance(evt.key))
          .catch((e) => console.error(`release deferred e${evt.epoch}c${evt.id}: ${e.message}`));
        break;
      }
      case "crash": {
        db.epochAdd(evt);
        try { db.tx(() => { for (const key of byKey.keys()) persistPlayer(key); }); }
        catch (e) { console.error("crash persist failed:", e); }
        broadcast(evt);
        pushChat("*", "it crashed again. everyone got banked. we go again");
        break;
      }
      case "sys": sys(evt.text); break;
      default: broadcast(evt);
    }
  },
});

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
    try { if (++steps % 2 === 0 && watchers()) broadcastSnap(sim.snapshot()); }
    catch (e) { console.error("snapshot failed:", e); }
  }
}, 10);

function sanitizeName(raw) {
  return String(raw || "").trim().replace(/[^\w .$-]/g, "").slice(0, 14);
}
function uniqueName(want, token) {
  const base = sanitizeName(want) || "guest";
  const taken = n =>
    [...sim.players.values()].some(p => p.key !== token && p.name.toLowerCase() === n.toLowerCase())
    || db.nameTaken(n, token);
  if (!taken(base)) return base;
  for (let i = 2; i <= 9; i++) if (!taken(base + i)) return base + i;
  return (base + "-" + randomBytes(2).toString("hex")).slice(0, 14);
}

async function deploy(c) {
  const why = sim.checkDeploy(c.key);
  if (why) { if (why !== "deploys closed" && why !== "max live") send(c, { t: "err", msg: why }); return; }

  if (!isWallet(c.key)) {
    send(c, { t: "err", msg: "connect a wallet to deploy — a guest login holds no money" });
    return;
  }

  const epoch = sim.epochNo();
  const cursorId = sim.reserveCursorId();
  try {
    const held = await ledger.hold(c.key, toLamports(STAKE), epoch, cursorId);
    balances.set(c.key, held.freeLamports);
  } catch (err) {
    const e = err instanceof LedgerError ? err : null;
    if (e && e.isBroke) send(c, { t: "err", msg: "insufficient" });
    else if (e && e.isNotAWallet) send(c, { t: "err", msg: "connect a wallet to deploy" });
    else {
      console.error(`hold failed for ${c.key}: ${e ? e.code : err.message}`);
      send(c, { t: "err", msg: "the books are unreachable — nothing was staked" });
    }
    return;
  }

  const cur = sim.commitDeploy(c.key, cursorId);
  if (!cur) {
    ledger.release(epoch, cursorId, "round closed before the cursor spawned")
      .catch((e) => console.error(`release after failed commit: ${e.message}`));
    void refreshBalance(c.key);
    return;
  }
  void refreshBalance(c.key);
}

function handle(c, m) {
  const now = Date.now();
  switch (m.t) {
    case "hello": {
      if (c.helloAt && now - c.helloAt < 2000) return;
      c.helloAt = now; c.hellos = (c.hellos || 0) + 1;
      if (c.hellos > 5) { c.ws.close(); return; }
      const token = /^[0-9a-f]{32}$/.test(m.token || "") ? m.token : randomBytes(16).toString("hex");
      c.key = token;
      const persisted = db.loadPlayer(token);
      const name = uniqueName(m.name || (persisted && persisted.name), token);
      const p = sim.registerPlayer(token, name, persisted ? {
        totIn: persisted.totIn, totOut: persisted.totOut, created: persisted.created,
        published: persisted.published,
      } : null);
      p.name = name;
      if (SKIN_IDS.has(String(m.skin || ""))) p.skin = String(m.skin || "");
      const old = byKey.get(token);
      if (old && old !== c) { send(old, { t: "err", msg: "signed in elsewhere" }); old.ws.close(); }
      byKey.set(token, c);
      c.hello = true;
      conns.add(c);
      persistPlayer(token);
      const b = balMsg(token);
      send(c, {
        t: "welcome", token, name,
        balance: b.balance,
        epoch: sim.welcomeState(), chat: chatHistory(),
        dms: db.dmFor(token).map(d => ({
          who: d.fromTok === token ? d.toName : d.fromName,
          text: d.txt, at: d.at, mine: d.fromTok === token,
        })),
        online: onlineNames(),
      });
      broadcast({ t: "join", name, online: onlineNames() });
      sys(`${name} signed in — ${conns.size} player${conns.size === 1 ? "" : "s"} online`);
      break;
    }
    case "arcade": {
      if (!c.hello) return;
      const token = String(m.token || "");
      if (!token) { send(c, { t: "err", msg: "no arcade session" }); return; }
      void (async () => {
        const wallet = await arcadeWallet(token);
        if (!wallet) { send(c, { t: "err", msg: "arcade session rejected" }); return; }
        const old = byKey.get(wallet);
        if (old && old !== c) { send(old, { t: "err", msg: "signed in elsewhere" }); old.ws.close(); }
        byKey.delete(c.key);
        c.key = wallet;
        byKey.set(wallet, c);
        const persisted = db.loadPlayer(wallet);
        const name = uniqueName((persisted && persisted.name) || shortWallet(wallet), wallet);
        const p = sim.registerPlayer(wallet, name, persisted ? {
          totIn: persisted.totIn, totOut: persisted.totOut,
          created: persisted.created, published: persisted.published,
        } : null);
        p.name = name;
        persistPlayer(wallet);
        await refreshBalance(wallet);
        send(c, { t: "welcome", token: wallet, name, balance: toUnits(balances.get(wallet)),
                  epoch: sim.welcomeState(), chat: chatHistory(), dms: [], online: onlineNames(), wallet });
        broadcast({ t: "join", name, online: onlineNames() });
      })();
      return;
    }

    case "skin": {
      if (c.key && SKIN_IDS.has(String(m.skin || ""))) {
        const p = sim.players.get(c.key);
        if (p) p.skin = String(m.skin || "");
      }
      break;
    }
    case "deploy": {
      // One deploy attempt per 500ms per connection. Without this, every
      // message is a round-trip against the arcade ledger (hold attempt), and
      // a scripted client can pump those far faster than the UI can send them.
      // The client's own auto-deploy ticks at 1800ms, so honest play is never
      // throttled by this.
      if (now - (c.lastDeploy || 0) < 500) break;
      c.lastDeploy = now;
      void deploy(c);
      break;
    }
    case "recall": sim.requestRecall(c.key); break;
    case "recallOne": if (Number.isInteger(m.id)) sim.recallOne(c.key, m.id); break;
    case "recallCancel": sim.cancelRecall(c.key); break;
    case "chat": {
      const text = String(m.text || "").slice(0, 200).trim();
      if (!text || now - c.lastChat < 1200) return;
      c.lastChat = now;
      const who = sim.players.get(c.key)?.name || "?";
      pushChat(who, text);
      broadcast({ t: "chat", who, text });
      break;
    }
    case "dm": {
      if (!c.key) break;
      const to = sanitizeName(m.to), txt = String(m.text || "").slice(0, 300).trim();
      if (!to || !txt) break;
      if (now - (c.lastDm || 0) < 500) break;
      c.lastDm = now;
      const me = sim.players.get(c.key);
      if (!me || me.name === to) break;
      let target = null, toTok = null;
      for (const x of conns) {
        const p = x.key && sim.players.get(x.key);
        if (p && p.name === to) { target = x; toTok = x.key; break; }
      }
      if (!toTok) toTok = db.tokenForName(to);
      if (!toTok) { send(c, { t: "dmFail", to, kept: false }); break; }
      try { db.dmPost({ fromTok: c.key, toTok, fromName: me.name, toName: to, txt }); } catch (e) {}
      if (!target) { send(c, { t: "dmFail", to, kept: true }); break; }
      send(target, { t: "dm", from: me.name, text: txt });
      break;
    }
    case "guest":
      if (now - (c.lastGuestGet || 0) < 3000) return;
      c.lastGuestGet = now;
      send(c, { t: "guest", list: db.guestList() });
      break;
    case "guestPost": {
      const wp = sim.players.get(c.key);
      if (!wp || wp.totIn < STAKE) return send(c, { t: "err", msg: "deploy a cursor first — the guestbook is for players" });
      if (now - c.lastGuest < 30000) return send(c, { t: "err", msg: "one entry per 30s" });
      const txt = String(m.text || "").slice(0, 220).trim();
      if (!txt) return;
      c.lastGuest = now;
      db.guestPost(sanitizeName(m.who) || sim.players.get(c.key)?.name || "anonymous", txt);
      broadcast({ t: "guest", list: db.guestList() });
      break;
    }
    case "gallery":
      if (now - (c.lastGalleryGet || 0) < 10000) return;
      c.lastGalleryGet = now;
      send(c, { t: "gallery", list: db.galleryList() });
      break;
    case "galleryPost": {
      const gp = sim.players.get(c.key);
      const credits = Math.floor((gp ? gp.totIn : 0) / (STAKE * GALLERY_DEPLOYS)) - (gp ? gp.published || 0 : 0);
      if (credits < 1) {
        const done = ((gp ? gp.totIn : 0) / STAKE) % GALLERY_DEPLOYS;
        return send(c, { t: "err",
          msg: `the gallery is earned, not free — ${GALLERY_DEPLOYS - Math.floor(done)} more deploys for a frame` });
      }
      if (now - c.lastGallery < 20000) return send(c, { t: "err", msg: "one painting per 20s" });
      const png = String(m.png || "");
      if (!validGalleryPng(png))
        return send(c, { t: "err", msg: "png only, 400 KB max" });
      c.lastGallery = now;
      gp.published = (gp.published || 0) + 1;
      const title = String(m.name || "").replace(/[^\w .$'-]/g, "").slice(0, 28) || "untitled";
      db.galleryPost(title, sim.players.get(c.key)?.name || "?", png);
      broadcast({ t: "galAdd", item: db.galleryLatest() });
      sys(`${sim.players.get(c.key)?.name} published a painting to the gallery`);
      break;
    }
    case "vis": {
      const on = m.on !== false, was = c.visible;
      c.visible = on;
      if (on && !was && now - (c.lastResync || 0) > 2000) {
        c.lastResync = now;
        send(c, { t: "resync", epoch: sim.welcomeState() });
      }
      break;
    }
    case "sync": {
      if (now - (c.lastSync || 0) < 2000) break;
      c.lastSync = now;
      void refreshBalance(c.key);
      break;
    }
    case "ping": send(c, { t: "pong" }); break;
  }
}

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
const wss = new WebSocketServer({
  server: http, maxPayload: 512 * 1024,
  perMessageDeflate: {
    zlibDeflateOptions: { level: 6, memLevel: 7, windowBits: 13 },
    clientNoContextTakeover: false, serverNoContextTakeover: false,
    threshold: 128,
  },
});

wss.on("connection", ws => {
  if (wss.clients.size > 150) { try { ws.terminate(); } catch {} return; }
  const c = { ws, key: null, hello: false, lastChat: 0, lastGuest: 0, lastGallery: 0, alive: true, visible: true };
  c.preT = setTimeout(() => { if (!c.hello) ws.terminate(); }, 15000);
  ws.on("pong", () => { c.alive = true; });
  ws.on("message", data => {
    let m; try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== "object" || typeof m.t !== "string") return;
    if (!c.hello && m.t !== "hello") return;
    try { handle(c, m); } catch (e) { console.error("handle failed:", m.t, e); }
  });
  ws.on("close", () => {
    clearTimeout(c.preT);
    conns.delete(c);
    if (c.key) {
      clearTimeout(saveTimers.get(c.key)); saveTimers.delete(c.key);
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
    if (!c.alive) { try { c.ws.terminate(); } catch {} continue; }
    c.alive = false;
    try { c.ws.ping(); } catch {}
  }
}, 30000);

function shutdown() {
  for (const key of byKey.keys()) persistPlayer(key);
  db.close();
  process.exit(0);
}
// An unknown-state process must not keep taking stakes. Exit and let systemd
// restart us: boot replay (settlePending) and the sweep exist precisely to
// make a restart the safe outcome, so use them.
function die(why, e) {
  console.error(why, e);
  try { for (const key of [...byKey.keys()]) { try { persistPlayer(key); } catch {} } } catch {}
  process.exit(1);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", e => die("uncaught:", e));
process.on("unhandledRejection", e => die("unhandled:", e));

if (ledger.enabled) {
  const pending = db.settlePending();
  if (pending.length > 0) {
    console.log(`replaying ${pending.length} bank(s) the last run did not file`);
    for (const row of pending) {
      try {
        await ledger.settleRef(row.ref, row.lamports, "replayed after a restart");
        db.settleDone(row.ref);
      } catch (e) {
        console.error(`COULD NOT REPLAY ${row.ref} (${row.lamports} lamports): ${e.message}`);
      }
    }
  }
}

if (ledger.enabled) {
  try {
    const released = await ledger.sweep();
    if (released > 0) console.log(`released ${released} stranded stakes back to their wallets`);
    const stuck = db.settlePending();
    for (const row of stuck) {
      console.error(
        `UNPAYABLE BANK ${row.ref}: ${row.lamports} lamports owed to ${row.wallet}, ` +
        "but the hold behind it has been released. The stake went back instead.",
      );
    }
    if (stuck.length > 0) db.settleClear();
  } catch (e) {
    console.error(`COULD NOT SWEEP STRANDED STAKES: ${e.message}`);
  }
}

http.listen(PORT, () => console.log(`CURSORS.EXE server on :${PORT} — epoch ${sim.epochNo()}, ${CORPSES} corpses to a crash, 0.1 SOL a deploy`));
