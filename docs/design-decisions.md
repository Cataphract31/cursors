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
- **Auto-battler, NOT steerable.** (Owner reversed the waypoint-control direction 2026-08-09: same-speed cursors + direct steering = kiting forever / dodge-angling meta.) You command from the dashboard only: **ATTACK** (hunt nearest enemy), **DEFEND** (evade + regroup — collision rate down, never zero once the arena shrinks), **RECALL**. That's the whole variance dial, and it's still real variance choice. Bots use the same three verbs.
- **Input model = tick-stamped commands** (deploy / stance / recall), recorded in the round record for fairness replay. Even simpler than waypoints — three discrete verbs. Same primitive on desktop and mobile, which also dissolves most of the mobile-input problem.
- **Fast rounds, always-open deploys.** Join 10s → battle 60s (shutdown last 12s) → results 6s. Deploys stay open the ENTIRE battle until shutdown — death is a re-buy prompt, not a bench. Round ends early when the field empties. This is the answer to "continuous feels better": rounds stay underneath as the settlement/fairness boundary (bounded records, THIN ICE reuse, shutdown climax), but the felt experience is continuous.

## Direction (post-launch)

- **One global room, 0.1 SOL fixed — THIN ICE tradition kept.** Owner's liquidity instinct is correct and decisive: at realistic launch traffic, 6 stake-tier lobbies means 6 dead lobbies. The multi-OS *nostalgia* lives INSIDE the one desktop instead: the machine is a 2003 XP box, and everything era-flavored runs in windows on it (cursamp player, GeoCities pages in IE, Messenger, more Y2K easter eggs over time). OS-version stake rooms (98 = 0.01 … Server 2003 = 1) stay parked as the tier mechanism ONLY if traffic ever reaches split-the-liquidity scale.
- **Y2K/web-1.0 layer is a first-class product goal** (unicorn.meme-grade UI-first). All assets hand-built originals — own icons, own glyphs, own chiptunes — no ripped skins or trademarks, which is also what lets us go arbitrarily hard on the aesthetic. In v3: cursamp (procedural chiptune player with spectrum analyzer) and the cursor$land GeoCities page (visitor counter, guestbook → Messenger, webring). More: screensaver idle mode, era wallpapers, fake defrag, dial-up connect sequence on login.
- **Dopamine, fairly earned:** gold bursts + kill streaks + 92:8 David-vs-Goliath duels + the ladder's native lottery tail. No dark patterns needed — P(×N)=1/N IS the slot machine, honestly priced. Loss side stays fast: 1.6s BSOD that tells you deploys are open.
- **Mobile**: camera follows your cluster; dashboard verbs (attack/defend/recall/deploy) are already thumb-sized. Full-desktop overview is the desktop-browser luxury.
- Feeding Frenzy reskin: same math, worse skin — not worth splitting effort. Revisit only as a themed room.

## Open

- Bot/liquidity policy for dead hours (disclosed house cursors at fair odds; THIN ICE's bots+banking mutual-exclusion guard currently forbids exactly this — needs a deliberate, disclosed design before real money).
- Exact round timings (prototype: join 18s / battle 75s / shutdown 15s / results 8s — tune by feel).
- Session auth is play-money grade (inherited caveat); revisit with mainnet custody.
