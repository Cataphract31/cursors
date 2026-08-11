# Indistinguishable-from-XP: the gap, and the phases to close it

The bar is not "retro-flavoured". The bar is: **someone who used XP every day for six
years pokes at something nobody was supposed to poke at, and it works.** Every item
below is chosen because it is a thing a person actually pokes at.

Governing rules for all of it:

- **Real assets only.** If Microsoft shipped it, ship Microsoft's. Cursors, screensavers,
  sounds, icons, fonts, dialog strings. Hand-drawing a recognisable thing is the failure
  mode. The only line is no copyrighted *music*.
- **Nothing a user does may touch another user's money.** Every system app is cosmetic,
  local, or an easter egg. The server owns the economy and says so when asked.
- **No authored joke copy.** Real systems, real player content. Where XP had words, use
  XP's actual words.

---

## Phase 0 — the bugs on the table (fast)

| # | Thing | Where | Note |
|---|---|---|---|
| 0.1 | Volume flyout closes the moment you touch it | `main.js:161` | `addEventListener("pointerdown", …, true)` is a **capture**-phase window listener, so it runs before the flyout's own `stopPropagation`. Any click inside — including grabbing the slider — closes it. Fix: `if(!e.target.closest("#volflyout,#sndico")) volOpen(false)`. Same bug class to audit on the Start menu and the clock flyout. |
| 0.2 | Volume flyout is the wrong shape | `index.html`, `style.css` | XP's is a narrow **vertical** slider with "Volume" caption and a Mute checkbox under it, and it opens *above* the tray with a 1px raised border. Currently horizontal. |
| 0.3 | Desktop right-click menu is barebones | `main.js:787` | See Phase 1. |

---

## Phase 1 — context menus, everywhere, carbon copy

Currently there are 6 menus and the desktop one has 7 entries. XP's desktop menu has 12
plus a 10-entry submenu. This is the single highest-density "damn, it's real" surface in
the whole product, because it is the first thing anyone right-clicks.

**1.1 Desktop** — XP's actual menu:
`Arrange Icons By ▸` (Name / Size / Type / Modified / ─ / Show in Groups / Auto Arrange /
Align to Grid / ─ / Show Desktop Icons / Lock Web Items on Desktop / ─ / Run Desktop
Cleanup Wizard) · `Refresh` · ─ · `Paste` · `Paste Shortcut` · `Undo Delete  Ctrl+Z` · ─ ·
`New ▸` (Folder / Shortcut / ─ / Briefcase / Bitmap Image / WordPad Document / Rich Text
Document / Text Document / Wave Sound / Compressed (zipped) Folder) · ─ · `Properties`.

Each one wired to something real: Show in Groups genuinely groups, Align to Grid genuinely
snaps, Auto Arrange genuinely re-flows and stays on, Desktop Cleanup Wizard is a real
3-page wizard that sweeps unused icons into *Unused Desktop Shortcuts*, `New > Wave Sound`
makes a 0 KB file that plays nothing when opened. `Undo Delete` restores the last item out
of the Recycle Bin — which we already model.

**1.2 Desktop icon** — `Open` · `Run as...` · ─ · `Send To ▸` (Compressed (zipped) Folder /
Desktop (create shortcut) / Mail Recipient / My Documents / 3½ Floppy (A:)) · ─ · `Cut` ·
`Copy` · ─ · `Create Shortcut` · `Delete` · `Rename` · ─ · `Properties`. The 3½ Floppy entry
should make the drive-seek noise and fail, because it always did.

**1.3 Explorer background & items** — `View ▸` (Filmstrip/Thumbnails/Tiles/Icons/List/
Details, checked) · `Arrange Icons by ▸` · `Refresh` · `Paste` · `Paste Shortcut` · `New ▸` ·
`Properties`. Per-item: `Open` · `Open With ▸` · `Send To ▸` · `Cut`/`Copy` · `Create
Shortcut` · `Delete` · `Rename` · `Properties`.

**1.4 Internet Explorer** — page menu: `Back` · `Forward` · ─ · `Save Background As...` ·
`Set as Background` · `Set as Desktop Item...` · ─ · `Select All` · `Paste` · ─ · `Create
Shortcut` · `Add to Favorites...` · `View Source` · `Encoding ▸` · ─ · `Print...` ·
`Refresh` · ─ · `Properties`. Link menu is different: `Open` · `Open in New Window` ·
`Save Target As...` · `Print Target` · ─ · `Cut`/`Copy`/`Copy Shortcut`/`Paste` · ─ ·
`Add to Favorites...` · `Properties`. Image menu different again. **Set as Background
actually sets the desktop wallpaper** — that is the kind of thing that makes people sit up.

**1.5 Text fields & Notepad** — `Undo` · ─ · `Cut`/`Copy`/`Paste`/`Delete` · ─ ·
`Select All` · `Right to left Reading order` · `Show Unicode control characters` ·
`Insert Unicode control character ▸` (the full LRM/RLM/ZWJ/ZWNJ/LRE/RLE/… list). That
last submenu is pure XP and nobody has ever used it, which is exactly why it should be there.

**1.6 Start menu items** — `Open` · `Explore` · ─ · `Pin to Start menu` · `Send To ▸` ·
`Cut`/`Copy` · `Delete` · `Rename` · `Sort by Name` · `Properties`. Pinning must persist.

**1.7 Taskbar / tray / title bar** — tray icons each get their own menu (volume: `Adjust
Audio Properties` / `Open Volume Control`; network: `Disable` / `Status` / `Repair` /
`Open Network Connections`). Title-bar and Alt+Space already exist; add `Move`/`Size`
actually driving keyboard window movement.

**1.8 Menu chrome fidelity** — keyboard access keys with underlines, the disabled-item
grey, submenu open delay (~300 ms hover), the checkmark and radio-dot glyphs, icons in the
left gutter, `Ctrl+Z`-style accelerator text right-aligned, and the fact XP's menus dismiss
on `Esc` and walk with arrow keys.

---

## Phase 2 — screensavers, the real ones, Pipes on by default

Currently: three hand-written canvas toys (`stars`, `ribbons`, `bounce`) at `main.js:1460`.
Same failure mode as the drawn Rover.

XP shipped exactly these, and this is the list the dropdown should hold:
**(None) · 3D FlowerBox · 3D Flying Objects · 3D Pipes · 3D Text · Beziers · Marquee ·
Mystify · My Pictures Slideshow · Starfield · Windows XP**.

