/* The apps nobody expects to work: Calculator, Character Map,
   Disk Defragmenter and the Registry Editor.

   The rule from sysapps applies here too: they read real state and do real
   (local, cosmetic) things. The defragmenter's block map is drawn from the
   actual disk numbers - the corpses on C: are the red stripes. The registry
   shows live game state under keys that look exactly where XP would put
   them, and everything under HKLM is as read-only as the house edge.
   Import-free sibling module; main.js injects the shell. */
export function initDepthApps(deps) {
  const { $, store, sysSnd, showMenu, showError, openWin, closeWin, hooks } = deps;

  const el = (tag, cls, txt) => {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt != null) d.textContent = txt;
    return d;
  };

  /* ================================================================
     1. Calculator - Standard mode, with the real key bindings
     ================================================================ */
  let acc = null, pendOp = null, entry = "0", fresh = true, mem = 0;
  function calcShow() { $("#calc-display").textContent = entry; }
  function calcDigit(d) {
    if (fresh) { entry = d === "." ? "0." : d; fresh = false; }
    else if (d === "." && entry.includes(".")) return;
    else entry = entry === "0" && d !== "." ? d : entry + d;
    calcShow();
  }
  function calcApply() {
    const b = parseFloat(entry);
    if (acc === null || !pendOp) { acc = b; return; }
    if (pendOp === "+") acc += b;
    else if (pendOp === "-") acc -= b;
    else if (pendOp === "*") acc *= b;
    else if (pendOp === "/") acc = b === 0 ? NaN : acc / b;
  }
  function fmt(n) {
    if (!isFinite(n)) return "Cannot divide by zero.";
    const s = String(+n.toPrecision(12));
    return s.length > 20 ? n.toExponential(8) : s;
  }
  function calcOp(op) {
    /* 5 + * means "I meant *": replace the pending operator, don't apply it */
    if (fresh && pendOp != null) { pendOp = op; calcShow(); return; }
    calcApply();
    pendOp = op; fresh = true;
    entry = fmt(acc); calcShow();
  }
  function calcEq() {
    calcApply();
    pendOp = null; fresh = true;
    entry = fmt(acc); acc = null; calcShow();
  }
  function calcCmd(c) {
    if (c === "C") { acc = null; pendOp = null; entry = "0"; fresh = true; }
    else if (c === "CE") { entry = "0"; fresh = true; }
    else if (c === "back") { entry = entry.length > 1 ? entry.slice(0, -1) : "0"; }
    else if (c === "sqrt") { entry = fmt(Math.sqrt(parseFloat(entry))); fresh = true; }
    else if (c === "1/x") { entry = fmt(1 / parseFloat(entry)); fresh = true; }
    else if (c === "%") { entry = fmt((acc == null ? 0 : acc) * parseFloat(entry) / 100); }
    else if (c === "+/-") { entry = entry.startsWith("-") ? entry.slice(1) : "-" + entry; }
    else if (c === "MC") mem = 0;
    else if (c === "MR") { entry = fmt(mem); fresh = true; }
    else if (c === "MS") mem = parseFloat(entry) || 0;
    else if (c === "M+") mem += parseFloat(entry) || 0;
    calcShow();
  }
  function calcInit() {
    /* the real layout, four memory keys down the side */
    const rows = [
      ["back:Backspace", "CE:CE", "C:C"],
      ["MC", "7", "8", "9", "/", "sqrt"],
      ["MR", "4", "5", "6", "*", "%"],
      ["MS", "1", "2", "3", "-", "1/x"],
      ["M+", "0", "+/-", ".", "+", "="],
    ];
    const host = $("#calc-keys"); if (!host) return;
    host.innerHTML = "";
    for (const row of rows) {
      const r = el("div", "calc-row");
      for (const kdef of row) {
        const [k, label] = kdef.includes(":") ? kdef.split(":") : [kdef, kdef];
        const b = el("button", "calc-k xbtn", label === "back" ? "Backspace" : label);
        if ("0123456789.".includes(k) && k.length === 1) b.classList.add("num");
        if ("=+-*/".includes(k) && k.length === 1) b.classList.add("op");
        if (/^M/.test(k) || k === "C" || k === "CE" || k === "back") b.classList.add("mem");
        b.addEventListener("click", () => {
          sysSnd("nav", .2);
          if ("0123456789.".includes(k) && k.length === 1) calcDigit(k);
          else if ("+-*/".includes(k) && k.length === 1) calcOp(k);
          else if (k === "=") calcEq();
          else calcCmd(k);
        });
        r.appendChild(b);
      }
      host.appendChild(r);
    }
    /* the keyboard drives it, exactly like the real one */
    $("#win-calc").addEventListener("keydown", e => {
      e.stopPropagation();
      const k = e.key;
      if ("0123456789.".includes(k)) { calcDigit(k); e.preventDefault(); }
      else if ("+-*/".includes(k)) { calcOp(k); e.preventDefault(); }
      else if (k === "Enter" || k === "=") { calcEq(); e.preventDefault(); }
      else if (k === "Backspace") { calcCmd("back"); e.preventDefault(); }
      else if (k === "Escape") { calcCmd("C"); e.preventDefault(); }
      else if (k === "Delete") { calcCmd("CE"); e.preventDefault(); }
      else if (k === "@") { calcCmd("sqrt"); e.preventDefault(); }
      else if (k === "%") { calcCmd("%"); e.preventDefault(); }
      else if (k.toLowerCase() === "r") { calcCmd("1/x"); e.preventDefault(); }
    });
    calcShow();
  }

  /* ================================================================
     2. Character Map - the grid, the U+ readout, Select and Copy
     ================================================================ */
  const CM_FONTS = ["Arial", "Courier New", "Tahoma", "Times New Roman", "Verdana", "Webdings", "Wingdings", "Symbol"];
  let cmSel = 65, cmBuf = "";
  function cmRanges() {
    /* the printable BMP stretches XP actually showed first */
    const r = [];
    for (let c = 33; c <= 126; c++) r.push(c);
    for (let c = 161; c <= 255; c++) r.push(c);
    for (let c = 0x0100; c <= 0x017F; c++) r.push(c);          /* Latin Extended-A */
    for (let c = 0x0391; c <= 0x03C9; c++) if (c !== 0x03A2) r.push(c);   /* Greek */
    for (let c = 0x0410; c <= 0x044F; c++) r.push(c);          /* Cyrillic */
    for (const c of [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2020, 0x2021, 0x2022, 0x2026,
      0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2200, 0x2211, 0x221A, 0x221E, 0x2260,
      0x2264, 0x2265, 0x25A0, 0x25B2, 0x25BA, 0x25CF, 0x263A, 0x263B, 0x2640, 0x2642, 0x2660,
      0x2663, 0x2665, 0x2666, 0x266A, 0x266B]) r.push(c);
    return r;
  }
  function cmStatus() {
    const ch = String.fromCharCode(cmSel);
    $("#cm-status").textContent = `U+${cmSel.toString(16).toUpperCase().padStart(4, "0")}: ${ch}`;
  }
  function cmRender() {
    const host = $("#cm-grid"); if (!host) return;
    host.innerHTML = "";
    host.style.fontFamily = $("#cm-font").value;
    for (const c of cmRanges()) {
      const cell = el("span", "cm-cell" + (c === cmSel ? " on" : ""), String.fromCharCode(c));
      cell.addEventListener("click", () => {
        cmSel = c;
        [...host.children].forEach(x => x.classList.remove("on"));
        cell.classList.add("on");
        cmStatus();
      });
      cell.addEventListener("dblclick", () => { cmPick(); });
      host.appendChild(cell);
    }
    cmStatus();
  }
  function cmPick() {
    cmBuf += String.fromCharCode(cmSel);
    $("#cm-copybuf").value = cmBuf;
  }
  function cmInit() {
    const fsel = $("#cm-font"); if (!fsel) return;
    for (const f of CM_FONTS) { const o = el("option", null, f); o.value = f; fsel.appendChild(o); }
    fsel.value = "Arial";
    fsel.addEventListener("change", cmRender);
    $("#cm-select").addEventListener("click", cmPick);
    $("#cm-copy").addEventListener("click", () => {
      try { navigator.clipboard.writeText($("#cm-copybuf").value).catch(() => {}); } catch (e) {}
    });
    $("#cm-copybuf").addEventListener("input", e => { cmBuf = e.target.value; });
    cmRender();
  }

  /* ================================================================
     3. Disk Defragmenter - the coloured map IS the disk
     ================================================================ */
  /* legend, as shipped: blue contiguous, red fragmented, green unmovable,
     white free. Here fragmented = the corpses, unmovable = the system. */
  let dfState = null, dfTimer = 0;
  function dfBuild() {
    const d = hooks.disk();     /* {pct, corpses, corpseTotal} */
    const CELLS = 780;
    const frag = Math.round(CELLS * d.pct / 100 * .55);
    const sys = Math.round(CELLS * .1);
    const cont = Math.round(CELLS * d.pct / 100 * .45);
    const cells = [];
    for (let i = 0; i < CELLS; i++) cells.push("w");
    let placed = 0;
    for (let i = 0; i < sys; i++) cells[i] = "g";
    /* corpses scatter: fragmentation you can see growing between epochs */
    let seed = 1234 + d.corpses * 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (placed < frag && cells.includes("w")) { const i = sys + Math.floor(rnd() * (CELLS - sys)); if (cells[i] === "w") { cells[i] = "r"; placed++; } }
    placed = 0;
    while (placed < cont && cells.includes("w")) { const i = sys + Math.floor(rnd() * (CELLS - sys)); if (cells[i] === "w") { cells[i] = "b"; placed++; } }
    return { cells, frag, analyzed: false, defragging: false, done: 0 };
  }
  function dfDraw() {
    const cv = $("#df-map"); if (!cv || !dfState) return;
    const g = cv.getContext("2d");
    const W2 = cv.width, H2 = cv.height;
    g.fillStyle = "#fff"; g.fillRect(0, 0, W2, H2);
    const COLS = 130, cw2 = W2 / COLS, chh = 9;
    const COLORS = { b: "#3050C8", r: "#C83030", g: "#30A040", w: "#FFFFFF" };
    dfState.cells.forEach((c, i) => {
      const x = (i % COLS) * cw2, y = Math.floor(i / COLS) * chh;
      g.fillStyle = COLORS[c];
      g.fillRect(x, y, cw2 - .5, chh - 1.5);
      g.strokeStyle = "#D0D0D0"; g.strokeRect(x + .25, y + .25, cw2 - 1, chh - 2);
    });
  }
  function dfAnalyze() {
    clearInterval(dfTimer);
    dfState = dfBuild(); dfDraw();
    dfState.analyzed = true;
    { const st = $("#df-status"); if (st) st.textContent = "Analysis is complete for: (C:)"; }
    const d = hooks.disk();
    showError("Disk Defragmenter",
      `Analysis is complete for: (C:)\n\nYou should defragment this volume.\n\nVolume fragmentation: ${Math.min(99, Math.round(d.pct * .6 + 8))}%\nFile fragmentation: ${d.corpses} fragmented files (dead cursors, 12 MB each)`, true);
  }
  function dfRun() {
    if (!dfState) dfState = dfBuild();
    if (dfState.defragging) return;
    dfState.defragging = true;
    $("#df-status").textContent = "Defragmenting... 0%";
    clearInterval(dfTimer);
    dfTimer = setInterval(() => {
      /* the state can be swapped out under us (Analyze mid-run, reopen) */
      if (!dfState || !dfState.defragging) { clearInterval(dfTimer); return; }
      /* red cells migrate left and turn blue, a few at a time - watching it
         is the entire product */
      const cells = dfState.cells;
      let moved = 0;
      for (let i = cells.length - 1; i >= 0 && moved < 6; i--) {
        if (cells[i] !== "r") continue;
        const j = cells.indexOf("w");
        if (j < 0 || j > i) { cells[i] = "b"; moved++; continue; }
        cells[j] = "b"; cells[i] = "w"; moved++;
      }
      const left0 = cells.filter(c => c === "r").length;
      dfState.done = Math.min(left0 ? 99 : 100, dfState.done + 2 + Math.random() * 2);
      const left = left0;
      $("#df-status").textContent = `Defragmenting... ${Math.round(dfState.done)}%`;
      dfDraw();
      if (!left) {
        clearInterval(dfTimer);
        dfState.defragging = false;
        $("#df-status").textContent = "Defragmentation is complete for: (C:)";
        const w = document.getElementById("win-defrag");
        if (w && w.style.display !== "none")
          showError("Disk Defragmenter", "Defragmentation is complete for: (C:)", true);
      }
    }, 90);
  }
  function dfInit() {
    if (!$("#df-map")) return;
    $("#df-analyze").addEventListener("click", () => { sysSnd("nav", .4); dfAnalyze(); });
    $("#df-defrag").addEventListener("click", () => { sysSnd("nav", .4); dfRun(); });
  }
  function dfOpen() {
    const d = hooks.disk();
    $("#df-vol").textContent = `(C:)  ·  NTFS  ·  20.0 GB  ·  ${(20 * (100 - d.pct) / 100).toFixed(2)} GB free  ·  ${d.pct.toFixed(0)}% in use`;
    dfState = dfBuild(); dfDraw();
    $("#df-status").textContent = dfState.frag ? "" : "This volume has never seen a fight.";
    openWin("win-defrag");
  }

  /* ================================================================
     4. Registry Editor - the tree is real where it matters
     ================================================================ */
  /* live values pull from the game; everything else is the furniture XP
     actually had. Writes are refused with the real error, because the only
     numbers worth editing live on the server. */
  function regTree() {
    const g = hooks.regGame();   /* {name, wallet, kills, deaths, scheme, epoch, uptime} */
    return {
      "HKEY_CLASSES_ROOT": { ".cur": { "(Default)": "curfile" }, ".ani": { "(Default)": "anifile" },
        "curfile": { "(Default)": "Cursor" }, "exefile": { "(Default)": "Application" } },
      "HKEY_CURRENT_USER": {
        "Control Panel": {
          "Cursors": { "(Default)": hooks.schemeLabel(), "Scheme Source": "0x00000001" },
          "Desktop": { "Wallpaper": store.data.wallpaper === "painted" ? "C:\\Documents and Settings\\Administrator\\My Documents\\My Pictures\\untitled.png" : "C:\\WINDOWS\\Web\\Bliss.bmp",
            "ScreenSaveTimeOut": String((store.data.saver && store.data.saver.wait || 3) * 60),
            "SCRNSAVE.EXE": "C:\\WINDOWS\\system32\\" + ((store.data.saver && store.data.saver.t) || "pipes") + ".scr" },
          "Sound": { "Beep": "yes" },
        },
        "Software": {
          "CURSORS.EXE": {
            "PlayerName": g.name, "Wallet": g.wallet, "Kills": String(g.kills), "Deaths": String(g.deaths),
            "PointerScheme": g.scheme || "(default)",
            "RTP": "0.99", "Edge": "the fee. that is the whole edge.",
          },
          "Microsoft": { "Windows": { "CurrentVersion": { "Run": { "cursors": "C:\\Program Files\\CURSORS.EXE\\cursors.exe" } } } },
        },
      },
      "HKEY_LOCAL_MACHINE": {
        "SOFTWARE": { "Microsoft": { "Windows NT": { "CurrentVersion": {
          "ProductName": "Microsoft Windows XP", "CSDVersion": "Service Pack 2",
          "RegisteredOwner": g.name, "CurrentBuildNumber": "2600",
        } } } },
        "SYSTEM": { "CurrentControlSet": { "Services": { "cursors": {
          "DisplayName": "CURSORS.EXE Arena", "Start": "0x00000002", "ImagePath": "\\SystemRoot\\..\\cursors.exe",
          "Epoch": String(g.epoch), "Uptime": g.uptime,
        } } } },
      },
      "HKEY_USERS": { ".DEFAULT": { "Control Panel": { "Desktop": {} } } },
      "HKEY_CURRENT_CONFIG": { "System": { "CurrentControlSet": {} } },
    };
  }
  let regPath = ["HKEY_CURRENT_USER", "Software", "CURSORS.EXE"];
  const regOpenSet = new Set(["HKEY_CURRENT_USER", "HKEY_CURRENT_USER/Software"]);
  function regNode(path) {
    let n = regTree();
    for (const p of path) { n = n[p]; if (!n) return null; }
    return n;
  }
  const isKey = v => v && typeof v === "object";
  function regRenderTree() {
    const host = $("#reg-tree"); if (!host) return;
    host.innerHTML = "";
    const walk = (node, path, depth) => {
      for (const k of Object.keys(node)) {
        if (!isKey(node[k])) continue;
        const p = path.concat(k), pid = p.join("/");
        const row = el("div", "reg-key" + (pid === regPath.join("/") ? " on" : ""));
        row.style.paddingLeft = (6 + depth * 14) + "px";
        const hasKids = Object.keys(node[k]).some(x => isKey(node[k][x]));
        row.innerHTML = `<i class="reg-exp">${hasKids ? (regOpenSet.has(pid) ? "-" : "+") : "\u00a0"}</i><span class="reg-fold">\u{1F4C1}</span> <span></span>`;
        row.querySelector("span:last-child").textContent = k;
        row.addEventListener("click", () => {
          regPath = p;
          if (hasKids) { regOpenSet.has(pid) ? regOpenSet.delete(pid) : regOpenSet.add(pid); }
          regRenderTree(); regRenderVals();
        });
        host.appendChild(row);
        if (regOpenSet.has(pid)) walk(node[k], p, depth + 1);
      }
    };
    walk(regTree(), [], 0);
    $("#reg-status").textContent = "My Computer\\" + regPath.join("\\");
  }
  function regRenderVals() {
    const host = $("#reg-vals"); if (!host) return;
    host.innerHTML = "";
    const node = regNode(regPath) || {};
    const vals = Object.keys(node).filter(k => !isKey(node[k]));
    if (!vals.includes("(Default)")) vals.unshift("(Default)");
    for (const k of vals) {
      const row = el("div", "reg-val");
      const v = node[k];
      const type = /^0x/.test(String(v)) ? "REG_DWORD" : "REG_SZ";
      row.innerHTML = `<span class="reg-vn">\u{1F4C4} </span><span class="rv-n"></span><span class="rv-t">${type}</span><span class="rv-v"></span>`;
      row.querySelector(".rv-n").textContent = k;
      row.querySelector(".rv-v").textContent = v === undefined ? "(value not set)" : String(v);
      row.addEventListener("dblclick", () => showError("Error Editing Value",
        `Cannot edit ${k}: Error writing the value's new contents.`));
      host.appendChild(row);
    }
  }
  function regOpen() { regRenderTree(); regRenderVals(); openWin("win-regedit"); }

  /* ---------- boot (regedit renders on open: its values are live game state) ---------- */
  calcInit(); cmInit(); dfInit();

  return {
    openCalc: () => { openWin("win-calc"); setTimeout(() => $("#win-calc").focus(), 50); },
    openCharmap: () => openWin("win-charmap"),
    openDefrag: dfOpen,
    openRegedit: regOpen,
  };
}
