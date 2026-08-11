/* Hearts — the 2001 rules, four players, one deck. Card faces come out of the
   js-solitaire sprite sheet at runtime, exactly as FreeCell and Spider take
   them, so the whole shelf of card games wears the same deck and no second
   copy of the art ships. No imports on purpose: the build-time smoke runner
   executes this file in node, so it must stay pure JS. */

export function initHearts(deps) {
  const { host, sysSnd, showConfirm, showError, isFocused, close } = deps;

  /* sprite sheet geometry: 4 suit columns x 13 rank rows, one card 71x96.
     The sheet counts the ace as row 0; hearts wants the ace high, so ranks
     live as 2..14 here and only the row lookup bends back. */
  const CW = 71, CH = 96;
  const SUITX = { h: 1, c: 72, d: 143, s: 214 };
  const GLYPH = { h: "♥", d: "♦", c: "♣", s: "♠" };
  const RED = { h: 1, d: 1, c: 0, s: 0 };
  const ORDER = { c: 0, d: 1, s: 2, h: 3 };   /* the order a hand is fanned in */
  const rowOf = r => (r === 14 ? 0 : r - 1);
  const rtxt = r => (r === 14 ? "A" : r === 13 ? "K" : r === 12 ? "Q" : r === 11 ? "J" : String(r));

  /* ---- the felt ---- */
  const BW = 700, BH = 500;
  const SPREAD = 49;                       /* your thirteen, fanned */
  const HANDY = BH - CH - 30;              /* 374 */
  const NORTHX = 182, NORTHDX = 22;
  const SIDEY = 92, SIDEDY = 13;
  const EASTX = BW - 8 - CW;
  const CX = 350, CY = 215;                /* the middle of the trick */
  /* where a played card lands, per seat */
  const DROP = [
    { x: CX - CW / 2, y: CY + 6 },         /* 0 south — you */
    { x: CX - CW - 14, y: CY - CH / 2 },   /* 1 west  — on your left */
    { x: CX - CW / 2, y: CY - CH - 6 },    /* 2 north — across */
    { x: CX + 14, y: CY - CH / 2 },        /* 3 east  — on your right */
  ];
  /* roughly where each seat's cards sit, so a play can slide out of the hand */
  const FROM = [
    { x: CX - CW / 2, y: HANDY },
    { x: 8, y: SIDEY + 100 },
    { x: NORTHX + 130, y: 8 },
    { x: EASTX, y: SIDEY + 100 },
  ];

  const SLIDE = 180;    /* the card's flight */
  const THINK = 260;    /* a computer player's pause before it plays */
  const HOLD = 550;     /* the beat the finished trick sits there */

  /* passing goes left, right, across, hold — then round again */
  const PASS = [1, 3, 2, 0];
  const PASSTXT = ["left", "right", "across", ""];

  /* ---- state ---- */
  let names = ["You", "Pauline", "Michele", "Ben"];
  let seats = [[], [], [], []];
  let total = [0, 0, 0, 0];
  let taken = [[], [], [], []];   /* the point cards each seat has won this hand */
  let handNo = 0;
  let phase = "pass";             /* pass | play | over */
  let sel = [];                   /* the three you are giving away */
  let got = [];                   /* the three you were given, highlighted once */
  let trick = [];                 /* [{seat,card}] in play order */
  let leader = 0, turn = 0;
  let firstTrick = true, broken = false, qGone = false;
  let msg = "";
  let modal = false;              /* a board dialog owns the clicks */
  let paused = false;
  let flying = null;              /* the card mid-flight, handed to render() */

  /* ---- timers: one generation counter and every pending beat dies at once,
     so New Game (or a close) never gets played into by the last hand ---- */
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

  /* ---- the deck art, borrowed from the solitaire bundle ---- */
  host.classList.add("ht-nosheet");
  fetch("solitaire/main.js").then(r => r.text()).then(t => {
    const m = t.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
    if (!m) throw new Error("no sheet");
    host.style.setProperty("--ht-sheet", `url("${m[0]}")`);
    host.classList.remove("ht-nosheet");
  }).catch(() => {});      /* text corners stand in if the sheet never comes */

  /* ---- cards ---- */
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

  /* ---- rendering ---- */
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
    let h = '<table><tr><th></th><th>Hand</th><th>Total</th></tr>';
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

    /* the three computer players show backs; the count is the information */
    const n2 = seats[2].length;
    for (let i = 0; i < n2; i++) host.appendChild(faceEl("ht-card down", null, NORTHX + i * NORTHDX, 8));
    for (const [seat, x] of [[1, 8], [3, EASTX]]) {
      const n = seats[seat].length;
      for (let i = 0; i < n; i++) host.appendChild(faceEl("ht-card down", null, x, SIDEY + i * SIDEDY));
    }
    host.appendChild(label("ht-name", names[1], 8, 348, 110));
    host.appendChild(label("ht-name", names[2], NORTHX, 106, 200));
    host.appendChild(label("ht-name ht-r", names[3], BW - 8 - 110, 348, 110));

    /* the trick, and whatever is still in flight towards it */
    let flyEl = null;
    for (const p of trick) {
      const d = faceEl("ht-card up ht-trick", p.card, DROP[p.seat].x, DROP[p.seat].y);
      if (flying && flying.card === p.card) flyEl = d;
      host.appendChild(d);
    }

    /* your hand */
    const hand = seats[0];
    const startX = Math.round((BW - handSpan(hand.length)) / 2);
    hand.forEach((c, i) => {
      const up = sel.indexOf(c) >= 0 ? 16 : 0;
      const d = faceEl("ht-card up ht-mine", c, startX + i * SPREAD, HANDY - up);
      d.dataset.i = i;
      if (up) d.classList.add("ht-sel");
      if (got.indexOf(c) >= 0) d.classList.add("ht-got");
      host.appendChild(d);
    });
    host.appendChild(label("ht-name", names[0], 20, BH - 22, 150));

    const m = document.createElement("div");
    m.className = "ht-msg";
    m.textContent = msg;
    host.appendChild(m);

    /* the Pass button only exists once three cards are up */
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
      /* two frames: the start position has to be painted before the move,
         or the browser folds both into one and there is no slide at all */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = "left " + SLIDE + "ms linear,top " + SLIDE + "ms linear";
        el.style.left = Math.round(DROP[dest.seat].x) + "px";
        el.style.top = Math.round(DROP[dest.seat].y) + "px";
      }));
    }
    if (keep) host.appendChild(keep);
  }

  /* ---- the rules ---- */
  /* Every legal-play question in Hearts answers here, for people and
     computers alike, so the two can never drift apart. */
  function legalCards(i) {
    const h = seats[i];
    if (!trick.length) {
      /* the two of clubs opens the hand, always */
      if (firstTrick) return h.filter(c => c.s === "c" && c.r === 2);
      if (!broken) {
        const non = h.filter(c => c.s !== "h");
        if (non.length) return non;      /* hearts wait until they are broken */
      }
      return h.slice();                  /* a hand of nothing but hearts may lead one */
    }
    const led = trick[0].card.s;
    const follow = suited(h, led);
    if (follow.length) return follow;
    if (firstTrick) {
      /* no blood on the first trick: no heart, no queen, unless that is all there is */
      const safe = h.filter(c => !pts(c));
      if (safe.length) return safe;
    }
    return h.slice();
  }
  function refusal(c) {
    if (!trick.length) {
      if (firstTrick) return "The two of clubs leads the first trick.";
      return "Hearts have not been broken.";
    }
    const led = trick[0].card.s;
    if (suited(seats[0], led).length) return "You must follow suit.";
    return "You cannot play a point card on the first trick.";
  }
  const trickPts = () => trick.reduce((n, p) => n + pts(p.card), 0);
  function trickTop() {
    const led = trick[0].card.s;
    return trick.reduce((b, p) => (p.card.s === led && p.card.r > b ? p.card.r : b), 0);
  }

  /* ---- the computer players ----
     Ordered heuristics, nothing cleverer. They follow suit, they duck a
     dangerous trick, they hand the queen to whoever is already winning, and
     they will shorten a suit while passing. They do not count the room and
     they never try to shoot. */

  function botPass(i) {
    const h = seats[i].slice();
    const cnt = s => suited(h, s).length;
    const want = c => {
      if (c.s === "s") {
        /* the queen leaves unless there are low spades to hide her behind */
        if (c.r === 12) return cnt("s") <= 3 ? 200 : 120;
        if (c.r > 12) return cnt("s") <= 3 ? 150 : 90;   /* an unguarded ace or king eats her */
        return c.r - 8;                                   /* low spades are the guards; keep them */
      }
      if (c.s === "h") return c.r >= 12 ? c.r + 30 : c.r - 6;  /* keep the small hearts to duck with */
      /* a suit of two or fewer is worth emptying — being void is a discard */
      return c.r + (cnt(c.s) <= 2 ? 24 : 0);
    };
    return h.sort((a, b) => want(b) - want(a)).slice(0, 3);
  }

  /* if one seat has every point taken so far, the rest of the table stops
     ducking and starts spending aces — a moon costs everybody else 26 */
  function moonThreat(i) {
    let who = -1;
    for (let k = 0; k < 4; k++) {
      if (!handPts(k)) continue;
      if (who >= 0) return -1;        /* the points are split; nobody is running */
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
    /* the queen is "live" while she is out there and not in our own hand */
    const qLive = !qGone && !hand.filter(isQ).length;

    if (!trick.length) return pickLead(i, opts, qLive);

    const led = trick[0].card.s;
    const follow = opts.filter(c => c.s === led);
    if (!follow.length) return pickDiscard(i, opts, qLive);

    let pool = follow;
    if (led === "s") {
      const topS = trickTop();
      /* she lands on the ace or the king the moment one shows up */
      if (qMine && topS > 12) return qMine;
      /* and she is never volunteered into a trick she would win herself */
      if (qMine && pool.length > 1) pool = pool.filter(c => !isQ(c));
      if (qLive) {
        const under = pool.filter(c => c.r < 12);   /* stay below her */
        if (under.length) pool = under;
      }
    }
    const top = trickTop();
    const losers = pool.filter(c => c.r < top);
    const winners = pool.filter(c => c.r > top);
    if (!losers.length) return low(pool);            /* cannot avoid winning: win as cheaply as possible */
    if (!winners.length) return high(losers);        /* cannot win at all: throw the biggest */
    if (moonThreat(i) >= 0) return low(winners);     /* break the moon up while it is still cheap */
    /* a clean trick with nobody left to speak is a free lead — take it early,
       but late in the hand the lead is a liability, so duck instead */
    if (!trickPts() && trick.length === 3 && hand.length > 5) return low(winners);
    return high(losers);                             /* otherwise duck as high as is safe */
  }

  function pickLead(i, opts, qLive) {
    const hand = seats[i];
    const spades = opts.filter(c => c.s === "s");
    const bigS = hand.filter(c => c.s === "s" && c.r >= 12).length;
    /* hunt the queen: lead spades from under her and let her be squeezed out */
    if (qLive) {
      const under = spades.filter(c => c.r < 12);
      if (under.length) return low(under);
    }
    /* short suits first: leading them is a step towards being void */
    const suits = ["c", "d", "s", "h"].filter(s => opts.filter(c => c.s === s).length);
    const rank = s => {
      const n = opts.filter(c => c.s === s).length;
      let v = n * 2;
      if (s === "h") v += 20;                 /* never lead hearts by choice */
      if (s === "s" && bigS) v += 14;         /* nor spades while holding her court */
      return v;
    };
    suits.sort((a, b) => rank(a) - rank(b));
    return low(opts.filter(c => c.s === suits[0]));
  }

  function pickDiscard(i, opts, qLive) {
    const q = opts.filter(isQ)[0];
    if (q) return q;                                     /* to whoever is taking this one */
    const court = opts.filter(c => c.s === "s" && c.r > 12);
    if (qLive && court.length) return high(court);       /* shed her future victims */
    const hs = opts.filter(c => c.s === "h");
    if (hs.length) return high(hs);                      /* bleed the biggest heart */
    /* otherwise the biggest card of the longest suit — the one we can spare */
    const suits = ["c", "d", "s", "h"].filter(s => opts.filter(c => c.s === s).length);
    suits.sort((a, b) => opts.filter(c => c.s === b).length - opts.filter(c => c.s === a).length);
    return high(opts.filter(c => c.s === suits[0]));
  }

  /* ---- the passing phase ---- */
  function startPass() {
    const dir = PASS[handNo % 4];
    if (!dir) return startPlay();          /* the fourth hand is a hold */
    phase = "pass";
    sel = []; got = [];
    msg = "Select three cards to pass " + PASSTXT[handNo % 4] + ".";
    render();
  }
  function doPass() {
    const dir = PASS[handNo % 4];
    const out = [sel.slice(), botPass(1), botPass(2), botPass(3)];
    /* everyone gives before anyone receives, or the cards would pass twice */
    for (let i = 0; i < 4; i++) for (const c of out[i]) seats[i].splice(seats[i].indexOf(c), 1);
    for (let i = 0; i < 4; i++) seats[(i + dir) % 4].push(...out[i]);
    for (const h of seats) sortHand(h);
    got = out[(4 - dir) % 4].slice();      /* what came back to you, briefly outlined */
    sel = [];
    startPlay();
  }

  /* ---- the play ---- */
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
      msg = firstTrick && !trick.length ? "Your lead: the two of clubs." : "Your turn.";
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

  /* ---- the arithmetic ---- */
  function endHand() {
    const hp = [0, 1, 2, 3].map(handPts);
    const moon = hp.indexOf(26);
    /* all twenty-six: everybody else takes them instead */
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

  /* the between-hands score box. It lives on the felt because the shell's
     message box has no OK callback to hang the next deal off. */
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
  }

  /* ---- input ---- */
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

  /* ---- games ---- */
  function newGame() {
    cancelAll();
    paused = false;
    modal = false;
    let bots = ["Pauline", "Michele", "Ben"];
    try {
      const b = deps.botNames && deps.botNames();
      if (b && b.length === 3) bots = b.map(x => String(x).slice(0, 14));
    } catch (err) { /* the shell has no names for us; the classics will do */ }
    let me = "You";
    try { if (deps.playerName) me = String(deps.playerName()).slice(0, 14) || "You"; } catch (err) {}
    names = [me, bots[0], bots[1], bots[2]];
    total = [0, 0, 0, 0];
    handNo = 0;
    msg = "";
    deal();
    startPass();
  }
  /* a shut window plays no cards; the hand is exactly where it was on reopen */
  function pause() { cancelAll(); paused = true; }
  function resume() {
    if (!paused) return;
    paused = false;
    render();
    advance();
  }

  /* ---- menus ---- */
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
