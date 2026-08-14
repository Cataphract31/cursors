# Reusing THIN ICE (`c:\ZINC`) in CURSORS.EXE

Rule: **copy into this repo, never edit the originals.** Surveyed 2026-08-09 at ZINC HEAD `77103e1` (all audit fixes present). THIN ICE is an npm-workspaces monorepo: `packages/engine` (pure deterministic TS, zero deps), `packages/sim` (Monte Carlo), `apps/server` (Node 22 + built-in `node:sqlite` + `ws`), `apps/web` (React 19 + Vite, canvas renderer decoupled from React).

Headline: our fee spec is simpler than THIN ICE's — a flat **2% taken at entry** (0.1 SOL entry, 0.098 into the arena) and nothing taken after it. THIN ICE splits its take across several pools in `packages/engine/src/config.ts`; none of that split, and none of the machinery that services it, comes across.

---

## COPY AS-IS

| From ZINC | What it is | Notes |
|---|---|---|
| `packages/engine/src/rng.ts` | The audited RNG: 128-bit hex seed → sfc32 (12 warm-up draws discarded), `deriveRng(seed, tag)` for independent sub-streams, hard **throw** on seeds under 32 hex chars. | Zero game coupling. The 32→128-bit audit fix and its rationale live here — a 32-bit seed is GPU-crackable from the published commit within a lobby window. |
| `apps/server/src/chain.ts` | Solana custodial hot wallet: deposit verification (checks the claimer actually *signed* the tx, credits actual balance delta, 8×2s poll), prepare-then-send withdrawals. | Zero game coupling. The withdrawal pattern is the audit's crown jewel: sign but don't broadcast → record intent → send → on failure ask the chain `landed/failed/expired/unknown`; **only failed/expired refund**. Copy `index.ts` handleDeposit/handleWithdraw with it — the correctness lives in the caller's ordering too. Devnet-only by design (boot-time throw without an explicit mainnet env var); mainnet = replace wholesale with hardware key / PDA escrow, not harden. |
| `apps/server/src/config.ts` pattern | Env reader that **throws at boot** on non-numeric/out-of-range values; refuses to boot with bots+banking both on. | A NaN min-entrants silently eats deposits forever; fail-loud config prevents the whole class. Drop THIN ICE knobs, add arena knobs. |
| `apps/server/src/index.ts` socket scaffolding | ws server hardening: 300 socket / 6-per-IP caps (keyed on *last* XFF token), token-bucket rate limits, separate chat bucket, 1MB backpressure kill, 20s ping, nonce auth (Phantom signMessage, 192-bit bearer tokens, timingSafeEqual, guest namespacing). | Every ceiling has a documented reason. Retrofit only the message `handle()` switch. TLS is nginx/Caddy's job (see ZINC `DEPLOYMENT.md`); shutdown is safe-not-graceful (transactional writes + boot-time refund sweep). |
| `packages/sim/src/fairness.ts` | 6-part RNG certification: χ² uniformity 6M draws, pair independence, 20k distinct seeds → distinct streams, short-seed refusal, determinism, full replay. | Adapt only the round-replay section to cursor rounds. |
| `packages/sim/src/strategies.ts` pattern | `NamedStrategy {id,label,strategy,weight}` harness shape. | 44 lines. |
| `apps/web/src/game/session.ts` | `VITE_SERVER_URL` set → real net client, unset → local demo. | 12 meaningful lines; the config-flip that kept THIN ICE's UI ignorant of which client feeds it. |

## RETROFIT (copy, then modify as stated)

| From ZINC | Keep | Change |
|---|---|---|
| `packages/engine/src/fairness.ts` | The whole commit-reveal ceremony: sha256 commit over `game:roundId:seed:rulesHash`, canonical key-sorted config stringifier, outcome digest snapped to the lamport grid, record-then-replay architecture. | Tag `thinice:` → `cursors:`. Replace `replayRound` with a cursor-arena replay: record `{seedHex, config, entrantIds, actions[]}` where actions are tick-stamped intents (deploy/recall/steer). **Hardest constraint of the whole port:** the sim must consume RNG in a fixed, action-independent order — derive each duel's roll from `deriveRng(seed, "duel:tick:idA:idB")` instead of one global stream, or replay desyncs when duel counts vary. Iterate collision pairs in canonical order (sorted by tick, then entity ids) so detection order is replay-stable. The record logs every duel as `(tick, A, B, bountyA, bountyB, draw, winner)` so the fairness page can replay each fight, and the input model is **tick-stamped waypoint commands** (not raw pointer streams) — small records, mobile tap-to-waypoint becomes the same primitive as desktop.
  **⚠ Rule inversion vs THIN ICE:** ZINC's rule is "movement/AI never draws from the committed stream" — correct there because bot movement is cosmetic. In CURSORS movement decides who collides, so it is outcome-relevant: ALL sim-affecting randomness (wander noise, bot decisions) must be deterministic from committed seed + recorded inputs — tagged sub-streams like `deriveRng(seed, "wander:tick:id")`, or eliminated (bots recorded as ordinary player inputs). Only cosmetics (shards, chat timing) use presentation RNG. |
