# CURSORS.EXE — handoff brief

Paste-able context for continuing development in a fresh session. Written 2026-08-09.
Authoritative details live in `docs/design-decisions.md`, `docs/implementation-plan.md`,
`docs/reuse-from-thinice.md`. This file is the map, not the territory.

---

## 1. What this is

**CURSORS.EXE** — a Solana cursor-gambling game that lives inside a carbon-copy Windows XP
desktop running in the browser. You deploy mouse cursors onto the desktop for a fixed
0.1 SOL each; they auto-battle; when two enemy cursors touch, one dies and the winner
absorbs the loser's bounty. You choose only *when to bank*. The XP desktop is not a theme —
it is the product: Winamp plays, Minesweeper is real, Messenger works, the Recycle Bin is
where dead cursors go.

Owner is an economics/game-design specialist and gambler, **not a developer** — treats
Claude as their dev. Write for that: explain in plain language, don't hand over homework.

Second game alongside **THIN ICE** (`c:\ZINC`), the owner's other Solana casino game.

---

## 2. Where everything is

| | |
|---|---|
| Repo | `C:\CURSORS` (own git repo, branch `master`) |
| App | `apps/web` — npm workspace, Vite |
| Dev | `npm run dev` in `C:\CURSORS` → http://localhost:5173 |
| Build | `npm run build` → smoke test → Vite → `dist/artifact.html` (single self-contained file) |
| Artifact | https://claude.ai/code/artifact/a63b4916-15d2-49c8-8ae2-6dc8476f6cdf (republish the same `dist/artifact.html` path to keep the URL) |
| Sibling repo | `c:\ZINC` = THIN ICE. **Copy from it, never edit it.** |

