/* The Search Companion — Rover, and the three you could switch him for.

   The real characters are Microsoft Agent .acs assets and we do not ship
   copyrighted art, so these are drawn from scratch: a yellow dog sitting with
   a red collar, a wizard in a star robe, a girl with round glasses in a red
   pod, and a surfing thing with enormous eyes. Recognisable, not lifted.

   They animate in CSS rather than frames, so idle/searching/found/empty are
   four class names and the whole cast costs nothing to load. */
export function initCompanion(deps) {
  const { $, store, sysSnd, openWin, closeWin } = deps;

  const CAST = [
    { id: "rover", name: "Rover", blurb: "A yellow dog with a magnifying glass. The default, and the reason anyone remembers this feature." },
    { id: "merlin", name: "Merlin", blurb: "A wizard. Was the default in Windows 98 and never got over the demotion." },
    { id: "courtney", name: "Courtney", blurb: "Arrives in a red pod. Wears the glasses." },
    { id: "earl", name: "Earl", blurb: "Surfs. Nobody has ever explained Earl." },
  ];

  /* --- the art. one <svg> each, groups named so the CSS can move them --- */
  const ART = {
    rover: `
      <g class="cmp-body">
        <ellipse class="cmp-tail" cx="74" cy="80" rx="4" ry="12" fill="#F0B429" stroke="#B07D0A" stroke-width="1.5"/>
        <path d="M28 92 q-4 4 2 5 h12 q5 -1 1 -5 z" fill="#F5C445" stroke="#B07D0A" stroke-width="1.5"/>
        <path d="M52 92 q-4 4 2 5 h12 q5 -1 1 -5 z" fill="#F5C445" stroke="#B07D0A" stroke-width="1.5"/>
        <path d="M30 92 q-6 -30 8 -40 q14 -9 26 2 q10 9 6 38 z" fill="#F5C445" stroke="#B07D0A" stroke-width="1.8"/>
        <ellipse cx="48" cy="72" rx="14" ry="10" fill="#FBE0A0"/>
        <path d="M30 62 h36" stroke="#C1392B" stroke-width="5" stroke-linecap="round"/>
        <circle cx="48" cy="66" r="3" fill="#E8B23A" stroke="#8A5C00" stroke-width="1"/>
        <g class="cmp-head">
          <ellipse cx="48" cy="40" rx="21" ry="18" fill="#F5C445" stroke="#B07D0A" stroke-width="1.8"/>
          <path class="cmp-ear l" d="M30 30 q-12 2 -11 18 q1 14 11 12 q-6 -16 0 -30 z" fill="#E8A81E" stroke="#B07D0A" stroke-width="1.6"/>
          <path class="cmp-ear r" d="M66 30 q12 2 11 18 q-1 14 -11 12 q6 -16 0 -30 z" fill="#E8A81E" stroke="#B07D0A" stroke-width="1.6"/>
          <ellipse cx="48" cy="49" rx="11" ry="8" fill="#FBE0A0"/>
          <ellipse class="cmp-eye" cx="41" cy="36" rx="4" ry="4.4" fill="#1A1A1A"/>
          <ellipse class="cmp-eye" cx="55" cy="36" rx="4" ry="4.4" fill="#1A1A1A"/>
          <circle cx="42.4" cy="34.6" r="1.3" fill="#fff"/>
          <circle cx="56.4" cy="34.6" r="1.3" fill="#fff"/>
          <ellipse cx="48" cy="46" rx="4.6" ry="3.4" fill="#1A1A1A"/>
          <path d="M48 49 v3 M48 52 q-4 3 -7 0 M48 52 q4 3 7 0" fill="none" stroke="#8A5C00" stroke-width="1.4" stroke-linecap="round"/>
        </g>
      </g>
      <g class="cmp-glass"><circle cx="80" cy="58" r="11" fill="rgba(190,225,255,.5)" stroke="#7A8798" stroke-width="2.5"/>
        <path d="M88 66 l7 8" stroke="#7A8798" stroke-width="4" stroke-linecap="round"/></g>`,

    merlin: `
      <g class="cmp-body">
        <path d="M28 98 q0 -40 20 -46 q20 6 20 46 z" fill="#3C4EA8" stroke="#22306E" stroke-width="1.8"/>
        <g fill="#F2CE3C">
          <path d="M36 70 l1.6 3.6 4 .4 -3 2.7 .9 3.9 -3.5 -2.1 -3.5 2.1 .9 -3.9 -3 -2.7 4 -.4 z"/>
          <path d="M58 82 l1.6 3.6 4 .4 -3 2.7 .9 3.9 -3.5 -2.1 -3.5 2.1 .9 -3.9 -3 -2.7 4 -.4 z"/>
          <path d="M44 90 a5 5 0 1 0 5 -5 a4 4 0 1 1 -5 5 z"/>
        </g>
        <path d="M40 56 q8 34 16 0 q-4 40 -8 40 q-4 0 -8 -40 z" fill="#E8E8E8" stroke="#B8B8B8" stroke-width="1.2"/>
        <g class="cmp-head">
          <ellipse cx="48" cy="44" rx="14" ry="13" fill="#F3C9A6" stroke="#C79A72" stroke-width="1.4"/>
          <path d="M34 40 q14 -34 28 0 q-14 -10 -28 0 z" fill="#3C4EA8" stroke="#22306E" stroke-width="1.6"/>
          <path d="M48 6 q3 20 14 34 q-14 -8 -28 0 q11 -14 14 -34 z" fill="#3C4EA8" stroke="#22306E" stroke-width="1.6"/>
          <path d="M46 14 l1.4 3.2 3.6 .3 -2.7 2.4 .8 3.5 -3.1 -1.9 -3.1 1.9 .8 -3.5 -2.7 -2.4 3.6 -.3 z" fill="#F2CE3C"/>
          <ellipse class="cmp-eye" cx="43" cy="44" rx="2.4" ry="2.8" fill="#1A1A1A"/>
          <ellipse class="cmp-eye" cx="53" cy="44" rx="2.4" ry="2.8" fill="#1A1A1A"/>
          <path d="M38 39 q5 -3 9 1 M58 39 q-5 -3 -9 1" fill="none" stroke="#C8C8C8" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M36 52 q12 30 24 0 q-12 8 -24 0 z" fill="#E8E8E8" stroke="#B8B8B8" stroke-width="1.2"/>
        </g>
      </g>`,

    courtney: `
      <g class="cmp-body">
        <ellipse cx="50" cy="80" rx="34" ry="15" fill="#D3392B" stroke="#8E1F14" stroke-width="1.8"/>
        <path d="M16 80 q34 -16 68 0" fill="none" stroke="#F07A6C" stroke-width="2"/>
        <circle cx="30" cy="92" r="6" fill="#E8E8E8" stroke="#8E1F14" stroke-width="1.5"/>
        <circle cx="70" cy="92" r="6" fill="#E8E8E8" stroke="#8E1F14" stroke-width="1.5"/>
        <path d="M78 74 h14 q3 2 0 4 h-14 z" fill="#D3392B" stroke="#8E1F14" stroke-width="1.4"/>
        <g class="cmp-head">
          <path d="M34 68 q4 -14 16 -14 q12 0 16 14 z" fill="#3FB2C9" stroke="#256E7E" stroke-width="1.5"/>
          <ellipse cx="50" cy="44" rx="15" ry="14" fill="#F7D2B0" stroke="#C79A72" stroke-width="1.4"/>
          <path d="M34 42 q2 -22 16 -22 q14 0 16 22 q-6 -12 -16 -12 q-10 0 -16 12 z" fill="#F27DB4" stroke="#C2437E" stroke-width="1.5"/>
          <path d="M36 26 q6 -10 14 -6 M64 26 q-6 -10 -14 -6" fill="none" stroke="#F9A8CE" stroke-width="2.6" stroke-linecap="round"/>
          <circle cx="43" cy="45" r="7.5" fill="rgba(255,255,255,.85)" stroke="#2A2A2A" stroke-width="2.4"/>
          <circle cx="59" cy="45" r="7.5" fill="rgba(255,255,255,.85)" stroke="#2A2A2A" stroke-width="2.4"/>
          <path d="M50.5 45 h1" stroke="#2A2A2A" stroke-width="2.4"/>
          <ellipse class="cmp-eye" cx="43" cy="45" rx="2.6" ry="3" fill="#1A1A1A"/>
          <ellipse class="cmp-eye" cx="59" cy="45" rx="2.6" ry="3" fill="#1A1A1A"/>
          <path d="M46 55 q4 4 8 0" fill="none" stroke="#B5615C" stroke-width="1.6" stroke-linecap="round"/>
        </g>
      </g>`,

    earl: `
      <g class="cmp-body">
        <path d="M14 94 q36 -12 72 0 q-36 10 -72 0 z" fill="#B489E0" stroke="#7A55A8" stroke-width="1.6"/>
        <path d="M24 92 q26 -8 52 0" fill="none" stroke="#E7D3FA" stroke-width="2"/>
        <path d="M40 88 v-8 M60 88 v-8" stroke="#3A9AD9" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M34 62 h32 v20 h-32 z" fill="#F2CE3C"/>
        <path d="M34 66 h32 M34 72 h32 M34 78 h32" stroke="#E2604A" stroke-width="3.4"/>
        <path d="M34 62 h32 v20 h-32 z" fill="none" stroke="#9A7A12" stroke-width="1.5"/>
        <path d="M34 64 q-16 4 -18 16 M66 64 q16 4 18 16" fill="none" stroke="#F2CE3C" stroke-width="4" stroke-linecap="round"/>
        <g class="cmp-head">
          <ellipse cx="50" cy="42" rx="26" ry="19" fill="#F5D960" stroke="#9A7A12" stroke-width="1.8"/>
          <path d="M24 44 q26 22 52 0 q-26 10 -52 0 z" fill="#E9C63F" stroke="#9A7A12" stroke-width="1.4"/>
          <circle cx="40" cy="34" r="9" fill="#fff" stroke="#9A7A12" stroke-width="1.6"/>
          <circle cx="60" cy="34" r="9" fill="#fff" stroke="#9A7A12" stroke-width="1.6"/>
          <ellipse class="cmp-eye" cx="41" cy="35" rx="3.6" ry="4" fill="#1A1A1A"/>
          <ellipse class="cmp-eye" cx="59" cy="35" rx="3.6" ry="4" fill="#1A1A1A"/>
          <path d="M28 24 q8 -8 14 -2 M72 24 q-8 -8 -14 -2" fill="none" stroke="#9A7A12" stroke-width="2" stroke-linecap="round"/>
          <path d="M42 50 q8 6 16 0" fill="none" stroke="#9A7A12" stroke-width="1.8" stroke-linecap="round"/>
        </g>
      </g>`,
  };

  const pick = () => store.data.companion || "rover";
  const named = id => CAST.find(c => c.id === id) || CAST[0];

  /* a companion node: <span class="cmp cmp-rover idle"><svg .../></span> */
  function node(id, cls) {
    const who = id || pick();
    const box = document.createElement("span");
    box.className = "cmp cmp-" + who + " idle" + (cls ? " " + cls : "");
    box.dataset.who = who;
    box.innerHTML = `<svg viewBox="0 0 100 100">${ART[who] || ART.rover}</svg>`;
    return box;
  }
  function setMood(box, mood) {
    if (!box) return;
    box.className = box.className.replace(/\b(idle|hunting|found|empty)\b/g, "").trim() + " " + mood;
  }
  function swap(box, id) {
    if (!box) return;
    box.className = "cmp cmp-" + id + " idle";
    box.dataset.who = id;
    box.innerHTML = `<svg viewBox="0 0 100 100">${ART[id] || ART.rover}</svg>`;
  }

  /* --- "choose your companion" — the dialog everyone remembers --- */
  let onPicked = null;
  function chooser(after) {
    onPicked = after || null;
    const host = $("#cmp-pick");
    host.innerHTML = "";
    let chosen = pick();
    for (const c of CAST) {
      const cell = document.createElement("div");
      cell.className = "cmp-cell" + (c.id === chosen ? " on" : "");
      cell.appendChild(node(c.id, "big"));
      const nm = document.createElement("div");
      nm.className = "cmp-nm";
      nm.textContent = c.name;
      cell.appendChild(nm);
      cell.title = c.blurb;
      cell.addEventListener("click", () => {
        chosen = c.id;
        [...host.children].forEach(x => x.classList.toggle("on", x === cell));
        $("#cmp-blurb").textContent = c.blurb;
        sysSnd("nav", .35);
      });
      cell.addEventListener("dblclick", () => { commit(chosen); });
      host.appendChild(cell);
    }
    $("#cmp-blurb").textContent = named(chosen).blurb;
    $("#cmp-ok").onclick = () => commit(chosen);
    $("#cmp-cancel").onclick = () => closeWin("win-companion");
    openWin("win-companion");
  }
  function commit(id) {
    store.data.companion = id;
    store.save();
    closeWin("win-companion");
    sysSnd("hwin", .4);
    for (const box of document.querySelectorAll(".cmp")) if (!box.closest("#cmp-pick")) swap(box, id);
    if (onPicked) onPicked(id);
  }

  return { node, setMood, swap, chooser, current: pick, cast: () => CAST, name: id => named(id).name };
}
