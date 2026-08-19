import { test } from "node:test";
import assert from "node:assert/strict";
import { rig, untilMyDuel, ENTRY, STAKE, MAXCUR, SIM, DT, advance, CLOCK_SKIP } from "./harness.mjs";
const { createSim } = SIM;

function stillHoming(r, id) {
  const c = r.cur(id);
  if (!c) return;
  assert.notEqual(c.mode, "r", "back to roaming after a recall order — the order was dropped");
}

function duelTrials(r, n, fn) {
  let seen = 0;
  for (let a = 0; a < n * 6 && seen < n; a++) {
    const id = untilMyDuel(r, 60);
    if (id === null) break;
    if (fn(id)) seen++;
  }
  return seen;
}

test("a recall ordered mid-duel is honoured, not dropped", () => {
  const r = rig({ corpses: 4000 });
  const banked = duelTrials(r, 5, id => {
    r.sim.recallOne(r.key, id);
    r.until(() => r.bankOf(id) || !r.cur(id), 6);
    const b = r.bankOf(id);
    if (b) { assert.ok(!b.shut, "banked by the crash, not by the order"); return true; }
    stillHoming(r, id);
    return false;
  });
  assert.ok(banked > 0, "no duelling cursor was ever seen to bank");
});

test("a recall ordered while roaming is honoured", () => {
  const r = rig();
  const id = r.deployLive();
  r.sim.recallOne(r.key, id);
  r.until(() => r.bankOf(id) || !r.cur(id), 6);
  const b = r.bankOf(id);
  if (b) assert.ok(!b.shut); else stillHoming(r, id);
});

test("RECALL ALL takes duelling cursors too", () => {
  const r = rig({ corpses: 4000 });
  const banked = duelTrials(r, 5, id => {
    r.sim.requestRecall(r.key);
    r.until(() => r.bankOf(id) || !r.cur(id), 6);
    const b = r.bankOf(id);
    if (b) { assert.ok(!b.shut); return true; }
    stillHoming(r, id);
    return false;
  });
  assert.ok(banked > 0, "no duelling cursor ever banked under RECALL ALL");
});

test("cancel un-arms an order given mid-duel", () => {
  const r = rig({ corpses: 4000 });
  const checked = duelTrials(r, 5, id => {
    r.sim.recallOne(r.key, id);
    r.sim.cancelRecall(r.key);
    r.until(() => r.bankOf(id) || !r.cur(id), 6);
    if (r.cur(id)) return true;
    if (r.bankOf(id)) assert.fail("cancel did not reach an order armed inside a duel");
    return false;
  });
  assert.ok(checked > 0, "never observed a survivor to check the cancel against");
});

test("an order refused mid-glide is not an order lost", () => {
  const r = rig();
  const id = r.deployLive();
  r.sim.recallOne(r.key, id);
  r.secs(1);
  r.sim.recallOne(r.key, id);
  r.until(() => r.bankOf(id) || !r.cur(id), 4);
  if (!r.bankOf(id)) stillHoming(r, id);
});

test("undeploy inside spawn grace is exactly free", () => {
  const r = rig();
  const before = r.bal();
  assert.equal(r.deploy(r.key), null);
  r.sim.requestRecall(r.key);
  assert.equal(r.evs("refund").length, 1);
  assert.equal(r.bal(), before, "a misclick cost money");
});

test("a cursor that never fights banks entry, and the fee is the whole edge", () => {
  const r = rig();
  const before = r.bal();
  const id = r.deployLive();
  r.sim.recallOne(r.key, id);
  const t = r.until(() => r.bankOf(id) || !r.cur(id), 6);
  assert.ok(t >= 0);
  const b = r.bankOf(id);
  if (!b) return;
  assert.equal(r.bal(), before - STAKE + b.amt, "the wallet and the bank receipt disagree");
  assert.equal(STAKE - ENTRY, 2, "the locked 2 milli-SOL entry fee moved");
  const won = r.evs("kill").filter(k => k.w === id).reduce((s, k) => s + k.pot, 0);
  assert.equal(b.amt, ENTRY + won, "banked something other than entry plus what it won");
});

