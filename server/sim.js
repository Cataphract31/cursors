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

/* economics — LOCKED, and the client mirrors these exactly */
export const STAKE = 100, ENTRY = 98, FEE = 2;
export const MAXCUR = 5, BOT_MAXCUR = 3;

/* The food chain. A cursor only fights inside 4x its own size — sharks stop
   bothering with plankton, and a fresh deploy cannot be eaten by the whale it
   happened to spawn beside. This says which fights HAPPEN, never how they
   resolve: every legal duel is still P(A wins) = A/(A+B), winner takes all,
   and the ladder still prices ×N at exactly 1/N. Measured against the old
   free-for-all it takes "new player eaten by something enormous" from 35% to
   9%, and whale-farming of fresh deploys from 83% to zero, while leaving the
   right tail alone — the biggest cursor of a long run is unchanged. */
export const FOOD_CHAIN = 4;

/* Four weight classes, one per 4x step, each wearing a real XP pointer scheme.
   You never pick this one: it is what you have grown into, and it changes under
   you mid-round the moment you cross a boundary. A player's own Mouse
   Properties choice still dresses their desktop pointer — it just no longer
   dresses their cursors in the arena, because out there the arrow has to mean
   your size and it cannot mean two things at once.

   A rank step IS the reach of the rule, deliberately: at 4x apiece, everything
   you can legally fight is your own rank or the one next door, and nothing two
   ranks away is ever touchable. Ranks every DOUBLING were tried first and gave
   more steps, but a step that does not line up with the rule is just a colour
   change — you could not read "can I fight that" off the arrow any more. The
   top rank is 64x, which a good run really does reach. */
export const TIER_SKINS = ["", "white", "bronze", "dinosaur"];
export const TIER_NAMES = ["Plankton", "3D-White", "3D-Bronze", "Dinosaur"];
export const TIER_AT = [1, 4, 16, 64];
export function tierOf(bounty) {
  const m = Math.max(1, bounty / ENTRY);
  return Math.min(TIER_SKINS.length - 1, Math.floor(Math.log2(m) / 2));   /* log4 */
}
export const skinOf = bounty => TIER_SKINS[tierOf(bounty)];

/* Exported so the rules suite can pin the boundary without reaching into a sim,
   and so the client mirror has one definition to copy rather than two. */
export const canFight = (aBounty, bBounty) =>
  Math.max(aBounty, bBounty) <= FOOD_CHAIN * Math.min(aBounty, bBounty);

/* left<->right, top<->bottom. Recall exits through the far wall, so the
   glide is a run across the field rather than a step off the edge you were
   already standing on. Exported so the client mirror has one definition. */
export const OPP_EDGE = [1, 0, 3, 2];

/* arena + feel constants, verbatim from the client */
/* The arena's BASE size. The field the epoch actually runs on is derived from
   this and the population — see sizeArena. 16:10 always, because the client
   fits the field to the viewport and a changing aspect would move the
   letterbox around under the player. */
const BASE_AW = 1280, BASE_AH = 800;
/* Density, not size, is what a round feels like: it sets how long a fresh
   cursor lives and how fast the disk fills. Measured, at 4x food chain and
   all-edge spawns: ~24k px2 per cursor is a meat grinder, ~35k breathes.
   Hold the number and the game plays the same at 10 cursors or 400. */
const PX2_PER_CUR = 32000, ARENA_MAX = 3;
/* RUSH_MS is a CEILING, not a duration: the rush ends the moment the field
   is empty, which with a 3s glide is 3-4 seconds. It used to run the full
   clock, so every epoch ended with everyone banked and eight seconds of
   nothing to watch, which is where people left. The ceiling only matters
   if a duel keeps resolving into new glides. */
const GRACE_MS = 1400, RECALL_SECS = 3, DUEL_MS = 700, RUSH_MS = 6000, CRASH_MS = 3000;

