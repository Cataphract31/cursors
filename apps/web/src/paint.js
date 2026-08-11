/* Paint — the real MS Paint: the 16-tool box, the 28-colour palette, and a
   rasteriser that draws ALIASED shapes the way 2001 did (canvas paths would
   antialias them and the whole thing would stop looking like Paint).
   Tool sprites: jspaint (Isaiah Odhner, MIT).
   No asset imports here on purpose: the build's smoke runner executes this
   file in node, so it must stay pure JS. main.js injects sprites + hooks. */

/* toolbox order IS the sprite-sheet order, which IS the real Paint layout
   (2 columns, read left-to-right) */
export const TOOLS = [
  { id: "freeselect", name: "Free-Form Select", hint: "Selects a free-form part of the picture to move, copy or edit." },
  { id: "select",     name: "Select",           hint: "Selects a rectangular part of the picture to move, copy or edit." },
  { id: "eraser",     name: "Eraser",           hint: "Erases a portion of the picture, using the selected eraser shape." },
  { id: "fill",       name: "Fill With Color",  hint: "Fills an area with the selected drawing colour." },
  { id: "pick",       name: "Pick Color",       hint: "Picks up a colour from the picture for drawing." },
  { id: "zoom",       name: "Magnifier",        hint: "Changes the magnification." },
  { id: "pencil",     name: "Pencil",           hint: "Draws a free-form line one pixel wide." },
  { id: "brush",      name: "Brush",            hint: "Draws using a brush with the selected shape and size." },
  { id: "airbrush",   name: "Airbrush",         hint: "Draws using an airbrush of the selected size." },
  { id: "text",       name: "Text",             hint: "Inserts text into the picture." },
  { id: "line",       name: "Line",             hint: "Draws a straight line with the selected line width." },
  { id: "curve",      name: "Curve",            hint: "Draws a curved line with the selected line width." },
  { id: "rect",       name: "Rectangle",        hint: "Draws a rectangle with the selected fill style." },
  { id: "polygon",    name: "Polygon",          hint: "Draws a polygon with the selected fill style." },
  { id: "ellipse",    name: "Ellipse",          hint: "Draws an ellipse with the selected fill style." },
  { id: "roundrect",  name: "Rounded Rectangle",hint: "Draws a rounded rectangle with the selected fill style." },
];

/* the default MS Paint palette, in its real order */
export const PALETTE = [
  "#000000","#808080","#800000","#808000","#008000","#008080","#000080",
  "#800080","#808040","#004040","#0080FF","#004080","#8000FF","#804000",
  "#FFFFFF","#C0C0C0","#FF0000","#FFFF00","#00FF00","#00FFFF","#0000FF",
  "#FF00FF","#FFFF80","#00FF80","#80FFFF","#8080FF","#FF0080","#FF8040",
];

const LINE_WIDTHS = [1, 2, 3, 4, 5];
const ERASER_SIZES = [4, 6, 8, 10];
const AIR_SIZES = [3, 6, 11];
/* 12 brush shapes: 3 round, 3 square, 3 back-diagonal, 3 forward-diagonal */
const BRUSHES = [
  { k: "round", s: 7 }, { k: "round", s: 5 }, { k: "round", s: 3 },
  { k: "square", s: 8 }, { k: "square", s: 5 }, { k: "square", s: 2 },
  { k: "bslash", s: 8 }, { k: "bslash", s: 6 }, { k: "bslash", s: 4 },
  { k: "fslash", s: 8 }, { k: "fslash", s: 6 }, { k: "fslash", s: 4 },
];

