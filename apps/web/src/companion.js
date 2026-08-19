export function initCompanion(deps) {
  const { $, store, sysSnd, openWin, closeWin, AGENT_PNG, AGENT_DEF } = deps;

  const CAST = [
    { id: "rover", name: "Rover", blurb: "The yellow dog from Windows XP's Search Companion. The default, and the reason anyone remembers this feature." },
    { id: "merlin", name: "Merlin", blurb: "A wizard. Was the default in Windows 98 and never got over the demotion." },
    { id: "clippy", name: "Clippy", blurb: "It looks like you are trying to lose money. Would you like help?" },
    { id: "links", name: "Links", blurb: "A cat. Sits on the thing you are trying to read." },
    { id: "genie", name: "Genie", blurb: "Grants wishes at a rate of one in N for a wish worth N. Same as everything else here." },
    { id: "bonzi", name: "BonziBUDDY", blurb: "A purple gorilla that asked for your details in 1999. Ships here as a museum piece — he does nothing but talk." },
  ];

  const MOODS = {
    idle: ["RestPose", "Idle", "Blink", "Alert", "Greet"],
    hunting: ["Searching", "Search", "Thinking", "Processing", "Process", "Read", "GetTechy", "Wave"],
    found: ["Congratulate", "Pleased", "CharacterSucceeds", "GetAttention", "Cheer", "Wave", "Greet"],
    empty: ["Embarrassed", "Sad", "GetAttentionMinor", "DontRecognize", "Confused", "RestPose"],
    hello: ["Greet", "Show", "Wave", "Alert", "RestPose"],
  };

  const url = id => AGENT_PNG["./assets/xp/agent/" + id + ".png"];
  const defs = {};
  const loading = {};
  function load(id) {
    if (defs[id]) return Promise.resolve(defs[id]);
    if (loading[id]) return loading[id];
    const imp = AGENT_DEF["./assets/xp/agent/" + id + ".json"];
    if (!imp) return Promise.resolve(null);
    loading[id] = imp().then(m => (defs[id] = m.default || m));
    return loading[id];
  }

  const pick = () => (CAST.some(c => c.id === store.data.companion) ? store.data.companion : "rover");
  const named = id => CAST.find(c => c.id === id) || CAST[0];

  const live = new Set();
  function node(id, cls) {
    const who = id || pick();
    const box = document.createElement("span");
    box.className = "cmp" + (cls ? " " + cls : "");
    box.dataset.who = who;
    const sheet = document.createElement("i");
    sheet.className = "cmp-sheet";
    box.appendChild(sheet);
    box._sheet = sheet;
    box._mood = "idle";
    live.add(box);
    mount(box, who);
    return box;
  }
  function mount(box, who) {
    const sheet = box._sheet;
    sheet.style.backgroundImage = `url(${url(who)})`;
    load(who).then(def => {
      if (!def || box.dataset.who !== who) return;
      box._def = def;
      const [fw, fh] = def.framesize;
      sheet.style.width = fw + "px";
      sheet.style.height = fh + "px";
      const fit = () => {
        const r = box.getBoundingClientRect();
        const k = Math.min((r.width || 78) / fw, (r.height || 78) / fh);
        sheet.style.transform = `translate(-50%,-50%) scale(${k})`;
      };
      fit();
      play(box, box._mood);
    });
  }

  function anim(def, mood) {
    for (const want of MOODS[mood] || MOODS.idle) if (def.animations[want]) return def.animations[want];
    const keys = Object.keys(def.animations);
    return def.animations[keys[0]];
  }
  function play(box, mood) {
    box._mood = mood;
    const def = box._def;
    if (!def) return;
    clearTimeout(box._t);
    const a = anim(def, mood);
    if (!a || !a.frames.length) return;
    let i = 0;
    const step = () => {
      if (!box.isConnected) { live.delete(box); return; }
      const f = a.frames[i];
      if (f && f.i) box._sheet.style.backgroundPosition = `-${f.i[0]}px -${f.i[1]}px`;
      let next = i + 1;
      if (f && f.b) {
        let roll = Math.random() * 100;
        for (const [to, w] of f.b) { if (roll < w) { next = to; break; } roll -= w; }
      }
      i = next;
      if (i >= a.frames.length) {
        if (box._mood === "idle") { i = 0; box._t = setTimeout(step, 1200 + Math.random() * 2600); return; }
        i = a.frames.length - 1;
        box._t = setTimeout(() => play(box, "idle"), 900);
        return;
      }
      box._t = setTimeout(step, Math.max(40, (f && f.d) || 100));
    };
    step();
  }

  function setMood(box, mood) { if (box) play(box, mood); }
  function swap(box, id) {
    if (!box) return;
    clearTimeout(box._t);
    box.dataset.who = id;
    box._def = null;
    mount(box, id);
  }

  let onPicked = null;
  function chooser(after) {
    onPicked = after || null;
    const host = $("#cmp-pick");
    host.innerHTML = "";
    let chosen = pick();
    for (const c of CAST) {
      const cell = document.createElement("div");
      cell.className = "cmp-cell" + (c.id === chosen ? " on" : "");
      const n = node(c.id, "big");
      cell.appendChild(n);
      const nm = document.createElement("div");
      nm.className = "cmp-nm";
      nm.textContent = c.name;
      cell.appendChild(nm);
      cell.addEventListener("click", () => {
        chosen = c.id;
        [...host.children].forEach(x => x.classList.toggle("on", x === cell));
        $("#cmp-blurb").textContent = c.blurb;
        setMood(n, "hello");
        sysSnd("nav", .35);
      });
      cell.addEventListener("dblclick", () => commit(chosen));
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
    for (const box of live) if (box.isConnected && !box.closest("#cmp-pick")) swap(box, id);
    if (onPicked) onPicked(id);
  }

  return { node, setMood, swap, chooser, current: pick, cast: () => CAST, name: id => named(id).name };
}
