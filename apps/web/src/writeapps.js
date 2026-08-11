/* The writing apps: Notepad (real), WordPad, Windows Picture and Fax Viewer,
   Clipboard Viewer. Import-free sibling module, same pattern as depthapps.js.

   Notepad is the deep one — Word Wrap and Font that genuinely apply, Go To
   (disabled while wrapping, which is XP's actual quirk), F5 time/date, the
   .LOG trick, and a status bar that only exists when wrap is off. WordPad is
   a contenteditable with the format bar and the ruler. The Viewer is what
   double-clicking an image opens, with Paint one button away, exactly like
   Windows Picture and Fax Viewer sat in front of mspaint. */

export function initWriteApps(deps) {
  const { $, store, sysSnd, showMenu, showError, openWin, closeWin, hooks } = deps;

  /* ================= Notepad ================= */
  const ta = $("#np-text");
  const FONTS = ["Lucida Console", "Fixedsys", "Courier New", "Arial", "Tahoma", "Times New Roman", "MS Sans Serif"];
  const np = {
    doc: null,            /* {title, get(), set(text)|null} — null set = read-only source */
    wrap: store.data.npWrap !== 0,
    status: !!store.data.npStatus,
    font: store.data.npFont || { f: "Lucida Console", s: 13, b: 0, i: 0 },
  };
  function npApply() {
    ta.setAttribute("wrap", np.wrap ? "soft" : "off");
    ta.style.fontFamily = `"${np.font.f}",monospace`;
    ta.style.fontSize = np.font.s + "px";
    ta.style.fontWeight = np.font.b ? "700" : "400";
    ta.style.fontStyle = np.font.i ? "italic" : "normal";
    /* XP: the status bar is unavailable while Word Wrap is on */
    $("#np-status").style.display = (!np.wrap && np.status) ? "flex" : "none";
    npCaret();
  }
  function npCaret() {
    const upTo = ta.value.slice(0, ta.selectionStart || 0);
    const ln = upTo.split("\n").length, col = upTo.length - upTo.lastIndexOf("\n");
    $("#np-lncol").textContent = `Ln ${ln}, Col ${col}`;
  }
  ta.addEventListener("input", () => { if (np.doc && np.doc.set) np.doc.set(ta.value); npCaret(); });
  ["keyup", "click"].forEach(ev => ta.addEventListener(ev, npCaret));
  ta.addEventListener("keydown", e => {
    e.stopPropagation();               /* the desktop's F-keys stay out of a text box */
    if (e.key === "F5") { e.preventDefault(); npStamp(); }
  });
  function npStamp() {
    /* XP's exact order: time then date */
    const d = new Date();
    const stamp = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " " + d.toLocaleDateString();
    const at = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, at) + stamp + ta.value.slice(ta.selectionEnd ?? at);
    ta.selectionStart = ta.selectionEnd = at + stamp.length;
    ta.dispatchEvent(new Event("input"));
  }
  function npTitle() {
    $("#win-notepad .title-bar-text").textContent = (np.doc ? np.doc.title : "Untitled") + " - Notepad";
  }
  function openNotepad(doc) {
    np.doc = doc || { title: "Untitled", text: "", set: null };
    ta.value = np.doc.get ? np.doc.get() : (np.doc.text || "");
    ta.readOnly = false;
    /* the .LOG trick: a first line of .LOG appends a timestamp on every open */
    if (/^\.LOG(\r?\n|$)/.test(ta.value)) {
      const d = new Date();
      ta.value += (ta.value.endsWith("\n") ? "" : "\n")
        + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " " + d.toLocaleDateString() + "\n";
      if (np.doc.set) np.doc.set(ta.value);
    }
    /* the Unicode-detection bug: saved as ANSI, guessed UTF-16LE on reopen.
       Only the display is wrong; the stored text stays what it was. */
    if (np.doc.get && ta.value === "Bush hid the facts") ta.value = "畂桳栠摩琠敨映捡獴";
    npTitle(); npApply();
    openWin("win-notepad");
    /* not on a phone: focusing inside the opening tap raises the keyboard,
       which covers the document AND the money bar — on a file you tapped to
       read. Tapping the text still opens the keyboard when you mean to edit. */
    if (!document.body.classList.contains("mobile")) ta.focus();
  }
  /* Go To — its own tiny dialog, and the real rule: not while wrapping */
  function npGoTo() {
    if (np.wrap) return;
    openWin("win-goto");
    $("#goto-ln").value = ""; $("#goto-ln").focus();
  }
  $("#goto-ok").addEventListener("click", () => {
    const n = Math.max(1, +$("#goto-ln").value || 1);
    const lines = ta.value.split("\n");
    if (n > lines.length) { showError("Notepad - Goto Line", "The line number is beyond the total number of lines"); return; }
    const at = lines.slice(0, n - 1).join("\n").length + (n > 1 ? 1 : 0);
    closeWin("win-goto"); ta.focus();
    ta.selectionStart = ta.selectionEnd = at; npCaret();
  });
  $("#goto-cancel").addEventListener("click", () => closeWin("win-goto"));
  $("#goto-ln").addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") $("#goto-ok").click(); });
  /* Font — the three-list dialog, applied to the whole document (Notepad has
     exactly one font; that is the point of Notepad) */
  function npFontDlg() {
    $("#fd-face").innerHTML = FONTS.map(f => `<option${f === np.font.f ? " selected" : ""}>${f}</option>`).join("");
    $("#fd-style").value = np.font.b ? (np.font.i ? "bolditalic" : "bold") : (np.font.i ? "italic" : "regular");
    $("#fd-size").value = String(np.font.s);
    const prev = () => {
      const p = $("#fd-prev");
      p.style.fontFamily = `"${$("#fd-face").value}",monospace`;
      p.style.fontSize = $("#fd-size").value + "px";
      const st = $("#fd-style").value;
      p.style.fontWeight = /bold/.test(st) ? "700" : "400";
      p.style.fontStyle = /italic/.test(st) ? "italic" : "normal";
    };
    ["fd-face", "fd-style", "fd-size"].forEach(id => $("#" + id).onchange = prev);
    prev();
    openWin("win-font");
  }
  $("#fd-ok").addEventListener("click", () => {
    const st = $("#fd-style").value;
    np.font = { f: $("#fd-face").value, s: +$("#fd-size").value || 13, b: /bold/.test(st) ? 1 : 0, i: /italic/.test(st) ? 1 : 0 };
    store.data.npFont = np.font; store.save();
    closeWin("win-font"); npApply();
  });
  $("#fd-cancel").addEventListener("click", () => closeWin("win-font"));

  function npMenu(which, x, y) {
    const M = {
      File: [
        { label: "New", accel: "Ctrl+N", action: () => openNotepad(null) },
        { label: "Open...", accel: "Ctrl+O", action: () => hooks.browseTexts(openNotepad) },
        { label: "Save", accel: "Ctrl+S", action: npSave },
        { label: "Save As...", action: () => npSaveAs() },
        { sep: 1 },
        { label: "Page Setup...", disabled: 1 },
        { label: "Print...", accel: "Ctrl+P", action: () => showError("Notepad", "Printer not found. Before you can print, you need to install a printer.") },
        { sep: 1 },
        { label: "Exit", action: () => closeWin("win-notepad") },
      ],
      Edit: [
        { label: "Undo", accel: "Ctrl+Z", action: () => document.execCommand("undo") },
        { sep: 1 },
        { label: "Cut", accel: "Ctrl+X", action: () => { ta.focus(); document.execCommand("cut"); } },
        { label: "Copy", accel: "Ctrl+C", action: () => { ta.focus(); document.execCommand("copy"); } },
        { label: "Paste", accel: "Ctrl+V", action: () => navigator.clipboard?.readText?.().then(t => {
            const at = ta.selectionStart; ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input"));
          }).catch(() => {}) },
        { label: "Delete", accel: "Del", action: () => { ta.setRangeText("", ta.selectionStart, ta.selectionEnd, "start"); ta.dispatchEvent(new Event("input")); } },
        { sep: 1 },
        { label: "Go To...", accel: "Ctrl+G", disabled: np.wrap ? 1 : 0, action: npGoTo },
        { sep: 1 },
        { label: "Select All", accel: "Ctrl+A", action: () => { ta.focus(); ta.select(); } },
        { label: "Time/Date", accel: "F5", action: npStamp },
      ],
      Format: [
        { label: "Word Wrap", check: np.wrap, action: () => { np.wrap = !np.wrap; store.data.npWrap = np.wrap ? 1 : 0; store.save(); npApply(); } },
        { label: "Font...", action: npFontDlg },
      ],
      View: [
        { label: "Status Bar", check: np.status, disabled: np.wrap ? 1 : 0,
          action: () => { np.status = !np.status; store.data.npStatus = np.status ? 1 : 0; store.save(); npApply(); } },
      ],
      Help: [
        { label: "Help Topics", action: () => openWin("win-help") },
        { sep: 1 },
        { label: "About Notepad", action: () => showError("About Notepad", "Windows Notepad\nVersion 5.1 (Build 2600.xpsp_sp2_rtm)", true) },
      ],
    };
    showMenu(M[which] || [], x, y);
  }
  /* the shell's global menubar handler routes here (it owns every .menubar) */
  function npSave() {
    if (np.doc && np.doc.set) { np.doc.set(ta.value); sysSnd("nav", .3); }
    else npSaveAs();
  }
  function npSaveAs() {
    /* read-only sources (fights.log, README) save a copy to the desktop */
    hooks.saveTextToDesktop(np.doc ? np.doc.title : "Untitled.txt", ta.value, ic => {
      np.doc = hooks.docForIcon(ic); npTitle();
    });
  }

  /* ================= WordPad ================= */
  const wp = { doc: null, tb: 1, fb: 1 };
  const wpEd = $("#wp-edit");
  function wpTitle() { $("#win-wordpad .title-bar-text").textContent = (wp.doc ? wp.doc.title : "Document") + " - WordPad"; }
  function openWordpad(doc) {
    wp.doc = doc || { title: "Document", get: () => "", set: null };
    wpEd.innerHTML = wp.doc.get ? wp.doc.get() : "";
    wpTitle();
    openWin("win-wordpad");
    wpEd.focus();
  }
  wpEd.addEventListener("input", () => { if (wp.doc && wp.doc.set) wp.doc.set(wpEd.innerHTML); });
  wpEd.addEventListener("keydown", e => e.stopPropagation());
  /* the format bar drives execCommand — deprecated, universally supported, and
     period-correct in spirit: it is literally the 2001 way to edit rich text */
  $("#wp-bar").addEventListener("click", e => {
    const b = e.target.closest("[data-cmd]"); if (!b) return;
    wpEd.focus();
    document.execCommand(b.dataset.cmd, false, b.dataset.val || null);
  });
  $("#wp-font").addEventListener("change", () => { wpEd.focus(); document.execCommand("fontName", false, $("#wp-font").value); });
  $("#wp-size").addEventListener("change", () => { wpEd.focus(); document.execCommand("fontSize", false, $("#wp-size").value); });
  $("#wp-color").addEventListener("change", () => { wpEd.focus(); document.execCommand("foreColor", false, $("#wp-color").value); });
  /* one strip plays toolbar and format bar both; either box hides it */
  function wpBars() { $("#wp-bar").style.display = (wp.tb && wp.fb) ? "" : "none"; }
  const wpCmd = (cmd, val) => { wpEd.focus(); document.execCommand(cmd, false, val || null); };
  function wpMenu(which, x, y) {
    const M = {
      File: [
        { label: "New", action: () => openWordpad(null) },
        { label: "Save", action: () => { if (wp.doc && wp.doc.set) { wp.doc.set(wpEd.innerHTML); sysSnd("nav", .3); } } },
        { sep: 1 },
        { label: "Exit", action: () => closeWin("win-wordpad") },
      ],
      Edit: [
        { label: "Undo", action: () => document.execCommand("undo") },
        { label: "Select All", action: () => { wpEd.focus(); document.execCommand("selectAll"); } },
      ],
      View: [
        { label: "Toolbar", check: wp.tb, action: () => { wp.tb = wp.tb ? 0 : 1; wpBars(); } },
        { label: "Format Bar", check: wp.fb, action: () => { wp.fb = wp.fb ? 0 : 1; wpBars(); } },
        { label: "Status Bar", disabled: 1 },
      ],
      Insert: [
        { label: "Date and Time...", action: () => wpCmd("insertText", new Date().toLocaleString()) },
        { label: "Object...", disabled: 1 },
      ],
      Format: [
        { label: "Font...", action: () => $("#wp-font").focus() },
        { label: "Bullet Style", action: () => wpCmd("insertUnorderedList") },
        { label: "Paragraph", sub: [
          { label: "Left", action: () => wpCmd("justifyLeft") },
          { label: "Center", action: () => wpCmd("justifyCenter") },
          { label: "Right", action: () => wpCmd("justifyRight") },
        ] },
      ],
      Help: [{ label: "About WordPad", action: () => showError("About WordPad", "Windows WordPad\nVersion 5.1", true) }],
    };
    showMenu(M[which] || [], x, y);
  }

  /* ================= Windows Picture and Fax Viewer ================= */
  const pv = { list: [], i: 0, zoom: 1, rot: 0, fit: 1, showT: null };
  const pvImg = $("#pv-img");
  function pvRender() {
    const it = pv.list[pv.i]; if (!it) return;
    pvImg.src = it.data;
    pvImg.style.transform = `rotate(${pv.rot}deg) scale(${pv.zoom})`;
    pvImg.className = pv.fit ? "fit" : "";
    $("#win-pictview .title-bar-text").textContent = it.name + " - Windows Picture and Fax Viewer";
    $("#pv-count").textContent = (pv.i + 1) + " / " + pv.list.length;
  }
  function openViewer(list, at) {
    pv.list = list && list.length ? list : [{ name: "Bliss.bmp", data: hooks.bliss() }];
    pv.i = Math.max(0, Math.min(at || 0, pv.list.length - 1));
    pv.zoom = 1; pv.rot = 0; pv.fit = 1;
    clearInterval(pv.showT); pv.showT = null; $("#pv-play").classList.remove("on");
    openWin("win-pictview"); pvRender();
  }
  const pvStep = d => { pv.i = (pv.i + d + pv.list.length) % pv.list.length; pv.zoom = 1; pv.rot = 0; pv.fit = 1; pvRender(); };
  $("#pv-prev").addEventListener("click", () => pvStep(-1));
  $("#pv-next").addEventListener("click", () => pvStep(1));
  $("#pv-fit").addEventListener("click", () => { pv.fit = 1; pv.zoom = 1; pvRender(); });
  $("#pv-full").addEventListener("click", () => { pv.fit = 0; pv.zoom = 1; pvRender(); });
  $("#pv-zin").addEventListener("click", () => { pv.fit = 0; pv.zoom = Math.min(8, pv.zoom * 1.25); pvRender(); });
  $("#pv-zout").addEventListener("click", () => { pv.zoom = Math.max(.1, pv.zoom / 1.25); pvRender(); });
  $("#pv-rotl").addEventListener("click", () => { pv.rot -= 90; pvRender(); });
  $("#pv-rotr").addEventListener("click", () => { pv.rot += 90; pvRender(); });
  $("#pv-play").addEventListener("click", () => {
    /* the slideshow: XP went fullscreen; ours cycles in place every 5s */
    if (pv.showT) { clearInterval(pv.showT); pv.showT = null; $("#pv-play").classList.remove("on"); return; }
    $("#pv-play").classList.add("on");
    pv.showT = setInterval(() => pvStep(1), 5000);
  });
  $("#pv-edit").addEventListener("click", () => {
    const it = pv.list[pv.i]; if (!it) return;
    closeWin("win-pictview"); hooks.editInPaint(it);
  });
  $("#pv-del").addEventListener("click", () => {
    const it = pv.list[pv.i]; if (!it) return;
    if (!it.del) { showError("Windows Picture and Fax Viewer", "This picture cannot be deleted from here."); return; }
    it.del(); pv.list.splice(pv.i, 1);
    if (!pv.list.length) { closeWin("win-pictview"); return; }
    pv.i %= pv.list.length; pvRender();
  });

  /* ================= Clipboard Viewer ================= */
  function openClipbook() {
    const c = hooks.shellClip();
    const host = $("#cb-body");
    if (!c) host.innerHTML = `<div class="cb-empty">The Clipboard is empty.</div>`;
    else host.innerHTML = `<div class="cb-item">${c.icoHTML || ""}<div><b>${c.label}</b><br><span class="dim">${c.kind}</span></div></div>`;
    openWin("win-clipbook");
  }

  return { openNotepad, openWordpad, openViewer, openClipbook,
    notepadMenu: npMenu, wordpadMenu: wpMenu,
    stopViewer() { clearInterval(pv.showT); pv.showT = null; $("#pv-play").classList.remove("on"); } };
}
