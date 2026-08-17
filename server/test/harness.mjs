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
/* jump the WALL clock without ticking the sim — how the suite reproduces an
   event-loop stall, which must not change a round. */
export const CLOCK_SKIP = ms => { CLOCK += ms; };

/* SIM=<path> points the suite at another copy of the sim — how you confirm a
   new test actually fails against the build that had the bug. */
const SIM = await import(process.env.SIM || "../sim.js");
const { createSim, ENTRY, STAKE, MAXCUR } = SIM;
export { ENTRY, STAKE, MAXCUR, SIM };

/*
 * One rig per test: its own sim, its own event log, its own player -- and now
 * its own OPPONENTS.
 *
 * The suite used to get those for free. Seven house bots deployed on their own
 * every 1.8 seconds, so any test that needed a fight simply waited for one.
 * The bots are gone: they held balances and refilled themselves when broke,
 * which is a money printer, and it may not exist near a real ledger.
 *
 * So the rig fields its own sparring partners, and they are ordinary funded
 * players rather than a privileged kind. That is a better test than what it
 * replaces -- the arena is now exercised by exactly the sort of participant
 * production will actually have.
 */
export function rig({ corpses = 40, balance = 1000000, name = "tester", key = "me", opponents = 8 } = {}) {
  const events = [];

  /*
   * THE BOOKS, STANDING IN FOR THE ARCADE'S.
   *
   * The sim no longer holds a balance -- money lives in the arcade's ledger and
   * server.js moves it: hold on deploy, settle on bank, release on an in-grace
   * refund. These tests are about the ECONOMICS of the arena, so they still
   * need a balance to assert against, and it has to move on exactly the same
   * events the real server moves on. So this mirrors the server's three verbs
   * rather than reaching into the sim for a number that is no longer there.
   *
   * If this and server.js ever disagree about when money moves, that is a real
   * disagreement worth failing over -- which is the point of modelling it here
   * instead of stubbing it out.
   */
  const wallets = new Map();
  const settle = (e) => {
    if (e.t === "bank") wallets.set(e.key, (wallets.get(e.key) || 0) + e.amt);
    else if (e.t === "refund") wallets.set(e.key, (wallets.get(e.key) || 0) + STAKE);
  };

  const sim = createSim({ corpses, emit: e => { events.push(e); settle(e); } });
  sim.registerPlayer(key, name, false, false);
  wallets.set(key, balance);

  /* Funded humans standing in for the old bot population. */
  const foes = [];
  for (let i = 0; i < opponents; i++) {
    const fkey = `foe${i}`;
    sim.registerPlayer(fkey, `foe${i}`, false, false);
    wallets.set(fkey, balance);
    foes.push(fkey);
  }

  /**
   * Buy a cursor the way server.js does: check, take the stake, then spawn --
   * and give the stake back if the round moved on before the spawn landed.
   * Returns the sim's refusal string, or null on success.
   */
  const deploy = (who) => {
    const why = sim.checkDeploy(who);
    if (why) return why;
    if ((wallets.get(who) || 0) < STAKE) return "insufficient";
    wallets.set(who, wallets.get(who) - STAKE);
    const id = sim.reserveCursorId();
    if (!sim.commitDeploy(who, id)) {
      wallets.set(who, wallets.get(who) + STAKE);
      return "deploys closed";
    }
    return null;
  };

  const bal = () => wallets.get(key) || 0;
  const mine = () => sim.welcomeState().curs.filter(c => c.owner === name);
  const cur = id => mine().find(c => c.id === id);
  /*
   * Keep the field populated, then tick. The bots' population maintenance did
   * this inside the sim; it belongs to the TEST now, because the sim should
   * not be in the business of inventing players.
   */
  const fieldFoes = () => {
    const live = sim.welcomeState().curs;
    for (const fkey of foes) {
      if (live.filter(c => c.key === fkey).length === 0) deploy(fkey);
    }
  };
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) { fieldFoes(); advance(); sim.tick(DT); }
  };
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
    if (deploy(key)) return null;
    const c = mine().find(x => !before.has(x.id));
    secs(1.6);
    return c ? c.id : null;
  };
  const evs = t => events.filter(e => e.t === t);
  const bankOf = id => evs("bank").find(e => e.id === id);

  return { sim, key, name, foes, events, evs, bal, wallets, deploy, mine, cur, step, secs, until, deployLive, bankOf };
}

/* Play a rig forward until one of the player's cursors is mid-duel, then hand
   it back. Returns the cursor id, or null if no duel happened in time.
   This is the state that used to swallow orders, so most tests start here. */
export function untilMyDuel(r, maxSecs = 120) {
  for (let i = 0; i < Math.round(maxSecs * 30); i++) {
    if (r.mine().length < MAXCUR && i % 12 === 0) r.deploy(r.key);
    r.step();
    const d = r.mine().find(c => c.mode === "d");
    if (d) return d.id;
  }
  return null;
}
