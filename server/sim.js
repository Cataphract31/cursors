/* The arena, server-side — a faithful port of the client sim in main.js, now
   the single authority. Same fixed 1280×800 logical field, same movement
   rules, same duel math: P(A wins) = A/(A+B), winner takes all, every
   collision EV-neutral. All money lives here in integer milli-SOL (1000 =
   1.000 SOL) so the fairness invariants are checkable in one file.

   Epochs no longer end on a timer. Every death writes a 12 MB corpse to the
   fake C: drive; when the disk fills, CURSORS.EXE crashes, everyone is banked
   in full (the crash can never cost money), the corpses are archived, and the
   system restarts. The disk is the round clock, and it is visible to everyone.

   All sim randomness — duels, spawns, wander noise — draws from one sfc32
   stream seeded per epoch; sha256(seed) is published at epoch start and the
   seed is revealed at the crash. Full replay verification still needs input
   logs (see HANDOFF engine track); the label in the client says exactly that. */

import { rngFromSeedHex, newSeedHex, commitOf } from "./rng.js";

/* economics — LOCKED, matches the client and THIN ICE's audited config */
export const STAKE = 100, ENTRY = 97, FEE_PLAT = 1, FEE_RAKE = 2;
export const MAXCUR = 5, BOT_MAXCUR = 3;
const TICKETS_PER_DEPLOY = 200;
const HALF_LIFE_MS = 45 * 24 * 3600 * 1000;   /* rakeback tickets, 45-day half-life */

/* arena + feel constants, verbatim from the client */
const AW = 1280, AH = 800;
const GRACE_MS = 1400, RECALL_SECS = 3, DUEL_MS = 700, RUSH_MS = 12000, CRASH_MS = 5000;

/* the disk. 4 GB drive, the OS eats its share, every corpse is 12 MB. */
export const MB = 1024 * 1024, GB = 1024 * MB;
export const DISK_TOTAL = 4 * GB, CORPSE_BYTES = 12 * MB;

