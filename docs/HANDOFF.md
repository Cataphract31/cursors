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
- `minesweeper.js`, `messenger.js`, `paint.js`, `explorer.js` — self-contained app modules,
  **import-free on purpose**
  (the build's smoke runner executes them in node; main.js injects assets + shell hooks)
- `assets.js` — every real asset, imported/globbed so Vite inlines it
- `style.css` — everything on top of `xp.css`
- `assets/xp/` — icons (winXP repo, MIT), sounds (2001 XP scheme + MSN 7), emo (80 MSN
  emoticons), mine (Minesweeper sprites), paint (jspaint tool sprites, MIT), wall (Bliss),
  logo (XP flag)
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
BSOD on losing your last cursor, rakeback tracking, autoplay. Every death writes a
certificate (`certify()` in main.js) that the Recycle Bin renders.

**Continuous play (owner-directed, 2026-08-09).** The join→battle→results loop is gone.
The game is one perpetual battle: deploys always open, an UPTIME counter instead of a
round clock, bots hold a live population (target wobbles per epoch). Internal epochs
remain — randomized 110–195s, needed later for commit-reveal seed windows — but the player
never sees a round end: the 12s shutdown rush fires, **everyone banks in full** (the crash
can never cost money), then a 3s XP error dialog ("CURSORS.EXE has encountered a problem")
shows the epoch receipt while the arena does a filter-glitch flicker, and bots pile back in.
Uptime never resets — only CURSORS.EXE crashes, the desktop stays up. Epoch length is
randomized so the crash can't be camped by the clock (camping it = instant-banker strategy,
same EV, fine). Undeploy survives as a misclick window: full refund only while a cursor is
still in spawn grace (it cannot have fought yet, so nothing to game). Autoplay's "per
round" count became "keep live" — a maintained population. Economics untouched.
Dev hash: `#desktop-crash` fast-forwards the first epoch (~9s settle catches the shutdown
rush, ~18.5s the crash dialog, ~27s the recovered arena).

---

## 6. Working practices that matter

- **Screenshot loop.** Claude can see its own UI work:
  `node scripts/shot.mjs <url> out.png [w] [h] [settleMs]` (run from `apps/web`), then Read
  the PNG. It drives Edge over the DevTools protocol with real viewport emulation.
  **Do not use plain `msedge --headless --screenshot` for phone sizes**: on this machine
  headless Edge clamps the window to ~500px wide and steals ~95px of height, so
  `--window-size=390,844` silently renders a 504×749 layout (verified 2026-08-09). The old
  incantation is fine for desktop-sized shots but shot.mjs works for everything.
  `--dump-dom` returns empty on this Edge — paint diagnostics into the page instead.
  **The loop has caught every visual bug so far. Do not skip it.**
- **Dev hashes** (skip boot/login and drive states headlessly): `#desktop`, `#desktop-start`,
  `#desktop-mine-play`, `#desktop-msn`, `#desktop-msn-emo`, `#desktop-msn-toast`,
  `#desktop-amptest`, `#desktop-logfill`, `#desktop-paint` (draws with 6 tools),
  `#desktop-paint-wall` (paints, then sets it as tiled wallpaper), `#desktop-paint-props`,
  `#desktop-exp` + `-c` / `-sys` / `-game` / `-det` / `-props` / `-sysprops`,
  `#desktop-bin` (bin with 9 fixture deaths) + `-cert` / `-hall` / `-det` / `-empty` /
  `-restore`, and `#desktop-binlive` (no fixture — opens the bin and watches it fill from
  real kills; use a 36000ms settle, shot.mjs gives up at 40s).
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

1. ~~Phase M step 2 — the mobile shell~~ **SHIPPED 2026-08-09.** Below 760px (decided once
   at boot, `body.mobile`): apps are full-screen sheets (one at a time, `.fixed` dialogs
   stay centered popups), taskbar is an icon app-switcher, Start is a full-screen launcher,
   the game HUD is a permanent thumb bar (`#mhud`) above the taskbar that sheets never
   cover, long-press = right-click (with Minesweeper flag special-case), single tap opens
   desktop icons, welcome screen stacks vertically. **Portrait phones rotate the arena
   VIEW 90°** (2026-08-09): the sim is untouched — same fixed 1280×800 field, same
   fairness — but shown sideways it fills the screen (~0.49 scale vs ~0.30 letterboxed,
   2.6× more battlefield) instead of a thin strip hiding behind the icon column. Tags,
   floats, duel odds and sprites counter-rotate to read upright (`#arena.rot` rules +
   `AROT` in `syncArena`/`updateTag`; shake/rise keyframes have rotated variants because
   keyframes replace the whole transform). Not yet done: landscape phones (>760px wide)
   still get the desktop shell; real-device pass (iOS Safari keyboard, safe-area) still
   owed before launch.
2. ~~Paint~~ **SHIPPED 2026-08-09.** `paint.js`, import-free sibling module. All 16 real
   tools in the real 2-column box, the real 28-colour palette, tool-options box, 3-deep
   undo (authentic), Image menu (flip/rotate/invert/attributes), drag-drop + File > Open to
   load an image, and **File > Set As Background (Tiled/Centered/Stretched)** — the meme
   machine. Painted wallpaper persists and appears in Display Properties as "Untitled
   (Paint)". Shapes are drawn by a hand-rolled **aliased** rasteriser (Bresenham + midpoint
   ellipse): canvas paths antialias, and antialiased edges instantly stop reading as Paint.
   jspaint is MIT but not on npm and assumes it owns the page, so we vendored its tool
   sprites (`src/assets/xp/paint/`) and wrote the app. Not done: Stretch/Skew (joke error),
   a Fonts toolbar for the text tool, saving into a fake My Pictures.
