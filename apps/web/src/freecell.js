/* FreeCell — the real rules on the vendored deck. Card faces come out of the
   js-solitaire sprite sheet at runtime, so both card games wear the same deck
   and no second copy of the art ships. No imports on purpose: the build-time
   smoke runner executes this file in node, so it must stay pure JS. */

export function initFreeCell(deps) {
  const { host, store, sysSnd, showError, showConfirm, setTitle, isFocused, close } = deps;

  /* sprite sheet geometry: 4 suit columns x 13 rank rows, one card 71x96 */
  const CW = 71, CH = 96;
  const SUITX = { h: 1, c: 72, d: 143, s: 214 };
  const RED = { h: 1, d: 1, c: 0, s: 0 };
  const SUITS = ["h", "c", "d", "s"];   /* foundation slot order */
  const GLYPH = { h: "♥", d: "♦", c: "♣", s: "♠" };
  const RTXT = [, "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  /* fixed board, like the original: cells left, foundations right, 8 columns */
  const BW = 633, BH = 430, COLY = 118;
  const CELLX = i => 8 + i * (CW + 2);
  const FOUNDX = i => BW - 8 - 4 * CW - 6 + i * (CW + 2);
  const COLX = c => 8 + c * (CW + 7);

  let game = 0, casc, free, found;
  let sel = null;          /* {t:"casc",col,idx} | {t:"free",i} */
  let moved = false;       /* a touched game abandoned is a loss */
  let over = false;

  /* ---- the deck art, borrowed from the solitaire bundle ---- */
  host.classList.add("fc-nosheet");
  fetch("solitaire/main.js").then(r => r.text()).then(t => {
    const m = t.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
    if (!m) throw new Error("no sheet");
    host.style.setProperty("--fc-sheet", `url("${m[0]}")`);
    host.classList.remove("fc-nosheet");
  }).catch(() => {});      /* text corners stand in if the sheet never comes */

  /* ---- the phone fit ---- */
  /* Eight columns and four home cells need 633px of felt; a phone hands over
     390, so half the tableau and every foundation used to sit off the glass.
     The board is a fixed pixel layout, so it gets scaled to the sheet rather
     than clipped — the same trick main.js plays on the vendored Solitaire.
     The layout box is set to the SCALED size as well, so nothing overflows the
     pane, the felt stays centred, and a tap still hits the card drawn under
     the finger (a transform scales hit-testing with the paint). */
  const phone = () => !!(document.body && document.body.classList.contains("mobile"));
  let scale = 1;
  function fit() {
    const pane = host.parentElement;
    if (!pane) return;
    if (!phone()) {          /* the desktop board is already the right size */
      scale = 1;
      host.style.width = host.style.height = host.style.marginTop = host.style.transform = "";
      outlines();
      return;
    }
    const w = pane.clientWidth, h = pane.clientHeight;
    /* a hidden sheet measures 0. Keep the last good fit and wait to be shown
       again rather than painting the felt at scale(0), which is how Solitaire
       once came back from a minimise as an empty green rectangle. */
    if (w < 40 || h < 40) return;
    scale = Math.min((w - 2) / BW, (h - 2) / BH, 1);
    host.style.width = Math.ceil(BW * scale) + "px";
    host.style.height = Math.ceil(BH * scale) + "px";
    host.style.transformOrigin = "0 0";
    host.style.transform = "scale(" + scale + ")";
    host.style.marginTop = Math.max(0, Math.floor((h - BH * scale) / 2)) + "px";
    outlines();
  }
  /* An empty cell is one hairline of #060 on green felt: scaled, it lands on
     half a device pixel and the home cells — the things you are playing at —
     fade off the board. Two board pixels come back as one crisp line. */
  function outlines() {
    const w = scale < 1 ? "2px" : "";
    for (const s of host.querySelectorAll(".fc-slot")) s.style.borderWidth = w;
  }
  /* one listener per module, replaced not stacked, so rotating a phone a dozen
     times does not leave a dozen fits running */
  if (initFreeCell._fit) removeEventListener("resize", initFreeCell._fit);
  initFreeCell._fit = fit;
  addEventListener("resize", fit);
  /* the pane reports a size again the instant the sheet is shown, which is the
     only reliable signal that a display:none board is back */
  if (typeof ResizeObserver === "function")
    try { new ResizeObserver(fit).observe(host.parentElement); } catch (e) {}
  fit();

  /* ---- the deal ---- */
  /* Microsoft's own shuffle — seed*214013+2531011, high bits — so the numbered
     games are THE numbered games: #11982 still cannot be won */
  function deal(n) {
    let seed = n >>> 0;
    const rnd = () => { seed = (Math.imul(seed, 214013) + 2531011) >>> 0; return (seed >>> 16) & 0x7fff; };
    const deck = [];
    for (let r = 1; r <= 13; r++) for (const s of ["c", "d", "h", "s"]) deck.push({ r, s });
    casc = [[], [], [], [], [], [], [], []];
    let left = 52, i = 0;
    while (left) {
      const j = rnd() % left;
      casc[i++ % 8].push(deck[j]);
      deck[j] = deck[--left];
    }
    free = [null, null, null, null];
    found = { h: 0, c: 0, d: 0, s: 0 };
  }

  /* ---- rendering ---- */
  function faceEl(cls, c, x, y) {
    const d = document.createElement("div");
    d.className = cls;
    d.style.left = x + "px";
    d.style.top = y + "px";
    if (c) {
      d.style.backgroundPosition = "-" + SUITX[c.s] + "px -" + (1 + CH * (c.r - 1)) + "px";
      d.dataset.face = RTXT[c.r] + GLYPH[c.s];
      d.dataset.red = RED[c.s];
    }
    return d;
  }
  function render() {
    const keep = host.querySelector(".fc-modal");   /* the Select Game box survives repaints */
    host.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const s = faceEl("fc-slot", null, CELLX(i), 8);
      s.dataset.free = i;
      host.appendChild(s);
      if (free[i]) {
        const d = faceEl("fc-card up", free[i], CELLX(i), 8);
        d.dataset.free = i;
        if (sel && sel.t === "free" && sel.i === i) d.classList.add("sel");
        host.appendChild(d);
      }
    }
    for (let i = 0; i < 4; i++) {
      const su = SUITS[i];
      const s = faceEl("fc-slot", null, FOUNDX(i), 8);
      s.dataset.found = su;
      host.appendChild(s);
      if (found[su]) {
        const d = faceEl("fc-card up", { r: found[su], s: su }, FOUNDX(i), 8);
        d.dataset.found = su;
        host.appendChild(d);
      }
    }
    for (let c = 0; c < 8; c++) {
      const col = casc[c];
      const s = faceEl("fc-slot", null, COLX(c), COLY);
      s.dataset.col = c;
      host.appendChild(s);
      /* long columns squeeze so the last card stays on the felt */
      const dy = col.length > 1 ? Math.min(18, Math.floor((BH - COLY - CH - 6) / (col.length - 1))) : 18;
      col.forEach((card, i) => {
        const d = faceEl("fc-card up", card, COLX(c), COLY + i * dy);
        d.dataset.col = c;
        d.dataset.i = i;
        if (sel && sel.t === "casc" && sel.col === c && i >= sel.idx) d.classList.add("sel");
        host.appendChild(d);
      });
    }
    if (keep) host.appendChild(keep);
    outlines();
  }

  /* ---- rules ---- */
  function runOK(c, idx) {
    const a = casc[c];
    for (let i = idx; i < a.length - 1; i++)
      if (a[i].r !== a[i + 1].r + 1 || RED[a[i].s] === RED[a[i + 1].s]) return false;
    return true;
  }
  function maxMove(destEmpty) {
    const cells = free.filter(x => !x).length;
    let empties = casc.filter(a => !a.length).length;
    if (destEmpty) empties--;   /* the destination cannot help fill itself */
    return (cells + 1) * Math.pow(2, empties);
  }
  function selCards() {
    return sel.t === "free" ? [free[sel.i]] : casc[sel.col].slice(sel.idx);
  }
  function takeSel() {
    if (sel.t === "free") { const c = free[sel.i]; free[sel.i] = null; return [c]; }
    return casc[sel.col].splice(sel.idx);
  }
  /* drops return 1 moved, 0 not a drop, -1 refused with the dialog shown */
  function dropCasc(c) {
    if (sel.t === "casc" && sel.col === c) return 0;
    const run = selCards(), dst = casc[c], t = dst[dst.length - 1];
    if (t && (t.r !== run[0].r + 1 || RED[t.s] === RED[run[0].s])) return 0;
    if (run.length > maxMove(!t)) {
      showError("FreeCell", "There are not enough free cells to move that many cards.");
      return -1;
    }
    dst.push(...takeSel());
    return 1;
  }
  function dropFree(i) {
    if (free[i] || selCards().length !== 1) return 0;
    free[i] = takeSel()[0];
    return 1;
  }
  function dropFound() {
    const run = selCards();
    if (run.length !== 1) return 0;
    const c = run[0];
    if (found[c.s] !== c.r - 1) return 0;
    takeSel();
    found[c.s] = c.r;
    return 1;
  }

  /* safe autoplay, the original's rule: aces and twos always, higher cards
     only once both foundations of the other colour have caught up */
  function safe(c) {
    if (c.r <= 2) return true;
    const opp = SUITS.filter(s => RED[s] !== RED[c.s]);
    return found[opp[0]] >= c.r - 1 && found[opp[1]] >= c.r - 1;
  }
  function settle() {
    let did = true;
    while (did) {
      did = false;
      for (let i = 0; i < 4; i++) {
        const c = free[i];
        if (c && found[c.s] === c.r - 1 && safe(c)) { free[i] = null; found[c.s] = c.r; did = true; }
      }
      for (const a of casc) {
        const c = a[a.length - 1];
        if (c && found[c.s] === c.r - 1 && safe(c)) { a.pop(); found[c.s] = c.r; did = true; }
      }
    }
    render();
    if (SUITS.every(s => found[s] === 13)) return win();
    if (!anyMove()) lose();
  }
  function anyMove() {
    const tops = [];
    for (const c of free) if (c) tops.push(c);
    for (const a of casc) if (a.length) tops.push(a[a.length - 1]);
    if (free.some(c => !c) && casc.some(a => a.length)) return true;
    if (casc.some(a => !a.length) && tops.length) return true;
    for (const c of tops) {
      if (found[c.s] === c.r - 1) return true;
      for (const a of casc) {
        const t = a[a.length - 1];
        if (t && t.r === c.r + 1 && RED[t.s] !== RED[c.s]) return true;
      }
    }
    return false;
  }

  /* ---- endings & the record ---- */
  function stats() { return store.data.fcStats = store.data.fcStats || { w: 0, l: 0, streak: 0, bw: 0, bl: 0 }; }
  function recordWin() {
    const s = stats();
    s.w++; s.streak = s.streak > 0 ? s.streak + 1 : 1; s.bw = Math.max(s.bw, s.streak);
    store.save();
  }
  function recordLoss() {
    const s = stats();
    s.l++; s.streak = s.streak < 0 ? s.streak - 1 : -1; s.bl = Math.max(s.bl, -s.streak);
    store.save();
  }
  function abandon() { if (moved && !over) recordLoss(); }
  function win() {
    over = true;
    recordWin();
    sysSnd("tada", .55);
    showConfirm("Game Over", "Congratulations, you win!\n\nDo you want to play again?", () => newGame());
  }
  function lose() {
    over = true;
    recordLoss();
    showConfirm("Game Over", "Sorry, you lose.\nThere are no more legal moves.\n\nDo you want to play another game?", () => newGame());
  }
  function showStats() {
    const s = stats(), n = s.w + s.l;
    const streak = s.streak > 0 ? s.streak + " win" + (s.streak > 1 ? "s" : "")
      : s.streak < 0 ? (-s.streak) + " loss" + (s.streak < -1 ? "es" : "") : "none";
    showError("FreeCell Statistics",
      "Played: " + n + "\nWins: " + s.w + "   Losses: " + s.l +
      "\nWin percentage: " + (n ? Math.round(s.w * 100 / n) : 0) + "%\n\n" +
      "Current streak: " + streak +
      "\nLongest winning streak: " + s.bw +
      "\nLongest losing streak: " + s.bl, true);
  }

  /* ---- games ---- */
  function newGame(n) {
    abandon();
    game = n || 1 + Math.floor(Math.random() * 32000);
    deal(game);
    sel = null; moved = false; over = false;
    setTitle("FreeCell Game #" + game);
    render();
  }
  function restart() { newGame(game); }
  function selectGame() {
    if (document.querySelector(".fc-modal")) return;
    const m = document.createElement("div");
    m.className = "fc-modal";
    m.innerHTML = '<b>Select Game</b>' +
      '<div class="fc-modal-x">Select a game number from 1 to 32000.</div>' +
      '<input type="number" min="1" max="32000" value="' + game + '">' +
      '<div class="fc-modal-btns"><button data-ok="1">OK</button><button>Cancel</button></div>';
    /* On a phone the dialog belongs to the window, not to the board: inside the
       board it rides the board's scale down to unreadable and slides off with
       any scroll of the felt. It still dies with the window, being its child. */
    const win = phone() ? host.closest(".window") : null;
    (win || host).appendChild(m);
    const inp = m.querySelector("input");
    if (win) {
      m.style.zIndex = "60";
      m.style.padding = "12px 14px";
      m.style.minWidth = "210px";
      /* under 16px iOS zooms the whole sheet the moment the box takes focus,
         and it never zooms back out */
      inp.style.fontSize = "16px";
      inp.style.width = "5em";
      inp.style.padding = "3px 5px";
      for (const b of m.querySelectorAll("button")) {
        b.style.minHeight = "30px"; b.style.minWidth = "76px"; b.style.fontSize = "12px";
      }
    }
    const go = () => { const n = Math.max(1, Math.min(32000, Math.floor(+inp.value || 0))); m.remove(); newGame(n); };
    m.addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.ok) go(); else m.remove();
    });
    m.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); go(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); m.remove(); }
    });
    setTimeout(() => inp.focus(), 0);
  }

  /* ---- input ---- */
  host.addEventListener("click", e => {
    if (over) return;
    const t = e.target.closest(".fc-card,.fc-slot");
    if (!t) { sel = null; render(); return; }
    const d = t.dataset;
    if (sel) {
      /* clicking the selection again puts it down */
      if (sel.t === "casc" && d.col != null && +d.col === sel.col && d.i != null && +d.i === sel.idx) { sel = null; render(); return; }
      if (sel.t === "free" && d.free != null && +d.free === sel.i && free[sel.i]) { sel = null; render(); return; }
      let r = 0;
      if (d.found != null) r = dropFound();
      else if (d.free != null) r = dropFree(+d.free);
      else if (d.col != null) r = dropCasc(+d.col);
      if (r === 1) { moved = true; sel = null; settle(); return; }
      if (r === -1) { sel = null; render(); return; }
    }
    /* not a drop (or an illegal one): try to pick instead */
    sel = null;
    if (d.free != null && free[+d.free]) sel = { t: "free", i: +d.free };
    else if (d.col != null && d.i != null && runOK(+d.col, +d.i)) sel = { t: "casc", col: +d.col, idx: +d.i };
    render();
  });
  /* double-click sends a top card to the first open cell, as the original did */
  host.addEventListener("dblclick", e => {
    if (over) return;
    const t = e.target.closest(".fc-card");
    if (!t || t.dataset.col == null || t.dataset.i == null) return;
    const c = +t.dataset.col;
    if (+t.dataset.i !== casc[c].length - 1) return;
    const i = free.indexOf(null);
    if (i < 0) return;
    free[i] = casc[c].pop();
    moved = true; sel = null;
    settle();
  });
  addEventListener("keydown", e => {
    if (e.key !== "F2" || !isFocused()) return;
    e.preventDefault();
    newGame();
  });

  /* ---- menus ---- */
  function menus(label) {
    if (label === "Game") return [
      { label: "New Game", accel: "F2", action: () => newGame() },
      { label: "Restart Game", action: restart },
      { label: "Select Game...", action: selectGame },
      { sep: 1 },
      { label: "Statistics...", action: showStats },
      { sep: 1 },
      { label: "Exit", action: close },
    ];
    return [
      { label: "Help Topics", action: () => showError("FreeCell Help",
        "Move all the cards to the home cells, using the free cells as placeholders.\n\nHome cells build up in suit from the ace. Columns build down, alternating colours. A free cell holds one card.", true) },
      { sep: 1 },
      { label: "About FreeCell", action: () => showError("About FreeCell",
        "FreeCell\nVersion 5.1 (Build 2600)", true) },
    ];
  }

  newGame();

  return { menus, newGame };
}
