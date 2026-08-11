/* The Klondike win. The vendored js-solitaire celebrates inside its own
   little canvas; this watches the foundations from outside the iframe and,
   at 52, runs the cascade the way sol.exe ran it — one card at a time off
   its pile, gravity, a floor that returns a little less each bounce, and no
   erasing between frames: the smear IS the effect. Same-origin iframe,
   canvas overlay on our window chrome, no fork edits. No imports on purpose:
   the build-time smoke runner executes this file in node. */

export function initSolBounce(deps) {
  const { sysSnd } = deps;

  let ifr = null, poll = null, fired = false;
  let canvas = null, ctx = null, raf = 0;
  let sheet = null, queue = [], cur = null, hidden = [];
  let scale = 1, W = 0, H = 0;

  /* call on every iframe load; re-arms the watcher for that document */
  function arm(iframe) {
    disarm();
    ifr = iframe;
    fired = false;
    try {
      /* the game's own win animation stays off — this one replaces it */
      const d = ifr.contentDocument;
      const st = d.createElement("style");
      st.textContent = "#js-solitaire canvas{display:none!important}";
      d.head.appendChild(st);
    } catch (e) {}
    poll = setInterval(check, 500);
  }
  function disarm() {
    if (poll) { clearInterval(poll); poll = null; }
    stop();
    ifr = null;
  }

  function check() {
    if (!ifr || !ifr.isConnected || !ifr.dataset.live) { disarm(); return; }
    let doc = null;
    try { doc = ifr.contentDocument; } catch (e) { return; }
    const fin = doc && doc.getElementById && doc.getElementById("js-finish");
    if (!fin) return;
    if (fin.querySelectorAll(".card").length !== 52) { fired = false; return; }
    if (fired) return;
    fired = true;
    start(doc, fin);
  }

  function start(doc, fin) {
    stop();
    /* the deck art rides in the game's own computed style */
    const any = fin.querySelector(".card");
    const bg = doc.defaultView.getComputedStyle(any).backgroundImage;
    const m = /url\("?(data:image\/png[^")]+)"?\)/.exec(bg);
    if (!m) return;
    /* the game may already be mid-celebration; a click on its document is
       its own cancel */
    try { doc.dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true, cancelable: true })); } catch (e) {}

    const win = ifr.closest(".window");
    const wr = win.getBoundingClientRect(), fr = ifr.getBoundingClientRect();
    scale = fr.width / (ifr.offsetWidth || fr.width);   /* the phone-fit transform */
    W = Math.max(1, Math.round(fr.width));
    H = Math.max(1, Math.round(fr.height));
    canvas = document.createElement("canvas");
    canvas.className = "solb-canvas";
    canvas.width = W;
    canvas.height = H;
    canvas.style.left = Math.round(fr.left - wr.left) + "px";
    canvas.style.top = Math.round(fr.top - wr.top) + "px";
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    win.appendChild(canvas);
    ctx = canvas.getContext("2d");
    addEventListener("pointerdown", stopOnClick, true);

    /* pop order: the top card of each pile in turn, kings first */
    const piles = [];
    for (const p of fin.children) {
      const a = [...p.querySelectorAll(".card")];
      if (a.length) piles.push(a);
    }
    queue = [];
    const depth = Math.max(0, ...piles.map(a => a.length));
    for (let i = 0; i < depth; i++) {
      for (const a of piles) {
        const el = a[a.length - 1 - i];
        if (!el) continue;
        const r = el.getBoundingClientRect();   /* iframe layout space */
        const bp = doc.defaultView.getComputedStyle(el).backgroundPosition.split(" ");
        queue.push({
          el,
          x: r.left * scale, y: r.top * scale,
          sx: -parseFloat(bp[0]) || 0, sy: -parseFloat(bp[1]) || 0,
          vx: 0, vy: 0,
        });
      }
    }
    sheet = new Image();
    sheet.onload = () => {
      if (!canvas) return;   /* stopped before the art arrived */
      if (sysSnd) sysSnd("tada", .55);
      next();
      raf = requestAnimationFrame(step);
    };
    sheet.src = m[1];
  }

  function next() {
    cur = queue.shift() || null;
    if (!cur) return;
    cur.el.style.visibility = "hidden";   /* the pile shrinks as cards launch */
    hidden.push(cur.el);
    cur.vx = (2 + Math.random() * 4) * (Math.random() < 0.5 ? -1 : 1) * scale;
    cur.vy = -Math.random() * 6 * scale;
  }
  function step() {
    raf = 0;
    if (!ctx || !cur) return;
    /* two integration ticks per frame keeps the classic pace at 60Hz */
    for (let t = 0; t < 2 && cur; t++) {
      cur.vy += 0.6 * scale;
      cur.x += cur.vx;
      cur.y += cur.vy;
      const floor = H - CH();
      if (cur.y > floor) { cur.y = floor; cur.vy = -Math.abs(cur.vy) * 0.85; }
      draw(cur);
      if (cur.x < -CWs() || cur.x > W) next();
    }
    if (cur) raf = requestAnimationFrame(step);
    /* out of cards: the smears stay on screen until a click clears them */
  }
  const CWs = () => 71 * scale, CH = () => 96 * scale;
  function draw(c) {
    const w = CWs(), h = CH();
    ctx.fillStyle = "#fff";
    ctx.fillRect(c.x, c.y, w, h);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(c.x + .5, c.y + .5, w - 1, h - 1);
    ctx.drawImage(sheet, c.sx, c.sy, 71, 96, c.x, c.y, w, h);
  }

  function stopOnClick() { stop(); }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    removeEventListener("pointerdown", stopOnClick, true);
    if (canvas) canvas.remove();
    canvas = null; ctx = null; sheet = null;
    for (const el of hidden) { try { el.style.visibility = ""; } catch (e) {} }
    hidden = []; queue = []; cur = null;
  }

  return { arm, disarm, stop };
}
