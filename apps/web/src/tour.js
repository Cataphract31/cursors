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
    { t: "The food chain", img: "ranks.png", pts: [
      "You only fight within <b>4×</b> your own size",
      "Cross <b>4× · 16× · 64×</b> and your arrow upgrades",
      "Out of range goes dim — it cannot touch you, you cannot touch it",
    ]},
    { t: "Bank it", img: "bank.png", pts: [
      "<b>RECALL</b> cashes your live cursors out",
      "<b>AUTOPLAY</b> redeploys and banks at ×2 · ×5 · ride",
      "Nothing counts until you bank",
    ]},
    { t: "Your five", img: "strip.png", pts: [
      "One slot per live cursor, with its ×",
      "<b>RECALL</b> banks all · a slot banks one",
      "You only fight within 4× your size",
    ]},
    { t: "The crash", img: "crash.png", pts: [
      "Every death fills C:",
      "Disk full → blue screen → epoch over",
      "The crash banks everyone in full",
    ]},
    { t: "The desktop", img: "desktop.png", pts: [
      "Everything opens. It's all real.",
      "<b>MSN</b> = the lobby, real players",
      "<b>Paint</b> → the gallery · <b>Hall of Fame</b> = the board",
    ]},
  ];

  let at = 0;

  function render() {
    const s = SLIDES[at];
    $("#tour-step").textContent = (at + 1) + " of " + SLIDES.length;
    $("#tour-title").textContent = s.t;
    const img = $("#tour-img");
    img.onerror = () => { img.style.visibility = "hidden"; };
    img.onload = () => { img.style.visibility = ""; };
    const set = document.body.classList.contains("mobile") ? "tour/m/" : "tour/";
    img.src = set + s.img;
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
    $('#win-tour .title-bar-controls button[aria-label="Close"]')
      .addEventListener("click", () => { store.data.tourSeen = 1; store.save(); });
    $("#tour-rail").addEventListener("click", e => {
      const i = [...$("#tour-rail").children].indexOf(e.target.closest(".tour-dot"));
      if (i >= 0) { at = i; render(); }
    });
  }

  return { init, open, seen: () => !!store.data.tourSeen };
}
