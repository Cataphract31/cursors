export function initHearts(deps) {
  const { host, sysSnd, showConfirm, showError, isFocused, close } = deps;

  const CW = 71, CH = 96;
  const SUITX = { h: 1, c: 72, d: 143, s: 214 };
  const GLYPH = { h: "♥", d: "♦", c: "♣", s: "♠" };
  const RED = { h: 1, d: 1, c: 0, s: 0 };
  const ORDER = { c: 0, d: 1, s: 2, h: 3 };
  const rowOf = r => (r === 14 ? 0 : r - 1);
  const rtxt = r => (r === 14 ? "A" : r === 13 ? "K" : r === 12 ? "Q" : r === 11 ? "J" : String(r));

  const BW = 700, BH = 500;
  const SPREAD = 49;
  const HANDY = BH - CH - 30;
  const NORTHX = 182, NORTHDX = 22;
  const SIDEY = 92, SIDEDY = 13;
  const EASTX = BW - 8 - CW;
  const CX = 350, CY = 215;
  const DROP = [
    { x: CX - CW / 2, y: CY + 6 },
    { x: CX - CW - 14, y: CY - CH / 2 },
    { x: CX - CW / 2, y: CY - CH - 6 },
    { x: CX + 14, y: CY - CH / 2 },
  ];
  const FROM = [
    { x: CX - CW / 2, y: HANDY },
    { x: 8, y: SIDEY + 100 },
    { x: NORTHX + 130, y: 8 },
    { x: EASTX, y: SIDEY + 100 },
  ];

  const SLIDE = 180;
  const THINK = 260;
  const HOLD = 550;

  const PASS = [1, 3, 2, 0];
  const PASSTXT = ["left", "right", "across", ""];

  let names = ["You", "Pauline", "Michele", "Ben"];
  let seats = [[], [], [], []];
  let total = [0, 0, 0, 0];
  let taken = [[], [], [], []];
  let handNo = 0;
  let phase = "pass";
  let sel = [];
  let got = [];
  let trick = [];
  let leader = 0, turn = 0;
  let firstTrick = true, broken = false, qGone = false;
  let msg = "";
  let modal = false;
  let paused = false;
  let flying = null;

  let gen = 0;
  const timers = new Set();
  function after(ms, fn) {
    const g0 = gen;
    const t = setTimeout(() => { timers.delete(t); if (g0 === gen && !paused) fn(); }, ms);
    timers.add(t);
    return t;
  }
  function cancelAll() {
    gen++;
    for (const t of timers) clearTimeout(t);
    timers.clear();
  }

  host.classList.add("ht-nosheet");
  fetch("solitaire/main.js").then(r => r.text()).then(t => {
    const m = t.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
    if (!m) throw new Error("no sheet");
    host.style.setProperty("--ht-sheet", `url("${m[0]}")`);
    host.classList.remove("ht-nosheet");
  }).catch(() => {});

  const pts = c => (c.s === "h" ? 1 : c.s === "s" && c.r === 12 ? 13 : 0);
  const isQ = c => c.s === "s" && c.r === 12;
  const sortHand = a => a.sort((x, y) => ORDER[x.s] - ORDER[y.s] || x.r - y.r);
  const low = a => a.reduce((b, c) => (c.r < b.r ? c : b));
  const high = a => a.reduce((b, c) => (c.r > b.r ? c : b));
  const suited = (a, s) => a.filter(c => c.s === s);

  function deal() {
    const deck = [];
    for (const s of ["c", "d", "h", "s"]) for (let r = 2; r <= 14; r++) deck.push({ r, s });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    seats = [0, 1, 2, 3].map(i => sortHand(deck.slice(i * 13, i * 13 + 13)));
    taken = [[], [], [], []];
    trick = []; sel = []; got = [];
    firstTrick = true; broken = false; qGone = false;
  }

  let fitScale = 1, fitPend = null, fitTries = 0, refitting = false;
  const onPhone = () => !!(document.body && document.body.classList &&
    document.body.classList.contains("mobile"));
  function fitLater(ms) {
    if (fitPend || fitTries > 14) return;
    fitPend = setTimeout(() => { fitPend = null; fit(); }, ms);
  }
  function fit() {
    const box = host.parentElement;
    if (!box) return;
    if (!onPhone()) {
      if (fitScale !== 1) {
        fitScale = 1;
        host.style.transform = "";
        host.style.transformOrigin = "";
        host.style.margin = "";
      }
      dress();
      return;
    }
    const w = box.clientWidth, h = box.clientHeight;
    if (w < 40 || h < 40) { fitTries++; fitLater(160); return; }
    fitTries = 0;
    const sc = Math.min(1, w / BW, h / BH);
    const dx = Math.max(0, (w - BW * sc) / 2), dy = Math.max(0, (h - BH * sc) / 2);
    host.style.transformOrigin = "0 0";
    host.style.transform = "translate(" + dx.toFixed(2) + "px," + dy.toFixed(2) +
      "px) scale(" + sc.toFixed(4) + ")";
    host.style.marginLeft = "0";
    host.style.marginRight = Math.min(0, Math.round(w - BW)) + "px";
    host.style.marginBottom = Math.min(0, Math.round(h - BH)) + "px";
    const moved = Math.abs(sc - fitScale) > .002;
    fitScale = sc;
    if (moved && !refitting) {
      refitting = true;
      try { render(); } finally { refitting = false; }
      return;
    }
    dress();
  }
  function px(n) { return Math.round(n / (fitScale || 1)) + "px"; }
  function dress() {
    const big = fitScale < .98;
    const m = host.querySelector(".ht-msg");
    if (m) {
      m.style.fontSize = big ? px(12) : "";
      m.style.lineHeight = big ? px(15) : "";
      m.style.bottom = big ? px(4) : "";
      m.style.left = big ? px(8) : "";
      m.style.right = big ? px(8) : "";
    }
    const b = host.querySelector(".ht-pass");
    if (b) {
      const pw = Math.min(BW - 40, 150 / (fitScale || 1));
      b.style.fontSize = big ? px(13) : "";
      b.style.minWidth = big ? Math.round(pw) + "px" : "";
      b.style.height = big ? px(32) : "";
      b.style.padding = big ? "0" : "";
      b.style.right = big ? "auto" : "";
      b.style.bottom = big ? (BH - HANDY + 26) + "px" : "";
      b.style.left = big ? Math.round((BW - pw) / 2) + "px" : "";
    }
    const d = host.querySelector(".ht-modal");
    if (d) {
      d.style.fontSize = big ? px(12) : "";
      d.style.minWidth = big ? px(200) : "";
      d.style.padding = big ? px(10) + " " + px(12) : "";
      for (const t of d.querySelectorAll("table")) t.style.fontSize = big ? px(12) : "";
      for (const t of d.querySelectorAll("button")) {
        t.style.fontSize = big ? px(12) : "";
        t.style.minWidth = big ? px(70) : "";
        t.style.height = big ? px(26) : "";
      }
    }
    const t = host.querySelector(".ht-score table");
    if (t) {
      t.style.fontSize = big ? px(10) : "";
      t.style.lineHeight = big ? px(8.8) : "";
    }
  }

  function faceEl(cls, c, x, y) {
    const d = document.createElement("div");
    d.className = cls;
    d.style.left = Math.round(x) + "px";
    d.style.top = Math.round(y) + "px";
    if (c) {
      d.style.backgroundPosition = "-" + SUITX[c.s] + "px -" + (1 + CH * rowOf(c.r)) + "px";
      d.dataset.face = rtxt(c.r) + GLYPH[c.s];
      d.dataset.red = RED[c.s];
    }
    return d;
  }
  function label(cls, text, x, y, w) {
    const d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    d.style.left = Math.round(x) + "px";
    d.style.top = Math.round(y) + "px";
    if (w) d.style.width = w + "px";
    return d;
  }
  function handSpan(n) { return n > 1 ? (n - 1) * SPREAD + CW : CW; }

  function scoreboard() {
    const d = document.createElement("div");
    d.className = "ht-score";
    const wide = fitScale > .98;
    let h = '<table><tr><th></th><th>' + (wide ? "Hand" : "Pts") +
      "</th><th>" + (wide ? "Total" : "Tot") + "</th></tr>";
    for (let i = 0; i < 4; i++) {
      const hp = handPts(i);
      h += '<tr' + (phase === "play" && turn === i ? ' class="ht-now"' : "") + '><td>' +
        esc(names[i].slice(0, 11)) + "</td><td>" + hp + "</td><td>" + total[i] + "</td></tr>";
    }
    d.innerHTML = h + "</table>";
    return d;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function handPts(i) { return taken[i].reduce((n, c) => n + pts(c), 0); }

  function render() {
    const keep = modal ? host.querySelector(".ht-modal") : null;
    host.innerHTML = "";
    host.appendChild(scoreboard());

    const n2 = seats[2].length;
    for (let i = 0; i < n2; i++) host.appendChild(faceEl("ht-card down", null, NORTHX + i * NORTHDX, 8));
    for (const [seat, x] of [[1, 8], [3, EASTX]]) {
      const n = seats[seat].length;
      for (let i = 0; i < n; i++) host.appendChild(faceEl("ht-card down", null, x, SIDEY + i * SIDEDY));
    }
    host.appendChild(label("ht-name", names[1], 8, 348, 110));
    host.appendChild(label("ht-name", names[2], NORTHX, 106, 200));
    host.appendChild(label("ht-name ht-r", names[3], BW - 8 - 110, 348, 110));

    let flyEl = null;
    for (const p of trick) {
      const d = faceEl("ht-card up ht-trick", p.card, DROP[p.seat].x, DROP[p.seat].y);
      if (flying && flying.card === p.card) flyEl = d;
      host.appendChild(d);
    }

    const hand = seats[0];
    const startX = Math.round((BW - handSpan(hand.length)) / 2);
    const myMove = phase === "play" && turn === 0 && trick.length < 4;
    const ok = myMove ? legalCards(0) : null;
    hand.forEach((c, i) => {
      const up = sel.indexOf(c) >= 0 ? 16 : 0;
      const playable = ok ? ok.indexOf(c) >= 0 : false;
      const d = faceEl("ht-card up ht-mine", c, startX + i * SPREAD, HANDY - (up || (playable ? 10 : 0)));
      d.dataset.i = i;
      if (up) d.classList.add("ht-sel");
      if (got.indexOf(c) >= 0) d.classList.add("ht-got");
      if (myMove) d.classList.add(playable ? "ht-ok" : "ht-no");
      host.appendChild(d);
    });
    host.appendChild(label("ht-name", names[0], 20, BH - 22, 150));

    const m = document.createElement("div");
    m.className = "ht-msg";
    m.textContent = msg;
    host.appendChild(m);

    if (phase === "pass" && sel.length === 3) {
      const b = document.createElement("button");
      b.className = "ht-pass";
      b.textContent = "Pass " + PASSTXT[handNo % 4];
      b.dataset.pass = 1;
      host.appendChild(b);
    }

    if (flyEl) {
      const dest = flying, el = flyEl;
      el.style.left = Math.round(dest.fx) + "px";
      el.style.top = Math.round(dest.fy) + "px";
      flying = null;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = "left " + SLIDE + "ms linear,top " + SLIDE + "ms linear";
        el.style.left = Math.round(DROP[dest.seat].x) + "px";
        el.style.top = Math.round(DROP[dest.seat].y) + "px";
      }));
    }
    if (keep) host.appendChild(keep);
    fit();
  }

  function legalCards(i) {
    const h = seats[i];
    if (!trick.length) {
      if (firstTrick) return h.filter(c => c.s === "c" && c.r === 2);
      if (!broken) {
        const non = h.filter(c => c.s !== "h");
        if (non.length) return non;
      }
      return h.slice();
    }
    const led = trick[0].card.s;
    const follow = suited(h, led);
    if (follow.length) return follow;
    if (firstTrick) {
      const safe = h.filter(c => !pts(c));
      if (safe.length) return safe;
    }
    return h.slice();
  }
  const SUITNAME = { c: "clubs", d: "diamonds", h: "hearts", s: "spades" };
  function refusal(c) {
    if (!trick.length) {
      if (firstTrick) return "The two of clubs leads the first trick — play the lit card.";
      return "Hearts have not been broken — lead a lit card.";
    }
    const led = trick[0].card.s;
    if (suited(seats[0], led).length) return "You must follow suit — play a lit " + SUITNAME[led] + ".";
    return "No hearts or the queen of spades on the first trick.";
  }
  const trickPts = () => trick.reduce((n, p) => n + pts(p.card), 0);
  function trickTop() {
    const led = trick[0].card.s;
    return trick.reduce((b, p) => (p.card.s === led && p.card.r > b ? p.card.r : b), 0);
  }

  function botPass(i) {
    const h = seats[i].slice();
    const cnt = s => suited(h, s).length;
    const want = c => {
      if (c.s === "s") {
        if (c.r === 12) return cnt("s") <= 3 ? 200 : 120;
        if (c.r > 12) return cnt("s") <= 3 ? 150 : 90;
        return c.r - 8;
      }
      if (c.s === "h") return c.r >= 12 ? c.r + 30 : c.r - 6;
      return c.r + (cnt(c.s) <= 2 ? 24 : 0);
    };
    return h.sort((a, b) => want(b) - want(a)).slice(0, 3);
  }

  function moonThreat(i) {
    let who = -1;
    for (let k = 0; k < 4; k++) {
      if (!handPts(k)) continue;
      if (who >= 0) return -1;
      who = k;
    }
    if (who < 0 || who === i || handPts(who) < 6) return -1;
    return who;
  }

  function pickPlay(i) {
    const opts = legalCards(i);
    if (opts.length === 1) return opts[0];
    const hand = seats[i];
    const qMine = opts.filter(isQ)[0];
    const qLive = !qGone && !hand.filter(isQ).length;

    if (!trick.length) return pickLead(i, opts, qLive);

    const led = trick[0].card.s;
    const follow = opts.filter(c => c.s === led);
    if (!follow.length) return pickDiscard(i, opts, qLive);

    let pool = follow;
    if (led === "s") {
      const topS = trickTop();
      if (qMine && topS > 12) return qMine;
      if (qMine && pool.length > 1) pool = pool.filter(c => !isQ(c));
      if (qLive) {
        const under = pool.filter(c => c.r < 12);
        if (under.length) pool = under;
      }
    }
    const top = trickTop();
    const losers = pool.filter(c => c.r < top);
    const winners = pool.filter(c => c.r > top);
    if (!losers.length) return low(pool);
    if (!winners.length) return high(losers);
    if (moonThreat(i) >= 0) return low(winners);
    if (!trickPts() && trick.length === 3 && hand.length > 5) return low(winners);
    return high(losers);
  }

  function pickLead(i, opts, qLive) {
    const hand = seats[i];
    const spades = opts.filter(c => c.s === "s");
    const bigS = hand.filter(c => c.s === "s" && c.r >= 12).length;
    if (qLive) {
      const under = spades.filter(c => c.r < 12);
      if (under.length) return low(under);
    }
    const suits = ["c", "d", "s", "h"].filter(s => opts.filter(c => c.s === s).length);
    const rank = s => {
      const n = opts.filter(c => c.s === s).length;
      let v = n * 2;
      if (s === "h") v += 20;
      if (s === "s" && bigS) v += 14;
      return v;
    };
    suits.sort((a, b) => rank(a) - rank(b));
    return low(opts.filter(c => c.s === suits[0]));
  }

  function pickDiscard(i, opts, qLive) {
    const q = opts.filter(isQ)[0];
    if (q) return q;
    const court = opts.filter(c => c.s === "s" && c.r > 12);
    if (qLive && court.length) return high(court);
    const hs = opts.filter(c => c.s === "h");
    if (hs.length) return high(hs);
    const suits = ["c", "d", "s", "h"].filter(s => opts.filter(c => c.s === s).length);
    suits.sort((a, b) => opts.filter(c => c.s === b).length - opts.filter(c => c.s === a).length);
    return high(opts.filter(c => c.s === suits[0]));
  }

  function startPass() {
    const dir = PASS[handNo % 4];
    if (!dir) return startPlay();
    phase = "pass";
    sel = []; got = [];
    msg = "Select three cards to pass " + PASSTXT[handNo % 4] + ".";
    render();
  }
  function doPass() {
    const dir = PASS[handNo % 4];
    const out = [sel.slice(), botPass(1), botPass(2), botPass(3)];
    for (let i = 0; i < 4; i++) for (const c of out[i]) seats[i].splice(seats[i].indexOf(c), 1);
    for (let i = 0; i < 4; i++) seats[(i + dir) % 4].push(...out[i]);
    for (const h of seats) sortHand(h);
    got = out[(4 - dir) % 4].slice();
    sel = [];
    startPlay();
  }

  function startPlay() {
    phase = "play";
    trick = [];
    for (let i = 0; i < 4; i++) if (suited(seats[i], "c").filter(c => c.r === 2).length) leader = i;
    turn = leader;
    render();
    advance();
  }
  function advance() {
    if (phase !== "play" || paused) return;
    if (trick.length === 4) { after(HOLD, finishTrick); return; }
    if (turn === 0) {
      msg = firstTrick && !trick.length
        ? "Your lead — play the two of clubs (lit below)."
        : "Your turn — play a lit card.";
      render();
      return;
    }
    msg = names[turn] + " is playing.";
    render();
    after(THINK, () => play(turn, pickPlay(turn)));
  }
  function play(seat, card) {
    const h = seats[seat];
    const k = h.indexOf(card);
    if (k < 0) return;
    h.splice(k, 1);
    trick.push({ seat, card });
    if (card.s === "h") broken = true;
    if (isQ(card)) qGone = true;
    flying = { card, seat, fx: FROM[seat].x, fy: FROM[seat].y };
    turn = (turn + 1) % 4;
    render();
    after(SLIDE, advance);
  }
  function finishTrick() {
    const led = trick[0].card.s;
    let win = trick[0];
    for (const p of trick) if (p.card.s === led && p.card.r > win.card.r) win = p;
    for (const p of trick) if (pts(p.card)) taken[win.seat].push(p.card);
    trick = [];
    firstTrick = false;
    got = [];
    leader = win.seat; turn = win.seat;
    if (!seats[0].length) return endHand();
    msg = names[win.seat] + " takes the trick.";
    render();
    advance();
  }

  function endHand() {
    const hp = [0, 1, 2, 3].map(handPts);
    const moon = hp.indexOf(26);
    if (moon >= 0) for (let i = 0; i < 4; i++) hp[i] = i === moon ? 0 : 26;
    for (let i = 0; i < 4; i++) total[i] += hp[i];
    handNo++;
    const done = Math.max(...total) >= 100;
    let head = "";
    if (moon >= 0) head = (moon === 0 ? "You shot" : names[moon] + " shot") + " the moon.";
    boardDialog(head, hp, done);
  }
  function gameOver() {
    phase = "over";
    const best = Math.min(...total);
    const win = total.indexOf(best);
    if (win === 0) sysSnd("tada", .55);
    const lines = [0, 1, 2, 3]
      .map(i => names[i] + ": " + total[i])
      .join("\n");
    showConfirm("Hearts",
      (win === 0 ? "You win." : names[win] + " wins.") + "\n\n" + lines +
      "\n\nDo you want to play again?", () => newGame());
  }

  function boardDialog(head, hp, done) {
    modal = true;
    msg = "";
    render();
    const d = document.createElement("div");
    d.className = "ht-modal";
    let t = "<b>Hearts</b>";
    if (head) t += '<div class="ht-modal-x">' + esc(head) + "</div>";
    t += "<table><tr><th></th><th>Hand</th><th>Total</th></tr>";
    for (let i = 0; i < 4; i++) t += "<tr><td>" + esc(names[i]) + "</td><td>" + hp[i] + "</td><td>" + total[i] + "</td></tr>";
    t += '</table><div class="ht-modal-btns"><button>OK</button></div>';
    d.innerHTML = t;
    d.addEventListener("click", e => {
      if (!e.target.closest("button")) return;
      e.stopPropagation();
      modal = false;
      d.remove();
      if (done) return gameOver();
      deal();
      startPass();
    });
    host.appendChild(d);
    dress();
  }

  host.addEventListener("click", e => {
    if (modal || phase === "over") return;
    if (e.target.closest("[data-pass]")) { doPass(); return; }
    const t = e.target.closest(".ht-mine");
    if (!t || t.dataset.i == null) return;
    const c = seats[0][+t.dataset.i];
    if (!c) return;
    if (phase === "pass") {
      const k = sel.indexOf(c);
      if (k >= 0) sel.splice(k, 1);
      else if (sel.length < 3) sel.push(c);
      msg = sel.length === 3
        ? "Click Pass, or click a card to put it back."
        : "Select three cards to pass " + PASSTXT[handNo % 4] + ".";
      render();
      return;
    }
    if (phase !== "play" || turn !== 0 || trick.length === 4) return;
    if (legalCards(0).indexOf(c) < 0) { msg = refusal(c); render(); return; }
    got = [];
    play(0, c);
  });
  addEventListener("keydown", e => {
    if (e.key !== "F2" || !isFocused()) return;
    e.preventDefault();
    newGame();
  });
  const onFit = () => { fitTries = 0; fit(); fitLater(260); };
  if (initHearts._fit) {
    removeEventListener("resize", initHearts._fit);
    removeEventListener("orientationchange", initHearts._fit);
  }
  initHearts._fit = onFit;
  addEventListener("resize", onFit);
  addEventListener("orientationchange", onFit);

  function newGame() {
    cancelAll();
    paused = false;
    modal = false;
    let bots = ["Pauline", "Michele", "Ben"];
    try {
      const b = deps.botNames && deps.botNames();
      if (b && b.length === 3) bots = b.map(x => String(x).slice(0, 14));
    } catch (err) {}
    let me = "You";
    try { if (deps.playerName) me = String(deps.playerName()).slice(0, 14) || "You"; } catch (err) {}
    names = [me, bots[0], bots[1], bots[2]];
    total = [0, 0, 0, 0];
    handNo = 0;
    msg = "";
    deal();
    startPass();
  }
  function pause() { cancelAll(); paused = true; }
  function resume() {
    fitTries = 0;
    fit();
    fitLater(300);
    if (!paused) return;
    paused = false;
    render();
    advance();
  }

  function menus(label2) {
    if (label2 === "Game") return [
      { label: "New Game", accel: "F2", action: newGame },
      { sep: 1 },
      { label: "Exit", action: close },
    ];
    return [
      { label: "Contents", action: () => showError("Hearts Help",
        "Take as few points as possible. Each heart is one point and the queen of spades is thirteen.\n\n" +
        "Before each hand you pass three cards: left, right, across, then no pass.\n\n" +
        "The two of clubs leads the first trick. Follow suit if you can. No hearts and no queen of spades on the first trick, and hearts cannot be led until they have been broken.\n\n" +
        "Take all twenty-six points and everyone else scores them instead.\n\n" +
        "The game ends when a player reaches 100. The lowest score wins.", true) },
      { sep: 1 },
      { label: "About Hearts", action: () => showError("About Hearts",
        "Hearts\nVersion 5.1 (Build 2600)", true) },
    ];
  }

  newGame();

  return { menus, newGame, pause, resume };
}
