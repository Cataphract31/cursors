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
import { rig, untilMyDuel, ENTRY, STAKE, MAXCUR, SIM } from "./harness.mjs";

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
  assert.equal(r.sim.requestDeploy(r.key), null);
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
  assert.equal(STAKE - ENTRY, 3, "the locked 1+2 milli-SOL fee moved");
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
    if (r.mine().length < MAXCUR && i % 12 === 0) r.sim.requestDeploy(r.key);
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
  let inPot = 0, out = 0;
  for (const e of r.events) {
    if (e.t === "spawn") inPot += ENTRY;
    else if (e.t === "refund") inPot -= ENTRY;
    else if (e.t === "bank") out += e.amt;
    else if (e.t === "crash") break;
  }
  assert.equal(out, inPot, "the arena did not pay out everything it was given");
});

test("no cursor ever leaves without a receipt", () => {
  /* Every cursor that entered must have left as exactly one of: banked, killed,
     or refunded in grace. Two fates is money paid twice; none is money that
     stopped existing. Stated this way it does not race the final tick, where a
     cursor can die in the same step that fills the disk.
     Together with the pot check above, this is the whole conservation law. */
  const r = rig({ corpses: 30 });
  const t = r.until(() => {
    if (r.mine().length < MAXCUR) r.sim.requestDeploy(r.key);
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
  for (let i = 0; i < 9; i++) r.sim.requestDeploy(r.key);
  assert.ok(r.mine().length <= MAXCUR, `${r.mine().length} cursors live`);
  assert.equal(r.sim.requestDeploy(r.key), "max live");
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
    if (r.mine().length < MAXCUR) r.sim.requestDeploy(r.key);
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
      if (!r.sim.requestDeploy(r.key)) {
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