export const BOT_NAMES = ["mumu", "bobo", "clippy", "bonk", "solja", "xp_chad", "deg404"];
const BOT_REFILL = 50000;   /* play-money bots refill quietly when broke */

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const angDiff = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function createSim(opts) {
  const emit = opts.emit;                       /* (evt) => void — server forwards */
  const CORPSES = opts.corpses || 64;           /* deaths that fill the disk */
  const RUSH_MARGIN = Math.max(2, Math.round(CORPSES / 10));
  const BASE_USED = DISK_TOTAL - CORPSES * CORPSE_BYTES;

  const players = new Map();                    /* key -> economic record */
  let curs = [], nextCurId = 1, deathN = 0;
  let phase = "battle", epochNo = 0, seedHex = null, commit = null;
  let rng = rngFromSeedHex(newSeedHex());       /* pre-first-epoch placeholder */
  let upT = 0, epochStart = 0, epochDeaths = 0;
  let rushAt = null, crashUntil = 0, deploysOpen = false;
  let R = null;
  let botQueue = [], botTimer = 0;
  let platformFees = 0;

  const now = () => Date.now();
  const rand = (a, b) => a + rng.next() * (b - a);
  const pick = a => a[Math.floor(rng.next() * a.length)];

  /* ---------- players & money ---------- */
  function decayTickets(p) {
    const t = now();
    if (p.tickets > 0 && p.ticketsAt) {
      p.tickets *= Math.pow(2, -(t - p.ticketsAt) / HALF_LIFE_MS);
      if (p.tickets < 0.01) p.tickets = 0;
    }
    p.ticketsAt = t;
  }
  function registerPlayer(key, name, bot, persisted) {
    let p = players.get(key);
    if (p) { p.name = name; return p; }
    p = Object.assign({
      key, name, bot: !!bot, balance: bot ? BOT_REFILL : 5000,
      tickets: 0, ticketsAt: now(), rake: 0, stance: "attack",
      epochIn: 0, epochOut: 0, totIn: 0, totOut: 0,
    }, persisted || {});
    p.key = key; p.name = name; p.bot = !!bot;
    players.set(key, p);
    return p;
  }
  function money(p) { emit({ t: "money", key: p.key }); }
  /* the beta faucet: play money testers should never be locked out */
  function faucet(p) {
    if (p.bot) { if (p.balance < STAKE) p.balance = BOT_REFILL; return; }
    if (p.balance < STAKE && !curs.some(c => c.key === p.key)) {
      p.balance = 5000;
      emit({ t: "sys", text: `beta faucet: ${p.name} refilled to 5.000` });
      money(p);
    }
  }

  /* ---------- cursors ---------- */
  function spawnCur(p) {
    let x, y;
    if (!p.bot) { x = clamp(AW / 2 + rand(-60, 60), 20, AW - 20); y = AH - 8; }
    else {
      const side = Math.floor(rand(0, 4));
      x = side === 0 ? 6 : side === 1 ? AW - 6 : rand(40, AW - 40);
      y = side === 2 ? 6 : side === 3 ? AH - 6 : rand(40, AH - 40);
    }
    const c = {
      id: nextCurId++, key: p.key, owner: p.name, bot: p.bot,
      x, y, h: rand(0, Math.PI * 2), spd: rand(78, 124),
      bounty: ENTRY, mode: "roam", prevMode: "roam", recallT: 0,
      graceUntil: now() + GRACE_MS, riskAt: 1.5 + rng.next() * 5,
      s: 1, r: 10, kills: 0, peak: ENTRY, born: now(), epoch: epochNo,
      duelUntil: 0, duelPA: 0, duelFoe: 0,
    };
    curs.push(c);
    return c;
  }
  function sizeOf(c) {
    const m = Math.max(1, c.bounty / ENTRY);
    c.s = Math.min(2.6, 1 + .35 * Math.log2(m));
    c.r = 10 * c.s;
    if (c.bounty > c.peak) c.peak = c.bounty;
  }
  function graced(c) { return now() < c.graceUntil; }
  function removeCur(c) { curs = curs.filter(x => x !== c); }
  const cursOf = key => curs.filter(c => c.key === key);

  /* ---------- deploy / recall / bank ---------- */
  function canDeploy() { return phase === "battle" && deploysOpen && !rushAt; }
  function requestDeploy(key) {
    const p = players.get(key); if (!p) return "no such player";
    if (!canDeploy()) return "deploys closed";
    if (cursOf(key).length >= (p.bot ? BOT_MAXCUR : MAXCUR)) return "max live";
    if (p.balance < STAKE) { faucet(p); if (p.balance < STAKE) return "insufficient"; }
    p.balance -= STAKE;
    decayTickets(p); p.tickets += TICKETS_PER_DEPLOY;
    p.epochIn += STAKE; p.totIn += STAKE;
    R.pot += ENTRY; R.deploys++; platformFees += FEE_PLAT;
    const c = spawnCur(p);
    emit({ t: "spawn", id: c.id, owner: c.owner, x: Math.round(c.x), y: Math.round(c.y), bounty: c.bounty, grace: GRACE_MS / 1000 });
    money(p);
    return null;
  }
  function requestRecall(key) {
    /* one verb, two meanings, exactly like the client: cursors still inside
       spawn grace undeploy for a full refund (they cannot have fought yet,
       so there is nothing to game); roaming cursors start the 3s bank glide */
    const p = players.get(key); if (!p) return;
    let refunded = 0;
    for (const c of [...cursOf(key)]) {
      if (graced(c) && c.mode === "roam") {
        p.balance += STAKE;
        decayTickets(p); p.tickets = Math.max(0, p.tickets - TICKETS_PER_DEPLOY);
        p.epochIn -= STAKE; p.totIn -= STAKE;
        R.pot -= ENTRY; R.deploys--; platformFees -= FEE_PLAT;
        removeCur(c);
        emit({ t: "refund", id: c.id, owner: c.owner });
        refunded++;
      } else if (c.mode === "roam") forceRecall(c);
    }
    if (refunded) money(p);
  }
  function recallOne(key, id) {
    const c = curs.find(c => c.id === id && c.key === key);
    if (c && c.mode === "roam" && !graced(c)) forceRecall(c);
  }
  function forceRecall(c) {
    if (c.mode !== "recall") { c.mode = "recall"; c.prevMode = "recall"; c.recallT = RECALL_SECS; }
  }
  function bank(c, atShutdown) {
    const p = players.get(c.key);
    if (!R.bigBank || c.bounty > R.bigBank.amt) R.bigBank = { owner: c.owner, amt: c.bounty };
    if (p) { p.balance += c.bounty; p.epochOut += c.bounty; p.totOut += c.bounty; }
    R.banked += c.bounty;
    emit({ t: "bank", id: c.id, owner: c.owner, amt: c.bounty, mult: c.bounty / ENTRY, shut: !!atShutdown });
    removeCur(c);
    if (p) { money(p); faucet(p); }
  }

  /* ---------- movement (verbatim port) ---------- */
  function nearestEnemy(c) {
    let best = null, bd = 1e9;
    for (const o of curs) {
      if (o === c || o.key === c.key || graced(o) || o.mode === "duel") continue;
      const d = (o.x - c.x) ** 2 + (o.y - c.y) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    return { best, bd };
  }
  function centroid(c) {
    let x = 0, y = 0, n = 0;
    for (const o of curs) if (o.key === c.key && o !== c) { x += o.x; y += o.y; n++; }
    return n ? { x: x / n, y: y / n } : null;
  }
  function move(c, dt) {
    if (c.mode === "recall") {
      c.recallT -= dt;
      const dx = 40 - c.x, dy = (AH - 8) - c.y, dist = Math.hypot(dx, dy);
      if (c.recallT <= 0) { bank(c, rushAt !== null); return; }
      const sp = dist / Math.max(.2, c.recallT);
      c.x += dx / Math.max(1, dist) * sp * dt; c.y += dy / Math.max(1, dist) * sp * dt;
      return;
    }
    const p = players.get(c.key);
    const st = c.bot
      ? (c.bounty / ENTRY >= c.riskAt * .7 ? "defend" : "attack")
      : ((p && p.stance) || "attack");
    /* aggression ramps with the disk: calm on a fresh drive, frenzy near full */
    const fill = clamp(epochDeaths / CORPSES, 0, 1);
    const aggr = phase === "battle" ? (.7 + 1.5 * fill) : 1;
    let tx = null, ty = null, turn = 2.6 * aggr;
    const { best, bd } = nearestEnemy(c);
    if (best) {
      if (st === "attack" && bd < 520 * 520) { tx = best.x; ty = best.y; }
      else if (st === "defend" && bd < 300 * 300) { tx = c.x + (c.x - best.x); ty = c.y + (c.y - best.y); }
    }
    const cen = centroid(c);
    if (cen && ((cen.x - c.x) ** 2 + (cen.y - c.y) ** 2) > 75 * 75) {
      tx = tx === null ? cen.x : (tx * .65 + cen.x * .35);
      ty = ty === null ? cen.y : (ty * .65 + cen.y * .35);
    }
    if (tx !== null) {
      const want = Math.atan2(ty - c.y, tx - c.x);
      c.h += clamp(angDiff(want - c.h), -1, 1) * turn * dt;
    }
    c.h += (rng.next() - .5) * 3.0 * dt;
    const M = 30;
    if (c.x < M) c.h += clamp(angDiff(0 - c.h), -1, 1) * 4.5 * dt;
    if (c.x > AW - M) c.h += clamp(angDiff(Math.PI - c.h), -1, 1) * 4.5 * dt;
    if (c.y < M) c.h += clamp(angDiff(Math.PI / 2 - c.h), -1, 1) * 4.5 * dt;
    if (c.y > AH - M) c.h += clamp(angDiff(-Math.PI / 2 - c.h), -1, 1) * 4.5 * dt;
    const weight = 1 + .25 * (c.s - 1);
    const sp = c.spd / weight;
    c.x = clamp(c.x + Math.cos(c.h) * sp * dt, 6, AW - 6);
    c.y = clamp(c.y + Math.sin(c.h) * sp * dt, 6, AH - 6);
  }

  /* ---------- duels ---------- */
  function startDuel(a, b) {
    a.prevMode = a.mode; b.prevMode = b.mode;
    a.mode = b.mode = "duel";
    a.duelUntil = b.duelUntil = now() + DUEL_MS;
    a.duelFoe = b.id; b.duelFoe = a.id;
    const pA = a.bounty / (a.bounty + b.bounty);
    a.duelPA = pA; b.duelPA = 1 - pA;
    emit({ t: "duel", a: a.id, b: b.id, pA: Math.round(100 * pA) });
  }
  function certify(l, w, pLose) {
    return {
      id: ++deathN, name: l.owner, killer: w.owner,
      lost: l.bounty, mult: l.bounty / ENTRY, peak: l.peak,
      odds: Math.round(100 * pLose), kills: l.kills,
      lived: Math.max(1, Math.round((now() - l.born) / 1000)),
      round: l.epoch,
    };
  }
  function resolveDuel(a) {
    const b = curs.find(c => c.id === a.duelFoe);
    if (!b) { a.mode = a.prevMode; return; }
    a.mode = a.prevMode; b.mode = b.prevMode;
    if (phase !== "battle") return;
    const pA = a.bounty / (a.bounty + b.bounty);
    const w = rng.next() < pA ? a : b, l = w === a ? b : a;
    const pot = l.bounty;
    w.bounty += pot; w.kills++; sizeOf(w);
    if (w.mode === "recall" && w.recallT <= 0) w.recallT = .3;
    const cert = certify(l, w, w === a ? 1 - pA : pA);
    removeCur(l);
    epochDeaths++; R.deaths++;
    emit({ t: "kill", w: w.id, l: l.id, wOwner: w.owner, lOwner: l.owner, pot, cert, fill: epochDeaths / CORPSES });
    const lp = players.get(l.key);
    if (lp) faucet(lp);
    /* the disk just grew a corpse; a full drive is a crash */
    if (epochDeaths >= CORPSES && phase === "battle") crash();
    else if (!rushAt && epochDeaths >= CORPSES - RUSH_MARGIN) startRush();
  }

  /* ---------- epoch lifecycle ---------- */
  function startRush() {
    rushAt = now();
    for (const c of curs) if (c.mode !== "duel") forceRecall(c);
    emit({ t: "rush", secs: RUSH_MS / 1000 });
  }
  function crash() {
    for (const c of [...curs]) bank(c, true);
    /* pot conservation — the invariant THIN ICE's wipe leak taught us to check:
       everything that entered the arena this epoch must have left it as banks */
    if (R.pot !== R.banked)
      console.error(`INVARIANT VIOLATION epoch ${epochNo}: pot in ${R.pot} != banked ${R.banked}`);
    /* rakeback: this epoch's pool splits by ticket share, decayed to now */
    const pool = R.deploys * FEE_RAKE;
    let totalT = 0;
    for (const p of players.values()) { decayTickets(p); totalT += p.tickets; }
    if (pool > 0 && totalT > 0)
      for (const p of players.values())
        if (p.tickets > 0) { p.rake += pool * (p.tickets / totalT); money(p); }
    const receipt = {
      no: epochNo, up: Math.round(upT - epochStart), pot: R.pot, deploys: R.deploys,
      deaths: R.deaths, top: R.bigBank, seed: seedHex, commit,
    };
    phase = "crash"; crashUntil = now() + CRASH_MS; rushAt = null; deploysOpen = false;
    emit({ t: "crash", ...receipt });
    for (const p of players.values()) { p.epochIn = 0; p.epochOut = 0; }
  }
  function startEpoch() {
    epochNo++;
    seedHex = newSeedHex(); commit = commitOf(seedHex);
    rng = rngFromSeedHex(seedHex);
    R = { pot: 0, deploys: 0, deaths: 0, banked: 0, bigBank: null };
    epochDeaths = 0; epochStart = upT; rushAt = null;
    phase = "battle"; deploysOpen = true;
    /* the bots pile back in over the first ten seconds, like nothing happened */
    botQueue = [];
    for (const name of BOT_NAMES) {
      const n = pick([1, 1, 2, 2, 3]);
      for (let i = 0; i < n; i++) botQueue.push({ key: "bot:" + name, at: now() + rand(600, 9500) });
    }
    botQueue.sort((a, b) => a.at - b.at);
    emit({ t: "epoch", no: epochNo, commit, corpses: CORPSES });
  }

  /* ---------- the loop ---------- */
  function tick(dt) {
    upT += dt;
    if (phase === "crash") {
      if (now() >= crashUntil) startEpoch();
      return;
    }
    /* bots: queued re-entries, then population maintenance every 1.8s */
    while (botQueue.length && botQueue[0].at <= now()) requestDeploy(botQueue.shift().key);
    botTimer += dt;
    if (botTimer >= 1.8) {
      /* population maintenance: hold a live bot floor so there is always
         someone to fight; the target wobbles per epoch so the field breathes */
      botTimer = 0;
      if (canDeploy()) {
        const botCurs = curs.filter(c => c.bot).length;
        const target = 7 + (epochNo * 3) % 5;
        if (botCurs < target || rng.next() < .15) requestDeploy("bot:" + BOT_NAMES[Math.floor(rng.next() * BOT_NAMES.length)]);
      }
    }
    /* move everyone not frozen mid-duel */
    for (const c of [...curs]) if (c.mode !== "duel") move(c, dt);
    /* duels resolve after their 700ms hourglass */
    for (const c of [...curs]) if (c.mode === "duel" && c.id < c.duelFoe && now() >= c.duelUntil) resolveDuel(c);
    if (phase !== "battle") return;   /* a resolve may have crashed the system */
    /* collisions, canonical order */
    for (let i = 0; i < curs.length; i++) for (let j = i + 1; j < curs.length; j++) {
      const a = curs[i], b = curs[j];
      if (a.key === b.key || graced(a) || graced(b)) continue;
      if (a.mode === "duel" || b.mode === "duel") continue;
      const rr = a.r + b.r;
      if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < rr * rr) startDuel(a, b);
    }
    /* bot risk appetite: each bot cursor has a multiple it came to get */
    for (const c of curs) {
      if (!c.bot || c.mode !== "roam") continue;
      if (c.bounty / ENTRY >= c.riskAt && rng.next() < dt * .5) forceRecall(c);
    }
    /* the rush can also end by clock: a disk mid-write jams, the crash comes anyway */
    if (rushAt && now() - rushAt >= RUSH_MS) crash();
  }

  /* ---------- views ---------- */
  const diskUsed = () => BASE_USED + epochDeaths * CORPSE_BYTES;
  function snapshot() {
    return {
      t: "snap",
      p: curs.map(c => [c.id, Math.round(c.x), Math.round(c.y), c.bounty,
        c.mode === "recall" ? "c" : c.mode === "duel" ? "d" : "r"]),
      up: Math.round(upT), pot: R ? R.pot : 0,
      fill: +(epochDeaths / CORPSES).toFixed(4),
    };
  }
  function welcomeState() {
    return {
      no: epochNo, commit, phase, up: Math.round(upT), pot: R ? R.pot : 0,
      deploys: R ? R.deploys : 0, deaths: R ? R.deaths : 0,
      fill: +(epochDeaths / CORPSES).toFixed(4), corpses: CORPSES,
      rush: rushAt ? Math.max(0, RUSH_MS - (now() - rushAt)) / 1000 : null,
      disk: { used: diskUsed(), total: DISK_TOTAL, corpse: CORPSE_BYTES, deaths: epochDeaths },
      curs: curs.map(c => ({
        id: c.id, owner: c.owner, x: Math.round(c.x), y: Math.round(c.y),
        bounty: c.bounty, grace: Math.max(0, c.graceUntil - now()) / 1000,
        mode: c.mode === "recall" ? "c" : c.mode === "duel" ? "d" : "r",
      })),
    };
  }

  /* boot the bots as economic participants, then open the arena */
  for (const name of BOT_NAMES) registerPlayer("bot:" + name, name, true);
  startEpoch();

  return {
    tick, snapshot, welcomeState,
    registerPlayer, requestDeploy, requestRecall, recallOne,
    setStance: (key, s) => { const p = players.get(key); if (p && (s === "attack" || s === "defend")) p.stance = s; },
    players, cursCount: () => curs.length,
    diskUsed, DISK_TOTAL, CORPSES,
    epochNo: () => epochNo, phase: () => phase,
    claimRake: key => {
      const p = players.get(key); if (!p || p.rake <= 0) return 0;
      const amt = p.rake; p.rake = 0; p.balance += amt; money(p);
      return amt;
    },
  };
}
