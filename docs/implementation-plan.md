# Implementation plan — the desktop, component by component

The mandate (owner, 2026-08-09): **reference-grade fidelity or don't ship the component.** unicorn.meme is the density bar. One component per working session, built to production-final — UI, UX, sounds, easter eggs, mobile behavior — before moving to the next. No breadth-first sketches. Gambling is load-bearing but visually secondary: the product is a 2003 computer that happens to have a casino on it.

Standing rules for every phase:
- **REVERSED by owner (2026-08-09): carbon copy, not homage.** "I don't want a resemblance, I want a carbon copy… find assets online if you have to… this is just crypto slop, not professional, no legal issues or whatever." Default to the genuine artifact: real open-source recreations (Webamp for Winamp, xp.css/98.css-grade chrome, archived icon/sound sets), real found assets, pixel-identical layouts. Hand-recreating what a library already does 1:1 is the failure mode. One line held: no shipping copyrighted music files — the owner's own MP3s come in via drag-and-drop.
- Every phase ends: syntax check → `npm run build` → server tests → commit → push (Vercel redeploys) → owner plays it. Artifact publishing is retired.
- Right-click anywhere must be OURS (no browser context menu, no 4th wall).
- Each component gets: its sounds, its context menus, its easter eggs, its mobile behavior, its keyboard shortcuts.
- Owner reshuffles phase order at will; default order below.

---

## Infra (2026-08-09, owner-requested) — ✅ Vite workspace

Monolithic `prototype/index.html` retired. Now: npm workspace, `apps/web` Vite app (`src/main.js` + `src/style.css` + `index.html`), Webamp from npm, `vite-plugin-singlefile` build → `dist/artifact.html` for the artifact URL. Build chain runs a node smoke test (stub-DOM execution of the whole module) before bundling. Winamp lifecycle hardened same pass: owned `#webamp-wrap` container for hide/show, taskbar tab wired to it, eager track rendering from page load, render errors surfaced to console instead of swallowed.

## THE OS REBUILD — carbon-copy Windows XP (owner directive 2026-08-09)

Owner, after the Winamp zombie-tab bug and the "satire joke" boot screen: *"it might be an underlying OS engine issue… fucking go make carbon copy windows xp, engine, os logic… go crazy, even have shit like device manager or task manager or gpedit.msc, like cmd and shit, each filled with easter eggs."* This supersedes the old Phase 0.5 stub. The desktop is not themed chrome around a game anymore — it IS a Windows XP, built from real archived assets and real libraries, with the game as its killer app.

### Asset & library sources (researched 2026-08-09)

| What | Source | Notes |
|---|---|---|
| Luna window chrome, buttons, controls, tabs | **xp.css** (npm, MIT, botoxparty/XP.css) | Real Luna titlebar gradients, red X, form controls. Extension of 98.css. |
| Winamp | **Webamp** (npm, MIT) | Already shipped. |
| XP icon set (100+ named + shell32-numbered PNGs), taskbar art, start button | **ShizukuIchi/winXP** repo assets (MIT) — `src/assets/windowsIcons/` | recycle-bin-empty/full, mspaint, notepad, minesweeper, ie, user, folder, taskbar-bg.png, start button, speaker, run-dialog… raw.githubusercontent download. |
| XP sound scheme (45 WAVs) | **MCPlayer2015/all-windows-sounds** repo, `(2001) Windows XP/` | Startup, Logon, Logoff, Shutdown, Balloon, Critical Stop, Error, Exclamation, Ding, Notify, Hardware Insert/Remove, Recycle, Menu Command, Minimize, Restore, Start (the navigation click), tada… |
| MSN Messenger 7 sounds | **archive.org/details/nudge_202411** | newalert.wav (message), nudge.wav, online.wav, newemail.wav. |
| Bliss | **archive.org/details/windows-xp-bliss-wallpaper** | Original-crop 1920×1080 JPG, 360 KB. |
| XP logo / wordmark vectors | Wikimedia Commons SVGs | For boot screen + welcome screen + start button flag. |
| Login/boot layout truth | Reference recreations (lucasgmelo/xp, winXP) + screenshots | Colors hand-matched against the real Welcome screen. |
| Cursors | rw-designer XP cursor set (.cur works in CSS `cursor:url()`) | Nice-to-have; game cursors are already own sprites. |

