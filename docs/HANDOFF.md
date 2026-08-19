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
| Repo | `C:\CURSORS` (own git repo, branch `main`) |
| App | `apps/web` — npm workspace, Vite |
| Dev | `npm run dev` in `C:\CURSORS` → http://localhost:5173 |
| Build | `npm run build` → smoke test → Vite → `apps/web/dist/` (multi-file; nothing built is committed) |
| Deploy | **Two steps, and pushing this repo is only the first.** The game players actually load is `www.voidsolana.com/cursors/`, which is a *vendored static build* inside `C:\GIELINOR` — not a proxy to any deploy of this repo. So: `npm run build` here, then `cd /c/GIELINOR && node tools/vendor-world.mjs cursors /c/CURSORS/apps/web/dist && git add worlds/cursors && git commit && git push`. That second push is what redeploys the arcade. This repo's own Vercel project stopped deploying on 2026-08-16 and **pushing here alone changes nothing a player sees** — that cost four commits of wallet fixes, live in git and invisible on the site, until 2026-08-19. `tools/vendor-world.mjs` has the reasoning (one origin for the whole arcade = one wallet approval for every game). No committed build output here. **Claude artifacts are deprecated** (owner, 2026-08-09) — do not publish the game as one |
| Server | `server/` — the beta multiplayer server (Node 22, `ws`, node:sqlite). Live at `wss://cursors.34-70-75-204.sslip.io` on the THIN ICE GCP box (separate service/port/host — see `server/DEPLOY.md`). Local dev: `cd server && FAST=1 node server.js`, client hash `#desktop-mp` |
| Sibling repo | `c:\ZINC` = THIN ICE. **Copy from it, never edit it.** |

