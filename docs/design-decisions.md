# Design decisions — CURSORS.EXE

Running record of what's locked, what's adopted-pending-prototype, and what's open. Updated 2026-08-13.

## Locked (agreed with the owner)

- **Rounds, not continuous.** Join → battle → results. Chosen so THIN ICE's round machinery ports and the BSOD works as a moment.
- **Fixed entry, proportional resolution.** Every cursor deploys at exactly 0.100 SOL (0.097 arena + 0.001 platform + 0.002 rakeback). Duels resolve at P(A wins) = A/(A+B), winner takes all. Every collision is EV-neutral; P(ever reaching ×N) = 1/N; effective RTP 99% via rakeback. Size is earned mid-round, never bought — this is the whale-balance answer.
- **Up to 5 cursors per player**, cluster together, never fight each other. No EV effect; texture and exposure scaling only.
- **Rakeback**: 200 tickets per deploy, 45-day half-life, ticket share pays the 2% pool (THIN ICE's `RevShareLedger` unchanged).
- **Autoplay**: auto-deploy N per round + bank-at-target. Provably not-worse than manual play (nothing can create edge), boosts volume.
- **No separate jackpot at launch.** The chain ladder IS the jackpot — unbounded right tail priced at exactly 1/N. (THIN ICE's bonanza study: its jackpot was 89% of player variance for marketing's sake; here the core game supplies that tail natively.)
- **Cursors grow with bounty** (log scale), slightly slower when fat — target on the back.
- **No bounty caps, no max-bet knobs.** Entry is fixed, exposure caps at 5 × 0.1 per round, and the round pot bounds the top organically.
- **Min-entrants lobby**: under 2 distinct wallets the round doesn't start and deploys refund in full, fee included. Recall during lobby = full refund.

## Adopted this round (in v3 of the prototype, then the real build)

- **Fixed-tick banking.** Recall completes in a fixed number of ticks regardless of position; the walk to the start button is animation (speed scales to cover the distance in that time). Kills the camp-near-the-exit positional edge while keeping the exposed-cash-out drama and the shutdown convergence. (Credit: the THIN ICE AI's catch.)
- ~~Shrinking resolution as anti-camp~~ — **cut by owner** same day it shipped: recall + the shutdown rush already force the endgame. The aggression ramp (homing strengthens as the round ages) is the remaining anti-camp tool. The shutdown mass-brawl at the start bar is confirmed **intended** — it's the round climax.
- **Fidelity mandate**: reference-grade or don't ship the component (unicorn.meme is the bar). Build depth-first, one component per session to production-final — see `implementation-plan.md`, which is now the authoritative build order.
- ~~**Three verbs: ATTACK / DEFEND / RECALL**~~ — **stances cut 2026-08-13**, when the
  food chain landed. DEFEND existed so a small cursor could refuse a hopeless fight with a
  whale; a 4x engagement rule refuses it on the player's behalf, and every fight still
  reachable is close to even. That left DEFEND meaning "I would rather not play", which
  RECALL already says honestly. Two verbs now: DEPLOY and RECALL. The chase/flee speed pair
  (+12% / -10%) went with it — with nobody fleeing it was a bonus everyone held at once.
- **Auto-battler, NOT steerable.** (Owner reversed the waypoint-control direction 2026-08-09: same-speed cursors + direct steering = kiting forever / dodge-angling meta.) You command from the dashboard only — originally ATTACK / DEFEND / RECALL, now just **RECALL** (see the stances-cut note above). Cursors hunt the nearest enemy they are allowed to fight; when to stop is the whole variance dial.
- **Input model = tick-stamped commands** (deploy / recall), recorded in the round record for fairness replay. Even simpler than waypoints — two discrete verbs. Same primitive on desktop and mobile, which also dissolves most of the mobile-input problem.
- **Fast rounds, always-open deploys.** Join 10s → battle 60s (shutdown last 12s) → results 6s. Deploys stay open the ENTIRE battle until shutdown — death is a re-buy prompt, not a bench. Round ends early when the field empties. This is the answer to "continuous feels better": rounds stay underneath as the settlement/fairness boundary (bounded records, THIN ICE reuse, shutdown climax), but the felt experience is continuous.

## Direction (post-launch)

- **One global room, 0.1 SOL fixed — THIN ICE tradition kept.** Owner's liquidity instinct is correct and decisive: at realistic launch traffic, 6 stake-tier lobbies means 6 dead lobbies. The multi-OS *nostalgia* lives INSIDE the one desktop instead: the machine is a 2003 XP box, and everything era-flavored runs in windows on it (cursamp player, GeoCities pages in IE, Messenger, more Y2K easter eggs over time). OS-version stake rooms (98 = 0.01 … Server 2003 = 1) stay parked as the tier mechanism ONLY if traffic ever reaches split-the-liquidity scale.
- **Y2K/web-1.0 layer is a first-class product goal** (unicorn.meme-grade UI-first). All assets hand-built originals — own icons, own glyphs, own chiptunes — no ripped skins or trademarks, which is also what lets us go arbitrarily hard on the aesthetic. In v3: cursamp (procedural chiptune player with spectrum analyzer) and the cursor$land GeoCities page (visitor counter, guestbook → Messenger, webring). More: screensaver idle mode, era wallpapers, fake defrag, dial-up connect sequence on login.
- **Dopamine, fairly earned:** gold bursts + kill streaks + 92:8 David-vs-Goliath duels + the ladder's native lottery tail. No dark patterns needed — P(×N)=1/N IS the slot machine, honestly priced. Loss side stays fast: 1.6s BSOD that tells you deploys are open.
- ~~**Mobile**: camera follows your cluster~~ — **superseded 2026-08-09**: no camera, no panning. The arena is a fixed logical playfield scaled to fit, so a phone sees the *whole* fight at once (letterboxed). See below.
- Feeding Frenzy reskin: same math, worse skin — not worth splitting effort. Revisit only as a themed room.

## Locked 2026-08-09 (late)

- **Fixed logical arena, 1280×800 units, scaled to fit the viewport** (shipped). Was: arena = whatever size your window happened to be. That is a *fairness* bug, not a layout one — a desktop player and a phone player were playing different-sized battlefields, which changes collision density, travel distance to the bank, and therefore the shape of the game. Now the playfield is a constant and the client only scales it; cursor sprites counter-magnify below ~0.52 scale so they stay legible, while collision radii stay in logical units, making magnification purely cosmetic and incapable of affecting outcomes. Prerequisite for the chain phase: server sim and every client must agree on the arena.
- **DMs are real player-to-player messages in production.** Owner, 2026-08-09: contacts should be actual other players who receive what you send, can reply, and can talk strategy ("maybe collaborate even") — but **purely social: no in-game alliance mechanic**. Two cursors belonging to allied players still auto-battle on contact like anyone else's. This is safe by construction: talking cannot change P(A wins) = A/(A+B), so no amount of collusion creates edge, whereas any *mechanical* alliance (collision exemption, shared bounty) immediately would. Reuse: THIN ICE's chat plumbing (ring buffer, separate rate bucket, sanitizer, `you` stamped by wallet) ports directly — DMs add per-pair routing on top of the lobby broadcast. **Until the server exists every contact is a local bot and nothing leaves the machine**; the UI is built to the real shape so wiring it up is a transport swap, not a rewrite.

## Locked 2026-08-13 — the food chain

- **A cursor only fights inside 4x its own size.** Sharks do not eat plankton. This says
  which fights happen, never how they resolve, so every legal duel is still
  P(A wins) = A/(A+B) and the ladder still prices xN at exactly 1/N. Measured against the
  free-for-all over 100 epochs: whale-farming of fresh deploys 83% -> 0%, "new player eaten
  by something enormous" 35.8% -> 3.3%, per-deploy variance -35%, right tail unchanged.
  4x was picked off a ratio sweep: protection falls off a cliff after it (8.8% -> 17.8% at
  6x), and below 3x the underdog fight stops being an underdog fight. The ratio IS the
  David-vs-Goliath moment — at 4x that moment is "1 in 5, for a 5-bagger".
- **Weight classes are worn, not chosen.** Four ranks, one per 4x step (plain, 3D-White at
  4x, 3D-Bronze at 16x, Dinosaur at 64x), each a real XP pointer scheme, swapped live
  mid-round when you cross a boundary. A rank step is exactly the reach of the rule, so
  "can I fight that" reads off the arrow. Mouse Properties still dresses your desktop
  pointer; it stopped dressing your arena cursors, because the arrow cannot mean both your
  taste and your size. Ranks every doubling were tried and reverted for exactly that reason.
- **Cursors grow harder**: +0.5 of an arrow per doubling out to 64x, was +0.35 flattening
  at 32x. Size decides who may fight you now, so it has to be readable across a desktop.
- **You come up from your own taskbar edge**, drawn per player per epoch from the epoch
  seed, and you recall out through the same wall. Every human used to spawn at the bottom,
  and a fresh cursor rarely lives long enough to travel, so 87% of the field and 96% of all
  deaths sat in the bottom quarter — a 1280x200 arena with a large decorative area above it.
  Now roughly a quarter each. Rounds run ~60% longer at a given corpse budget as a result,
  because the arena is genuinely being used.

## Open

- Identity: username is chosen at the XP login screen (shipped 2026-08-09, persists locally; right-click the tile to switch users). **Phantom wallet connect replaces/augments this at the chain phase** — owner's call, deferred.

- Bot/liquidity policy for dead hours (disclosed house cursors at fair odds; THIN ICE's bots+banking mutual-exclusion guard currently forbids exactly this — needs a deliberate, disclosed design before real money).
- Exact round timings (prototype: join 18s / battle 75s / shutdown 15s / results 8s — tune by feel).
- Session auth is play-money grade (inherited caveat); revisit with mainnet custody.