test("every duel conserves the money on the table", () => {
  const r = rig({ corpses: 200 });
  const bounty = new Map();
  let checked = 0;
  for (let i = 0; i < 30000 && checked < 200; i++) {
    for (const c of r.sim.welcomeState().curs) bounty.set(c.id, c.bounty);
    const seen = r.evs("kill").length;
    if (r.mine().length < MAXCUR && i % 12 === 0) r.deploy(r.key);
    r.step();
    for (const k of r.evs("kill").slice(seen)) {
      const wBefore = bounty.get(k.w), lBefore = bounty.get(k.l);
      if (wBefore === undefined || lBefore === undefined) continue;
      const wNow = r.sim.welcomeState().curs.find(c => c.id === k.w);
      if (!wNow) continue;
      assert.equal(k.pot, lBefore, "the pot was not the loser's whole bounty");
      assert.equal(wNow.bounty, wBefore + lBefore, "money appeared or vanished in a duel");
      checked++;
    }
  }
  assert.ok(checked >= 50, `only ${checked} duels observed`);
});

test("an epoch banks out exactly what it took in", () => {
  const r = rig({ corpses: 30 });
  const t = r.until(() => r.evs("crash").length > 0, 900);
  assert.ok(t >= 0, "no crash inside 15 minutes of sim time");
  let inPot = 0, out = 0, fromHouse = 0;
  for (const e of r.events) {
    if (e.t === "spawn") inPot += ENTRY;
    else if (e.t === "refund") inPot -= ENTRY;
    else if (e.t === "bank") { out += e.amt; if (e.refund) fromHouse += STAKE - ENTRY; }
    else if (e.t === "crash") break;
  }
  assert.equal(out - fromHouse, inPot, "the arena did not pay out everything it was given");
});

test("a cursor the shutdown sweep takes without a fight pays no fee", () => {
  const r = rig({ corpses: 30 });
  const t = r.until(() => {
    if (r.mine().length < MAXCUR) r.deploy(r.key);
    return r.evs("crash").length > 0;
  }, 900);
  assert.ok(t >= 0, "no crash inside 15 minutes of sim time");

  const banks = r.evs("bank");
  const unplayed = banks.filter(b => b.shut && b.mult === 1);
  assert.ok(unplayed.length > 0, "the sweep took nobody who had not fought — test proves nothing");
  for (const b of unplayed) {
    assert.equal(b.amt, STAKE, "an unplayed cursor got back less than it paid to enter");
    assert.equal(b.refund, true, "the receipt does not say it was a refund");
  }
  for (const b of banks) {
    if (b.refund) continue;
    assert.ok(b.amt !== STAKE || b.mult !== 1,
      "a cursor banked the full stake without being marked a refund");
  }
});

test("the sweep ends when the field is empty, not when the clock runs out", () => {
  const r = rig({ corpses: 30 });
  const t = r.until(() => {
    if (r.mine().length < MAXCUR) r.deploy(r.key);
    return r.evs("rush").length > 0;
  }, 900);
  assert.ok(t >= 0, "no shutdown rush inside 15 minutes of sim time");
  const ceiling = r.evs("rush")[0].secs;

  let secsToCrash = 0, emptyFor = 0;
  for (let i = 0; i < Math.round(ceiling * 30) + 60; i++) {
    r.step(); secsToCrash += DT;
    if (r.evs("crash").length > 0) break;
    if (r.sim.cursCount() === 0) emptyFor += DT;
  }
  assert.ok(r.evs("crash").length > 0, "the sweep never crashed");
  assert.ok(secsToCrash < ceiling,
    `the sweep ran the full ceiling (${secsToCrash.toFixed(2)}s of ${ceiling}s) instead of ending with the field`);
  assert.ok(emptyFor < 0.5,
    `${emptyFor.toFixed(2)}s of empty desktop before the crash — the sweep is meant to end with the last bank`);
});