3. ~~My Computer / Explorer + fake C:\ drive~~ **SHIPPED 2026-08-09.** `explorer.js`.
   Real toolbar, address bar (typed paths work), the blue task pane (System Tasks / Other
   Places / Details), XP's group headings on My Computer, and four view modes
   (Tiles/Icons/List/Details) that persist. The C:\ tree is real: Program Files\CURSORS.EXE
   (rng.dll, house_edge.ini, arena.dll all explain the economics when opened), WINDOWS\
   system32 (hopium.sys, copium.drv, luck.dll — corrupt, of course), Documents and Settings
   with a Desktop folder that mirrors your actual desktop icons, and My Pictures that fills
   with Paint saves. **C: Properties has the pie chart, and the disk fills up with dead
   cursors** (12 MB each) — Disk Cleanup empties the Recycle Bin and gives the space back.
   Right-click My Computer → the System Properties joke box. Folders are functions, so the
   disk answers with live state.
4. ~~Recycle Bin with a purpose~~ **SHIPPED 2026-08-09.** The Bin is not a window any more,
   it is a **path inside Explorer** (`"Recycle Bin"`, parent = the Desktop) — which is what
   XP does, and it meant reusing all the listing/menu/task-pane machinery instead of writing
   a second file browser. Its task pane swaps to **Recycle Bin Tasks** (Empty / Restore /
   **Hall of Pain**), and those three verbs are also in the File menu because the phone hides
   the task pane. Dead cursors are `name_0007.cur` at 12 MB each; deleted desktop files sit
   alongside them and **really do restore** (`deleteIcon` now bins the whole icon object, not
   just its label, so Restore has something to put back). Details view earns bin-specific
   columns: size / killed by / its odds.
   **The certificate is the point.** Every death is recorded by `certify()` at the moment of
   the kill — killer, bounty carried, peak value, kills made, seconds survived, round, and
   `odds` = *the loser's own win chance in that exact collision*. So a cursor that dies at
   92% gets a piece of paper saying it was 92% and lost anyway, and that nothing went wrong.
   That is the honest-casino thesis rendered as a Properties dialog. Hall of Pain sorts the
   whole bin by damage, reds the bad beats (odds ≥ 50), and each row opens its certificate.
   Not done: no full-bin desktop icon (the winXP icon set has only the empty one, and no
   MIT source for the full variant turned up — the desktop icon never changes).
5. ~~CURSORS.EXE production pass~~ **SHIPPED 2026-08-09.** Menu bar (Game/View/Help) and
   five panes: **Play** (the dashboard), **Stats** (session P/L, deploys/banks, lost-to-deaths,
   with the honest footnote: expected P/L is −1% of stake, everything else is variance),
   **Rakeback** (tickets, share, accrued, a working CLAIM button, the 45-day half-life
   explainer), **History** (per-epoch table written at each crash), **Verify** (the fairness
   ceremony: a real random seed is committed via real SHA-256 before each epoch and revealed
   at the crash — honestly labelled: duels still draw browser RNG until the server wires the
   seed in). Also: ×10 banks trigger the **VHS jackpot** (2s full-screen: CSS scanlines, a
   drifting tracking bar, chromatic-aberration ×N, blinking REC + SP counter, gold raining
   through the arena — `jackpot()` + `#jackpot` styles, no libraries; dev hash
   `#desktop-cx-jackpot`), explosions scale with the dead cursor's size, duelists glow red. **BSOD reassigned per owner:** the blue screen
   now belongs to the BIG crash — full carbon-copy NT stop screen (Lucida Console, #0000AA,
   the real paragraph cadence) with the epoch receipt in the Technical-information block.
   Losing your last cursor shows its death certificate instead (suppressed during autoplay).
   **Clean boot per owner:** desktop boots with only CURSORS.EXE open; Messenger/log are one
   click away and toasts/balloons work with them closed. Not done: first-run wizard (clean
   boot made it less urgent), cursor trails (DOM perf risk, skipped deliberately).
   Dev hashes: `#desktop-cx-stats/-rake/-hist/-verify` (stats/hist seed a fixture),
   `#desktop-cx-death` (last-cursor death → certificate).
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

- Mobile: landscape phones get the desktop shell (mode is decided at boot from width <760);
  needs either a smarter detector (pointer:coarse) or a landscape HUD layout
- Artifact viewer may hand the page a desktop-width viewport on phones; real hosting won't
- `main.js` should keep shedding modules as apps grow (minesweeper/messenger set the pattern)
- Bot/liquidity policy for dead hours needs a disclosed design before real money
- Epoch timings (110–195s, 12s shutdown, 5s BSOD) are feel-tuned, not measured
- The crash BSOD takes the whole screen for ~5s every epoch; it is dismissible by
  click/key, but if playtests find it too much, shorten T_CRASH or skip the BSOD when
  the player had nothing in play
