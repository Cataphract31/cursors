let CLOCK = 1e12;
Date.now = () => CLOCK;

export const DT = 1 / 30, STEP = Math.round(1000 * DT);
export const advance = () => { CLOCK += STEP; };
export const CLOCK_SKIP = ms => { CLOCK += ms; };

const SIM = await import(process.env.SIM || "../sim.js");
const { createSim, ENTRY, STAKE, MAXCUR } = SIM;
export { ENTRY, STAKE, MAXCUR, SIM };

export function rig({ corpses = 40, balance = 1000000, name = "tester", key = "me", opponents = 8 } = {}) {
  const events = [];

  const wallets = new Map();
  const settle = (e) => {
    if (e.t === "bank") wallets.set(e.key, (wallets.get(e.key) || 0) + e.amt);
    else if (e.t === "refund") wallets.set(e.key, (wallets.get(e.key) || 0) + STAKE);
  };

  const sim = createSim({ corpses, emit: e => { events.push(e); settle(e); } });
  sim.registerPlayer(key, name, false, false);
  wallets.set(key, balance);

  const foes = [];
  for (let i = 0; i < opponents; i++) {
    const fkey = `foe${i}`;
    sim.registerPlayer(fkey, `foe${i}`, false, false);
    wallets.set(fkey, balance);
    foes.push(fkey);
  }

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

  const until = (pred, maxSecs = 60) => {
    const max = Math.round(maxSecs * 30);
    for (let i = 0; i < max; i++) { step(); if (pred()) return i; }
    return -1;
  };
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

export function untilMyDuel(r, maxSecs = 120) {
  for (let i = 0; i < Math.round(maxSecs * 30); i++) {
    if (r.mine().length < MAXCUR && i % 12 === 0) r.deploy(r.key);
    r.step();
    const d = r.mine().find(c => c.mode === "d");
    if (d) return d.id;
  }
  return null;
}
