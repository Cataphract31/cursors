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
import { createSim, STAKE } from "./sim.js";
/* deploys per gallery frame — the anti-sybil wall, priced in real stake */
const GALLERY_DEPLOYS = 10;
/* the XP pointer schemes a cursor may wear on the field — ids, not files */
const SKIN_IDS = new Set(["", "std-l", "std-xl", "black", "black-l", "black-xl", "inv", "inv-l", "inv-xl",
  "magnified", "animated", "bronze", "white", "dinosaur", "hands", "conductor", "oldfashioned", "variations"]);
import { openDb } from "./db.js";
import { createLedger, LedgerError } from "./ledger.js";

const PORT = +(process.env.PORT || 8788);
const DB_PATH = process.env.DB_PATH || "./cursors.db";
const CORPSES = process.env.FAST ? 8 : +(process.env.CORPSES || 900);

/*
 * MONEY, AND THE UNITS IT IS COUNTED IN.
 *
 * The sim prices everything in whole play units -- STAKE 100, ENTRY 98, FEE 2 --
 * which is a good way to keep a game's arithmetic exact and no way at all to
 * hold real money. The arcade's ledger counts whole lamports and refuses
 * anything that is not an integer, so the two meet here and nowhere else.
 *
 * A deploy costs 0.001 SOL, which is the minimum bet across the rest of the
 * arcade. 100 units to 1,000,000 lamports makes one unit 10,000 lamports, and
 * every bounty in this game is a whole number of units, so every conversion is
 * exact. No floats touch money on either side of this line.
 */
const LAMPORTS_PER_UNIT = 10_000;
const toLamports = (units) => Math.round(units) * LAMPORTS_PER_UNIT;

const ledger = createLedger();
if (!ledger.enabled) {
  console.warn("NO LEDGER_KEY: nobody can deploy. Every attempt will be refused.");
}

/** Where the arcade will say who a session token belongs to. Loopback only. */
const ARCADE_AUTH_URL = process.env.ARCADE_AUTH_URL || "http://127.0.0.1:8080/api/auth/me";

/**
 * The wallet behind an arcade session token, or null.
 *
 * The arcade collected the signature; this asks it who signed. Deliberately
 * the only way a wallet identity enters this process -- a client claiming to
 * be an address proves nothing, and a game that believed one could be told to
 * spend somebody else's balance.
 */
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

/**
 * What the books last said about a wallet. DISPLAY ONLY.
 *
 * Nothing decides anything from this: a deploy is admitted or refused by
 * `ledger.hold`, atomically, where the money is. Refreshed whenever the ledger
 * answers, and on sign-in.
 */
const balances = new Map();
async function refreshBalance(wallet) {
  if (!wallet || !isWallet(wallet)) return;
  try {
    const b = await ledger.balanceOf(wallet);
    balances.set(wallet, b.freeLamports);
    const conn = byKey.get(wallet);
    if (conn) send(conn, { t: "bal", balance: b.freeLamports / 1e9 });
  } catch { /* the screen keeps what it last knew; no decision rests on it */ }
}

/** A wallet is base58 and 32-44 characters; a spectator token is neither. */
const isWallet = (id) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(id || ""));

const db = openDb(DB_PATH);
const conns = new Set();          /* live sockets with a completed hello */
const byKey = new Map();          /* token -> conn (latest wins) */

const saveTimers = new Map();

/* ---------- broadcast plumbing ---------- */
const MAX_BUFFER = 1 << 20;
function lagging(c) {
  /* TCP zero-window: the client stopped reading and every send queues in our
     heap. On a 1 GB box that is an OOM kill with everyone's session on it. */
  if (c.ws.bufferedAmount <= MAX_BUFFER) return false;
  try { c.ws.terminate(); } catch {}
  return true;
}
function send(c, msg) { if (c.ws.readyState === 1 && !lagging(c)) c.ws.send(JSON.stringify(msg)); }
/* A hidden tab cannot draw a snapshot, so it does not get one. Events (kills,
   banks, chat, the crash) still go to everyone: those are state, not frames,
   and a returning player must not have missed them. */
function watchers() { let n = 0; for (const c of conns) if (c.visible) n++; return n; }
function broadcastSnap(msg) {
  const s = JSON.stringify(msg);
  for (const c of conns) if (c.visible && c.ws.readyState === 1 && !lagging(c)) c.ws.send(s);
}
function broadcast(msg) { const s = JSON.stringify(msg); for (const c of conns) if (c.ws.readyState === 1 && !lagging(c)) c.ws.send(s); }
function sys(text) { pushChat("*", text); broadcast({ t: "sys", text }); }
/* History is what PLAYERS said. The room's own announcements — signed in,
   signed out, the epoch crashed — are broadcast live and then forgotten:
   they are the loudest thing in the room (a crash every epoch, a line per
   arrival) and holding them in the same buffer pushed every real message
   out of it long before anyone reconnected. */
