/* Spider Solitaire — two decks, ten columns, the 2001 rules. Card faces are
   the js-solitaire sprite sheet lifted at runtime, same as FreeCell, so the
   whole shelf of card games wears one deck. No imports on purpose: the
   build-time smoke runner executes this file in node, so it must stay pure JS. */

export function initSpider(deps) {
  const { host, store, sysSnd, showError, showConfirm, isFocused, close } = deps;

  /* sprite sheet geometry: 4 suit columns x 13 rank rows, one card 71x96 */
  const CW = 71, CH = 96;
  const SUITX = { h: 1, c: 72, d: 143, s: 214 };
  const GLYPH = { h: "♥", d: "♦", c: "♣", s: "♠" };
  const RTXT = [, "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  /* fixed board: ten columns, finished sets bottom-left, stock bottom-right */
  const BW = 780, BH = 470;
  const COLX = c => 8 + c * (CW + 6);
  const BOTY = BH - CH - 8;

  let cols, stock, done, score, movesN;
  let diff = [1, 2, 4].includes(store.data.spDiff) ? store.data.spDiff : 1;
  let sel = null;          /* {col, idx} */
  let undoSnap = null;     /* one level, and a dealt row stays dealt */
  let over = false;

  /* ---- the deck art, borrowed from the solitaire bundle ---- */
  host.classList.add("sp-nosheet");
  fetch("solitaire/main.js").then(r => r.text()).then(t => {
    const m = t.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
    if (!m) throw new Error("no sheet");
    host.style.setProperty("--sp-sheet", `url("${m[0]}")`);
    host.classList.remove("sp-nosheet");
  }).catch(() => {});      /* text corners stand in if the sheet never comes */

  /* ---- the deal: 104 cards, 8 runs of a suit set sized by difficulty ---- */
  function newGame(d) {
    if (d) { diff = d; store.data.spDiff = d; store.save(); }
    const su = diff === 1 ? ["s"] : diff === 2 ? ["s", "h"] : ["s", "h", "d", "c"];
    const deck = [];
    for (let k = 0; k < 8; k++) for (let r = 1; r <= 13; r++) deck.push({ r, s: su[k % su.length], up: false });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    cols = Array.from({ length: 10 }, () => []);
    for (let i = 0; i < 54; i++) cols[i % 10].push(deck.pop());   /* 6,6,6,6,5... */
    for (const a of cols) a[a.length - 1].up = true;
    stock = deck;            /* 50 left: five rows of ten */
    done = []; score = 500; movesN = 0;
    sel = null; undoSnap = null; over = false;
    render();
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
      d.dataset.red = (c.s === "h" || c.s === "d") ? 1 : 0;
    }
    return d;
  }
  function render() {
    host.innerHTML = "";
    for (let c = 0; c < 10; c++) {
      const s = faceEl("sp-slot", null, COLX(c), 8);
      s.dataset.col = c;
      host.appendChild(s);
      const a = cols[c];
      /* long columns squeeze so the bottom row stays clear */
      const ups = a.filter(x => x.up).length, downs = a.length - ups;
      let dU = 17, dD = 6;
      const need = () => downs * dD + Math.max(0, ups - 1) * dU + CH;
      while (need() > BOTY - 16 && dU > 5) dU--;
      while (need() > BOTY - 16 && dD > 2) dD--;
      let y = 8;
      a.forEach((card, i) => {
        const d = faceEl("sp-card " + (card.up ? "up" : "down"), card.up ? card : null, COLX(c), y);
        d.dataset.col = c;
        d.dataset.i = i;
        if (sel && sel.col === c && i >= sel.idx) d.classList.add("sel");
        host.appendChild(d);
        y += card.up ? dU : dD;
      });
    }
    done.forEach((su, k) => {
      host.appendChild(faceEl("sp-card up", { r: 13, s: su }, 8 + k * 24, BOTY));
    });
    const deals = Math.ceil(stock.length / 10);
    for (let k = 0; k < deals; k++) {
      const d = faceEl("sp-card down", null, BW - 8 - CW - k * 12, BOTY);
      d.dataset.stock = 1;
      host.appendChild(d);
    }
    const st = document.createElement("div");
    st.className = "sp-score";
    st.textContent = "Score: " + score + "   Moves: " + movesN;
    host.appendChild(st);
  }

  /* ---- rules ---- */
  function runOK(c, i) {
    const a = cols[c];
    if (!a[i].up) return false;
    for (let k = i; k < a.length - 1; k++)
      if (a[k].s !== a[k + 1].s || a[k].r !== a[k + 1].r + 1) return false;
    return true;
  }
  const snap = () => ({
    cols: JSON.parse(JSON.stringify(cols)),
    stock: JSON.parse(JSON.stringify(stock)),
    done: done.slice(), score, movesN,
  });
  function undo() {
    if (!undoSnap || over) return;
    cols = undoSnap.cols; stock = undoSnap.stock; done = undoSnap.done;
    score = undoSnap.score; movesN = undoSnap.movesN;
    undoSnap = null; sel = null;
    render();
  }
  function tryMove(from, idx, to) {
    if (from === to) return 0;
    const run = cols[from].slice(idx), t = cols[to][cols[to].length - 1];
    if (t && t.r !== run[0].r + 1) return 0;
    undoSnap = snap();
    cols[to].push(...cols[from].splice(idx));
    const a = cols[from];
    if (a.length && !a[a.length - 1].up) a[a.length - 1].up = true;
    score--; movesN++;
    sel = null;
    sweep();
    return 1;
  }
  function dealRow() {
    if (over || !stock.length) return;
    if (cols.some(a => !a.length)) {
      showError("Spider Solitaire", "You cannot deal a new row while there are any empty slots.");
      return;
    }
    for (let i = 0; i < 10; i++) {
      const c = stock.pop();
      c.up = true;
      cols[i].push(c);
    }
    undoSnap = null;
    sel = null;
    sweep();
  }
  /* a full king-to-ace run in one suit leaves the table on its own */
  function sweep() {
    for (const a of cols) {
      const n = a.length;
      if (n < 13) continue;
      let ok = true;
      for (let i = 0; i < 13; i++) {
        const c = a[n - 13 + i];
        if (!c.up || c.s !== a[n - 13].s || c.r !== 13 - i) { ok = false; break; }
      }
      if (ok) {
        done.push(a[n - 13].s);
        a.length = n - 13;
        if (a.length && !a[a.length - 1].up) a[a.length - 1].up = true;
        score += 100;
      }
    }
    render();
    if (done.length === 8) {
      over = true;
      sysSnd("tada", .55);
      showConfirm("Spider", "Congratulations!  You've won the game!\n\nDo you want to play again?", () => newGame());
    }
  }

  /* ---- input ---- */
  host.addEventListener("click", e => {
    if (over) return;
    const t = e.target.closest(".sp-card,.sp-slot");
    if (!t) { sel = null; render(); return; }
    const d = t.dataset;
    if (d.stock) { dealRow(); return; }
    if (d.col == null) { sel = null; render(); return; }    /* a finished set */
    const c = +d.col;
    if (sel) {
      if (sel.col === c && d.i != null && +d.i === sel.idx) { sel = null; render(); return; }
      if (tryMove(sel.col, sel.idx, c)) return;
    }
    sel = null;
    if (d.i != null && runOK(c, +d.i)) sel = { col: c, idx: +d.i };
    render();
  });
  addEventListener("keydown", e => {
    if (!isFocused()) return;
    if (e.key === "F2") { e.preventDefault(); newGame(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); undo(); }
  });

  /* ---- menus ---- */
  function menus(label) {
    if (label === "Game") return [
      { label: "New Game", accel: "F2", action: () => newGame() },
      { sep: 1 },
      { label: "One Suit  (Easy)", check: diff === 1, action: () => newGame(1) },
      { label: "Two Suits  (Medium)", check: diff === 2, action: () => newGame(2) },
      { label: "Four Suits  (Difficult)", check: diff === 4, action: () => newGame(4) },
      { sep: 1 },
      { label: "Undo", accel: "Ctrl+Z", disabled: !undoSnap || over, action: undo },
      { sep: 1 },
      { label: "Exit", action: close },
    ];
    return [
      { label: "Help Topics", action: () => showError("Spider Solitaire Help",
        "Remove all the cards from the table.\n\nColumns build down in rank; only a run of one suit moves as a unit. A full run, king to ace in one suit, leaves the table. Click the stock to deal a new row.", true) },
      { sep: 1 },
      { label: "About Spider Solitaire", action: () => showError("About Spider Solitaire",
        "Spider Solitaire\nVersion 5.1 (Build 2600)", true) },
    ];
  }

  newGame();

  return { menus, newGame, undo };
}
