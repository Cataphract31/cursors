/* The maintenance apps: System Restore, the System Configuration Utility and
   Folder Options.

   These three are the ones a delver goes looking for when they want to prove
   the desktop is a prop, so all three are load-bearing. System Restore takes a
   real snapshot of every cosmetic setting on the machine and really puts it
   back. MSConfig's Startup tab really stops things from starting. Folder
   Options really changes how Explorer and the desktop behave.

   What none of them touch: the wallet, the arena, the ledger, the corpses in
   the bin. A restore point is a photograph of the wallpaper, not of the money.
   Import-free sibling module; main.js injects the shell. */
export function initSysMaint(deps) {
  const { $, store, sysSnd, showError, showConfirm, openWin, closeWin, hooks } = deps;

  const el = (tag, cls, txt) => {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt != null) d.textContent = txt;
    return d;
  };
  const btn = (label, fn, wide) => {
    const b = el("button", "xbtn", label);
    b.style.minWidth = (wide || 78) + "px";
    b.addEventListener("click", fn);
    return b;
  };

  /* ================================================================
     0. the snapshot — what a restore point is made of
     ================================================================ */
  /* Everything in here is cosmetic and lives on this computer only. Nothing
     in here can be sold, lost or won. That is the whole selection rule. */
  const SNAP_KEYS = ["wallpaper", "wallpaperMode", "curScheme", "crt", "cplClassic",
    "iconSort", "alignGrid", "showIcons", "autoArr", "expView", "tbAuto", "lockTb",
    "tbDesk", "tbLinks", "tbAddr", "quickLaunch"];

  function snapshot() {
    const s = {};
    for (const k of SNAP_KEYS) s[k] = store.data[k];
    s.saver = Object.assign({}, store.data.saver);
    s.folderOpts = Object.assign({}, fo());
    s.msconfig = JSON.parse(JSON.stringify(mc()));
    return s;
  }
  function applySnapshot(s) {
    for (const k of SNAP_KEYS) if (k in s) store.data[k] = s[k];
    if (s.saver) store.data.saver = Object.assign({}, s.saver);
    if (s.folderOpts) store.data.folderOpts = Object.assign({}, s.folderOpts);
    if (s.msconfig) store.data.msconfig = JSON.parse(JSON.stringify(s.msconfig));
    store.save();
    hooks.applyCosmetic();
    applyStartup();
  }

  /* ================================================================
     1. System Restore (rstrui.exe)
     ================================================================ */
  const RP_MAX = 12;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function rps() { return (store.data.rp = store.data.rp || []); }
  /* a real moment on this machine gets a real restore point */
  function point(desc, kind) {
    const list = rps();
    const last = list[list.length - 1];
    /* XP coalesces: no second point for the same thing inside five minutes */
    if (last && last.d === desc && Date.now() - last.t < 5 * 60000) { last.t = Date.now(); last.snap = snapshot(); store.save(); return last; }
    const p = { t: Date.now(), d: desc, k: kind || "auto", snap: snapshot() };
    list.push(p);
    while (list.length > RP_MAX) {
      /* the oldest manual point outlives the oldest automatic one, like XP */
      const i = list.findIndex(x => x.k !== "manual");
      list.splice(i < 0 ? 0 : i, 1);
    }
    store.save();
    return p;
  }
  /* one checkpoint per calendar day, taken the first time the desktop loads */
  function dailyCheckpoint() {
    const today = new Date().toDateString();
    if (store.data.rpDay === today) return;
    store.data.rpDay = today;
    point(rps().length ? "System Checkpoint" : "System Checkpoint (first boot)", "auto");
  }

  const dayKey = t => new Date(t).toDateString();
  const timeStr = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dateStr = t => {
    const d = new Date(t);
    return DAYS[d.getDay()] + "day, " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  };

  let srScreen = "home", srMonth = null, srDay = null, srPick = null;

  function openRestore() {
    srScreen = "home"; srPick = null; srChoice = "restore";
    const now = new Date();
    srMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    srDay = now.toDateString();
    srRender();
    openWin("win-restore");
  }

  function srRender() {
    const head = $("#sr-title"), side = $("#sr-side"), main = $("#sr-main"), foot = $("#sr-foot");
    if (!head) return;
    side.innerHTML = ""; main.innerHTML = ""; foot.innerHTML = "";
    if (srScreen === "home") srHome(head, side, main, foot);
    else if (srScreen === "pick") srPickScreen(head, side, main, foot);
    else if (srScreen === "create") srCreateScreen(head, side, main, foot);
    else if (srScreen === "confirm") srConfirmScreen(head, side, main, foot);
    else if (srScreen === "working") srWorkingScreen(head, side, main, foot);
    else if (srScreen === "done") srDoneScreen(head, side, main, foot);
    else if (srScreen === "made") srMadeScreen(head, side, main, foot);
  }
  function srSideNotes(side, title, lines) {
    const box = el("div", "sr-box");
    box.appendChild(el("div", "sr-boxh", title));
    for (const l of lines) box.appendChild(el("div", "sr-boxp", l));
    side.appendChild(box);
  }

  function srHome(head, side, main, foot) {
    head.textContent = "Welcome to System Restore";
    srSideNotes(side, "To begin, select the task that you want to perform:", []);
    const mk = (val, label) => {
      const lab = el("label", "sr-radio");
      const r = el("input"); r.type = "radio"; r.name = "srtask"; r.value = val;
      r.checked = (srChoice === val);
      r.addEventListener("change", () => { srChoice = val; });
      lab.appendChild(r); lab.appendChild(el("span", null, label));
      side.appendChild(lab);
    };
    mk("restore", "Restore my computer to an earlier time");
    mk("create", "Create a restore point");
    if (store.data.rpUndo) mk("undo", "Undo my last restoration");

    main.appendChild(el("p", "sr-p", "You can use System Restore to undo harmful changes to your computer and restore its settings and performance. System Restore returns your computer to an earlier time (called a restore point) without causing you to lose recent work."));
    main.appendChild(el("p", "sr-p", "System Restore on this computer covers the desktop: the wallpaper, the theme, the pointer scheme, the screen saver, the shell options and the startup list. It does not cover your wallet, your cursors or the Recycle Bin. Those are held by the server."));
    const n = rps().length;
    main.appendChild(el("p", "sr-p dim", n
      ? n + " restore point" + (n === 1 ? "" : "s") + " on this computer, oldest " + dateStr(rps()[0].t) + "."
      : "No restore points yet. One is created the first time the desktop loads each day."));
    foot.appendChild(btn("Next >", () => {
      sysSnd("nav", .4);
      if (srChoice === "create") { srScreen = "create"; }
      else if (srChoice === "undo") { srPick = { t: store.data.rpUndo.t, d: "the restoration you performed", snap: store.data.rpUndo.snap, undo: 1 }; srScreen = "confirm"; }
      else {
        if (!rps().length) { showError("System Restore", "There are no restore points on this computer yet."); return; }
        srScreen = "pick";
      }
      srRender();
    }, 84));
    foot.appendChild(btn("Cancel", () => closeWin("win-restore")));
  }
  let srChoice = "restore";

  function srPickScreen(head, side, main, foot) {
    head.textContent = "Select a Restore Point";
    srSideNotes(side, "The calendar displays in bold all of the dates that have restore points available. The list displays the restore points that are available for the selected date.",
      ["Possible types of restore points are: system checkpoints (scheduled restore points created by your computer), manual restore points (restore points created by you), and installation restore points (automatic restore points created when certain programs are installed)."]);

    const grid = el("div", "sr-cols");
    /* --- the calendar --- */
    const cal = el("div", "sr-cal");
    const hd = el("div", "sr-calhead");
    const prev = el("button", "sr-arrow", "<");
    const next = el("button", "sr-arrow", ">");
    prev.addEventListener("click", () => { srMonth = new Date(srMonth.getFullYear(), srMonth.getMonth() - 1, 1); srRender(); });
    next.addEventListener("click", () => { srMonth = new Date(srMonth.getFullYear(), srMonth.getMonth() + 1, 1); srRender(); });
    hd.appendChild(prev);
    hd.appendChild(el("span", null, MONTHS[srMonth.getMonth()] + " " + srMonth.getFullYear()));
    hd.appendChild(next);
    cal.appendChild(hd);
    const gr = el("div", "sr-calgrid");
    for (const d of DAYS) gr.appendChild(el("span", "sr-caldow", d));
    const first = new Date(srMonth.getFullYear(), srMonth.getMonth(), 1);
    const days = new Date(srMonth.getFullYear(), srMonth.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first.getDay(); i++) gr.appendChild(el("span", "sr-calpad", ""));
    const marked = new Set(rps().map(p => dayKey(p.t)));
    for (let d = 1; d <= days; d++) {
      const key = new Date(srMonth.getFullYear(), srMonth.getMonth(), d).toDateString();
      const c = el("span", "sr-calday" + (marked.has(key) ? " has" : "") + (key === srDay ? " on" : ""), String(d));
      if (marked.has(key)) c.addEventListener("click", () => { srDay = key; srPick = null; srRender(); });
      gr.appendChild(c);
    }
    cal.appendChild(gr);
    grid.appendChild(cal);

    /* --- the points on the selected day --- */
    const listWrap = el("div", "sr-listwrap");
    listWrap.appendChild(el("div", "sr-listhead", srDay ? new Date(srDay).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "No date selected"));
    const list = el("div", "sr-list");
    const today = rps().filter(p => dayKey(p.t) === srDay).sort((a, b) => b.t - a.t);
    if (!today.length) list.appendChild(el("div", "sr-empty", "There are no restore points for this date."));
    for (const p of today) {
      const row = el("div", "sr-row" + (srPick === p ? " on" : ""));
      row.appendChild(el("span", "sr-rowt", timeStr(p.t)));
      row.appendChild(el("span", "sr-rowd", p.d + (p.k === "manual" ? " (manual)" : "")));
      row.addEventListener("click", () => { srPick = p; srRender(); });
      row.addEventListener("dblclick", () => { srPick = p; srScreen = "confirm"; srRender(); });
      list.appendChild(row);
    }
    listWrap.appendChild(list);
    grid.appendChild(listWrap);
    main.appendChild(grid);

    foot.appendChild(btn("< Back", () => { srScreen = "home"; srRender(); }, 84));
    const nx = btn("Next >", () => { if (srPick) { srScreen = "confirm"; srRender(); } }, 84);
    nx.disabled = !srPick;
    foot.appendChild(nx);
    foot.appendChild(btn("Cancel", () => closeWin("win-restore")));
  }

  function srCreateScreen(head, side, main, foot) {
    head.textContent = "Create a Restore Point";
    srSideNotes(side, "Your computer automatically creates restore points at regularly scheduled times or before you install certain programs. However, you can use System Restore to create your own restore points at times other than those scheduled by your computer.", []);
    main.appendChild(el("p", "sr-p", "Type a description for your restore point in the following text box. Ensure that you choose a description that is easy to identify in case you need to restore your computer later."));
    main.appendChild(el("div", "sr-p b", "Restore point description:"));
    const inp = el("input", "sr-input");
    inp.type = "text"; inp.maxLength = 48; inp.spellcheck = false;
    inp.addEventListener("keydown", e => e.stopPropagation());
    main.appendChild(inp);
    main.appendChild(el("p", "sr-p dim", "The current date and time are added automatically to your restore point. This restore point cannot be changed after it is created."));
    setTimeout(() => inp.focus(), 30);
    foot.appendChild(btn("< Back", () => { srScreen = "home"; srRender(); }, 84));
    foot.appendChild(btn("Create", () => {
      const d = inp.value.trim();
      if (!d) { showError("System Restore", "You must type a description for your restore point."); return; }
      srPick = point(d, "manual");
      sysSnd("nav", .45);
      srScreen = "made"; srRender();
    }, 84));
    foot.appendChild(btn("Cancel", () => closeWin("win-restore")));
  }

  function srMadeScreen(head, side, main, foot) {
    head.textContent = "Restore Point Created";
    srSideNotes(side, "The restore point you created is now on the list. You can restore your computer to this point at any time.", []);
    main.appendChild(el("p", "sr-p b", srPick.d));
    main.appendChild(el("p", "sr-p", dateStr(srPick.t) + " " + timeStr(srPick.t)));
    main.appendChild(el("p", "sr-p dim", "This point remembers the wallpaper, the theme, the pointer scheme, the screen saver, the shell options and the startup list as they are right now."));
    foot.appendChild(btn("Home", () => { srScreen = "home"; srRender(); }, 84));
    foot.appendChild(btn("Close", () => closeWin("win-restore")));
  }

  function srConfirmScreen(head, side, main, foot) {
    head.textContent = srPick.undo ? "Confirm Restoration Undo" : "Confirm Restore Point Selection";
    srSideNotes(side, "This process does not cause you to lose recent work, and it is completely reversible.", []);
    main.appendChild(el("p", "sr-p b", dateStr(srPick.t)));
    main.appendChild(el("p", "sr-p b", timeStr(srPick.t) + "  " + srPick.d));
    main.appendChild(el("p", "sr-p", "This computer will be returned to the state it was in on the date and time listed above."));
    const warn = el("div", "sr-warn");
    warn.appendChild(el("div", "sr-warnh", "Important: Save and close all open programs before continuing."));
    warn.appendChild(el("div", "sr-warnp", "System Restore rewrites the desktop settings on this computer. Your wallet, your deployed cursors, your rakeback and the corpses in the Recycle Bin are held by the server and are not affected by anything on this screen."));
    main.appendChild(warn);
    foot.appendChild(btn("< Back", () => { srScreen = srPick.undo ? "home" : "pick"; srRender(); }, 84));
    foot.appendChild(btn("Next >", () => { srScreen = "working"; srRender(); }, 84));
    foot.appendChild(btn("Cancel", () => closeWin("win-restore")));
  }

  function srWorkingScreen(head, side, main, foot) {
    head.textContent = "Restoration In Progress";
    srSideNotes(side, "Do not turn off your computer while the restoration is in progress.", []);
    main.appendChild(el("p", "sr-p", "Please wait while your settings are restored."));
    const bar = el("div", "xprog");
    const fill = el("div", "xprog-in");
    bar.appendChild(fill); main.appendChild(bar);
    const step = el("div", "sr-p dim", "Initializing restore...");
    main.appendChild(step);
    const STEPS = ["Initializing restore...", "Reading restore point...", "Restoring desktop settings...",
      "Restoring shell configuration...", "Restoring startup items...", "Finalizing..."];
    let i = 0;
    const t = setInterval(() => {
      i++;
      fill.style.width = Math.min(100, Math.round(i / STEPS.length * 100)) + "%";
      step.textContent = STEPS[Math.min(i, STEPS.length - 1)];
      if (i >= STEPS.length) {
        clearInterval(t);
        /* the undo point is taken from where we are standing, not from the target */
        if (!srPick.undo) store.data.rpUndo = { t: Date.now(), snap: snapshot() };
        else store.data.rpUndo = null;
        applySnapshot(srPick.snap);
        sysSnd("nav", .5);
        srScreen = "done"; srRender();
      }
    }, 360);
  }

  function srDoneScreen(head, side, main, foot) {
    head.textContent = "Restoration Complete";
    srSideNotes(side, "If you are not satisfied with the results of this restoration, you can undo it from the System Restore welcome screen.", []);
    main.appendChild(el("p", "sr-p", "Your computer has been successfully restored to:"));
    main.appendChild(el("p", "sr-p b", dateStr(srPick.t) + " " + timeStr(srPick.t)));
    main.appendChild(el("p", "sr-p b", srPick.d));
    main.appendChild(el("p", "sr-p dim", "The wallpaper, theme, pointer scheme, screen saver, shell options and startup list are back where they were. Your balance is untouched."));
    foot.appendChild(btn("Home", () => { srScreen = "home"; srRender(); }, 84));
    foot.appendChild(btn("Close", () => closeWin("win-restore")));
  }

  /* ================================================================
     2. System Configuration Utility (msconfig.exe)
     ================================================================ */
  const STARTUP = [
    { id: "ctfmon", item: "ctfmon", cmd: "C:\\WINDOWS\\system32\\ctfmon.exe",
      loc: "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" },
    { id: "msmsgs", item: "msmsgs", cmd: '"C:\\Program Files\\Messenger\\msmsgs.exe" /background',
      loc: "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" },
    { id: "winampa", item: "winampa", cmd: "C:\\Program Files\\Winamp\\winampa.exe",
      loc: "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" },
    { id: "soundman", item: "SoundMan", cmd: "SOUNDMAN.EXE",
      loc: "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" },
    { id: "cursors", item: "cursors", cmd: '"C:\\Program Files\\CURSORS.EXE\\cursors.exe" /tray',
      loc: "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" },
    { id: "wallet", item: "wallet", cmd: "rundll32.exe wallet.dll,PhantomWatch",
      loc: "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" },
  ];
  const BOOTSW = [
    { id: "safeboot", label: "/SAFEBOOT" },
    { id: "noguiboot", label: "/NOGUIBOOT" },
    { id: "bootlog", label: "/BOOTLOG" },
    { id: "basevideo", label: "/BASEVIDEO" },
    { id: "sos", label: "/SOS" },
  ];
  function mc() {
    const d = store.data.msconfig = store.data.msconfig || {};
    if (!d.mode) d.mode = "normal";
    if (!d.start) { d.start = {}; for (const s of STARTUP) d.start[s.id] = 1; }
    if (!d.sel) d.sel = { sysini: 1, winini: 1, services: 1, startup: 1, bootini: 1 };
    if (!d.boot) d.boot = { timeout: 30 };
    return d;
  }
  /* one function decides whether a startup item runs, so General's radios and
     the Startup tab's checkboxes can never disagree */
  function startupOn(id) {
    const d = mc();
    if (d.mode === "diagnostic") return false;
    if (d.mode === "selective" && !d.sel.startup) return false;
    return !!d.start[id];
  }
  function applyStartup() { hooks.applyStartup(startupOn); }

  function bootIniText() {
    const d = mc();
    const sw = BOOTSW.filter(s => d.boot[s.id]).map(s => " " + s.label.toLowerCase()).join("");
    return "[boot loader]\ntimeout=" + (d.boot.timeout | 0) +
      "\ndefault=multi(0)disk(0)rdisk(0)partition(1)\\WINDOWS\n\n[operating systems]\n" +
      'multi(0)disk(0)rdisk(0)partition(1)\\WINDOWS="Windows XP Professional" /fastdetect' + sw + "\n" +
      'multi(0)disk(0)rdisk(0)partition(1)\\WINDOWS="Windows XP (last known good decision)" /safeboot /fastdetect\n';
  }

  const INI_SYSTEM = [
    "[386Enh]", "woafont=dosapp.fon", "EGA80WOA.FON=EGA80WOA.FON", "EGA40WOA.FON=EGA40WOA.FON",
    "CGA80WOA.FON=CGA80WOA.FON", "CGA40WOA.FON=CGA40WOA.FON", "[drivers]", "wave=mmdrv.dll",
    "timer=timer.drv", "[mci]",
  ];
  const INI_WIN = [
    "[windows]", "load=", "run=", "NullPort=None", "[Desktop]", "Wallpaper=Bliss.bmp",
    "TileWallpaper=0", "[Compatibility]", "CURSORS=0x00000008", "[MCI Extensions]", "wav=waveaudio",
  ];

  let mcDirty = false;
  function openMsconfig() {
    mc();
    mcDirty = false;
    mcRenderGeneral();
    mcRenderIni("#mcp-sys", INI_SYSTEM, "SYSTEM.INI");
    mcRenderIni("#mcp-win", INI_WIN, "WIN.INI");
    mcRenderBoot();
    mcRenderServices();
    mcRenderStartup();
    openWin("win-msconfig");
  }

  function mcRenderGeneral() {
    const host = $("#mcp-gen"); if (!host) return;
    const d = mc();
    host.innerHTML = "";
    const fs = el("fieldset", "mo-fs");
    fs.appendChild(el("legend", null, "Startup Selection"));
    const mkRadio = (val, label, note) => {
      const lab = el("label", "mc-radio");
      const r = el("input"); r.type = "radio"; r.name = "mcmode"; r.checked = d.mode === val;
      r.addEventListener("change", () => {
        d.mode = val; mcDirty = true;
        if (val === "normal") store.data.msNag = 0;   /* back to normal, no more nag */
        store.save(); mcRenderGeneral(); mcRenderStartup();
      });
      lab.appendChild(r); lab.appendChild(el("span", null, label));
      fs.appendChild(lab);
      if (note) fs.appendChild(el("div", "mc-note", note));
    };
    mkRadio("normal", "Normal Startup - load all device drivers and services");
    mkRadio("diagnostic", "Diagnostic Startup - load basic devices and services only");
    mkRadio("selective", "Selective Startup");
    const sub = el("div", "mc-sub");
    const SUBS = [["sysini", "Process SYSTEM.INI File"], ["winini", "Process WIN.INI File"],
      ["services", "Load System Services"], ["startup", "Load Startup Items"],
      ["bootini", "Use Original BOOT.INI"]];
    for (const [k, label] of SUBS) {
      const lab = el("label", "mc-check");
      const c = el("input"); c.type = "checkbox";
      c.checked = d.mode === "normal" ? true : d.mode === "diagnostic" ? false : !!d.sel[k];
      c.disabled = d.mode !== "selective";
      c.addEventListener("change", () => { d.sel[k] = c.checked ? 1 : 0; mcDirty = true; store.save(); mcRenderStartup(); });
      lab.appendChild(c); lab.appendChild(el("span", null, label));
      sub.appendChild(lab);
    }
    fs.appendChild(sub);
    host.appendChild(fs);
    const row = el("div", "mc-btnrow");
    row.appendChild(btn("Launch System Restore", () => { closeWin("win-msconfig"); openRestore(); }, 148));
    const ex = btn("Expand File...", () => showError("Expand File", "The installation source for this computer is the share it was served from. There is no local cabinet to expand."), 110);
    row.appendChild(ex);
    host.appendChild(row);
  }

  function mcRenderIni(sel, lines, name) {
    const host = $(sel); if (!host) return;
    host.innerHTML = "";
    host.appendChild(el("div", "small", "The " + name + " file is processed at startup. Clear a line to stop it being processed."));
    const box = el("div", "mc-inibox");
    for (const line of lines) {
      const lab = el("label", "mc-iniline");
      const c = el("input"); c.type = "checkbox"; c.checked = true; c.disabled = true;
      lab.appendChild(c); lab.appendChild(el("span", null, line));
      box.appendChild(lab);
    }
    host.appendChild(box);
    host.appendChild(el("div", "small dim", "Nothing on this computer reads " + name + ". The file is here because it was there."));
  }

  function mcRenderBoot() {
    const host = $("#mcp-boot"); if (!host) return;
    const d = mc();
    host.innerHTML = "";
    const box = el("div", "mc-inibox tall");
    for (const line of bootIniText().split("\n")) box.appendChild(el("div", "mc-bootline", line));
    host.appendChild(box);
    const row = el("div", "mc-bootrow");
    const fs = el("fieldset", "mo-fs");
    fs.appendChild(el("legend", null, "Boot Options"));
    for (const s of BOOTSW) {
      const lab = el("label", "mc-check");
      const c = el("input"); c.type = "checkbox"; c.checked = !!d.boot[s.id];
      c.addEventListener("change", () => {
        d.boot[s.id] = c.checked ? 1 : 0; mcDirty = true; store.save(); mcRenderBoot();
      });
      lab.appendChild(c); lab.appendChild(el("span", null, s.label));
      fs.appendChild(lab);
    }
    row.appendChild(fs);
    const to = el("div", "mc-timeout");
    to.appendChild(el("span", null, "Timeout:"));
    const inp = el("input"); inp.type = "number"; inp.min = "0"; inp.max = "99"; inp.value = String(d.boot.timeout | 0);
    inp.addEventListener("keydown", e => e.stopPropagation());
    inp.addEventListener("change", () => {
      d.boot.timeout = Math.max(0, Math.min(99, +inp.value || 0));
      mcDirty = true; store.save(); mcRenderBoot();
    });
    to.appendChild(inp);
    to.appendChild(el("span", null, "sec."));
    row.appendChild(to);
    host.appendChild(row);
    host.appendChild(el("div", "small dim", "/SOS lists the drivers as they load. The timeout is how long the boot screen sits there before the logon screen appears."));
  }

  function mcRenderServices() {
    const host = $("#mcp-svc"); if (!host) return;
    host.innerHTML = "";
    const hideMs = !!store.data.mcHideMs;
    host.appendChild(el("div", "small", "Services that load at startup. Clearing a service stops it on this computer only."));
    const box = el("div", "mc-svcbox");
    const list = hooks.services().filter(s => !hideMs || !s.local);
    for (const s of list) {
      const row = el("label", "mc-svcrow");
      const c = el("input"); c.type = "checkbox"; c.checked = s.state === "Started";
      c.addEventListener("change", () => {
        const ok = hooks.setService(s.name, c.checked);
        if (!ok) { c.checked = !c.checked; return; }
        mcDirty = true;
        mcRenderServices();
      });
      row.appendChild(c);
      row.appendChild(el("span", "mc-svcn", s.display));
      row.appendChild(el("span", "mc-svcm", s.local ? "Microsoft" : "CURSORS.EXE"));
      row.appendChild(el("span", "mc-svcs", s.state === "Started" ? "Running" : "Stopped"));
      box.appendChild(row);
    }
    host.appendChild(box);
    const foot = el("div", "mc-btnrow");
    const lab = el("label", "mc-check");
    const hc = el("input"); hc.type = "checkbox"; hc.checked = hideMs;
    hc.addEventListener("change", () => { store.data.mcHideMs = hc.checked ? 1 : 0; store.save(); mcRenderServices(); });
    lab.appendChild(hc); lab.appendChild(el("span", null, "Hide All Microsoft Services"));
    foot.appendChild(lab);
    foot.appendChild(btn("Services...", () => { closeWin("win-msconfig"); openWin("win-services"); }, 88));
    host.appendChild(foot);
  }

  function mcRenderStartup() {
    const host = $("#mcp-start"); if (!host) return;
    const d = mc();
    host.innerHTML = "";
    host.appendChild(el("div", "small", "Startup items load every time this computer starts. Clearing one really stops it."));
    const box = el("div", "mc-startbox");
    const hd = el("div", "mc-starthead");
    hd.appendChild(el("span", "mc-si", "Startup Item"));
    hd.appendChild(el("span", "mc-sc", "Command"));
    hd.appendChild(el("span", "mc-sl", "Location"));
    box.appendChild(hd);
    const locked = d.mode !== "normal" && !(d.mode === "selective" && d.sel.startup);
    for (const s of STARTUP) {
      const row = el("label", "mc-startrow");
      const c = el("input"); c.type = "checkbox";
      c.checked = startupOn(s.id); c.disabled = locked;
      c.addEventListener("change", () => {
        d.start[s.id] = c.checked ? 1 : 0;
        if (d.mode === "normal" && !c.checked) d.mode = "selective";
        mcDirty = true; store.save(); mcRenderGeneral(); mcRenderStartup();
      });
      row.appendChild(c);
      row.appendChild(el("span", "mc-si", s.item));
      row.appendChild(el("span", "mc-sc", s.cmd));
      row.appendChild(el("span", "mc-sl", s.loc));
      box.appendChild(row);
    }
    host.appendChild(box);
    const foot = el("div", "mc-btnrow");
    foot.appendChild(btn("Enable All", () => { for (const s of STARTUP) d.start[s.id] = 1; d.mode = "normal"; mcDirty = true; store.save(); mcRenderGeneral(); mcRenderStartup(); }, 90));
    foot.appendChild(btn("Disable All", () => { for (const s of STARTUP) d.start[s.id] = 0; d.mode = "selective"; d.sel.startup = 1; mcDirty = true; store.save(); mcRenderGeneral(); mcRenderStartup(); }, 90));
    host.appendChild(foot);
  }

  function mcApply(close) {
    store.save();
    point("System Configuration Utility", "auto");
    if (close) closeWin("win-msconfig");
    if (!mcDirty) return;
    mcDirty = false;
    store.data.msNag = 1; store.save();
    showConfirm("System Configuration",
      "You must restart your computer for some of the changes made by System Configuration to take effect.\n\nRestart now?",
      () => { hooks.restart(); });
  }

  /* XP nags you on the next boot, every boot, until you tick the box */
  function maybeNag() {
    if (!store.data.msNag) return;
    if (mc().mode === "normal") { store.data.msNag = 0; store.save(); return; }
    showConfirm("System Configuration Utility",
      "You have used the System Configuration Utility to make changes to the way Windows starts.\n\n" +
      "The System Configuration Utility is currently in Diagnostic or Selective Startup mode, causing this message to be displayed and the utility to run every time Windows starts.\n\n" +
      "Choose the Normal Startup mode on the General tab to start Windows normally and undo the changes you made using the System Configuration Utility.\n\n" +
      "Open the System Configuration Utility now?",
      () => openMsconfig());
  }

  /* ================================================================
     3. Folder Options
     ================================================================ */
  const FO_DEF = { tasks: 1, browse: "same", click: "double", hidden: 1, ext: 0,
    fullpath: 0, addrpath: 1, sysfolders: 1, cplincomp: 1, tips: 1, simpleview: 1,
    remember: 1, restorewins: 0, sepproc: 0, ntfscolor: 1, simpleshare: 1,
    autonet: 1, sizetips: 1, protected: 1 };
  function fo() {
    const d = store.data.folderOpts = store.data.folderOpts || {};
    for (const k in FO_DEF) if (d[k] === undefined) d[k] = FO_DEF[k];
    return d;
  }
  /* the advanced tree, in XP's order. `k` means the switch is load-bearing. */
  const FO_ADV = [
    ["Files and Folders", [
      { t: "Automatically search for network folders and printers", k: "autonet" },
      { t: "Display file size information in folder tips", k: "sizetips" },
      { t: "Display simple folder view in Explorer's Folders list", k: "simpleview" },
      { t: "Display the contents of system folders", k: "sysfolders", real: 1 },
      { t: "Display the full path in the address bar", k: "addrpath" },
      { t: "Display the full path in the title bar", k: "fullpath", real: 1 },
      { t: "Hidden files and folders", radio: 1 },
      { t: "Hide extensions for known file types", k: "ext", real: 1 },
      { t: "Hide protected operating system files (Recommended)", k: "protected" },
      { t: "Launch folder windows in a separate process", k: "sepproc" },
      { t: "Remember each folder's view settings", k: "remember" },
      { t: "Restore previous folder windows at logon", k: "restorewins" },
      { t: "Show Control Panel in My Computer", k: "cplincomp", real: 1 },
      { t: "Show encrypted or compressed NTFS files in color", k: "ntfscolor" },
      { t: "Use simple file sharing (Recommended)", k: "simpleshare" },
    ]],
  ];

  function openFolderOptions() {
    foRender();
    openWin("win-foldopt");
  }
  function foRender() {
    foRenderGeneral();
    foRenderView();
    foRenderTypes();
  }
  function foRenderGeneral() {
    const host = $("#fo-gen"); if (!host) return;
    const d = fo();
    host.innerHTML = "";
    const group = (legend, rows) => {
      const fs = el("fieldset", "mo-fs");
      fs.appendChild(el("legend", null, legend));
      for (const r of rows) fs.appendChild(r);
      host.appendChild(fs);
    };
    const radio = (name, checked, label, fn) => {
      const lab = el("label", "mc-radio");
      const i = el("input"); i.type = "radio"; i.name = name; i.checked = checked;
      i.addEventListener("change", fn);
      lab.appendChild(i); lab.appendChild(el("span", null, label));
      return lab;
    };
    group("Tasks", [
      radio("fotask", !!d.tasks, "Show common tasks in folders", () => { d.tasks = 1; foApply(); }),
      radio("fotask", !d.tasks, "Use Windows classic folders", () => { d.tasks = 0; foApply(); }),
    ]);
    group("Browse folders", [
      radio("fobrowse", d.browse === "same", "Open each folder in the same window", () => { d.browse = "same"; foApply(); }),
      radio("fobrowse", d.browse === "new", "Open each folder in its own window", () => { d.browse = "new"; foApply(); }),
    ]);
    group("Click items as follows", [
      radio("foclick", d.click === "single", "Single-click to open an item (point to select)", () => { d.click = "single"; foApply(); }),
      radio("foclick", d.click === "double", "Double-click to open an item (single-click to select)", () => { d.click = "double"; foApply(); }),
    ]);
    const row = el("div", "mc-btnrow");
    row.appendChild(btn("Restore Defaults", () => {
      store.data.folderOpts = Object.assign({}, FO_DEF);
      foApply(); foRender(); sysSnd("nav", .4);
    }, 116));
    host.appendChild(row);
  }
  function foRenderView() {
    const host = $("#fo-adv"); if (!host) return;
    const d = fo();
    host.innerHTML = "";
    for (const [group, items] of FO_ADV) {
      host.appendChild(el("div", "io-advgroup", group));
      for (const it of items) {
        if (it.radio) {
          host.appendChild(el("div", "fo-advsub", it.t));
          for (const [val, label] of [[0, "Do not show hidden files and folders"], [1, "Show hidden files and folders"]]) {
            const lab = el("label", "io-advrow indent");
            const r = el("input"); r.type = "radio"; r.name = "fohidden"; r.checked = (!!d.hidden) === !!val;
            r.addEventListener("change", () => { d.hidden = val; foApply(); });
            lab.appendChild(r); lab.appendChild(document.createTextNode(label));
            host.appendChild(lab);
          }
          continue;
        }
        const lab = el("label", "io-advrow");
        const c = el("input"); c.type = "checkbox"; c.checked = !!d[it.k];
        c.addEventListener("change", () => { d[it.k] = c.checked ? 1 : 0; foApply(); });
        lab.appendChild(c);
        lab.appendChild(document.createTextNode(it.t));
        host.appendChild(lab);
      }
    }
    const foot = $("#fo-viewfoot");
    if (foot && !foot.dataset.wired) {
      foot.dataset.wired = "1";
      foot.appendChild(btn("Apply to All Folders", () => showError("Folder Views", "This computer has one folder window. Its view is already the view of all of them."), 130));
      foot.appendChild(btn("Reset All Folders", () => showError("Folder Views", "This computer has one folder window. There is nothing to reset."), 122));
      const r = btn("Restore Defaults", () => {
        for (const k in FO_DEF) if (k !== "tasks" && k !== "browse" && k !== "click") fo()[k] = FO_DEF[k];
        foApply(); foRenderView(); sysSnd("nav", .4);
      }, 116);
      r.style.marginLeft = "auto";
      foot.appendChild(r);
    }
  }
  const FILETYPES = [
    [".bmp", "Bitmap Image", "pics32", "Paint"],
    [".bat", "MS-DOS Batch File", "@ic-file", "Command Prompt"],
    [".cur", "Cursor", "@ic-cursor", "(none)"],
    [".doc", "WordPad Document", "note32", "WordPad"],
    [".dll", "Application Extension", "@ic-file", "(none)"],
    [".exe", "Application", "@ic-app", "(none)"],
    [".ini", "Configuration Settings", "@ic-file", "Notepad"],
    [".log", "Text Document", "note32", "Notepad"],
    [".mp3", "MP3 Audio", "music32", "Winamp"],
    [".png", "Bitmap Image", "pics32", "Windows Picture and Fax Viewer"],
    [".sys", "System file", "@ic-file", "(none)"],
    [".txt", "Text Document", "note32", "Notepad"],
    [".url", "Internet Shortcut", "ie32", "Internet Explorer"],
    [".wav", "Wave Sound", "wavdoc16", "Windows Media Player"],
  ];
  let ftSel = FILETYPES[11];
  function foRenderTypes() {
    const host = $("#fo-typelist"); if (!host) return;
    host.innerHTML = "";
    for (const t of FILETYPES) {
      const row = el("div", "fo-trow" + (ftSel === t ? " on" : ""));
      const ico = deps.icoNode(t[2]);
      ico.classList.add("fo-tico");
      row.appendChild(ico);
      row.appendChild(el("span", "fo-text", t[0].slice(1).toUpperCase()));
      row.appendChild(el("span", "fo-ttype", t[1]));
      row.addEventListener("click", () => { ftSel = t; foRenderTypes(); });
      host.appendChild(row);
    }
    const det = $("#fo-typedet");
    if (det) det.innerHTML = "Details for '" + ftSel[0] + "' extension<br>" +
      "Opens with: <b>" + ftSel[3] + "</b><br>" +
      "Files with extension '" + ftSel[0] + "' are of type '" + ftSel[1] + "'.";
  }
  function foApply() {
    store.save();
    hooks.folderOptions();
  }

  /* ================================================================
     4. wiring
     ================================================================ */
  function init() {
    /* the tabs are shell-standard; only the panes are ours */
    const ok = $("#mc-ok"), can = $("#mc-cancel"), app = $("#mc-apply"), hlp = $("#mc-help");
    if (ok) ok.addEventListener("click", () => mcApply(true));
    if (app) app.addEventListener("click", () => mcApply(false));
    if (can) can.addEventListener("click", () => closeWin("win-msconfig"));
    if (hlp) hlp.addEventListener("click", () => showError("System Configuration Utility",
      "This utility changes how this computer starts. Everything it touches is on this computer. The arena, the ledger and your balance start with the server and cannot be unchecked from here."));
    for (const [id, fn] of [["fo-ok", () => closeWin("win-foldopt")], ["fo-cancel", () => closeWin("win-foldopt")],
                            ["fo-apply", () => { foApply(); sysSnd("nav", .4); }]]) {
      const b = $("#" + id);
      if (b) b.addEventListener("click", fn);
    }
    applyStartup();
    /* the day's System Checkpoint belongs to the boot, not to the logon */
    dailyCheckpoint();
  }

  return {
    init, openRestore, openMsconfig, openFolderOptions,
    point, dailyCheckpoint, maybeNag,
    startupOn, applyStartup, bootIniText,
    /* the boot screen asks how long to sit there */
    bootWaitMs: () => Math.max(900, Math.min(99, mc().boot.timeout | 0) * 143),
    verboseBoot: () => !!mc().boot.sos,
    fo,
  };
}
