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
| Build | `npm run build` → smoke test → Vite → `apps/web/dist/` → mirrored into `upload/cursors/` |
| Deploy | `upload/cursors/` — committed build output, served by the owner's Vercel project (Root Directory = `upload/cursors`, **no build step**; see the README in that folder). **Claude artifacts are deprecated** (owner, 2026-08-09) — do not publish them |
| Server | `server/` — the beta multiplayer server (Node 22, `ws`, node:sqlite). Live at `wss://cursors.34-70-75-204.sslip.io` on the THIN ICE GCP box (separate service/port/host — see `server/DEPLOY.md`). Local dev: `cd server && FAST=1 node server.js`, client hash `#desktop-mp` |
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

**The CRT (2026-08-09).** The whole product is viewed through monitor glass: `#crt`, a
fixed overlay above everything including the BSOD — phosphor triads, static scanlines
(rolling = VHS, static = CRT), a drifting mains-hum band, glass glare + corner vignette,
black rounded tube corners, and a 7s micro-flicker. All static composited layers, no
filters on live content, ~zero frame cost. Phones drop the phosphor (hiDPI moiré) and
lighten the lines. **Degauss** (a 0.9s filter wobble on body) fires at logon, after every
BSOD, and when the toggle is switched on. Toggle lives in Display Properties → Appearance
→ "CRT glass", persisted as `store.data.crt` (default ON), `body.crt-off` kills it.

**Internet Explorer + the handmade web (2026-08-09).** `ie.js`, import-free sibling
module. Real IE6 chrome: the genuine toolbar art (back/forward/stop/refresh/home/search/
favorites/media/history/mail/print, all from the same winXP archive), address bar with a
working Go, the Links bar, a spinning throbber, and a status bar whose chunked blue
progress bar fills as the page "arrives". Ten pages of real 2003 tag soup — `<center>`,
`<font>`, `<marquee>`, nested tables — because **View > Source is a feature** and the
source has to look handmade. The sites: **cursor$land** (the geocities homepage, live hit
counter), **the odds** (the honest-casino thesis as one ugly page: a/(a+b), P(×N)=1/N with
a table, the 1%/2%/99% arithmetic, "bet size cannot change your variance"), **hall of fame**
(reads live game state — alive cursors and bin deaths, ranked by peak), a **guestbook** that
really persists your entry (`store.data.guest`), **THE CURSOR WEBRING** (10 members, 5 dead
in period-accurate ways, prev/random/next actually ring), **mumu.tripod.com** (a rival's
shrine, superstition presented as a system), **deg404** (sells CURSORBOT 9000 for 2 SOL at a
"94% win rate", then admits in the footer that the seed is committed and revealed and the
page would not be free if the RNG were crackable), bobo's eternally under-construction angelfire
page, **MSN Search** (indexes all ten pages; searching for "how to win" promotes the odds
page to #1 with a note saying so), and a carbon-copy **"The page cannot be displayed"** for
everything else. Plus: a **dial-up ceremony** on the first navigation of a session — the
real Connect dialog, then a synthesised 56k handshake (dial tone, DTMF, ringback, answer
tone, carrier hiss, ~8s, Cancel actually shuts it up), a tray connection icon, and a
"Connected at 56.6 Kbps" balloon. Work Offline gives the real offline page; reconnecting
re-dials. One popup fires on deg404 (1,000,000th visitor; the prize is nothing). Explorer's
Favorites folder holds six .url shortcuts that really navigate, and Run… now takes URLs.

**LIVE MULTIPLAYER BETA (2026-08-09, owner-directed).** The game is now server-
authoritative: `server/` runs the same sim (a faithful port of main.js's rules — same
movement, same a/(a+b) duels, same fees) as the single authority over every balance.
Play money: every visitor gets 5.000 SOL, a beta faucet refills anyone who busts, the
7 bots play server-side as full economic participants. The client becomes a display
when connected (deploys/stances/recalls are requests; positions arrive as 10Hz snapshots,
lerped client-side; deaths/banks arrive as events and reuse the solo FX paths verbatim) and
falls back to the untouched offline sandbox when the server is unreachable — dev hashes
always stay offline, `#desktop-mp*` forces localhost, `?server=` overrides. Names are
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
window, server-echoed, bot chatter muted online), the **guestbook is global**, Paint has
**File > Publish to Gallery** (server-hosted, latest 16, `gallery.cursor.land` in IE), and
**cursorTV** (`tv.cursor.land`) — the whole lobby watches one YouTube video in an IE6
window via the official iframe API, synced by the server: fair FIFO queue (3/person),
skip by vote, muted-start with a click-for-sound badge (browser autoplay law).

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
Back/Home/Search — eight topics that state the game plainly and without jokes: what it is,
the odds (with the 1/N table and the −1% expectation stated outright), why the computer
crashes, the multiplayer beta and its bots, how to check the commit-reveal, rakeback, the
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
- Owner plays every build — `npm run build` refreshes `upload/cursors/`; commit and push,
  Vercel redeploys automatically. Say what to look at. Do **not** publish Claude artifacts.
