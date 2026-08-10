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

## Phase 13 — the mobile pass (unchanged, still last)

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
`upload/cursors/` rebuilt, and anything that grows first paint gets routed to `media/`.

## Game-side items parked for the owner's call

Not scheduled — these change gameplay, not fidelity, so they are decisions before they
are tasks:
- **Server-side autoplay** using the DB's `lastSeen` (deploys continue while the page is
  closed, THIN ICE-style). Changes the meaning of "online"; needs a design pass.
- The shortcut-arrow overlay icon: needs the real asset found, or it ships without.
- The guestbook and Hall of Pain in IE: still standing from Round 1 — keep (real player
  content) or demolish with the rest of the fiction. Owner has not ruled.