function pushChat(who, text) { if (who !== "*") { try { db.chatPost(who, text); } catch (e) {} } }
function chatHistory() {
  return db.chatList().slice(-25).map(r => ({ who: r.who, text: r.txt, at: r.at }));
}

function onlineNames() {
  return [...byKey.values()].filter(c => c.hello)
    .map(c => sim.players.get(c.key)?.name).filter(Boolean);
}
/** 4+4 of an address, which is how every other game in this arcade shows one. */
function shortWallet(w) {
  return `${String(w).slice(0, 4)}..${String(w).slice(-4)}`;
}

function balMsg(key) {
  const p = sim.players.get(key); if (!p) return null;
  // Lamports out of the books, SOL on the wire, and zero for a spectator --
  // who has no account and therefore nothing to show.
  return { t: "bal", balance: (balances.get(key) || 0) / 1e9 };
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
      /*
       * SETTLEMENT, FIRED FROM THE SIM'S OWN EVENTS AND NOT AWAITED.
       *
       * A bank happens inside the simulation loop, which runs on a clock every
       * player is watching; awaiting an HTTP call in there would put the
       * arcade's latency into the game's tick. It is safe to fire because the
       * ref makes it exactly-once -- the same cursor settled twice is one move
       * -- and the startup sweep releases anything a crash left open.
       */
      case "bank": {
        broadcast(evt);
        if (!isWallet(evt.key)) break;
        ledger.settle(evt.epoch, evt.id, toLamports(evt.amt))
          .then(() => refreshBalance(evt.key))
          .catch((e) => console.error(`settle deferred e${evt.epoch}c${evt.id}: ${e.message}`));
        break;
      }
      case "refund": {
        broadcast(evt);
        if (!isWallet(evt.key)) break;
        // Idempotent, so the sweep finding this hold later costs nothing.
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
    try { if (++steps % 2 === 0 && watchers()) broadcastSnap(sim.snapshot()); }
    catch (e) { console.error("snapshot failed:", e); }
  }
}, 10);


/* ---------- per-connection protocol ---------- */
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

/**
 * Buy a cursor: every check the sim owns, then the money, then the spawn.
 *
 * The spawn is last on purpose -- a cursor on the field before its stake is
 * confirmed is a free entry into the pot. And if the round moves on while the
 * hold is in flight, the stake goes straight back rather than buying a place
 * in an epoch that has already started.
 */