test("no cursor ever leaves without a receipt", () => {
  const r = rig({ corpses: 30 });
  const t = r.until(() => {
    if (r.mine().length < MAXCUR) r.deploy(r.key);
    return r.evs("crash").length > 0;
  }, 900);
  assert.ok(t >= 0, "no crash inside 15 minutes of sim time");

  const fate = new Map();
  const add = (id, how) => fate.set(id, [...(fate.get(id) || []), how]);
  for (const e of r.events) {
    if (e.t === "spawn") fate.set(e.id, []);
    else if (e.t === "bank") add(e.id, e.shut ? "banked at crash" : "banked");
    else if (e.t === "kill") add(e.l, "killed");
    else if (e.t === "refund") add(e.id, "refunded");
    else if (e.t === "crash") break;
  }
  const bad = [...fate].filter(([, f]) => f.length !== 1);
  assert.deepEqual(bad, [], "cursors with no fate or more than one");
  assert.ok([...fate.values()].some(f => f[0] === "banked at crash"),
    "the crash banked nobody — nothing was live when the disk filled");
});

test("five cursors is five cursors", () => {
  const r = rig();
  for (let i = 0; i < 9; i++) r.deploy(r.key);
  assert.ok(r.mine().length <= MAXCUR, `${r.mine().length} cursors live`);
  assert.equal(r.deploy(r.key), "max live");
});

test("nobody else's cursor answers your orders", () => {
  const r = rig({ corpses: 4000 });
  r.deployLive();
  const others = () => r.sim.welcomeState().curs
    .filter(c => c.owner !== r.name && c.grace <= 0 && c.bounty === ENTRY && c.mode === "r");
  const t = r.until(() => others().length >= 3, 20);
  assert.ok(t >= 0, "no untouched bot cursors to try this against");

  const before = r.bal();
  const marks = others().map(c => c.id);
  for (const id of marks) r.sim.recallOne(r.key, id);
  r.step();
  const now = r.sim.welcomeState().curs;
  for (const id of marks) {
    const c = now.find(x => x.id === id);
    if (c) assert.notEqual(c.mode, "c", `cursor ${id} obeyed an order from another player`);
  }
  r.secs(5);
  for (const id of marks) {
    const b = r.bankOf(id);
    assert.ok(!b || b.owner !== r.name, "a stranger's cursor banked into our name");
  }
  assert.ok(r.bal() <= before, "recalling a stranger's cursor paid us");
});

test("the food chain boundary is inclusive, and it is 4x", () => {
  const { canFight, FOOD_CHAIN, tierOf, TIER_SKINS } = SIM;
  assert.equal(FOOD_CHAIN, 4, "the locked ratio moved");
  assert.ok(canFight(ENTRY, ENTRY), "equals must fight");
  assert.ok(canFight(ENTRY, 4 * ENTRY), "exactly 4x is still a legal fight");
  assert.ok(!canFight(ENTRY, 4 * ENTRY + 1), "a hair over 4x is not");
  assert.ok(!canFight(ENTRY, 100 * ENTRY), "a whale cannot eat plankton");
  assert.ok(canFight(50 * ENTRY, 200 * ENTRY), "the rule is a ratio, not a size");
  assert.equal(tierOf(ENTRY), 0);
  assert.equal(tierOf(3.99 * ENTRY), 0);
  assert.equal(tierOf(4 * ENTRY), 1, "a rank step is one FOOD_CHAIN, so it reads off the arrow");
  assert.equal(tierOf(16 * ENTRY), 2);
  assert.equal(tierOf(64 * ENTRY), 3, "the dinosaur is the top rank, at 64x");
  assert.equal(tierOf(1e9), TIER_SKINS.length - 1, "the top class must absorb everything above it");
});

