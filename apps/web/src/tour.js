/* How to Play — the intro card. Six slides, one screenshot each, bullets you
   can read while a fight is happening behind the window. The screenshots are
   real captures of this build, served from tour/ and loaded only when the
   window opens, so first paint never pays for them.
   Two sets, same file names: the desktop shell in tour/, the phone in tour/m/.
   A phone player's whole client is the thumb bar, so the desktop captures were
   teaching a machine most of the table never sees.
   Import-free like the other app modules; main.js injects the shell. */

export function initTour(deps) {
  const { $, store, openWin, closeWin, sysSnd } = deps;

  const SLIDES = [
    { t: "Deploy", img: "deploy.png", pts: [
      "<b>DEPLOY</b> — 0.1 SOL becomes a cursor",
      "It fights on its own. You don't steer.",
      "5 live at once, max",
    ]},
    { t: "The fight", img: "fight.png", pts: [
      "Two cursors collide → one dies",
      "Winner takes both bounties",
      "Odds = your SOL : theirs · no house edge in fights",
    ]},
    { t: "Bank it", img: "bank.png", pts: [
      "<b>RECALL</b> cashes your live cursors out",
      "<b>AUTOPLAY</b> redeploys and banks at ×2 · ×5 · ride",
      "Nothing counts until you bank",
    ]},
    { t: "Your five", img: "strip.png", pts: [
      "One slot per live cursor, with its ×",
      "<b>RECALL</b> banks all · a slot banks one",
      "<b>⚔ ATTACK</b> chases · <b>🛡 DEFEND</b> runs",
    ]},
    { t: "The crash", img: "crash.png", pts: [
      "Every death fills C:",
      "Disk full → blue screen → epoch over",
      "The crash banks everyone in full",
    ]},
    { t: "The desktop", img: "desktop.png", pts: [
      "Everything opens. It's all real.",
      "<b>IE</b> → cursorTV: the lobby watches one screen",
      "<b>MSN</b> = the lobby · <b>Paint</b> → the gallery",
      "<b>Rakeback tab</b>: 0.002 of every deploy pays the players",
    ]},
  ];

  let at = 0;

  function render() {
    const s = SLIDES[at];
    $("#tour-step").textContent = (at + 1) + " of " + SLIDES.length;
    $("#tour-title").textContent = s.t;
    const img = $("#tour-img");
    img.onerror = () => { img.style.visibility = "hidden"; };   /* a 404 shows nothing, not a broken glyph */
    img.onload = () => { img.style.visibility = ""; };
    /* the shell is chosen once at boot, so this is read per render rather than
       cached: the same window has to be right after a rotate or a reload */
    const set = document.body.classList.contains("mobile") ? "tour/m/" : "tour/";
    img.src = set + s.img;              /* lazy: only ever set while open */
    $("#tour-pts").innerHTML = s.pts.map(p => `<li>${p}</li>`).join("");
    $("#tour-rail").innerHTML = SLIDES.map((x, i) =>
      `<div class="tour-dot${i === at ? " on" : ""}"><i></i>${x.t}</div>`).join("");
    $("#tour-back").disabled = at === 0;
    $("#tour-next").textContent = at === SLIDES.length - 1 ? "Start playing" : "Next >";
  }

  function nav(d) {
    sysSnd("nav", .3);
    at += d;
    if (at >= SLIDES.length) { done(); return; }
    at = Math.max(0, at);
    render();
  }
  function done() {
    store.data.tourSeen = 1; store.save();
    /* nav() walked `at` one PAST the last slide to get here. Left there, the
       next opening rendered the final slide and Back only stepped from 5 to
       5 — a card that could not be read a second time. */
    at = 0;
    closeWin("win-tour");
  }
  function open(fromStart) {
    at = 0;
    render();
    openWin("win-tour", fromStart ? undefined : { silent: true });
  }

  function init() {
    $("#tour-back").addEventListener("click", () => nav(-1));
    $("#tour-next").addEventListener("click", () => nav(1));
    /* the X means "seen it" too — it must not come back on every boot */
    $('#win-tour .title-bar-controls button[aria-label="Close"]')
      .addEventListener("click", () => { store.data.tourSeen = 1; store.save(); });
    $("#tour-rail").addEventListener("click", e => {
      const i = [...$("#tour-rail").children].indexOf(e.target.closest(".tour-dot"));
      if (i >= 0) { at = i; render(); }
    });
  }

  return { init, open, seen: () => !!store.data.tourSeen };
}