- **The build is multi-file, and that is deliberate** (changed 2026-08-09 once artifacts
  were dropped). It used to be one inlined HTML file because the artifact host demanded it,
  which meant 8.7 MB gzipped on every first visit — 82% of it audio that base64 inflated and
  gzip could not compress. Now: small assets still inline into the JS/CSS (~130 icons, 80
  emoticons), the MP3s and WAVs are real files fetched only when something plays them, and
  content-hashed filenames + `vercel.json` cache headers make redeploys re-download almost
  nothing. First paint ≈ **0.5 MB gzipped**. Do not reintroduce `vite-plugin-singlefile`.
- Testing the shipped folder needs a **web server**, not `file://` — ES modules are blocked
  by CORS on file URLs. `cd upload/cursors && python -m http.server 8099`, then point
  shot.mjs at `http://localhost:8099/index.html`. Add `?server=off` for the offline sandbox
  or `?server=wss://…` to aim at a server.

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
   `ARENA /LIST`, `ARENA /DISK`, `CURSOR /DEPLOY|/RECALL|/STANCE|/LIST`. Destructive verbs
   answer "Access is denied." Keyboard comes through a hidden input so a phone raises its
   on-screen keyboard and `--kb` lifts the window. **Control Panel** has XP's category view
   (eight categories, task lists, blue side pane) and classic view, persisted; applets open
   the real dialogs. **Services** is split in two tiers and the line between them is
   load-bearing: `local:1` services touch only your own machine (audio, themes, toast
   notifications, the tray clock, spooler, scheduler...) and you may stop them; everything
   the house owns — the Arena service, the Rakeback Ticket Ledger, the fairness provider,
   Plug and Play, RPC, Event Log — refuses with the real error ("Could not stop the X
   service on Local Computer. Error 5: Access is denied.") and greys its properties sheet.
   **This was corrected the same day after an owner catch and the reasoning matters:** the
   first version let you stop the ledger and logged "the edge is 3% until you start it",
   which was *false* (the server owns rakeback) — a lie told to a gambler about their own
   edge. A switch that appears to change the economics is a trust bug even when it only
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
   Still open: the two remaining items the owner named in the same breath —
   **cursorTV as a real YouTube embed** with shared clock + queue + takeover, and the
   **Paint gallery served to everyone** behind a non-sybillable gate.

1. **The XP applications track — the owner's current priority.** Carbon copies, in depth:
   **Control Panel** (a real applet grid, not a joke box), **cmd.exe** (a real interpreter
   over the C:\ tree `explorer.js` already models — dir/cd/type/echo/ver/tree, plus the
   game's own state as commands), **services.msc**, **Device Manager**, **gpedit.msc**.
   Then **cursorTV as a real embedded YouTube player** with a shared clock, a queue and
   paid-or-fair-rotation takeover, and **the Paint gallery served to everyone** behind a
   non-sybillable gate. `explorer.js` models the filesystem as functions, which is the right
   substrate for cmd and Device Manager to read from.
1. **Design/UX still owed** — a real-device pass on a phone (the keyboard path above is
   unverified on hardware), Paint's Fonts toolbar and Stretch/Skew, IE Favorites editing and
   an IE-specific right-click menu, a real Search Companion.
2. **Prove the invariants offline** — the server asserts pot conservation every crash, but
   nothing yet proves EV per deploy = stake × 0.97 for *every* strategy (hunter, camper,
   instant banker, chain rider, autoplay). This is how THIN ICE caught its wipe leak, and
   it is the last thing between the beta and real money. **Parked by the owner until the
   design is done — do not start it unprompted.**
3. **Bot/liquidity policy disclosed** before real money — the buddy list labels them now,
   but the written policy is still owed.
4. Then: Phantom wallet at the login tile, real custody, real DMs.

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
  its target forever. Inside 130px the turn rate triples, **and attacking is 12% faster while
  defending is 10% slower**, so a hunt terminates. DEFEND still buys time; it is no longer
  immortality. Duel odds are untouched, so EV does not move. Kills went **45.7 -> 48/min**.
- *"i seem to always deploy from the same place"* - correct, and it was the same place for
  every player: humans spawned in a 120px band at bottom-centre. The edge is sampled properly
  now and the emptiest of eight candidates wins. Recall glides out through your own nearest
  edge point instead of every recall funnelling to (40, AH).
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
  cursorTV needs a real YouTube video id pasted (no search — no API key); TV/guestbook/
  gallery pages still require IE's dial-up first (intended); epoch pace at CORPSES=64 is
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
