/* Windows Explorer — the address bar, the blue task pane, four view modes, and
   a C:\ drive that is a real (if fictional) tree. The disk fills up with your
   dead cursors, which is the only honest disk-usage metric this computer has.
   No asset imports here on purpose: the build's smoke runner executes this file
   in node, so it must stay pure JS. main.js injects icons + shell hooks. */

const MB = 1024 * 1024, GB = 1024 * MB;
const DISK = 20 * GB;   /* matches the server drive; the round clock lives on it */

export function initExplorer(deps) {
  /* icoNode is the shell's own resolver: it returns an <img> for a raster icon
     and an inline <svg><use> for the "@symbol" ones, so both kinds work here */
  const { IMG, els, store, sysSnd, showMenu, showError, icoNode, hooks } = deps;

  let path = "My Computer", hist = [], fwd = [], sel = null;
  let view = store.data.expView || "tiles";

  /* ---------- the drive ---------- */
  const f = (name, opts) => Object.assign({ name, kind: "file", ico: "note32", size: 4 * 1024 }, opts);
  const dir = (name, opts) => Object.assign({ name, kind: "folder", ico: "folder32", size: 0 }, opts);

  /* every dead cursor is a file on this disk, and that is why it is filling up */
  function deadBytes() { return hooks.deadCount() * 12 * MB; }
  /* online, the beta server owns the disk — its epoch corpses are the meter */
  function usedBytes() { const o = hooks.serverDisk && hooks.serverDisk(); return o ? o.used : 2.71 * GB + deadBytes(); }
  function freeBytes() { return Math.max(64 * MB, DISK - usedBytes()); }

  /* Search Companion state. `searching` swaps the blue task pane for the
     companion pane; results replace the listing until you navigate away. */
  let searching = false, results = null, searchQ = "", searchKind = "all";
  const BIN = "Recycle Bin";
  const HOME = "C:\\Documents and Settings\\Administrator";
  const DOCS = HOME + "\\My Documents";
  const PICS = DOCS + "\\My Pictures";

  /* folders are functions so the disk can answer with live state */
  const TREE = {
    /* The bin holds two kinds of thing: files you deleted, which can come back,
       and cursors that died, which cannot. Both take up space on the disk. */
    [BIN]: () => {
      const b = hooks.binContents();
      return b.files.map(fi => f(fi.label + (/\./.test(fi.label) ? "" : ".lnk"), {
        ico: fi.ico, size: 1024, file: fi, tile: "Deleted from Desktop",
        act: () => showError(fi.label, "This file is in the Recycle Bin.\nRestore it to the Desktop to open it."),
      })).concat(b.deaths.map(d => f(`${d.name}_${String(d.id).padStart(4, "0")}.cur`, {
        ico: "@ic-cursor", size: 12 * MB, dead: d,
        tile: `lost ${d.lostStr} · ${d.odds}:${100 - d.odds}`,
        act: () => hooks.deathCert(d),
      })));
    },
    "My Computer": () => [
      dir("Shared Documents", { ico: "shareddocs32", go: "C:\\Documents and Settings\\All Users\\Documents",
        group: "Files Stored on This Computer" }),
      dir(hooks.playerName() + "'s Documents", { ico: "docs32", go: DOCS, group: "Files Stored on This Computer" }),
      dir("Local Disk (C:)", { ico: "hdd32", go: "C:\\", kind: "drive", group: "Hard Disk Drives",
        tile: `${fmtSize(freeBytes())} free of ${fmtSize(DISK)}` }),
      dir("CD Drive (D:)", { ico: "cd32", kind: "drive", tile: "no disc", group: "Devices with Removable Storage",
        act: () => showError("D:\\", "Please insert a disc into drive D:.\n\nThere is no disc. There was never a disc.") }),
      dir("Control Panel", { ico: "@ic-cpl", tile: "System Folder", group: "Other",
        act: () => hooks.openWin("win-control") }),
    ],
    "C:\\": () => [
      dir("Documents and Settings", { go: "C:\\Documents and Settings" }),
      dir("Program Files", { ico: "progfolder32", go: "C:\\Program Files" }),
      dir("WINDOWS", { ico: "winfolder32", go: "C:\\WINDOWS" }),
      f("AUTOEXEC.BAT", { size: 0, ico: "@ic-file", act: () => txt("AUTOEXEC.BAT", "@ECHO OFF\nREM nothing to load. it is 2003 and this file is\nREM already vestigial.\n") }),
      f("boot.ini", { size: 211, ico: "@ic-file", act: () => txt("boot.ini", "[boot loader]\ntimeout=30\ndefault=multi(0)disk(0)rdisk(0)partition(1)\\WINDOWS\n\n[operating systems]\nmulti(0)disk(0)rdisk(0)partition(1)\\WINDOWS=\"Windows XP Professional\" /fastdetect\nmulti(0)disk(0)rdisk(0)partition(1)\\WINDOWS=\"Windows XP (last known good decision)\" /safeboot\n") }),
      f("CONFIG.SYS", { size: 0, ico: "@ic-file", act: () => txt("CONFIG.SYS", "REM this file is empty and has been for years.\n") }),
      f("pagefile.sys", { size: 768 * MB, ico: "@ic-file", hidden: 1,
        act: () => showError("pagefile.sys", "Access is denied.\n\nThis file is in use by the system, by which we mean it is holding your regrets in memory.") }),
    ],
    "C:\\Documents and Settings": () => [
      dir("Administrator", { ico: "openfolder32", go: HOME }),
      dir("All Users", { go: "C:\\Documents and Settings\\All Users" }),
    ],
    "C:\\Documents and Settings\\All Users": () => [
      dir("Documents", { ico: "shareddocs32", go: "C:\\Documents and Settings\\All Users\\Documents" }),
      dir("Start Menu", { act: () => hooks.openStart() }),
    ],
    "C:\\Documents and Settings\\All Users\\Documents": () => [
      f("house_rules.txt", { size: 1_204, act: () => txt("house_rules.txt",
        "1. every collision is EV-neutral.\n2. P(reaching xN) = 1/N. exactly.\n3. the only decision you make is when to bank.\n4. the house takes 1%. you get 2% back for playing.\n5. there is no rule 5. there is no secret.\n") }),
    ],
    [HOME]: () => [
      dir("Desktop", { ico: "openfolder32", go: HOME + "\\Desktop" }),
      dir("My Documents", { ico: "docs32", go: DOCS }),
      dir("Favorites", { go: HOME + "\\Favorites" }),
      f("NTUSER.DAT", { size: 512 * 1024, hidden: 1, ico: "@ic-file",
        act: () => showError("NTUSER.DAT", "Access is denied.\n\nEverything you have ever clicked is in this file.") }),
    ],
    [HOME + "\\Favorites"]: () => [
      /* the Favorites folder is the browser's bookmark list, and these really navigate */
      f("cursor$land.url", { size: 128, ico: "ie32", tile: "Internet Shortcut", act: () => hooks.browse("http://www.cursor.land/") }),
      f("the odds.url", { size: 128, ico: "ie32", tile: "Internet Shortcut", act: () => hooks.browse("http://www.cursor.land/odds.html") }),
      f("hall of fame.url", { size: 128, ico: "ie32", tile: "Internet Shortcut", act: () => hooks.browse("http://www.cursor.land/hall.html") }),
      f("THE CURSOR WEBRING.url", { size: 128, ico: "ie32", tile: "Internet Shortcut", act: () => hooks.browse("http://www.cursorwebring.org/") }),
      f("mumus page.url", { size: 128, ico: "ie32", tile: "Internet Shortcut", act: () => hooks.browse("http://mumu.tripod.com/") }),
      f("cursorbot (do not).url", { size: 128, ico: "ie32", tile: "Internet Shortcut", act: () => hooks.browse("http://deg404.neocities.org/") }),
    ],
    [HOME + "\\Desktop"]: () => hooks.desktopFiles().map(ic => (
      ic.app === "bin"
        ? dir(BIN, { ico: "bin32", go: BIN, tile: "System Folder" })
        : ic.kind === "folder"
        ? dir(ic.label, { ico: ic.ico, act: () => go(HOME + "\\Desktop\\" + ic.label) })
        : f(ic.label + (ic.app === "usertxt" || /\./.test(ic.label) ? "" : ".lnk"),
            { ico: ic.ico, size: 1024, act: () => hooks.openIcon(ic) })
    )),
    [DOCS]: () => [
      dir("My Pictures", { ico: "pics32", go: PICS }),
      dir("My Music", { ico: "music32", go: DOCS + "\\My Music" }),
      f("fights.log", { size: hooks.logSize(), act: () => hooks.openWin("win-log") }),
      f("README.txt", { size: 2_048, act: () => hooks.openWin("win-readme") }),
      /* whatever Send To > My Documents actually sent — the copy has to exist */
      ...(hooks.sentDocs ? hooks.sentDocs() : []).map(d =>
        f(d.label, { ico: d.ico, size: 4096, act: () => showError(d.label, "This file was sent here from the Desktop.") })),
    ],
    [DOCS + "\\My Music"]: () => hooks.tracks().map(t =>
      f(t.title + ".mp3", { size: 3.4 * MB, ico: "music32", act: () => hooks.openWin("win-amp") })),
    [PICS]: () => {
      const pics = (store.data.pictures || []).map((p, i) =>
        f(p.name, { size: Math.round(p.data.length * .75), ico: "pics32", pic: i, act: () => hooks.openPicture(p) }));
      return pics.length ? pics : [];
    },
    "C:\\Program Files": () => [
      dir("CURSORS.EXE", { ico: "progfolder32", go: "C:\\Program Files\\CURSORS.EXE" }),
      dir("Internet Explorer", { ico: "progfolder32", act: () => hooks.openWin("win-ie") }),
      dir("Messenger", { ico: "progfolder32", act: () => hooks.openWin("win-chat") }),
      dir("Winamp", { ico: "progfolder32", act: () => hooks.openWin("win-amp") }),
      dir("Windows NT", { ico: "progfolder32", go: "C:\\Program Files\\Windows NT" }),
    ],
    "C:\\Program Files\\Windows NT": () => [
      f("mspaint.exe", { size: 341 * 1024, ico: "paint32", act: () => hooks.openWin("win-paint") }),
      f("notepad.exe", { size: 68 * 1024, ico: "note32", act: () => hooks.openWin("win-readme") }),
    ],
    "C:\\Program Files\\CURSORS.EXE": () => [
      f("cursors.exe", { size: 1.2 * MB, ico: "@ic-app", act: () => hooks.openWin("win-cursors") }),
      f("arena.dll", { size: 284 * 1024, ico: "@ic-file", act: () => showError("arena.dll", "1280 x 800 logical units. Every player gets the same battlefield.\nThis file is the reason that is true.") }),
      f("rng.dll", { size: 96 * 1024, ico: "@ic-file", act: () => showError("rng.dll", "128-bit seed, sfc32, tagged sub-streams.\nCommitted before the round, revealed after. You can check.") }),
      f("house_edge.ini", { size: 96, act: () => txt("house_edge.ini", "[fees]\nplatform=0.001\nrakeback=0.002\narena=0.097\n\n[truth]\nrtp=0.99\nedge_on_any_single_touch=0.00\n; the edge is the fee. that is the whole edge.\n") }),
      f("fights.log", { size: hooks.logSize(), act: () => hooks.openWin("win-log") }),
    ],
    "C:\\WINDOWS": () => [
      dir("system32", { ico: "winfolder32", go: "C:\\WINDOWS\\system32" }),
      dir("Web", { go: "C:\\WINDOWS\\Web" }),
      f("explorer.exe", { size: 1 * MB, ico: "openfolder32", act: () => hooks.openWin("win-explorer") }),
      f("winmine.exe", { size: 119 * 1024, ico: "mine32", act: () => hooks.openWin("win-mine") }),
      f("win.ini", { size: 512, act: () => txt("win.ini", "[windows]\nrun=\nload=\n\n[colors]\nBackground=58 110 165\n") }),
    ],
    "C:\\WINDOWS\\Web": () => [
      f("Bliss.bmp", { size: 1.4 * MB, ico: "pics32", act: () => hooks.openPicture({ name: "Bliss.bmp", data: IMG.bliss }) }),
    ],
    "C:\\WINDOWS\\system32": () => [
      f("kernel32.dll", { size: 984 * 1024, ico: "@ic-file", act: () => sysErr("kernel32.dll") }),
      f("hopium.sys", { size: 4 * MB, ico: "@ic-file", act: () => showError("hopium.sys", "This driver has never been signed and has never crashed.\nIt is the most stable component on this computer.") }),
      f("copium.drv", { size: 2 * MB, ico: "@ic-file", act: () => showError("copium.drv", "Loaded at boot. Consumes no memory. Explains every loss.") }),
      f("luck.dll", { size: 0, ico: "err32", act: () => showError("luck.dll", "The file or directory is corrupted and unreadable.\n\nIt has been like this since you got here.") }),
      f("mumu.exe", { size: 44 * 1024, ico: "@ic-app", act: () => showError("mumu.exe", "This process is already running and cannot be stopped.\nIt is up 0.4 SOL and will not be taking questions.") }),
      f("shell32.dll", { size: 8.4 * MB, ico: "@ic-file", act: () => sysErr("shell32.dll") }),
    ],
  };
  function sysErr(n) { showError(n, "Access is denied.\n\nSystem files are protected. The house patches itself."); }
  function txt(name, body) { hooks.openText(name, body); }

  /* dynamic branch: a user folder made on the desktop */
  function childrenOf(p) {
    if (TREE[p]) return TREE[p]();
    if (p === HOME + "\\Desktop\\Unused Desktop Shortcuts")
      return (hooks.unusedFiles ? hooks.unusedFiles() : []).map(ic =>
        f(ic.label + ".lnk", { ico: ic.ico, size: 1024, act: () => hooks.openIcon(ic) }));
    if (p.indexOf(HOME + "\\Desktop\\") === 0) return [];   /* user folders really are empty */
    return null;
  }

  /* ---------- search: a real walk of the real tree ---------- */
  /* Depth-first over childrenOf(), which is the same function the address bar,
     cmd.exe and the listing all use — so the dog finds what is actually there,
     including every dead cursor, and never anything that is not. */
  function walk(root, hit, out, seen, depth) {
    if (out.length >= 200 || depth > 6 || seen.has(root)) return;
    seen.add(root);
    const items = childrenOf(root);
    if (!items) return;
    for (const it of items) {
      if (hit(it, root)) out.push({ it, where: root });
      if (it.kind === "folder" || it.kind === "drive") {
        const child = it.go || (root === "C:\\" ? "C:\\" + it.name : root + "\\" + it.name);
        walk(child, hit, out, seen, depth + 1);
      }
    }
  }
  function runSearch(q, kind) {
    searchQ = q; searchKind = kind;
    const needle = q.trim().toLowerCase();
    const hit = (it, where) => {
      if (kind === "cursors" && !it.dead) return false;
      if (kind === "docs" && !/\.(txt|log|ini|bat|sys|url|png)$/i.test(it.name)) return false;
      if (kind === "mine" && !(it.dead && it.dead.mine)) return false;
      if (!needle) return kind !== "all";
      if (it.name.toLowerCase().indexOf(needle) >= 0) return true;
      /* a dead cursor is findable by who owned it and who killed it, which is
         the only search anybody will actually run twice */
      if (it.dead && ((it.dead.name || "").toLowerCase().indexOf(needle) >= 0 ||
                      (it.dead.killer || "").toLowerCase().indexOf(needle) >= 0)) return true;
      return false;
    };
    const out = [];
    walk("My Computer", hit, out, new Set(), 0);
    results = out;
    sel = null;
    render();
    return out.length;
  }

  /* ---------- formatting ---------- */
  function fmtSize(b) {
    if (b >= GB) return (b / GB).toFixed(2) + " GB";
    if (b >= MB) return (b / MB).toFixed(1) + " MB";
    if (b >= 1024) return Math.max(1, Math.round(b / 1024)) + " KB";
    return b + " bytes";
  }
  function parentOf(p) {
    if (p === "My Computer") return null;
    if (p === BIN) return HOME + "\\Desktop";   /* the bin lives on the Desktop, as it should */
    if (p === "C:\\") return "My Computer";
    if (/^[A-Z]:\\[^\\]+$/.test(p)) return "C:\\";
    const i = p.lastIndexOf("\\");
    return i > 2 ? p.slice(0, i) : "C:\\";
  }
  function leaf(p) {
    if (p === "My Computer") return "My Computer";
    if (p === BIN) return BIN;
    if (p === "C:\\") return "Local Disk (C:)";
    return p.slice(p.lastIndexOf("\\") + 1);
  }
  function icoOf(p) {
    if (p === "My Computer") return "computer32";
    if (p === BIN) return "bin32";
    if (p === "C:\\") return "hdd32";
    if (p === PICS) return "pics32";
    if (p === DOCS) return "docs32";
    if (p.indexOf("Program Files") >= 0) return "progfolder32";
    if (p.indexOf("WINDOWS") >= 0) return "winfolder32";
    return "openfolder32";
  }

  /* ---------- navigation ---------- */
  function go(p, noHist) {
    searching = false; results = null;
    if (childrenOf(p) === null) { showError("Windows Explorer", `Cannot find '${p}'.\nCheck the spelling and try again.`); return; }
    if (!noHist && p !== path) { hist.push(path); fwd = []; }
    path = p; sel = null;
    sysSnd("nav", .45);
    render();
  }
  function back() { if (hist.length) { fwd.push(path); path = hist.pop(); sel = null; render(); } }
  function forward() { if (fwd.length) { hist.push(path); path = fwd.pop(); sel = null; render(); } }
  function up() { const p = parentOf(path); if (p) go(p); }

  /* ---------- rendering ---------- */
  function render() {
    const items = searching && results
      ? results.map(r => Object.assign({}, r.it, { _where: r.where }))
      : (childrenOf(path) || []);
    /* items are rebuilt every render, so re-point the selection by name (and
       drop it if what was selected has just been restored or emptied) */
    if (sel) sel = items.find(i => i.name === sel.name) || null;
    els.addr.value = searching ? "Search Results" : path;
    els.addrico.src = IMG[icoOf(path)] || IMG.folder32;
    if (deps.setTitle) deps.setTitle(leaf(path));
    renderList(items);
    if (searching) renderSearchPane(items); else renderTasks(items);
    els.back.disabled = !hist.length;
    els.fwd.disabled = !fwd.length;
    els.up.disabled = !parentOf(path);
    status(items);
  }
  function status(items) {
    els.st1.textContent = searching
      ? (results ? `${results.length} object${results.length === 1 ? "" : "s"} found` : "Ready to search")
      : sel ? "1 object selected" : `${items.length} object${items.length === 1 ? "" : "s"}`;
    const bytes = sel ? sel.size : items.reduce((s, i) => s + (i.size || 0), 0);
    els.st2.textContent = bytes ? fmtSize(bytes) : "";
    els.st3.textContent = path === "My Computer" ? "My Computer" : path === BIN ? "Recycle Bin" : "Local Disk (C:)";
  }
  function renderList(items) {
    const host = els.list;
    host.innerHTML = "";
    host.className = "ex-list v-" + view;
    let group = null;
    for (const it of items) {
      /* XP files its own computer under headings; so do we */
      if (it.group && it.group !== group && (view === "tiles" || view === "icons")) {
        group = it.group;
        const g = document.createElement("div");
        g.className = "ex-group";
        g.textContent = group;
        host.appendChild(g);
      }
      const row = document.createElement("div");
      row.className = "ex-item" + (it.hidden ? " ghost" : "") + (sel === it ? " on" : "");
      const img = icoNode(it.ico);
      img.classList.add("ex-ico");   /* icoNode returns <img> OR <span><svg>; one class sizes both */
      const nm = document.createElement("div");
      nm.className = "ex-nm";
      nm.textContent = it.name;
      row.appendChild(img); row.appendChild(nm);
      if (view === "tiles") {
        const sub = document.createElement("div");
        sub.className = "ex-sub";
        sub.textContent = it.tile || (it.kind === "file" ? fmtSize(it.size) : "File Folder");
        nm.appendChild(sub);
      }
      if (view === "details") {
        const add = (t, cls) => { const d = document.createElement("div"); d.className = "ex-col " + (cls || ""); d.textContent = t; row.appendChild(d); };
        add(it.kind === "file" ? fmtSize(it.size) : "", "sz");
        if (it.dead) {
          /* the bin earns its own columns: in here, who did it and at what price */
          add("killed by " + it.dead.killer, "ty");
          add(`${it.dead.odds} : ${100 - it.dead.odds}`, "dt");
        } else {
          add(it.kind === "drive" ? "Local Disk" : it.kind === "folder" ? "File Folder" : typeOf(it.name), "ty");
          add(it.file ? "deleted from Desktop" : "24/08/2001 09:00", "dt");
        }
      }
      row.addEventListener("click", () => { sel = it; markSel(host, row); status(items); renderTasks(items); });
      row.addEventListener("dblclick", () => openItem(it));
      row.addEventListener("contextmenu", e => {
        e.preventDefault(); e.stopPropagation();
        sel = it; markSel(host, row); status(items);
        showMenu(itemMenu(it), e.clientX, e.clientY);
      });
      host.appendChild(row);
    }
  }
  function markSel(host, row) {
    [...host.children].forEach(c => c.classList.remove("on"));
    if (row) row.classList.add("on");
  }
  function typeOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name);
    const ext = m ? m[1].toLowerCase() : "";
    return ({ exe: "Application", dll: "Application Extension", sys: "System file", drv: "System file",
      ini: "Configuration Settings", txt: "Text Document", log: "Text Document", bat: "MS-DOS Batch File",
      bmp: "Bitmap Image", png: "Bitmap Image", mp3: "MP3 Audio", url: "Internet Shortcut", cur: "Cursor",
      lnk: "Shortcut", dat: "DAT File" })[ext] || "File";
  }
  function openItem(it) {
    if (it.go) return go(it.go);
    if (it.act) return it.act();
    showError(it.name, "Windows cannot open this file. It is decorative.");
  }

  /* ---------- the blue task pane ---------- */
  function panel(title, rows, cls) {
    const p = document.createElement("div");
    p.className = "ex-panel " + (cls || "");
    const h = document.createElement("div");
    h.className = "ex-ph";
    h.innerHTML = `<span></span><i class="ex-chev">▲</i>`;
    h.querySelector("span").textContent = title;
    h.addEventListener("click", () => p.classList.toggle("shut"));
    const b = document.createElement("div");
    b.className = "ex-pb";
    for (const r of rows) {
      if (r.text) { const d = document.createElement("div"); d.className = "ex-note"; d.innerHTML = r.text; b.appendChild(d); continue; }
      const a = document.createElement("div");
      a.className = "ex-task";
      const ti = icoNode(r.ico); ti.classList.add("ex-tico");
      a.appendChild(ti);
      const s = document.createElement("span");
      s.textContent = r.label;
      a.appendChild(s);
      a.addEventListener("click", r.act);
      b.appendChild(a);
    }
    p.appendChild(h); p.appendChild(b);
    return p;
  }
  function renderTasks(items) {
    const host = els.tasks;
    host.innerHTML = "";
    if (path === BIN) {
      /* XP's Recycle Bin swaps the file-tasks panel for its own two verbs.
         The third one is ours, and it is the reason this folder exists. */
      host.appendChild(panel("Recycle Bin Tasks", [
        { label: "Empty the Recycle Bin", ico: "bin32", act: () => hooks.emptyBin() },
        { label: sel ? "Restore this item" : "Restore all items", ico: "openfolder32", act: () => hooks.restore(sel && sel.file) },
        { label: "Hall of Pain", ico: "err32", act: () => hooks.hallOfPain() },
      ], "sys"));
    } else if (path === "My Computer") {
      host.appendChild(panel("System Tasks", [
        { label: "View system information", ico: "computer32", act: () => hooks.systemProperties() },
        { label: "Add or remove programs", ico: "cpanel32", act: () => showError("Add or Remove Programs", "Nothing here can be removed. You installed it by playing.") },
        { label: "Change a setting", ico: "cpanel32", act: () => hooks.openWin("win-dispprops") },
      ], "sys"));
    } else {
      host.appendChild(panel("File and Folder Tasks", [
        { label: "Make a new folder", ico: "folder32", act: () => showError("New Folder", "This disk is read-only to you. Make folders on the Desktop instead.") },
        { label: "Publish this folder to the Web", ico: "earth32", act: () => showError("Web Publishing Wizard", "The web is one page long and it is already published. See cursor$land.") },
        { label: "Share this folder", ico: "shareddocs32", act: () => showError("Sharing", "Sharing is disabled. Your losses are private and will remain so.") },
      ]));
    }
    const others = [];
    const par = parentOf(path);
    if (par) others.push({ label: leaf(par), ico: icoOf(par), act: () => go(par) });
    if (path !== "My Computer") others.push({ label: "My Computer", ico: "computer32", act: () => go("My Computer") });
    if (path !== DOCS) others.push({ label: "My Documents", ico: "docs32", act: () => go(DOCS) });
    others.push({ label: "My Network Places", ico: "connect32", act: () => showError("My Network Places", "No network. One computer. One player. One pot.") });
    host.appendChild(panel("Other Places", others, "other"));

    const d = sel;
    const rows = d && d.dead
      ? [{ text: `<b>${esc(d.name)}</b><br>Cursor Image<br>Owner: ${esc(d.dead.name)}<br>Killed by: ${esc(d.dead.killer)}<br>` +
          `Carried: ${d.dead.lostStr} SOL<br>Its odds: ${d.dead.odds} : ${100 - d.dead.odds}<br>Size: ${fmtSize(d.size)}` }]
      : d
      ? [{ text: `<b>${esc(d.name)}</b><br>${d.kind === "file" ? typeOf(d.name) : "File Folder"}${d.size ? "<br>Size: " + fmtSize(d.size) : ""}` }]
      : path === BIN
        ? [{ text: `<b>Recycle Bin</b><br>System Folder<br>${hooks.deadCount()} cursors, ${fmtSize(hooks.deadCount() * 12 * MB)}<br>Deleted files can be restored.<br>Cursors cannot.` }]
      : path === "C:\\"
        ? [{ text: `<b>Local Disk (C:)</b><br>Local Disk<br>File System: NTFS<br>Free Space: ${fmtSize(freeBytes())}<br>Total Size: ${fmtSize(DISK)}` }]
        : [{ text: `<b>${esc(leaf(path))}</b><br>${path === "My Computer" ? "System Folder" : "File Folder"}` }];
    host.appendChild(panel("Details", rows, "details"));
  }
  /* ---------- the Search Companion pane ---------- */
  const KINDS = [
    ["cursors", "Dead cursors", "@ic-cursor", "Every corpse on the disk. Search by owner or by who killed it."],
    ["docs", "Documents", "note32", "Text files, logs and settings."],
    ["mine", "My losses", "err32", "Only cursors that were yours."],
    ["all", "All files and folders", "hdd32", "Everything on this computer."],
  ];
  function renderSearchPane(items) {
    const host = els.tasks;
    host.innerHTML = "";
    const box = document.createElement("div");
    box.className = "ex-panel srch";
    box.innerHTML = `<div class="ex-phead">Search Companion</div>`;
    const body = document.createElement("div");
    body.className = "ex-pbody";

    const ask = document.createElement("div");
    ask.className = "srch-ask";
    ask.textContent = results ? (results.length ? "Here is what I found." : "I could not find anything.") : "What do you want to search for?";
    body.appendChild(ask);

    for (const [id, label, ico, tip] of KINDS) {
      const a = document.createElement("a");
      a.className = "ex-task srch-kind" + (searchKind === id ? " on" : "");
      a.title = tip;
      a.appendChild(deps.icoNode(ico));
      const sp = document.createElement("span");
      sp.textContent = label;
      a.appendChild(sp);
      a.addEventListener("click", () => { searchKind = id; doSearch(); });
      body.appendChild(a);
    }

    const lab = document.createElement("div");
    lab.className = "srch-lab";
    lab.textContent = "All or part of the name:";
    body.appendChild(lab);
    const inp = document.createElement("input");
    inp.className = "srch-in";
    inp.spellcheck = false;
    inp.value = searchQ;
    inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") { searchQ = inp.value; doSearch(); } });
    body.appendChild(inp);

    const row = document.createElement("div");
    row.className = "srch-btns";
    const go1 = document.createElement("button");
    go1.className = "xbtn"; go1.textContent = "Search";
    go1.addEventListener("click", () => { searchQ = inp.value; doSearch(); });
    const stop = document.createElement("button");
    stop.className = "xbtn"; stop.textContent = "Back";
    stop.addEventListener("click", () => { searching = false; results = null; render(); });
    row.appendChild(go1); row.appendChild(stop);
    body.appendChild(row);

    /* the dog. this is the whole reason anybody remembers this feature. */
    const pet = document.createElement("div");
    pet.className = "srch-pet";
    const cmp = deps.companion.node();
    cmp.id = "srch-cmp";
    pet.appendChild(cmp);
    const links = document.createElement("div");
    links.className = "srch-links";
    for (const [txt, fn] of [
      ["Change preferences", () => deps.companion.chooser(() => render())],
      ["Choose a different animation", () => deps.companion.chooser(() => render())],
    ]) {
      const a = document.createElement("a");
      a.className = "ex-task";
      a.textContent = txt;
      a.addEventListener("click", fn);
      links.appendChild(a);
    }
    pet.appendChild(links);
    body.appendChild(pet);

    box.appendChild(body);
    host.appendChild(box);
    if (results) deps.companion.setMood(cmp, results.length ? "found" : "empty");
  }
  function doSearch() {
    const cmp = document.getElementById("srch-cmp");
    deps.companion.setMood(cmp, "hunting");
    sysSnd("nav", .35);
    /* a beat of hunting before the answer, because instant search from a dog
       with a magnifying glass reads as broken */
    setTimeout(() => { runSearch(searchQ, searchKind); }, 620);
  }
  function openSearch() {
    searching = true; results = null;
    els.tasks.classList.remove("off");
    render();
  }

  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  /* ---------- drive properties: the pie is your body count ---------- */
  function driveProperties() {
    const used = usedBytes(), free = freeBytes();
    hooks.openDriveProps({
      used, free, total: DISK,
      usedStr: fmtSize(used), freeStr: fmtSize(free), totalStr: fmtSize(DISK),
      dead: hooks.deadCount(),
      draw: cvEl => drawPie(cvEl, used, DISK),
    });
  }
  function drawPie(cvEl, used, total) {
    const g = cvEl.getContext("2d");
    const w = cvEl.width, h = cvEl.height, cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 4;
    g.clearRect(0, 0, w, h);
    const frac = Math.max(0, Math.min(1, used / total));
    const a0 = -Math.PI / 2, a1 = a0 + frac * Math.PI * 2;
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath();
    g.fillStyle = "#1B5FAE"; g.fill();                 /* used: XP's blue */
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a1, a0 + Math.PI * 2); g.closePath();
    g.fillStyle = "#D64B4B"; g.fill();                 /* free: XP's magenta-red */
    g.strokeStyle = "#555"; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  }

  /* ---------- menus ---------- */
  function itemMenu(it) {
    if (it.dead || it.file) return [
      { label: it.dead ? "Certificate" : "Restore", bold: 1, action: () => it.dead ? hooks.deathCert(it.dead) : hooks.restore(it.file) },
      { sep: 1 },
      { label: "Restore", disabled: !!it.dead, action: () => hooks.restore(it.file) },
      { label: "Delete", action: () => hooks.emptyBin() },
      { sep: 1 },
      { label: "Properties", action: () => it.dead ? hooks.deathCert(it.dead)
          : showError("Properties: " + it.name, `Type: ${typeOf(it.name)}\nLocation: Recycle Bin\nSize: ${fmtSize(it.size)}\nOriginal location: C:\\Desktop`) },
    ];
    const denied = t => showError("Error " + t + " File or Folder",
      `Cannot ${t.toLowerCase()} ${it.name}: Access is denied.\n\nMake sure the disk is not full or write-protected and that the file is not currently in use.`);
    return [
      { label: it.kind === "folder" || it.kind === "drive" ? "Open" : "Open", bold: 1, action: () => openItem(it) },
      ...(it.kind === "drive" || it.kind === "folder" ? [
        { label: "Explore", action: () => openItem(it) },
        { label: "Search...", action: () => openSearch() }] : []),
      ...(it.kind === "file" && /\.(exe|msc)$/i.test(it.name) ? [
        { label: "Open With", sub: [
          { label: "Notepad", action: () => showError(it.name, "This file is an application. Notepad politely declines.") },
          { sep: 1 },
          { label: "Choose Program...", disabled: 1 }] }] : []),
      { sep: 1 },
      { label: "Send To", sub: [
        { label: "Compressed (zipped) Folder", action: () => denied("Copying") },
        { label: "Desktop (create shortcut)", action: () => denied("Copying") },
        { label: "My Documents", action: () => denied("Copying") },
        { sep: 1 },
        { label: "3½ Floppy (A:)", action: () => showError(it.name, "A:\\ is not accessible.\n\nThe device is not ready.") }] },
      { sep: 1 },
      { label: "Cut", disabled: 1 },
      { label: "Copy", disabled: 1 },
      { sep: 1 },
      { label: "Create Shortcut", disabled: 1 },
      { label: "Delete", action: () => it.kind === "drive"
        ? showError("Error Deleting File or Folder", "Cannot delete Local Disk (C:): Access is denied.\n\nThe drive is where the money lives.")
        : denied("Deleting") },
      { label: "Rename", action: () => denied("Renaming") },
      { sep: 1 },
      { label: "Properties", action: () => it.kind === "drive" && it.go === "C:\\"
        ? driveProperties()
        : showError("Properties: " + it.name,
            `Type: ${it.kind === "folder" ? "File Folder" : typeOf(it.name)}\nSize: ${fmtSize(it.size || 0)}\nCreated: Friday, 24 August 2001, 09:00:00`) },
    ];
  }
  const MENUS = {
    File: (x, y) => showMenu([
      { label: "Open", disabled: !sel, action: () => sel && openItem(sel) },
      ...(path === BIN ? [
        { sep: 1 },
        { label: "Empty Recycle Bin", action: () => hooks.emptyBin() },
        { label: "Restore all items", action: () => hooks.restore(null) },
        /* the phone hides the task pane, so the bin's three verbs all live here too */
        { label: "Hall of Pain", action: () => hooks.hallOfPain() },
      ] : []),
      { sep: 1 },
      { label: "Properties", action: () => path === "C:\\" || (sel && sel.go === "C:\\") ? driveProperties() : showError("Properties", "Nothing selected.") },
      { label: "Close", action: () => hooks.close() },
    ], x, y),
    Edit: (x, y) => showMenu([
      { label: "Undo", disabled: 1 }, { sep: 1 },
      { label: "Cut", disabled: 1 }, { label: "Copy", disabled: 1 }, { label: "Paste", disabled: 1 },
      { sep: 1 }, { label: "Select All", disabled: 1 },
    ], x, y),
    View: (x, y) => showMenu([
      ...["tiles", "icons", "list", "details"].map(v => ({
        label: v[0].toUpperCase() + v.slice(1), check: view === v, action: () => setView(v),
      })),
      { sep: 1 },
      { label: "Refresh", action: () => { render(); sysSnd("nav", .4); } },
    ], x, y),
    Favorites: (x, y) => showMenu([
      { label: "cursor$land", action: () => hooks.openWin("win-ie") },
      { sep: 1 },
      { label: "Add to Favorites...", disabled: 1 },
    ], x, y),
    Tools: (x, y) => showMenu([
      { label: "Map Network Drive...", action: () => showError("Map Network Drive", "There is no network. There is only this computer and the chain.") },
      { sep: 1 },
      { label: "Folder Options...", action: () => showError("Folder Options", "Show hidden files: they are already showing. That is what the faded ones are.") },
    ], x, y),
    Help: (x, y) => showMenu([
      { label: "Help Topics", action: () => showError("Windows Explorer", "Double-click a folder to open it. Use Up to go back out.\n\nThe interesting files are in C:\\WINDOWS\\system32 and C:\\Program Files\\CURSORS.EXE.", true) },
      { sep: 1 },
      { label: "About Windows", action: () => hooks.systemProperties() },
    ], x, y),
  };
  function setView(v) { view = v; store.data.expView = v; store.save(); render(); }

  /* ---------- wiring ---------- */
  els.back.addEventListener("click", back);
  els.fwd.addEventListener("click", forward);
  els.up.addEventListener("click", up);
  els.viewsBtn.addEventListener("click", e => {
    const r = e.currentTarget.getBoundingClientRect();
    MENUS.View(r.left, r.bottom + 2);
  });
  els.foldersBtn.addEventListener("click", () => els.tasks.classList.toggle("off"));
  els.searchBtn.addEventListener("click", () => (searching ? (searching = false, results = null, render()) : openSearch()));
  els.addr.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key !== "Enter") return;
    const v = els.addr.value.trim().replace(/\/$/, "");
    go(/^[a-z]:$/i.test(v) ? v.toUpperCase() + "\\" : v);
  });
  els.addrGo.addEventListener("click", () => els.addr.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })));
  els.list.addEventListener("click", e => {
    if (e.target === els.list) { sel = null; markSel(els.list, null); render(); }
  });
  els.list.addEventListener("contextmenu", e => {
    if (e.target !== els.list) return;
    e.preventDefault(); e.stopPropagation();
    showMenu([
      { label: "View", sub: ["tiles", "icons", "list", "details"].map(v => ({
        label: v[0].toUpperCase() + v.slice(1), check: view === v, action: () => setView(v) })) },
      { label: "Arrange Icons By", sub: [
        { label: "Name", check: 1, action: render },
        { label: "Size", action: render },
        { label: "Type", action: render },
        { label: "Modified", action: render },
        { sep: 1 },
        { label: "Show in Groups", disabled: 1 },
        { label: "Auto Arrange", check: 1, disabled: 1 }] },
      { label: "Refresh", action: render },
      { sep: 1 },
      { label: "Paste", disabled: 1 },
      { label: "Paste Shortcut", disabled: 1 },
      { sep: 1 },
      { label: "New", sub: [
        { label: "Folder", action: () => showError("Unable to create the folder 'New Folder'", "Access is denied.\n\nNew folders are made on the Desktop. This part of the disk belongs to the house.") },
        { sep: 1 },
        { label: "Text Document", action: () => showError("Unable to create the file 'New Text Document.txt'", "Access is denied.\n\nNew files are made on the Desktop. This part of the disk belongs to the house.") }] },
      { sep: 1 },
      { label: "Properties", action: () => path === "C:\\" ? driveProperties() : hooks.systemProperties() },
    ], e.clientX, e.clientY);
  });

  /* no first render here on purpose: the tree asks main.js for live game state
     (dead cursors, log size) which is declared further down that module, so the
     shell calls render() once during boot instead */

  return {
    go, render, setView, openSearch,
    /* cmd.exe reads the same tree this window does — one filesystem, two shells */
    list: pth => childrenOf(pth),
    paths: () => Object.keys(TREE),
    menu: (label, x, y) => (MENUS[label] || MENUS.Help)(x, y),
    path: () => path,
    driveProperties,
    HOME, DOCS, PICS, BIN,
  };
}
