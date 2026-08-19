export function initNetPages(deps) {
  const { $, store, sysSnd, openWin, closeWin, showError, hooks } = deps;

  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function renderHall() {
    const h = hooks.hall();
    const rows = h.top.length ? h.top.map((t, i) => `<tr${t.mine ? ' class="me"' : ""}>
      <td class="n">${i + 1}</td>
      <td class="who">${esc(t.name)}${t.mine ? " <i>(you)</i>" : ""}</td>
      <td class="mult">&#215;${t.mult.toFixed(1)}</td>
      <td class="note">${esc(t.note)}</td></tr>`).join("")
      : `<tr><td colspan="4" class="empty">nothing has happened yet</td></tr>`;
    $("#fame-body").innerHTML = `<table class="npt">
      <tr><th class="n"></th><th class="who">cursor</th><th class="mult">peak</th><th class="note">how it went</th></tr>
      ${rows}</table>`;
    $("#fame-foot").innerHTML = `uptime <b>${esc(h.uptime)}</b> &#183; alive <b>${h.alive}</b>`
      + ` &#183; dead <b>${h.dead}</b> &#183; your best bank <b>${esc(h.bigBank)}</b>`;
  }

  function renderGuest() {
    const g = hooks.netGuests();
    const box = $("#guest-body");
    if (!g) { box.innerHTML = `<p class="empty">Offline. The guestbook is shared, so it needs the arena.</p>`; }
    else if (!g.length) { box.innerHTML = `<p class="empty">No entries yet. Be first.</p>`; }
    else box.innerHTML = g.map(e => `<div class="gbe">
      <b>${esc(e.who)}</b> <i>${esc(e.when)}</i>
      <div>${esc(e.txt)}</div></div>`).join("");
    $("#guest-count").textContent = g ? `${g.length} ${g.length === 1 ? "entry" : "entries"}` : "offline";
  }
  function signGuest() {
    const who = $("#gb-who").value.trim() || hooks.playerName();
    const txt = $("#gb-txt").value.trim();
    if (!txt) { showError("Guestbook", "Write something first.", true); return; }
    if (!hooks.postGuest(who, txt)) { showError("Guestbook", "Offline — nothing was sent.", true); return; }
    $("#gb-txt").value = "";
    sysSnd("nav", .4);
  }

  function renderGallery() {
    const list = hooks.netGallery();
    const box = $("#gal-body");
    if (!list) {
      box.innerHTML = `<p class="empty">Offline. Connect, open Paint, then File &gt; Publish to Gallery.</p>`;
      $("#gal-count").textContent = "offline";
      return;
    }
    const clean = g => {
      const n = String(g.name || "").trim(), suf = " by " + g.by;
      return (n.toLowerCase().endsWith(suf.toLowerCase()) ? n.slice(0, -suf.length).trim() : n) || "untitled";
    };
    box.innerHTML = list.length ? list.map(g => `<figure class="gal">
      <img src="${/^data:image\//.test(g.png) ? g.png : ""}" alt="">
      <figcaption><b>${esc(clean(g))}</b> <i>by ${esc(g.by)}</i></figcaption></figure>`).join("")
      : `<p class="empty">Nothing hangs here yet. Open Paint, then File &gt; Publish to Gallery.</p>`;
    $("#gal-count").textContent = `${list.length} ${list.length === 1 ? "work" : "works"}`;
  }

  let hallTimer = 0;
  const WIN = { hall: "win-fame", guest: "win-guest", gallery: "win-gallery" };
  const isOpen = id => hooks.isOpen(id);

  function prepare(id) {
    if (id === WIN.hall) {
      renderHall();
      clearInterval(hallTimer);
      hallTimer = setInterval(() => { if (isOpen(WIN.hall)) renderHall(); else clearInterval(hallTimer); }, 1000);
    } else if (id === WIN.guest) {
      hooks.openGuests();
      if (!$("#gb-who").value.trim()) $("#gb-who").value = hooks.playerName();
      renderGuest();
    } else if (id === WIN.gallery) {
      hooks.openGallery();
      renderGallery();
    }
  }
  function open(which) { openWin(WIN[which] || which); }

  function init() {
    $("#gb-sign").addEventListener("click", signGuest);
    $("#fame-pain").addEventListener("click", () => { closeWin("win-fame"); hooks.hallOfPain(); });
    for (const [id, fn] of [["win-guest", renderGuest], ["win-gallery", renderGallery]])
      $(`#${id} .np-refresh`).addEventListener("click", () => { sysSnd("nav", .4); fn(); });
  }

  return { init, open, prepare, refresh: which => {
    if (which === "guest" && isOpen("win-guest")) renderGuest();
    if (which === "gallery" && isOpen("win-gallery")) renderGallery();
  } };
}