/* The disk, which is the round clock. A 20 GB drive is what an XP box actually
   shipped with, and at 12 MB a corpse it holds enough dead cursors to make a
   round last most of an hour instead of three minutes. Windows and the apps
   occupy whatever is left over after the corpse budget, so the free space you
   see really is the space the round has to fill. */
export const MB = 1024 * 1024, GB = 1024 * MB;
export const DISK_TOTAL = 20 * GB, CORPSE_BYTES = 12 * MB;

export const BOT_NAMES = ["mumu", "bobo", "clippy", "bonk", "solja", "xp_chad", "deg404"];
const BOT_REFILL = 50000;   /* play-money bots refill quietly when broke */

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const angDiff = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function createSim(opts) {
  /* per-sim, not per-module: two sims in one process (the test rig does this)
     must not share a field size */
  let AW = BASE_AW, AH = BASE_AH, ARENA_K = 1;
  const emit = opts.emit;                       /* (evt) => void — server forwards */
  const CORPSES = opts.corpses || 900;          /* deaths that fill the disk */
  /* The rush is a short dramatic window, not a fraction of the round. It used
     to start at CORPSES/10 remaining and then hit the 12s cap immediately,
     which crashed the epoch with most of the disk still free — the reason
     rounds stayed three minutes long after the disk was supposed to own them. */
  const RUSH_MARGIN = Math.min(6, Math.max(2, Math.round(CORPSES / 40)));
  const BASE_USED = DISK_TOTAL - CORPSES * CORPSE_BYTES;

  const players = new Map();                    /* key -> economic record */
  let curs = [], nextCurId = 1, deathN = 0;
  let phase = "battle", epochNo = 0, seedHex = null, commit = null;
  let rng = rngFromSeedHex(newSeedHex());       /* pre-first-epoch placeholder */
  let upT = 0, epochStart = 0, epochDeaths = 0;
  /* sim time, not wall time: it advances by exactly one fixed step per tick, so
     the timeline the client rebuilds from it is perfectly even */
  let simClock = 0;
  let rushAt = null, crashUntil = 0, deploysOpen = false;
  let R = null;
  let botQueue = [], botTimer = 0, liveSum = 0, liveN = 0, arenaN = 0;
  let houseFees = 0;

  /* Sim time, not wall time. Motion integrates on a fixed dt, so anything that
     gates on a clock has to use the same one or the round stops being a
     function of the seed: a 17ms event-loop hiccup used to change which cursor
     won a duel thousands of ticks later, which makes the commit/reveal
     ceremony a decoration. */
  const now = () => simClock;
  const rand = (a, b) => a + rng.next() * (b - a);
  const pick = a => a[Math.floor(rng.next() * a.length)];

  /* ---------- players & money ---------- */
  function registerPlayer(key, name, bot, persisted) {
    let p = players.get(key);
    if (p) { p.name = name; return p; }
    p = Object.assign({
      key, name, bot: !!bot, balance: bot ? BOT_REFILL : 5000, skin: "",
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
  /* Where a cursor lands matters. Every human used to deploy at the bottom
     centre inside a 120px band, so two players joining together spawned on top
     of each other and fought the moment grace lifted — the arena picking the
     fight instead of the players. Now the edge is sampled properly and, of
     eight candidates, the one furthest from anyone already out there wins. It
     costs nothing and it means a crowded arena spreads instead of piling. */
  function nearestCurDist2(x, y) {
    let bd = 1e9;
    for (const o of curs) { const d = (o.x - x) ** 2 + (o.y - y) ** 2; if (d < bd) bd = d; }
    return bd;
  }
  const edgePoint = side => ({
    x: side === 0 ? 22 : side === 1 ? AW - 22 : rand(50, AW - 50),
    y: side === 2 ? 22 : side === 3 ? AH - 22 : rand(50, AH - 50),
  });
  /* Which wall you come up from. Everyone used to deploy along the bottom, and
     since a fresh cursor rarely lives long enough to travel, 87% of the field
     and 96% of all deaths happened in the bottom quarter — a 1280x200 arena
     with a large decorative area above it. Now each player gets a taskbar edge
     for the epoch, the way a real XP taskbar docks to any side. It is drawn
     from the epoch's own seeded stream, not chosen, because a choice with no
     mechanical advantage still ends with everyone copying one wall. */
  function edgeOf(p) {
    if (p.edgeEpoch !== epochNo) { p.edge = Math.floor(rng.next() * 4); p.edgeEpoch = epochNo; }
    return p.edge;
  }
  function spawnPoint(p) {
    const fixed = p.bot ? -1 : edgeOf(p);                  /* bots use the whole rim */
    let best = null, bestD = -1;
    for (let i = 0; i < 8; i++) {
      const side = fixed < 0 ? Math.floor(rand(0, 4)) : fixed;
      const { x, y } = edgePoint(side);
      const d = nearestCurDist2(x, y);
      if (d > bestD) { bestD = d; best = { x, y, side }; }
      if (d > (200 * ARENA_K) ** 2) break;                  /* far enough, stop looking */
    }
    return best;
  }
  function spawnCur(p) {
    const { x, y, side } = spawnPoint(p);
    const c = {
      id: nextCurId++, key: p.key, owner: p.name, bot: p.bot, skin: skinOf(ENTRY),
      x, y, edge: side, h: rand(0, Math.PI * 2), spd: rand(78, 124),
      bounty: ENTRY, mode: "roam", prevMode: "roam", recallT: 0,
      graceUntil: now() + GRACE_MS, riskAt: 1.5 + rng.next() * 5,
      s: 1, r: 10, kills: 0, peak: ENTRY, born: now(), epoch: epochNo,
      duelUntil: 0, duelFoe: 0,
    };
    curs.push(c);
    return c;
  }
  function sizeOf(c) {
    /* +0.5 of a cursor for every doubling, out to 64x. The old .35/2.6 curve
       flattened at 32x and only ever made a whale 2.6 arrows wide, which was
       not enough to read across a crowded desktop — and size is now doing real
       work, because size is what decides who may fight you. */
    const m = Math.max(1, c.bounty / ENTRY);
    c.s = Math.min(4, 1 + .5 * Math.log2(m));
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
    p.epochIn += STAKE; p.totIn += STAKE;
    R.pot += ENTRY; R.deploys++; houseFees += FEE;
    const c = spawnCur(p);
    emit({ t: "spawn", id: c.id, owner: c.owner, skin: skinOf(c.bounty), x: Math.round(c.x), y: Math.round(c.y), bounty: c.bounty, grace: GRACE_MS / 1000 });
    money(p);
    return null;
  }
  /* undeploy: spawn grace means it cannot have fought, so there is nothing to
     game and the whole stake comes back */
  function refundCur(p, c) {
    p.balance += STAKE;
    p.epochIn -= STAKE; p.totIn -= STAKE;
    R.pot -= ENTRY; R.deploys--; houseFees -= FEE;
    removeCur(c);
    emit({ t: "refund", id: c.id, owner: c.owner });
  }
  function requestRecall(key) {
    /* one verb, two meanings, exactly like the client: cursors still inside
       spawn grace undeploy for a full refund (they cannot have fought yet,
       so there is nothing to game); roaming cursors start the 3s bank glide */
    const p = players.get(key); if (!p) return;
    let refunded = 0;
    for (const c of [...cursOf(key)]) {
      if (graced(c) && c.mode === "roam") { refundCur(p, c); refunded++; }
      else if (c.mode === "roam" || c.mode === "duel") forceRecall(c);
    }
    if (refunded) money(p);
  }
  function recallOne(key, id) {
    const p = players.get(key); if (!p) return;
    const c = curs.find(c => c.id === id && c.key === key);
    if (!c) return;
    /* This used to drop a graced cursor on the floor — no refund, no recall, no
       reply — while RECALL ALL refunded the very same cursor. The client then
       latched the slot for six seconds, by which time grace had lapsed and the
       retry banked 0.098 instead of refunding 0.100. One tap, one meaning. */
    if (graced(c) && c.mode === "roam") { refundCur(p, c); money(p); return; }
    if (c.mode === "roam" || c.mode === "duel") forceRecall(c);
  }
  function cancelRecall(key) {
    /* changed your mind inside the 3s glide. Recalling cursors stay
       attackable, so this dodges nothing; during shutdown the sweep owns
       every cursor and the answer is no. */
    if (phase !== "battle" || rushAt) return;
    for (const c of cursOf(key)) {
      if (c.mode === "recall") { c.mode = "roam"; c.prevMode = "roam"; c.recallT = 0; }
      /* armed mid-duel and not yet gliding — disarm it the same way */
      else if (c.mode === "duel" && c.prevMode === "recall") { c.prevMode = "roam"; c.recallT = 0; }
    }
  }
  function forceRecall(c) {
    /* Mid-duel the mode field is spoken for, and dropping the order here was a
       silent theft: the player tapped recall on a cursor that collided in the
       same instant, the request hit this line, and the cursor kept fighting
       while the client showed it banking. A duel is 700ms, which is exactly
       when a nervous player reaches for the button. So arm prevMode instead —
       resolveDuel restores into the glide rather than back into a roam. */
    if (c.mode === "duel") { c.prevMode = "recall"; c.recallT = RECALL_SECS; return; }
    if (c.mode !== "recall") { c.mode = "recall"; c.prevMode = "recall"; c.recallT = RECALL_SECS; }
  }
  /* A cursor the shutdown sweep takes that never had a fight paid to enter a
     round it did not get to play. bounty === ENTRY and no kills is exactly
     that: a win moves the bounty, a loss removes the cursor. Nobody can see
     the crash coming or opt out of it, so the house hands its cut back and
     the deploy costs nothing. The arena still returns exactly what it took
     (R.banked counts ENTRY either way, so pot conservation is untouched) —
     the extra 0.002 comes off the house, not out of the pot. */
  const unplayed = c => c.kills === 0 && c.bounty === ENTRY;
  function bank(c, atShutdown) {
    const p = players.get(c.key);
    const refund = !!atShutdown && unplayed(c);
    const paid = refund ? STAKE : c.bounty;
    if (!R.bigBank || c.bounty > R.bigBank.amt) R.bigBank = { owner: c.owner, amt: c.bounty };
    if (p) { p.balance += paid; p.epochOut += paid; p.totOut += paid; }
    R.banked += c.bounty;
    if (refund) houseFees -= FEE;
    emit({ t: "bank", id: c.id, owner: c.owner, amt: paid, mult: c.bounty / ENTRY, shut: !!atShutdown, refund });
    removeCur(c);
    if (p) { money(p); faucet(p); }
  }

  /* ---------- movement (verbatim port) ---------- */
  /* the whole rule, in one predicate — used for hunting and for contact, so a
     cursor never chases something it would pass straight through */
  const mayFight = (a, b) => canFight(a.bounty, b.bounty);
  function nearestEnemy(c) {
    let best = null, bd = 1e9;
    for (const o of curs) {
      if (o === c || o.key === c.key || graced(o) || o.mode === "duel") continue;
      if (!mayFight(c, o)) continue;
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
      /* Out through the FAR wall, not the one you came up from. The glide is
         time-boxed at RECALL_SECS either way, so crossing the field does not
         lengthen your exposure — it raises the speed, and that is the point:
         a recall that stepped off the nearest edge was often indistinguishable
         from a roam. Leaving now looks like leaving.

         Measured over 100 seeded epochs per arm, same seeds: a glide dies
         3.38% -> 5.41% of the time, but it also wins a fight on the way out
         14.5% -> 17.2% of the time, and the net return on the act of leaving
         is unchanged (100.25% vs 100.28%). It costs nothing in EV; it makes
         the exit legible and a little more dangerous.

         Per-player spawn edges still matter — they are what makes "opposite"
         differ between players instead of funnelling everyone to one wall. */
      const e = OPP_EDGE[c.edge === undefined ? 3 : c.edge];
      const ex = e === 0 ? 18 : e === 1 ? AW - 18 : clamp(c.x, 60, AW - 60);
      const ey = e === 2 ? 18 : e === 3 ? AH - 18 : clamp(c.y, 60, AH - 60);
      const dx = ex - c.x, dy = ey - c.y, dist = Math.hypot(dx, dy);
      if (c.recallT <= 0) { bank(c, rushAt !== null); return; }
      const sp = dist / Math.max(.2, c.recallT);
      c.x += dx / Math.max(1, dist) * sp * dt; c.y += dy / Math.max(1, dist) * sp * dt;
      return;
    }
    /* No stances. DEFEND existed so a small cursor could refuse a hopeless
       fight with a whale; the food chain now refuses it on their behalf, and
       everything still reachable is inside 4x — which is a fight worth having.
       One verb remains, RECALL, and it is the honest one: leaving costs you the
       round rather than just tempo. */
    /* aggression ramps with the disk: calm on a fresh drive, frenzy near full */
    const fill = clamp(epochDeaths / CORPSES, 0, 1);
    const aggr = phase === "battle" ? (.7 + 1.5 * fill) : 1;
    let tx = null, ty = null, turn = 2.6 * aggr;
    const { best, bd } = nearestEnemy(c);
    if (best) {
      /* Turn radius is speed/turn-rate: at 2.6 rad/s and ~100 px/s that is a
         38px circle, and contact needs 20px — so an attacker could literally
         orbit its target forever without touching it. Close in, turn hard. */
      if (bd < 130 * 130) turn *= 2.8;
      if (bd < (520 * ARENA_K) ** 2) { tx = best.x; ty = best.y; }
    }
    /* Your own cursors regroup, but they must never stack. They cannot fight
       each other, so a pile of them reads as a bug — two arrows sitting in the
       same pixel with the tags overprinting, apparently refusing to duel. So
       the squad has a personal space: pull together beyond 90px, shove apart
       inside SEP, and the flock holds a loose formation instead of a point. */
    const SEP = 34;
    let rx = 0, ry = 0;
    for (const o of curs) {
      if (o === c || o.key !== c.key) continue;
      const dx = c.x - o.x, dy = c.y - o.y, d2 = dx * dx + dy * dy;
      if (d2 > SEP * SEP) continue;
      /* exactly coincident gives a zero vector and they stay welded together,
         so break the tie by id — deterministic, and always opposite */
      if (d2 < 1) { const a = (c.id % 8) / 8 * Math.PI * 2; rx += Math.cos(a) * SEP; ry += Math.sin(a) * SEP; continue; }
      const d = Math.sqrt(d2);
      rx += dx / d * (SEP - d); ry += dy / d * (SEP - d);
    }
    if (rx || ry) { tx = c.x + rx * 3; ty = c.y + ry * 3; turn = Math.max(turn, 5.5); }
    else {
      const cen = centroid(c);
      if (cen && ((cen.x - c.x) ** 2 + (cen.y - c.y) ** 2) > 90 * 90) {
        tx = tx === null ? cen.x : (tx * .65 + cen.x * .35);
        ty = ty === null ? cen.y : (ty * .65 + cen.y * .35);
      }
    }
    if (tx !== null) {
      const want = Math.atan2(ty - c.y, tx - c.x);
      c.h += clamp(angDiff(want - c.h), -1, 1) * turn * dt;
    }
    c.h += (rng.next() - .5) * 3.0 * dt;
    /* Edges. Four independent axis-aligned pulls CANCEL in a corner: heading
       up-left, "turn right" says +1 and "turn down" says -1 and the cursor sits
       there, pinned by the clamp, not moving and not fighting, forever. One
       vector away from whichever walls are near cannot cancel — in a corner it
       points diagonally out. */
    const M = 64, WT = 7;
    let wx = 0, wy = 0;
    if (c.x < M) wx += (M - c.x) / M;
    if (c.x > AW - M) wx -= (c.x - (AW - M)) / M;
    if (c.y < M) wy += (M - c.y) / M;
    if (c.y > AH - M) wy -= (c.y - (AH - M)) / M;
    if (wx || wy) c.h += clamp(angDiff(Math.atan2(wy, wx) - c.h), -1, 1) * WT * dt * Math.min(1, Math.hypot(wx, wy));
    const weight = 1 + .25 * (c.s - 1);
    /* The old +12% chase / -10% flee pair existed only so an attacker could
       close on a fleeing defender. With nobody fleeing it was a bonus everyone
       held at once, which is the same as no bonus at all. */
    const sp = c.spd / weight;
    /* and a hard guarantee on top of the soft one: if the clamp actually bit,
       the cursor is against a wall, so mirror the heading off it. A bounce
       cannot get stuck the way a slow turn can. */
    const ux = c.x + Math.cos(c.h) * sp * dt, uy = c.y + Math.sin(c.h) * sp * dt;
    /* keep the BODY inside the field, not just the centre: the size curve took
       r from 26 to 40 and a whale was drawn half-outside the wall */
    const pad = Math.max(24, c.r);
    c.x = clamp(ux, pad, AW - pad); c.y = clamp(uy, pad, AH - pad);
    if (c.x !== ux) c.h = Math.PI - c.h;
    if (c.y !== uy) c.h = -c.h;
  }

  /* ---------- duels ---------- */
  function startDuel(a, b) {
    a.prevMode = a.mode; b.prevMode = b.mode;
    a.mode = b.mode = "duel";
    a.duelUntil = b.duelUntil = now() + DUEL_MS;
    a.duelFoe = b.id; b.duelFoe = a.id;
    const pA = a.bounty / (a.bounty + b.bounty);
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
    /* every cursor, duellists included — forceRecall has a branch for exactly
       that case (it arms prevMode so resolveDuel restores into the glide).
       Filtering them out here meant a cursor that happened to be mid-duel when
       the rush fired came back to "roam" and hunted a field of defenceless
       gliding cursors for the rest of the shutdown: 90% of all rush-window
       kills were made by cursors this sweep forgot. */
    for (const c of curs) forceRecall(c);
    emit({ t: "rush", secs: RUSH_MS / 1000 });
  }
  function crash() {
    for (const c of [...curs]) bank(c, true);
    /* pot conservation — the invariant THIN ICE's wipe leak taught us to check:
       everything that entered the arena this epoch must have left it as banks */
    if (R.pot !== R.banked)
      console.error(`INVARIANT VIOLATION epoch ${epochNo}: pot in ${R.pot} != banked ${R.banked}`);
    const receipt = {
      no: epochNo, up: Math.round(upT - epochStart), pot: R.pot, deploys: R.deploys,
      deaths: R.deaths, top: R.bigBank, seed: seedHex, commit, fees: houseFees,
    };
    phase = "crash"; crashUntil = now() + CRASH_MS; rushAt = null; deploysOpen = false;
    emit({ t: "crash", ...receipt });
    for (const p of players.values()) { p.epochIn = 0; p.epochOut = 0; }
  }
  /* Sized once, at epoch start, from the population the last epoch carried —
     never mid-epoch, because a field that resizes under a live cursor moves it
     relative to everyone else. Announced with the seed commit, so every client
     in the round is on the identical field and the fixed-arena fairness rule
     still holds: it fixes the field for the ROUND, not for all time. */
  function sizeArena(n) {
    const want = Math.max(1, n) * PX2_PER_CUR;
    const k = clamp(Math.sqrt(want / (BASE_AW * BASE_AH)), 1, ARENA_MAX);
    AW = Math.round(BASE_AW * k); AH = Math.round(BASE_AH * k);
    /* Sensing has to scale with the field or the point is lost: on a 3x field
       with an absolute 520px acquisition radius, cursors wander blind and a
       round takes 2.4x longer instead of playing the same. */
    ARENA_K = k;
  }
  function startEpoch() {
    epochNo++;
    /* an average over the epoch, then smoothed across epochs — peak made one
       busy tick decide the next round's whole field */
    const avg = liveN ? liveSum / liveN : 0;
    arenaN = arenaN ? arenaN * .5 + avg * .5 : avg;
    liveSum = 0; liveN = 0;
    sizeArena(arenaN);
    /* opts.seed pins every epoch to one seed. Replay verification needs this
       (see the engine track), and it is how the suite proves a round is a
       function of the seed rather than of event-loop jitter. */
    seedHex = opts.seed || newSeedHex(); commit = commitOf(seedHex);
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
    emit({ t: "epoch", no: epochNo, commit, corpses: CORPSES, aw: AW, ah: AH });
  }

  /* ---------- the loop ---------- */
  function tick(dt) {
    upT += dt; simClock += dt * 1000;
    liveSum += curs.length; liveN++;
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
      if (!mayFight(a, b)) continue;
      const rr = a.r + b.r;
      if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < rr * rr) startDuel(a, b);
    }
    /* bot risk appetite: each bot cursor has a multiple it came to get */
    for (const c of curs) {
      if (!c.bot || c.mode !== "roam") continue;
      if (c.bounty / ENTRY >= c.riskAt && rng.next() < dt * .5) forceRecall(c);
    }
    /* The sweep is done when the field is empty — every cursor is banked and
       there is nothing left to look at. The clock is only the backstop. */
    if (rushAt && (!curs.length || now() - rushAt >= RUSH_MS)) crash();
  }

  /* ---------- views ---------- */
  const diskUsed = () => BASE_USED + epochDeaths * CORPSE_BYTES;
  function snapshot() {
    return {
      t: "snap", ts: Math.round(simClock),   /* sim clock: exactly even, unlike wall time */
      aw: AW, ah: AH,
      p: curs.map(c => [c.id, Math.round(c.x), Math.round(c.y), c.bounty,
        c.mode === "recall" ? "c" : c.mode === "duel" ? "d" : "r"]),
      up: Math.round(upT), pot: R ? R.pot : 0,
      fill: +(epochDeaths / CORPSES).toFixed(4),
    };
  }
  function welcomeState() {
    return {
      no: epochNo, commit, phase, up: Math.round(upT), eup: Math.round(upT - epochStart),
      aw: AW, ah: AH,
      pot: R ? R.pot : 0,
      deploys: R ? R.deploys : 0, deaths: R ? R.deaths : 0,
      fill: +(epochDeaths / CORPSES).toFixed(4), corpses: CORPSES,
      rush: rushAt ? Math.max(0, RUSH_MS - (now() - rushAt)) / 1000 : null,
      disk: { used: diskUsed(), total: DISK_TOTAL, corpse: CORPSE_BYTES, deaths: epochDeaths },
      curs: curs.map(c => ({
        id: c.id, owner: c.owner, skin: skinOf(c.bounty), x: Math.round(c.x), y: Math.round(c.y),
        bounty: c.bounty, grace: Math.max(0, c.graceUntil - now()) / 1000,
        mode: c.mode === "recall" ? "c" : c.mode === "duel" ? "d" : "r",
      })),
    };
  }

  /* boot the bots as economic participants, then open the arena */
  for (const name of BOT_NAMES) registerPlayer("bot:" + name, name, true);
  /* the bots picked pointer schemes, because they are players and players do */
  for (const [bn, sk] of [["mumu", "bronze"], ["deg404", "inv"], ["xp_chad", "black"], ["clippy", "std-l"], ["bonk", "variations"]]) {
    const bp = players.get("bot:" + bn); if (bp) bp.skin = sk;
  }
  startEpoch();

  return {
    tick, snapshot, welcomeState,
    registerPlayer, requestDeploy, requestRecall, recallOne, cancelRecall,
    players, cursCount: () => curs.length,
    diskUsed, DISK_TOTAL, CORPSES, fees: () => houseFees,
    arena: () => ({ aw: AW, ah: AH }),
    epochNo: () => epochNo, phase: () => phase,
  };
}
