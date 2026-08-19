import { test } from "node:test";
import assert from "node:assert/strict";
import { rig, ENTRY, STAKE, MAXCUR } from "./harness.mjs";

test("a retried recall does not bank twice", () => {
  const r = rig();
  const before = r.bal();
  const id = r.deployLive();
  for (let i = 0; i < 6; i++) { r.sim.recallOne(r.key, id); r.step(); }
  r.until(() => r.evs("bank").length > 0 || !r.cur(id), 8);
  const banks = r.evs("bank").filter(b => b.id === id);
  assert.ok(banks.length <= 1, `${banks.length} banks for one cursor`);
  if (banks.length === 1) assert.equal(r.bal(), before - STAKE + banks[0].amt);
});

test("an order about a cursor that already banked is ignored", () => {
  const r = rig();
  const before = r.bal();
  const id = r.deployLive();
  r.sim.recallOne(r.key, id);
  r.until(() => r.bankOf(id) || !r.cur(id), 8);
  const after = r.bal();
  for (let i = 0; i < 5; i++) { r.sim.recallOne(r.key, id); r.sim.requestRecall(r.key); r.step(); }
  assert.equal(r.bal(), after, "a replayed order paid out again");
  assert.ok(r.evs("bank").filter(b => b.id === id).length <= 1, "two receipts for one cursor");
});

test("orders from a session the server never saw do nothing", () => {
  const r = rig({ opponents: 0 });
  const id = r.deployLive();
  const before = r.bal();
  const minesBefore = r.mine().map(c => c.id);
  r.sim.recallOne("ghost", id);
  r.sim.requestRecall("ghost");
  r.sim.cancelRecall("ghost");
  assert.equal(r.deploy("ghost"), "no such player");
  r.step();
  assert.equal(r.bal(), before, "an unknown session moved our money");
  assert.deepEqual(r.mine().map(c => c.id), minesBefore, "an unknown session changed our cursors");
  const c = r.cur(id);
  assert.ok(c, "an unknown session removed our cursor");
  assert.equal(c.mode, "r", "an unknown session put our cursor into a recall");
});

test("reconnecting keeps your cursors and your balance", () => {
  const r = rig();
  const id = r.deployLive();
  r.secs(2);
  const bal = r.bal(), live = r.mine().map(c => c.id);
  r.sim.registerPlayer(r.key, r.name, false, false);
  assert.equal(r.bal(), bal, "reconnecting changed the balance");
  assert.deepEqual(r.mine().map(c => c.id), live, "reconnecting disturbed the cursors");
  r.sim.recallOne(r.key, id);
  r.until(() => r.bankOf(id) || !r.cur(id), 8);
  assert.ok(r.bankOf(id) || !r.cur(id), "orders stopped working after a reconnect");
});

test("nonsense ids are not a crash and not a payout", () => {
  const r = rig();
  r.deployLive();
  const before = r.bal();
  for (const bad of [-1, 0, 999999, 2 ** 31]) r.sim.recallOne(r.key, bad);
  r.secs(1);
  assert.equal(r.bal(), before);
});

test("the shutdown rush cannot be cancelled", () => {
  const r = rig({ corpses: 30 });
  const t = r.until(() => r.evs("rush").length > 0, 900);
  assert.ok(t >= 0, "no rush inside 15 minutes of sim time");
  const mine = r.mine().map(c => c.id);
  for (let i = 0; i < 200; i++) { r.sim.cancelRecall(r.key); r.deploy(r.key); r.step(); }
  for (const id of mine) {
    const c = r.cur(id);
    if (c) assert.notEqual(c.mode, "r", `cursor ${id} dodged the rush`);
  }
});

test("nothing moves money once the machine has crashed", () => {
  const r = rig({ corpses: 30 });
  const t = r.until(() => r.sim.phase() === "crash", 900);
  assert.ok(t >= 0, "never reached the crash");
  const before = r.bal();
  assert.equal(r.deploy(r.key), "deploys closed");
  r.sim.requestRecall(r.key);
  r.sim.recallOne(r.key, 1);
  r.sim.cancelRecall(r.key);
  assert.equal(r.bal(), before, "money moved during the blue screen");
});

test("a new epoch starts everyone at zero cursors and keeps their money", () => {
  const r = rig({ corpses: 30 });
  assert.ok(r.until(() => r.evs("crash").length > 0, 900) >= 0, "no crash");
  const banked = r.bal();
  assert.ok(r.until(() => r.sim.phase() === "battle" && r.sim.epochNo() >= 2, 60) >= 0,
    "the arena never came back up");
  assert.equal(r.mine().length, 0, "cursors survived the reboot");
  assert.equal(r.bal(), banked, "the reboot changed a balance");
  assert.equal(r.deploy(r.key), null);
  assert.equal(r.bal(), banked - STAKE);
});