export function initPaint(deps) {
  const {
    PAINT, els, store, sysSnd, showError, showMenu, showConfirm,
    setWallpaperFrom, close, setTitle,
  } = deps;

  const cv = els.canvas, ov = els.overlay;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const octx = ov.getContext("2d");

  let tool = 6;                       /* pencil, like a fresh install */
  let fg = "#000000", bg = "#FFFFFF";
  let zoom = 1;
  let cw = 0, ch = 0;
  /* fill 0 = outline only, which is what a fresh Paint gives you */
  const opt = { line: 2, eraser: 0, brush: 2, air: 1, fill: 0, transparent: false, zoomLevel: 1 };
  let custom = (store.data.paintCustom || []).slice(0, 14);

  /* ---------- raster helpers: everything is aliased, on purpose ---------- */
  let paintCtx = ctx, paintColor = "#000000";
  function use(c, colour) { paintCtx = c; paintColor = colour; c.fillStyle = colour; }
  function px(x, y) { paintCtx.fillRect(x | 0, y | 0, 1, 1); }
  function stamp(x, y, w) {
    if (w <= 1) return px(x, y);
    const h = (w / 2) | 0;
    paintCtx.fillRect((x | 0) - h, (y | 0) - h, w, w);
  }
  function span(x0, x1, y) {
    const a = Math.min(x0, x1) | 0, b = Math.max(x0, x1) | 0;
    paintCtx.fillRect(a, y | 0, b - a + 1, 1);
  }
  /* Bresenham: the only line algorithm that leaves no gaps and no grey */
  function line(x0, y0, x1, y1, w, put) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      (put || stamp)(x0, y0, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function rectOutline(x0, y0, x1, y1, w) {
    line(x0, y0, x1, y0, w); line(x1, y0, x1, y1, w);
    line(x1, y1, x0, y1, w); line(x0, y1, x0, y0, w);
  }
  function rectFill(x0, y0, x1, y1) {
    const a = Math.min(x0, x1) | 0, b = Math.min(y0, y1) | 0;
    paintCtx.fillRect(a, b, Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1);
  }
  /* midpoint ellipse, walked by quadrant so the outline closes exactly */
  function ellipsePts(x0, y0, x1, y1, cb) {
    const rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (rx < .5 || ry < .5) { cb(cx, cy, cx, cy); return; }
    const rx2 = rx * rx, ry2 = ry * ry;
    let x = 0, y = ry, p = ry2 - rx2 * ry + .25 * rx2;
    let dx = 2 * ry2 * x, dy = 2 * rx2 * y;
    while (dx < dy) {
      cb(cx - x, cy + y, cx + x, cy + y); cb(cx - x, cy - y, cx + x, cy - y);
      x++; dx += 2 * ry2;
      if (p < 0) p += ry2 + dx;
      else { y--; dy -= 2 * rx2; p += ry2 + dx - dy; }
    }
    p = ry2 * (x + .5) * (x + .5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2;
    while (y >= 0) {
      cb(cx - x, cy + y, cx + x, cy + y); cb(cx - x, cy - y, cx + x, cy - y);
      y--; dy -= 2 * rx2;
      if (p > 0) p += rx2 - dy;
      else { x++; dx += 2 * ry2; p += rx2 - dy + dx; }
    }
  }
  function ellipseOutline(x0, y0, x1, y1, w) {
    ellipsePts(x0, y0, x1, y1, (lx, ly, rx2, ry2) => { stamp(lx, ly, w); stamp(rx2, ry2, w); });
  }
  function ellipseFill(x0, y0, x1, y1) {
    ellipsePts(x0, y0, x1, y1, (lx, ly, rx2) => span(lx, rx2, ly));
  }
  function roundRectPath(x0, y0, x1, y1, w, filled) {
    const a = Math.min(x0, x1), b = Math.min(y0, y1);
    const c = Math.max(x0, x1), d = Math.max(y0, y1);
    const r = Math.min(9, ((c - a) / 2) | 0, ((d - b) / 2) | 0);
    if (r <= 0) { filled ? rectFill(a, b, c, d) : rectOutline(a, b, c, d, w); return; }
    if (filled) {
      paintCtx.fillRect(a, b + r, c - a + 1, d - b - 2 * r + 1);
      ellipsePts(a, b, a + 2 * r, b + 2 * r, (lx, ly, rx2) => { if (ly <= b + r) span(lx, rx2 + (c - a - 2 * r), ly); });
      ellipsePts(a, d - 2 * r, a + 2 * r, d, (lx, ly, rx2) => { if (ly >= d - r) span(lx, rx2 + (c - a - 2 * r), ly); });
      return;
    }
    line(a + r, b, c - r, b, w); line(a + r, d, c - r, d, w);
    line(a, b + r, a, d - r, w); line(c, b + r, c, d - r, w);
    const corner = (cx0, cy0, sel) => ellipsePts(cx0, cy0, cx0 + 2 * r, cy0 + 2 * r, (lx, ly, rx2, ry2) => {
      if (sel(lx, ly)) stamp(lx, ly, w);
      if (sel(rx2, ry2)) stamp(rx2, ry2, w);
    });
    corner(a, b, (x, y) => x <= a + r && y <= b + r);
    corner(c - 2 * r, b, (x, y) => x >= c - r && y <= b + r);
    corner(a, d - 2 * r, (x, y) => x <= a + r && y >= d - r);
    corner(c - 2 * r, d - 2 * r, (x, y) => x >= c - r && y >= d - r);
  }
  function polyFill(pts) {
    let minY = 1e9, maxY = -1e9;
    for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    for (let y = minY | 0; y <= (maxY | 0); y++) {
      const xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x));
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) span(xs[i], xs[i + 1], y);
    }
  }
  function brushStamp(x, y, i) {
    const b = BRUSHES[i], s = b.s, h = (s / 2) | 0;
    x = (x | 0) - h; y = (y | 0) - h;
    if (b.k === "square") paintCtx.fillRect(x, y, s, s);
    else if (b.k === "round") ellipseFill(x, y, x + s - 1, y + s - 1);
    else if (b.k === "bslash") for (let i2 = 0; i2 < s; i2++) paintCtx.fillRect(x + i2, y + i2, 1, 1);
    else for (let i2 = 0; i2 < s; i2++) paintCtx.fillRect(x + s - 1 - i2, y + i2, 1, 1);
  }

  /* ---------- the image ---------- */
  function resize(w, h, keep) {
    w = Math.max(1, Math.min(2000, w | 0)); h = Math.max(1, Math.min(2000, h | 0));
    const old = keep && cw && ch ? ctx.getImageData(0, 0, cw, ch) : null;
    cw = w; ch = h;
    cv.width = w; cv.height = h; ov.width = w; ov.height = h;
    ctx.imageSmoothingEnabled = false; octx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
    if (old) ctx.putImageData(old, 0, 0);
    applyZoom();
    syncStatus();
  }
  function applyZoom() {
    const box = els.box;
    box.style.width = (cw * zoom) + "px";
    box.style.height = (ch * zoom) + "px";
    cv.style.width = ov.style.width = (cw * zoom) + "px";
    cv.style.height = ov.style.height = (ch * zoom) + "px";
  }
  function clearOverlay() { octx.clearRect(0, 0, cw, ch); }

  /* ---------- undo: three levels, exactly like the real thing ---------- */
  let undos = [], redos = [];
  function snapshot() {
    try { undos.push({ img: ctx.getImageData(0, 0, cw, ch), w: cw, h: ch }); } catch (e) { return; }
    if (undos.length > 3) undos.shift();
    redos = [];
  }
  /* a transform can change the canvas size; restoring pixels without
     restoring dimensions clips the picture */
  function unstack(from, to) {
    if (!from.length) return;
    cancelPending();
    try { to.push({ img: ctx.getImageData(0, 0, cw, ch), w: cw, h: ch }); } catch (e) {}
    const u = from.pop();
    if (u.w !== cw || u.h !== ch) resize(u.w, u.h, false);
    ctx.putImageData(u.img, 0, 0);
    dirty();
  }
  function undo() { unstack(undos, redos); }
  function redo() { unstack(redos, undos); }

  /* ---------- persistence: your art survives a reboot ---------- */
  let saveT = null;
  function dirty() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { store.data.paintImage = cv.toDataURL("image/png"); store.data.paintW = cw; store.data.paintH = ch; store.save(); } catch (e) {}
    }, 1200);
  }

  /* ---------- flood fill (exact match, no tolerance — Paint had none) ---------- */
  function floodFill(sx, sy, hex) {
    sx |= 0; sy |= 0;
    if (sx < 0 || sy < 0 || sx >= cw || sy >= ch) return;
    const img = ctx.getImageData(0, 0, cw, ch), d = img.data;
    const at = (x, y) => (y * cw + x) * 4;
    const i0 = at(sx, sy);
    const t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    const rgb = hexRGB(hex);
    if (t[0] === rgb[0] && t[1] === rgb[1] && t[2] === rgb[2] && t[3] === 255) return;
    const stack = [sx, sy];
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      let x0 = x;
      while (x0 >= 0 && match(d, at(x0, y), t)) x0--;
      x0++;
      let x1 = x;
      while (x1 < cw && match(d, at(x1, y), t)) x1++;
      x1--;
      let upSet = false, downSet = false;
      for (let i = x0; i <= x1; i++) {
        const p = at(i, y);
        d[p] = rgb[0]; d[p + 1] = rgb[1]; d[p + 2] = rgb[2]; d[p + 3] = 255;
        if (y > 0) {
          const up = match(d, at(i, y - 1), t);
          if (up && !upSet) { stack.push(i, y - 1); upSet = true; } else if (!up) upSet = false;
        }
        if (y < ch - 1) {
          const dn = match(d, at(i, y + 1), t);
          if (dn && !downSet) { stack.push(i, y + 1); downSet = true; } else if (!dn) downSet = false;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function match(d, i, t) { return d[i] === t[0] && d[i + 1] === t[1] && d[i + 2] === t[2] && d[i + 3] === t[3]; }
  function hexRGB(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* ---------- pointer plumbing ---------- */
  let drawing = false, btn = 0, last = null, start = null, airTimer = null;
  let poly = null, curve = null, sel = null, textBox = null;

  function pos(e) {
    const r = cv.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / zoom), y: Math.floor((e.clientY - r.top) / zoom) };
  }
  const inkFor = b => (b === 2 ? bg : fg);
  const antiFor = b => (b === 2 ? fg : bg);

  function begin(e) {
    if (e.button !== 0 && e.button !== 2) return;
    const p = pos(e);
    const t = TOOLS[tool].id;
    if (textBox && t !== "text") commitText();
    btn = e.button;
    const ink = inkFor(btn);

    if (t === "zoom") { setZoom(zoom === 1 ? [1, 2, 6, 8][opt.zoomLevel] : 1); return; }
    if (t === "pick") { pickColor(p, btn); return; }
    if (t === "fill") { snapshot(); floodFill(p.x, p.y, ink); dirty(); return; }
    if (t === "polygon") { polyClick(p, ink); return; }
    if (t === "curve") { curveClick(p, ink); return; }
    if (t === "text") { textStart(p); return; }

    drawing = true; last = p; start = p;
    try { els.box.setPointerCapture(e.pointerId); } catch (err) {}

    if (t === "pencil" || t === "brush" || t === "eraser" || t === "airbrush") {
      snapshot();
      strokeTo(p, p, ink);
      /* the airbrush keeps spraying while you hold it still — that is the tool */
      if (t === "airbrush") {
        clearInterval(airTimer);
        airTimer = setInterval(() => { use(ctx, inkFor(btn)); spray(last.x, last.y); }, 60);
      }
    } else if (t === "select" || t === "freeselect") {
      if (sel && inSel(p)) { sel.moving = true; sel.grab = p; snapshot(); return; }
      dropSel();
      sel = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, path: [p], free: t === "freeselect" };
    } else {
      snapshot();
    }
  }
  function move(e) {
    const p = pos(e);
    syncStatus(p);
    if (!drawing) return;
    const t = TOOLS[tool].id, ink = inkFor(btn);
    if (t === "curve" && curve && curve.dragging) {
      curve.b = p; drawCurveOverlay(); return;
    }
    if (t === "pencil" || t === "brush" || t === "eraser" || t === "airbrush") {
      strokeTo(last, p, ink); last = p;
    } else if (t === "select" || t === "freeselect") {
      if (sel && sel.moving) { moveSel(p); return; }
      if (!sel) return;   /* Escape/Delete killed it mid-drag */
      sel.x1 = p.x; sel.y1 = p.y;
      if (sel.free) sel.path.push(p);
      drawSelOverlay();
    } else {
      clearOverlay();
      use(octx, ink);
      shape(t, start, p, ink, antiFor(btn));
    }
  }
  function end(e) {
    clearInterval(airTimer); airTimer = null;
    if (!drawing) return;
    drawing = false;
    const p = pos(e), t = TOOLS[tool].id, ink = inkFor(btn);
    if (t === "curve" && curve && curve.dragging) {
      curve.b = p; curve.dragging = false; drawCurveOverlay(); return;
    }
    if (t === "select" || t === "freeselect") {
      if (sel && sel.moving) { sel.moving = false; return; }
      if (sel && Math.abs(sel.x1 - sel.x0) < 2 && Math.abs(sel.y1 - sel.y0) < 2) { sel = null; clearOverlay(); }
      else if (sel) liftSel();
      return;
    }
    if (t === "pencil" || t === "brush" || t === "eraser" || t === "airbrush") { dirty(); return; }
    clearOverlay();
    use(ctx, ink);
    shape(t, start, p, ink, antiFor(btn));
    dirty();
  }
  function strokeTo(a, b, ink) {
    const t = TOOLS[tool].id;
    if (t === "eraser") { use(ctx, antiFor(btn)); line(a.x, a.y, b.x, b.y, ERASER_SIZES[opt.eraser]); }
    else if (t === "pencil") { use(ctx, ink); line(a.x, a.y, b.x, b.y, 1); }
    else if (t === "brush") { use(ctx, ink); line(a.x, a.y, b.x, b.y, 0, (x, y) => brushStamp(x, y, opt.brush)); }
    else if (t === "airbrush") { use(ctx, ink); spray(b.x, b.y); }
  }
  function spray(x, y) {
    const r = AIR_SIZES[opt.air];
    for (let i = 0; i < r * 3; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r;
      px(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
  }
  function shape(t, a, b, ink, anti) {
    const w = LINE_WIDTHS[opt.line];
    const style = opt.fill;                        /* 0 outline · 1 outline+bg fill · 2 solid */
    const doFill = (fn) => { if (style === 1) { use(paintCtx, anti); fn(); } else if (style === 2) { use(paintCtx, ink); fn(); } };
    if (t === "line") { use(paintCtx, ink); line(a.x, a.y, b.x, b.y, w); return; }
    if (t === "rect") { doFill(() => rectFill(a.x, a.y, b.x, b.y)); if (style !== 2) { use(paintCtx, ink); rectOutline(a.x, a.y, b.x, b.y, w); } return; }
    if (t === "ellipse") { doFill(() => ellipseFill(a.x, a.y, b.x, b.y)); if (style !== 2) { use(paintCtx, ink); ellipseOutline(a.x, a.y, b.x, b.y, w); } return; }
    if (t === "roundrect") { doFill(() => roundRectPath(a.x, a.y, b.x, b.y, w, true)); if (style !== 2) { use(paintCtx, ink); roundRectPath(a.x, a.y, b.x, b.y, w, false); } return; }
  }

  /* ---------- polygon: click a vertex at a time, double-click to close ---------- */
  function polyClick(p, ink) {
    if (!poly) { snapshot(); poly = { pts: [p], ink }; return; }
    const first = poly.pts[0];
    const near = Math.abs(p.x - first.x) < 5 && Math.abs(p.y - first.y) < 5;
    poly.pts.push(p);
    if (near || poly.pts.length > 40) return closePoly();
    drawPolyOverlay();
  }
  function drawPolyOverlay() {
    clearOverlay();
    use(octx, poly.ink);
    const w = LINE_WIDTHS[opt.line];
    for (let i = 1; i < poly.pts.length; i++) line(poly.pts[i - 1].x, poly.pts[i - 1].y, poly.pts[i].x, poly.pts[i].y, w);
  }
  function closePoly() {
    if (!poly) return;
    const pts = poly.pts, w = LINE_WIDTHS[opt.line];
    clearOverlay();
    if (opt.fill === 1) { use(ctx, bg); polyFill(pts); }
    if (opt.fill === 2) { use(ctx, poly.ink); polyFill(pts); }
    if (opt.fill !== 2) {
      use(ctx, poly.ink);
      for (let i = 1; i < pts.length; i++) line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, w);
      line(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y, w);
    }
    poly = null; dirty();
  }

  /* ---------- curve: drag the line, then bend it twice ---------- */
  function curveClick(p, ink) {
    if (!curve) { snapshot(); curve = { a: p, b: p, c1: null, c2: null, ink, dragging: true }; drawing = true; last = p; start = p; return; }
    if (!curve.c1) { curve.c1 = p; }
    else { curve.c2 = p; commitCurve(); return; }
    drawCurveOverlay();
  }
  function curvePts() {
    const { a, b } = curve;
    const c1 = curve.c1 || a, c2 = curve.c2 || c1;
    const out = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, m = 1 - t;
      out.push({
        x: m * m * m * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * b.x,
        y: m * m * m * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * b.y,
      });
    }
    return out;
  }
  function drawCurveOverlay() {
    clearOverlay();
    use(octx, curve.ink);
    const w = LINE_WIDTHS[opt.line], pts = curvePts();
    for (let i = 1; i < pts.length; i++) line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, w);
  }
  function commitCurve() {
    if (!curve) return;
    clearOverlay();
    use(ctx, curve.ink);
    const w = LINE_WIDTHS[opt.line], pts = curvePts();
    for (let i = 1; i < pts.length; i++) line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, w);
    curve = null; dirty();
  }

  /* ---------- selection ---------- */
  function selRect() {
    return {
      x: Math.min(sel.x0, sel.x1), y: Math.min(sel.y0, sel.y1),
      w: Math.abs(sel.x1 - sel.x0) + 1, h: Math.abs(sel.y1 - sel.y0) + 1,
    };
  }
  function inSel(p) {
    if (!sel || !sel.img) return false;
    const r = selRect();
    return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  }
  function drawSelOverlay() {
    clearOverlay();
    const r = selRect();
    octx.save();
    octx.strokeStyle = "#000"; octx.lineWidth = 1;
    octx.setLineDash([3, 3]);
    octx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
    octx.restore();
    syncStatus();
  }
  /* lift the pixels out so they can be dragged; the hole fills with background */
  function liftSel() {
    const r = selRect();
    if (r.w < 2 || r.h < 2) { sel = null; clearOverlay(); return; }
    try { sel.img = ctx.getImageData(r.x, r.y, r.w, r.h); } catch (e) { sel = null; return; }
    if (sel.free && sel.path.length > 2) maskFree(r);
    if (opt.transparent) maskBg();
    drawSelOverlay();
  }
  /* free-form: knock every pixel outside the lasso out of the lifted patch */
  function maskFree(r) {
    const tmp = document.createElement("canvas");
    tmp.width = r.w; tmp.height = r.h;
    const tc = tmp.getContext("2d");
    tc.beginPath();
    sel.path.forEach((p, i) => i ? tc.lineTo(p.x - r.x, p.y - r.y) : tc.moveTo(p.x - r.x, p.y - r.y));
    tc.closePath(); tc.fillStyle = "#fff"; tc.fill();
    const mask = tc.getImageData(0, 0, r.w, r.h).data, d = sel.img.data;
    for (let i = 0; i < d.length; i += 4) if (mask[i + 3] < 128) d[i + 3] = 0;
  }
  /* transparent selection: the background colour stops being part of the picture,
     which is the whole point of the option box's second button */
  function maskBg() {
    const [r, g, b] = hexRGB(bg), d = sel.img.data;
    for (let i = 0; i < d.length; i += 4)
      if (d[i] === r && d[i + 1] === g && d[i + 2] === b) d[i + 3] = 0;
  }
  function moveSel(p) {
    if (!sel.img) return;
    if (!sel.cut) {
      sel.cut = true;
      const r = selRect();
      ctx.fillStyle = bg;
      if (sel.free && sel.path.length > 2) {
        ctx.save(); ctx.beginPath();
        sel.path.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else ctx.fillRect(r.x, r.y, r.w, r.h);
      sel.floatImg = sel.img;
    }
    const dx = p.x - sel.grab.x, dy = p.y - sel.grab.y;
    sel.grab = p;
    sel.x0 += dx; sel.x1 += dx; sel.y0 += dy; sel.y1 += dy;
    if (sel.path) sel.path = sel.path.map(q => ({ x: q.x + dx, y: q.y + dy }));
    renderFloating();
  }
  function renderFloating() {
    clearOverlay();
    const r = selRect();
    if (sel.floatImg) {
      const tmp = document.createElement("canvas");
      tmp.width = r.w; tmp.height = r.h;
      tmp.getContext("2d").putImageData(sel.floatImg, 0, 0);
      octx.drawImage(tmp, r.x, r.y);
    }
    octx.save();
    octx.strokeStyle = "#000"; octx.setLineDash([3, 3]);
    octx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
    octx.restore();
  }
  /* stamp a floating selection back down and forget it */
  function dropSel() {
    if (sel && sel.floatImg) {
      const r = selRect();
      const tmp = document.createElement("canvas");
      tmp.width = r.w; tmp.height = r.h;
      tmp.getContext("2d").putImageData(sel.floatImg, 0, 0);
      ctx.drawImage(tmp, r.x, r.y);
      dirty();
    }
    sel = null; clearOverlay();
  }
  function deleteSel() {
    if (!sel) return;
    snapshot();
    if (!sel.cut) {
      const r = selRect();
      ctx.fillStyle = bg; ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    sel = null; clearOverlay(); dirty();
  }
  function selectAll() {
    dropSel();
    sel = { x0: 0, y0: 0, x1: cw - 1, y1: ch - 1, path: null, free: false };
    liftSel();
  }
  let clip = null;
  function copySel() { if (sel && sel.img) clip = sel.img; }
  function pasteClip() {
    if (!clip) return;
    dropSel(); snapshot();
    sel = { x0: 0, y0: 0, x1: clip.width - 1, y1: clip.height - 1, path: null, free: false, img: clip, floatImg: clip, cut: true };
    setTool(1);
    renderFloating();
  }

  /* ---------- Paste From / Copy To: the file half of the clipboard ---------- */
  function pasteFrom() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.style.cssText = "position:fixed;left:-200px;top:0;opacity:0";
    document.body.appendChild(inp);
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      if (f) {
        const rd = new FileReader();
        rd.onload = () => {
          const im = new Image();
          im.onload = () => {
            const w = Math.min(im.naturalWidth, cw), h = Math.min(im.naturalHeight, ch);
            const tmp = document.createElement("canvas");
            tmp.width = w; tmp.height = h;
            const tc2 = tmp.getContext("2d");
            tc2.drawImage(im, 0, 0);
            clip = tc2.getImageData(0, 0, w, h);
            pasteClip();
          };
          im.src = rd.result;
        };
        rd.readAsDataURL(f);
      }
      inp.remove();
    });
    inp.click();
  }
  function copyTo() {
    if (!sel || !sel.img) return;
    const tmp = document.createElement("canvas");
    tmp.width = sel.img.width; tmp.height = sel.img.height;
    tmp.getContext("2d").putImageData(sel.floatImg || sel.img, 0, 0);
    try {
      const a = document.createElement("a");
      a.href = tmp.toDataURL("image/png"); a.download = "clip.png";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {}
  }

  /* ---------- text, with the real Fonts toolbar ---------- */
  const FONTLIST = ["Arial", "Arial Black", "Comic Sans MS", "Courier New", "Georgia", "Impact",
    "Lucida Console", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"];
  let fontBar = null;
  function showFontBar() {
    if (fontBar) { fontBar.style.display = "flex"; return; }
    fontBar = document.createElement("div");
    fontBar.className = "pt-fontbar";
    const t = document.createElement("span"); t.textContent = "Fonts"; t.className = "pt-fonttitle";
    const fsel = document.createElement("select");
    for (const f of FONTLIST) { const o = document.createElement("option"); o.value = f; o.textContent = f; fsel.appendChild(o); }
    fsel.value = store.data.paintFont || "Tahoma";
    const ssel = document.createElement("select");
    for (const nn of [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]) { const o = document.createElement("option"); o.value = nn; o.textContent = nn; ssel.appendChild(o); }
    ssel.value = String(store.data.paintFontSize || 16);
    const mkT = (label, key, cls) => {
      const b = document.createElement("button");
      b.className = "pt-fontbtn " + cls + (store.data[key] ? " on" : "");
      b.textContent = label;
      b.addEventListener("click", () => {
        store.data[key] = store.data[key] ? 0 : 1; store.save();
        b.classList.toggle("on", !!store.data[key]);
        if (textBox) {
          textBox.el.style.font = textFont();
          textBox.el.style.textDecoration = store.data.paintFontU ? "underline" : "";
        }
      });
      return b;
    };
    const upd = () => {
      store.data.paintFont = fsel.value;
      store.data.paintFontSize = +ssel.value;
      store.save();
      if (textBox) textBox.el.style.font = textFont();
    };
    fsel.addEventListener("change", upd);
    ssel.addEventListener("change", upd);
    fontBar.appendChild(t);
    fontBar.appendChild(fsel); fontBar.appendChild(ssel);
    fontBar.appendChild(mkT("B", "paintFontB", "b"));
    fontBar.appendChild(mkT("I", "paintFontI", "i"));
    fontBar.appendChild(mkT("U", "paintFontU", "u"));
    els.wrap.appendChild(fontBar);
  }
  function hideFontBar() { if (fontBar) fontBar.style.display = "none"; }
  function textStart(p) {
    commitText();
    snapshot();
    showFontBar();
    const ta = document.createElement("textarea");
    ta.className = "pt-text";
    ta.spellcheck = false;
    ta.style.left = (p.x * zoom) + "px";
    ta.style.top = (p.y * zoom) + "px";
    ta.style.color = fg;
    ta.style.font = textFont();
    ta.style.textDecoration = store.data.paintFontU ? "underline" : "";
    els.box.appendChild(ta);
    textBox = { el: ta, x: p.x, y: p.y };
    setTimeout(() => ta.focus(), 0);
    ta.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.key === "Escape") { ta.remove(); textBox = null; }
    });
  }
  function textFont() {
    const b = store.data.paintFontB ? "bold " : "", i = store.data.paintFontI ? "italic " : "";
    return `${i}${b}${store.data.paintFontSize || 16}px "${store.data.paintFont || "Tahoma"}"`;
  }
  function commitText() {
    if (!textBox) return;
    const { el, x, y } = textBox;
    const txt = el.value;
    textBox = null; el.remove();
    if (!txt.trim()) return;
    ctx.save();
    ctx.font = textFont();
    ctx.fillStyle = fg;
    ctx.textBaseline = "top";
    const size = store.data.paintFontSize || 16;
    txt.split(String.fromCharCode(10)).forEach((ln, i) => {
      const ly = y + i * size * 1.2;
      ctx.fillText(ln, x, ly);
      if (store.data.paintFontU && ln.trim()) {
        const w = ctx.measureText(ln).width;
        ctx.fillRect(x, ly + size * 1.02, w, Math.max(1, size / 14));
      }
    });
    ctx.restore();
    dirty();
  }
  function cancelPending() { commitText(); closePoly(); commitCurve(); dropSel(); }

  /* ---------- toolbox / options / colours ---------- */
  function setTool(i) {
    if (TOOLS[i].id !== "text") { commitText(); hideFontBar(); }
    if (i !== tool) { closePoly(); commitCurve(); }
    if (TOOLS[i].id !== "select" && TOOLS[i].id !== "freeselect") dropSel();
    tool = i;
    renderTools(); renderOpts(); syncStatus();
  }
  function renderTools() {
    const host = els.tools;
    host.innerHTML = "";
    TOOLS.forEach((t, i) => {
      const b = document.createElement("button");
      b.className = "pt-tool" + (i === tool ? " on" : "");
      b.title = t.name;
      b.dataset.tip = t.name;
      /* the glyph is its own 16px box: a 25px-wide button showing a slice of a
         256px strip would leak the neighbouring tool into view */
      const g = document.createElement("i");
      g.style.backgroundPosition = `${-i * 16}px 0`;
      b.appendChild(g);
      b.addEventListener("click", () => { setTool(i); });
      host.appendChild(b);
    });
  }
  /* the options box under the toolbox: every glyph here is a real primitive,
     drawn at the size it represents, which is exactly what Paint showed */
  function renderOpts() {
    const host = els.opts;
    host.innerHTML = "";
    const id = TOOLS[tool].id;
    const grid = (cls) => { const d = document.createElement("div"); d.className = "pt-optgrid " + (cls || ""); host.appendChild(d); return d; };
    const cell = (parent, on, cb, draw, w, h) => {
      const b = document.createElement("button");
      b.className = "pt-opt" + (on ? " on" : "");
      const c = document.createElement("canvas");
      c.width = w || 22; c.height = h || 12;
      draw(c.getContext("2d"), c.width, c.height);
      b.appendChild(c);
      b.addEventListener("click", () => { cb(); renderOpts(); });
      parent.appendChild(b);
      return b;
    };
    if (id === "select" || id === "freeselect") {
      const g = grid("one");
      [0, 1].forEach(i => {
        const b = document.createElement("button");
        b.className = "pt-opt pt-trans" + (opt.transparent === !!i ? " on" : "");
        b.style.backgroundPosition = `0 ${-i * 23}px`;
        b.addEventListener("click", () => { opt.transparent = !!i; renderOpts(); });
        g.appendChild(b);
      });
    } else if (id === "eraser") {
      const g = grid("one");
      ERASER_SIZES.forEach((s, i) => cell(g, opt.eraser === i, () => opt.eraser = i, (c, w, h) => {
        c.fillStyle = "#fff"; c.fillRect(0, 0, w, h);
        c.strokeStyle = "#000"; c.strokeRect((w - s) / 2 + .5, (h - s) / 2 + .5, s - 1, s - 1);
      }, 30, 16));
    } else if (id === "brush") {
      const g = grid("three");
      BRUSHES.forEach((b, i) => cell(g, opt.brush === i, () => opt.brush = i, (c, w, h) => {
        c.fillStyle = "#000";
        const cx = w / 2, cy = h / 2, s = b.s;
        if (b.k === "square") c.fillRect(cx - s / 2, cy - s / 2, s, s);
        else if (b.k === "round") { c.beginPath(); c.arc(cx, cy, s / 2, 0, 6.284); c.fill(); }
        else { c.lineWidth = 1; c.strokeStyle = "#000"; c.beginPath();
          if (b.k === "bslash") { c.moveTo(cx - s / 2, cy - s / 2); c.lineTo(cx + s / 2, cy + s / 2); }
          else { c.moveTo(cx + s / 2, cy - s / 2); c.lineTo(cx - s / 2, cy + s / 2); }
          c.stroke(); }
      }, 15, 15));
    } else if (id === "airbrush") {
      const g = grid("three");
      AIR_SIZES.forEach((s, i) => {
        const b = document.createElement("button");
        b.className = "pt-opt pt-air" + (opt.air === i ? " on" : "");
        b.style.backgroundPosition = `${-i * 24}px center`;
        b.addEventListener("click", () => { opt.air = i; renderOpts(); });
        g.appendChild(b);
      });
    } else if (id === "line" || id === "curve") {
      const g = grid("one");
      LINE_WIDTHS.forEach((s, i) => cell(g, opt.line === i, () => opt.line = i, (c, w, h) => {
        c.fillStyle = "#fff"; c.fillRect(0, 0, w, h);
        c.fillStyle = "#000"; c.fillRect(3, (h - s) / 2, w - 6, s);
      }, 30, 12));
    } else if (id === "rect" || id === "ellipse" || id === "roundrect" || id === "polygon") {
      const g = grid("one");
      [0, 1, 2].forEach(i => cell(g, opt.fill === i, () => opt.fill = i, (c, w, h) => {
        c.fillStyle = "#fff"; c.fillRect(0, 0, w, h);
        const x = 5, y = 3, ww = w - 10, hh = h - 6;
        if (i === 2) { c.fillStyle = "#000"; c.fillRect(x, y, ww, hh); return; }
        if (i === 1) { c.fillStyle = "#B0B0B0"; c.fillRect(x, y, ww, hh); }
        c.strokeStyle = "#000"; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, ww - 1, hh - 1);
      }, 30, 18));
    } else if (id === "zoom") {
      const g = grid("one");
      ["1x", "2x", "6x", "8x"].forEach((lbl, i) => {
        const b = document.createElement("button");
        b.className = "pt-opt pt-zoomopt" + (opt.zoomLevel === i ? " on" : "");
        b.textContent = lbl;
        b.addEventListener("click", () => { opt.zoomLevel = i; setZoom([1, 2, 6, 8][i]); renderOpts(); });
        g.appendChild(b);
      });
    }
  }
  function renderColors() {
    const host = els.colors;
    host.innerHTML = "";
    const cur = document.createElement("div");
    cur.className = "pt-cur";
    cur.innerHTML = `<i class="pt-bg"></i><i class="pt-fg"></i>`;
    cur.querySelector(".pt-fg").style.background = fg;
    cur.querySelector(".pt-bg").style.background = bg;
    cur.title = "Foreground / background — right-click a swatch for background";
    cur.addEventListener("click", editColors);
    host.appendChild(cur);
    const grid = document.createElement("div");
    grid.className = "pt-swatches";
    const add = (hex) => {
      const s = document.createElement("button");
      s.className = "pt-sw";
      s.dataset.hex = hex;
      s.style.background = hex;
      s.addEventListener("click", () => { fg = hex; renderColors(); });
      s.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); bg = hex; renderColors(); });
      s.addEventListener("dblclick", editColors);
      grid.appendChild(s);
    };
    /* the grid flows down-then-across, so the palette has to be interleaved:
       PALETTE is written row-major (14 dark, then 14 light) but each column is
       a dark/light pair, exactly as Paint shows it */
    const half = PALETTE.length / 2;
    for (let c = 0; c < half; c++) { add(PALETTE[c]); add(PALETTE[c + half]); }
    for (let c = 0; c < custom.length; c += 2) { add(custom[c]); add(custom[c + 1] || "#FFFFFF"); }
    host.appendChild(grid);
  }
  function editColors() {
    const inp = document.createElement("input");
    inp.type = "color"; inp.value = fg;
    inp.style.cssText = "position:fixed;left:-100px;top:0;opacity:0";
    document.body.appendChild(inp);
    inp.addEventListener("change", () => {
      fg = inp.value.toUpperCase();
      if (!PALETTE.includes(fg) && !custom.includes(fg)) {
        custom.unshift(fg); custom = custom.slice(0, 14);
        store.data.paintCustom = custom; store.save();
      }
      renderColors();
      inp.remove();
    });
    inp.click();
  }
  function pickColor(p, button) {
    try {
      const d = ctx.getImageData(p.x, p.y, 1, 1).data;
      const hex = "#" + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
      if (button === 2) bg = hex; else fg = hex;
      renderColors();
      setTool(6);
    } catch (e) {}
  }
  function setZoom(z) {
    zoom = z;
    applyZoom();
    if (textBox) { textBox.el.style.left = (textBox.x * zoom) + "px"; textBox.el.style.top = (textBox.y * zoom) + "px"; }
    syncStatus();
  }

  function syncStatus(p) {
    if (els.st1) els.st1.textContent = TOOLS[tool].hint;
    if (els.st2) els.st2.textContent = p ? `${p.x},${p.y}` : "";
    if (els.st3) {
      const r = sel ? selRect() : null;
      els.st3.textContent = r ? `${r.w} x ${r.h}` : `${cw} x ${ch}`;
    }
  }

  /* ---------- files & wallpaper: the meme machine ---------- */
  function newImage(silent) {
    cancelPending();
    undos = []; redos = [];
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, cw, ch);
    clearOverlay();
    if (!silent) dirty();
  }
  function loadDataURL(url, resizeTo) {
    const img = new Image();
    img.onload = () => {
      cancelPending();
      if (resizeTo) resize(img.naturalWidth, img.naturalHeight, false);
      else { ctx.fillStyle = "#FFF"; ctx.fillRect(0, 0, cw, ch); }
      ctx.drawImage(img, 0, 0);
      undos = []; redos = [];
      dirty();
    };
    img.src = url;
  }
  function openFile() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.style.cssText = "position:fixed;left:-200px;top:0;opacity:0";
    document.body.appendChild(inp);
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      if (f) {
        const rd = new FileReader();
        rd.onload = () => { loadDataURL(rd.result, true); if (setTitle) setTitle(f.name); };
        rd.readAsDataURL(f);
      }
      inp.remove();
    });
    inp.click();
  }
  /* Save As writes into My Pictures on the fake disk — where Explorer can find
     it — and then offers you the real file, because a meme you cannot post is
     not a meme */
  function saveAs() {
    cancelPending();
    let url;
    try { url = cv.toDataURL("image/png"); }
    catch (e) { return showError("Save As", "There is not enough memory or disk space to save the file."); }
    const name = deps.savePicture(url);
    if (setTitle) setTitle(name);
    showConfirm("Save As", `Saved as ${name} in My Pictures.\n\nAlso save a copy to your real computer?`, () => {
      try {
        const a = document.createElement("a");
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
      } catch (e) {}
    });
  }
  function setAsWallpaper(mode) {
    cancelPending();
    try {
      setWallpaperFrom(cv.toDataURL("image/png"), mode);
      sysSnd("ding", .5);
    } catch (e) {
      showError("Paint", "The wallpaper could not be set.");
    }
  }

  /* ---------- image menu operations ---------- */
  function transform(kind) {
    cancelPending(); snapshot();
    const tmp = document.createElement("canvas");
    const swap = kind === "rot90" || kind === "rot270";
    tmp.width = swap ? ch : cw; tmp.height = swap ? cw : ch;
    const tc = tmp.getContext("2d");
    tc.imageSmoothingEnabled = false;
    tc.save();
    if (kind === "fliph") { tc.translate(cw, 0); tc.scale(-1, 1); }
    if (kind === "flipv") { tc.translate(0, ch); tc.scale(1, -1); }
    if (kind === "rot90") { tc.translate(ch, 0); tc.rotate(Math.PI / 2); }
    if (kind === "rot180") { tc.translate(cw, ch); tc.rotate(Math.PI); }
    if (kind === "rot270") { tc.translate(0, cw); tc.rotate(-Math.PI / 2); }
    tc.drawImage(cv, 0, 0);
    tc.restore();
    if (swap) { cw = tmp.width; ch = tmp.height; cv.width = cw; cv.height = ch; ov.width = cw; ov.height = ch; applyZoom(); }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(tmp, 0, 0);
    syncStatus(); dirty();
  }
  /* the real four-field dialog: stretch in percent, skew in degrees */
  function stretchSkew(hs, vs, hd, vd) {
    cancelPending(); snapshot();
    hs = Math.max(1, Math.min(500, hs || 100)) / 100;
    vs = Math.max(1, Math.min(500, vs || 100)) / 100;
    hd = Math.max(-75, Math.min(75, hd || 0)) * Math.PI / 180;
    vd = Math.max(-75, Math.min(75, vd || 0)) * Math.PI / 180;
    const sw = Math.max(1, Math.round(cw * hs)), sh = Math.max(1, Math.round(ch * vs));
    const shx = Math.abs(Math.tan(hd)) * sh, shy = Math.abs(Math.tan(vd)) * sw;
    const nw = Math.round(sw + shx), nh = Math.round(sh + shy);
    const tmp = document.createElement("canvas");
    tmp.width = nw; tmp.height = nh;
    const tc = tmp.getContext("2d");
    tc.imageSmoothingEnabled = false;
    tc.fillStyle = "#FFFFFF"; tc.fillRect(0, 0, nw, nh);
    tc.setTransform(1, Math.tan(vd), Math.tan(hd), 1,
      Math.tan(hd) < 0 ? shx : 0, Math.tan(vd) < 0 ? shy : 0);
    tc.drawImage(cv, 0, 0, cw, ch, 0, 0, sw, sh);
    cw = nw; ch = nh;
    cv.width = cw; cv.height = ch; ov.width = cw; ov.height = ch;
    applyZoom();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(tmp, 0, 0);
    syncStatus(); dirty();
  }
  function invert() {
    cancelPending(); snapshot();
    const img = ctx.getImageData(0, 0, cw, ch), d = img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
    ctx.putImageData(img, 0, 0);
    dirty();
  }

  /* ---------- menus ---------- */
  function fileMenu(x, y) {
    showMenu([
      { label: "New", action: () => { snapshot(); newImage(); } },
      { label: "Open...", action: openFile },
      { label: "Save As...", action: saveAs },
      deps.publish && { label: "Publish to Gallery", action: () => {
        cancelPending();
        let url; try { url = cv.toDataURL("image/png"); } catch (e) { return; }
        deps.publish(url);
      } },
      { sep: 1 },
      { label: "Set As Background (Tiled)", action: () => setAsWallpaper("tile") },
      { label: "Set As Background (Centered)", action: () => setAsWallpaper("center") },
      { label: "Set As Background (Stretched)", action: () => setAsWallpaper("stretch") },
      { sep: 1 },
      { label: "Exit", action: () => close() },
    ], x, y);
  }
  function editMenu(x, y) {
    showMenu([
      { label: "Undo", disabled: !undos.length, action: undo },
      { label: "Repeat", disabled: !redos.length, action: redo },
      { sep: 1 },
      { label: "Cut", disabled: !sel || !sel.img, action: () => { copySel(); deleteSel(); } },
      { label: "Copy", disabled: !sel || !sel.img, action: copySel },
      { label: "Paste", disabled: !clip, action: pasteClip },
      { label: "Paste From...", action: pasteFrom },
      { sep: 1 },
      { label: "Clear Selection", disabled: !sel, action: deleteSel },
      { label: "Select All", action: selectAll },
      { sep: 1 },
      { label: "Copy To...", disabled: !sel || !sel.img, action: copyTo },
    ], x, y);
  }
  function viewMenu(x, y) {
    showMenu([
      { label: "Tool Box", check: !els.left.classList.contains("off"), action: () => els.left.classList.toggle("off") },
      { label: "Color Box", check: !els.colors.classList.contains("off"), action: () => els.colors.classList.toggle("off") },
      { label: "Status Bar", check: !els.status.classList.contains("off"), action: () => els.status.classList.toggle("off") },
      { sep: 1 },
      { label: "Normal Size", check: zoom === 1, action: () => setZoom(1) },
      { label: "Large Size", check: zoom === 2, action: () => setZoom(2) },
      { label: "Custom (6x)", check: zoom === 6, action: () => setZoom(6) },
      { label: "Custom (8x)", check: zoom === 8, action: () => setZoom(8) },
    ], x, y);
  }
  function imageMenu(x, y) {
    showMenu([
      { label: "Flip/Rotate", sub: [
        { label: "Flip horizontal", action: () => transform("fliph") },
        { label: "Flip vertical", action: () => transform("flipv") },
        { sep: 1 },
        { label: "Rotate by 90°", action: () => transform("rot90") },
        { label: "Rotate by 180°", action: () => transform("rot180") },
        { label: "Rotate by 270°", action: () => transform("rot270") },
      ] },
      { label: "Stretch/Skew...", action: () => deps.openStretchSkew && deps.openStretchSkew() },
      { sep: 1 },
      { label: "Invert Colors", action: invert },
      { label: "Attributes...", action: () => deps.openAttributes(cw, ch) },
      { label: "Clear Image", action: () => { snapshot(); newImage(); } },
      { sep: 1 },
      /* the same switch as the selection tools' option box, because in Paint it is */
      { label: "Draw Opaque", check: !opt.transparent, action: () => { opt.transparent = !opt.transparent; renderOpts(); } },
    ], x, y);
  }
  function colorsMenu(x, y) {
    showMenu([{ label: "Edit Colors...", action: editColors }], x, y);
  }
  function helpMenu(x, y) {
    showMenu([
      { label: "Help Topics", action: () => showError("Paint Help",
        "Left button draws with the foreground colour, right button draws with the background colour.\nRight-click a swatch to set the background colour.\n\nFile > Set As Background puts your art on the desktop.\nUndo is three steps deep.", true) },
      { sep: 1 },
      { label: "About Paint", action: () => showError("About Paint",
        "Paint\nVersion 5.1 (Build 2600)", true) },
    ], x, y);
  }
  const MENUS = { File: fileMenu, Edit: editMenu, View: viewMenu, Image: imageMenu, Colors: colorsMenu, Help: helpMenu };

  /* ---------- wiring ---------- */
  els.box.addEventListener("pointerdown", e => {
    if (e.target.classList && e.target.classList.contains("pt-text")) return;
    e.preventDefault();
    begin(e);
  });
  els.box.addEventListener("pointermove", move);
  addEventListener("pointerup", e => { if (drawing) end(e); });
  els.box.addEventListener("dblclick", e => { e.preventDefault(); if (poly) closePoly(); });
  els.box.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); });
  els.wrap.addEventListener("pointerleave", () => { if (els.st2) els.st2.textContent = ""; });

  /* drop an image straight onto the canvas — the fastest path to a meme */
  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  els.wrap.addEventListener("dragover", stop);
  els.wrap.addEventListener("drop", e => {
    stop(e);
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f || !/^image\//.test(f.type)) return;
    const rd = new FileReader();
    rd.onload = () => loadDataURL(rd.result, true);
    rd.readAsDataURL(f);
  });

  function key(e) {
    if (!deps.isFocused()) return;
    if (textBox) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === "z") { e.preventDefault(); undo(); }
    else if (e.ctrlKey && (k === "y")) { e.preventDefault(); redo(); }
    else if (e.ctrlKey && k === "a") { e.preventDefault(); selectAll(); }
    else if (e.ctrlKey && k === "c") { copySel(); }
    else if (e.ctrlKey && k === "v") { e.preventDefault(); pasteClip(); }
    else if (e.ctrlKey && k === "i") { e.preventDefault(); invert(); }
    else if (k === "delete" || k === "backspace") { if (sel) { e.preventDefault(); deleteSel(); } }
    else if (k === "escape") { cancelPending(); }
  }
  addEventListener("keydown", key);

  /* ---------- boot ---------- */
  /* the phone gets a canvas the shape of the phone: 384x272 is a landscape
     sheet of paper on a screen that is not landscape, and it left half the
     window grey */
  resize(store.data.paintW || (deps.isMobile ? 336 : 384),
         store.data.paintH || (deps.isMobile ? 460 : 272), false);
  renderTools(); renderOpts(); renderColors();
  if (store.data.paintImage) loadDataURL(store.data.paintImage, false);

  return {
    menu: (label, x, y) => { (MENUS[label] || helpMenu)(x, y); },
    stretchSkew,
    setSize: (w, h) => {
      resize(w, h, true);
      store.data.paintW = cw; store.data.paintH = ch; store.save();
      dirty();
    },
    size: () => ({ w: cw, h: ch }),
    newImage, loadDataURL,
    commit: cancelPending,
    toDataURL: () => cv.toDataURL("image/png"),
    setTool,
  };
}
