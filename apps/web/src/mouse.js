/* Mouse Properties (main.cpl) and the pointer schemes — the real files.

   Every .cur/.ani here is the actual Windows XP cursor set (vendored from
   bartekl1/windows-ui-assets). The scheme table is the real one: the
   Standard/Black/Inverted/Magnified rows are copied from the registry's
   HKLM ...\Control Panel\Cursors\Schemes (which still carries them today),
   and the XP-only schemes are composed from the same files XP shipped for
   them — the bronze set really is 3dg*, the dinosaur really walks.

   The scheme is also an identity: the arena renders every player's cursor
   in the scheme its owner picked, so choosing 3D-Bronze is not a setting,
   it is a flex. Import-free sibling module; main.js injects the shell. */
export function initMouse(deps) {
  const { $, store, sysSnd, CURFILES, openWin, closeWin, icoNode, onScheme } = deps;

  const url = f => CURFILES["./assets/xp/cursors/" + f];

  /* role order and names exactly as the Pointers tab listed them */
  const ROLES = [
    ["arrow", "Normal Select"], ["help", "Help Select"], ["appstart", "Working In Background"],
    ["wait", "Busy"], ["cross", "Precision Select"], ["beam", "Text Select"],
    ["pen", "Handwriting"], ["no", "Unavailable"], ["ns", "Vertical Resize"],
    ["we", "Horizontal Resize"], ["nwse", "Diagonal Resize 1"], ["nesw", "Diagonal Resize 2"],
    ["move", "Move"], ["up", "Alternate Select"], ["hand", "Link Select"],
  ];
  const set = (arrow, help, appstart, wait, cross, beam, pen, no, ns, we, nwse, nesw, move, up, hand) =>
    ({ arrow, help, appstart, wait, cross, beam, pen, no, ns, we, nwse, nesw, move, up, hand });
  const std = sfx => set("arrow" + sfx, "help" + sfx, "wait" + sfx, "busy" + sfx, "cross" + sfx, "beam" + sfx,
    "pen" + sfx, "no" + sfx, "size4" + sfx, "size3" + sfx, "size2" + sfx, "size1" + sfx, "move" + sfx, "up" + sfx, null);
  const cur = n => n && n + ".cur", ani = n => n && n + ".ani";
  const mapf = (r, f) => { const o = {}; for (const k in r) o[k] = r[k] && f(r[k]); return o; };

  const SCHEMES = [
    { id: "", label: "Windows Default", roles: {} },   /* the OS pointer you already have */
    /* verbatim from the registry's Schemes key */
    { id: "std-l", label: "Windows Standard (large)", roles: mapf(std("_m"), cur) },
    { id: "std-xl", label: "Windows Standard (extra large)", roles: mapf(std("_l"), cur) },
    { id: "black", label: "Windows Black", roles: mapf(std("_r"), cur) },
    { id: "black-l", label: "Windows Black (large)", roles: mapf(std("_rm"), cur) },
    { id: "black-xl", label: "Windows Black (extra large)", roles: mapf(std("_rl"), cur) },
    { id: "inv", label: "Windows Inverted", roles: mapf(std("_i"), cur) },
    { id: "inv-l", label: "Windows Inverted (large)", roles: mapf(std("_im"), cur) },
    { id: "inv-xl", label: "Windows Inverted (extra large)", roles: mapf(std("_il"), cur) },
    { id: "magnified", label: "Magnified", roles: set("larrow.cur", null, "lappstrt.cur", "lwait.cur", "lcross.cur",
      "libeam.cur", null, "lnodrop.cur", "lns.cur", "lwe.cur", "lnwse.cur", "lnesw.cur", "lmove.cur", null, null) },
    { id: "animated", label: "Windows Animated", roles: set(null, null, "appstart.ani", "hourglas.ani",
      null, null, null, null, null, null, null, null, null, null, null) },
    /* the famous ones: composed from the exact files XP installed for them */
    { id: "bronze", label: "3D-Bronze", roles: set("3dgarro.cur", null, "appstar2.ani", "hourgla2.ani", null, null,
      null, "3dgno.cur", "3dgns.cur", "3dgwe.cur", "3dgnwse.cur", "3dgnesw.cur", "3dgmove.cur", null, null) },
    { id: "white", label: "3D-White", roles: set("3dwarro.cur", null, "appstar3.ani", "hourgla3.ani", null, null,
      null, "3dwno.cur", "3dwns.cur", "3dwwe.cur", "3dwnwse.cur", "3dwnesw.cur", "3dwmove.cur", null, null) },
    { id: "dinosaur", label: "Dinosaur", roles: set(null, null, "dinosau2.ani", "dinosaur.ani",
      null, null, null, null, null, null, null, null, null, null, null) },
    { id: "hands", label: "Hands 1", roles: set("hand.ani", null, "handapst.ani", "handwait.ani", null, null,
      null, "handno.ani", "handns.ani", "handwe.ani", "handnwse.ani", "handnesw.ani", null, null, null) },
    { id: "conductor", label: "Conductor", roles: set(null, null, "piano.ani", "metronom.ani",
      null, null, null, null, null, null, null, null, null, null, null) },
    { id: "oldfashioned", label: "Old Fashioned", roles: set(null, null, "horse.ani", "stopwtch.ani", null, null,
      null, null, "3dsns.cur", null, "3dsnwse.cur", null, "3dsmove.cur", null, null) },
    { id: "variations", label: "Variations", roles: set("fillitup.ani", null, "barber.ani", "banana.ani", null, null,
      null, null, "sizens.ani", "sizewe.ani", "sizenwse.ani", "sizenesw.ani", null, "wagtail.ani", null) },
  ];
  const byId = id => SCHEMES.find(s => s.id === id) || SCHEMES[0];

  /* ---------- .ani: RIFF ACON with embedded .cur frames ---------- */
  const aniCache = {};
  async function aniLoad(u) {
    if (aniCache[u]) return aniCache[u];
    const buf = new Uint8Array(await (await fetch(u)).arrayBuffer());
    const dv = new DataView(buf.buffer);
    const frames = []; let rate = [], seq = null, jif = 4;
    (function walk(off, end) {
      end = Math.min(end, buf.length);
      while (off + 8 <= end) {
        const id = String.fromCharCode(...buf.slice(off, off + 4));
        const sz = dv.getUint32(off + 4, true);
        const body = off + 8, bend = Math.min(body + sz, end);
        if (id === "RIFF" || id === "LIST") walk(body + 4, bend);
        else if (id === "icon") frames.push(URL.createObjectURL(new Blob([buf.slice(body, bend)], { type: "image/x-icon" })));
        else if (id === "anih" && sz >= 36) jif = dv.getUint32(body + 32, true) || 4;
        else if (id === "rate") for (let i = 0; i < sz / 4; i++) rate.push(dv.getUint32(body + i * 4, true));
        else if (id === "seq ") { seq = []; for (let i = 0; i < sz / 4; i++) seq.push(dv.getUint32(body + i * 4, true)); }
        off = body + sz + (sz % 2);
      }
    })(0, buf.length);
    const order = seq || frames.map((_, i) => i);
    const steps = order.map((f, i) => ({ u: frames[f], ms: ((rate[i] || jif) * 1000) / 60 }));
    return (aniCache[u] = { frames, steps });
  }
  /* an <img> that actually plays the .ani, honouring rate and seq chunks */
  function aniImg(u, cls) {
    const img = document.createElement("img");
    if (cls) img.className = cls;
    aniLoad(u).then(a => {
      if (!a.steps.length) return;
      let i = 0;
      const tick = () => {
        if (!img.isConnected && img._started) return;   /* dropped from the DOM: stop */
        img._started = 1;
        img.src = a.steps[i].u;
        const ms = Math.max(30, a.steps[i].ms);
        i = (i + 1) % a.steps.length;
        img._t = setTimeout(tick, ms);
      };
      tick();
    });
    return img;
  }
  /* the arena and CSS need a static picture of an animated cursor: frame 0 */
  function stillOf(file, cb) {
    const u = url(file);
    if (!u) return cb(null);
    if (/\.cur$/i.test(file)) return cb(u);
    aniLoad(u).then(a => cb(a.frames[0] || null));
  }

  /* ---------- applying a scheme to the whole shell ---------- */
  const CSSROLES = ["arrow", "hand", "beam", "cross", "move", "ns", "we", "nwse", "nesw", "no"];
  function applyScheme(id) {
    const s = byId(id);
    store.data.curScheme = s.id; store.save();
    const root = document.documentElement;
    document.body.classList.toggle("skinned", !!s.id);
    for (const r of CSSROLES) {
      const f = s.roles[r];
      if (!f) { root.style.removeProperty("--cur-" + r); continue; }
      stillOf(f, u => { if (u && (store.data.curScheme === s.id)) root.style.setProperty("--cur-" + r, `url(${u}), ${FALLBACK[r]}`); });
    }
    if (onScheme) onScheme(s.id);
  }
  const FALLBACK = { arrow: "default", hand: "pointer", beam: "text", cross: "crosshair", move: "move",
    ns: "ns-resize", we: "ew-resize", nwse: "nwse-resize", nesw: "nesw-resize", no: "not-allowed" };

  /* what the arena shows for a player on this scheme; null = the stock glyph */
  function arenaArrow(id, cb) {
    const s = byId(id);
    if (!s.id || !s.roles.arrow) return cb(null);
    stillOf(s.roles.arrow, cb);
  }

  /* ---------- pointer trails / hide-while-typing / Ctrl locate ---------- */
  let trailEls = [], trailN = 0, lastTrail = 0;
  function syncTrails() {
    trailEls.forEach(t => t.remove()); trailEls = [];
    trailN = store.data.moTrails ? (+store.data.moTrailLen || 4) : 0;
    for (let i = 0; i < trailN; i++) {
      const im = document.createElement("img");
      im.className = "cur-trail";
      trailEls.push(im); document.body.appendChild(im);
    }
    if (trailN) arenaArrow(store.data.curScheme, u => trailEls.forEach(t => { t.src = u || url("arrow_m.cur"); }));
  }
  addEventListener("pointermove", e => {
    if (!trailN) return;
    const now = performance.now();
    if (now - lastTrail < 28) return;
    lastTrail = now;
    /* each trail element lags one step behind the one before it */
    for (let i = trailEls.length - 1; i > 0; i--) {
      trailEls[i].style.left = trailEls[i - 1].style.left;
      trailEls[i].style.top = trailEls[i - 1].style.top;
      trailEls[i].style.opacity = (1 - (i + 1) / (trailEls.length + 1)).toFixed(2);
    }
    if (trailEls[0]) { trailEls[0].style.left = e.clientX + "px"; trailEls[0].style.top = e.clientY + "px"; trailEls[0].style.opacity = ".8"; }
  }, { passive: true });

  addEventListener("keydown", e => {
    if (store.data.moHideType !== 0 && e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName))
      document.body.classList.add("typing");
    /* the Ctrl ripple: XP's concentric locator circles */
    if (e.key === "Control" && store.data.moCtrl && !e.repeat) {
      const d = document.createElement("div");
      d.className = "ctrl-locate";
      d.style.left = lastMouse.x + "px"; d.style.top = lastMouse.y + "px";
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 700);
    }
  }, true);
  const lastMouse = { x: innerWidth / 2, y: innerHeight / 2 };
  addEventListener("pointermove", e => { lastMouse.x = e.clientX; lastMouse.y = e.clientY; document.body.classList.remove("typing"); }, { passive: true });

  /* ---------- the dialog ---------- */
  let pending = null;   /* scheme picked in the dropdown but not yet applied */
  function renderRoles(id) {
    const s = byId(id);
    const host = $("#mo-roles"); host.innerHTML = "";
    for (const [key, label] of ROLES) {
      const row = document.createElement("div");
      row.className = "mo-role";
      const name = document.createElement("span"); name.textContent = label;
      const pic = document.createElement("span"); pic.className = "mo-pic";
      const f = s.roles[key];
      if (f && /\.ani$/i.test(f)) pic.appendChild(aniImg(url(f)));
      else if (f) { const im = document.createElement("img"); im.src = url(f); pic.appendChild(im); }
      else pic.className += " mo-def " + key;   /* default pointer: drawn by CSS keyword on a probe element */
      row.appendChild(name); row.appendChild(pic);
      row.addEventListener("click", () => { [...host.children].forEach(c => c.classList.toggle("on", c === row)); });
      host.appendChild(row);
    }
    const prev = $("#mo-prevbox"); prev.innerHTML = "";
    const af = s.roles.arrow;
    if (af && /\.ani$/i.test(af)) prev.appendChild(aniImg(url(af)));
    else if (af) { const im = document.createElement("img"); im.src = url(af); prev.appendChild(im); }
    else { const im = document.createElement("img"); im.src = url("arrow_m.cur"); prev.appendChild(im); }
  }
  function open() {
    const sel = $("#mo-scheme");
    sel.innerHTML = "";
    for (const s of SCHEMES) {
      const o = document.createElement("option");
      o.value = s.id; o.textContent = s.label;
      sel.appendChild(o);
    }
    pending = store.data.curScheme || "";
    sel.value = pending;
    renderRoles(pending);
    $("#mo-trails").checked = !!store.data.moTrails;
    $("#mo-traillen").disabled = !store.data.moTrails;
    $("#mo-traillen").value = store.data.moTrailLen || 4;
    $("#mo-hidetype").checked = store.data.moHideType !== 0;
    $("#mo-ctrl").checked = !!store.data.moCtrl;
    $("#mo-swap").checked = !!store.data.moSwap;
    $("#mo-snap").checked = !!store.data.moSnap;
    $("#mo-clklock").checked = !!store.data.moClkLock;
    $("#mo-shadow").checked = store.data.moShadow !== 0;
    openWin("win-mouse");
  }
  $("#mo-scheme").addEventListener("change", e => { pending = e.target.value; renderRoles(pending); sysSnd("nav", .35); });
  function apply() {
    store.data.moTrails = $("#mo-trails").checked ? 1 : 0;
    store.data.moTrailLen = +$("#mo-traillen").value;
    store.data.moHideType = $("#mo-hidetype").checked ? 1 : 0;
    store.data.moCtrl = $("#mo-ctrl").checked ? 1 : 0;
    store.data.moSwap = $("#mo-swap").checked ? 1 : 0;
    store.data.moSnap = $("#mo-snap").checked ? 1 : 0;
    store.data.moClkLock = $("#mo-clklock").checked ? 1 : 0;
    store.data.moShadow = $("#mo-shadow").checked ? 1 : 0;
    applyScheme(pending);
    syncTrails();
  }
  $("#mo-ok").addEventListener("click", () => { apply(); closeWin("win-mouse"); });
  $("#mo-apply").addEventListener("click", apply);
  $("#mo-cancel").addEventListener("click", () => closeWin("win-mouse"));
  $("#mo-trails").addEventListener("change", e => { $("#mo-traillen").disabled = !e.target.checked; });
  $("#mo-hwprops").addEventListener("click", () => deps.openDevice && deps.openDevice());

  /* the double-click test folder: opens and closes, like it always did */
  {
    const box = $("#mo-dctest");
    let openState = false;
    const draw = () => { box.innerHTML = ""; box.appendChild(icoNode(openState ? "openfolder32" : "folder32")); };
    draw();
    box.addEventListener("dblclick", () => { openState = !openState; draw(); sysSnd("nav", .4); });
  }

  /* boot: restore the saved scheme and switches */
  applyScheme(store.data.curScheme || "");
  syncTrails();

  return { open, applyScheme, arenaArrow, schemes: () => SCHEMES, current: () => store.data.curScheme || "", labelOf: id => byId(id).label, aniImg, url };
}
