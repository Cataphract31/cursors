import { rngFromSeedHex, newSeedHex, commitOf } from "./rng.js";

export const STAKE = 100, ENTRY = 98, FEE = 2;
export const MAXCUR = 5;

export const FOOD_CHAIN = 4;

export const TIER_SKINS = ["", "white", "bronze", "dinosaur"];
export const TIER_NAMES = ["Plankton", "3D-White", "3D-Bronze", "Dinosaur"];
export const TIER_AT = [1, 4, 16, 64];
export function tierOf(bounty) {
  const m = Math.max(1, bounty / ENTRY);
  return Math.min(TIER_SKINS.length - 1, Math.floor(Math.log2(m) / 2));
}
export const skinOf = bounty => TIER_SKINS[tierOf(bounty)];

export const canFight = (aBounty, bBounty) =>
  Math.max(aBounty, bBounty) <= FOOD_CHAIN * Math.min(aBounty, bBounty);

export const OPP_EDGE = [1, 0, 3, 2];

const BASE_AW = 1280, BASE_AH = 800;
const PX2_PER_CUR = 32000, ARENA_MAX = 3;
const GRACE_MS = 1400, RECALL_SECS = 3, DUEL_MS = 700, RUSH_MS = 6000, CRASH_MS = 3000;

export const MB = 1024 * 1024, GB = 1024 * MB;
export const DISK_TOTAL = 20 * GB, CORPSE_BYTES = 12 * MB;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const angDiff = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function createSim(opts) {
  let AW = BASE_AW, AH = BASE_AH, ARENA_K = 1;
  const emit = opts.emit;
  const CORPSES = opts.corpses || 900;
  const RUSH_MARGIN = Math.min(6, Math.max(2, Math.round(CORPSES / 40)));
  const BASE_USED = DISK_TOTAL - CORPSES * CORPSE_BYTES;

  const players = new Map();
  let curs = [], nextCurId = 1, deathN = 0;
  let phase = "battle", epochNo = 0, seedHex = null, commit = null;
  let rng = rngFromSeedHex(newSeedHex());
  let upT = 0, epochStart = 0, epochDeaths = 0;
  let simClock = 0;
  let rushAt = null, crashUntil = 0, deploysOpen = false;
  let R = null;
  let liveSum = 0, liveN = 0, arenaN = 0;
  let houseFees = 0;

  const now = () => simClock;
  const rand = (a, b) => a + rng.next() * (b - a);
  const pick = a => a[Math.floor(rng.next() * a.length)];

  function registerPlayer(key, name, persisted) {
    let p = players.get(key);
    if (p) { p.name = name; return p; }
    p = Object.assign({
      key, name, skin: "",
      epochIn: 0, epochOut: 0, totIn: 0, totOut: 0,
    }, persisted || {});
    p.key = key; p.name = name;
    players.set(key, p);
    return p;
  }
  function money(p) { emit({ t: "money", key: p.key }); }

  function nearestCurDist2(x, y) {
    let bd = 1e9;
    for (const o of curs) { const d = (o.x - x) ** 2 + (o.y - y) ** 2; if (d < bd) bd = d; }
    return bd;
  }
  const edgePoint = side => ({
    x: side === 0 ? 22 : side === 1 ? AW - 22 : rand(50, AW - 50),
    y: side === 2 ? 22 : side === 3 ? AH - 22 : rand(50, AH - 50),
  });
  function spawnPoint(p) {
    const fixed = -1;
    let best = null, bestD = -1;
    for (let i = 0; i < 8; i++) {
      const side = fixed < 0 ? Math.floor(rand(0, 4)) : fixed;
      const { x, y } = edgePoint(side);
      const d = nearestCurDist2(x, y);
      if (d > bestD) { bestD = d; best = { x, y, side }; }
      if (d > (200 * ARENA_K) ** 2) break;
    }
    return best;
  }
  function spawnCur(p, id) {
    const { x, y, side } = spawnPoint(p);
    const c = {
      id, key: p.key, owner: p.name, skin: skinOf(ENTRY),
      x, y, edge: side, h: rand(0, Math.PI * 2), spd: rand(78, 124),
      bounty: ENTRY, mode: "roam", prevMode: "roam", recallT: 0,
      graceUntil: now() + GRACE_MS,
      s: 1, r: 10, kills: 0, peak: ENTRY, born: now(), epoch: epochNo,
      duelUntil: 0, duelFoe: 0,
    };
    curs.push(c);
    return c;
  }
  function sizeOf(c) {
    const m = Math.max(1, c.bounty / ENTRY);
    c.s = Math.min(4, 1 + .5 * Math.log2(m));
    c.r = 10 * c.s;
    if (c.bounty > c.peak) c.peak = c.bounty;
  }
  function graced(c) { return now() < c.graceUntil; }
  function removeCur(c) { curs = curs.filter(x => x !== c); }
  const cursOf = key => curs.filter(c => c.key === key);

  function canDeploy() { return phase === "battle" && deploysOpen && !rushAt; }
  function reserveCursorId() { return nextCurId++; }

  function checkDeploy(key) {
    const p = players.get(key); if (!p) return "no such player";
    if (!canDeploy()) return "deploys closed";
    if (cursOf(key).length >= MAXCUR) return "max live";
    return null;
  }

  function commitDeploy(key, id) {
    const p = players.get(key); if (!p) return null;
    if (checkDeploy(key) !== null) return null;
    p.epochIn += STAKE; p.totIn += STAKE;
    R.pot += ENTRY; R.deploys++; houseFees += FEE;
    const c = spawnCur(p, id);
    emit({ t: "spawn", id: c.id, owner: c.owner, skin: skinOf(c.bounty), x: Math.round(c.x), y: Math.round(c.y), bounty: c.bounty, grace: GRACE_MS / 1000 });
    money(p);
    return c;
  }
  function refundCur(p, c) {
    p.epochIn -= STAKE; p.totIn -= STAKE;
    R.pot -= ENTRY; R.deploys--; houseFees -= FEE;
    removeCur(c);
    emit({ t: "refund", id: c.id, owner: c.owner, key: c.key, epoch: c.epoch });
  }
  function requestRecall(key) {
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
    if (graced(c) && c.mode === "roam") { refundCur(p, c); money(p); return; }
    if (c.mode === "roam" || c.mode === "duel") forceRecall(c);
  }
  function cancelRecall(key) {
    if (phase !== "battle" || rushAt) return;
    for (const c of cursOf(key)) {
      if (c.mode === "recall") { c.mode = "roam"; c.prevMode = "roam"; c.recallT = 0; }
      else if (c.mode === "duel" && c.prevMode === "recall") { c.prevMode = "roam"; c.recallT = 0; }
    }
  }
  function forceRecall(c) {
    if (c.mode === "duel") { c.prevMode = "recall"; c.recallT = RECALL_SECS; return; }
    if (c.mode !== "recall") { c.mode = "recall"; c.prevMode = "recall"; c.recallT = RECALL_SECS; }
  }
  const unplayed = c => c.kills === 0 && c.bounty === ENTRY;
  function bank(c, atShutdown) {
    const p = players.get(c.key);
    const refund = !!atShutdown && unplayed(c);
    const paid = refund ? STAKE : c.bounty;
    if (!R.bigBank || c.bounty > R.bigBank.amt) R.bigBank = { owner: c.owner, amt: c.bounty };
    if (p) { p.epochOut += paid; p.totOut += paid; }
    R.banked += c.bounty;
    if (refund) houseFees -= FEE;
    emit({ t: "bank", id: c.id, owner: c.owner, amt: paid, mult: c.bounty / ENTRY,
           shut: !!atShutdown, refund, key: c.key, epoch: c.epoch });
    removeCur(c);
    if (p) money(p);
  }

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
      const e = OPP_EDGE[c.edge === undefined ? 3 : c.edge];
      const ex = e === 0 ? 18 : e === 1 ? AW - 18 : clamp(c.x, 60, AW - 60);
      const ey = e === 2 ? 18 : e === 3 ? AH - 18 : clamp(c.y, 60, AH - 60);
      const dx = ex - c.x, dy = ey - c.y, dist = Math.hypot(dx, dy);
      if (c.recallT <= 0) { bank(c, rushAt !== null); return; }
      const sp = dist / Math.max(.2, c.recallT);
      c.x += dx / Math.max(1, dist) * sp * dt; c.y += dy / Math.max(1, dist) * sp * dt;
      return;
    }
    const fill = clamp(epochDeaths / CORPSES, 0, 1);
    const aggr = phase === "battle" ? (.7 + 1.5 * fill) : 1;
    let tx = null, ty = null, turn = 2.6 * aggr;
    const { best, bd } = nearestEnemy(c);
    if (best) {
      if (bd < 130 * 130) turn *= 2.8;
      if (bd < (520 * ARENA_K) ** 2) { tx = best.x; ty = best.y; }
    }
    const SEP = 34;
    let rx = 0, ry = 0;
    for (const o of curs) {
      if (o === c || o.key !== c.key) continue;
      const dx = c.x - o.x, dy = c.y - o.y, d2 = dx * dx + dy * dy;
      if (d2 > SEP * SEP) continue;
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
    const M = 64, WT = 7;
    let wx = 0, wy = 0;
    if (c.x < M) wx += (M - c.x) / M;
    if (c.x > AW - M) wx -= (c.x - (AW - M)) / M;
    if (c.y < M) wy += (M - c.y) / M;
    if (c.y > AH - M) wy -= (c.y - (AH - M)) / M;
    if (wx || wy) c.h += clamp(angDiff(Math.atan2(wy, wx) - c.h), -1, 1) * WT * dt * Math.min(1, Math.hypot(wx, wy));
    const weight = 1 + .25 * (c.s - 1);
    const sp = c.spd / weight;
    const ux = c.x + Math.cos(c.h) * sp * dt, uy = c.y + Math.sin(c.h) * sp * dt;
    const pad = Math.max(24, c.r);
    c.x = clamp(ux, pad, AW - pad); c.y = clamp(uy, pad, AH - pad);
    if (c.x !== ux) c.h = Math.PI - c.h;
    if (c.y !== uy) c.h = -c.h;
  }

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
    if (epochDeaths >= CORPSES && phase === "battle") crash();
    else if (!rushAt && epochDeaths >= CORPSES - RUSH_MARGIN) startRush();
  }

  function startRush() {
    rushAt = now();
    for (const c of curs) forceRecall(c);
    emit({ t: "rush", secs: RUSH_MS / 1000 });
  }
  function crash() {
    for (const c of [...curs]) bank(c, true);
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
  function sizeArena(n) {
    const want = Math.max(1, n) * PX2_PER_CUR;
    const k = clamp(Math.sqrt(want / (BASE_AW * BASE_AH)), 1, ARENA_MAX);
    AW = Math.round(BASE_AW * k); AH = Math.round(BASE_AH * k);
    ARENA_K = k;
  }
  function startEpoch() {
    epochNo++;
    const avg = liveN ? liveSum / liveN : 0;
    arenaN = arenaN ? arenaN * .5 + avg * .5 : avg;
    liveSum = 0; liveN = 0;
    sizeArena(arenaN);
    seedHex = opts.seed || newSeedHex(); commit = commitOf(seedHex);
    rng = rngFromSeedHex(seedHex);
    R = { pot: 0, deploys: 0, deaths: 0, banked: 0, bigBank: null };
    epochDeaths = 0; epochStart = upT; rushAt = null;
    phase = "battle"; deploysOpen = true;
    emit({ t: "epoch", no: epochNo, commit, corpses: CORPSES, aw: AW, ah: AH });
  }

  function tick(dt) {
    upT += dt; simClock += dt * 1000;
    liveSum += curs.length; liveN++;
    if (phase === "crash") {
      if (now() >= crashUntil) startEpoch();
      return;
    }
    for (const c of [...curs]) if (c.mode !== "duel") move(c, dt);
    for (const c of [...curs]) if (c.mode === "duel" && c.id < c.duelFoe && now() >= c.duelUntil) resolveDuel(c);
    if (phase !== "battle") return;
    for (let i = 0; i < curs.length; i++) for (let j = i + 1; j < curs.length; j++) {
      const a = curs[i], b = curs[j];
      if (a.key === b.key || graced(a) || graced(b)) continue;
      if (a.mode === "duel" || b.mode === "duel") continue;
      if (!mayFight(a, b)) continue;
      const rr = a.r + b.r;
      if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < rr * rr) startDuel(a, b);
    }
    if (rushAt && (!curs.length || now() - rushAt >= RUSH_MS)) crash();
  }

  const diskUsed = () => BASE_USED + epochDeaths * CORPSE_BYTES;
  function snapshot() {
    return {
      t: "snap", ts: Math.round(simClock),
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

  startEpoch();

  return {
    tick, snapshot, welcomeState,
    registerPlayer, checkDeploy, commitDeploy, reserveCursorId,
    requestRecall, recallOne, cancelRecall,
    players, cursCount: () => curs.length,
    diskUsed, DISK_TOTAL, CORPSES, fees: () => houseFees,
    arena: () => ({ aw: AW, ah: AH }),
    epochNo: () => epochNo, phase: () => phase,
  };
}