Held line, unchanged: no shipping copyrighted **music** files. OS icons/sounds/wallpaper are the same category as Webamp's embedded skin — this is crypto slop cosplay, owner accepts it explicitly.

### Phase A — The engine + the shell, carbon copy — ✅ SHIPPED 2026-08-09

Landed exactly as specified below, verified frame-by-frame with headless-Edge screenshots (boot screen, Welcome screen, desktop, start menu — the screenshots are how the "satire" gap gets caught without waiting for the owner). Notes: xp.css needed three patches on our side (no inactive titlebar state — added real Luna pale-blue; its global button gradient had to be beaten off the task tabs; `body{margin:8px}`). The commons flag SVG shipped with an embedded wordmark — stripped to the bare flag, genuine palette (#f8682c/#91c300/#00b4f1/#ffc300). Dev hashes: `#desktop` skips boot/login, `#desktop-start` also opens the start menu (for screenshots). Deferred from A: XP `.cur` pointer files (rw-designer set, needs a scrape), Olive/Silver themes, tile-dim on Welcome hover.

Original spec:

1. **OS engine rewrite** — the actual bug-fix: one process table as the single source of truth; the taskbar is a pure render of that state (rebuilt on every open/close/minimize/focus mutation, never patched imperatively). Webamp becomes a normal process entry (its onClose/onMinimize route through the same state transitions). Zombie tabs become impossible by construction.
2. **Boot screen** — black, real XP logo, the blue three-block marquee crawling its rounded track, "Copyright © Microsoft Corporation" bottom-left. Timed like the real thing, into…
3. **Welcome screen** — the real layout: dark blue top/bottom bands, the center blue field, glowing XP logo left with "To begin, click your user name", user tiles right with picture frames, orange divider accent, "Turn off computer" bottom-left, **Startup.wav on arrival, Logon.wav on tile click**, "welcome" interstitial.
4. **Luna chrome** — xp.css window chrome on every window (real titlebar gradient, real close/min/max buttons); carbon-copy taskbar (winXP's own taskbar-bg + start button art, tray inset, task tab states) and the two-column XP start menu (blue user header band, white pinned column, light-blue system column, Log Off / Turn Off footer).
5. **Real assets wired** — every desktop/menu/titlebar icon from the archived XP set; full sound scheme replacing the synth beeps for OS events (game kill/bank sounds stay ours); Bliss as default wallpaper; MSN sounds into Messenger (newalert on message, nudge.wav on nudge, online.wav on sign-in).

### SCOPE SHIFT (owner, 2026-08-09 late): visible + fun first, system depths parked

Owner: *"leave the too in-depth stuff that only like 2% of the userbase would go and search for like a gpedit.msc or cmd.exe… make on polishing the more visible and used stuff and get more fun stuff out of the way first."* So cmd.exe / gpedit / Device Manager / regedit are **parked** (the Run… dialog keeps its joke responses for them). New order:

### Phase B — Winamp perfection + shell polish pass — ✅ SHIPPED 2026-08-09

- Real MP3 playlist (the synth-baker silently hung → deleted; Kevin MacLeod CC-BY meme canon shipped at 96kbps: Monkeys Spinning Monkeys, Sneaky Snitch, Fluffing a Duck, Local Forecast - Elevator; credit in README.txt). Drag-drop of the owner's own MP3s remains native.
- Full three-deck stack (main + EQ + playlist) now actually appears, centered. TWO root causes found via the headless harness: (1) webamp centers its windows on the mount node's rect — ours was a 0×0 div at the top-left AND hidden at render time, so the stack sat off-screen at the origin (this was the owner's "small one"/"empty" Winamp all along); slot now sits at desktop center and shows before render. (2) our shell's `.window{display:none}` rule also hit webamp's windows (same class name) — exempted under `#webamp`. Real Winamp hotkeys on (Ctrl+D = double size).
- Zombie-proofing round 2: headless repro harness (`#desktop-amptest`) proved open→close→reopen works; the taskbar tab now trusts actual wrapper visibility, not a flag, so any desync self-heals on click.
- Context menus at XP metrics (ACA899 borders, real submenu arrows, proper shadow); menu bars (File/Edit/View/Help…) actually drop menus — File→Exit, Help→About, Task Manager's Shut Down→Turn Off/Restart work.

### Phase M — MOBILE (owner 2026-08-09: "mobile will probably be the majority playerbase") — NEXT

Evidence first (headless screenshots at 390×844 and 844×390): the desktop metaphor does not survive a phone. Portrait = the CURSORS panel eats the top half and three more windows fight for the rest; landscape = three windows, zero visible battlefield. What the owner saw on their phone (a left-edge strip from My Computer down to the start button) is the artifact viewer handing the page a desktop-width viewport and cropping it — but fixing the crop only reveals the real problem underneath.

**Step 1 — ✅ SHIPPED: fixed logical arena.** The battlefield is 1280×800 logical units scaled to fit, not "your window size". Solves phone visibility (you see the entire fight, letterboxed) *and* a fairness bug nobody had flagged — see `design-decisions.md`. On a portrait phone the arena becomes a band across the middle, which conveniently leaves the top and bottom free for chrome.

**Step 2 — the mobile shell (NOT a responsive desktop; a different shell over the same engine).** Below ~760px:
- **Apps go full-screen, one at a time** — no dragging, no overlap, no resize. The title bar keeps its Luna look but gains a big back/close target. Windows are already state-driven, so this is a layout mode on the existing process table, not a second app.
- **The taskbar becomes an app switcher** with thumb-sized targets; Start becomes a full-screen launcher grid (which is also where Control Panel, Paint, Minesweeper etc. live, so adding apps costs no screen space — the owner's "adding more stuff only lowers visibility" worry disappears once apps stop being tiled windows).
- **The game HUD leaves its window and becomes a permanent bottom bar** in the thumb zone: wallet + round clock on top, the per-cursor slot strip, then DEPLOY and RECALL as large buttons with real dead space between them (they are opposites — one spends, one banks). It is never covered by an app, because apps are sheets *above* the arena but *below* the HUD. This is the payoff of the auto-battler decision — two verbs fit a phone; steering never would. *(Was DEPLOY / ATTACK / DEFEND / RECALL until stances were cut 2026-08-13.)*
- **Long-press = right-click** for every context menu.
- Per-app mobile behaviour: Minesweeper beginner fits natively (9×9×16px = 144px); Intermediate/Expert get pinch/scroll inside their frame. Messenger conversations are full-screen sheets with the DP column dropped (already done in CSS). Paint gets a touch-first toolbar when built. Notepad/Explorer are trivially full-screen.
- Keep the desktop shell untouched above the breakpoint — this is additive, and the arena is now identical on both.

### Phase C — The fun, visible stuff (owner picks order)

- **Minesweeper — ✅ SHIPPED 2026-08-09.** Own module (`src/minesweeper.js`, kept import-free so the smoke runner executes it for real). Real rules: first click always safe, flood fill, chording (both buttons on a satisfied number), flag → question → clear cycle with a Marks toggle, mine counter that goes negative, 999-second LED clock, face states (smile/ohh/dead/win), losing reveals every mine and X's the wrong flags. Three levels persisted, Best Times per level stamped with the player's name, resettable. Menus are real (Game/Help with checkmarks — `check:` added to the shared menu builder). Genuine winXP sprite set (16×16 cells, 13×23 LEDs); learned by zooming the sprites 6× that they are **bare transparent glyphs**, so the cell itself must draw both bevels — that plus `box-sizing:content-box` on the grid were the two pixel bugs. Reachable from desktop icon, Start ▸ All Programs ▸ Games, and `winmine` in Run. Winning above beginner posts to Messenger. Dev harness: `#desktop-mine-play` plays real games headlessly until a rich board survives.
- **Messenger production pass** (Phase 2 below) — contact list, per-bot DMs, typing indicators, nudge cooldowns.
- **Paint** via jspaint embed; Save As Wallpaper.
- **Explorer/My Computer + Recycle Bin with purpose** (Phases 3-4 below).
- **CURSORS.EXE production pass** (Phase 6 below) — the game window itself is the most-used surface of all.

Parked: cmd.exe, gpedit.msc, Device Manager, regedit, msconfig (Run… answers for them with jokes). The existing app phases below inherit the carbon-copy asset base.

## Phase 0 — Shell foundation (everything sits on this) — ✅ SHIPPED 2026-08-09 (superseded visually by Phase 0.5)

Landed: boot screen → login (Administrator/Guest tiles, startup chime, Turn Off) with same-session skip; window resize from all edges + maximize/restore (button and double-click) + minimize-to-tab animation; window rects persisted; right-click menus everywhere (desktop with Arrange/Refresh/New ▸/Properties, icons with sys-file guard jokes, titlebars, taskbar tabs, tray) with the browser menu fully suppressed; draggable grid-snapped persistent icons + working marquee selection + New Folder / New Text Document (with rename-in-place, real editable notepad, delete → Recycle Bin); quick launch (Show Desktop toggle, cursamp, Messenger); XP tooltips; clock hover = full date, double-click = Date & Time Properties with live analog clock + month calendar + the "house controls the clock" Apply error; Display Properties with 5 hand-built wallpapers (live preview + Apply) and 3 working screensavers (Starfield / Ribbons / Bouncing CURSORS) with idle timeout + preview monitor; Task Manager (Applications with End Task, joke Processes, live CPU graph that spikes on duels); Cascade Windows; full original sound scheme (open/close/min/max/error/menu/balloon/bin-crunch/logon chime); error/confirm dialog system. Deferred to later phases: mobile long-press context menus, boot-screen art pass.

The window system and desktop chrome, finished. This unblocks every later app, so it goes first.

- **Window manager v2**: resize from all 8 edges/corners (per-app min sizes), double-click titlebar to maximize/restore, XP minimize-to-taskbar animation, proper focus rings, taskbar tab overflow (shrink → group), windows remember position/size per session.
- **Right-click everything**: desktop menu (Arrange Icons, Refresh — with the flicker —, New ▸, Properties → Display Properties), icon menus (Open, Delete → lands in Recycle Bin), taskbar menu, titlebar menu. `contextmenu` suppressed globally.
- **Desktop icons**: draggable with grid snap, marquee multi-select, positions persist, pixel-perfect label shadows.
- **Taskbar perfection**: quick-launch strip, tray icons with tooltips, balloon anchoring, **clock: hover shows full date, double-click opens Date & Time Properties with a working analog clock + month calendar** (owner named this specifically).
- **Boot & login sequence**: boot screen with scrolling progress bar → login screen (Administrator tile) → desktop reveal with original startup chime. Log Off / Turn Off get the full-screen dim treatment.
- **Display Properties**: real tabbed dialog; wallpaper picker (Bliss + 3-4 original alternates), screensaver tab (working idle screensaver — starfield/pipes-flavored original, wakes on input).
- **Sound scheme**: full original UI set (open, close, minimize, error ding, balloon, empty-bin).
- Shadow/gradient audit across every existing surface.

## Phase 1 — The player — ✅ REDONE SAME DAY: real Winamp via Webamp

The custom three-deck build below shipped and was rejected within the hour ("copy slop… why not just winamp… isn't there some library"). Replaced with **Webamp v1.5.0** (MIT, pixel-perfect Winamp 2.9 reimplementation — the same thing unicorn.meme embeds) inlined into the page (870KB bundle, classic skin embedded as data URI, zero network). The 7 authored tracks survive: same instrument rack and arrangements, now rendered to real WAV files via OfflineAudioContext in a background queue and fed to Webamp's playlist as they finish baking (~2s each). Real main window / EQ / playlist / windowshade / double-size / Winamp's own context menus (our global right-click handler exempts the Webamp region). Desktop icon, quick launch, and start menu ("Winamp — it really whips the llama's ass") route through an `openWin` intercept; taskbar tab wired to Webamp's minimize/close callbacks. A `fetch()` shim decodes data: URIs locally so the bundled skin loads under the artifact CSP. Known risk: blob-URL audio inside the artifact sandbox — if tracks are silent there, next step is data-URI track delivery. Drag-and-drop of the owner's MP3s is native Webamp behavior.

**Lesson recorded in the standing rules above and in memory: genuine artifact > recreation, always.**

## Phase 1 (superseded) — the custom build, kept for the record — shipped then replaced 2026-08-09

Landed: full three-deck player (550px stack, original gunmetal + green-LED skin, docked decks drag as one from any deck's titlebar). **Main deck**: hand-drawn seven-segment LED time canvas with ghost segments (click = elapsed/remaining, blinks when paused), spectrum analyzer with falling grey peak caps / oscilloscope / off (click to cycle), JS marquee with ` *** ` separator and status flashes (VOLUME/BALANCE/SEEK/PAUSED messages take over the marquee, winamp-style), kbps + kHz LED readouts (real computed bitrate for user files), MO/ST lamps, full transport + eject, working seek bar (thumb hidden when stopped), volume slider with green→amber→red fill, center-snapping balance, SHUFFLE/REPEAT latches with LED dots, EQ/PL deck toggle latches, clutterbar (O=options A=always-on-top D=double-size I=track-info V=vis — all functional), windowshade mode per deck (double-click any deck titlebar; main shade shows mini time+title in the strip). **EQ deck**: ON latch that genuinely bypasses/engages a 10-band BiquadFilter peaking chain (60 Hz–16 kHz, all sources routed through it), preamp, AUTO latch that proudly does nothing, 7 presets (FLAT/PUMP/AIRY/BASSMAXX/VOCAL CUT/NIGHTCORE/LO-FI), live EQ curve canvas with preamp marker. **Playlist deck**: numbered rows with durations, click select / ctrl-multi / double-click play / right-click row menu (PLAY, FILE INFO, REMOVE), ADD/REM/SEL/MISC button menus (crop, invert, sort, randomize, restore house tracks), elapsed/total readout, vertical resize grip. **Audio**: 7 authored tracker originals synthesized live (cloudless.mod trance 138 / gigadance.xm eurodance 134 / nightcoreur.s3m 168 / chip8.mod chiptune 150 / dialtone.xm garage 128 swing / vaporlounge.s3m 84 swing / shatterhand.mod dnb 174) on a real instrument rack — pitch-env kick with sidechain pump, snare/clap/hats/crash from filtered noise, sub+saw bass modes (offbeat, rolling 16ths, octave bounce, walking, jazz roots, detuned reese), supersaw stabs and pads, dotted-8th echo leads, risers into every drop, per-track arrangements (intro/build/drop/break/drop/outro) with chord progressions and written melodies. **Files**: drag-and-drop or eject/ADD/L-key opens local MP3s — ID3v2+v1 title/artist parsing, duration probe, real average bitrate, object-URL playback routed through the same preamp→EQ→volume→balance→analyser chain. Keyboard: Z X C V B, L, S, R, arrows (volume/seek). Everything persists (volume, balance, EQ, decks, shades, sizes, latches). Tray mute now also silences music; closing the window keeps the music playing. Right-click anywhere on the player = full options menu. Triple-click the nameplate for the About box.

Deferred (stretch, unchanged): fullscreen milkdrop-flavored visualizer window.

Full classic three-deck player at reference density, hand-drawn pixel skin (gunmetal + green LED language, original art, own name on the plate).

- **Main deck**: scrolling title marquee, kbps/kHz readouts, LED time display (toggle elapsed/remaining), spectrum analyzer AND oscilloscope toggle, full transport, shuffle/repeat latches, seek bar, volume + balance sliders, windowshade mode (collapse to title strip), clutterbar.
- **Equalizer deck**: ON/AUTO latches, preamp + 10 band sliders **actually wired** to a BiquadFilter chain, preset menu, the little EQ curve display.
- **Playlist deck**: ADD/REM/SEL/MISC buttons, scrolling list with durations, double-click to play, current track highlighted, resizable, total-time readout.
- Decks snap/dock to each other and drag as a stack.
- **Audio**: (a) 6-8 authored original tracks — proper synthesis (drum voices, bass, chords, arps, sidechain pump) across era moods: eurodance, trance, nightcore-tempo, chiptune; (b) **drag-and-drop / open-file MP3 playback of the user's own library** — real files, real ID3 title in the marquee, real spectrum. That's how the owner's actual jams get in, legally. (c) Production ships licensed or original music only.
- Stretch: fullscreen visualizer window (milkdrop-flavored canvas shaders, original).

## Phase 2 — Messenger, for real — ✅ SHIPPED 2026-08-09

Own module (`src/messenger.js`, import-free so the smoke runner executes it). **Buddy list** replaces the old single chat box: menu bar, your header (display picture, name + status, personal message you can double-click to set), Online/Offline groups that collapse and show live counts, contacts with personal messages, status tinting (away = amber, busy = red, offline = greyed), double-click to open a conversation, "I want to..." footer. **Conversation windows are real windows** — one per contact plus the everyone lobby, each with its own taskbar button, created at runtime (this is what forced `wireWindow()` out of the init loop, so the window manager now builds windows on demand). Each has the To: header with address, grouped "X says:" history, the two display pictures stacked on the right, a typing indicator that fires before every bot reply, Nudge (real nudge.wav + window shake + bots nudge back), Send a File (declining is the joke), and an **emoticon picker** over the real MSN retro set — 80 emoticons, 19×19, with ~110 text shortcuts parsed longest-match-first, so `(H)`, `:'(`, `8o|`, `(bunny)` all render inline. Bots have per-contact reply pools and answer *you* rather than monologuing; presence drifts over time and sign-ins raise a stacking MSN toast (click it to open the conversation) with online.wav. Game events still narrate into the lobby.

## Phase 2 (original spec, kept for the record)

- **Contact list window**: sign-in animation, status (Online/Away/Busy/Appear Offline), grouped contacts (Bots, Degens), display pictures (original avatar set), custom status messages, the slide-up toast when someone signs in.
- **Conversation windows**: one per chat (global lobby + per-bot DMs with bot AI replies), authentic layout — To: header with avatar, message area with "says:" formatting, typing indicator ("bobo is typing…"), emoticon picker grid, font/color options, **nudge done properly** (window shake, cooldown, sound, "you have just sent a nudge" system line).
- Wire lobby chat to the real server plumbing at production (THIN ICE ring buffer + rate buckets already reusable).
- Easter eggs: away-message autoresponders on bots, "wants to send you a file: virus.exe" joke prompt (declining is the joke).

## Phase 3 — My Computer & the filesystem illusion

- **Explorer windows**: address bar, toolbar (Back/Forward/Up/Views), XP task pane sidebar, icon/list/details views.
- **Fake C:\ drive**: My Documents, Program Files (app shortcuts that actually launch apps), WINDOWS (joke system files), file associations — .txt → Notepad, .mp3 → player, .cur → cursor properties.
- **Properties dialogs everywhere**: files (size/created/attributes), Drive C: with the pie chart (disk usage = live game stats: wagered, banked, rake returned), **System Properties** (General tab: "CURSORS XP · 2003 · 1 cursor @ 3.2 GHz · 512 MB RAM · Registered to: Administrator").
- Live lobby stats stay here (cursors online, pot, biggest bounty) presented as system monitors.
- Easter eggs: hidden folder, "DO NOT OPEN" folder (opening it is its own reward), defrag.exe that "defragments" the desktop icons.

## Phase 4 — Recycle Bin with a purpose

- Dead cursors land as `.cur` files with full tombstone metadata: name, bounty lost, killer, round, timestamp.
- Open one → **death certificate** properties dialog (the 92:8 that killed it, replay link once fairness records exist).
- Restore → XP-style error: restoration is not possible; the desktop keeps what it takes.
- Empty Recycle Bin → confirmation dialog + the correct paper-crunch sound + empty/full icon states.
- **Hall of Pain**: all-time biggest losses leaderboard, this-boot graveyard, your personal cemetery.

## Phase 5 — Notepad & text apps

- Real editable Notepad: File/Edit/Format/View menus that work (New, Open from fake FS, Save to fake FS), word wrap, font dialog, status bar, Ctrl+S/Ctrl+F.
- fights.log = live auto-appending file opened in Notepad (pausable scroll).
- README.txt editable but resets on reboot (the file remembers nothing; the desktop remembers everything).
- Stretch: **Paint** — pencil/brush/eraser/fill/text/color palette, and **Save As Wallpaper** (meme machine; drawings shareable later).

## Phase 6 — CURSORS.EXE, production pass

The game app rebuilt as a proper XP application (mechanics already proven in prototype):

- Menu bar (Game · View · Help), panes: **Play** (deploy/recall, pot odometer, live field list sorted by bounty), **Stats** (session + lifetime, charts), **Rakeback** (tickets, share, accrued, half-life explainer), **History** (every round, every duel, browseable), **Verify** (the seven-receipt fairness page, THIN ICE style).
- Game-layer render upgrade: cursors move to canvas (trails, soft shadows, chunkier explosions, duel lock-on effect), DOM only for windows.
- Moments: bank ≥×10 gets a full celebration sequence; BSOD variants; first-run tutorial styled as a Found New Hardware wizard.
- Spectate UX for between-deploys.

## Phase 7 — Internet Explorer & the web of 2003

- Full IE chrome: toolbar, address bar with dropdown history, throbber, status bar with progress segments, Favorites.
- **An internal handmade web** (works everywhere, including the sandboxed prototype): cursor$land (rebuilt to unicorn.meme density — tiled backgrounds, GIF-collage sidebars as original pixel-art animations, guestbook wired to Messenger, hit counter, webring that actually rings through 6-10 handmade sites: search engine with joke results, bot fanpages, conspiracy page about the house edge, 404 wasteland).
- Dial-up connect sequence (modem handshake audio, original synthesis) the first time IE opens per session.
- **Real internet, honest limits**: on the production site we can embed YouTube's official player (watch videos next to the arena — works), plus curated embeds. Arbitrary site browsing inside a fake browser isn't feasible (sites block framing) and a proxy is a liability — not doing that. In the prototype artifact, network is sandboxed entirely, so the handmade web is the whole web there.

## Phase 8 — Start menu & system completeness

- All Programs flyout with full roster, pinned column, recent apps that actually track usage.
- **Run… dialog**: launch apps by name; cheat-code strings; `format c:` → politely catastrophic error dialog.
- Search companion with an original mascot character (our own, not anyone else's assistant).
- Help & Support Center = game rules + fairness docs in XP help chrome.
- Hibernate/Standby jokes, the full shutdown dim, and a Windows-Update-style "installing update 1 of 1: do not turn off your casino" gag on version bumps.

---

## Cut / parked

- ~~Resolution-shrink battle royale~~ — cut by owner (2026-08-09). Aggression ramp + shutdown recall rush carry the anti-camp job. Confirmed: the mass brawl at the start bar during shutdown recall is **intended** — it's the round's climax.
- Multi-OS stake lobbies — parked (liquidity). Eras live inside the one desktop.

## Sequencing note

Phase 0 first (everything depends on it). After that the order is the owner's; default is as listed — player and Messenger next because they're the identity pieces. The engine-side track (sim port + invariants proof, netcode fast channel — see `reuse-from-thinice.md`) runs as its own parallel workstream and doesn't block any UI phase.