- **3D Pipes becomes the default.** Real thing: WebGL, random-walk pipes on a 3D lattice,
  elbow joints, the occasional teapot, brushed-metal or multi-coloured plastic materials,
  screen clears and restarts when the lattice fills. Settings dialog with Traditional/Flex
  pipes, Multiple/Single, Solid/Textured, Joint Type (Elbows/Ball/Mixed), Resolution slider.
- **Mystify and Beziers** are exact and trivially reproducible — they are specified
  geometry, not art: N polylines, vertices bouncing in the box, colour-cycling trails.
- **3D Text** with the real settings dialog (custom text / time, rotation type, surface
  style, resolution, speed) — default text `CURSORS`.
- **Marquee** with the real settings (text, background colour, format, speed, font).
- **Starfield** — the real one is a specific warp field with a speed slider.
- **Windows XP** — the logo/pipes-of-light one; needs the real logo asset.
- **My Pictures Slideshow** — points at the Paint gallery. That is a genuinely nice loop:
  paint something, it shows up in your screensaver.

Plus the Display Properties **Screen Saver tab** done properly: the tilted monitor preview
that runs the actual saver at thumbnail size (exists), `Settings...` per saver, `Preview`
(full screen, any input exits), `Wait: __ minutes` spinner, `On resume, password protect`
checkbox, and the Monitor power section with `Power...`.

---

## Phase 3 — cursor schemes, and the gold one

Two halves, and the second is the interesting one.

**3.1 The OS pointer.** XP's cursor schemes, real `.cur`/`.ani` files, applied to the whole
desktop via CSS `cursor: url(...)`. The shipped schemes:
Windows Default · Windows Black · Windows Inverted (each in System/Large/Extra Large) ·
**3D-Bronze** ← *this is the gold one you remember; XP shipped it* · 3D-White · Conductor ·
Dinosaur · Hands 1 & 2 · Magnified · Old Fashioned · Variations · Windows Animated ·
Windows Standard.
All 15 pointer roles per scheme (Normal Select, Help Select, Working In Background, Busy,
Precision Select, Text Select, Handwriting, Unavailable, the six resize arrows, Move,
Alternate Select, Link Select). The animated ones (`.ani` — the dinosaur, the hourglass,
the spinning globes) need an APNG/CSS-frame path since browsers won't take `.ani` directly.

**3.2 Mouse Properties** (`main.exe` / `control main`), the real 5-tab dialog:
`Buttons` (button config swap — actually swaps them; double-click speed test with the
folder that opens; ClickLock) · `Pointers` (scheme dropdown, the 15-role list, Browse,
Enable pointer shadow) · `Pointer Options` (motion speed, Snap To, **Display pointer
trails** ← ship it, it works, it is horrible, it is perfect, Hide pointer while typing,
Show location on Ctrl) · `Wheel` · `Hardware`.

**3.3 Your cursor in the arena — the part that matters.** Right now every cursor in the
arena is one shared SVG symbol (`main.js:2076`, `#ic-cursor`). Cursor choice becomes a
**per-player identity that everyone else sees**: the scheme id rides on the wire with the
cursor, and the arena renders your 3D-Bronze arrow, or the dinosaur, to the whole lobby.
Costs nothing, changes nothing about odds, and turns a settings dialog into a flex. This
is the strongest "personal + customisable" hook available and it is nearly free — server
change is one string field on the cursor record.

*Constraint check: purely cosmetic, does not touch the sim, cannot be used to mislead
(the tag still carries name and stake).*

---

## Phase 4 — Internet Explorer: delete the fiction, keep the browser

**4.1 Demolition.** These come out of `ie.js` entirely — they are authored joke copy and
you have told me three times that is not the product:
`cursor.land/` (homepage), `cursor.land/odds.html`, `cursorwebring.org/`,
`mumu.tripod.com/`, `deg404.neocities.org/`, `angelfire.com/biz/bobo/`, plus `NAV`, `RING`
and the fake `search.msn.com` result list. ~600 lines of `ie.js` deleted.

