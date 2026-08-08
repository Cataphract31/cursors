# Design decisions — CURSORS.EXE

Running record of what's locked, what's adopted-pending-prototype, and what's open. Updated 2026-08-09.

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
- **Shrinking resolution as anti-camp.** Mid-battle a Display Properties window drops the "resolution": playfield walls close 1024×768 → 800×600 → 640×480 style, forcing density late-round so dodging forever isn't a strategy. Round timer stays the shutdown/restart dialog.
- **Real movement control, leaned into.** Waypoint steering (click/tap a point, cursor pathes there; sampled to ticks). Because every collision is EV-neutral, control cannot create edge or laundering channels — it converts imposed variance into chosen variance. Dodge = low variance, hunt the fat one = high variance. Skill-feel with zero skill-edge; keep light wander noise (from committed tagged streams) so movement stays alive.
- **Input model = tick-stamped waypoint commands**, recorded in the round record for full fairness replay. Same primitive on desktop and mobile.

## Direction (post-launch)

- **Stake tiers as Windows-version rooms**: XP Home 0.1 / XP Professional 1 / Server 2003 5 SOL. Equality within a room, whale expression across rooms. One room at launch; split only when concurrency supports it. **One global rakeback ticket economy across all rooms** so tiering never fragments the become-the-house loop.
- **Mobile**: camera follows your cluster, tap-to-waypoint; the full-desktop overview is the desktop-browser luxury. Decided early because it shapes the renderer.
- Feeding Frenzy reskin: same math, worse skin — not worth splitting effort. Revisit only as a themed room.

## Open

- Bot/liquidity policy for dead hours (disclosed house cursors at fair odds; THIN ICE's bots+banking mutual-exclusion guard currently forbids exactly this — needs a deliberate, disclosed design before real money).
- Exact round timings (prototype: join 18s / battle 75s / shutdown 15s / results 8s — tune by feel).
- Session auth is play-money grade (inherited caveat); revisit with mainnet custody.