async function deploy(c) {
  const why = sim.checkDeploy(c.key);
  // "deploys closed" and "max live" are the normal texture of a live round and
  // were never reported; that is unchanged.
  if (why) { if (why !== "deploys closed" && why !== "max live") send(c, { t: "err", msg: why }); return; }

  if (!isWallet(c.key)) {
    send(c, { t: "err", msg: "connect a wallet to deploy — a guest login holds no money" });
    return;
  }

  // The id is claimed before the money so the ref the stake is held under is
  // the ref the cursor will settle under. See reserveCursorId in sim.js.
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
    // The epoch closed under us. Give it back; the release is idempotent.
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
      /* each hello can mint a fresh identity (sim record + DB row + join
         broadcast); a loop of them is a memory/egress attack, not a login */
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
        /* every conversation this token is part of, including anything said
           to it while it was away — a DM to someone offline is now kept, not
           dropped on the floor */
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
    /* "max live" and "deploys closed" are states the client's own button
       already shows; balloon-ing them turns a fast double-tap into a stream of
       notifications about something the player can see for themselves. */
    /*
     * SIGN IN WITH THE ARCADE, WHICH IS THE ONLY WAY TO BE A WALLET HERE.
     *
     * The `hello` above still mints a local token, and that is deliberate:
     * CURSORS puts you at a login screen before you see anything, so a visitor
     * needs an identity to watch and chat with. What a local token cannot do
     * any more is hold money -- the arcade's books have no account for one, and
     * a deploy is refused with a message saying exactly that.
     *
     * This swaps the socket's key for the wallet the arcade says signed. It is
     * the only route by which a wallet identity enters this process: a client
     * claiming to be an address proves nothing, and believing one would let
     * anybody spend somebody else's balance.
     */
    case "arcade": {
      if (!c.hello) return;
      const token = String(m.token || "");
      if (!token) { send(c, { t: "err", msg: "no arcade session" }); return; }
      void (async () => {
        const wallet = await arcadeWallet(token);
        if (!wallet) { send(c, { t: "err", msg: "arcade session rejected" }); return; }
        const old = byKey.get(wallet);
        if (old && old !== c) { send(old, { t: "err", msg: "signed in elsewhere" }); old.ws.close(); }
        // The spectator identity this socket arrived with is dropped rather
        // than merged: it owns no money and no cursors it could carry over.
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
        send(c, { t: "welcome", token: wallet, name, balance: (balances.get(wallet) || 0) / 1e9,
                  epoch: sim.welcomeState(), chat: chatHistory(), dms: [], online: onlineNames(), wallet });
        broadcast({ t: "join", name, online: onlineNames() });
      })();
      return;
    }

    case "skin": {
      /* cosmetic identity: which XP pointer scheme this player's cursors wear.
         whitelisted ids only; affects future spawns, never economics. */
      if (c.key && SKIN_IDS.has(String(m.skin || ""))) {
        const p = sim.players.get(c.key);
        if (p) p.skin = String(m.skin || "");
      }
      break;
    }
    case "deploy": { void deploy(c); break; }
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
      /* one player to one player. Social only, by design — nothing said here
         can move A/(A+B), so there is no alliance to buy. Delivered to the
         recipient only; the sender's own window already shows what they typed. */
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
      /* Names are unique across live players AND the players table, so an
         offline recipient still resolves to exactly one token. The message
         is stored either way and handed over at their next sign-in. */
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
      /* the guestbook is cheaper than the gallery but still not free: one
         deploy proves you are a player and not a fresh tab */
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
      /* up to 16 base64 PNGs — the most expensive reply on the wire */
      if (now - (c.lastGalleryGet || 0) < 5000) return;
      c.lastGalleryGet = now;
      send(c, { t: "gallery", list: db.galleryList() });
      break;
    case "galleryPost": {
      /* A 60-second cooldown is not a spam gate, it is a rate limit — five
         tabs beat it and every tab gets a free 5 SOL. The wall has to cost
         something a sybil cannot mint, so it costs DEPLOYS: publishing spends
         one credit, and a credit is earned every GALLERY_DEPLOYS deploys.
         Playing the game is the captcha. */
      const gp = sim.players.get(c.key);
      const credits = Math.floor((gp ? gp.totIn : 0) / (STAKE * GALLERY_DEPLOYS)) - (gp ? gp.published || 0 : 0);
      if (credits < 1) {
        const done = ((gp ? gp.totIn : 0) / STAKE) % GALLERY_DEPLOYS;
        return send(c, { t: "err",
          msg: `the gallery is earned, not free — ${GALLERY_DEPLOYS - Math.floor(done)} more deploys for a frame` });
      }
      if (now - c.lastGallery < 20000) return send(c, { t: "err", msg: "one painting per 20s" });
      const png = String(m.png || "");
      if (!png.startsWith("data:image/png;base64,") || png.length > 400000)
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
      /* the resync is the biggest recurring reply on the wire: only a true
         hidden->visible transition earns one, at most every 2s per socket */
      if (on && !was && now - (c.lastResync || 0) > 2000) {
        c.lastResync = now;
        send(c, { t: "resync", epoch: sim.welcomeState() });
      }
      break;
    }
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
  if (wss.clients.size > 150) { try { ws.terminate(); } catch {} return; }
  const c = { ws, key: null, hello: false, lastChat: 0, lastGuest: 0, lastGallery: 0, alive: true, visible: true };
  /* a socket that never says hello is not in conns, so the reaper below
     never pings it — it would hold its zlib context forever */
  c.preT = setTimeout(() => { if (!c.hello) ws.terminate(); }, 15000);
  ws.on("pong", () => { c.alive = true; });
  ws.on("message", data => {
    let m; try { m = JSON.parse(data); } catch { return; }
    /* JSON.parse("null") is null, and null.t below the try would take the
       whole process down — from an unauthenticated socket */
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
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
/* the last line of defense: log and live. A thrown callback must not take
   forty sessions down with it. */
process.on("uncaughtException", e => console.error("uncaught:", e));
process.on("unhandledRejection", e => console.error("unhandled:", e));

/*
 * STRANDED STAKES GO BACK BEFORE ANYTHING NEW IS TAKEN.
 *
 * A crash mid-epoch leaves holds open in the arcade's books -- cursors that
 * were paid for and never banked or refunded. Holds outlive the process that
 * made them, which is the point of them: money in flight is the only money a
 * crash can lose, so it is the only money that is never merely in flight.
 *
 * Idempotent, so a restart loop cannot refund anything twice, and it runs
 * before the socket opens so no new stake races the cleanup.
 */
if (ledger.enabled) {
  try {
    const released = await ledger.sweep();
    if (released > 0) console.log(`released ${released} stranded stakes back to their wallets`);
  } catch (e) {
    // Not fatal: refusing to boot would take the arena down for a ledger
    // hiccup, and the holds stay open for the next restart to find. Loud,
    // because money in escrow with no cursor behind it is a thing to see.
    console.error(`COULD NOT SWEEP STRANDED STAKES: ${e.message}`);
  }
}

http.listen(PORT, () => console.log(`CURSORS.EXE beta server on :${PORT} — epoch ${sim.epochNo()}, ${CORPSES} corpses to a crash`));