test("nothing is ever eaten by something outside its weight class", () => {
  const FOOD_CHAIN = SIM.FOOD_CHAIN || 4;
  const r = rig({ corpses: 300 });
  const bad = [];
  let checked = 0;
  const seen = () => r.evs("kill").length;
  let done = seen();
  r.until(() => {
    if (r.mine().length < MAXCUR) r.deploy(r.key);
    const live = r.sim.welcomeState().curs;
    for (const k of r.evs("kill").slice(done)) {
      const w = live.find(c => c.id === k.w);
      if (!w) continue;
      const killer = w.bounty - k.pot;
      checked++;
      if (Math.max(killer, k.pot) > FOOD_CHAIN * Math.min(killer, k.pot))
        bad.push(`${(killer / ENTRY).toFixed(1)}x ate ${(k.pot / ENTRY).toFixed(1)}x`);
    }
    done = r.evs("kill").length;
    return r.evs("crash").length > 0;
  }, 900);
  assert.ok(checked >= 100, `only ${checked} duels observed`);
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} of ${checked} duels crossed the food chain`);
});

test("deploys do not all come up from the same wall", () => {
  const r = rig({ corpses: 12 });
  const ys = [];
  r.until(() => {
    if (r.mine().length < MAXCUR) {
      const before = new Set(r.mine().map(c => c.id));
      if (!r.deploy(r.key)) {
        const c = r.mine().find(x => !before.has(x.id));
        if (c) ys.push(c.y);
      }
    }
    return ys.length >= 150;
  }, 1800);
  assert.ok(ys.length >= 80, `only ${ys.length} deploys sampled`);
  const bottom = ys.filter(y => y > 700).length / ys.length;
  assert.ok(bottom < 0.9, `${(100 * bottom).toFixed(0)}% of deploys came up from the bottom edge`);
});

test("a crowded epoch is played on a bigger field", () => {
  const r = rig({ corpses: 60 });
  for (let i = 0; i < 14; i++) {
    const k = "crowd" + i;
    r.sim.registerPlayer(k, k, false, false);
    r.sim.players.get(k).balance = 1e9;
  }
  const t = r.until(() => {
    for (let i = 0; i < 14; i++) r.deploy("crowd" + i);
    r.deploy(r.key);
    return r.evs("epoch").length >= 2;
  }, 900);
  assert.ok(t >= 0, "no second epoch inside 15 minutes");
  const ep = r.evs("epoch").at(-1);
  assert.ok(ep.aw > 0 && ep.ah > 0, "the epoch never announced its field");
  assert.equal(Math.round((ep.aw / ep.ah) * 100), 160, "the field changed shape, not just size");
  assert.ok(ep.aw > 1280, `a crowded epoch still ran on ${ep.aw}x${ep.ah}`);
  const snap = r.sim.snapshot();
  assert.equal(snap.aw, ep.aw, "snapshot and epoch disagree about the field");
  assert.equal(r.sim.welcomeState().aw, ep.aw, "welcome and epoch disagree about the field");
});

test("RECALL ALL with a graced cursor and a gliding one does both jobs", () => {
  const r = rig({ corpses: 4000 });
  const glider = r.deployLive();
  r.sim.recallOne(r.key, glider);
  r.step();
  assert.equal(r.cur(glider).mode, "c", "the first cursor is not gliding");

  const before = r.bal();
  assert.equal(r.deploy(r.key), null);
  const fresh = r.mine().find(c => c.id !== glider && c.grace > 0);
  assert.ok(fresh, "no graced cursor to test with");

  r.sim.requestRecall(r.key);
  r.step();
  assert.equal(r.evs("refund").length, 1, "the graced cursor did not refund");
  assert.equal(r.bal(), before, "the refund did not return the full stake");
  const g = r.cur(glider);
  assert.ok(!g || g.mode === "c", "the glide already in flight was disturbed");
});

test("the shutdown sweep leaves nobody hunting", () => {
  const r = rig({ corpses: 40 });
  for (let i = 0; i < 6; i++) {
    const k = "sweep" + i;
    r.sim.registerPlayer(k, k, false, false);
    r.sim.players.get(k).balance = 1e9;
  }
  const t = r.until(() => {
    for (let i = 0; i < 6; i++) r.deploy("sweep" + i);
    return r.evs("rush").length > 0;
  }, 900);
  assert.ok(t >= 0, "no shutdown rush inside 15 minutes");

  let seenLive = 0;
  const everRoamed = [];
  for (let i = 0; i < 30 * 20 && !r.evs("crash").length; i++) {
    r.step();
    const live = r.sim.welcomeState().curs;
    seenLive = Math.max(seenLive, live.length);
    for (const c of live) if (c.mode === "r" && c.grace <= 0) everRoamed.push(c.id);
  }
  assert.ok(seenLive > 0, "the field was empty for the whole rush — nothing was observed");
  assert.deepEqual([...new Set(everRoamed)], [],
    `${everRoamed.length} cursor-frames were still hunting after the shutdown sweep`);
});

test("a round is a function of its seed, not of the wall clock", () => {
  const SEED = "0123456789abcdef0123456789abcdef";
  const play = stallMs => {
    const events = [];
    const wallets = new Map([["x", 1e9], ["y", 1e9]]);
    const sim = createSim({ corpses: 40, seed: SEED, emit: e => {
      events.push(JSON.stringify(e));
      if (e.t === "bank") wallets.set(e.key, (wallets.get(e.key) || 0) + e.amt);
      else if (e.t === "refund") wallets.set(e.key, (wallets.get(e.key) || 0) + STAKE);
    } });
    for (const k of ["x", "y"]) sim.registerPlayer(k, k, false, false);
    const buy = (k) => {
      if (sim.checkDeploy(k) || (wallets.get(k) || 0) < STAKE) return;
      wallets.set(k, wallets.get(k) - STAKE);
      if (!sim.commitDeploy(k, sim.reserveCursorId())) wallets.set(k, wallets.get(k) + STAKE);
    };
    for (let i = 0; i < 30 * 240; i++) {
      advance();
      if (i === 900) CLOCK_SKIP(stallMs);
      sim.tick(DT);
      for (const k of ["x", "y"]) buy(k);
      if (events.some(e => e.includes('"t":"crash"'))) break;
    }
    return { events, bal: ["x", "y"].map(k => wallets.get(k)) };
  };
  const base = play(0);
  assert.ok(base.events.length > 50, "the control round barely played");
  for (const ms of [17, 500, 5000]) {
    const r = play(ms);
    assert.deepEqual(r.bal, base.bal, `a ${ms}ms stall moved player balances`);
    assert.equal(r.events.length, base.events.length, `a ${ms}ms stall changed the event count`);
    assert.equal(r.events.join("|"), base.events.join("|"), `a ${ms}ms stall changed the round`);
  }
});

test("a recall runs for the far wall, not the one it came up from", () => {
  const wallOf = (x, y, aw, ah) => {
    const d = [x, aw - x, y, ah - y];
    return d.indexOf(Math.min(...d));
  };
  const OPP = [1, 0, 3, 2];
  const r = rig({ corpses: 400 });
  let checked = 0;

  for (let attempt = 0; attempt < 25 && checked < 5; attempt++) {
    const id = r.deployLive();
    if (id == null) break;
    const { aw, ah } = r.sim.arena();
    const born = r.evs("spawn").find(e => e.id === id);
    if (!born) continue;
    const from = wallOf(born.x, born.y, aw, ah);

    r.sim.recallOne(r.key, id);
    let last = null;
    for (let i = 0; i < 30 * 4; i++) {
      const c = r.cur(id);
      if (!c) break;
      if (c.mode === "c") last = { x: c.x, y: c.y };
      r.step();
    }
    if (!last || !r.bankOf(id)) continue;
    assert.equal(wallOf(last.x, last.y, aw, ah), OPP[from],
      `a cursor that came up on wall ${from} left through the wrong one`);
    checked++;
  }
  assert.ok(checked >= 3, `only ${checked} clean glides observed — test proves little`);
});

test("your five do not all come up on the same wall", () => {
  const wallOf = (x, y, aw, ah) => {
    const d = [x, aw - x, y, ah - y];
    return d.indexOf(Math.min(...d));
  };
  const r = rig({ corpses: 400 });
  const { aw, ah } = r.sim.arena();
  const wall = new Map();
  let seen = 0;
  const samples = [];

  r.until(() => {
    if (r.mine().length < MAXCUR) r.deploy(r.key);
    for (const e of r.evs("spawn").slice(seen)) wall.set(e.id, wallOf(e.x, e.y, aw, ah));
    seen = r.evs("spawn").length;
    const live = r.mine();
    if (live.length === MAXCUR) {
      const walls = live.map(c => wall.get(c.id)).filter(w => w !== undefined);
      if (walls.length === MAXCUR) samples.push(new Set(walls).size);
    }
    return samples.length >= 400;
  }, 1800);

  assert.ok(samples.length >= 100, `only ${samples.length} full squads observed`);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const allOne = samples.filter(n => n === 1).length / samples.length;
  assert.ok(mean > 2, `a squad of five spans only ${mean.toFixed(2)} walls on average`);
  assert.ok(allOne < 0.05, `${(100 * allOne).toFixed(1)}% of squads came up on a single wall`);
});
