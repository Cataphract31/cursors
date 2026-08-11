/* Test rig for the arena rules.
   The sim reads Date.now() for grace, duels and the crash delay, so the clock
   is faked forward exactly one step per tick. That makes a run deterministic
   (the seeded rng does the rest) and lets a whole epoch play out in
   milliseconds instead of an hour.

   Date.now is patched at import time, before sim.js is loaded, because sim.js
   captures nothing at module scope — it calls Date.now() per use. */
let CLOCK = 1e12;
Date.now = () => CLOCK;

export const DT = 1 / 30, STEP = Math.round(1000 * DT);
export const advance = () => { CLOCK += STEP; };

/* SIM=<path> points the suite at another copy of the sim — how you confirm a
   new test actually fails against the build that had the bug. */
const { createSim, ENTRY, STAKE, MAXCUR } = await import(process.env.SIM || "../sim.js");
export { ENTRY, STAKE, MAXCUR };

/* One rig per test: its own sim, its own event log, its own player. */
export function rig({ corpses = 40, balance = 1000000, name = "tester", key = "me" } = {}) {
  const events = [];
  const sim = createSim({ corpses, emit: e => events.push(e) });
  sim.registerPlayer(key, name, false, false);
  sim.players.get(key).balance = balance;

  const bal = () => sim.players.get(key).balance;
  const mine = () => sim.welcomeState().curs.filter(c => c.owner === name);
  const cur = id => mine().find(c => c.id === id);
  const step = (n = 1) => { for (let i = 0; i < n; i++) { advance(); sim.tick(DT); } };
  const secs = s => step(Math.round(s * 30));

  /* Run until pred() is truthy, one tick at a time. Returns the tick it fired
     on, or -1 if it never did — never throws, so a test states its own failure. */
  const until = (pred, maxSecs = 60) => {
    const max = Math.round(maxSecs * 30);
    for (let i = 0; i < max; i++) { step(); if (pred()) return i; }
    return -1;
  };
  /* Deploy and wait out spawn grace, so the cursor is a real combatant. */
  const deployLive = () => {
    const before = new Set(mine().map(c => c.id));
    if (sim.requestDeploy(key)) return null;
    const c = mine().find(x => !before.has(x.id));
    secs(1.6);
    return c ? c.id : null;
  };
  const evs = t => events.filter(e => e.t === t);
  const bankOf = id => evs("bank").find(e => e.id === id);

  return { sim, key, name, events, evs, bal, mine, cur, step, secs, until, deployLive, bankOf };
}

/* Play a rig forward until one of the player's cursors is mid-duel, then hand
   it back. Returns the cursor id, or null if no duel happened in time.
   This is the state that used to swallow orders, so most tests start here. */
export function untilMyDuel(r, maxSecs = 120) {
  for (let i = 0; i < Math.round(maxSecs * 30); i++) {
    if (r.mine().length < MAXCUR && i % 12 === 0) r.sim.requestDeploy(r.key);
    r.step();
    const d = r.mine().find(c => c.mode === "d");
    if (d) return d.id;
  }
  return null;
}
