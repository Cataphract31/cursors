/* The arena rules, tested where the money is.
   The mobile audit read the client and drove a browser, which finds anything a
   player can reproduce by tapping. It could not find a recall order dropped
   because the cursor happened to be inside a 700ms duel — that needs the order
   fired at a chosen instant, thousands of times, which is what this file does.

   Two rules for anything added here:
     - assert money, not appearances. A slot that says "recalling" is not a
       bank; only a bank event and a balance are.
     - a bank at the crash proves nothing. The crash banks everyone, so it can
       make a dropped order look honoured. Every recall test excludes shut. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rig, untilMyDuel, ENTRY, STAKE, MAXCUR, SIM, DT, advance, CLOCK_SKIP } from "./harness.mjs";
const { createSim } = SIM;

/* ---------------- orders survive every state a cursor can be in ------------- */

/* Half of every duel dies, so a test that needs a survivor must sample many
   duels rather than hope. One rig, many collisions, a big corpse budget so the
   disk never fills and banks the field for us. */
/* A cursor that hasn't banked yet must at least still be on its way home. It
   can be caught again during the 3s glide — a chain of duels legitimately
   outlasts any fixed deadline — so the check is "not wandering again", which
   is exactly what a dropped order looks like and nothing else does. */
function stillHoming(r, id) {
  const c = r.cur(id);
  if (!c) return;                                   /* died on the way out: allowed */
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
  /* The regression. Before the fix: 300+ orders, not one bank. */
  const r = rig({ corpses: 4000 });
  const banked = duelTrials(r, 5, id => {
    r.sim.recallOne(r.key, id);
    r.until(() => r.bankOf(id) || !r.cur(id), 6);
    const b = r.bankOf(id);
    if (b) { assert.ok(!b.shut, "banked by the crash, not by the order"); return true; }
    stillHoming(r, id);
    return false;                                   /* it lost the duel: no information */
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
  /* The other half of the fix: if a duel can carry a recall through it, a
     cancel has to be able to reach into the duel and take it back. */
  const r = rig({ corpses: 4000 });
  const checked = duelTrials(r, 5, id => {
    r.sim.recallOne(r.key, id);
    r.sim.cancelRecall(r.key);
    r.until(() => r.bankOf(id) || !r.cur(id), 6);
    if (r.cur(id)) return true;                         /* survived, still fighting: correct */
    if (r.bankOf(id)) assert.fail("cancel did not reach an order armed inside a duel");
    return false;                                       /* died in the duel: no information */
  });
  assert.ok(checked > 0, "never observed a survivor to check the cancel against");
});

test("an order refused mid-glide is not an order lost", () => {
  const r = rig();
  const id = r.deployLive();
  r.sim.recallOne(r.key, id);
  r.secs(1);
  r.sim.recallOne(r.key, id);        /* a second tap must not restart the 3s */
  r.until(() => r.bankOf(id) || !r.cur(id), 4);
  if (!r.bankOf(id)) stillHoming(r, id);
});

/* ---------------------------- money invariants ----------------------------- */

test("undeploy inside spawn grace is exactly free", () => {
  const r = rig();
  const before = r.bal();
  assert.equal(r.deploy(r.key), null);
  r.sim.requestRecall(r.key);                    /* still graced: refund, not recall */
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
  if (!b) return;                                /* it was caught on the way out */
  /* the wallet gets exactly what was banked, whatever that turned out to be */
  assert.equal(r.bal(), before - STAKE + b.amt, "the wallet and the bank receipt disagree");
  assert.equal(STAKE - ENTRY, 2, "the locked 2 milli-SOL entry fee moved");
  /* a recall is still killable, so it can win a fight on the way out and bank
     more than it took in. Only the untouched case owes exactly entry back. */
  const won = r.evs("kill").filter(k => k.w === id).reduce((s, k) => s + k.pot, 0);
  assert.equal(b.amt, ENTRY + won, "banked something other than entry plus what it won");
});

test("every duel conserves the money on the table", () => {
  /* EV-neutrality at the mechanical level: the winner leaves carrying exactly
     what the two of them brought. Not a sampling test — it must hold always. */
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
  /* The invariant the sim already checks at the crash — asserted here so a
     violation fails a test run instead of printing to a log nobody reads. */
  const r = rig({ corpses: 30 });
  const t = r.until(() => r.evs("crash").length > 0, 900);
  assert.ok(t >= 0, "no crash inside 15 minutes of sim time");
  let inPot = 0, out = 0, fromHouse = 0;
  for (const e of r.events) {
    if (e.t === "spawn") inPot += ENTRY;
    else if (e.t === "refund") inPot -= ENTRY;
    /* a swept cursor that never fought is handed back the whole stake, and
       the 2% over the arena share is the house's money, not the pot's */
    else if (e.t === "bank") { out += e.amt; if (e.refund) fromHouse += STAKE - ENTRY; }
    else if (e.t === "crash") break;
  }
  assert.equal(out - fromHouse, inPot, "the arena did not pay out everything it was given");
});

test("a cursor the shutdown sweep takes without a fight pays no fee", () => {
  /* You cannot see the crash coming and cannot opt out of it, so a deploy
     that never got a fight must cost nothing at all — not even the rake. */
  const r = rig({ corpses: 30 });
  const t = r.until(() => {
    if (r.mine().length < MAXCUR) r.deploy(r.key);
    return r.evs("crash").length > 0;
  }, 900);
  assert.ok(t >= 0, "no crash inside 15 minutes of sim time");

  /* Read 'never fought' off the receipt rather than off the new flag, so this
     fails on the money against a build that does not have the rule: a win adds
     the loser's bounty, so mult === 1 on a live cursor means it never had one. */
  const banks = r.evs("bank");
  const unplayed = banks.filter(b => b.shut && b.mult === 1);
  assert.ok(unplayed.length > 0, "the sweep took nobody who had not fought — test proves nothing");
  for (const b of unplayed) {
    assert.equal(b.amt, STAKE, "an unplayed cursor got back less than it paid to enter");
    assert.equal(b.refund, true, "the receipt does not say it was a refund");
  }
  /* and the concession is narrow: anything that fought banks its bounty */
  for (const b of banks) {
    if (b.refund) continue;
    assert.ok(b.amt !== STAKE || b.mult !== 1,
      "a cursor banked the full stake without being marked a refund");
  }
});

test("the sweep ends when the field is empty, not when the clock runs out", () => {
  /* The rush used to run its full ceiling every time, so every epoch ended
     with everyone already banked and seconds of empty desktop to watch. */
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
  /* Every cursor that entered must have left as exactly one of: banked, killed,
     or refunded in grace. Two fates is money paid twice; none is money that
     stopped existing. Stated this way it does not race the final tick, where a
     cursor can die in the same step that fills the disk.
     Together with the pot check above, this is the whole conservation law. */
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

/* ------------------------------ the hard caps ------------------------------ */

test("five cursors is five cursors", () => {
  const r = rig();
  for (let i = 0; i < 9; i++) r.deploy(r.key);
  assert.ok(r.mine().length <= MAXCUR, `${r.mine().length} cursors live`);
  assert.equal(r.deploy(r.key), "max live");
});

test("nobody else's cursor answers your orders", () => {
  /* corpses high so no shutdown rush can recall the field out from under us */
  const r = rig({ corpses: 4000 });
  r.deployLive();
  /* Bots recall themselves once they hit their own target multiple (riskAt is
     at least 1.5x), so only ones that have never won a fight are usable here —
     for those, a recall can only have come from us. */
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

/* ---------------------------- the food chain ------------------------------- */

/* The rule that lets a fresh deploy survive its first ten seconds: a cursor
   only fights inside 4x its own size. These tests are the reason to trust that
   the rule is actually wired into contact, and not merely defined. */

test("the food chain boundary is inclusive, and it is 4x", () => {
  const { canFight, FOOD_CHAIN, tierOf, TIER_SKINS } = SIM;
  assert.equal(FOOD_CHAIN, 4, "the locked ratio moved");
  assert.ok(canFight(ENTRY, ENTRY), "equals must fight");
  assert.ok(canFight(ENTRY, 4 * ENTRY), "exactly 4x is still a legal fight");
  assert.ok(!canFight(ENTRY, 4 * ENTRY + 1), "a hair over 4x is not");
  assert.ok(!canFight(ENTRY, 100 * ENTRY), "a whale cannot eat plankton");
  assert.ok(canFight(50 * ENTRY, 200 * ENTRY), "the rule is a ratio, not a size");
  /* the weight class the arena draws is one step per 4x, so a class boundary
     is exactly the reach of the rule */
  assert.equal(tierOf(ENTRY), 0);
  assert.equal(tierOf(3.99 * ENTRY), 0);
  assert.equal(tierOf(4 * ENTRY), 1, "a rank step is one FOOD_CHAIN, so it reads off the arrow");
  assert.equal(tierOf(16 * ENTRY), 2);
  assert.equal(tierOf(64 * ENTRY), 3, "the dinosaur is the top rank, at 64x");
  assert.equal(tierOf(1e9), TIER_SKINS.length - 1, "the top class must absorb everything above it");
});

test("nothing is ever eaten by something outside its weight class", () => {
  /* The integration test — it never asks the predicate anything, it just
     watches every death in a busy arena. Against the build before the rule,
     this fails in the first epoch: whales ate fresh deploys 83% of the time. */
  const FOOD_CHAIN = SIM.FOOD_CHAIN || 4;   /* literal fallback so this still detects a build with no rule at all */
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
      if (!w) continue;                      /* the winner died later in the same tick */
      const killer = w.bounty - k.pot;       /* what the winner brought to the fight */
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
  /* Every human used to spawn at y = AH - 22, and a fresh cursor rarely lives
     long enough to travel, so 87% of the field sat in the bottom quarter. The
     taskbar edge is drawn per player per epoch, so this samples many epochs. */
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
  /* Density is what a round feels like, so the field is sized to the
     population at every epoch start rather than being 1280x800 forever. The
     fairness rule it has to respect is that everyone in a ROUND shares one
     field — which the epoch event carries, so a client cannot guess wrong. */
  const r = rig({ corpses: 60 });
  for (let i = 0; i < 14; i++) {
    const k = "crowd" + i;
    r.sim.registerPlayer(k, k, false, false);
    r.sim.players.get(k).balance = 1e9;
  }
  const t = r.until(() => {
    for (let i = 0; i < 14; i++) r.deploy("crowd" + i);
    r.deploy(r.key);
    return r.evs("epoch").length >= 2;      /* the one after the first crash */
  }, 900);
  assert.ok(t >= 0, "no second epoch inside 15 minutes");
  const ep = r.evs("epoch").at(-1);
  assert.ok(ep.aw > 0 && ep.ah > 0, "the epoch never announced its field");
  assert.equal(Math.round((ep.aw / ep.ah) * 100), 160, "the field changed shape, not just size");
  assert.ok(ep.aw > 1280, `a crowded epoch still ran on ${ep.aw}x${ep.ah}`);
  /* and the snapshot has to agree, or a client joining mid-epoch draws the
     wrong field and every position it renders is in the wrong place */
  const snap = r.sim.snapshot();
  assert.equal(snap.aw, ep.aw, "snapshot and epoch disagree about the field");
  assert.equal(r.sim.welcomeState().aw, ep.aw, "welcome and epoch disagree about the field");
});

test("RECALL ALL with a graced cursor and a gliding one does both jobs", () => {
  /* The client picks one verb for the whole stack, so it has to know which one
     wins when you hold both states at once. The label and both client paths now
     give grace precedence and send "recall"; this pins what that means here —
     the graced cursor refunds in full and the glide already running is NOT
     disturbed. Before this was pinned, one client path sent recallCancel
     instead, which refunded nothing and cancelled a bank in progress. */
  const r = rig({ corpses: 4000 });
  const glider = r.deployLive();                 /* out of grace, roaming */
  r.sim.recallOne(r.key, glider);
  r.step();
  assert.equal(r.cur(glider).mode, "c", "the first cursor is not gliding");

  const before = r.bal();
  assert.equal(r.deploy(r.key), null);
  const fresh = r.mine().find(c => c.id !== glider && c.grace > 0);
  assert.ok(fresh, "no graced cursor to test with");

  r.sim.requestRecall(r.key);                    /* the one verb, both states */
  r.step();
  assert.equal(r.evs("refund").length, 1, "the graced cursor did not refund");
  assert.equal(r.bal(), before, "the refund did not return the full stake");
  const g = r.cur(glider);
  assert.ok(!g || g.mode === "c", "the glide already in flight was disturbed");
});

/* ------------------------- the fairness ceremony --------------------------- */

test("the shutdown sweep leaves nobody hunting", () => {
  /* The rush recalls the field. It used to skip any cursor that happened to be
     mid-duel, and resolveDuel then restored it to "roam" — so it spent the
     whole shutdown hunting cursors that were gliding home defenceless. 90% of
     all rush-window kills came from cursors this sweep forgot. */
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

  /* Watch every tick from the sweep to the crash rather than looking once
     afterwards: the crash empties the field, so a single late sample passes
     vacuously against a build that still has the bug. */
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
  /* Motion integrates on a fixed dt, so every window the sim gates on — grace,
     the 700ms duel, the rush, bot re-entry — has to read the same clock or the
     commit/reveal ceremony means nothing. It used to read Date.now(), and a
     17ms event-loop hiccup thousands of ticks earlier changed who won duels
     and moved real balances. */
  const SEED = "0123456789abcdef0123456789abcdef";
  const play = stallMs => {
    const events = [];
    // The sim holds no balance any more, so the money is mirrored here on the
    // same events server.js settles on. Strictly weaker than the event-stream
    // comparison below, and kept because "a stall moved player balances" is the
    // sentence this test exists to be able to say.
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
      if (i === 900) CLOCK_SKIP(stallMs);          /* the event loop hiccups */
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
  /* The glide is time-boxed at RECALL_SECS either way, so crossing the field
     buys no extra exposure — it buys speed, which is what makes leaving
     readable. This pins the direction: a cursor that spawned on the left must
     bank out through the right. */
  const wallOf = (x, y, aw, ah) => {
    const d = [x, aw - x, y, ah - y];                 /* left, right, top, bottom */
    return d.indexOf(Math.min(...d));
  };
  const OPP = [1, 0, 3, 2];
  const r = rig({ corpses: 400 });
  let checked = 0;

  for (let attempt = 0; attempt < 25 && checked < 5; attempt++) {
    const id = r.deployLive();
    if (id == null) break;
    const { aw, ah } = r.sim.arena();
    /* the SPAWN EVENT, not the cursor now: deployLive waits out spawn grace,
       and 1.6s of roaming is enough drift to make the nearest wall a lie */
    const born = r.evs("spawn").find(e => e.id === id);
    if (!born) continue;
    const from = wallOf(born.x, born.y, aw, ah);

    r.sim.recallOne(r.key, id);
    let last = null;
    for (let i = 0; i < 30 * 4; i++) {
      const c = r.cur(id);
      if (!c) break;                                   /* banked, or killed en route */
      if (c.mode === "c") last = { x: c.x, y: c.y };
      r.step();
    }
    /* Only a glide that actually finished says anything about where it was
       headed. One that was killed or caught mid-field stopped somewhere
       arbitrary, and judging its position is judging the interruption. */
    if (!last || !r.bankOf(id)) continue;
    /* sampled on the last gliding tick, so it is where the cursor was headed */
    assert.equal(wallOf(last.x, last.y, aw, ah), OPP[from],
      `a cursor that came up on wall ${from} left through the wrong one`);
    checked++;
  }
  assert.ok(checked >= 3, `only ${checked} clean glides observed — test proves little`);
});

test("your five do not all come up on the same wall", () => {
  /* A per-player wall put a whole squad on one edge, where they spent half
     their lives inside touching distance of cursors they can never fight. It
     was never an EV edge — every duel is A/(A+B), so no arrangement bends the
     average — but five arrows arriving in a heap reads as a gang, and this is
     played for money. Each deploy picks its own wall now. */
  const wallOf = (x, y, aw, ah) => {
    const d = [x, aw - x, y, ah - y];                 /* left, right, top, bottom */
    return d.indexOf(Math.min(...d));
  };
  const r = rig({ corpses: 400 });
  const { aw, ah } = r.sim.arena();
  const wall = new Map();                             /* cursor id -> spawn wall */
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
  /* five independent draws from four walls average ~3.05 distinct; one wall
     for the whole squad is what the old rule produced, every single time */
  assert.ok(mean > 2, `a squad of five spans only ${mean.toFixed(2)} walls on average`);
  assert.ok(allOne < 0.05, `${(100 * allOne).toFixed(1)}% of squads came up on a single wall`);
});