| `apps/server/src/db.ts` (~70% copy) | `node:sqlite` + WAL, integer lamports everywhere, `transfers` table with **sig as PRIMARY KEY** (the entire double-credit defence), `wallet_tokens`, `meta`, every BEGIN/COMMIT/ROLLBACK money method, `refundOpenEntries` crash sweep, `debitForWithdrawal` (unsettled-money hold in ONE SQL statement — do not reimplement), the audited one-transaction `closeRound(…, settle)` shape. | `entries` → `deploys(roundId, wallet, seat, staked, returned, outcome)`; drop plate/char columns; our own record/digest fields on `rounds`. The audit's root cause (untransacted finish under a swallow-everything handler) is fixed by construction if we keep the one-transaction close + the loop's `try/catch → abortRound → refundOpenEntries` — port both together, they are one fix. |
| `apps/server/src/game.ts` (~40% literal) | Loop skeleton: 50ms interval, **one tick per pass, never a catch-up burst** (a stall must not replay elimination rolls nobody saw), `abortRound`, phase machine lobby→live→result, distinct-wallet min-entrants, per-wallet cap = 5, chat ring buffer stamping `you` by wallet not name, bot brains memoised per tick drawing only from presentation RNG, bots+banking mutual exclusion. | Replace `tick()` with the 2D sim (the 50ms loop already gives 20Hz headroom; run sim 15–20Hz). Drop plates/hazard/sole-owner/bonanza. |
| `apps/web/src/game/net.ts` | Transport shell: exponential backoff with retry-reset **in `ready`, not `onopen`** (prevents retry storms at a full server), full-snapshot resync (no deltas/seqs — reconnect heals free), commit pinning to localStorage (first observation wins), lazy `import("@solana/web3.js")` so non-bankers never download the SDK. | Add the fast frame channel (below). Do NOT push position frames through the existing `state`→React path — it rebuilds the whole snapshot per message; fine at 5Hz, fatal at 15Hz. |
| `apps/web/src/game/client.ts` | Extract: `verifyEntry()` (seven-receipt verifier; "unverifiable" renders as null, never as "mismatch"), `sha256Hex`, `commitPreimage`, and the one-`Snapshot`-two-producers discipline. | Skip `GameClient` itself — a local 20-cursor demo is a rewrite, not a port. Fix an inherited hazard: THIN ICE hardcodes the commit preimage and login-challenge strings in FOUR places across two packages; we define both once in our engine package and import. |
| `packages/sim/src/invariants.ts` | The sacred-invariant test shape: RTP == 1 − rake for EVERY strategy, 400k rounds, errors clustered by round. | Our invariant: EV per deploy = stake × 0.98 regardless of recall timing, steering, cursor count, or clustering. This test is the mathematical guarantee behind "every touch is EV-neutral". |
| `tools/probe.mjs`, `crashtest.mjs`, `holdtest.mts` | End-to-end: two real ws clients share a round, money moves exactly once, client cannot set server-owned fields; kill-mid-round → full refund; unsettled money can't be withdrawn. | Point at cursor protocol. |

## NEW WORK (no THIN ICE counterpart)

1. **Fast position channel.** THIN ICE's `state` message is personalized per-session (DB read + per-socket stringify, throttled to 5Hz for that reason) and cannot carry 15Hz × 20 entities. Build a two-channel protocol: keep `state` as-is for money/phase/roster (5Hz, personalized), add an impersonal binary `frame` serialized **once** per tick and fanned to all sockets — `[tick, [id, x, y, heading, state, bounty]…]`, int16 quantized ≈ 170 bytes/frame ≈ 2.6 KB/s/socket at 15Hz. Absolute positions (stateless frames — a dropped frame must never corrupt the next). Client writes frames into a mutable store read by the canvas loop, never through React; interpolate the ~66ms between frames.
2. **2D arena sim** — movement, clustering, collision, duel resolution, shutdown rush — deterministic and replayable under the fairness constraint above.
3. **Steering input**: sample pointer client-side and send at fixed ~10Hz (per-pointermove sends would trip the 40-msg/s bucket).
4. **XP desktop renderer** (prototype exists) — port to the canvas-decoupled-from-React architecture ZINC's `render/lattice.ts` demonstrates (offscreen sprite pre-render, blit per frame, own rAF loop).
5. **Messenger chat UI** (prototype exists) — wire to the existing chat plumbing (ring buffer, separate rate bucket, sanitizer all reusable).

## SKIP

`round.ts` hazard/plate mechanics (THIN ICE's identity), `BonanzaPool` (no jackpot in our spec — revisit later), `risk.ts`, lattice/cells/tiles renderers (study the architecture, skip the content), sim studies tied to hazard tuning (`payouts`, `pacing`, `sweep`, `composition`, `rake`, `bonanza-study`) — but imitate their tune-by-measurement method. Do NOT reproduce ZINC's `upload/zinc` manual-sync mirror; if we need a drag-upload artifact, generate it from a build step.

## Required reading before building the real thing

ZINC's `AUDIT-BRIEF.md` (codebase map + where each audit finding lives), `MAINNET.md` (known pre-real-money pitfalls — inherit them, don't rediscover them), `DEPLOYMENT.md` (nginx/Caddy TLS termination, the five mandatory proxy headers, `proxy_read_timeout 3600s`).

**First build step, before any more UI: port the sim skeleton and prove the invariants** — pot conservation through collisions, EV per deploy = stake × 0.97 for every strategy (hunter, camper, instant banker, chain rider, autoplay), and strategy-EV-equality unbroken by homing, clustering, or waypoint control. The equivalent proof is how THIN ICE caught its wipe leak. If the numbers hold, everything else is skin.

## Open caveats inherited with the code

- Wallet session tokens are bearer credentials at guest-id trust — ZINC's own comment: **play-money grade, revisit before real money.** Applies to us identically.
- Custodial hot wallet is devnet-only by design; mainnet needs hardware key or PDA escrow (replacement, not hardening).
- Graceful shutdown doesn't exist (safe-not-graceful); write it if we ever care about drain-before-restart.
