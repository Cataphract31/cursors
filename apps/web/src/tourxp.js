/* Tour Windows XP — tourstart.exe, the theater Windows put in front of you the
   first time you logged on in 2001: a chapter list down the left, a picture and
   four lines of product copy on the right, Bill Brown's score looping under it,
   and a "Play the tour" button that walked the chapters by itself.

   Two rules this file keeps. The copy is Microsoft's register, not ours — dry
   feature statements, no jokes, no mention of the game; it is set dressing, and
   set dressing that winks stops being set dressing. And the pictures are not
   drawn here: every chapter panel is composed out of assets this machine
   already ships — Bliss, the flag, the shell32 icons, the real arrow cursor —
   over CSS gradients, so the tour costs one mp3 and nothing else.

   The music is a program on this machine, so it goes through the mixer like
   one: setVol(bus) is the same arithmetic as wampApplyVol and tvApplyVol, and
   the speaker button in the tour's own chrome is the app's switch above it.

   Import-free like the other app modules; main.js injects the shell. Nothing
   here touches the DOM, a timer or an Audio until initTourXP is called. */

export function initTourXP(deps) {
  const { $, store, sysSnd, openWin, closeWin, isFocused, IMG, CURFILES, hooks } = deps;
  const H = hooks || {};

  const WIN = "win-tourxp";
  const MUSIC = "media/tourxp.mp3";   /* public/media — same relative shape as tour/*.png */
  const STEP = 12000;                 /* "Play the tour" holds each chapter ~12s */

  /* ---------- asset helpers: everything below composes, nothing draws ---------- */
  const curf = f => (CURFILES && CURFILES["./assets/xp/cursors/" + f]) || "";
  const im = (u, cls, alt) =>
    u ? `<img${cls ? ` class="${cls}"` : ""} src="${u}" alt="${alt || ""}" draggable="false">` : "";

  /* ---------- the seven chapters, in tourstart's order ---------- */
  const CH = [
    {
      t: "Windows XP Basics",
      ico: () => IMG.computer16,
      art: () => `
        <div class="txp-scene txp-desk" style="background-image:url(${IMG.bliss})">
          <div class="txp-icons">
            <span>${im(IMG.computer32)}<i>My Computer</i></span>
            <span>${im(IMG.docs32)}<i>My Documents</i></span>
            <span>${im(IMG.bin32)}<i>Recycle Bin</i></span>
          </div>
          ${im(curf("arrow_r.cur"), "txp-ptr")}
          <div class="txp-tbar">
            ${im(IMG.startBtn, "txp-start")}
            <span class="txp-tab">${im(IMG.folder16)}My Documents</span>
            <span class="txp-tray">${im(IMG.trayVol)}${im(IMG.connect16)}</span>
          </div>
        </div>`,
      pts: [
        "Windows XP starts faster and runs more reliably than any previous version of Windows.",
        "The Start menu puts the programs you use most often right at the top, so you spend less time looking for them.",
        "Every open program has a button on the taskbar. Click a button to switch; Windows groups similar windows to keep the taskbar tidy.",
        "Rest the pointer on any item and pause for a moment to see a description of what it does.",
      ],
    },
    {
      t: "What's New in Windows XP",
      ico: () => IMG.flag16,
      art: () => `
        <div class="txp-scene txp-luna">
          ${im(IMG.flag, "txp-flag")}
          <div class="txp-pane">
            <div class="txp-pane-h">Pick a task...</div>
            <div class="txp-pane-r">${im(IMG.user48)}<span>Switch users without closing your programs</span></div>
            <div class="txp-pane-r">${im(IMG.cpanel32)}<span>Change the computer's appearance and themes</span></div>
            <div class="txp-pane-r">${im(IMG.folder32)}<span>A task pane in every folder</span></div>
          </div>
        </div>`,
      pts: [
        "A fresh visual design puts the tasks you are most likely to want next in a pane beside every folder.",
        "Fast User Switching lets several people share one computer, each with their own desktop, without closing a single program.",
        "Windows XP is built on the same engine as Windows 2000, for the stability that businesses have relied on.",
        "Choose a theme, a background, and a screen saver, and the whole computer follows your taste.",
      ],
    },
    {
      t: "Getting Started",
      ico: () => IMG.help16,
      art: () => `
        <div class="txp-scene txp-help">
          <div class="txp-hbar">${im(IMG.help32)}<b>Help and Support Center</b></div>
          <div class="txp-hsearch"><span>Search</span><em></em>${im(IMG.search32, "txp-hgo")}</div>
          <div class="txp-hcols">
            <div>${im(IMG.note32)}<i>Pick a Help topic</i></div>
            <div>${im(IMG.connect32)}<i>Ask for assistance</i></div>
            <div>${im(IMG.sysfile32)}<i>Pick a task</i></div>
          </div>
        </div>`,
      pts: [
        "Help and Support Center gathers help topics, tutorials, and troubleshooters together in one place.",
        "One search looks through the help on your computer and the Microsoft Knowledge Base at the same time.",
        "With Remote Assistance, you can invite a friend to connect to your computer and show you what to do.",
        "If something goes wrong, System Restore returns the computer to an earlier time without touching your documents.",
      ],
    },
    {
      t: "Playing Music and Movies",
      ico: () => IMG.navMedia,
      art: () => `
        <div class="txp-scene txp-media">
          <div class="txp-eq">${Array.from({ length: 18 }, (_, i) =>
            `<i style="height:${18 + ((i * 37) % 62)}%"></i>`).join("")}</div>
          <div class="txp-mrow">${im(IMG.wmp32)}${im(IMG.cd32)}${im(IMG.music32)}</div>
          <div class="txp-mlist"><span>1. Track One</span><span>2. Track Two</span><span>3. Track Three</span></div>
        </div>`,
      pts: [
        "Windows Media Player plays CDs, digital music, video, and Internet radio in a single program.",
        "Copy the tracks from your CDs to your hard disk, then arrange them into playlists in any order you like.",
        "Burn your own custom audio CDs, or copy your music to a portable player.",
        "Skins and visualizations let the Player look the way you want it to.",
      ],
    },
    {
      t: "Digital Photography",
      ico: () => IMG.pics32,
      art: () => `
        <div class="txp-scene txp-photo">
          <div class="txp-strip">
            <span style="background-image:url(${IMG.bliss});background-position:12% 40%"></span>
            <span style="background-image:url(${IMG.bliss});background-position:50% 35%"></span>
            <span style="background-image:url(${IMG.bliss});background-position:88% 45%"></span>
          </div>
          <div class="txp-prow">${im(IMG.pics32)}<i>My Pictures</i>${im(IMG.printer32)}<i>Print</i></div>
        </div>`,
      pts: [
        "Connect a digital camera or a scanner and Windows XP recognizes it, usually without a disk.",
        "The Scanner and Camera Wizard copies your pictures into My Pictures in a few clicks.",
        "Filmstrip and Thumbnails views let you find the picture you want without opening any of them.",
        "Print photo-quality pages at home, or order prints over the Web from a photo service.",
      ],
    },
    {
      t: "Networking and the Web",
      ico: () => IMG.ie16,
      art: () => `
        <div class="txp-scene txp-net">
          <svg class="txp-wire" viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
            <path d="M150 26 L60 86 M150 26 L150 86 M150 26 L240 86" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>
          </svg>
          <div class="txp-hub">${im(IMG.connect32)}${im(IMG.earth16, "txp-globe")}</div>
          <div class="txp-nodes">${im(IMG.computer32)}${im(IMG.ie32)}${im(IMG.printer32)}</div>
        </div>`,
      pts: [
        "The Network Setup Wizard connects the computers in your home so they can share one Internet connection.",
        "Share files, folders, and a printer with everyone on the network in a few steps.",
        "Internet Explorer 6 browses faster, and gives you control over the cookies a Web site may store.",
        "Windows Messenger lets you send an instant message, place a call, or work in the same program together.",
      ],
    },
    {
      t: "Safety and Security",
      ico: () => IMG.trayRisk,
      art: () => `
        <div class="txp-scene txp-safe">
          <div class="txp-shield">${im(IMG.lock32)}</div>
          <div class="txp-slist">
            <div>${im(IMG.trayRisk)}<span>Internet Connection Firewall</span></div>
            <div>${im(IMG.user48)}<span>An account and a password for each person</span></div>
            <div>${im(IMG.sysfile32)}<span>Automatic Updates</span></div>
          </div>
        </div>`,
      pts: [
        "Internet Connection Firewall helps protect your computer from intruders while you are on the Internet.",
        "Give each person an account of their own, and keep your files private behind your own password.",
        "Automatic Updates collects important updates from Windows Update in the background, so the computer stays current.",
        "Lock the computer whenever you step away from it. Your programs keep running until you come back.",
      ],
    },
  ];

  let at = 0;               /* current chapter */
  let live = false;         /* the window is open — the shell asks before re-opening */
  let playing = false;      /* "Play the tour" is walking the chapters */
  let timer = 0;
  let audio = null;

  /* ---------- music ---------- */
  /* Same arithmetic as wampApplyVol and tvApplyVol: the mixer's Wave fader is
     the bus, Volume Control is the master over it, Mute is silence — with the
     tour's own speaker button as the app's switch above all three. */
  function setVol(bus) {
    if (!audio) return;
    const wave = bus != null ? bus : (H.waveBus ? H.waveBus() : 1);
    const master = H.getMaster ? H.getMaster() : 1;
    const off = (H.getMuted && H.getMuted()) || !!store.data.txpSpkOff;
    try { audio.volume = off ? 0 : Math.max(0, Math.min(1, master * wave)); } catch (e) {}
  }
  function music(on) {
    if (!on) {
      if (audio) { try { audio.pause(); audio.currentTime = 0; } catch (e) {} }
      return;
    }
    /* built on first open, never before: the score is a couple of megabytes and
       first paint must not pay for a window nobody has asked for yet */
    if (!audio) {
      try { audio = new Audio(MUSIC); audio.loop = true; } catch (e) { audio = null; return; }
    }
    setVol();
    try { const p = audio.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  function spkSync() {
    const b = $("#txp-spk");
    if (!b) return;
    b.classList.toggle("off", !!store.data.txpSpkOff);
    b.dataset.tip = store.data.txpSpkOff ? "Turn the tour music on" : "Turn the tour music off";
  }

  /* ---------- chapters ---------- */
  function render() {
    const c = CH[at];
    $("#txp-head").textContent = c.t;
    $("#txp-step").textContent = "Chapter " + (at + 1) + " of " + CH.length;
    $("#txp-art").innerHTML = c.art();
    $("#txp-pts").innerHTML = c.pts.map(p => `<li>${p}</li>`).join("");
    $("#txp-rail").innerHTML = CH.map((x, i) =>
      `<div class="txp-ch${i === at ? " on" : ""}">${im(x.ico(), "txp-chico")}<span>${x.t}</span></div>`).join("");
    $("#txp-back").disabled = at === 0;
    $("#txp-next").disabled = at === CH.length - 1;
  }
  function goto(i, quiet) {
    i = Math.max(0, Math.min(CH.length - 1, i));
    if (i === at) return;
    at = i;
    if (!quiet) sysSnd("nav", .3);
    render();
    if (playing) arm();
  }
  function nav(d) {
    if (at + d < 0) return;
    if (at + d >= CH.length) { play(false); return; }   /* the end of the tour stops the tour */
    goto(at + d);
  }

  /* ---------- "Play the tour" ---------- */
  function arm() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!playing || !live) return;
      if (at >= CH.length - 1) { play(false); return; }
      goto(at + 1, true);
    }, STEP);
  }
  function play(on) {
    playing = !!on;
    clearTimeout(timer);
    if (playing) {
      if (at >= CH.length - 1) { at = 0; render(); }   /* replay from the top */
      arm();
    }
    const b = $("#txp-play");
    if (b) b.textContent = playing ? "Pause" : "Play the tour";
  }

  /* ---------- lifecycle ---------- */
  function open() {
    at = 0;
    live = true;
    render();
    spkSync();
    play(false);
    openWin(WIN, { silent: true });
    music(true);
  }
  /* closeWin calls this: a hidden window that keeps making noise is a bug */
  function stop() {
    live = false;
    play(false);
    music(false);
  }

  function init() {
    $("#txp-back").addEventListener("click", () => nav(-1));
    $("#txp-next").addEventListener("click", () => nav(1));
    $("#txp-exit").addEventListener("click", () => closeWin(WIN));
    $("#txp-play").addEventListener("click", () => { sysSnd("nav", .3); play(!playing); });
    $("#txp-spk").addEventListener("click", () => {
      store.data.txpSpkOff = store.data.txpSpkOff ? 0 : 1;
      store.save();
      spkSync();
      setVol();
    });
    $("#txp-rail").addEventListener("click", e => {
      const row = e.target.closest(".txp-ch");
      if (!row) return;
      const i = [...$("#txp-rail").children].indexOf(row);
      if (i >= 0) { play(false); goto(i); }
    });
    /* the arrows walk the tour and Escape leaves it — but only when the tour is
       the focused window, or they would steal keys from every other program */
    addEventListener("keydown", e => {
      if (!live || !isFocused()) return;
      if (e.key === "ArrowRight") { e.preventDefault(); play(false); nav(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); play(false); nav(-1); }
      else if (e.key === "Escape") { e.preventDefault(); closeWin(WIN); }
    });
  }

  /* The real tour had no menu bar, so neither does this one. The hook exists so
     menubarMenu has an answer if a later build ever grows one. */
  function menus() { return null; }

  return { init, open, stop, setVol, menus, live: () => live };
}