Source layout (`apps/web/src/`):
- `main.js` (~6000 lines) — shell, window manager, desktop, game sim, boot/login
- `minesweeper.js`, `messenger.js`, `paint.js`, `explorer.js` — self-contained app modules,
  **import-free on purpose**
  (the build's smoke runner executes them in node; main.js injects assets + shell hooks)
- `assets.js` — every real asset, imported/globbed so Vite inlines it
- `style.css` — everything on top of `xp.css`
- `assets/xp/` — icons (winXP repo, MIT), sounds (2001 XP scheme + MSN 7), emo (80 MSN
  emoticons), mine (Minesweeper sprites), paint (jspaint tool sprites, MIT), wall (Bliss),
  logo (XP flag)
- `public/music/` — **the playlist is this folder.** Drop an audio file in and it is in
  Winamp, Media Player and My Music on the next build; nothing to register. Names come
  from the file's own ID3 tags (v2, then v1), falling back to a cleaned-up filename
  ("Artist - Title.mp3" splits; download-site junk, track numbers and `[320kbps]` are
  stripped). The scanner is `scripts/music-plugin.mjs`, wired as a Vite plugin so it
  works in dev and build. `public/` not `src/` on purpose: Vite copies it verbatim
  instead of running every track through rollup. The four Kevin MacLeod CC-BY tracks
  keep their credit in code, not in a strippable tag, and stay pinned first.
- `public/video/` — same idea for clips; Media Player lists them under the music and
  plays them in the visualiser slot. `preload="none"`, no `src` until play.

---

## 3. Economics — LOCKED, do not redesign

- Entry **0.100 SOL fixed** = 0.098 arena + 0.002 house fee (2%), taken at the door
- Duel: **P(A wins) = A/(A+B)** by bounty, winner takes all → every collision is EV-neutral
- **P(ever reaching ×N) = 1/N**, exactly. Variance is chosen by *when you bank*, never by bet size
- **RTP 98%.** The entry fee is the whole edge — nothing is taken from a duel or a bank
- Max 5 cursors per player per round; own cursors never fight each other
- No jackpot — the chain ladder *is* the lottery tail, honestly priced
- Under 2 distinct wallets the round refunds in full, fee included

---

## 4. Design decisions locked

- **Auto-battler, NOT steerable.** Owner reversed steering because same-speed cursors +
  direct control = kiting forever. **Two verbs now: DEPLOY and RECALL** (3s fixed-tick
  bank). ATTACK/DEFEND were cut 2026-08-13 when the food chain landed — DEFEND existed to
  let a small cursor refuse a hopeless fight, and a 4x engagement rule refuses it for them.
- **The food chain (2026-08-13).** A cursor only fights inside **4x** its own size; outside
  that they pass through each other. It decides which fights HAPPEN, never how they resolve,
  so duels are still `A/(A+B)` and the ladder still prices xN at 1/N. Weight classes are the
  visible half: one rank per 4x step (plain / 3D-White / 3D-Bronze / Dinosaur), a real XP
  pointer scheme each, swapped live mid-round. `FOOD_CHAIN`, `canFight`, `tierOf` in
  `server/sim.js`, mirrored in `main.js`.
- **Rounds**: join 10s → battle 60s (shutdown last 12s) → results 6s. **Deploys stay open
  the entire battle** — death is a re-buy prompt, not a bench.
- **The field is sized to the crowd** at each epoch start (~32k px2 per cursor, 16:10,
  capped at 3x), announced with the seed commit and carried in the snapshot and welcome. The
  fairness rule is that everyone in a ROUND shares one field — it was never "1280x800 for
  all time". 1280x800 is now the BASE size, used at low population and offline.
- **Fixed logical arena: base 1280×800 units, scaled to fit.** Not "your window size" — that was
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

**The CRT (2026-08-09).** The whole product is viewed through monitor glass: `#crt`, a
fixed overlay above everything including the BSOD — phosphor triads, static scanlines
(rolling = VHS, static = CRT), a drifting mains-hum band, glass glare + corner vignette,
black rounded tube corners, and a 7s micro-flicker. All static composited layers, no
filters on live content, ~zero frame cost. Phones drop the phosphor (hiDPI moiré) and
lighten the lines. **Degauss** (a 0.9s filter wobble on body) fires at logon, after every
BSOD, and when the toggle is switched on. Toggle lives in Display Properties → Appearance
→ "CRT glass", persisted as `store.data.crt` (default ON), `body.crt-off` kills it.

**Internet Explorer — REMOVED 2026-08-12 (owner decree).** `ie.js` (1029 lines), cursorTV
and its YouTube iframe API, MSN Search, Windows Update, the dial-up modem fiction and
Favorites are all gone, along with ~250 lines of markup, ~95 lines of CSS and the server's
whole TV engine (deck rotation, skip votes, duration reporting). The three pages that held
real player content — **hall of fame, guestbook, gallery** — are now three plain XP windows
in `netpages.js` (~110 lines), fed by the game socket that always carried their data. They
sit in All Programs, on the Links bar, and Hall of Fame is the pinned top-left Start item
where Internet Explorer used to be. There is no browser and no `fetch` to any third party
left in the client.

**LIVE MULTIPLAYER BETA (2026-08-09, owner-directed).** The game is now server-
authoritative: `server/` runs the same sim (a faithful port of main.js's rules — same
movement, same a/(a+b) duels, same fees) as the single authority over every balance.
Play money: every visitor gets 5.000 SOL, a beta faucet refills anyone who busts, the
7 bots play server-side as full economic participants. The client becomes a display
when connected (deploys/recalls are requests; positions arrive as 10Hz snapshots,
lerped client-side; deaths/banks arrive as events and reuse the solo FX paths verbatim) and
falls back to the untouched offline sandbox when the server is unreachable — dev hashes
always stay offline, `#desktop-mp*` forces localhost, `?arena=` overrides. Names are
server-unique (welcome may rename you), identity is a bearer token in localStorage
(`store.data.mpToken`), balances persist in sqlite. Pot conservation is asserted at every
crash (`INVARIANT VIOLATION` in the journal if it ever breaks — it hasn't).
**Epochs now end when the disk fills, not on a timer** (the owner's design): every death
writes a 12 MB corpse; at 64 corpses (`CORPSES` env) C: is full and the system BSODs —
everyone banked in full first, receipt in the stop screen, corpses archived, restart. The
fill % lives in the CURSORS.EXE header, the tray chip, and Explorer's real C: pie chart.
Shutdown rush fires 6 corpses before full (12s cap so an empty arena still crashes). A
predictable crash is exploit-free because the crash banks everyone — forcing it early just
pays the room at fair odds. **The RNG is honest now:** every epoch's sim randomness draws
from one sfc32 stream (ZINC's audited generator, ported); sha256(seed) is committed at
epoch start, revealed at the crash, and the Verify pane says exactly what is and isn't
provable yet. Also live on the wire: the **lobby is real chat** (Messenger's "everyone"
window, server-echoed, bot chatter muted online), the **guestbook is global**, and Paint has
**File > Publish to Gallery** (server-hosted, latest 16). Guestbook and Gallery are their
own windows since the browser was removed — see the IE entry above. cursorTV is gone.

**Egress, the real constraint on a free tier (2026-08-09).** GCP always-free gives 1 GB
of North-American egress a month. Uncompressed JSON snapshots measured **10.9 MB per
player-hour** — the whole allowance in 92 player-hours, and worse on a busy arena. Two
fixes: **permessage-deflate** on the socket (snapshots are extremely repetitive; measured
**3.9×**, windowBits dialled to 13 so 20 zlib contexts do not matter on a 1 GB VM), and
**snapshots are not sent to hidden tabs** at all — the client reports `visibilitychange`
and gets a full `resync` when it comes back, because a backgrounded tab cannot draw a frame
but must not miss a kill. Result: **0.89 KB/s = 3.3 MB per player-hour, ~305 player-hours
per free GB**, and an idle open tab now costs essentially nothing. Overage beyond the free
tier is about $0.12/GB, so this is a cost curve, not a cliff. Measure it again with
`node /tmp/measure2.mjs`-style probing on `ws._socket.bytesRead` — **not** on the message
payload length, which reports decompressed bytes and will tell you compression is not
working when it is.

**Netcode, measured not guessed (2026-08-09).** Reported instability was diagnosed
before it was touched: the box showed zero restarts, 33 MB of a 230 MB budget, load 0.03,
and the wire showed p50 100ms cadence with a flat 152ms RTT — hosting, the free tier and
file size were all innocent. Three real defects, all ours: the client chased positions with
an exponential filter (velocity ∝ error, so it pulsed at the packet rate); the sim ticked at
50ms while snapshots went at 66ms, so each snapshot caught one step of movement or two,
alternating (**rate aliasing**, worth 33% speed variance on its own); and the interpolator
read `performance.now()` instead of the frame's rAF timestamp, folding our own per-frame
workload into rendered position. Now: fixed 30Hz timestep with the snapshot emitted from
inside the loop every second step (a true, even 15Hz), snapshots stamped with **sim** time
and mapped to the client clock by a min-delay filter, and real snapshot interpolation
rendering 110ms in the past between two real samples. Median speed variance **34.3% → 6.4%**
against a 0.4% browser floor (`#desktop-mp-smooth` reports both). A dropped socket now shows
RECONNECTING and holds for 7s before falling back to the sandbox.

**Start menu completeness + Help (2026-08-09) — roadmap item 7 done.** The left column
below the pinned pair is a real **most-recently-used list** (persisted in `store.data.recent`,
promoted by `openWin`), which is what XP actually did. All Programs grew the real roster:
Accessories with Accessibility/System Tools submenus (Disk Cleanup and System Information
open the real windows), Games, Startup, Help and Support, Windows Update. And there is a
real **Help and Support Center** (`win-help`) in XP's blue-header two-column shape, with
Back/Home/Search — seven topics that state the game plainly and without jokes: what it is,
the odds (with the 1/N table and the −2% expectation stated outright), why the computer
crashes, the multiplayer beta and its bots, how to check the commit-reveal, the
certificates, and the rest of the desktop. It quotes the live disk fill. This is the
first-run explanation the game never had.

**The disk gauge, and rounds that actually last (resized 2026-08-09).** The drive is
**20 GB** (what an XP box shipped with) and an epoch's corpse budget is **900** deaths —
`CORPSES` in the systemd unit, so it is one edit on the box. Measured death rate is ~25/min
at bot baseline, so an epoch runs **~36 minutes** instead of the 2.8 it did at 64 corpses.
Two things had been keeping rounds short: the budget itself, and a bug where the shutdown
rush started at `CORPSES/10` remaining and then hit its 12s cap immediately, crashing the
epoch with most of the disk still free. The rush margin is now a small fixed number of
corpses (6), so the rush is a short dramatic window and the disk really does decide.
The gauge under the menu bar shows the drive's **real occupancy** — it starts around 47%
(Windows and the apps) and the round ends exactly when it reaches 100% — with
`C: 52% full · 79/900 dead cursors · 9.62 GB free`, amber at 70% of the budget and pulsing
red at 92%. The tray chip, the gauge and Explorer's C: pie chart all read from one
`diskPct()` so they cannot disagree. **The offline sandbox ends its rounds the same way**
(`LOCAL_CORPSES`), so a disconnected player is not playing a different game.

**Real players are visible.** The Messenger buddy list leads with **Players in the arena**
— everyone actually connected, pushed by the server on every join/part — above a group
labelled *Bots (they play for real money too)*. Knowing whether anyone else is in the lobby
is the most useful thing a multiplayer beta can show, and the bots stay honestly labelled.

**The game** — deploy/recall, duels with odds display, gold bursts, kill streaks,
BSOD on losing your last cursor, autoplay. Every death writes a
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

- **Security headers, and the harness that keeps them honest** (added 2026-08-11). The site
  used to serve none — no CSP, no framing rule, no HSTS, no nosniff. The framing gap was the
  live one: with nothing forbidding it, anyone could load the real game in an iframe on their
  own domain and float their own buttons over it, and the player would see the real game at
  the real address. The full set now lives in the root `vercel.json` under `source: "/(.*)"`.

  A CSP is the one header that can break the site it protects, and it breaks it *silently for
  whoever wrote it* — your browser has the stylesheet cached, so you see a working page while
  a first-time visitor gets unstyled HTML. So `npm run csp` (root, or `apps/web`) serves the
  real `dist/` under the headers **parsed out of `vercel.json` itself** — the policy under
  test cannot drift from the policy that ships — drives it in headless Edge, and fails on any
  violation. It covers the cold boot and login, the live `wss://` game socket, Winamp's
  data:-URI skin, the Solitaire iframe, and a second origin trying
  to frame the game. Currently: **0 violations, 0 blocked requests.**

  Two things it caught that would otherwise have shipped broken:
  - `frame-ancestors 'none'` also blocks the app framing *itself* — it killed Solitaire. The
    correct value is `'self'` (with `X-Frame-Options: SAMEORIGIN`), which still refuses every
    foreign origin. Pass 3 proves that refusal rather than assuming it.
  - Webamp's dependencies ship three `eval`/`Function("return this")` calls. They are inert in
    a browser, but they trip `script-src`. `scripts/postbuild.mjs` rewrites each to the value
    it already resolves to, so the report stays at zero without `unsafe-eval` in the header.
    Anything eval-shaped it does *not* recognise is left alone and warned about.

  Two gotchas if you touch the harness: it must serve from a **non-loopback hostname** (it maps
  `cursors.csptest` via `--host-resolver-rules`), because `mpUrl()` returns a null socket on
  `localhost`/`127.` and the whole multiplayer and YouTube half would go untested while still
  looking green; and the YouTube leg depends on a third party that sometimes does not answer
  inside the 12s the app allows, so the harness fails only on actual CSP evidence and otherwise
  reports that leg **UNVERIFIED** rather than crying wolf.

- **Media.** ffmpeg 9.0 is installed (winget `Gyan.FFmpeg`) — use it before adding any
  audio or video. Two gotchas: winget's downloader failed once with an `InternetOpenUrl`
  error and worked on a plain retry, and a fresh shell is needed for PATH. Social
  re-uploads are routinely encoded at ten times the bitrate they need; the meme clip was
  VP9 at 1.1 Mbps for a 320x240 picture and went 5983 KB -> 1087 KB at CRF 40 / cpu-used 0
  with no visible difference. Compare frames at the real display size before choosing a
  CRF — at 320x240 even 43 looked fine, and the extra 120 KB was not worth the risk.

- **Rules tests.** `npm test` in `server/` — 20 tests against the real sim, whole epochs in a
  quarter of a second (the harness fakes `Date.now` forward one step per tick). They cover what
  the mobile audit structurally could not: recall orders honoured from every state a cursor can
  be in, money conservation per duel and per epoch, one fate per cursor, orders from a retrying
  or unknown socket, and the rush and crash boundaries. `SIM=<path> npm test` points the suite
  at another copy of `sim.js` — that is how you check a new test actually fails against the
  build that had the bug, which is the only thing that makes it a test.
  **Two lessons paid for in flakes, both of them the test's fault and not the sim's:** a recall
  is killable, so a cursor can win a fight on its way out and bank *more* than it cost (never
  assert a recall loses money, or that it banks at all); and a gliding cursor can be caught in a
  chain of duels, so it legitimately outlasts any fixed deadline — assert "not roaming again",
  never a stopwatch.

- **Client/server agreement.** `node scripts/agree.mjs [secs]` (from `apps/web`) boots its own
  `FAST=1` server and vite, wraps `WebSocket` before any page script runs, and builds the
  server's truth from inbound frames *only* — so the app cannot agree with itself, it has to
  agree with the wire. Then it plays and compares wallet, strip ids, per-slot bounty and live
  count, reporting only disagreements that persist past 2s (the wallet counter animates; a
  number mid-roll is not a lie). This is the harness for the whole "the bar is stale / lit /
  lying" family. `FLAP=1` kills the live socket every 12s and lets the client's backoff
  reconnect — where the stuck "recalling…" latch lived. **`SELFTEST=wallet|strip` plants a
  deliberate lie and the run must come back FAIL**; a detector nobody has seen fail is not
  evidence. Note CDP's offline emulation does *not* disturb an already-open WebSocket — an
  earlier version "passed" 4 drops that never happened, which is why the run now aborts if the
  drops produced no reconnect.

- **Screenshot loop.** Claude can see its own UI work:
  `node scripts/shot.mjs <url> out.png [w] [h] [settleMs]` (run from `apps/web`), then Read
  the PNG. It drives Edge over the DevTools protocol with real viewport emulation.
  **Do not use plain `msedge --headless --screenshot` for phone sizes**: on this machine
  headless Edge clamps the window to ~500px wide and steals ~95px of height, so
  `--window-size=390,844` silently renders a 504×749 layout (verified 2026-08-09). The old
  incantation is fine for desktop-sized shots but shot.mjs works for everything.
  `--dump-dom` returns empty on this Edge — paint diagnostics into the page instead.
  **The loop has caught every visual bug so far. Do not skip it.**
- **Sweep.** `node scripts/sweep.mjs` (from `apps/web`) is the same driver in bulk: every
  state x every size, one browser, one PNG per pair, one line of summary each. Defaults are
  the eight core states against **1280x800, 1024x768, 390x844 and 844x390** — landscape is a
  first-class size, a large share of the mobile audit's findings lived there. Override with
  `--states desktop-ie-hall,desktop-bin --sizes 844x390 --out DIR --settle 6000`; output goes
  to a temp dir unless `--out` says otherwise. It seeds `localStorage` with `{"tourSeen":1}`
  before the document runs (or the How to Play card covers every shot) and clears storage on
  each new document, so a state that writes to disk — `-paint-wall` sets the wallpaper — cannot
  leak into the next shot.
- **Dev hashes** (skip boot/login and drive states headlessly): `#desktop`, `#desktop-start`,
  `#desktop-mine-play`, `#desktop-msn`, `#desktop-msn-emo`, `#desktop-msn-toast`,
  `#desktop-amptest`, `#desktop-logfill`, `#desktop-paint` (draws with 6 tools),
  `#desktop-paint-wall` (paints, then sets it as tiled wallpaper), `#desktop-paint-props`,
  `#desktop-exp` + `-c` / `-sys` / `-game` / `-det` / `-props` / `-sysprops`,
  `#desktop-mp` (LIVE local server at `ws://localhost:8788`; + `-play` / `-chat` /
  `-buddies` / `-tv` / `-gal` / `-guest` / `-smooth` for the netcode probe),
  `#desktop-help` (+ `-odds` / `-disk` / `-verify` … any topic key),
  `#desktop-allprog`, `#desktop-start-mru`,
  `#desktop-ie` (+ `-odds` / `-hall` / `-guest` / `-ring` / `-mumu` / `-deg` / `-bobo` /
  `-404` / `-search`, plus `-dial` for the Connect box, `-dialgo` for the handshake in
  progress, `-src` for View > Source into Notepad, and `-post` which really signs the
  guestbook), `#desktop-bin` (bin with 9 fixture deaths) + `-cert` / `-hall` / `-det` /
  `-empty` / `-restore`, and `#desktop-binlive` (no fixture — opens the bin and watches it fill from
  real kills; use a 36000ms settle, shot.mjs gives up at 40s).
- **Smoke test** runs before every build: executes `main.js` in node under a stub DOM,
  catching strict-mode and load-time crashes. Sibling modules run for real, so keep them
  import-free.
- **Mobile check**: `--window-size=390,844`. Mobile is expected to be the majority playerbase.
- Commits: one-line summary in plain language saying what changed and why, then detail.
  End with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Owner plays every build — commit and push,
  Vercel redeploys automatically. Say what to look at. Do **not** publish Claude artifacts.
- **The build is multi-file, and that is deliberate** (changed 2026-08-09 once artifacts
  were dropped). It used to be one inlined HTML file because the artifact host demanded it,
  which meant 8.7 MB gzipped on every first visit — 82% of it audio that base64 inflated and
  gzip could not compress. Now: small assets still inline into the JS/CSS (~130 icons, 80
  emoticons), the MP3s and WAVs are real files fetched only when something plays them, and
  content-hashed filenames + `vercel.json` cache headers make redeploys re-download almost
  nothing. First paint ≈ **0.5 MB gzipped**. Do not reintroduce `vite-plugin-singlefile`.
- Testing the shipped folder needs a **web server**, not `file://` — ES modules are blocked
  by CORS on file URLs. `cd apps/web/dist && python -m http.server 8099`, then point
  shot.mjs at `http://localhost:8099/index.html`. Add `?arena=off` for the offline sandbox
  or `?arena=wss://…` to aim at a server. It was `?server=` until the arcade's wallet was
  vendored in: `src/arcade/origin.js` reads that name for the MONEY origin and persists it,
  so the arena's override was renamed rather than left one typo away from redirecting
  deposits. See mpUrl() in main.js.

---

## 7. Remaining roadmap, in the owner's priority order

**Owner directive: visible + fun first.**

**REVERSED 2026-08-09 (late).** The owner now wants exactly the parked list, built properly:
*"your pending tasks should be OS and shit related... CMD, gpedit.msc, services, device
manager, control panel etc. all usable and exists, carbon copy of XP, high in-depth not
slop looking."* Also named in the same message: **YouTube embedded in IE, async, with
takeover/queue like plug.dj**, and **Paint pictures saved async and served to every player**
behind an anti-spam / anti-sybil gate (a cooldown, or one publish per N deploys). And again,
in the owner's words: *"not your shitty ass designed 'retro' websites thats not funny"* -
the handmade web stays as it is; do not add pages to it.

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
   keyframes replace the whole transform).
   **Landscape phones + the shell detector, 2026-08-09 (late).** The shell used to be
   picked from `innerWidth<760`, so a phone lying down (844px) fell through to the desktop
   shell — unusable with a thumb. It now asks about the DEVICE: `pointer:coarse` plus the
   *short* side of `screen` under 600px (widest phone ≈440, narrowest tablet ≈744, so a
   tablet keeps the real desktop it has room for). A narrow desktop *window* still gets the
   phone shell at <760, because that is how the phone shell gets tested. The short side does
   not change when you rotate, so the shell can never flip underneath a running game.
   **`body.mobile.land` is the landscape shell**: lying down, height is the scarce axis, so
   the thumb bar stands up as a 112px right rail (`--hud:0px; --rail:112px`) with the info
   stacked at the top and the four verbs on a 2-column grid pinned to the foot of the rail.
   Everything downstream reads `--rail`, so the desktop area, sheets, the Start launcher and
   the balloon all stop at it. Icon cells shrink on the phone (68×72 vs 84×86) and re-flow on
   rotate — only when the row count actually changes, because iOS fires `resize` on every
   URL-bar nudge. **Behind a full-screen sheet the arena drops to 16% opacity** (`body.mobile.sheeted`,
   synced in `renderTaskbar`): cursors crawl over every window by design, but over a Stats
   table on a phone that is just noise.
   **Safe area + keyboard, same pass.** `--sal/--sar` (notch) join `--sab`; the taskbar pads
   to them and `#icons` shifts, while the arena stays centred (it letterboxes anyway).
   `mobKeyboard()` watches `visualViewport` — iOS never announces the keyboard, it just
   shrinks the visual viewport under a layout that still thinks it owns the screen — and
   publishes `--kb`; `body.mobile.kb` hides the taskbar and HUD and ends the desktop at the
   keyboard, so every sheet's own bottom row lands above it. Focusable text fields go to 16px
   on the phone so iOS stops zooming the page on tap. **The keyboard path is reasoned, not
   yet run on hardware** — a real-device pass is still owed.
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
   **The bin icon is a gauge, 2026-08-09 (late).** The vendored winXP set only has the empty
   bin and no MIT source for the full variant turned up, so the paper is drawn on top: each
   discarded sheet is a tilted rounded rect with one crease, which is all XP's own full bin
   amounts to at 32px. `icoNode("bin32"/"bin16")` returns `<span class="binico"><img><svg>`
   and `syncBinIcon()` (called from `renderDisk`, so it rides the same single source of truth
   as the bar, the tray chip and Explorer's pie) swaps the level: one sheet under 35%, two
   under 80%, three plus one spilling over the rim above that. An emptied bin reads empty
   even while the drive stays full, because in multiplayer the drive is not yours to empty.
   Every surface that asks `icoNode` for a bin gets it — desktop, My Computer, the task pane.
   Dev hash: `#desktop-disk-<pct>`.
5. ~~CURSORS.EXE production pass~~ **SHIPPED 2026-08-09.** Menu bar (Game/View/Help) and
   four panes: **Play** (the dashboard), **Stats** (session P/L, deploys/banks, lost-to-deaths,
   with the honest footnote: expected P/L is −2% of stake, everything else is variance),
   **History** (per-epoch table written at each crash), **Verify** (the fairness
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
   Dev hashes: `#desktop-cx-stats/-hist/-verify` (stats/hist seed a fixture),
   `#desktop-cx-death` (last-cursor death → certificate).
6. ~~IE + handmade web~~ **SHIPPED 2026-08-09.** See §5. The load-bearing page is
   `cursor.land/odds.html`: the whole fairness argument, in the ugliest possible clothes,
   one click from the arena — and MSN Search deliberately promotes it above every page that
   claims to have a system. Not done: no Favorites *editing* (Add to Favorites is a joke
   box), no cookies gag, no IE-specific right-click menu, and images are CSS rather than
   period GIFs (no MIT-clean animated set turned up).
7. ~~Start menu completeness~~ **SHIPPED 2026-08-09.** See §5. Not done: no Search
   Companion window (still a joke box), no per-app jump lists (XP had none either).

**Owner direction (2026-08-09 evening) — ALL SHIPPED same night, see §5:** live
multiplayer beta (server-authoritative, play money, bots as liquidity floor), disk-full
epochs, global guestbook + gallery, cursorTV watch-together.
- **Content note, standing:** owner explicitly does not want more AI-authored joke copy
  filling surfaces (called the IE fake-web text "AI slop"). Keep authored gag text
  minimal; prefer real systems and real player content over pastiche.

**What is left, in order** (owner, 2026-08-09: *"we dont care about simulations, or audits
or economics until the design is fully done"* — finish the product first, prove the money
second):
0. ~~**The XP applications track**~~ **SHIPPED 2026-08-10.** `apps/web/src/sysapps.js`
   (import-free sibling, ~900 lines). **cmd.exe** is a real interpreter over the same
   `TREE` Explorer walks (`explorer.list(path)`): cd/dir/tree/type resolve real paths and
   real sizes, plus ver/vol/date/time/echo/color/cls/hostname/ipconfig/ping/systeminfo/
   tasklist/taskkill/net start/sc query/start, and the game as commands — `ARENA`,
   `ARENA /LIST`, `ARENA /DISK`, `CURSOR /DEPLOY|/RECALL|/LIST`. Destructive verbs
   answer "Access is denied." Keyboard comes through a hidden input so a phone raises its
   on-screen keyboard and `--kb` lifts the window. **Control Panel** has XP's category view
   (eight categories, task lists, blue side pane) and classic view, persisted; applets open
   the real dialogs. **Services** is split in two tiers and the line between them is
   load-bearing: `local:1` services touch only your own machine (audio, themes, toast
   notifications, the tray clock, spooler, scheduler...) and you may stop them; everything
   the house owns — the Arena service, the fairness provider,
   Plug and Play, RPC, Event Log — refuses with the real error ("Could not stop the X
   service on Local Computer. Error 5: Access is denied.") and greys its properties sheet.
   **This was corrected the same day after an owner catch and the reasoning matters:** the
   first version let you stop a house service and logged a changed house edge while it was
   stopped, which was *false* (the server owns all of it) — a lie told to a gambler about
   their own edge. A switch that appears to change the economics is a trust bug even when it only
   deceives the person who flipped it, and one that really changed them would be an
   exploit. Rule for anything added to these consoles: **local presentation only, never
   shared state and never anything that reads as economic.** Same rule for Group Policy —
   every setting there is user-scoped and reversible, and every one of them is true (no
   setting claims an effect it does not have). **Device
   Manager**'s "Mice and other pointing devices" are the live cursors, refreshed while
   open, with per-device Properties. **gpedit.msc** has real policy folders and the
   settings apply (CRT off, mute, hide desktop icons, remove Run, remove clock, no
   balloons, prohibit autoplay, always show duel odds, prevent cmd). One shared properties
   sheet, MMC chrome shared by all three consoles. Dev hashes: `#desktop-sys-cmd`,
   `-control`, `-classic`, `-svc`, `-svcprops`, `-dev`, `-gp`, `-gpprops`.
   Of the two items the owner named in the same breath, the **Paint gallery served to
   everyone** shipped; **cursorTV** shipped and was then removed with the browser
   (2026-08-12, owner decree) — do not propose it again.

1. **The XP applications track — the owner's current priority.** Carbon copies, in depth:
   **Control Panel** (a real applet grid, not a joke box), **cmd.exe** (a real interpreter
   over the C:\ tree `explorer.js` already models — dir/cd/type/echo/ver/tree, plus the
   game's own state as commands), **services.msc**, **Device Manager**, **gpedit.msc**.
   Then **the Paint gallery served to everyone** behind a non-sybillable gate. (cursorTV
   was also on this list; it shipped and was removed with the browser on 2026-08-12.) `explorer.js` models the filesystem as functions, which is the right
   substrate for cmd and Device Manager to read from.
1. **Design/UX still owed** — a real-device pass on a phone (the keyboard path above is
   unverified on hardware), Paint's Fonts toolbar and Stretch/Skew, IE Favorites editing and
   an IE-specific right-click menu.
2. **Prove the invariants offline** — the server asserts pot conservation every crash, but
   nothing yet proves EV per deploy = stake × 0.98 for *every* strategy (hunter, camper,
   instant banker, chain rider, autoplay). This is how THIN ICE caught its wipe leak, and
   it is the last thing between the beta and real money. **Parked by the owner until the
   design is done — do not start it unprompted.**
3. **Bot/liquidity policy disclosed** before real money — the buddy list labels them now,
   but the written policy is still owed.
4. Then: Phantom wallet at the login tile, real custody, real DMs.

**Parallel engine track (blocks real money, not UI):** port THIN ICE's sim skeleton and
**prove the invariants** — pot conservation, and EV per deploy = stake × 0.98 for *every*
strategy (hunter, camper, instant banker, chain rider, autoplay). This is how THIN ICE
caught its wipe leak. Then: server, Phantom wallet connect at the login tile, real DMs.

---

## 8. THIN ICE reuse (full detail in `docs/reuse-from-thinice.md`)

**Copy as-is:** `rng.ts` (audited 128-bit seed → sfc32, tagged sub-streams),
`chain.ts` (custodial deposits/withdrawals; the
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

### Search Companion — SHIPPED 2026-08-10
`apps/web/src/companion.js` (import-free) + a search mode in `explorer.js`. **The real Microsoft Agent characters**, vendored out of
`clippyjs` (MIT wrapper around the original `.acs` sprite sheets) by
`scratchpad/extract.mjs`: base64 -> real PNG, animation table -> JSON with sound refs
stripped. Six ship — Rover (80x80, 29 animations), Merlin, Clippy, Links, Genie,
BonziBUDDY — in `src/assets/xp/agent/`, ~5.7 MB, **routed to `media/` in vite.config so
they stay out of first paint** (2.42 MB) and load only when a character is shown. The
player honours frame durations and the sheets' weighted branch tables, which is what makes
an idle character look alive instead of looped. Moods map to whichever animation each
character actually has (`hunting` -> Searching/Search/Thinking/Process...).

**Correction, 2026-08-10:** the first version of this was hand-drawn SVG, on a
"no copyrighted art" rule I invented. The documented line is **music only** ("no shipping
copyrighted *music*", §4) and the project already ships Bliss, the XP sound scheme, the XP
icon set and MSN emoticons. Owner's verdict on the drawings was blunt and correct: an
approximation of Rover is not Rover, and recognition is the entire value. **Rule: use the
real asset; hand-recreating a recognisable thing is the failure mode** — the same note the
owner has now given three times. The chooser (`win-companion`) is XP's "choose your companion" dialog
and the pick persists.
The search is **real**: `walk()` is depth-first over the same `childrenOf()` that the
address bar, the listing and cmd.exe read, so it finds exactly what is on the disk — and
dead cursors are findable **by owner and by killer**, which is the only search anyone runs
twice. Four scopes (dead cursors / documents / my losses / everything). Opens from Start >
Search, Explorer's Search button, and **F3**. Verified: searching "dll" returns arena.dll,
rng.dll, kernel32.dll, luck.dll, shell32.dll with real sizes. Dev hashes: `#desktop-dog`,
`-found`, `-empty`, `-pick`.

## 10. Known open items

**Playtest fixes, 2026-08-09 (late) - all from one owner session on a phone:**
- *"cursors stuck and bugged around top... on top of each other so realistically they should
  be fighting but not"* - they were **same-owner** cursors, which by design never duel, and
  `centroid()` was actively pulling them onto one pixel. Own cursors now hold a 34px personal
  space (repel inside it, regroup beyond 90px). Over three sim-minutes, stacked pairs per
  frame went **0.52 -> 0.03**, excluding legitimate 700ms duel freezes.
- *"stuck around top"* - the edge margin was 30px with a weak 4.5 rad/s turn, so anything
  chasing a cursor pinned to a wall slid along it for seconds. M=64, turn 7, and the hard
  clamp moved from 6px to 24px inside the field. Edge-hugging cursor-frames **1.31 -> 0.32**.
- *"me and another cursor just draw circles in a loop"* - turn radius is speed/turn-rate:
  ~100px/s at 2.6 rad/s is a 38px circle and contact needs 20px, so an attacker could orbit
  its target forever. Inside 130px the turn rate triples, so a hunt terminates. Duel odds are
  untouched, so EV does not move. Kills went **45.7 -> 48/min**. *(The +12% chase / -10% flee
  pair that shipped alongside this was removed 2026-08-13 with the stances — with nobody
  fleeing it was a bonus everyone held at once.)*
- *"i seem to always deploy from the same place"* - correct, and it was the same place for
  every player: humans spawned in a 120px band at bottom-centre. The edge is sampled properly
  now and the emptiest of eight candidates wins. *(Superseded 2026-08-13: every human still
  spawned along the BOTTOM edge, which put 87% of the field and 96% of all deaths in the
  bottom quarter. Each player now draws a taskbar edge per epoch and recalls out through
  the same wall.)*

**Arena rules, 2026-08-13 — the food chain (see §4):**
- Cursors only fight inside **4x** their own size, so a fresh deploy cannot be eaten by a
  whale and a whale has to find something its own size. Farming of fresh deploys 83% -> 0%.
- **Weight classes**: one rank per 4x step, each a real XP pointer scheme, swapped live
  mid-round. Rank steps are 4x *because* that is the rule's reach — 2x ranks were tried and
  reverted, since a step that does not line up with the rule is just a colour change.
- **Stances removed.** DEPLOY and RECALL are the only verbs now.
- **Spawn edges** per player per epoch, drawn from the epoch seed; recall exits the same wall.
- **The field scales with the crowd** (~32k px2/cursor, 16:10, cap 3x), announced with the
  seed commit and carried in the snapshot and welcome.
- Cursors grow harder: `s = min(4, 1 + .5*log2(m))`, was `min(2.6, 1 + .35*log2(m))`.
- Measured no-ops, do not re-propose: a winnings cap (whales are fungible — retire one and
  the next grows into the vacancy) and a stronger fat-is-slow penalty.
- Tooling: `scripts/tourshot.mjs` clips a capture to an element box (How to Play slides) and
  does mid-session `ROTATE=WxH`. Dev fixture `#desktop-ranks` stages the weight-class chart.
- **xp.css draws checkboxes through an ADJACENT label** (the input is `position:fixed;
  opacity:0`). Every checkbox in this app is wrapped *inside* its label, so all of them had
  been rendering as bare text with nothing to tick - "Save this user name and password", the
  CRT toggle, DST, Mute. Fixed once, globally, with a `label>input[type=checkbox]` rule.
- The `"max live"` deploy rejection was balloon-ed, so a fast double-tap produced a stream of
  "beta server" notifications about something the button already shows. No longer sent.
- Bots do not talk when the server is live (`netLive` -> messenger `quiet()`): no lobby
  chatter, no 1:1 replies, no status drift. A DM to a bot says once that it is a bot.
- The arena has a visible frame (`#arena:before`), so the fixed 1280x800 field reads as a
  field rather than cursors wandering off under the taskbar.
- Tray: the speaker opens XP's **volume flyout** (slider + Mute), which is the master gain
  for every sound and persists. The clock's **Time Zone** tab is real - it reads the machine's
  zone through `Intl` and lists live world times, replacing a grey box reading "map data went
  home". Dev hashes: `#desktop-vol`, `#desktop-clock`, `#desktop-clock-tz`.
- Phone dialogs measure the desktop at fit time instead of trusting a cached height, and
  scroll their own body rather than putting their buttons below the fold.

- Mobile: the phone keyboard path (`--kb`, `body.mobile.kb`) is written from the spec and
  has never run on a real iPhone — first real-device pass should start there
- Artifact viewer may hand the page a desktop-width viewport on phones; real hosting won't
- `main.js` should keep shedding modules as apps grow (minesweeper/messenger set the pattern)
- Bot/liquidity policy for dead hours needs a disclosed design before real money
- Epoch timings (110–195s, 12s shutdown, 5s BSOD) are feel-tuned, not measured
- Multiplayer beta caveats: session identity is a bearer token at guest trust (play-money
  grade, same as THIN ICE's); the e2-micro box runs both betas (cursors capped at 220MB);
  epoch pace at CORPSES=64 is
  feel-tuned, not measured — tune via systemd env
- The dial-up ceremony is ~8s and runs once per session, on the first navigation. Charming
  the first time; if playtests find it tiresome, shorten it or remember "connected" in
  `store`
- A CSS class collision cost an hour here (`.pop` was already the death-burst FX and it
  dressed the IE popup up as a 34px fading circle). Same family as the old Webamp
  `.window` bug — **namespace new page-level classes**
- The crash BSOD takes the whole screen for ~5s every epoch; it is dismissible by
  click/key, but if playtests find it too much, shorten T_CRASH or skip the BSOD when
  the player had nothing in play

## 11. The XP-fidelity sweep (2026-08-10, one session)

The full plan is `docs/xp-fidelity-plan.md`; phases 0–6 shipped in order, one commit each:

- **Menus** (`aecfcf3`): XP's real desktop/icon/Explorer/IE/text-field/tray/Start menus —
  Desktop Cleanup Wizard, Create Shortcut wizard, shell clipboard with Undo Delete,
  Send To with the never-ready floppy, keyboard-driven Move/Size, edit menus with the
  Insert Unicode submenu, menu accelerator column + keyboard walking + submenu delay.
  The volume flyout capture-listener bug (closed on slider grab) is fixed.
- **Cursors** (`3928785`): the complete real XP cursor set vendored (184 .cur/.ani,
  bartekl1/windows-ui-assets — 3D-Bronze is the gold one). Mouse Properties, all five
  tabs; runtime .ani player; pointer trails; Ctrl locate ripple. **The scheme rides the
  wire**: server stores `p.skin`, spawns carry it, whole lobby renders your arrow.
  Bots have schemes. Scheme table is registry-verified for Standard/Black/Inverted/
  Magnified (read from this machine's real `Schemes` key); XP-only novelty schemes are
  composed from the exact files XP shipped for them (best-evidence pairing).
- **Screensavers** (`93da21e`): savers.js — 3D Pipes (raw WebGL, default), FlowerBox,
  Flying Objects, 3D Text, Mystify/Beziers (exact), Marquee, Starfield, Windows XP,
  My Pictures Slideshow (shows Paint saves + the lobby gallery). Per-saver Settings
  dialogs; the monitor preview runs the real savers.
- **IE** (`677c57b`): fiction sites demolished per owner decree. Home = cursorTV.
  Real Favorites editing (Add/Organize), Explorer bar panels, Internet Options with the
  Advanced tree (Show pictures works), Find, Text Size, autocomplete, items-remaining
  status. cursorTV: live skip-vote count, watching count, real video title, ducks to 14%
  while a duel is on screen. Server `tvMsg` now carries `skip:{n,need}`.
- **Paint** (`86c9ed1`): Fonts toolbar (family/size/B/I/U, underline drawn onto the
  bitmap), real Stretch/Skew, Copy To/Paste From.
- **Shell depth** (`a2de1ed`): Alt+Tab box (Ctrl+Tab drives it — the OS eats the real
  chord), restore zooms out of the taskbar tab, tray chevron hides idle icons,
  F2/Delete/Shift+Delete/F5 desktop verbs.
- **Depth apps** (`88560ac`): depthapps.js — Calculator (keyboard-complete), Character
  Map (hover magnifier), Disk Defragmenter (the red fragments ARE the dead cursors;
  cosmetic by law), Registry Editor (live game state under HKCU\Software\CURSORS.EXE,
  writes refused with the real error). Reachable via Run, All Programs, system32.

Server deployed twice (skin field, tvMsg) — `cursors` and `thinice` both verified
active after each.
First paint 2.42 → 2.56 MB across the whole sweep (the cursor set and all four MP3s
stay out of it).

**Watch-outs:** the Bash tool halves backslashes inside heredocs — write python patch
scripts to a file and run them, or use the Edit tool, for any JS with `\n`/`\` in
match strings. `#desktop-depth`, `#desktop-mouse[-bronze]`, `#desktop-saver-<id>` are
the new dev hashes.