**These stay, because they are not writing — they are live systems showing player content:**
`tv.cursor.land` (the shared player), `gallery.cursor.land` (everyone's Paint), and the
guestbook and Hall of Pain (real signatures, real deaths). They get restyled as plain
pages, not geocities pastiche. *Say if you want the guestbook/hall gone too and they go.*

Home page becomes cursorTV. The odds move where they belong: a real page in **Help and
Support Center**, in XP's help chrome, stated flat.

**4.2 The browser itself, properly.** Favourites that actually edit — `Add to Favorites`
with the real folder-tree dialog and `Create in >>`, `Organize Favorites` with
Create Folder / Rename / Move to Folder / Delete, drag-reorder, persisted. The Favorites
**Explorer bar** (the left panel, not just the menu), plus History (grouped by Today /
Last Week), Search bar, Media bar. Internet Options as the real 7-tab dialog
(General/Security/Privacy/Content/Connections/Programs/Advanced) — with the Advanced tab's
enormous scrolling checkbox tree, which is the funniest real thing in Windows. Temporary
Internet Files with `Delete Cookies` / `Delete Files` / `Settings` and a **real** cache
size that grows as you browse. Status bar with the zone icon, the progress bar, and the
`(1 item remaining) Downloading picture http://…` text. The Print Preview dialog. Ctrl+F
Find. Text size actually resizing. Autocomplete dropdown on the address bar from history.

**4.3 cursorTV / the YouTube embed, plug.dj-style.** The bones exist (`tv.cursor.land`,
server-side rotation by person at `server.js`). What it needs to actually be the feature:
- IFrame Player API properly: server holds `videoId + startedAt`, client seeks to
  `(now − startedAt)` on join, so everyone is genuinely in sync and a late joiner drops
  into the middle.
- **Deck rotation** displayed as decks — "up next: bobo, then you, then deg404" — not a
  flat queue. Rotation by person, never purchasable.
- Vote-skip with a live count and a threshold, `woot`/`meh` reactions, a "who's watching"
  count, the currently-playing title/duration/elapsed pulled from the API.
- Per-person queue of 3, drag to reorder your own, dead links rejected at queue time.
- Volume bound to the master, and **auto-ducked while a duel is on screen**.
- Because it lives in an IE window it can be minimised and keeps playing — that is the
  plug.dj feel.

---

## Phase 5 — Paint, finished

Fonts toolbar for the Text tool (the floating one, with font/size/bold/italic/underline
and the vertical-text button). `Image > Stretch/Skew` with the real 4-field dialog and the
little bitmap diagrams. `Image > Flip/Rotate`, `Invert Colors`, `Attributes` (exists),
`Clear Image`. Edit > Paste From, Copy To. The colour box's `Edit Colors > Define Custom
Colors` — the full hue/sat/lum picker with the rainbow field and the crosshair. Free-Form
Select actually free-form. The Magnifier's grid overlay and `View > Zoom > Show Grid`.
Custom brush shapes. Airbrush spray density. Save As with the real file-type dropdown
(BMP 24-bit / 256 Color / 16 Color / Monochrome, GIF, JPEG, PNG, TIFF) and the "may lose
colour information" warning for the low-bit ones. Status bar showing cursor coords and
selection size.

---

## Phase 6 — depth: the apps nobody expects to work

This is the "went delving and was shocked" phase. Ordered by shock-per-hour.

**6.1 The high-shock five**
- **Disk Defragmenter** — the coloured block map, Analyze, the report dialog, the blocks
  actually rearranging over minutes. Ties straight into the disk-full/corpse system we
  already have: defragging is a real thing you can do about a full C:. *(Cosmetic only —
  it must not change the disk-full BSOD economics.)*
- **regedit** — real tree (HKEY_CLASSES_ROOT … HKEY_CURRENT_CONFIG), real value types
  (REG_SZ / DWORD / BINARY with the hex editor), F3 Find, Export/Import `.reg`, and a
  handful of keys that genuinely do something cosmetic. Deep-easter-egg territory.
- **Task Manager** — all five tabs (Applications / Processes / Performance / Networking /
  Users), the real CPU-history graphs, PF usage, End Process with the warning dialog,
  and the tray graph icon. Killing `cursors.exe` should do something memorable.
- **Sound Recorder + Volume Control (sndvol32)** — the full mixer with Volume/Wave/SW
  Synth/CD Audio/Line In sliders and the Advanced tone controls. `Options > Properties`.
- **Character Map** — the real grid, font dropdown, Advanced view, character-set filter,
  the U+ readout, Select/Copy.

**6.2 The apps that should exist and don't**
Notepad (real Format/Word Wrap/Font, Go To, F5 timestamp, the `.LOG` trick), WordPad,
Calculator (Standard + Scientific, and the real keyboard bindings), Windows Picture and
Fax Viewer, Windows Media Player 9 (the real one, next to Webamp), Solitaire and
3D Pinball, Clipboard Viewer, MSConfig, System Restore, Windows Update, Scheduled Tasks,
the Fonts folder, Add or Remove Programs with real install sizes and usage frequency bars,
Accessibility Options (and Magnifier / On-Screen Keyboard / Narrator actually running),
Folder Options (all three tabs, incl. the Advanced settings checkbox tree), Recycle Bin
Properties with the per-drive percentage slider, ClearType tuner.

**6.3 The shell itself — where "mock-up feel" actually lives**
These are small and they are the difference more than any single app:
- Rubber-band select on the desktop with the real translucent blue rectangle.
- **Alt+Tab** — the real grey box with the icon strip and the caption underneath.
  Also Alt+Esc, Win+D, Win+E, Win+R, Win+M, Ctrl+Esc, F2 rename, F3 search, F5 refresh,
  Alt+F4, Alt+Space, Shift+Delete ("permanently delete?"), Ctrl+Alt+Del.
- Window animations: the minimise/restore zoom-to-taskbar wireframe, the open/close scale.
- Taskbar grouping when it fills up ("3 Internet Explorer ▸"), the grip bars, Lock the
  Taskbar, Toolbars ▸ (Quick Launch / Address / Links / Desktop), auto-hide, the notification
  area's **"‹" chevron that hides inactive icons** with Customize Notifications.
- Tooltips with the real 1px yellow style and the real delay; balloon tips with the tail.
- Drag and drop that works — icons between folders, files onto Paint, an image out of IE
  onto the desktop.
- Focus, z-order and the inactive title-bar gradient being genuinely different.
- The full XP sound scheme mapped to the right events (menu popup, minimise, maximise,
  restore, error, exclamation, critical stop, device connect/disconnect, empty recycle bin,
  start navigation) — most of these are already loaded and unmapped.
- Copy dialogs with the flying-paper animation and a real progress bar.
- Loose-end strings: every `showError` should be XP's real wording where XP had wording.
- The Start menu's "All Programs" hierarchy filled out (Accessories ▸ System Tools ▸,
  Games ▸, Startup ▸) with everything above in the right place.

---

## Phase 7 — the mobile pass

None of the above is worth much on the phone if the shell fights the OS. Real-device pass
(the `--kb` keyboard path has never run on an iPhone), long-press → context menu timing
across all the new menus, and a decision on which Phase 6 apps get a phone layout versus
"rotate to landscape".

---

## Ordering

**Phase 0** (an hour) → **Phase 1** (menus; biggest fidelity-per-hour in the document) →
**Phase 3** (cursors; personal, visible to others, cheap) → **Phase 2** (Pipes) →
**Phase 4** (demolish the fiction, then TV done right) → **Phase 5** (Paint) →
**Phase 6** in the 6.3 → 6.1 → 6.2 order, because the shell details land on every app at
once → **Phase 7**.

Phases 0–3 are the ones that change how the whole thing *feels* on first contact. 6.3 is
the sleeper — a dozen small shell behaviours that together are worth more than any single
application.

---

# Round 2 — after the first eight shipped (2026-08-10)

Everything above through Phase 6.1 is live. What follows is the remainder, re-cut into
phases the same way: ordered by fidelity-per-hour, with the detail-sweep work first
because that is what made the difference last round.

## Phase 8 — the second shell sweep (the rest of 6.3)

The highest-value phase in this round. None of these is an app; all of them are the
texture people touch constantly without noticing:

- **Rubber-band select** on the desktop and in Explorer — the translucent blue rectangle,
  multi-select, drag the group, Ctrl-click add/remove. Today only single icons select.
- **Drag and drop that works** — icons into open folder windows and back out, a file onto
  Paint's window to open it, an image dragged off an IE page onto the desktop.
- **The copy dialog** — flying-paper animation, the real progress bar, Cancel that leaves
  a partial job. Shown for any multi-file operation the shell fakes (Send To, paste of a
  folder, Recycle Bin restore).
- **Taskbar grouping** when the bar fills ("3 Internet Explorer ▸" with the stack menu),
  plus Lock the Taskbar, auto-hide, and Toolbars ▸ Quick Launch / Address / Desktop.
- **Minimize animation** — restore already zooms out of the tab; minimize still just
  disappears. Both directions, same wireframe.
- **Tooltips and balloons** — XP's 1px-border yellow tooltip with the real 500ms delay,
  balloon tips with the tail anchored to the tray icon.
- **The rest of the sound scheme** — menu popup, maximize, restore-down, empty recycle
  bin, start-navigation are loaded but unmapped. Map every event XP mapped.
- **All Programs, finished** — every app that exists (and will exist below) in its true
  XP location: Accessories, System Tools, Entertainment, Games, Startup.
- **Error-string sweep** — every remaining showError reworded to XP's exact phrasing
  where XP had phrasing. Flat, terse, no editorial.

### Phase 8 status (2026-08-10)

Shipped: Ctrl/Shift multi-select + group drag + Ctrl-marquee; drag desktop icons
into My Documents; the file-operation dialog (flying paper, segmented bar, real
Cancel) wired to Empty Recycle Bin, Restore and folder drops; taskbar auto-hide;
another copy sweep.

Already existed, plan was wrong: minimize/restore zoom animation, XP tooltips
with the 500ms delay, the marquee rectangle itself, Toolbars/Cascade/Tile/Lock
the Taskbar, and the silent-by-default sounds (XP really does leave menu popup,
open program and close program unassigned — that part was already correct).

Deliberately skipped: **taskbar grouping**. XP groups multiple windows of one
application, and this shell opens exactly one window per app, so the feature
would never trigger. Revisit only if Explorer gets multiple windows.

Still open in Phase 8: dragging an image out of an IE page onto the desktop,
All Programs filled out, and the last pass over showError wording.

## Phase 9 — the writing apps (things people open daily)

- **Notepad, for real** — Format ▸ Word Wrap and Font (and the font actually changes),
  Edit ▸ Go To with line numbers, F5 timestamp, and the genuine `.LOG` trick: a file
  whose first line is `.LOG` appends a timestamp on every open. fights.log and
  README.txt reopen inside it instead of the static viewers they are now.
- **WordPad** — the ruler, the formatting bar, RTF-ish bold/italic/size/color, opens the
  `.doc`/`.rtf` files the New menu already creates.
- **Windows Picture and Fax Viewer** — the real toolbar (zoom, rotate, slideshow, print,
  delete), and it becomes what double-clicking any image opens: Paint saves, gallery
  pictures, the wallpaper.
- **Clipboard Viewer** — shows whatever the shell clipboard actually holds. Tiny, and
  exactly the kind of thing a delver checks.

### Phase 9 status (2026-08-10)

Shipped: Notepad (Word Wrap + Font genuinely apply, Go To with XP's
disabled-while-wrapping rule, F5 time/date, the .LOG trick, status bar only
when unwrapped; .txt desktop files, README and system32's notepad.exe open in
it, and read-only sources Save As a desktop copy). WordPad (format bar, ruler,
page chrome; owns .doc/.rtf). Picture and Fax Viewer (prev/next across every
picture on the machine, zoom, rotate, slideshow, delete where deletable, and
the pencil hands the image to Paint — double-click views, Edit paints, XP's
split). Clipboard Viewer reads the shell clipboard. fights.log deliberately
stays the live-tail window: Notepad would freeze it mid-fight.

Watch-out found: the shell binds every `.menubar span` globally with
stopPropagation, so per-window menubar listeners never fire — new windows with
menus must be routed inside that handler like Paint/IE/Explorer are.

## Phase 10 — the noise apps

- **sndvol32** — the full mixer: Volume Control / Wave / SW Synth / CD Audio / Line In
  columns with working sliders (Wave genuinely scales game sounds, Volume Control is the
  master), Mute checkboxes, Options ▸ Properties with the device dropdown.
- **Sound Recorder** — the green oscilloscope, record from the mic (local only, nothing
  uploads), play back, the Effects menu (Add Echo, Reverse, half/double speed — all real
  DSP on the buffer), save as `.wav` onto the desktop.
- **WMP9** — the real skin around the music that already plays through Winamp: the blue
  chrome, the visualization pane (Ambience/Bars and Waves), the playlist drawer. Winamp
  stays; XP shipped both.

### Phase 10 status (2026-08-10)

Shipped, all three: **sndvol32** (five columns — Volume Control/Wave/SW
Synth/CD Audio/Line In — where the master is the tray slider both ways, Wave
genuinely scales every shell and game sound, and CD Audio scales the music
players; Options/Help menus; the tray icon's right-click opens it).
**Sound Recorder** (green oscilloscope off a live analyser, records the real
microphone locally, Effects menu does real DSP — echo, reverse, half/double
speed — and Save As drops a .wav on the desktop that plays for this session).
**WMP9** (Luna-blue chrome, analyser bar visualization, seek/volume, playlist
of the MacLeod tracks; sits next to Winamp because XP shipped both).
All Programs ▸ Accessories ▸ Entertainment holds the three, plus Run names
(sndvol32, sndrec32, wmplayer).

## Phase 11 — the games (the shock phase)

- **Solitaire** — the real deal: draw-three, timed scoring, right-click auto-move, and
  the win cascade. Real card faces from the classic deck, not drawn ones.
- **3D Pinball: Space Cadet** — the actual game. The original was decompiled
  (k4zmu2a/SpaceCadetPinball) and has working WebAssembly ports with the original
  tables and sounds. Vendor a wasm build behind its own window; lazy-load so first
  paint never pays for it. This is the single biggest "no way this is real" moment
  available to us.
- **Spider / FreeCell** — same deck, much smaller lift than Solitaire once it exists.

### Phase 11 status (2026-08-10)

Shipped: **3D Pinball: Space Cadet — the real one.** alula's emscripten build
of the k4zmu2a decompilation, vendored under `public/pinball/` (7 MB: wasm +
data + glue), loaded in an iframe only when the window opens, so first paint
never pays for it. Our window provides the XP chrome; injected CSS removes the
port's own fake title bar and centres the native 600x440 table. Games ▸
Pinball and Run ▸ pinball. First paint unchanged.

Watch-outs recorded: `npx serve` squats ports with SPA fallback that turns
every 404 into index.html — test against `python -m http.server`. A plain
`.win-body` is not a flex column; iframe children collapse to the 300x150
default unless the body has the `pad` class.

**3D Pinball: scrapped (2026-08-10), owner's call.** It ran — after a redirect
fix, a host-page rewrite, a compositor bypass and a canvas-sizing race fix —
but on the owner's real hardware the input latency was bad and it fought the
shell for focus (plunger charge lagging, clicks landing in the arena). Wasm
via iframe inside a busy multiplayer page is a bad marriage; the 7 MB is gone
from the repo. Games keeps Solitaire and Minesweeper; Pinball sits disabled
in the menu like it is simply not installed. The four fixes it forced were
all real and stay (trailing-slash iframes, quit-on-close, focus discipline).

Also shipped: **Solitaire** — rjanjic/js-solitaire (MIT), which already wears
the classic Windows deck and felt. Same recipe: vendored under
`public/solitaire/` (44 KB), lazy iframe, our chrome over its game, its
"New game" menu kept. Games ▸ Solitaire and Run ▸ sol. The "You are already
gambling" gag is gone; the real game is funnier.

Still owed from Phase 11: Spider/FreeCell, only if wanted — same vendor
approach or not at all.

## Phase 12 — the maintenance apps (delver bait, round two)

- **Task Manager's other tabs** — Applications (with the window list and End Task),
  Performance (the real CPU/PF history graphs, live), Networking, Users. The tray CPU
  graph icon while it is open.
- **MSConfig** — Startup tab with plausible entries and checkboxes that persist,
  BOOT.INI tab, Services tab cross-linked to the Services console that already exists.
- **System Restore** — the calendar picker, restore points created at real moments
  (first boot, scheme change, wallpaper change), and restoring genuinely reverts the
  cosmetic state: wallpaper, theme, pointer scheme, saver. Nothing money-adjacent.
- **Scheduled Tasks**, the **Fonts folder** (every font actually shipped, with the
  preview window), **Folder Options** (all three tabs incl. the Advanced checkbox
  tree, and the ones that can work, work), **Recycle Bin Properties** (per-drive
  slider), **Add or Remove Programs** with sizes and the usage-frequency bars,
  **ClearType tuner**, **Accessibility** (Magnifier and On-Screen Keyboard genuinely
  running; the OSK types into the focused window).

### Phase 12 status (2026-08-10)

**Task Manager** — done in the previous pass: five tabs, real Commit Charge (JS heap),
real Networking (socket traffic), End Process with XP's warning, tray CPU meter.

**System Restore, MSConfig, Folder Options** — done, `src/sysmaint.js` (import-free
sibling module, wired through `main.js`).

- **System Restore** (`rstrui`, Start → Accessories → System Tools): the real wizard —
  welcome radios, the bold-dates calendar, the per-day point list, the confirm page, the
  progress run, "Restoration Complete", and "Undo my last restoration" once you have
  restored something. Points are taken at real moments: a System Checkpoint on the first
  boot of each calendar day, a display change, a pointer-scheme change, an MSConfig
  apply, and any point you create by hand. Twelve are kept, and a manual point outlives
  an automatic one.
  A restore genuinely reverts: wallpaper (incl. the Paint-set one and its mode), screen
  saver and wait, pointer scheme, the CRT switch, Control Panel view, desktop icon
  arrangement switches, taskbar switches, Explorer view, Folder Options and the startup
  list. **The snapshot has no money in it** — no wallet, no cursors, no bin, no rakeback.
  Those are the server's and this window cannot touch them, which is the whole selection
  rule for what goes in a restore point.
- **MSConfig** (`msconfig`, Administrative Tools): six tabs. General's three startup
  modes drive the Startup tab and vice-versa. BOOT.INI is generated, not decorative —
  `/SOS` really turns on the verbose boot and `timeout=` really sets how long the boot
  screen sits there. Services lists the same table the Services console owns and toggles
  it through the same code path (the house's own services still refuse with Error 5).
  Startup is load-bearing: `SoundMan` owns the tray volume icon, `winampa` the Winamp
  quick-launch button, `cursors` the tray phase chip, `msmsgs` whether Messenger signs in
  at boot (unchecked, the lobby stays quiet until you open the window yourself). Changes
  apply on restart, like XP, and XP's nag dialog greets you on every boot until startup
  goes back to Normal.
- **Folder Options** (`control folders`, or Explorer → Tools, or Control Panel): three
  tabs. Working switches: common tasks vs classic folders (the blue pane), single-click
  vs double-click (Explorer *and* the desktop), show hidden files, hide known extensions,
  full path in the title bar, show Control Panel in My Computer, and "display the
  contents of system folders" — off, `C:\WINDOWS` shows XP's "These files are hidden"
  page with the link that puts them back. File Types lists the real extension table
  Explorer types files with.

Verified by CDP probe on the built dist: a manual point taken, the wallpaper set to
(None), a restore performed, and the wallpaper genuinely back to Bliss with the undo
point recorded; the startup list unchecked, restarted, and the tray icons gone on the
other side; the nag on the boot after that.

**Second pass** — Add or Remove Programs, the Fonts folder, Recycle Bin Properties,
the ClearType tuner, and Task Manager's menubar. Also in `src/sysmaint.js`.

- **Add or Remove Programs** (`appwiz.cpl`, or the Control Panel): all four pages.
  Change or Remove Programs lists what is installed with real sizes, and the usage
  column is real — the shell counts every window it opens, so "Frequently / Occasionally
  / Rarely" and "Last Used On" come off this computer's own history. Removing a program
  really removes it: the desktop shortcut, the All Programs entry, the Quick Launch
  button and the Run name all go, and the Run box gives XP's "Windows cannot find" for
  it afterwards. Add/Remove Windows Components puts any of it back. CURSORS.EXE and
  Internet Explorer refuse, and say why. Every install and removal takes a restore point
  first, so System Restore can undo a spree.
- **The Fonts folder** (`fonts`, Control Panel, or `C:\WINDOWS\Fonts` in Explorer):
  lists only fonts this computer can actually render — the check is a text measurement
  against two fallbacks, not a hardcoded list — and double-clicking one opens XP's
  preview window with the alphabets and the pangram at 12 through 72.
- **Recycle Bin Properties** (right-click the bin): the per-drive slider reads the real
  disk size, and both switches work. "Do not move files to the Recycle Bin" deletes
  immediately; "Display delete confirmation dialog" is XP's default and now really
  guards a delete. A dead cursor still goes to the bin either way: that is the disk
  writing a corpse, not a file operation.
- **ClearType tuner** (`cttune`): Standard / ClearType / No smoothing, applied to the
  whole shell. No smoothing is the aliased 1998 look and it is worth seeing once.
- **Task Manager's menubar** is no longer five dead words: File > New Task runs the Run
  box, Options > Always On Top and Minimize On Use work, View > Update Speed really is
  the refresh interval (Paused pauses it, and the tray meter stops lying), and Shut Down
  routes to the real stand-by, restart, turn-off and log-off flows.

**Third pass** — Scheduled Tasks and the accessibility set (`src/access.js`).

- **Scheduled Tasks** (`schedtasks`, Start > Accessories > System Tools): five tasks,
  and every one of them is something this computer really does — the daily System
  Checkpoint, the screen saver idle timer, Disk Cleanup, the defragmenter, and the
  autoplay watchdog that disarms autoplay ten minutes after the machine goes away.
  Run really runs the task and Last Run Time is when it last actually happened.
- **Magnifier** (`magnify`): XP's docked strip across the top of the screen, showing
  what the pointer is over at 2x to 9x. It magnifies the live desktop, not a picture of
  it: field contents and canvases are copied across on each re-clone, so a clock in the
  strip keeps ticking and the arena keeps moving.
- **On-Screen Keyboard** (`osk`): the full XP layout, and it types into whatever window
  had focus — Notepad, the Run box, the command prompt. Shift and Caps really change the
  key faces. It never steals focus, which is the whole trick.
- **Accessibility Options** (`access.cpl`, Control Panel): four tabs. High Contrast
  really repaints the shell black-and-yellow. ToggleKeys really beeps on the OSK's Caps.
  StickyKeys really latches a modifier — and five taps on Shift really summons the
  dialog asking whether you meant to.

Phase 12 is complete.

## Phase 13 — the mobile pass

### Phase 13 status, pass 1 (2026-08-10)

Everything below was found by driving the built site at 390x844 (CDP, DPR 2) and
looking at it, rather than by reasoning about the CSS.

**Bugs that were real**

- **The dial-up box behind Internet Explorer.** On the phone an app is a
  full-screen sheet, so a dialog that falls behind one is not behind a window, it
  is gone. Opening IE, switching to another app and coming back put IE's z above
  the dial-up dialog that was waiting for an answer — the browser looked frozen
  and offline with no way to connect. Dialogs now live in a z-band above every
  sheet and remember which sheet opened them: leave IE and the dial-up box goes
  with it, come back and it is there.
- **Cursors at nine pixels.** The arena is drawn small so the whole field fits
  and the sprites are counter-magnified back up; the floor for that (`0.52/AS`)
  was tuned for a monitor. On a phone it left an arrow 9x13. The mobile floor is
  now `0.95/AS` — about 16x25, a real XP arrow.
- **Every wrapped radio button in the app was invisible** — 0x0 at opacity 0, on
  desktop as much as on the phone, because xp.css only ever fixed checkboxes.
  Folder Options, System Restore, MSConfig, Group Policy and Accessibility were
  all showing labels with nothing to click.
- **The Start menu's left column was empty on the phone** until you opened an
  app: `renderMru()` only ran on first launch, and the phone boots to a bare
  desktop on purpose.
- **Solitaire was unplayable by touch** (the vendored game speaks
  `onmousedown`/`onmousemove` only) and only 4 of its 7 columns fit. It now has a
  one-finger touch bridge injected into the frame, and the board is scaled to
  the window instead of clipped.
- The volume flyout hung 2px off the right edge (clamped against a guessed width).

**Layout folded for a phone**

Add or Remove Programs (rail becomes a tab strip), System Restore (panes stack,
calendar full width), MSConfig / Folder Options / Recycle Bin Properties /
Accessibility (full-width dialogs, finger-height rows), the Fonts folder (three
columns), Scheduled Tasks (name and schedule only), Task Manager (panes fill the
sheet), the mixer (kept at its real 330px instead of stretching its sliders down
a 1200px sheet), Paint (a portrait canvas instead of a landscape one on a
portrait screen), and the On-Screen Keyboard (a docked palette above the HUD,
not a full-screen sheet). Menus, tabs, buttons, tray icons and Explorer rows are
all sized for a finger, and Explorer opens on a single tap.

**The desktop.** The crowded-shortcut collection covered the arena on a 390px
screen, so the phone shows the machine's own icons and leaves the `.lnk` ones in
All Programs. One column of icons, the field legible, cursors readable.

**Still to do**: a real-device pass (iOS Safari's viewport, `--kb`, safe areas,
the 100dvh dance), and the question of whether tapping your own cursor should
bank it — that is a gameplay verb, not a layout fix, so it waits for the owner.



Real-device pass on iPhone: the `--kb` path, long-press timing on every Round-2 menu,
and per-app calls on phone layout vs "rotate to landscape". Everything above must not
regress the phone shell it already has.

## Ordering

**8** (the sweep — compounding value, lands on every window at once) → **9** (daily-touch
apps, cheap) → **11** (games; Pinball is the flagship shock) → **10** (noise) → **12**
(maintenance) → **13** (mobile, always last).

## Standing constraints (unchanged)

Real assets only, never drawn. System apps stay cosmetic — nothing touches money,
rakeback, or another player. Copy stays flat and terse. Every phase ships with
a push to GitHub (Vercel builds `apps/web` from source), and anything that grows first
paint gets routed to `media/`.

## Game-side items parked for the owner's call

Not scheduled — these change gameplay, not fidelity, so they are decisions before they
are tasks:
- **Server-side autoplay** using the DB's `lastSeen` (deploys continue while the page is
  closed, THIN ICE-style). Changes the meaning of "online"; needs a design pass.
- The shortcut-arrow overlay icon: needs the real asset found, or it ships without.
- The guestbook and Hall of Pain in IE: still standing from Round 1 — keep (real player
  content) or demolish with the rest of the fiction. Owner has not ruled.

# Round 3 — after Phase 13 (2026-08-11)

The shell is finished enough that the remaining work is not "more windows". It is
the two things people actually do here — watch the TV and play the arena on a
phone — plus one honest sweep over everything already built.

## Phase 14 — cursorTV is a channel

IE is open on this desktop mostly to watch something with other people, so the
browser is judged as a television, not as a browser.

### Phase 14 status, pass 1 (2026-08-11)

- **The picture is sized in both directions.** The slot was a fixed 300px tall,
  so widening the window grew the video and making it taller did nothing. The
  stage is now 16:9 fitted inside whatever box IE has: width-bound when the
  window is wide, height-bound when it is short. Measured: 432x242 in a 742x394
  window, 780x438 after dragging it to 900x740.
- **Theater mode (F11).** Menu bar, both toolbars, the Links bar, the status bar
  and the Explorer bar step out; the page blanks down to the picture; the window
  maximizes and restores on the way out. Escape or the corner box leaves. It
  only blanks the page on the TV page (`cls: "tv"`) — on any other page F11 is
  IE without its furniture, which is what F11 always was. Measured: 1223x688 of
  a 1280x800 screen; 597x336 on a phone held sideways, against 265x148 with the
  chrome up.
- **Fewer words around it.** The page is the picture, one status line, the sound
  badge, the queue box and the decks. The header, the subtitle, the rotation
  paragraph and the deck preamble are gone; the rules are enforced by the
  server and stated when you hit one.
- **The room's clock.** Playback position is the server's, not the tab's. Every
  `tv` message now carries `srv: Date.now()` and the client keeps the difference,
  so a phone whose clock is two minutes fast no longer seeks two minutes past
  everyone. Old servers do not send it; the skew is then zero and nothing
  changes.
- **Time away is time missed.** A 2s watchdog compares this screen against the
  room and seeks if it is more than 2.5s out; pressing play after a pause
  rejoins at the room's position; coming back to the tab resyncs; reopening IE
  seeks instead of reloading (no black flash on every focus). The badge on the
  bar reads LIVE, or BEHIND and clicks to rejoin. Measured: joined a broadcast
  at 106s with the room at 106s, paused 11s and read BEHIND at 106 against 117,
  rejoined at 121/121.
- **A blocked embed says so.** The iframe API script is the first thing an ad
  blocker eats, and until now that failed silently — no player was built, so
  nothing timed out and the screen stayed black. There is now a 12s timeout on
  the API itself and on a player that never speaks, a panel naming the likely
  cause with a link to youtube.com, and recovery if YouTube answers late.
- **Dead links removed.** Free Hotmail and Windows Update sat in the Links bar
  and answered with "page cannot be displayed". The bar is now the five pages
  that exist. Windows Update in IE's Tools menu did the same thing from a third
  place; all three entry points now answer the question instead.

### Phase 14 status, pass 2 (2026-08-11) — shipped and deployed

Titles (oEmbed at queue time, cached in the queue entry, id fallback), timed
auto-advance (first able screen reports the duration; the server's timer ends
the video even with zero players open), error auto-skip (2/100/101/150 cast
their own vote), a watching count that means "page open and visible", theater
mode kept inside IE's window (owner's call: people park IE beside MSN), and the
duel-duck removed — the TV rides the mixer (master x Wave) like every program.
The beta box runs the new server; `tv.srv`/`tv.w` verified on the live wire.

### The audit (2026-08-11) — six agents over the whole tree

Every module, the CSS, and the server were read end-to-end by six parallel
auditors; ~60 verified findings, all P1/P2 and most P3s fixed same day
(commit 58acca0). Highlights: a reconnect inside the 7s grace bricked the
session (hello never re-sent); a pre-hello `null` frame crashed the server
process; stored XSS via the gallery png field; hidden-tab autoplay overshot
"keep live N" and never banked at xN; Messenger conversation menubars were
dead; Paint's curve tool drew loops; a double-click on Record orphaned a hot
mic; the desktop disk-critical pulse was killed by a duplicate keyframes name.
Server got hello/guest/gallery rate limits, a pre-hello reaper, persistent
gallery credits, and duration-gated tvEnded.

**Still open from the audit** (real, deferred): the Group Policy "Always show
duel odds" switch is a no-op (needs an odds render or a relabel); sim.players
never prunes offline visitors (fine at beta scale, wrong at production scale);
no WS origin allowlist (needs the prod domain decided first); crash-time
persistence runs synchronously per player inside the tick (batch it in one
transaction); renderIcons can destroy an in-progress icon rename.

### The intro (2026-08-11)

Start > How to Play / HUD Help > Quick Tour / Run > tour: five slides, real
captures of this build (live duel at 50:50, HUD, autoplay block, the BSOD,
theater-mode TV with the arena flying over it), three bullets each. Auto-opens
once on first logon in place of the old tray balloon; any close marks it seen.
Captures live in `apps/web/public/tour/` — recapture when the HUD changes.

### Still owed in 14

- **Titles, not ids.** The decks list `dQw4w9WgXcQ`. YouTube's oEmbed endpoint is
  CORS-open; fetch on queue, cache the title on the server so every screen shows
  the same string, fall back to the id when the fetch is blocked.
- **Dead air.** With an empty queue the screen is black and the page says so.
  Decide whether the channel replays the last thing, shows the arena, or stays
  black — a decision, not a task.
- **The watching count** is everyone connected, not everyone with the page open.
  The server knows `visible`; send that number instead.
- **Deploy the server.** The `srv` field needs the beta box restarted to exist.
  Nothing breaks until then.
- **Landscape prompt on a phone**: portrait gives a 360x202 picture and a lot of
  white below it. Either default to theater in landscape or say "turn it
  sideways" once.

## Phase 15 — the sweep: every window, four sizes, one list

Phase 13 found six bugs in an afternoon purely by looking at the built site at
390x844 instead of reasoning about it. Nothing has been looked at that way at
1024x768, and only some of it at 1280x800.

- Drive all ~70 windows with `scripts/sweep.mjs` at 1280x800, 1024x768, 390x844
  and **844x390**, open each one, screenshot it, and write down what is wrong.
  No fixing during the pass — the list first, so the shape of the problem is
  visible.
- **844x390 is not optional.** The mobile audit ran 118 findings and a large
  share of them existed only with the phone lying down; landscape was in no
  testing pass at the time. A phone on its side is its own layout — the money
  rail moves, the taskbar eats a third of the height — so it gets its own shot.
- Then fix in one pass, grouped by cause. Phase 13's radio-button bug was one
  CSS rule that had been breaking five apps for weeks; those are the wins here.
- Include the states that are hard to reach: an app opened from Run, an app
  opened twice, a window restored from minimized, a dialog whose parent closed,
  every menu with the window at its minimum size.
- Include the offline path: with the server down, every window that talks to it
  should say so in XP's voice rather than hang. The TV, the gallery, the
  guestbook, the hall, Messenger and the arena all have one.

## Phase 16 — the real-device pass (owner drives)

Headless Chromium cannot fake iOS Safari. Needs the owner's phone, and produces
a bug list the same way Phase 15 does.

- The viewport dance: `100dvh`, the URL bar growing and shrinking, `--kb` against
  a real software keyboard, safe areas in both orientations.
- Long-press timing against every Round-2 context menu (the desktop, Explorer,
  the tray, the taskbar, the TV page).
- Per-app call: which apps are worth using on a phone, which should say "rotate
  it", and which should not be in the phone's All Programs at all.
- Audio: iOS starts muted until a touch, and Winamp, the mixer, the dial-up
  handshake and cursorTV all assume a gesture has happened.

## Phase 17 — the shipping pass

The things that decide whether the beta survives contact with real players.

- **First paint** is 2.71 MB. Audit what is in it, move anything that is not the
  logon screen and the desktop behind a lazy load, and set a budget the
  postbuild script enforces.
- **The server runbook.** One document: how to deploy `server/`, how to restart
  without dropping the epoch, what the DB holds, what to do when the box fills.
  It exists as knowledge and not as a file.
- **Reconnect.** What the client does when the socket drops mid-fight: today it
  reconnects and resyncs, but nothing has tested it against a server that
  restarts under load.
- **The crash/epoch boundary on a phone** — the BSOD covers the sheet you were
  reading and there is no way to tell what happened afterwards.

## Ordering

**14** (finish the TV — it is what IE is for) → **15** (the sweep, biggest
compounding return) → **16** (real device, needs the owner) → **17** (shipping).
15 and 16 produce lists; both are two-pass phases and should be scheduled as
such.

## The final pass (2026-08-11) — seven readers, the phone, and a face

Shipped in three commits: `4c30003` (favicon/meta), `770c3f2` (the phone
pass), `25c1fbe` (the audit). Server redeployed to the beta box, health
verified live.

**Identity**: favicon.svg/.ico + apple-touch-icon rasterized from the ic-app
tile; og.jpg is a real 1200x630 capture of the desktop mid-fight; head grew
description/theme-color/og/twitter. og:image is root-relative until the prod
domain exists - make it absolute then.

**The phone pass** (owner's 8 hallway findings, all fixed): tour fires from
enterDesktop so every first visit sees it; long-press menus arm on a fresh
tap (no more open-then-instantly-close, no click-through on dismiss); taskbar
tabs activate on delegated pointerup (iOS drops clicks on rebuilt nodes);
icon drags claim the gesture (touch-action:none) and survive pointercancel;
CURSORS.EXE fullscreen no longer dims the arena (other sheets dim it .5,
was .16); rotation re-centers dialogs and re-stacks Winamp
(centerWindowsInContainer); the landscape phase chip wraps; toasts clear the
rail; recall gets a cancel verb (client+server `recallCancel` - recalling
cursors stay attackable so it dodges nothing; refused during shutdown).

**The audit** (7 agents, ~120 findings, all P1s and most P2s fixed same day):
worst were - a second tab kick-ponged the first forever while re-fetching the
gallery each cycle; Log Off desynced a live session; a busted wallet could
never reach the faucet; a hidden reconnect streamed 15Hz forever; Defrag
hard-froze the tab at 91% disk; the TV watchdog could kill a healthy player;
no WS backpressure (one non-reading socket = OOM); `vis` amplified full
resyncs; gallery replies up to 6.4 MB. Server got backpressure, vis
transition-gating, tv control throttles, tvDur cap 2h, galAdd single-item
broadcasts, process-level handlers, transaction crash-persist, and three
leak fixes (saveTimers, djLast, guestbook trim).

**Still open, decided against fixing today** (owner's call or bigger surgery):
gallery thumbnails (the structural egress fix, M); delta/binary snapshots
(~40-60% egress, M); spatial grid for the O(n^2) sim (matters past ~150
cursors, M); WMP viz rAF while paused; fileOp cancelled-flag latent trap;
fixTop/dlgTop fold ordering; humdrift animates `top`; floating windows on
phone landscape (design decision); authored-quip copy list (About boxes,
boot.ini, regedit flavor - see the report); the fidelity gap list lives in
the owner report of 2026-08-11.

## The fidelity build-out (2026-08-11, owner-approved: "ALL of these") 

Slop purge first (33ee987) - every authored quip replaced with what XP
would say. Then three waves: 00f2d46 (cmd arsenal: chkdsk/shutdown -s
countdown box/tracert/telnet/title/net send; winver; utilman; Ctrl+Esc;
TM process menu; CrashOnCtrlScroll; regedit writable PersonalMessage +
menus; Messenger menus; recovered-from-serious-error after crashes; the
green Windows Update site; Windows Classic style; charmap keystrokes),
581ce64 (Outlook Express wired end-to-end incl. the 0x800CCC0D dialup
truth; Event Viewer fed by the game's own journal; msinfo32; dxdiag with
the spinning cube; Calculator Scientific), and this commit (FreeCell
with Microsoft's real shuffle - #11982 authentically unwinnable; Spider
1/2/4 suits; the Solitaire win cascade with bounce trails; xyzzy;
Custom minefields; WordPad View/Insert/Format; Bush hid the facts;
Advanced volume; Narrator via speechSynthesis, mute-aware).

Still owed from the approved list: right-drag Move/Copy menu, CD
autoplay dialog, full-screen Log Off, taskbar toolbars (Address/Links/
Desktop), 3D Pipes teapot, Tour XP theater, Hearts, deeper WU catalog.

## The finish (2026-08-11) — the approved list, closed out

Field bugs (c57667f): My Computer vs Explorer's last path; cursorTV dead air;
the phone's dimmed arena, Winamp fit and clipped tour card; the lobby bots
silenced. The rickroll was the CSP harness queueing dQw4w9WgXcQ into the
SHARED deck on every run - it now pulls the YouTube resources itself and puts
nothing on the wire. iOS long-press (02beaf8): pointercancel is not a release;
iOS fires it the instant it claims the press for its own callout, and we were
treating that as the finger leaving. Only a release or real movement cancels
now, and the surfaces opt out of callout/selection.

Fidelity, wave four: FreeCell (Microsoft's real shuffle), Spider, Hearts
(240-game simulation, zero rule violations), the Solitaire win cascade, the
3D Pipes teapot, CD autoplay on a disc that is this machine's own soundtrack,
right-drag Move/Copy/Shortcut, the full-screen Log Off band with Switch User,
the three taskbar toolbars, PROMPT and %random%, and Tour Windows XP with the
genuine Bill Brown score (archive.org xptourmusicost, 2.3 MB, mixer-routed).

Dev note: `window.__open(id)` behind #desktop drives any window from a probe.

Not done, and why: Charmap's full Advanced view (the keystroke line covers the
delight); a deeper Windows Update catalog (the scan theater is the joke); and
Solitaire remains the vendored js-solitaire rather than a rewrite.
