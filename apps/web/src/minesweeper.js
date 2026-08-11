/* Minesweeper — the real rules, the real sprites (winXP repo, MIT).
   No asset imports here on purpose: the build-time smoke runner executes this
   file in node, so it must stay pure JS. main.js injects sprites + shell hooks. */

export const LEVELS = {
  beginner:     { w: 9,  h: 9,  m: 10, label: "Beginner" },
  intermediate: { w: 16, h: 16, m: 40, label: "Intermediate" },
  expert:       { w: 30, h: 16, m: 99, label: "Expert" },
};

export function initMinesweeper(deps) {
  const { MINE, host, headEls, store, sysSnd, showError, showMenu, onWin } = deps;

  let level = "beginner", marks = true;
  let W = 0, H = 0, MINES = 0;
  let cells = [], els = [];
  let started = false, over = false, won = false;
  let opened = 0, flags = 0, time = 0, timer = null;
  let lDown = false, rDown = false, pressed = [];

  const idx = (x, y) => y * W + x;
  const inB = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
  function neighbors(i) {
    const x = i % W, y = (i / W) | 0, out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (inB(x + dx, y + dy)) out.push(idx(x + dx, y + dy));
    }
    return out;
  }

  /* ---- digits & face ---- */
  function setDigits(node, n) {
    const neg = n < 0;
    const v = Math.min(neg ? 99 : 999, Math.abs(n));
    const s = String(v).padStart(3, "0");
    const chars = neg ? ["-", s[1], s[2]] : [s[0], s[1], s[2]];
    node.innerHTML = "";
    for (const c of chars) {
      const img = document.createElement("img");
      img.className = "ms-digit";
      img.src = c === "-" ? MINE["digit-"] : MINE["digit" + c];
      img.alt = c;
      node.appendChild(img);
    }
  }
  function setFace(name) { headEls.face.querySelector("img").src = MINE[name]; }
  function syncCounter() { setDigits(headEls.counter, MINES - flags); }
  function syncTimer() { setDigits(headEls.timer, time); }

  function stopTimer() { clearInterval(timer); timer = null; }
  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      if (over) return stopTimer();
      time = Math.min(999, time + 1);
      syncTimer();
    }, 1000);
  }

  /* ---- board ---- */
  function newGame(lv) {
    if (lv) level = lv;
    const L = LEVELS[level];
    W = L.w; H = L.h; MINES = L.m;
    cells = Array.from({ length: W * H }, () => ({ mine: false, adj: 0, st: "hidden" }));
    started = over = won = false;
    opened = flags = time = 0;
    lDown = rDown = false; pressed = [];
    stopTimer();
    render();
    setFace("smile");
    syncCounter(); syncTimer();
  }

  function placeMines(safe) {
    let placed = 0;
    while (placed < MINES) {
      const i = Math.floor(Math.random() * cells.length);
      if (i === safe || cells[i].mine) continue;
      cells[i].mine = true; placed++;
    }
    for (let i = 0; i < cells.length; i++)
      cells[i].adj = neighbors(i).filter(n => cells[n].mine).length;
  }

  function render() {
    host.style.width = (W * 16) + "px";
    host.style.height = (H * 16) + "px";
    host.innerHTML = "";
    els = cells.map((_, i) => {
      const d = document.createElement("div");
      d.className = "ms-c";
      d.dataset.i = i;
      host.appendChild(d);
      return d;
    });
    cells.forEach((_, i) => paint(i));
  }

  function paint(i) {
    const c = cells[i], el = els[i];
    if (!el) return;
    let cls = "ms-c", bg = "";
    /* sprites are transparent glyphs; "open" supplies the sunken cell itself,
       and there is no open0 sprite because a cleared blank square is just that */
    if (c.st === "open") {
      cls += " open";
      if (c.mine) bg = MINE["mine-ceil"];
      else if (c.adj) bg = MINE["open" + c.adj];
    } else if (c.st === "boom") { cls += " open"; bg = MINE["mine-death"]; }
    else if (c.st === "wrong") { cls += " open"; bg = MINE.misflagged; }
    else if (c.st === "flag") bg = MINE.flag;
    else if (c.st === "question") bg = MINE.question;
    else if (c.st === "qdown") { cls += " open"; bg = MINE.question; }
    else if (c.st === "down") cls += " open";
    el.className = cls;
    el.style.backgroundImage = bg ? `url(${bg})` : "";
  }

  function reveal(i) {
    const c = cells[i];
    if (c.st !== "hidden" && c.st !== "question") return;
    if (c.mine) { c.st = "boom"; paint(i); return lose(); }
    /* iterative flood fill */
    const stack = [i];
    while (stack.length) {
      const j = stack.pop(), cc = cells[j];
      if (cc.st === "open" || cc.st === "flag") continue;
      cc.st = "open"; opened++; paint(j);
      if (cc.adj === 0) for (const n of neighbors(j)) {
        const nn = cells[n];
        if (nn.st === "hidden" || nn.st === "question") stack.push(n);
      }
    }
    checkWin();
  }

  function chord(i) {
    const c = cells[i];
    if (c.st !== "open" || !c.adj) return;
    const ns = neighbors(i);
    const f = ns.filter(n => cells[n].st === "flag").length;
    if (f !== c.adj) return;
    for (const n of ns) if (cells[n].st === "hidden" || cells[n].st === "question") reveal(n);
  }

  function lose() {
    over = true; stopTimer(); setFace("dead");
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c.mine && c.st !== "boom" && c.st !== "flag") { c.st = "open"; paint(i); }
      else if (!c.mine && c.st === "flag") { c.st = "wrong"; paint(i); }
    }
  }

  function checkWin() {
    if (opened !== cells.length - MINES) return;
    over = true; won = true; stopTimer(); setFace("win");
    for (let i = 0; i < cells.length; i++)
      if (cells[i].mine && cells[i].st !== "flag") { cells[i].st = "flag"; flags++; paint(i); }
    syncCounter();
    sysSnd("tada", .55);
    recordBest();
    if (onWin) onWin(level, time);
  }

  /* ---- best times ---- */
  function bestTimes() {
    store.data.mineBest = store.data.mineBest || {};
    return store.data.mineBest;
  }
  function recordBest() {
    const b = bestTimes(), prev = b[level];
    if (!prev || time < prev.t) {
      b[level] = { t: time, who: deps.playerName() };
      store.save();
    }
  }
  function showBest() {
    const b = bestTimes();
    const row = k => {
      const r = b[k];
      return `${LEVELS[k].label.padEnd(13)}${r ? String(r.t).padStart(3) + " seconds   " + r.who : "999 seconds   anonymous"}`;
    };
    showError("Best Times", [row("beginner"), row("intermediate"), row("expert")].join("\n"), true);
  }
  function resetBest() { store.data.mineBest = {}; store.save(); showBest(); }

  /* ---- input ---- */
  function cellAt(e) {
    const t = e.target.closest(".ms-c");
    return t ? +t.dataset.i : -1;
  }
  function clearPressed() {
    for (const i of pressed) if (cells[i].st === "down" || cells[i].st === "qdown")
      { cells[i].st = cells[i].st === "qdown" ? "question" : "hidden"; paint(i); }
    pressed = [];
  }
  function press(i, chording) {
    clearPressed();
    if (i < 0) return;
    const list = chording ? [i, ...neighbors(i)] : [i];
    for (const j of list) {
      const c = cells[j];
      if (c.st === "hidden") { c.st = "down"; pressed.push(j); paint(j); }
      else if (c.st === "question") { c.st = "qdown"; pressed.push(j); paint(j); }
    }
  }

  host.addEventListener("mousedown", e => {
    if (over) return;
    const i = cellAt(e);
    if (e.button === 0) lDown = true;
    if (e.button === 2) rDown = true;
    if (e.button === 2 && !lDown) {
      if (i < 0) return;
      const c = cells[i];
      if (c.st === "hidden") { c.st = "flag"; flags++; }
      else if (c.st === "flag") { c.st = marks ? "question" : "hidden"; flags--; }
      else if (c.st === "question") c.st = "hidden";
      else return;
      paint(i); syncCounter();
      return;
    }
    setFace("ohh");
    press(i, lDown && rDown);
  });
  host.addEventListener("mousemove", e => {
    if (over || !lDown) return;
    press(cellAt(e), lDown && rDown);
  });
  host.addEventListener("mouseleave", () => { if (!over) clearPressed(); });
  let chordDone = false;   /* the second release of a chord must not reveal */
  addEventListener("mouseup", e => {
    const wasChord = lDown && rDown;
    if (e.button === 0) lDown = false;
    if (e.button === 2) rDown = false;
    if (over) return;
    if (!(e.target.closest && e.target.closest(".ms-grid"))) { clearPressed(); setFace("smile"); return; }
    const i = cellAt(e);
    clearPressed();
    setFace("smile");
    if (i < 0) return;
    if (wasChord) { chord(i); chordDone = true; return; }
    if (chordDone) { chordDone = false; return; }
    if (e.button !== 0) return;
    if (!started) { started = true; placeMines(i); startTimer(); }
    reveal(i);
  });
  headEls.face.addEventListener("click", () => newGame());

  /* ---- menus ---- */
  function gameMenu(x, y) {
    showMenu([
      { label: "New", action: () => newGame() },
      { sep: 1 },
      ...Object.keys(LEVELS).map(k => ({
        label: LEVELS[k].label, check: level === k,
        action: () => { store.data.mineLevel = k; store.save(); newGame(k); },
      })),
      { sep: 1 },
      { label: "Marks (?)", check: marks, action: () => { marks = !marks; store.data.mineMarks = marks; store.save(); } },
      { sep: 1 },
      { label: "Best Times...", action: showBest },
      { label: "Reset Best Times", action: resetBest },
      { sep: 1 },
      { label: "Exit", action: () => deps.close() },
    ], x, y);
  }
  function helpMenu(x, y) {
    showMenu([
      { label: "Help Topics", action: () => showError("Minesweeper Help",
        "Left click clears a square. Right click flags a mine.\nBoth buttons on a number clears its neighbours once you have flagged that many.\n\nThe first square is always safe.", true) },
      { sep: 1 },
      { label: "About Minesweeper", action: () => showError("About Minesweeper",
        "Minesweeper\nVersion 5.1 (Build 2600)", true) },
    ], x, y);
  }

  marks = store.data.mineMarks !== false;
  newGame(store.data.mineLevel || "beginner");

  return {
    newGame,
    gameMenu, helpMenu,
    setLevel: lv => { store.data.mineLevel = lv; store.save(); newGame(lv); },
    currentLevel: () => level,
    pause: stopTimer,
    /* reopening the box restarts the clock of an unfinished game — a paused
       clock must not turn into a 3-second Expert record */
    resume: () => { if (started && !over && !timer) startTimer(); },
  };
}
