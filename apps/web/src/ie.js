/* Internet Explorer 6, and the web behind it: cursor$land, the ring it belongs
   to, and the "page cannot be displayed" you get for everything else.
   The pages are written in real 2003 tag soup — <center>, <font>, <marquee>,
   nested tables — on purpose. View > Source is a feature here, so the source
   has to look handmade, because it is.
   Import-free like the other app modules: the build's smoke runner executes
   this file in node. main.js injects the icons and the shell hooks. */

export function initIE(deps) {
  const { IMG, els, store, sysSnd, snd, showMenu, showError, hooks } = deps;

  const HOME = "http://tv.cursor.land/";   /* home is the shared screen */
  const PHONE = "555-0134";

  let url = null, past = [], future = [], loading = null, timers = [];
  let online = false, offline = false, srcHTML = "", pageTitle = "";
  let pending = null;
  const HISTORY = [];

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const key = u => String(u).trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

  /* ---------- the guestbook is real, and it persists ----------
     online it is GLOBAL: the beta server owns it and everyone reads the same
     page. offline it falls back to the local store - empty until YOU sign it,
     because the entries are player content, not set dressing. */
  function guests() {
    const net = hooks.netGuests && hooks.netGuests();
    if (net) return net;
    return store.data.guest || (store.data.guest = []);
  }

  /* ================= the sites ================= */
  /* every page is a function, so the ones with live numbers in them can be */

  const SITES = {};
  const site = (u, o) => { SITES[key(u)] = Object.assign({ url: u }, o); };

  /* ---------- the real pages: live systems, player content, plain chrome ----------
     The 2003 fiction sites (cursor$land, the webring, mumu, deg404, bobo) are
     gone by owner decree: no authored joke copy. What remains is only what
     players make - the shared TV, the gallery, the guestbook, the hall - plus
     MSN Search over exactly those pages. */

  site("http://hall.cursor.land/", {
    title: "hall of fame",
    body: () => {
      const h = hooks.hall();
      const board = h.top.length
        ? h.top.map((t, i) => `  <tr>
    <td>${i + 1}. <b>${esc(t.name)}</b>${t.mine ? ' <font color="#c60">(you)</font>' : ""}</td>
    <td align="right">&#215;${t.mult.toFixed(1)}</td>
    <td align="left"><font size="1">${esc(t.note)}</font></td>
  </tr>`).join("\n")
        : `  <tr><td colspan="3"><center><font size="1">nothing has happened yet</font></center></td></tr>`;
      return `<center>
<h1>hall of fame</h1>
<font size="1">live from the arena</font>
<hr width="88%">
<table border="1" cellpadding="5" cellspacing="0" class="oddstable" width="88%">
  <tr><th align="left" width="34%">cursor</th><th width="70">peak</th><th align="left">how it went</th></tr>
${board}
</table>
<p><font size="1">uptime <b>${esc(h.uptime)}</b> &#183;
alive right now <b>${h.alive}</b> &#183;
dead so far <b>${h.dead}</b> &#183;
your biggest bank <b>${esc(h.bigBank)}</b></font></p>
<p><font size="1">every dead cursor gets a certificate with its odds at the
moment it lost. the favourites that lost are in the
<a data-act="hall">Hall of Pain</a>, in the Recycle Bin.</font></p>
</center>`;
    },
  });

  site("http://guest.cursor.land/", {
    title: "the guestbook",
    body: () => {
      const g = guests();
      const list = g.length ? g.map(e => `<table border="1" cellpadding="5" cellspacing="0" class="gbentry" width="88%"><tr><td align="left">
  <b>${esc(e.who)}</b> <font size="1" color="#888">wrote on ${esc(e.when)}</font><br>
  ${esc(e.txt)}
</td></tr></table>`).join("\n<br>\n")
        : `<font size="1">no entries yet.</font>`;
      return `<center>
<h1>the guestbook</h1>
<font size="1">${g.length} entries &#183; signing costs one deploy &#183; no takebacks</font>
<hr width="88%">
<table border="1" cellpadding="8" cellspacing="0" class="sidebox" width="88%"><tr><td>
<center><b>sign it</b></center>
<table border="0" cellpadding="3" cellspacing="0" width="100%">
  <tr><td width="74"><font size="1">your name</font></td>
      <td><input id="gb-who" class="gbin" value="${esc(hooks.playerName())}" maxlength="18" spellcheck="false"></td></tr>
  <tr><td valign="top"><font size="1">message</font></td>
      <td><textarea id="gb-txt" class="gbin" rows="3" maxlength="220" spellcheck="false"></textarea></td></tr>
  <tr><td></td><td><a data-act="gb-post"><b>[ sign ]</b></a></td></tr>
</table>
</td></tr></table>
<br>
${list}
</center>`;
    },
  });


  /* ---------- cursorTV: the lobby watches one video together ---------- */
  /* the player, the queue and the sync all live in main.js (hooks.tvMounted);
     this page is only the room around them. It is also the home page. */
  site("http://tv.cursor.land/", {
    title: "cursorTV - now showing",
    /* the class is what theater mode keys off: on this page, and only this
       page, hiding every element except the picture leaves something to see */
    cls: "tv",
    mounted: p => hooks.tvMounted && hooks.tvMounted(p),
    body: () => hooks.mpOn && hooks.mpOn() ? `<center>
<div id="tv-stage"><div id="tv-slot"></div><i id="tv-exit" title="Leave theater mode">&#10005;</i></div>
<div id="tv-bar">
  <span id="tv-live"></span>
  <span id="tv-now"></span>
  <font size="1"><span id="tv-watch"></span> <span id="tv-skipn"></span></font>
  <a id="tv-theater">[ theater ]</a>
  <a id="tv-skip">[ skip ]</a>
</div>
<a id="tv-sound"><span class="badge">&#128266; CLICK FOR SOUND</span></a>
<table border="0" cellpadding="3" cellspacing="0"><tr>
  <td><input id="tv-in" class="gbin" style="width:250px" placeholder="paste a youtube link" spellcheck="false"></td>
  <td><a id="tv-add"><b>[ queue it ]</b></a></td>
</tr></table>
<table border="1" cellpadding="6" cellspacing="0" class="sidebox" width="80%"><tr><td align="left">
  <b>the decks</b>
  <div id="tv-queue"></div>
</td></tr></table>
</center>` : `<center>
<h1>cursorTV</h1>
<hr width="94%">
<p>the antenna is the beta server, and you are not connected to it.</p>
</center>`,
  });

  /* ---------- the gallery: what the lobby painted ---------- */
  site("http://gallery.cursor.land/", {
    title: "the gallery",
    mounted: p => hooks.galleryMounted && hooks.galleryMounted(p),
    body: () => {
      const list = hooks.netGallery && hooks.netGallery();
      if (!list) return `<center>
<h1>the gallery</h1>
<hr width="88%">
<p>the gallery hangs on the beta server, and you are offline.</p>
<p><font size="1">connect, open Paint, make something, File &gt; Publish to Gallery.</font></p>
</center>`;
      const items = list.length ? list.map(g => `<table border="1" cellpadding="6" cellspacing="0" class="gbentry" style="display:inline-table;margin:6px" width="260"><tr><td>
  <img src="${g.png}" style="max-width:240px;max-height:170px;background:#fff"><br>
  <b>${esc(g.name)}</b> <font size="1" color="#888">by ${esc(g.by)}</font>
</td></tr></table>`).join("") : `<p><font size="1">nothing hangs here yet. open Paint. File &gt; Publish to Gallery.</font></p>`;
      return `<center>
<h1>the gallery</h1>
<font size="1">${list.length} works &#183; a frame costs 10 deploys &#183; latest 16 survive</font>
<hr width="88%">
${items}
</center>`;
    },
  });

  /* ---------- the search engine, which indexes the entire web ---------- */
  /* the index IS the site registry: search finds what exists, nothing else */
  function searchIndex() {
    const DESC = {
      "tv.cursor.land": "one screen, everyone watches, the decks rotate. this is the home page.",
      "gallery.cursor.land": "what the lobby painted. published from Paint, priced in deploys.",
      "guest.cursor.land": "the guestbook. signing costs one deploy.",
      "hall.cursor.land": "live from the arena: peaks, deaths, uptime.",
      "search.msn.com": "this page.",
    };
    return Object.values(SITES).map(s => ({ t: s.title, u: s.url, d: DESC[key(s.url)] || "" }));
  }
  site("http://search.msn.com/", {
    title: "MSN Search",
    cls: "srch",
    body: q => {
      const query = q || "";
      const ql = query.toLowerCase();
      const all = searchIndex();
      const list = query ? all.filter(r => (r.t + " " + r.u + " " + r.d).toLowerCase().includes(ql)).concat(
        all.filter(r => !(r.t + " " + r.u + " " + r.d).toLowerCase().includes(ql))).slice(0, 6) : [];
      return `<table border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td bgcolor="#000084" height="36">
&nbsp;<font color="#FFFFFF" size="4"><b>msn</b></font><font color="#FFCC00" size="4"><b>Search</b></font>
</td></tr></table>
<br>
<center>
<table border="0" cellpadding="2" cellspacing="0"><tr>
<td><input id="sq" class="gbin" style="width:320px" value="${esc(query)}" spellcheck="false"></td>
<td><a data-act="search"><b>[ Search the Web ]</b></a></td>
</tr></table>
<font size="1" color="#666">indexes the entire web. all ${all.length} pages of it.</font>
</center>
<br>
${query ? `<p><font size="1" color="#666">Results <b>1-${list.length}</b> of about <b>${list.length}</b>
containing "<b>${esc(query)}</b>". (0.04 seconds)</font></p>
${list.map(r => `<div class="hit">
  <a data-go="${r.u}"><b>${esc(r.t)}</b></a><br>
  ${esc(r.d)}<br>
  <font size="1" color="#008000">${esc(r.u)}</font>
</div>`).join("\n")}` : `<center><font size="1" color="#666">type something above.</font></center>`}`;
    },
  });

  /* ---------- the two failure pages, carbon copy ---------- */
  function page404(u) {
    return `<div class="err404">
<h1>The page cannot be displayed</h1>
<p>The page you are looking for is currently unavailable. The Web site might be
experiencing technical difficulties, or you may need to adjust your browser
settings.</p>
<hr>
<p><b>Please try the following:</b></p>
<ul>
  <li>Click the <a data-act="refresh">Refresh</a> button, or try again later.</li>
  <li>If you typed the page address in the Address bar, make sure that it is
      spelled correctly.</li>
  <li>To check your connection settings, click the <b>Tools</b> menu, and then
      click <b>Internet Options</b>. On the <b>Connections</b> tab, click
      <b>Settings</b>. The settings should match those provided by your local
      area network (LAN) administrator or Internet service provider (ISP).</li>
  <li>Some sites require 128-bit connection security. Click the <b>Help</b> menu
      and then click <b>About Internet Explorer</b> to determine what strength
      security you have installed.</li>
  <li>Click the <a data-go="http://search.msn.com/">Search</a> button to look for
      information on the Internet.</li>
</ul>
<p><font size="1">You asked for <b>${esc(u)}</b>. It was probably never there.
Most of them were not.</font></p>
<hr>
<p><b>Cannot find server or DNS Error</b><br>
Internet Explorer</p>
</div>`;
  }
  function pageOffline(u) {
    return `<div class="err404">
<h1>Web page unavailable while offline</h1>
<p>The Web page you requested is not available offline. To view this page, click
<b>Connect</b>.</p>
<hr>
<p><a data-act="connect"><b>[ Connect ]</b></a>
&nbsp; <font size="1">requested: ${esc(u)}</font></p>
<hr>
<p><b>Internet Explorer</b></p>
</div>`;
  }

  /* ---------- resolving whatever somebody typed ---------- */
  function resolve(u) {
    const k = key(u);
    if (!k || k === "about:blank") return { url: "about:blank", title: "about:blank", cls: "", html: "" };
    if (SITES[k]) { const s = SITES[k]; return { url: s.url, title: s.title, cls: s.cls, html: s.body(), pop: s.pop, mounted: s.mounted }; }
    /* search results keep the query in the address bar, like the real thing */
    const m = /^search\.msn\.com\/results\?q=(.*)$/.exec(k);
    if (m) {
      const q = decodeURIComponent(m[1].replace(/\+/g, " "));
      const s = SITES["search.msn.com"];
      return { url: "http://search.msn.com/results?q=" + encodeURIComponent(q),
        title: "MSN Search: " + q, cls: s.cls, html: s.body(q) };
    }
    return { url: /^[a-z]+:\/\//i.test(u) ? u : "http://" + String(u).replace(/^\/+/, ""),
      title: "The page cannot be displayed", cls: "err", html: page404(u), bad: 1 };
  }

  /* ================= the browser ================= */
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function setTitle(t) { pageTitle = t; if (deps.setTitle) deps.setTitle(t + " - Microsoft Internet Explorer"); }
  function buttons() {
    els.back.disabled = !past.length;
    els.fwd.disabled = !future.length;
    els.stop.disabled = !loading;
  }
  function progress(p) {
    els.prog.style.visibility = p == null ? "hidden" : "visible";
    if (p != null) els.progbar.style.width = Math.round(p * 100) + "%";
  }
  function status(t) { els.st1.textContent = t; }

  function go(u, opts) {
    opts = opts || {};
    if (!u) return;
    if (!online) { pending = u; dialup(); return; }
    if (offline) { render({ url: u, title: "Web page unavailable while offline", cls: "err", html: pageOffline(u) }, true); return; }

    const r = resolve(u);
    if (!opts.replace && url) { past.push(url); future.length = 0; }
    clearTimers(); loading = r; buttons();
    els.addr.value = r.url;
    els.throb.classList.add("spin");
    status("Opening page " + r.url + "...");
    /* a page over dial-up arrives in fits, so the bar and the status text do too */
    const steps = 4 + Math.floor(Math.random() * 3), span = 260 + Math.random() * 620;
    for (let i = 1; i <= steps; i++) later(() => {
      progress(i / steps);
      const left = steps - i;
      if (left > 0) status(`(${left} item${left === 1 ? "" : "s"} remaining) Downloading picture ${r.url}...`);
    }, (span * i) / steps);
    later(() => render(r), span + 90);
  }

  function render(r, noHist) {
    loading = null;
    url = r.url;
    els.addr.value = r.url;
    els.throb.classList.remove("spin");
    progress(null);
    if (theater && (r.cls || "") !== "tv") setTheater(false);
    els.page.className = "ie-doc " + (r.cls || "");
    srcHTML = r.html;
    els.page.innerHTML = r.html;
    els.page.scrollTop = 0;
    if (r.mounted) try { r.mounted(els.page); } catch (e) {}
    setTitle(r.title);
    status("Done");
    buttons();
    if (!noHist && r.url !== "about:blank" && HISTORY.indexOf(r.url) < 0) { HISTORY.unshift(r.url); syncAutocomplete(); }
    /* the cache grows because the page really did cost something */
    store.data.ieCacheKB = (store.data.ieCacheKB || 0) + 14 + Math.floor(Math.random() * 60);
    setTextSize(store.data.ieTextSize || "Medium");
    applyAdvanced();
    if (r.bad) sysSnd("exclaim", .4);
  }
  /* the address bar remembers, like AutoComplete did */
  function syncAutocomplete() {
    let dl = document.getElementById("ie-histlist");
    if (!dl) {
      dl = document.createElement("datalist");
      dl.id = "ie-histlist";
      els.addr.setAttribute("list", "ie-histlist");
      els.addr.parentNode.appendChild(dl);
    }
    dl.innerHTML = "";
    for (const u of HISTORY.slice(0, 20)) {
      const o = document.createElement("option");
      o.value = u; dl.appendChild(o);
    }
  }

  function stop() {
    if (!loading) return;
    clearTimers();
    const half = loading; loading = null;
    els.throb.classList.remove("spin");
    progress(null); status("Done"); buttons();
    els.page.className = "ie-doc err";
    els.page.innerHTML = page404(half.url);
    srcHTML = els.page.innerHTML;
    setTitle("The page cannot be displayed");
  }

  /* ---------- dial-up ---------- */
  function dialup() {
    els.dlUser.value = hooks.playerName();
    hooks.openWin("win-dialup");
  }
  /* the handshake, synthesised: dial tone, DTMF, ringback, answer tone, carrier.
     scheduled one step at a time so Cancel actually shuts it up. */
  function modemStep(i) {
    const T = snd.tone, N = snd.noise;
    if (i === 0) {
      T(350, .7, "sine", .04); T(440, .7, "sine", .04);
      const DT = [[697, 1209], [941, 1336], [941, 1477], [697, 1209], [852, 1336], [770, 1477], [941, 1209]];
      DT.forEach((p, k) => { T(p[0], .08, "sine", .05, .85 + k * .13); T(p[1], .08, "sine", .05, .85 + k * .13); });
    }
    if (i === 1) [0, 1].forEach(k => { T(440, .8, "sine", .04, k * 1.5); T(480, .8, "sine", .04, k * 1.5); });
    if (i === 2) {
      T(2100, .55, "sine", .045);
      N(.35, .022, .5);
      for (let k = 0; k < 8; k++) T(500 + Math.random() * 1900, .12, "sawtooth", .025, .8 + k * .11);
    }
    if (i === 3) { N(.9, .035); T(1800, .5, "square", .018, .1, -1100); }
  }
  const DIALSTEPS = [
    { t: 0, s: "Dialing " + PHONE + "..." },
    { t: 1900, s: "Waiting for a reply..." },
    { t: 4900, s: "Verifying user name and password..." },
    { t: 6700, s: "Registering your computer on the network..." },
  ];
  function connect() {
    hooks.closeWin("win-dialup");
    hooks.openWin("win-dialing");
    DIALSTEPS.forEach((d, i) => later(() => {
      els.dgText.textContent = d.s;
      els.dgBar.style.width = ((i + 1) / (DIALSTEPS.length + 1) * 100) + "%";
      modemStep(i);
    }, d.t));
    later(() => {
      els.dgBar.style.width = "100%";
      hooks.closeWin("win-dialing");
      online = true; offline = false;
      hooks.setNet(true);
      sysSnd("hwin", .5);
      hooks.balloon("Connected at 56.6 Kbps", "cursor$net is connected.\nThis is as fast as it is ever going to get.");
      const u = pending || HOME; pending = null;
      go(u, { replace: !url });
    }, 8100);
  }
  function hangup() {
    online = false; offline = true;
    hooks.setNet(false);
    sysSnd("hwout", .5);
    status("Working offline");
  }
  function cancelDial() {
    clearTimers();
    hooks.closeWin("win-dialing");
    hooks.closeWin("win-dialup");
    offline = true;
    const u = pending || HOME; pending = null;
    render({ url: u, title: "Web page unavailable while offline", cls: "err", html: pageOffline(u) }, true);
  }

  /* ---------- clicks inside a page ---------- */
  const ACTIONS = {
    deploy: () => { hooks.openWin("win-cursors"); hooks.deploy(); },
    amp: () => hooks.openWin("win-amp"),
    mail: () => hooks.openLobby(),
    hall: () => hooks.hallOfPain(),
    refresh: () => go(url || HOME, { replace: true }),
    /* reconnecting means dialing again — go() re-opens the dial-up box itself */
    connect: () => { offline = false; online = false; go(pending || url || HOME, { replace: true }); },
    search: () => {
      const q = els.page.querySelector("#sq");
      go("http://search.msn.com/results?q=" + encodeURIComponent(((q && q.value) || "").trim()));
    },
    "gb-post": () => {
      const who = els.page.querySelector("#gb-who"), txt = els.page.querySelector("#gb-txt");
      const t = ((txt && txt.value) || "").trim();
      if (!t) { showError("Guestbook", "Write something first.", true); return; }
      if (hooks.postGuest && hooks.postGuest(((who && who.value) || "").trim().slice(0, 18), t.slice(0, 220))) {
        sysSnd("ding", .5);   /* the server broadcast re-renders the page */
        return;
      }
      const d = new Date();
      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      guests().unshift({
        who: ((who && who.value) || "").trim().slice(0, 18) || "anonymous",
        when: d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(),
        txt: t.slice(0, 220),
      });
      store.save();
      sysSnd("ding", .5);
      go("http://www.cursor.land/guest.html", { replace: true });
    },
  };
  els.page.addEventListener("click", e => {
    const a = e.target.closest("[data-go],[data-act]");
    if (!a) return;
    e.preventDefault();
    if (a.dataset.act) { const f = ACTIONS[a.dataset.act]; if (f) f(); return; }
    sysSnd("nav", .4);
    go(a.dataset.go);
  });
  els.page.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Enter" && e.target.id === "sq") { e.preventDefault(); ACTIONS.search(); }
  });

  /* IE6 had three different right-click menus: page, link and image.
     All three are here, and Set as Background genuinely redecorates. */
  els.page.addEventListener("contextmenu", e => {
    if (e.target.closest("input,textarea")) return;   /* the shell's edit menu owns those */
    e.preventDefault(); e.stopPropagation();
    const a = e.target.closest("[data-go]");
    const img = e.target.closest("img");
    const sel = () => (window.getSelection() || "").toString();
    let items;
    if (a) {
      const u = a.dataset.go;
      items = [
        { label: "Open", bold: 1, action: () => { sysSnd("nav", .4); go(u); } },
        { label: "Open in New Window", action: () => { sysSnd("nav", .4); go(u); } },
        { label: "Save Target As...", action: () => showError("Save As", "Access is denied.\n\nThe disk is nearly full of dead cursors. Saving is not going to help.") },
        { label: "Print Target", action: () => noPrinter() },
        { sep: 1 },
        { label: "Copy Shortcut", action: () => { try { navigator.clipboard.writeText(/^https?:/i.test(u) ? u : ""); } catch (err) {} } },
        { sep: 1 },
        { label: "Add to Favorites...", action: () => menu("Favorites", e.clientX, e.clientY) },
        { sep: 1 },
        { label: "Properties", action: () => showError("Properties", `Protocol: HyperText Transfer Protocol\nType: HTML Document\nAddress:\n(URL) ${u}`, true) },
      ];
    } else if (img && img.src) {
      items = [
        { label: "Save Picture As...", action: () => showError("Save Picture", "Access is denied.\n\nRight-click was free. The picture is not leaving.") },
        { label: "E-mail Picture...", action: () => hooks.openLobby() },
        { label: "Print Picture...", action: () => noPrinter() },
        { sep: 1 },
        { label: "Set as Background", action: () => { hooks.setWallpaperFrom && hooks.setWallpaperFrom(img.src, "center"); } },
        { label: "Set as Desktop Item...", disabled: 1 },
        { sep: 1 },
        { label: "Copy", disabled: 1 },
        { sep: 1 },
        { label: "Properties", action: () => showError("Properties", `Type: ${/^data:/.test(img.src) ? "Bitmap Image" : "GIF Image"}\nAddress:\n(URL) ${url || HOME}`, true) },
      ];
    } else {
      items = [
        { label: "Back", disabled: !past.length, action: () => els.back.dispatchEvent(new Event("click")) },
        { label: "Forward", disabled: !future.length, action: () => els.fwd.dispatchEvent(new Event("click")) },
        { sep: 1 },
        { label: "Save Background As...", disabled: 1 },
        { label: "Set as Background", disabled: 1 },
        { label: "Copy Background", disabled: 1 },
        { label: "Set as Desktop Item...", disabled: 1 },
        { sep: 1 },
        { label: "Select All", accel: "Ctrl+A", action: () => { const r = document.createRange(); r.selectNodeContents(els.page); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } },
        { label: "Paste", disabled: 1 },
        { sep: 1 },
        { label: "Create Shortcut", disabled: 1 },
        { label: "Add to Favorites...", action: () => menu("Favorites", e.clientX, e.clientY) },
        { label: "View Source", action: () => hooks.openText(srcName(), srcView()) },
        { sep: 1 },
        { label: "Encoding", sub: [
          { label: "Auto-Select" },
          { sep: 1 },
          { label: "Western European (Windows)", check: 1 },
          { label: "Unicode (UTF-8)" },
          { sep: 1 },
          { label: "More", disabled: 1 }] },
        { sep: 1 },
        { label: "Print...", action: () => noPrinter() },
        { label: "Refresh", action: () => ACTIONS.refresh() },
        { sep: 1 },
        { label: "Properties", action: () => showError("Properties", `Protocol: HyperText Transfer Protocol\nType: HTML Document\nConnection: 56.6 Kbps modem\nAddress:\n(URL) ${url || "about:blank"}`, true) },
      ];
    }
    showMenu(items, e.clientX, e.clientY);
  });


  /* ---------- theater mode ---------- */
  /* IE is mostly a television here, and a television with a menu bar, two
     toolbars, a Links bar and a status bar on a phone is 40% picture. Theater
     mode drops all of it and gives the window to the screen. F11, like it
     always was. It only blanks the page chrome on the TV page (cls "tv"),
     because on any other page that would leave an empty white window. */
  let theater = false, theaterMaxed = false;
  function setTheater(on) {
    on = !!on;
    if (on === theater) return;
    theater = on;
    const w = document.getElementById("win-ie");
    if (w) {
      w.classList.toggle("theater", theater);
      if (hooks.maximize) {
        if (theater && !w.classList.contains("maxed")) { hooks.maximize(); theaterMaxed = true; }
        else if (!theater && theaterMaxed) { hooks.maximize(); theaterMaxed = false; }
      }
    }
    if (hooks.tvFit) hooks.tvFit();
  }

  /* ---------- menus ---------- */
  /* Favorites: the defaults plus whatever the user added; both editable
     through the real Add/Organize dialogs, persisted in the store */
  const DEFFAVS = [
    { label: "cursorTV", u: "http://tv.cursor.land/" },
    { label: "the gallery", u: "http://gallery.cursor.land/" },
    { label: "the guestbook", u: "http://guest.cursor.land/" },
    { label: "hall of fame", u: "http://hall.cursor.land/" },
    { label: "MSN Search", u: "http://search.msn.com/" },
  ];
  function FAVS() {
    if (!store.data.ieFavs) { store.data.ieFavs = DEFFAVS.slice(); store.save(); }
    return store.data.ieFavs;
  }
  function srcName() {
    const last = key(url || "").split("/").pop();
    return last && /\./.test(last) && !/^[a-z0-9-]+\.(com|org|net|land)$/i.test(last) ? last : "index.html";
  }
  /* View > Source has to look like somebody typed it, because somebody did */
  function srcView() {
    const u = url || "";
    return `<!-- saved from url=(${String(u.length).padStart(4, "0")})${u} -->
<html>

<head>
<title>${pageTitle}</title>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">
<meta name="GENERATOR" content="Microsoft FrontPage Express 2.0">
</head>

<body bgcolor="#000000" text="#00FF00" link="#5599FF" vlink="#9955FF">
${srcHTML}
</body>

</html>`;
  }
  function menu(label, x, y) {
    const items =
      label === "File" ? [
        { label: "New Window", disabled: 1 },
        { label: "Open...", action: () => hooks.openWin("win-run") },
        { sep: 1 },
        { label: "Save As...", disabled: 1 },
        { label: "Print...", action: () => noPrinter() },
        { sep: 1 },
        { label: "Work Offline", check: offline, action: () => (offline ? ACTIONS.connect() : hangup()) },
        { label: "Close", action: () => hooks.close() },
      ] :
      label === "Edit" ? [
        { label: "Cut", disabled: 1 }, { label: "Copy", accel: "Ctrl+C", action: () => document.execCommand("copy") },
        { label: "Paste", disabled: 1 },
        { sep: 1 },
        { label: "Select All", accel: "Ctrl+A", action() {
          const r = document.createRange(); r.selectNodeContents(els.page);
          const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        } },
        { label: "Find (on This Page)...", accel: "Ctrl+F", action: findDialog },
      ] :
      label === "View" ? [
        { label: "Toolbars", sub: [
          { label: "Standard Buttons", check: 1 }, { label: "Address Bar", check: 1 }, { label: "Links", check: 1 }] },
        { label: "Status Bar", check: 1 },
        { label: "Theater Mode", accel: "F11", check: theater, action: () => setTheater(!theater) },
        { label: "Explorer Bar", sub: [
          { label: "Search", accel: "Ctrl+E", check: sideMode === "search", action: () => sidebar("search") },
          { label: "Favorites", accel: "Ctrl+I", check: sideMode === "favs", action: () => sidebar("favs") },
          { label: "History", accel: "Ctrl+H", check: sideMode === "hist", action: () => sidebar("hist") },
        ] },
        { sep: 1 },
        { label: "Refresh", accel: "F5", action: () => ACTIONS.refresh() },
        { label: "Text Size", sub: Object.keys(TEXTSIZES).map(n => ({
          label: n, check: (store.data.ieTextSize || "Medium") === n, action: () => setTextSize(n) })) },
        { sep: 1 },
        { label: "Source", action: () => hooks.openText(srcName(), srcView()) },
      ] :
      label === "Favorites" ? [
        { label: "Add to Favorites...", action: addFavDialog },
        { label: "Organize Favorites...", action: orgFavDialog },
        { sep: 1 },
      ].concat(FAVS().map(f => ({ label: f.label, action: () => go(f.u) }))) :
      label === "Tools" ? [
        { label: "Mail and News", sub: [
          { label: "Read Mail", action: () => hooks.openLobby() },
          { label: "New Message", action: () => hooks.openLobby() }] },
        { label: "Synchronize...", disabled: 1 },
        { label: "Windows Update", action: () => hooks.windowsUpdate() },
        { sep: 1 },
        { label: "Internet Options...", action: inetOptions },
      ] :
      label === "Help" ? [
        { label: "Contents and Index", action: () => hooks.openHelp ? hooks.openHelp() : hooks.openWin("win-help") },
        { label: "Tip of the Day", action: () => showError("Tip of the Day", pick([
          "Did you know? P(ever reaching x N) = 1/N. Exactly.",
          "Did you know? You can bank at any moment. That is the entire skill.",
          "Did you know? Every collision is a coin weighted by money, and the house is not in it.",
          "Did you know? The rotation on cursorTV is by person, and it is not for sale."]), true) },
        { sep: 1 },
        { label: "About Internet Explorer", action: () => showError("About Internet Explorer",
          "Microsoft Internet Explorer\nVersion 6.0.2900.2180\nCipher Strength: 128-bit\n\nBased on NCSA Mosaic. NCSA Mosaic(TM); was developed at the National Center for Supercomputing Applications at the University of Illinois at Urbana-Champaign.", true) },
      ] : [{ label: "(nothing here)", disabled: 1 }];
    showMenu(items, x, y);
  }
  /* ---------- working Text Size, like the menu says ---------- */
  const TEXTSIZES = { Largest: "125%", Larger: "112%", Medium: "100%", Smaller: "88%", Smallest: "76%" };
  function setTextSize(n) {
    store.data.ieTextSize = n; store.save();
    els.page.style.fontSize = TEXTSIZES[n] || "100%";
  }
  /* ---------- Find (on This Page): highlights and scrolls, for real ---------- */
  function findDialog() { findBar(); }
  let findWrap = null;
  function findBar() {
    if (findWrap && findWrap.isConnected) { findWrap.querySelector("input").focus(); return; }
    findWrap = document.createElement("div");
    findWrap.className = "ie-findbar";
    findWrap.innerHTML = `<span>Find:</span><input type="text" spellcheck="false">
      <button class="xbtn">Find Next</button><button class="xbtn">Close</button>`;
    els.page.parentNode.insertBefore(findWrap, els.page);
    const inp = findWrap.querySelector("input");
    const [nextB, closeB] = findWrap.querySelectorAll("button");
    let lastHit = null;
    const clear = () => { if (lastHit) { lastHit.outerHTML = lastHit.innerHTML; lastHit = null; } };
    const doFind = () => {
      clear();
      const q = inp.value.trim(); if (!q) return;
      const walker = document.createTreeWalker(els.page, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const i = node.textContent.toLowerCase().indexOf(q.toLowerCase());
        if (i < 0) continue;
        const r = document.createRange();
        r.setStart(node, i); r.setEnd(node, i + q.length);
        const m = document.createElement("mark");
        try { r.surroundContents(m); } catch (e) { continue; }
        m.scrollIntoView({ block: "center" });
        lastHit = m;
        return;
      }
      showError("Find", `Finished searching the document.\n\nCannot find "${q}".`, true);
    };
    nextB.addEventListener("click", doFind);
    inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") doFind(); });
    closeB.addEventListener("click", () => { clear(); findWrap.remove(); findWrap = null; });
    inp.focus();
  }
  function noPrinter() {
    showError("Print", "No printer is installed.\n\nThere has never been a printer. The icon is decorative.", true);
  }

  /* ---------- the Explorer bar: Search / Favorites / History ---------- */
  let sideMode = null;
  function sidebar(mode) {
    const panel = els.side, body = els.sideBody, title = els.sideTitle;
    if (!panel) return;
    if (sideMode === mode || !mode) { sideMode = null; panel.style.display = "none"; syncBarBtns(); return; }
    sideMode = mode;
    panel.style.display = "flex";
    body.innerHTML = "";
    const item = (label, act, sub) => {
      const d = document.createElement("div");
      d.className = "ie-side-it";
      d.innerHTML = `<b></b><span class="dim"></span>`;
      d.querySelector("b").textContent = label;
      if (sub) d.querySelector("span").textContent = " " + sub;
      d.addEventListener("click", act);
      body.appendChild(d);
      return d;
    };
    if (mode === "favs") {
      title.textContent = "Favorites";
      const add = document.createElement("div");
      add.className = "ie-side-tools";
      add.innerHTML = `<a>Add...</a> <a>Organize...</a>`;
      add.children[0].addEventListener("click", addFavDialog);
      add.children[1].addEventListener("click", orgFavDialog);
      body.appendChild(add);
      for (const f of FAVS()) item(f.label, () => go(f.u));
    } else if (mode === "hist") {
      title.textContent = "History";
      const h = document.createElement("div");
      h.className = "ie-side-group"; h.textContent = "Today";
      body.appendChild(h);
      if (!HISTORY.length) item("(nothing yet)", () => {});
      for (const u of HISTORY.slice(0, 30)) item(u.replace(/^http:..(www.)?/, ""), () => go(u));
    } else if (mode === "search") {
      title.textContent = "Search";
      const box = document.createElement("div");
      box.className = "ie-side-tools";
      box.innerHTML = `<input type="text" style="width:100%" spellcheck="false" placeholder="Search the Web">`;
      const inp = box.querySelector("input");
      inp.addEventListener("keydown", e => {
        e.stopPropagation();
        if (e.key === "Enter") go("http://search.msn.com/results?q=" + encodeURIComponent(inp.value.trim()));
      });
      body.appendChild(box);
    }
    syncBarBtns();
  }
  function syncBarBtns() {
    els.search.classList.toggle("on", sideMode === "search");
    els.favs.classList.toggle("on", sideMode === "favs");
    els.hist.classList.toggle("on", sideMode === "hist");
  }

  /* ---------- Add to Favorites / Organize Favorites ---------- */
  function addFavDialog() {
    if (!url || url === "about:blank") return;
    els.afName.value = pageTitle || url;
    els.afUrl.textContent = url;
    hooks.openWin("win-addfav");
    setTimeout(() => { els.afName.focus(); els.afName.select(); }, 50);
  }
  function commitAddFav() {
    const label = els.afName.value.trim().slice(0, 40) || url;
    if (!FAVS().some(f => key(f.u) === key(url))) {
      FAVS().push({ label, u: url }); store.save();
    } else {
      FAVS().find(f => key(f.u) === key(url)).label = label; store.save();
    }
    hooks.closeWin("win-addfav");
    if (sideMode === "favs") { sideMode = null; sidebar("favs"); }
  }
  function orgFavDialog() {
    renderOrgFav();
    hooks.openWin("win-orgfav");
  }
  let orgSel = 0;
  function renderOrgFav() {
    const host = els.ofList; host.innerHTML = "";
    FAVS().forEach((f, i) => {
      const d = document.createElement("div");
      d.className = "ie-side-it" + (i === orgSel ? " on" : "");
      d.innerHTML = "<b></b>";
      d.querySelector("b").textContent = f.label;
      d.addEventListener("click", () => { orgSel = i; renderOrgFav(); });
      d.addEventListener("dblclick", () => { hooks.closeWin("win-orgfav"); go(f.u); });
      host.appendChild(d);
    });
    const f = FAVS()[orgSel];
    els.ofInfo.textContent = f ? f.u : "";
  }
  function orgFavAction(what) {
    const favs = FAVS();
    const f = favs[orgSel];
    if (!f) return;
    if (what === "delete") { favs.splice(orgSel, 1); orgSel = Math.max(0, orgSel - 1); }
    if (what === "rename") {
      els.afName.value = f.label; els.afUrl.textContent = f.u;
      hooks.openWin("win-addfav");
      els.afName.dataset.renaming = orgSel;
      setTimeout(() => { els.afName.focus(); els.afName.select(); }, 50);
      return;
    }
    if (what === "up" && orgSel > 0) { favs.splice(orgSel - 1, 0, favs.splice(orgSel, 1)[0]); orgSel--; }
    if (what === "down" && orgSel < favs.length - 1) { favs.splice(orgSel + 1, 0, favs.splice(orgSel, 1)[0]); orgSel++; }
    store.save(); renderOrgFav();
    if (sideMode === "favs") { sideMode = null; sidebar("favs"); }
  }

  /* ---------- Internet Options: the seven tabs ---------- */
  /* the Advanced tree is the real list, and two of its switches actually do
     something: Show pictures, and Show friendly HTTP error messages */
  const ADVANCED = [
    ["Accessibility", ["Always expand ALT text for images", "Move system caret with focus/selection changes"]],
    ["Browsing", ["Close unused folders in History and Favorites", "Disable script debugging",
      "Display a notification about every script error", "Enable folder view for FTP sites",
      "Enable Install On Demand (Internet Explorer)", "Enable Install On Demand (Other)",
      "Enable offline items to be synchronized on a schedule", "Enable page transitions",
      "Enable Personalized Favorites Menu", "Enable third-party browser extensions",
      "Enable visual styles on buttons and controls in web pages", "Notify when downloads complete",
      "Reuse windows for launching shortcuts", "Show friendly HTTP error messages*",
      "Show friendly URLs", "Show Go button in Address bar", "Underline links: Always",
      "Use inline AutoComplete", "Use Passive FTP", "Use smooth scrolling"]],
    ["HTTP 1.1 settings", ["Use HTTP 1.1", "Use HTTP 1.1 through proxy connections"]],
    ["Microsoft VM", ["Java console enabled (requires restart)", "Java logging enabled",
      "JIT compiler for virtual machine enabled (requires restart)"]],
    ["Multimedia", ["Don't display online media content in the media bar", "Enable Automatic Image Resizing",
      "Enable Image Toolbar (requires restart)", "Play animations in web pages",
      "Play sounds in web pages", "Play videos in web pages", "Show image download placeholders",
      "Show pictures*", "Smart image dithering"]],
    ["Printing", ["Print background colors and images"]],
    ["Search from the Address bar", ["Display results, and go to the most likely site"]],
    ["Security", ["Check for publisher's certificate revocation", "Check for server certificate revocation (requires restart)",
      "Check for signatures on downloaded programs", "Do not save encrypted pages to disk",
      "Empty Temporary Internet Files folder when browser is closed",
      "Enable Integrated Windows Authentication (requires restart)", "Enable Profile Assistant",
      "Use SSL 2.0", "Use SSL 3.0", "Use TLS 1.0", "Warn about invalid site certificates",
      "Warn if changing between secure and not secure mode", "Warn if forms submittal is being redirected"]],
  ];
  function advDefaults() {
    if (!store.data.ieAdv) {
      store.data.ieAdv = {};
      for (const [, items] of ADVANCED) for (const it of items)
        store.data.ieAdv[it] = !/Java logging|Do not save|Empty Temporary|Use SSL 2.0|Print background|caret|ALT text|media bar/.test(it);
      store.save();
    }
    return store.data.ieAdv;
  }
  function inetOptions() {
    const adv = advDefaults();
    els.ioHome.value = store.data.ieHome || HOME;
    els.ioCache.textContent = "Current location: C:\\Documents and Settings\\Administrator\\Local Settings\\Temporary Internet Files\\  Amount of disk space to use: 596 MB  (" +
      Math.round((store.data.ieCacheKB || 0)) + " KB in use)";
    const host = els.ioAdv; host.innerHTML = "";
    for (const [group, items] of ADVANCED) {
      const g = document.createElement("div");
      g.className = "io-advgroup";
      g.textContent = group;
      host.appendChild(g);
      for (const it of items) {
        const row = document.createElement("label");
        row.className = "io-advrow";
        const cb = document.createElement("input"); cb.type = "checkbox";
        cb.checked = !!adv[it];
        cb.addEventListener("change", () => { adv[it] = cb.checked; store.save(); applyAdvanced(); });
        row.appendChild(cb);
        row.appendChild(document.createTextNode(it.replace(/\*$/, "")));
        host.appendChild(row);
      }
    }
    hooks.openWin("win-inetopts");
  }
  function applyAdvanced() {
    const adv = advDefaults();
    els.page.classList.toggle("noimg", !adv["Show pictures*"]);
  }
  function homeUrl() { return store.data.ieHome || HOME; }

  /* ---------- chrome ---------- */
  els.back.addEventListener("click", () => {
    if (!past.length) return;
    future.push(url); const u = past.pop();
    sysSnd("nav", .4); go(u, { replace: true });
  });
  els.fwd.addEventListener("click", () => {
    if (!future.length) return;
    past.push(url); const u = future.pop();
    sysSnd("nav", .4); go(u, { replace: true });
  });
  els.stop.addEventListener("click", stop);
  els.refresh.addEventListener("click", () => go(url || homeUrl(), { replace: true }));
  els.home.addEventListener("click", () => go(homeUrl()));
  /* the three panel buttons toggle the Explorer bar, exactly like IE6 */
  els.search.addEventListener("click", () => sidebar("search"));
  els.favs.addEventListener("click", () => sidebar("favs"));
  els.hist.addEventListener("click", () => sidebar("hist"));
  els.media.addEventListener("click", () => hooks.openWin("win-amp"));
  els.mail.addEventListener("click", () => hooks.openLobby());
  els.print.addEventListener("click", noPrinter);
  els.go.addEventListener("click", () => go(els.addr.value));
  /* Add to Favorites / Organize Favorites / Internet Options wiring */
  if (els.afOk) {
    els.afOk.addEventListener("click", () => {
      const ren = els.afName.dataset.renaming;
      if (ren !== undefined && ren !== "") {
        FAVS()[+ren].label = els.afName.value.trim().slice(0, 40) || FAVS()[+ren].label;
        delete els.afName.dataset.renaming;
        store.save(); hooks.closeWin("win-addfav"); renderOrgFav();
        return;
      }
      commitAddFav();
    });
    els.afCancel.addEventListener("click", () => { delete els.afName.dataset.renaming; hooks.closeWin("win-addfav"); });
    els.ofRename.addEventListener("click", () => orgFavAction("rename"));
    els.ofDelete.addEventListener("click", () => orgFavAction("delete"));
    els.ofUp.addEventListener("click", () => orgFavAction("up"));
    els.ofDown.addEventListener("click", () => orgFavAction("down"));
    els.ofClose.addEventListener("click", () => hooks.closeWin("win-orgfav"));
    els.ioOk.addEventListener("click", () => {
      store.data.ieHome = els.ioHome.value.trim() || HOME; store.save();
      hooks.closeWin("win-inetopts");
    });
    els.ioCancel.addEventListener("click", () => hooks.closeWin("win-inetopts"));
    els.ioUseCur.addEventListener("click", () => { els.ioHome.value = url || HOME; });
    els.ioUseDef.addEventListener("click", () => { els.ioHome.value = HOME; });
    els.ioUseBlank.addEventListener("click", () => { els.ioHome.value = "about:blank"; });
    els.ioDelCookies.addEventListener("click", () => showError("Delete Cookies",
      "Delete all cookies in the Temporary Internet Files folder?\n\nDone. Both of them.", true));
    els.ioDelFiles.addEventListener("click", () => {
      store.data.ieCacheKB = 0; store.save();
      els.ioCache.textContent = els.ioCache.textContent.replace(/\(\d+ KB in use\)/, "(0 KB in use)");
    });
    els.ioClearHist.addEventListener("click", () => {
      HISTORY.length = 0;
      if (sideMode === "hist") { sideMode = null; sidebar("hist"); }
      syncAutocomplete();
    });
    els.ioCerts.addEventListener("click", () => hooks.openWin("win-cert"));
    els.ioDialSet.addEventListener("click", () => els.dlSettings.click());
    els.sideX.addEventListener("click", () => sidebar(null));
  }
  els.addr.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Enter") go(els.addr.value);
  });
  els.addr.addEventListener("focus", () => els.addr.select());
  els.links.querySelectorAll("[data-go]").forEach(a =>
    a.addEventListener("click", () => go(a.dataset.go)));
  els.dlConnect.addEventListener("click", connect);
  els.dlOffline.addEventListener("click", cancelDial);
  els.dlSettings.addEventListener("click", () => showError("cursor$net Settings",
    "Modem: Standard 56000 bps Modem\nPhone number: " + PHONE + "\nRedial attempts: 10\n\nThere are no other settings. There was never any point to this button.", true));
  els.dgCancel.addEventListener("click", cancelDial);

  buttons(); progress(null); status("Done");

  /* openWin calls this on the way in: an empty browser dials out by itself */
  function boot() { if (!url && !loading) go(homeUrl()); }
  function open() { hooks.openWin("win-ie"); }

  return {
    open, boot, go, menu, stop, hangup,
    theater: setTheater,
    isTheater: () => theater,
    url: () => url,
    isOnline: () => online,
    /* dev: skip the handshake and be on the wire already */
    connectNow: () => { online = true; offline = false; hooks.setNet(true); },
  };
}