Source layout (`apps/web/src/`):
- `main.js` (~1800 lines) — shell, window manager, desktop, game sim, boot/login
- `minesweeper.js`, `messenger.js` — self-contained app modules, **import-free on purpose**
  (the build's smoke runner executes them in node; main.js injects assets + shell hooks)
- `assets.js` — every real asset, imported/globbed so Vite inlines it
- `style.css` — everything on top of `xp.css`
- `assets/xp/` — icons (winXP repo, MIT), sounds (2001 XP scheme + MSN 7), emo (80 MSN
  emoticons), mine (Minesweeper sprites), wall (Bliss), logo (XP flag)
- `assets/music/` — 4 Kevin MacLeod CC-BY MP3s at 96kbps

---

## 3. Economics — LOCKED, do not redesign

- Entry **0.100 SOL fixed** = 0.097 arena + 0.001 platform (1%) + 0.002 rakeback (2%)
- Duel: **P(A wins) = A/(A+B)** by bounty, winner takes all → every collision is EV-neutral
- **P(ever reaching ×N) = 1/N**, exactly. Variance is chosen by *when you bank*, never by bet size
- Effective **RTP 99%** via rakeback; 200 tickets per deploy, 45-day half-life
- Max 5 cursors per player per round; own cursors never fight each other
- No jackpot — the chain ladder *is* the lottery tail, honestly priced
- Under 2 distinct wallets the round refunds in full, fee included
- These constants **match THIN ICE's audited config exactly** → lift its ledger unchanged

---

## 4. Design decisions locked

- **Auto-battler, NOT steerable.** You command from a dashboard: ATTACK (hunt nearest),
  DEFEND (evade + regroup), RECALL (3s fixed-tick bank). Owner reversed steering because
  same-speed cursors + direct control = kiting forever. Three verbs also fit a thumb.
- **Rounds**: join 10s → battle 60s (shutdown last 12s) → results 6s. **Deploys stay open
  the entire battle** — death is a re-buy prompt, not a bench.
- **Fixed logical arena: 1280×800 units, scaled to fit.** Not "your window size" — that was
  a fairness bug (different-sized battlefields = different EV). Client only scales it.
  Sprites counter-magnify below ~0.52 scale; collision radii stay logical, so zoom is cosmetic.
- **One global 0.1 SOL room.** Liquidity beats stake tiers at launch traffic.
- **DMs are real player-to-player in production, but purely social** — no alliance mechanic.
  Allied cursors still auto-battle. Safe because talk can't move A/(A+B); a *mechanical*
  alliance would break EV-neutrality instantly.
- **Carbon copy, not homage** (owner reversed this hard, twice): use real libraries and
  found assets — Webamp, xp.css, archived icon/sound/emoticon sets. Hand-recreating what a
  library already does 1:1 is the failure mode. One line held: **no shipping copyrighted
  music** (owner's own MP3s come in via drag-and-drop; we ship CC-BY tracks).

---

## 5. What is already built (all shipped and verified)

**The OS engine.** One process table (`openApps`) is the single source of truth; the
taskbar is a pure render of it, rebuilt on every mutation. `wireWindow(el)` wires any
window — markup or runtime-created. Windows: drag, resize from 8 edges, maximize,
minimize-to-tab animation, focus/z-order, persisted rects, `fitWin()` clamps to screen.

**Carbon-copy XP shell.** Real boot screen (flag, block marquee, copyright), real Welcome
screen (startup.wav, logon chime, "welcome" interstitial), Luna chrome via xp.css, taskbar
+ two-column Start menu with winXP's exact gradients, ~130 archived shell32 icons, Bliss,
the full 2001 sound scheme, context menus at XP metrics with checkmark support, working
menu bars, Run… dialog, Display Properties, Date/Time with live analog clock, Task Manager,
screensavers, desktop icons with drag/marquee/rename/delete.

**Winamp** — real Webamp (MIT), full three-deck stack, 4 CC-BY tracks, Ctrl+D double size.
Two bugs fixed here that looked like a "zombie taskbar": Webamp centers on its mount node's
rect (ours was 0×0, hidden, top-left) and our `.window{display:none}` rule was hitting
Webamp's own windows (same class name).

**Minesweeper** — real rules: first click always safe, flood fill, chording, flag→question
cycle, negative mine counter, 999s clock, face states, misflagged X's on loss, 3 levels,
Best Times per level with your name.

**Messenger** — buddy list (groups, live counts, status tinting, personal messages, display
pictures) + **real conversation windows**, one per contact plus lobby, each with its own
taskbar button. Typing indicators, nudge (real nudge.wav + shake), Send a File joke, and
the **real 80-emoticon MSN retro set** with ~110 text shortcuts and a picker. Bots have
per-contact reply pools and answer you; presence drifts; sign-ins raise stacking toasts.

**The game** — deploy/recall/stances, duels with odds display, gold bursts, kill streaks,
BSOD on losing your last cursor, shutdown rush, results, rakeback tracking, autoplay.

---

## 6. Working practices that matter

- **Screenshot loop.** Claude can see its own UI work:
  `& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new
  --disable-gpu --screenshot="out.png" --window-size=1280,800 --hide-scrollbars
  --virtual-time-budget=9000 --user-data-dir="$env:TEMP\edge-N" <url>` then Read the PNG.
  **Use a fresh `--user-data-dir` per shot.** `--force-device-scale-factor=3` to inspect
  pixels. `--dump-dom` returns empty on this Edge — paint diagnostics into the page instead.
  **This has caught every visual bug so far. Do not skip it.**
- **Dev hashes** (skip boot/login and drive states headlessly): `#desktop`, `#desktop-start`,
  `#desktop-mine-play`, `#desktop-msn`, `#desktop-msn-emo`, `#desktop-msn-toast`,
  `#desktop-amptest`, `#desktop-logfill`.
- **Smoke test** runs before every build: executes `main.js` in node under a stub DOM,
  catching strict-mode and load-time crashes. Sibling modules run for real, so keep them
  import-free.
- **Mobile check**: `--window-size=390,844`. Mobile is expected to be the majority playerbase.
- Commits: one-line summary in plain language saying what changed and why, then detail.
  End with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Owner plays every build — republish the artifact and say what to look at.

---

## 7. Remaining roadmap, in the owner's priority order

**Owner directive: visible + fun first.** cmd.exe, gpedit.msc, Device Manager, regedit are
explicitly **parked** ("stuff only 2% of users would search for"). Run… jokes about them.

1. **Phase M step 2 — the mobile shell** (NEXT, owner: "mobile will probably be the majority
   playerbase"). Keep XP chrome — owner confirmed: "Obviously always keep XP." Below ~760px:
   apps become **full-screen sheets** (one at a time, no dragging/overlap — so adding apps
   stops costing screen space); taskbar becomes an **app switcher**; Start becomes a
   full-screen launcher; the **game HUD leaves its window** and becomes a permanent bottom
   bar in the thumb zone (wallet, timer, DEPLOY/ATTACK/DEFEND/RECALL) that app sheets never
   cover; **long-press = right-click**. Arena already scales correctly — that part is done.
2. **Paint** — via a real library/embed if possible; Save As Wallpaper (meme machine).
3. **My Computer / Explorer + fake C:\ drive** — address bar, task pane, Properties dialogs,
   System Properties joke, disk-usage pie fed by real game stats.
4. **Recycle Bin with a purpose** — dead cursors as `.cur` files with death certificates
   (killer, bounty lost, the 92:8 that did it), Hall of Pain leaderboard.
5. **CURSORS.EXE production pass** — the game window is still the most-used and least-polished
   surface: menu bar, Play/Stats/Rakeback/History/Verify panes, canvas render upgrade
   (trails, chunkier explosions, duel lock-on), ×10 celebration, first-run wizard.
6. **IE + handmade web** — cursor$land at unicorn.meme density, webring, dial-up sequence.
7. **Start menu completeness** — All Programs roster, recent apps, Help & Support.

**Parallel engine track (blocks real money, not UI):** port THIN ICE's sim skeleton and
**prove the invariants** — pot conservation, and EV per deploy = stake × 0.97 for *every*
strategy (hunter, camper, instant banker, chain rider, autoplay). This is how THIN ICE
caught its wipe leak. Then: server, Phantom wallet connect at the login tile, real DMs.

---

## 8. THIN ICE reuse (full detail in `docs/reuse-from-thinice.md`)

**Copy as-is:** `rng.ts` (audited 128-bit seed → sfc32, tagged sub-streams),
`ledger.ts → RevShareLedger` (**highest-value file for us** — rakeback with 45d half-life,
contains two audited non-obvious fixes), `chain.ts` (custodial deposits/withdrawals; the
sign-record-send-then-ask-the-chain pattern), fail-loud config reader, ws socket hardening.

**Retrofit:** `fairness.ts` commit-reveal ceremony, `db.ts` (~70%, keep the one-transaction
`closeRound` + crash refund sweep — they are one fix, port together), `game.ts` loop skeleton
(~40%, one tick per pass, never a catch-up burst), `net.ts` transport, `invariants.ts`.

**⚠ Rule inversion vs THIN ICE:** ZINC's rule is "movement never draws from the committed
stream" — correct there because bot movement is cosmetic. **In CURSORS movement decides who
collides, so it is outcome-relevant**: all sim-affecting randomness must be deterministic
from committed seed + recorded inputs (`deriveRng(seed, "duel:tick:idA:idB")`,
`"wander:tick:id"`). Iterate collision pairs in canonical order or replay desyncs.

**New work with no ZINC counterpart:** fast binary position channel (~170 B/frame at 15Hz,
absolute positions, never through React), the 2D arena sim, the XP desktop renderer.

**Inherited caveats:** session tokens are bearer credentials at guest trust (play-money
grade); custodial hot wallet is devnet-only by design — mainnet needs hardware key or PDA
escrow (replacement, not hardening); no graceful shutdown.

---

## 9. Memory files (`C:\Users\Attrition\.claude\projects\c--ZINC\memory\`)

`MEMORY.md` is the index. Relevant entries: `project_xp_cursors.md` (this project),
`project_zinc_critical_mass.md` (THIN ICE), `project_economics_findings.md`,
`feedback_fidelity_bar.md` (**carbon-copy mandate — read this**),
`feedback_visual_defaults.md`, `feedback_design_language.md`,
`reference_headless_edge_screenshots.md` (the screenshot loop),
`reference_voidsol_devnet.md` (funded devnet wallets at `C:\Fap_Companion\VOIDSOL`),
`reference_thinice_beta_server.md` (live GCP box for THIN ICE).

---

## 10. Known open items

- Mobile shell (item 1 above) — the arena scales, the chrome does not yet
- Artifact viewer may hand the page a desktop-width viewport on phones; real hosting won't
- `main.js` should keep shedding modules as apps grow (minesweeper/messenger set the pattern)
- Bot/liquidity policy for dead hours needs a disclosed design before real money
- Round timings are feel-tuned, not measured
