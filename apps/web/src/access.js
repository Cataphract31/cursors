export function initAccess(deps) {
  const { $, store, sysSnd, showError, openWin, closeWin, hooks } = deps;

  const el = (tag, cls, txt) => {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt != null) d.textContent = txt;
    return d;
  };
  const A_DEF = { sticky: 0, filter: 0, toggle: 0, contrast: 0, mousekeys: 0,
    showsounds: 0, soundsentry: 0, magFactor: 2, magDock: "top" };
  function opts() {
    const d = store.data.access = store.data.access || {};
    for (const k in A_DEF) if (d[k] === undefined) d[k] = A_DEF[k];
    return d;
  }

  let magOn = false, magNode = null, magRaf = 0, magX = 0, magY = 0, magT = 0;
  function magStrip() { return $("#magnifier"); }
  function openMagnifier() {
    if (magOn) { magFlash(); return; }
    magOn = true;
    document.body.classList.add("mag-on");
    magStrip().style.display = "block";
    addEventListener("pointermove", magMove, { passive: true });
    magT = setInterval(() => { magNode = null; magPaint(); }, 1000);
    magPaint();
    openWin("win-magnifier");
  }
  function stopMagnifier() {
    magOn = false;
    document.body.classList.remove("mag-on");
    magStrip().style.display = "none";
    magStrip().querySelector(".mag-view").innerHTML = "";
    magNode = null;
    clearInterval(magT);
    removeEventListener("pointermove", magMove);
    closeWin("win-magnifier");
  }
  function magFlash() {
    const s = magStrip();
    s.classList.remove("flash"); void s.offsetWidth; s.classList.add("flash");
  }
  function magMove(e) {
    magX = e.clientX; magY = e.clientY;
    if (!magRaf) magRaf = requestAnimationFrame(() => { magRaf = 0; magPaint(); });
  }
  function magPaint() {
    if (!magOn) return;
    const strip = magStrip();
    const view = strip.querySelector(".mag-view");
    const f = opts().magFactor;
    let node = document.elementFromPoint(magX, magY);
    while (node && (node.closest("#magnifier") || node === document.body)) node = node.parentElement;
    if (!node) { view.innerHTML = ""; return; }
    let host = node;
    for (let i = 0; i < 4 && host.parentElement; i++) {
      const r = host.getBoundingClientRect();
      if (r.width > 40 && r.height > 16) break;
      host = host.parentElement;
    }
    if (host !== magNode) {
      magNode = host;
      view.innerHTML = "";
      const c = host.cloneNode(true);
      c.classList.add("mag-clone");
      c.removeAttribute("id");
      c.querySelectorAll("[id]").forEach(n => n.removeAttribute("id"));
      c.querySelectorAll("iframe").forEach(f => { const d = document.createElement("div"); d.style.cssText = "background:#000;width:100%;height:100%"; f.replaceWith(d); });
      const src = host.querySelectorAll("input,textarea,canvas");
      const dst = c.querySelectorAll("input,textarea,canvas");
      for (let i = 0; i < src.length; i++) {
        if (src[i].tagName === "CANVAS") {
          dst[i].width = src[i].width; dst[i].height = src[i].height;
          try { dst[i].getContext("2d").drawImage(src[i], 0, 0); } catch (e) {}
        } else dst[i].value = src[i].value;
      }
      view.appendChild(c);
    }
    const r = magNode.getBoundingClientRect();
    const clone = view.firstChild;
    if (!clone) return;
    clone.style.width = r.width + "px";
    clone.style.height = r.height + "px";
    const sw = strip.clientWidth, sh = strip.clientHeight;
    const ox = (magX - r.left) * f - sw / 2;
    const oy = (magY - r.top) * f - sh / 2;
    clone.style.transform = "scale(" + f + ")";
    clone.style.transformOrigin = "0 0";
    clone.style.left = -ox + "px";
    clone.style.top = -oy + "px";
  }
  function magRender() {
    const host = $("#mg-body"); if (!host) return;
    const d = opts();
    host.innerHTML = "";
    const row = el("div", "mc-check");
    row.appendChild(el("span", null, "Magnification level:"));
    const sel = el("select");
    for (let i = 2; i <= 9; i++) {
      const o = el("option", null, String(i)); o.value = String(i);
      if (d.magFactor === i) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => { d.magFactor = +sel.value; store.save(); magNode = null; magPaint(); });
    row.appendChild(sel);
    host.appendChild(row);
    host.appendChild(el("div", "mc-note", "The strip shows what the pointer is over, magnified. It is the live desktop, so a clock in the strip keeps ticking."));
    const stop = el("button", "xbtn", "Exit");
    stop.style.minWidth = "74px";
    stop.addEventListener("click", stopMagnifier);
    const foot = el("div", "dlg-foot");
    foot.appendChild(stop);
    host.appendChild(foot);
  }

  const OSK_ROWS = [
    [["esc", "esc", 1], ["", "", .5], ["F1", "F1", 1], ["F2", "F2", 1], ["F3", "F3", 1], ["F4", "F4", 1],
     ["", "", .3], ["F5", "F5", 1], ["F6", "F6", 1], ["F7", "F7", 1], ["F8", "F8", 1],
     ["", "", .3], ["F9", "F9", 1], ["F10", "F10", 1], ["F11", "F11", 1], ["F12", "F12", 1]],
    [["`", "~", 1], ["1", "!", 1], ["2", "@", 1], ["3", "#", 1], ["4", "$", 1], ["5", "%", 1],
     ["6", "^", 1], ["7", "&", 1], ["8", "*", 1], ["9", "(", 1], ["0", ")", 1], ["-", "_", 1],
     ["=", "+", 1], ["bksp", "bksp", 2]],
    [["tab", "tab", 1.5], ["q", "Q", 1], ["w", "W", 1], ["e", "E", 1], ["r", "R", 1], ["t", "T", 1],
     ["y", "Y", 1], ["u", "U", 1], ["i", "I", 1], ["o", "O", 1], ["p", "P", 1], ["[", "{", 1],
     ["]", "}", 1], ["\\", "|", 1.5]],
    [["lock", "lock", 1.8], ["a", "A", 1], ["s", "S", 1], ["d", "D", 1], ["f", "F", 1], ["g", "G", 1],
     ["h", "H", 1], ["j", "J", 1], ["k", "K", 1], ["l", "L", 1], [";", ":", 1], ["'", '"', 1],
     ["ent", "ent", 2.2]],
    [["shift", "shift", 2.3], ["z", "Z", 1], ["x", "X", 1], ["c", "C", 1], ["v", "V", 1], ["b", "B", 1],
     ["n", "N", 1], ["m", "M", 1], [",", "<", 1], [".", ">", 1], ["/", "?", 1], ["shift", "shift", 2.7]],
    [["ctrl", "ctrl", 1.5], ["win", "win", 1.2], ["alt", "alt", 1.2], [" ", " ", 6.4],
     ["alt", "alt", 1.2], ["win", "win", 1.2], ["menu", "menu", 1.2], ["ctrl", "ctrl", 1.5]],
  ];
  const OSK_SPECIAL = { bksp: "Backspace", ent: "Enter", tab: "Tab", esc: "Escape" };
  let oskShift = false, oskCaps = false, oskTarget = null;

  function openOSK() {
    oskRender();
    openWin("win-osk");
    const w = $("#win-osk");
    if (!w.dataset.oskWired) {
      w.dataset.oskWired = "1";
      w.addEventListener("pointerdown", e => {
        if (e.target.closest(".osk-key")) e.preventDefault();
      });
    }
  }
  function oskRender() {
    const host = $("#osk-keys"); if (!host) return;
    host.innerHTML = "";
    for (const row of OSK_ROWS) {
      const r = el("div", "osk-row");
      for (const [lo, hi, w] of row) {
        if (!lo) { const sp = el("span", "osk-gap"); sp.style.flex = w; r.appendChild(sp); continue; }
        const face = oskFace(lo, hi);
        const k = el("button", "osk-key" + (lo === "shift" && oskShift ? " on" : "") + (lo === "lock" && oskCaps ? " on" : ""), face);
        k.style.flex = w;
        k.addEventListener("click", () => oskPress(lo, hi));
        r.appendChild(k);
      }
      host.appendChild(r);
    }
  }
  function oskFace(lo, hi) {
    if (lo === " ") return "";
    if (lo === "bksp") return "← Bksp";
    if (lo === "ent") return "Enter";
    if (lo === "lock") return "Caps";
    if (lo === "shift") return "Shift";
    if (lo === "win") return "⊞";
    if (lo === "menu") return "≡";
    if (lo.length > 1) return lo;
    const up = oskShift !== oskCaps;
    if (/[a-z]/.test(lo)) return up ? lo.toUpperCase() : lo;
    return oskShift ? hi : lo;
  }
  function oskFocus() {
    const a = document.activeElement;
    if (a && !a.closest("#win-osk") && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) {
      oskTarget = a;
    }
    return oskTarget;
  }
  function oskPress(lo, hi) {
    sysSnd("nav", .25);
    if (lo === "shift") { oskShift = !oskShift; oskRender(); return; }
    if (lo === "lock") { oskCaps = !oskCaps; if (opts().toggle) sysSnd("ding", .4); oskRender(); return; }
    if (lo === "ctrl" || lo === "alt" || lo === "win" || lo === "menu") { oskRender(); return; }
    const t = oskFocus();
    const key = lo === " " ? " " : OSK_SPECIAL[lo] || (lo.length > 1 ? lo : oskFace(lo, hi));
    if (t) {
      t.focus();
      if (t.id === "cmd-kbd") {
        t.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      } else if (key === "Backspace") oskEdit(t, "");
      else if (key === "Enter") {
        t.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        if (t.tagName === "TEXTAREA") oskEdit(t, "\n", 1);
      } else if (key === "Tab" || key === "Escape" || /^F\d/.test(key)) {
        t.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      } else oskEdit(t, key, 1);
    } else {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: key.length === 1 ? key : key, bubbles: true }));
    }
    if (oskShift) { oskShift = false; oskRender(); }
  }
  function oskEdit(t, text, insert) {
    if (t.isContentEditable) {
      document.execCommand(insert ? "insertText" : "delete", false, text);
      return;
    }
    const s = t.selectionStart == null ? t.value.length : t.selectionStart;
    const e = t.selectionEnd == null ? t.value.length : t.selectionEnd;
    if (insert) {
      t.value = t.value.slice(0, s) + text + t.value.slice(e);
      t.selectionStart = t.selectionEnd = s + text.length;
    } else {
      if (s !== e) { t.value = t.value.slice(0, s) + t.value.slice(e); t.selectionStart = t.selectionEnd = s; }
      else if (s > 0) { t.value = t.value.slice(0, s - 1) + t.value.slice(s); t.selectionStart = t.selectionEnd = s - 1; }
    }
    t.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function applyAccess() {
    const d = opts();
    document.body.classList.toggle("high-contrast", !!d.contrast);
  }
  function openAccessOptions() {
    accRender();
    openWin("win-access");
  }
  function accRender() {
    const d = opts();
    const pane = (id, rows) => {
      const host = $(id); if (!host) return;
      host.innerHTML = "";
      for (const r of rows) host.appendChild(r);
    };
    const check = (key, title, note, real) => {
      const fs = el("fieldset", "mo-fs");
      fs.appendChild(el("legend", null, title));
      const lab = el("label", "mc-check");
      const c = el("input"); c.type = "checkbox"; c.checked = !!d[key];
      c.addEventListener("change", () => {
        d[key] = c.checked ? 1 : 0; store.save(); applyAccess();
        if (c.checked) sysSnd("ding", .4);
      });
      lab.appendChild(c); lab.appendChild(el("span", null, "Use " + title));
      fs.appendChild(lab);
      fs.appendChild(el("div", "mc-note", note + (real ? "" : "  This switch is remembered and does nothing else, exactly as it did on a machine with no such hardware.")));
      return fs;
    };
    pane("#ac-kbd", [
      check("sticky", "StickyKeys", "Press Shift five times to be asked about this. With it on, a modifier stays down until the next key.", 1),
      check("filter", "FilterKeys", "Ignores brief and repeated keystrokes."),
      check("toggle", "ToggleKeys", "Beeps when Caps Lock is switched on the On-Screen Keyboard.", 1),
    ]);
    pane("#ac-snd", [
      check("soundsentry", "SoundSentry", "Flashes the screen when the system makes a sound."),
      check("showsounds", "ShowSounds", "Shows captions for the speech and sounds a program makes."),
    ]);
    pane("#ac-disp", [
      check("contrast", "High Contrast", "Repaints this shell in a high contrast scheme. It is real and it is loud.", 1),
    ]);
    pane("#ac-mouse", [
      check("mousekeys", "MouseKeys", "Moves the pointer with the numeric keypad. This computer cannot move your real pointer, and says so rather than pretending."),
    ]);
  }
  let shiftTaps = 0, shiftT = 0;
  addEventListener("keydown", e => {
    if (e.key !== "Shift" || e.repeat) return;
    const now = Date.now();
    if (now - shiftT > 1200) shiftTaps = 0;
    shiftT = now;
    if (++shiftTaps < 5) return;
    shiftTaps = 0;
    sysSnd("exclaim", .5);
    hooks.confirm("StickyKeys",
      "Do you want to turn on StickyKeys?\n\nStickyKeys is intended for people who have difficulty holding down two or more keys at a time. When StickyKeys is on, you can press a modifier key and have it remain active until another key is pressed.",
      () => { opts().sticky = 1; store.save(); sysSnd("ding", .5); accRender(); });
  });
  let latched = null;
  addEventListener("keydown", e => {
    if (!opts().sticky) return;
    if (["Shift", "Control", "Alt"].includes(e.key)) { latched = e.key; sysSnd("ding", .25); return; }
    latched = null;
  });
  const stickyLatched = () => latched;

  const narOpen = () => { const w = $("#win-narrator"); return !!(w && w.offsetParent); };
  function narSpeak(text) {
    if (!window.speechSynthesis || !text) return;
    if (hooks.getMuted && hooks.getMuted()) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.rate = 1.1;
    const vs = speechSynthesis.getVoices();
    u.voice = vs.find(v => v.lang === "en-US") || vs.find(v => v.lang && v.lang.slice(0, 2) === "en") || null;
    speechSynthesis.speak(u);
  }
  function openNarrator() { openWin("win-narrator"); }
  function narrate(text) {
    const c = $("#nr-events");
    if (!narOpen() || !c || !c.checked) return;
    narSpeak(text);
  }
  addEventListener("keydown", e => {
    const c = $("#nr-typed");
    if (!narOpen() || !c || !c.checked) return;
    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    if (!t || !(t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    narSpeak(e.key === " " ? "space" : e.key);
  }, true);

  return {
    init() {
      applyAccess();
      const b = $("#mg-close");
      if (b) b.addEventListener("click", stopMagnifier);
      magRender();
      const ok = $("#ac-ok"), can = $("#ac-cancel");
      if (ok) ok.addEventListener("click", () => closeWin("win-access"));
      if (can) can.addEventListener("click", () => closeWin("win-access"));
      const oc = $("#osk-close");
      if (oc) oc.addEventListener("click", () => closeWin("win-osk"));
      const no = $("#nr-ok");
      if (no) no.addEventListener("click", () => closeWin("win-narrator"));
    },
    openMagnifier, stopMagnifier, magRender, openOSK, openAccessOptions,
    openNarrator, narrate,
    magnifying: () => magOn,
    stickyLatched,
    contrastOn: () => !!opts().contrast,
  };
}
