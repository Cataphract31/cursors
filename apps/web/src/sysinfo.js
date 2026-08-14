/* Event Viewer, System Information and the DirectX Diagnostic Tool.
   Import-free sibling module, same contract as sysapps: main.js injects the
   shell (deps) and the build's smoke runner executes this file in node.

   All three consoles are read-only. They report the machine — the live game
   feed through hooks.appLog(), the session through hooks.sysLog() and
   hooks.uptime(), the field through hooks.cursorCount() — and change nothing.

   Wiring contract (see wiring-sysinfo.md):
     initSysInfo({ $, store, sysSnd, showMenu, showError, openWin, closeWin,
                   icoNode, tone?, hooks:{ appLog?, sysLog?, uptime?, tasks?,
                   cursorCount? } })
   returns { menus(label, winId), wake(winId), openEventvwr, openMsinfo,
             openDxdiag }. wake() builds and renders a console but never calls
   openWin, so the openWin(id) branch in main.js cannot re-enter itself. */
export function initSysInfo(deps) {
  const { $, showError, openWin, closeWin, hooks } = deps;

  const el = (tag, cls, txt) => {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt != null) d.textContent = txt;
    return d;
  };
  const zero2 = n => (n < 10 ? "0" : "") + n;
  const fmtDate = d => (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear();
  function fmtTime(d) {
    const h = ((d.getHours() + 11) % 12) + 1;
    return h + ":" + zero2(d.getMinutes()) + ":" + zero2(d.getSeconds()) + " " + (d.getHours() < 12 ? "AM" : "PM");
  }
  function upSecs() { try { return hooks.uptime ? Math.max(0, hooks.uptime() | 0) : 0; } catch (e) { return 0; } }
  function fmtUpLong(t) {
    const d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60);
    return d + " Days, " + h + " Hours, " + m + " Minutes, " + Math.floor(t % 60) + " Seconds";
  }

  /* ---- live values the three consoles share ---- */
  function uaModel() {
    const ua = navigator.userAgent;
    const m = /(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/.exec(ua) || [];
    const name = m[1] === "Edg" ? "Edge" : m[1] === "OPR" ? "Opera" : m[1] === "Version" ? "Safari" : m[1] || "Unknown";
    return name + (m[2] ? " " + m[2] : "") + (/Mobi/i.test(ua) ? " (mobile)" : "");
  }
  function memTotal() {
    const b = performance.memory && performance.memory.jsHeapSizeLimit;
    if (!b) return "1,024.00 MB";
    const s = (b / 1048576).toFixed(2), i = s.indexOf(".");
    return s.slice(0, i).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + s.slice(i) + " MB";
  }
  function intl() {
    try { const o = Intl.DateTimeFormat().resolvedOptions(); return { locale: o.locale || "en-US", tz: o.timeZone || "UTC" }; }
    catch (e) { return { locale: "en-US", tz: "UTC" }; }
  }
  const cpu = () => (navigator.hardwareConcurrency || 1) + " logical processor(s)";
  const OSNAME = "Microsoft Windows XP Professional";
  const OSVER = "5.1.2600 Service Pack 2 Build 2600";
  const HOST = "CURSORLAND";

  /* ================================================================
     1. Event Viewer — eventvwr.msc
     ================================================================ */
  const TYPES = {
    info: { label: "Information",
      svg: '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5.5" fill="#316AC5"/><rect x="5.1" y="4.9" width="1.8" height="4.2" fill="#fff"/><rect x="5.1" y="2.3" width="1.8" height="1.8" fill="#fff"/></svg>' },
    warn: { label: "Warning",
      svg: '<svg viewBox="0 0 12 12"><path d="M6 .8 11.6 11H.4Z" fill="#F7D440" stroke="#8A6D00" stroke-width=".6"/><rect x="5.2" y="3.8" width="1.6" height="3.5" fill="#000"/><rect x="5.2" y="8.4" width="1.6" height="1.5" fill="#000"/></svg>' },
    error: { label: "Error",
      svg: '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5.5" fill="#C00000"/><path d="M3.6 3.6 8.4 8.4M8.4 3.6 3.6 8.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>' },
    audit: { label: "Success Audit",
      svg: '<svg viewBox="0 0 12 12"><circle cx="3.8" cy="3.8" r="2.4" fill="none" stroke="#B8860B" stroke-width="1.4"/><path d="M5.6 5.6 10.6 10.6M8.4 8.4l1.5-1.5M9.9 9.9l1.3-1.3" stroke="#B8860B" stroke-width="1.3"/></svg>' },
  };
  function typeCell(t) {
    const k = TYPES[t] || TYPES.info;
    const s = el("span", "ev-type");
    s.innerHTML = k.svg;
    s.appendChild(el("span", null, k.label));
    return s;
  }

  const EVLOGS = ["Application", "Security", "System"];
  let evLog = "Application", evSel = -1, evRowsNow = [], evBuilt = false;

  /* Security = audit-success rows generated from the session start time */
  function secRows() {
    const start = Date.now() - upSecs() * 1000;
    const mk = (off, id, cat, text) =>
      ({ t: "audit", at: start + off * 1000, src: "Security", id, cat, user: "Administrator", text });
    return [
      mk(0, 512, "System Event", "Windows is starting up.\n\nThis event is logged when LSASS.EXE starts and the auditing subsystem is initialized."),
      mk(1, 515, "System Event", "A trusted logon process has registered with the Local Security Authority. This logon process will be trusted to submit logon requests.\n\n\tLogon Process Name:\tWinlogon"),
      mk(3, 528, "Logon/Logoff", "Successful Logon:\n\n\tUser Name:\tAdministrator\n\tDomain:\t\t" + HOST + "\n\tLogon Type:\t2\n\tLogon Process:\tUser32\n\tAuthentication Package:\tNegotiate\n\tWorkstation Name:\t" + HOST),
      mk(3, 576, "Privilege Use", "Special privileges assigned to new logon:\n\n\tUser Name:\tAdministrator\n\tDomain:\t\t" + HOST + "\n\tPrivileges:\tSeChangeNotifyPrivilege\n\t\t\tSeUndockPrivilege"),
      mk(4, 520, "Detailed Tracking", "A process has exited:\n\n\tImage File Name:\tC:\\WINDOWS\\system32\\userinit.exe\n\tUser Name:\tAdministrator"),
    ];
  }
  function evData() {
    let raw = [];
    try {
      if (evLog === "Application") raw = (hooks.appLog && hooks.appLog()) || [];
      else if (evLog === "System") raw = (hooks.sysLog && hooks.sysLog()) || [];
      else raw = secRows();
    } catch (e) { raw = []; }
    return raw.slice().sort((a, b) => (b.at || 0) - (a.at || 0));   /* newest first */
  }

  function evShell(body) {
    body.innerHTML = "";
    const bar = el("div", "menubar");
    bar.innerHTML = "<span>File</span><span>Action</span><span>View</span><span>Help</span>";
    body.appendChild(bar);
    const tb = el("div", "mmc-tb");
    for (const g of ["back", "fwd", "up", "sep", "show", "refresh", "sep", "help"])
      tb.appendChild(el("i", g === "sep" ? "mmc-tbsep" : "mmc-tbb " + g));
    body.appendChild(tb);
    const split = el("div", "mmc-split");
    const tree = el("div", "mmc-tree"); tree.id = "ev-tree";
    const right = el("div", "mmc-right");
    const list = el("div", "mmc-list"); list.id = "ev-list";
    right.appendChild(list);
    split.appendChild(tree);
    split.appendChild(right);
    body.appendChild(split);
    const st = el("div", "mmc-status"); st.id = "ev-status";
    body.appendChild(st);
  }
  function evTree() {
    const t = $("#ev-tree");
    if (!t) return;
    t.innerHTML = "";
    const root = el("div", "mmc-node root");
    root.appendChild(el("i", "mmc-tw open"));
    root.appendChild(el("span", "mmc-lbl", "Event Viewer (Local)"));
    t.appendChild(root);
    for (const name of EVLOGS) {
      const n = el("div", "mmc-node lvl1" + (name === evLog ? " sel" : ""));
      n.appendChild(el("i", "mmc-tw none"));
      n.appendChild(el("i", "ev-logico"));
      n.appendChild(el("span", "mmc-lbl", name));
      n.addEventListener("click", () => { evLog = name; evSel = -1; evTree(); evList(); });
      t.appendChild(n);
    }
  }
  function evList() {
    const list = $("#ev-list");
    if (!list) return;
    evRowsNow = evData();
    list.innerHTML = "";
    const head = el("div", "mmc-row mmc-head");
    for (const [t, c] of [["Type", "ev-ctype"], ["Date", "ev-cdate"], ["Time", "ev-ctime"], ["Source", "ev-csrc"], ["Category", "ev-ccat"], ["Event", "ev-cid"], ["User", "ev-cuser"]])
      head.appendChild(el("span", "mmc-c " + c, t));
    list.appendChild(head);
    evRowsNow.forEach((r, i) => {
      const d = new Date(r.at || Date.now());
      const row = el("div", "mmc-row" + (i === evSel ? " sel" : ""));
      const tc = el("span", "mmc-c ev-ctype");
      tc.appendChild(typeCell(r.t));
      row.appendChild(tc);
      row.appendChild(el("span", "mmc-c ev-cdate", fmtDate(d)));
      row.appendChild(el("span", "mmc-c ev-ctime", fmtTime(d)));
      row.appendChild(el("span", "mmc-c ev-csrc", r.src || ""));
      row.appendChild(el("span", "mmc-c ev-ccat", r.cat || "None"));
      row.appendChild(el("span", "mmc-c ev-cid", String(r.id != null ? r.id : 0)));
      row.appendChild(el("span", "mmc-c ev-cuser", r.user || "N/A"));
      row.addEventListener("click", () => {
        evSel = i;
        for (const x of list.querySelectorAll(".mmc-row.sel")) x.classList.remove("sel");
        row.classList.add("sel");
        evStatus();
      });
      row.addEventListener("dblclick", () => { evSel = i; evProps(i); });
      list.appendChild(row);
    });
    evStatus();
  }
  function evStatus() {
    const st = $("#ev-status");
    if (st) st.textContent = evLog + "  " + evRowsNow.length + " event(s)";
  }
  function evRefresh() { evTree(); evList(); }

  function evPropsText(r, d) {
    return "Event Type:\t" + (TYPES[r.t] || TYPES.info).label +
      "\nEvent Source:\t" + (r.src || "") +
      "\nEvent Category:\t" + (r.cat || "None") +
      "\nEvent ID:\t" + (r.id != null ? r.id : 0) +
      "\nDate:\t\t" + fmtDate(d) +
      "\nTime:\t\t" + fmtTime(d) +
      "\nUser:\t\t" + (r.user || "N/A") +
      "\nComputer:\t" + HOST +
      "\nDescription:\n" + (r.text || "");
  }
  /* the Event Properties dialog, in the shared MMC properties window */
  function evProps(i) {
    const rows = evRowsNow;
    if (!rows.length) return;
    i = Math.max(0, Math.min(rows.length - 1, i));
    evSel = i;
    const r = rows[i], d = new Date(r.at || Date.now());
    const b = $("#mmcprops-body");
    $("#win-mmcprops .title-bar-text").textContent = "Event Properties";
    b.innerHTML = "";
    b.appendChild(el("div", "xtabs on-one")).appendChild(el("span", "xtab on", "Event"));
    const grid = el("div", "ev-pgrid");
    const kv = (k, v) => {
      const row = el("div", "pr-row");
      row.appendChild(el("span", "pr-k", k));
      row.appendChild(el("span", "pr-v", v));
      grid.appendChild(row);
    };
    kv("Date:", fmtDate(d));
    kv("Time:", fmtTime(d));
    kv("Type:", (TYPES[r.t] || TYPES.info).label);
    kv("User:", r.user || "N/A");
    kv("Computer:", HOST);
    kv("Source:", r.src || "");
    kv("Category:", r.cat || "None");
    kv("Event ID:", String(r.id != null ? r.id : 0));
    const nav = el("div", "ev-pnav");
    const bU = el("button", "xbtn", "\u25B2");
    const bD = el("button", "xbtn", "\u25BC");
    const bC = el("button", "xbtn", "Copy");
    bU.disabled = i === 0;
    bD.disabled = i === rows.length - 1;
    bU.addEventListener("click", () => { evProps(i - 1); evList(); });
    bD.addEventListener("click", () => { evProps(i + 1); evList(); });
    bC.addEventListener("click", () => {
      try { navigator.clipboard.writeText(evPropsText(r, d)).catch(() => {}); } catch (e) {}
    });
    nav.appendChild(bU); nav.appendChild(bD); nav.appendChild(bC);
    grid.appendChild(nav);
    b.appendChild(grid);
    b.appendChild(el("div", "pr-k", "Description:"));
    const ta = el("textarea", "ev-pdesc");
    ta.readOnly = true;
    ta.value = r.text || "";
    b.appendChild(ta);
    const foot = el("div", "dlg-foot");
    for (const t of ["OK", "Cancel"]) {
      const btn = el("button", "xbtn", t);
      btn.addEventListener("click", () => closeWin("win-mmcprops"));
      foot.appendChild(btn);
    }
    b.appendChild(foot);
    openWin("win-mmcprops");
  }
  function evWake() {
    const body = $("#win-eventvwr .ev-body");
    if (!body) return;
    if (!evBuilt) { evBuilt = true; evShell(body); }
    evRefresh();
  }

  /* ================================================================
     2. System Information — msinfo32
     ================================================================ */
  function sumPage() {
    const i = intl();
    return { cols: ["Item", "Value"], rows: [
      ["OS Name", OSNAME],
      ["Version", OSVER],
      ["OS Manufacturer", "Microsoft Corporation"],
      ["System Name", HOST],
      ["System Manufacturer", "cursor$land"],
      ["System Model", uaModel()],
      ["System Type", "X86-based PC"],
      ["Processor", cpu()],
      ["Windows Directory", "C:\\WINDOWS"],
      ["Boot Device", "\\Device\\HarddiskVolume1"],
      ["Locale", i.locale],
      ["Time Zone", i.tz],
      ["Total Physical Memory", memTotal()],
      ["System Up Time", fmtUpLong(upSecs())],
    ] };
  }
  /* device names below echo Device Manager's, because they are the same machine */
  const irqPage = () => ({ cols: ["Resource", "Device"], rows: [
    ["IRQ 0", "System timer"],
    ["IRQ 1", "Standard 101/102-Key or Microsoft Natural PS/2 Keyboard"],
    ["IRQ 4", "Communications Port (COM1)"],
    ["IRQ 8", "System CMOS/real time clock"],
    ["IRQ 12", "PS/2 Compatible Mouse"],
    ["IRQ 13", "Numeric data processor"],
    ["IRQ 14", "Primary IDE Channel"],
  ] });
  const memPage = () => ({ cols: ["Range", "Device"], rows: [
    ["0x00000000-0x0009FFFF", "System board"],
    ["0x000A0000-0x000BFFFF", "cursor$land Bliss Accelerator 8 MB"],
    ["0xE0000000-0xE07FFFFF", "cursor$land Bliss Accelerator 8 MB"],
    ["0xFEC00000-0xFEC00FFF", "System board"],
  ] });
  function dispPage() {
    return { cols: ["Item", "Value"], rows: [
      ["Name", "cursor$land Bliss Accelerator 8 MB"],
      ["Adapter RAM", "8.00 MB (8,388,608 bytes)"],
      ["Resolution", screen.width + " x " + screen.height + " x 4294967296 colors"],
      ["Bits/Pixel", "32"],
      ["Device Pixel Ratio", String(window.devicePixelRatio || 1)],
      ["Monitor", "Plug and Play Monitor"],
    ] };
  }
  function inputPage() {
    let n = 0;
    try { n = hooks.cursorCount ? hooks.cursorCount() | 0 : 0; } catch (e) {}
    return { cols: ["Item", "Value"], rows: [
      ["Keyboard", "Standard 101/102-Key or Microsoft Natural PS/2 Keyboard"],
      ["Pointing Device", "PS/2 Compatible Mouse"],
      ["Arena Cursors", String(n)],
    ] };
  }
  function taskPage() {
    let t = [];
    try { t = (hooks.tasks && hooks.tasks()) || []; } catch (e) {}
    return { cols: ["Name", "Process ID"], rows: t.map(p => [p.name, String(p.pid)]) };
  }
  const startupPage = () => ({ cols: ["Program", "Location"], rows: [
    ["CURSORS.EXE", "Startup Folder"],
  ] });
  /* static but true: this is the Services console's list, states as shipped */
  const svcPage = () => ({ cols: ["Display Name", "State"], rows: [
    ["Alerter", "Stopped"],
    ["Automatic Updates", "Stopped"],
    ["ClipBook", "Stopped"],
    ["Commit-Reveal Fairness Provider", "Started"],
    ["CURSORS.EXE Arena Service", "Started"],
    ["Error Reporting Service", "Started"],
    ["Event Log", "Started"],
    ["Messenger", "Started"],
    ["Plug and Play", "Started"],
    ["Print Spooler", "Started"],
    ["Remote Access Connection Manager", "Started"],
    ["Remote Procedure Call (RPC)", "Started"],
    ["Task Scheduler", "Started"],
    ["Telnet", "Stopped"],
    ["Themes", "Started"],
    ["Windows Audio", "Started"],
    ["Windows Firewall/Internet Connection Sharing", "Stopped"],
    ["Windows Time", "Started"],
  ] });

  const MSI = [
    { n: "System Summary", page: sumPage },
    { n: "Hardware Resources", kids: [{ n: "IRQs", page: irqPage }, { n: "Memory", page: memPage }] },
    { n: "Components", kids: [{ n: "Display", page: dispPage }, { n: "Input", page: inputPage }] },
    { n: "Software Environment", kids: [{ n: "Running Tasks", page: taskPage }, { n: "Startup Programs", page: startupPage }, { n: "Services", page: svcPage }] },
  ];
  const msiOpen = new Set(["Hardware Resources", "Components", "Software Environment"]);
  let msiSel = "System Summary", msiFind = "", msiBuilt = false;

  function msiPageFor(name) {
    for (const n of MSI) {
      if (n.n === name && n.page) return n.page;
      if (n.kids) for (const k of n.kids) if (k.n === name) return k.page;
    }
    return null;
  }
  function msiShell(body) {
    body.innerHTML = "";
    const bar = el("div", "menubar");
    bar.innerHTML = "<span>File</span><span>Edit</span><span>View</span><span>Tools</span><span>Help</span>";
    body.appendChild(bar);
    const split = el("div", "mmc-split");
    const tree = el("div", "mmc-tree"); tree.id = "msi-tree";
    const right = el("div", "mmc-right");
    const list = el("div", "mmc-list"); list.id = "msi-list";
    right.appendChild(list);
    split.appendChild(tree);
    split.appendChild(right);
    body.appendChild(split);
    const find = el("div", "msi-find");
    find.appendChild(el("span", null, "Find what:"));
    const inp = el("input", "msi-findin");
    inp.id = "msi-findin";
    inp.setAttribute("spellcheck", "false");
    inp.addEventListener("input", () => { msiFind = inp.value.trim().toLowerCase(); msiList(); });
    find.appendChild(inp);
    const bF = el("button", "xbtn", "Find");
    bF.addEventListener("click", () => msiList());
    const bX = el("button", "xbtn", "Close Find");
    bX.addEventListener("click", () => { inp.value = ""; msiFind = ""; msiList(); });
    find.appendChild(bF);
    find.appendChild(bX);
    body.appendChild(find);
  }
  function msiTree() {
    const t = $("#msi-tree");
    if (!t) return;
    t.innerHTML = "";
    const root = el("div", "mmc-node root");
    root.appendChild(el("i", "mmc-tw open"));
    root.appendChild(el("span", "mmc-lbl", "System Information"));
    t.appendChild(root);
    for (const n of MSI) {
      const open = msiOpen.has(n.n);
      const d = el("div", "mmc-node lvl1" + (n.n === msiSel ? " sel" : ""));
      const tw = el("i", "mmc-tw" + (n.kids ? (open ? " open" : "") : " none"));
      if (n.kids) tw.addEventListener("click", e => {
        e.stopPropagation();
        open ? msiOpen.delete(n.n) : msiOpen.add(n.n);
        msiTree();
      });
      d.appendChild(tw);
      d.appendChild(el("span", "mmc-lbl", n.n));
      d.addEventListener("click", () => {
        if (n.page) { msiSel = n.n; msiTree(); msiList(); }
        else { open ? msiOpen.delete(n.n) : msiOpen.add(n.n); msiTree(); }
      });
      t.appendChild(d);
      if (n.kids && open) for (const k of n.kids) {
        const kd = el("div", "mmc-node lvl2" + (k.n === msiSel ? " sel" : ""));
        kd.appendChild(el("i", "mmc-tw none"));
        kd.appendChild(el("span", "mmc-lbl", k.n));
        kd.addEventListener("click", () => { msiSel = k.n; msiTree(); msiList(); });
        t.appendChild(kd);
      }
    }
  }
  function msiList() {
    const list = $("#msi-list");
    if (!list) return;
    const fn = msiPageFor(msiSel);
    const page = fn ? fn() : { cols: ["Item", "Value"], rows: [] };
    list.innerHTML = "";
    const head = el("div", "mmc-row mmc-head");
    head.appendChild(el("span", "mmc-c msi-citem", page.cols[0]));
    head.appendChild(el("span", "mmc-c msi-cval", page.cols[1]));
    list.appendChild(head);
    for (const [a, b] of page.rows) {
      if (msiFind && (a + " " + b).toLowerCase().indexOf(msiFind) < 0) continue;
      const r = el("div", "mmc-row");
      r.appendChild(el("span", "mmc-c msi-citem", a));
      r.appendChild(el("span", "mmc-c msi-cval", b));
      list.appendChild(r);
    }
  }
  function msiCopy() {
    const fn = msiPageFor(msiSel);
    if (!fn) return;
    const page = fn();
    const txt = "[" + msiSel + "]\n\n" + page.cols.join("\t") + "\n" +
      page.rows.map(r => r.join("\t")).join("\n");
    try { navigator.clipboard.writeText(txt).catch(() => {}); } catch (e) {}
  }
  function msiWake() {
    const body = $("#win-msinfo .msi-body");
    if (!body) return;
    if (!msiBuilt) { msiBuilt = true; msiShell(body); }
    msiTree();
    msiList();
  }

  /* ================================================================
     3. DirectX Diagnostic Tool — dxdiag
     ================================================================ */
  const DXTABS = ["System", "Display", "Sound", "Input"];
  let dxTab = 0, dxBuilt = false, dxTest = null, dxAC = null;

  function dxShell(body) {
    body.innerHTML = "";
    const tabs = el("div", "xtabs");
    tabs.id = "dx-tabs";
    DXTABS.forEach((t, i) => {
      const s = el("span", "xtab" + (i === dxTab ? " on" : ""), t);
      s.addEventListener("click", () => { dxTab = i; dxRender(); });
      tabs.appendChild(s);
    });
    body.appendChild(tabs);
    const pane = el("div", "dx-pane");
    pane.id = "dx-pane";
    body.appendChild(pane);
    const foot = el("div", "dx-foot");
    const bH = el("button", "xbtn", "Help");
    bH.disabled = true;
    const bN = el("button", "xbtn", "Next Page");
    bN.addEventListener("click", () => { dxTab = (dxTab + 1) % DXTABS.length; dxRender(); });
    const bS = el("button", "xbtn", "Save All Information...");
    bS.disabled = true;
    const bX = el("button", "xbtn", "Exit");
    bX.addEventListener("click", () => closeWin("win-dxdiag"));
    for (const b of [bH, bN, bS, bX]) foot.appendChild(b);
    body.appendChild(foot);
  }
  function dxKV(pane, k, v) {
    const r = el("div", "dx-row");
    r.appendChild(el("span", "dx-k", k));
    r.appendChild(el("span", "dx-v", v));
    pane.appendChild(r);
  }
  function dxRender() {
    const tabs = $("#dx-tabs"), pane = $("#dx-pane");
    if (!tabs || !pane) return;
    Array.prototype.forEach.call(tabs.children, (s, i) => { s.className = "xtab" + (i === dxTab ? " on" : ""); });
    pane.innerHTML = "";
    const name = DXTABS[dxTab];
    if (name === "System") {
      const i = intl();
      pane.appendChild(el("div", "dx-h", "System Information"));
      dxKV(pane, "Current Date/Time:", new Date().toLocaleString());
      dxKV(pane, "Computer Name:", HOST);
      dxKV(pane, "Operating System:", OSNAME + " (5.1, Build 2600)");
      dxKV(pane, "Language:", i.locale + " (" + i.tz + ")");
      dxKV(pane, "System Manufacturer:", "cursor$land");
      dxKV(pane, "System Model:", uaModel());
      dxKV(pane, "BIOS:", "Default System BIOS");
      dxKV(pane, "Processor:", cpu());
      dxKV(pane, "Memory:", memTotal());
      dxKV(pane, "System Up Time:", fmtUpLong(upSecs()));
      dxKV(pane, "DirectX Version:", "DirectX 9.0c (4.09.0000.0904)");
    } else if (name === "Display") {
      pane.appendChild(el("div", "dx-h", "Device"));
      dxKV(pane, "Name:", "cursor$ Standard VGA");
      dxKV(pane, "Manufacturer:", "cursor$land");
      dxKV(pane, "Chip Type:", "Bliss Accelerator");
      dxKV(pane, "DAC Type:", "Internal");
      dxKV(pane, "Approx. Total Memory:", "8.0 MB");
      dxKV(pane, "Current Display Mode:", window.innerWidth + " x " + window.innerHeight + " (32 bit) (60Hz)");
      dxKV(pane, "Device Pixel Ratio:", String(window.devicePixelRatio || 1));
      pane.appendChild(el("div", "dx-h", "DirectX Features"));
      dxKV(pane, "DirectDraw Acceleration:", "Enabled");
      dxKV(pane, "Direct3D Acceleration:", "Enabled");
      dxKV(pane, "AGP Texture Acceleration:", "Enabled");
      const btns = el("div", "dx-btns");
      const bT = el("button", "xbtn", "Test DirectDraw");
      bT.addEventListener("click", ddTest);
      const b3 = el("button", "xbtn", "Test Direct3D");
      b3.disabled = true;
      btns.appendChild(bT);
      btns.appendChild(b3);
      pane.appendChild(btns);
      pane.appendChild(el("div", "dx-h", "Notes"));
      pane.appendChild(el("div", "dx-notes", "No problems found."));
    } else if (name === "Sound") {
      pane.appendChild(el("div", "dx-h", "Device"));
      dxKV(pane, "Name:", "cursor$land Wave Device");
      dxKV(pane, "Driver Name:", "wdmaud.drv");
      dxKV(pane, "Version:", "5.1.2600.0 (English)");
      dxKV(pane, "Default Device:", "Yes");
      const btns = el("div", "dx-btns");
      const bT = el("button", "xbtn", "Test DirectSound");
      bT.addEventListener("click", dsTest);
      btns.appendChild(bT);
      pane.appendChild(btns);
      pane.appendChild(el("div", "dx-h", "Notes"));
      pane.appendChild(el("div", "dx-notes", "No problems found."));
    } else {
      pane.appendChild(el("div", "dx-h", "Input Related Devices"));
      const tbl = el("table", "dx-tbl");
      const hr = el("tr");
      hr.appendChild(el("th", null, "Device Name"));
      hr.appendChild(el("th", null, "Status"));
      tbl.appendChild(hr);
      const row = (n, s) => {
        const r = el("tr");
        r.appendChild(el("td", null, n));
        r.appendChild(el("td", null, s));
        tbl.appendChild(r);
      };
      row("Standard PS/2 Cursor", "Attached");
      let n = 0;
      try { n = hooks.cursorCount ? hooks.cursorCount() | 0 : 0; } catch (e) {}
      for (let i = 1; i <= n; i++) row("cursor$land Arena Cursor (" + i + ")", "Attached");
      pane.appendChild(tbl);
      pane.appendChild(el("div", "dx-h", "Notes"));
      pane.appendChild(el("div", "dx-notes", n ? "No problems found." : "No arena cursors are deployed."));
    }
  }

  /* --- Test DirectDraw: bouncing rectangle, then the spinning cube --- */
  function ddTestEnd(cancel) {
    if (!dxTest) return;
    cancelAnimationFrame(dxTest.raf);
    document.removeEventListener("keydown", dxTest.esc, true);
    if (cancel) { dxTest.ov.remove(); dxTest = null; return; }
    const dlg = el("div", "dx-testdlg");
    dlg.appendChild(el("div", null, "DirectDraw test complete."));
    dlg.appendChild(el("div", null, "Test successful?"));
    for (const t of ["Yes", "No"]) {
      const b = el("button", "xbtn", t);
      b.addEventListener("click", e => { e.stopPropagation(); dxTest.ov.remove(); dxTest = null; });
      dlg.appendChild(b);
    }
    dxTest.ov.appendChild(dlg);
    dxTest.done = true;
  }
  function ddTest() {
    if (dxTest) return;
    const ov = el("div", "dx-testov");
    const cv = el("canvas");
    ov.appendChild(cv);
    document.body.appendChild(ov);
    const W = cv.width = ov.clientWidth || window.innerWidth;
    const H = cv.height = ov.clientHeight || window.innerHeight;
    const g = cv.getContext("2d");
    const box = { x: W * .1, y: H * .12, w: Math.max(90, W * .12), h: Math.max(66, H * .1), vx: W / 260, vy: H / 320 };
    const L = { x: -.45, y: -.6, z: .66 };            /* light, roughly normalized */
    const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    const F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
    const t0 = performance.now();
    const st = { ov, cv, raf: 0, esc: null, done: false };
    dxTest = st;
    st.esc = e => { if (e.key === "Escape") { e.stopPropagation(); ddTestEnd(true); } };
    document.addEventListener("keydown", st.esc, true);
    ov.addEventListener("pointerdown", () => { if (!st.done) ddTestEnd(true); });
    function cube(t) {
      const a = t * 1.1, b = t * .7;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const d = 5, s = Math.min(W, H) * .22;
      const R = V.map(([x, y, z]) => {
        const x1 = x * ca - z * sa, z1 = x * sa + z * ca;
        const y1 = y * cb - z1 * sb, z2 = y * sb + z1 * cb;
        return [x1, y1, z2];
      });
      const P = R.map(([x, y, z]) => {
        const k = d / (d - z);
        return [W / 2 + x * k * s, H / 2 + y * k * s];
      });
      const faces = F.map(f => {
        const [A, B, C] = [R[f[0]], R[f[1]], R[f[2]]];
        let nx = (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]);
        let ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]);
        let nz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
        const cx = (R[f[0]][0] + R[f[2]][0]) / 2, cy = (R[f[0]][1] + R[f[2]][1]) / 2, cz = (R[f[0]][2] + R[f[2]][2]) / 2;
        if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; }   /* outward */
        const len = Math.hypot(nx, ny, nz) || 1;
        return { f, z: cz, nx: nx / len, ny: ny / len, nz: nz / len };
      }).filter(x => x.nz > 0).sort((p, q) => p.z - q.z);
      for (const fc of faces) {
        const sh = Math.round(70 + 165 * Math.max(0, fc.nx * L.x + fc.ny * L.y + fc.nz * L.z));
        g.fillStyle = "rgb(" + sh + "," + sh + "," + sh + ")";
        g.strokeStyle = "#000";
        g.beginPath();
        g.moveTo(P[fc.f[0]][0], P[fc.f[0]][1]);
        for (let i = 1; i < 4; i++) g.lineTo(P[fc.f[i]][0], P[fc.f[i]][1]);
        g.closePath();
        g.fill();
        g.stroke();
      }
    }
    function frame(now) {
      const t = (now - t0) / 1000;
      g.fillStyle = "#000";
      g.fillRect(0, 0, W, H);
      if (t < 4) {
        box.x += box.vx; box.y += box.vy;
        if (box.x < 0 || box.x + box.w > W) box.vx = -box.vx;
        if (box.y < 0 || box.y + box.h > H) box.vy = -box.vy;
        g.fillStyle = "#fff";
        g.fillRect(box.x, box.y, box.w, box.h);
      } else if (t < 12) {
        cube(t - 4);
      } else { ddTestEnd(false); return; }
      st.raf = requestAnimationFrame(frame);
    }
    st.raf = requestAnimationFrame(frame);
  }

  /* --- Test DirectSound: three tones through the machine's own mixer --- */
  function dsTest() {
    const seq = [[440, 0], [554, .45], [659, .9]];
    if (deps.tone) { for (const [f, d] of seq) deps.tone(f, .3, "sine", .12, d); return; }
    try {
      dxAC = dxAC || new (window.AudioContext || window.webkitAudioContext)();
      for (const [f, d] of seq) {
        const o = dxAC.createOscillator(), gn = dxAC.createGain();
        const t = dxAC.currentTime + d;
        o.type = "sine";
        o.frequency.value = f;
        gn.gain.setValueAtTime(.08, t);
        gn.gain.exponentialRampToValueAtTime(.0001, t + .3);
        o.connect(gn).connect(dxAC.destination);
        o.start(t);
        o.stop(t + .33);
      }
    } catch (e) {}
  }
  function dxWake() {
    const body = $("#win-dxdiag .dx-body");
    if (!body) return;
    if (!dxBuilt) { dxBuilt = true; dxShell(body); }
    dxRender();
  }

  /* ================================================================
     menubar menus for the delegated handler in main.js
     ================================================================ */
  function menus(label, winId) {
    const about = (t, b) => ({ label: "About " + t, action: () => showError("About " + t, b, true) });
    if (winId === "win-eventvwr") {
      if (label === "File") return [
        { label: "Options...", disabled: 1 }, { sep: 1 },
        { label: "Exit", action: () => closeWin(winId) }];
      if (label === "Action") return [
        { label: "Open Log File...", disabled: 1 },
        { label: "Save Log File As...", disabled: 1 },
        { label: "Clear all Events", disabled: 1 },
        { sep: 1 },
        { label: "Refresh", action: evRefresh },
        { sep: 1 },
        { label: "Properties", bold: 1, disabled: evSel < 0, action: () => evProps(evSel) }];
      if (label === "View") return [
        { label: "Add/Remove Columns...", disabled: 1 },
        { label: "Filter...", disabled: 1 },
        { sep: 1 },
        { label: "All Records", check: 1, disabled: 1 },
        { label: "Newest First", check: 1, disabled: 1 },
        { sep: 1 },
        { label: "Refresh", accel: "F5", action: evRefresh }];
      return [
        { label: "Help Topics", disabled: 1 }, { sep: 1 },
        about("Microsoft Management Console", "Microsoft Management Console\nVersion 5.1 (Build 2600)")];
    }
    if (winId === "win-msinfo") {
      if (label === "File") return [
        { label: "Save...", disabled: 1 },
        { label: "Export...", disabled: 1 },
        { sep: 1 },
        { label: "Exit", action: () => closeWin(winId) }];
      if (label === "Edit") return [
        { label: "Copy", accel: "Ctrl+C", action: msiCopy },
        { sep: 1 },
        { label: "Select All", disabled: 1 },
        { label: "Find What...", action: () => { const i = $("#msi-findin"); if (i) i.focus(); } }];
      if (label === "View") return [
        { label: "Refresh", accel: "F5", action: () => { msiTree(); msiList(); } },
        { sep: 1 },
        { label: "Basic Information", check: 1, disabled: 1 },
        { label: "Advanced Information", disabled: 1 },
        { sep: 1 },
        { label: "Remote Computer...", disabled: 1 }];
      if (label === "Tools") return [
        { label: "Net Diagnostics", disabled: 1 },
        { label: "System Restore", disabled: 1 },
        { label: "File Signature Verification Utility", disabled: 1 },
        { label: "DirectX Diagnostic Tool", action: () => { dxWake(); openWin("win-dxdiag"); } },
        { label: "Dr Watson", disabled: 1 }];
      return [
        { label: "Help Topics", disabled: 1 }, { sep: 1 },
        about("System Information", "System Information\nVersion 5.1 (Build 2600)")];
    }
    return [{ label: "(nothing here)", disabled: 1 }];
  }

  /* openWin(id) routes here; wake never calls openWin, so it cannot re-enter */
  function wake(id) {
    if (id === "win-eventvwr") evWake();
    else if (id === "win-msinfo") msiWake();
    else if (id === "win-dxdiag") dxWake();
  }

  return {
    menus,
    wake,
    openEventvwr: () => { evWake(); openWin("win-eventvwr"); },
    openMsinfo: () => { msiWake(); openWin("win-msinfo"); },
    openDxdiag: () => { dxWake(); openWin("win-dxdiag"); },
  };
}
