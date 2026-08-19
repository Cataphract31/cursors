export const EMOMAP = {
  ":)": "smile", ":-)": "smile", ":(": "sad-smile", ":-(": "sad-smile",
  ";)": "winking-smile", ";-)": "winking-smile",
  ":D": "open-mouthed-smile", ":-D": "open-mouthed-smile", ":d": "open-mouthed-smile",
  ":P": "smile-with-tongue-out", ":-P": "smile-with-tongue-out", ":p": "smile-with-tongue-out",
  ":O": "surprised-smile", ":-O": "surprised-smile", ":o": "surprised-smile",
  ":S": "confused-smile", ":s": "confused-smile",
  ":|": "disappointed-smile", ":-|": "disappointed-smile",
  ":$": "embarrassed-smile", ":-$": "embarrassed-smile",
  ":@": "angry-smile", ":-@": "angry-smile",
  ":'(": "crying-face", "+o(": "sick-smile", "^o)": "sarcastic-smile",
  ":^)": "thinking-smile", "*-)": "thinking-smile",
  ":-#": "dont-tell-anyone-smile", ":-*": "secret-telling-smile",
  "8o|": "baring-teeth-smile", "8-|": "nerd-smile", "8-)": "eye-rolling-smile",
  "|-)": "sleepy-smile", "<:o)": "party-smile", ":-\\": "i-dont-know-smile", ":\\": "i-dont-know-smile",
  "(H)": "hot-smile", "(h)": "hot-smile",
  "(A)": "angel", "(a)": "angel", "(6)": "devil",
  "(L)": "red-heart", "(l)": "red-heart", "(U)": "broken-heart", "(u)": "broken-heart",
  "(K)": "red-lips", "(k)": "red-lips", "(F)": "red-rose", "(f)": "red-rose", "(W)": "wilted-rose", "(w)": "wilted-rose",
  "(D)": "martini-glass", "(d)": "martini-glass", "(C)": "coffee-cup", "(c)": "coffee-cup",
  "(B)": "beer-mug", "(b)": "beer-mug", "(P)": "camera", "(p)": "camera",
  "(T)": "telephone-receiver", "(t)": "telephone-receiver",
  "(@)": "cat-face", "(&)": "dog-face", "(S)": "sleeping-half-moon",
  "(*)": "star", "(~)": "filmstrip", "(8)": "note", "(E)": "e-mail", "(e)": "e-mail",
  "(I)": "light-bulb", "(i)": "light-bulb", "(Y)": "thumbs-up", "(y)": "thumbs-up",
  "(N)": "thumbs-down", "(n)": "thumbs-down", "(X)": "girl", "(Z)": "boy",
  "({)": "left-hug", "(})": "right-hug", "(M)": "messenger", "(m)": "messenger",
  "(O)": "clock", "(o)": "clock", "(G)": "gift-with-a-bow", "(g)": "gift-with-a-bow",
  "(^)": "birthday-cake", "($)": "money", "(co)": "computer", "(mp)": "mobile-phone",
  "(au)": "auto", "(ap)": "airplane", "(um)": "umbrella", "(ip)": "island-with-a-palm-tree",
  "(so)": "soccer-ball", "(pi)": "pizza", "(pl)": "plate", "(||)": "bowl",
  "(sn)": "snail", "(tu)": "turtle", "(bah)": "black-sheep", "(nah)": "goat",
  "(bat)": "vampire-bat", "(li)": "lightning", "(st)": "storm-cloud", "(#)": "sun",
  "(R)": "rainbow", "(h5)": "high-five", "(brb)": "be-right-back", "(bunny)": "bunny",
};

const PICKER = [
  ":)", ":D", ";)", ":O", ":P", "(H)", ":@", ":S", ":$", ":(",
  ":'(", "|-)", "8o|", "8-)", ":-#", "^o)", "+o(", "<:o)", "(A)", "(6)",
  "(L)", "(U)", "(K)", "(F)", "(W)", "(@)", "(&)", "(S)", "(*)", "(~)",
  "(8)", "(E)", "(I)", "(Y)", "(N)", "(C)", "(B)", "(D)", "(pi)", "(so)",
  "({)", "(})", "($)", "(co)", "(mp)", "(au)", "(ap)", "(um)", "(bat)", "(li)",
];

export const CONTACTS = [
  { id: "mumu",    name: "mumu",    dp: "cat-face",     psm: "in the arena",                    group: "Degens" },
  { id: "bobo",    name: "bobo",    dp: "devil",        psm: "down bad but not out",            group: "Degens" },
  { id: "bonk",    name: "bonk",    dp: "thumbs-down",  psm: "one more round",                  group: "Degens" },
  { id: "solja",   name: "solja",   dp: "soccer-ball",  psm: "wagmi",                           group: "Degens" },
  { id: "xp_chad", name: "xp_chad", dp: "hot-smile",    psm: "640x480 enjoyer",                 group: "Degens" },
  { id: "clippy",  name: "clippy",  dp: "light-bulb",   psm: "it looks like you're losing money", group: "Bots" },
  { id: "deg404",  name: "deg404",  dp: "nerd-smile",   psm: "personal message not found",      group: "Bots" },
];

const STATUS = {
  online: "Online", away: "Away", busy: "Busy",
  brb: "Be Right Back", phone: "On The Phone", lunch: "Out To Lunch",
  offline: "Offline", invisible: "Appear Offline",
};

const REPLIES = {
  mumu:    ["gm", "you deploying or watching", "i'm up 0.4 today (Y)", "that last round was rigged (i'm joking) (A)", "brb one more cursor"],
  bobo:    ["down bad :(", "lend me 0.1", "i only lose on purpose", "the house always wins but so do i sometimes", "(6) one more"],
  bonk:    ["ez", "skill issue", "i banked at x2 like a coward (H)", "cry about it", "nice"],
  solja:   ["wagmi", "we are so back", "chart looks good bro", "trust the process (L)", "deploying 5"],
  xp_chad: ["this desktop is peak", "luna theme or nothing", "i miss dial up", "sp2 changed me", "bliss enjoyer (#)"],
  clippy:  ["It looks like you're trying to lose money. Would you like help?", "Tip: banking is allowed.", "I have detected conviction. Continuing.", "Would you like me to format your losses?", "It looks like you're writing a will. (I)"],
  deg404:  ["404", "message not found", "have you tried turning it off and on again", "i exist only during shutdown", "(co) beep"],
};

const LOBBY_LINES = {};

export function initMessenger(deps) {
  const {
    EMO, IMG, $, store, sysSnd, playerName, wireWindow,
    openWin, closeWin, isOpen, showMenu, showError, desk, rnd,
    lobbyNet,
    dmNet,
    netLive,
  } = deps;
  const quiet = () => !!(netLive && netLive());

  const pick = a => a[Math.floor(Math.random() * a.length)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const LOBBY = { id: "lobby", name: "everyone", dp: "messenger", group: null };
  const isUser = id => typeof id === "string" && id.slice(0, 2) === "u:";
  const userName = id => id.slice(2);
  const byId = id => id === "lobby" ? LOBBY
    : isUser(id) ? { id, name: userName(id), psm: "real person", human: 1 }
    : CONTACTS.find(c => c.id === id);

  const state = {};
  for (const c of CONTACTS) state[c.id] = "online";
  let myStatus = "online";
  const convs = {};
  let lastNudge = 0, lastLobbyAt = 0;

  const KEYS = Object.keys(EMOMAP).sort((a, b) => b.length - a.length);
  function emoNodes(text, into) {
    let i = 0, buf = "";
    const flush = () => { if (buf) { into.appendChild(document.createTextNode(buf)); buf = ""; } };
    outer: while (i < text.length) {
      for (const k of KEYS) {
        if (text.startsWith(k, i)) {
          const url = EMO[EMOMAP[k]];
          if (url) {
            flush();
            const img = document.createElement("img");
            img.className = "emo"; img.src = url; img.alt = k; img.title = k;
            into.appendChild(img);
            i += k.length;
            continue outer;
          }
        }
      }
      buf += text[i++];
    }
    flush();
  }

  function convId(id) {
    return "win-conv-" + String(id).replace(/[^A-Za-z0-9_]/g, c => "-" + c.charCodeAt(0).toString(36));
  }

  function buildConv(c) {
    const id = convId(c.id);
    const el = document.createElement("div");
    el.className = "window msn-conv";
    el.id = id;
    el.dataset.minw = "300"; el.dataset.minh = "260";
    const n = Object.keys(convs).length;
    el.style.left = (150 + n * 26) + "px";
    el.style.top = (90 + n * 24) + "px";
    el.style.width = "420px"; el.style.height = "340px";
    el.innerHTML = `
      <div class="title-bar">
        <div class="tb-l"><img class="tb-ico" src="${IMG.msn16}" alt=""><div class="title-bar-text"></div></div>
        <div class="title-bar-controls"><button aria-label="Minimize"></button><button aria-label="Close"></button></div>
      </div>
      <div class="win-body pad conv-body">
        <div class="menubar"><span>File</span><span>Edit</span><span>Actions</span><span>Tools</span><span>Help</span></div>
        <div class="conv-to">
          <img class="conv-toico" src="${IMG.msn16}" alt="">
          <div class="conv-totext">To: <b></b> &lt;<span class="conv-mail"></span>&gt;</div>
        </div>
        <div class="conv-mid">
          <div class="conv-left">
            <div class="conv-msgs"></div>
            <div class="conv-status"></div>
            <div class="conv-tools">
              <button class="xbtn conv-emo" title="Select an emoticon">☺</button>
              <button class="xbtn conv-nudge" title="Send a nudge">Nudge</button>
              <button class="xbtn conv-file" title="Send a file">Send a File</button>
            </div>
            <div class="conv-input">
              <textarea rows="2" spellcheck="false" placeholder=""></textarea>
              <button class="xbtn conv-send">Send</button>
            </div>
          </div>
          <div class="conv-right">
            <div class="conv-dpbox"><img class="conv-dp them" alt=""></div>
            <div class="conv-dpbox"><img class="conv-dp me" alt=""></div>
          </div>
        </div>
      </div>`;
    desk.appendChild(el);

    el.querySelector(".title-bar-text").textContent = c.name + " - Conversation";
    el.querySelector(".conv-totext b").textContent = c.name;
    el.querySelector(".conv-mail").textContent = c.id === "lobby" ? "everyone@cursor.land" : c.id + "@hotmail.com";
    el.querySelector(".conv-dp.them").src = EMO[c.dp] || IMG.msn16;
    el.querySelector(".conv-dp.me").src = IMG.user48;

    const rec = {
      el,
      msgs: el.querySelector(".conv-msgs"),
      statusEl: el.querySelector(".conv-status"),
      input: el.querySelector("textarea"),
      lastFrom: null,
      typingT: 0,
    };
    convs[c.id] = rec;

    const send = () => {
      const t = rec.input.value.trim();
      if (!t) return;
      rec.input.value = "";
      if (c.id === "lobby" && lobbyNet && lobbyNet(t)) return;
      if (c.human) {
        say(c.id, playerName(), t, true);
        if (!(dmNet && dmNet(c.name, t))) sys(c.id, "Not connected — that message was not sent.");
        return;
      }
      say(c.id, playerName(), t, true);
      if (quiet()) { botSilence(c.id); return; }
      if (c.id === "lobby") { if (Math.random() < .55) scheduleLobbyReply(); }
      else scheduleReply(c.id, t);
    };
    el.querySelector(".conv-send").addEventListener("click", send);
    rec.input.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    el.querySelector(".conv-nudge").addEventListener("click", () => nudge(c.id));
    el.querySelector(".conv-file").addEventListener("click", () =>
      showError("Send a File", "There is nothing on this computer worth sending.\nThe cursors are load-bearing.", true));
    el.querySelector(".conv-emo").addEventListener("click", e => {
      e.stopPropagation();
      openPicker(el.querySelector(".conv-emo"), rec.input);
    });

    wireWindow(el);
    return rec;
  }

  function conv(id) { return convs[id] || buildConv(byId(id)); }

  function openConv(id) {
    conv(id);
    openWin(convId(id));
    const rec = convs[id];
    rec.msgs.scrollTop = rec.msgs.scrollHeight;
    setTimeout(() => { try { rec.input.focus(); } catch (e) {} }, 0);
  }

  function stamp(rec, who, mine) {
    if (rec.lastFrom === who) return;
    rec.lastFrom = who;
    const d = document.createElement("div");
    d.className = "cv-who" + (mine ? " me" : "");
    d.textContent = who + " says:";
    rec.msgs.appendChild(d);
  }
  function say(id, who, text, mine, quiet) {
    const rec = conv(id);
    stamp(rec, who, mine);
    const d = document.createElement("div");
    d.className = "cv-txt";
    emoNodes(text, d);
    rec.msgs.appendChild(d);
    trim(rec);
    rec.msgs.scrollTop = rec.msgs.scrollHeight;
    if (!mine && !quiet) {
      if (!isOpen(convId(id))) toast(byId(id), text, id);
      sysSnd("msnAlert", .4);
    }
  }
  function sys(id, text) {
    const rec = conv(id);
    rec.lastFrom = null;
    const d = document.createElement("div");
    d.className = "cv-sys";
    d.textContent = text;
    rec.msgs.appendChild(d);
    trim(rec);
    rec.msgs.scrollTop = rec.msgs.scrollHeight;
  }
  function trim(rec) { while (rec.msgs.children.length > 160) rec.msgs.firstChild.remove(); }

  function typing(id, who, ms) {
    const rec = conv(id);
    rec.statusEl.textContent = who + " is typing a message...";
    clearTimeout(rec.typingT);
    rec.typingT = setTimeout(() => { rec.statusEl.textContent = ""; }, ms);
  }

  function scheduleReply(id, prompt) {
    const who = byId(id).name;
    const think = rand(700, 1800);
    setTimeout(() => typing(id, who, 2600), think * .4);
    setTimeout(() => {
      const pool = REPLIES[id] || LOBBY_LINES.idle;
      let line = pick(pool);
      if (/\?$/.test(prompt) && Math.random() < .5) line = pick(["idk", "probably", "ask clippy", "no (N)"]);
      conv(id).statusEl.textContent = "";
      say(id, who, line, false);
    }, think + rand(900, 1900));
  }
  const told = new Set();
  function botSilence(id) {
    if (id === "lobby" || told.has(id)) return;
    told.add(id);
    setTimeout(() => sys(id, byId(id).name + " is a bot — no replies."), 500);
  }
  function scheduleLobbyReply() {
    const c = pick(CONTACTS.filter(x => state[x.id] === "online"));
    if (!c) return;
    setTimeout(() => typing("lobby", c.name, 2200), 300);
    setTimeout(() => { conv("lobby").statusEl.textContent = ""; say("lobby", c.name, pick(REPLIES[c.id]), false); }, rand(1400, 2600));
  }

  function nudge(id) {
    const now = Date.now();
    if (now - lastNudge < 5000) return;
    lastNudge = now;
    sysSnd("msnNudge", .6);
    sys(id, "You have just sent a nudge.");
    shake(conv(id).el);
    if (id !== "lobby" && !isUser(id) && !quiet() && Math.random() < .5)
      setTimeout(() => { sys(id, byId(id).name + " has just sent a nudge."); shake(conv(id).el); sysSnd("msnNudge", .5); }, rand(1800, 3200));
  }
  function shake(el) { el.classList.remove("nudged"); void el.offsetWidth; el.classList.add("nudged"); }

  let picker = null;
  function openPicker(anchor, input) {
    closePicker();
    picker = document.createElement("div");
    picker.className = "emo-picker";
    for (const k of PICKER) {
      const url = EMO[EMOMAP[k]];
      if (!url) continue;
      const b = document.createElement("button");
      b.innerHTML = `<img src="${url}" alt="">`;
      b.title = k;
      b.addEventListener("click", () => {
        input.value += (input.value && !/\s$/.test(input.value) ? " " : "") + k + " ";
        closePicker();
        input.focus();
      });
      picker.appendChild(b);
    }
    document.body.appendChild(picker);
    const r = anchor.getBoundingClientRect();
    const pr = picker.getBoundingClientRect();
    picker.style.left = Math.max(4, Math.min(r.left, innerWidth - pr.width - 6)) + "px";
    picker.style.top = Math.max(4, r.top - pr.height - 4) + "px";
  }
  function closePicker() { if (picker) { picker.remove(); picker = null; } }
  addEventListener("pointerdown", e => {
    if (picker && !e.target.closest(".emo-picker,.conv-emo")) closePicker();
  }, true);

  const toasts = [];
  function reflowToasts() {
    const mob = document.body.classList.contains("mobile");
    let b = mob ? 104 : 40;
    for (const t of toasts) {
      t.style.bottom = mob ? `calc(${b}px + env(safe-area-inset-bottom,0px))` : b + "px";
      b += t.offsetHeight + 6;
    }
  }
  function toast(c, text, openId) {
    if (deps.toastsOn && !deps.toastsOn()) return;
    const balloon = document.getElementById("balloon");
    if (balloon) balloon.style.display = "none";
    const t = document.createElement("div");
    t.className = "msn-toast";
    t.innerHTML = `<div class="mt-head"><img src="${IMG.msn16}" alt=""><span></span><i class="mt-x">✕</i></div>
                   <div class="mt-body"><img class="mt-dp" src="${EMO[c.dp] || IMG.msn16}" alt=""><div class="mt-text"></div></div>`;
    t.querySelector(".mt-head span").textContent = c.name;
    emoNodes(text, t.querySelector(".mt-text"));
    document.body.appendChild(t);
    toasts.unshift(t);
    while (toasts.length > 4) kill(toasts[toasts.length - 1]);
    reflowToasts();
    requestAnimationFrame(() => t.classList.add("in"));
    function kill(target) {
      const el = target || t;
      const i = toasts.indexOf(el);
      if (i < 0) return;
      toasts.splice(i, 1);
      el.classList.remove("in");
      setTimeout(() => { el.remove(); reflowToasts(); }, 300);
      reflowToasts();
    }
    t.querySelector(".mt-x").addEventListener("click", e => { e.stopPropagation(); kill(); });
    t.addEventListener("click", () => { kill(); if (openId) openConv(openId); });
    setTimeout(() => kill(), 6000);
  }

  function statusClass(s) { return "st-" + s; }
  let humans = [];
  function setHumans(names) {
    humans = (names || []).filter(n => n !== playerName());
    renderList();
  }
  function renderList() {
    const host = $("#msn-list");
    if (!host) return;
    host.innerHTML = "";
    const online = CONTACTS.filter(c => state[c.id] !== "offline");
    const offline = CONTACTS.filter(c => state[c.id] === "offline");
    if (humans.length) {
      const g = document.createElement("div");
      g.className = "msn-group";
      const h = document.createElement("div");
      h.className = "msn-ghead";
      h.innerHTML = `<i class="tw">▾</i><span></span>`;
      h.querySelector("span").textContent = `Players in the arena (${humans.length})`;
      h.addEventListener("click", () => g.classList.toggle("closed"));
      g.appendChild(h);
      for (const n of humans) {
        const row = document.createElement("div");
        row.className = "msn-row on";
        row.innerHTML = `<img class="msn-st" src="${IMG.msn16}" alt=""><span class="msn-nm"></span><span class="msn-psm"> - real person</span>`;
        row.querySelector(".msn-nm").textContent = n;
        row.title = `${n} — in the arena right now`;
        row.addEventListener("dblclick", () => openConv("u:" + n));
        g.appendChild(row);
      }
      host.appendChild(g);
    }

    const groupEl = (title, list) => {
      const g = document.createElement("div");
      g.className = "msn-group";
      const h = document.createElement("div");
      h.className = "msn-ghead";
      h.innerHTML = `<i class="tw">▾</i><span></span>`;
      h.querySelector("span").textContent = `${title} (${list.length})`;
      h.addEventListener("click", () => g.classList.toggle("closed"));
      g.appendChild(h);
      for (const c of list) {
        const row = document.createElement("div");
        row.className = "msn-row " + statusClass(state[c.id]);
        row.innerHTML = `<img class="msn-st" src="${IMG.msn16}" alt=""><span class="msn-nm"></span><span class="msn-psm"></span>`;
        row.querySelector(".msn-nm").textContent = c.name;
        row.querySelector(".msn-psm").textContent = c.psm ? " - " + c.psm : "";
        row.title = `${c.name} (${STATUS[state[c.id]]})`;
        row.addEventListener("dblclick", () => openConv(c.id));
        g.appendChild(row);
      }
      return g;
    };
    host.appendChild(groupEl(humans.length ? "Bots" : "Online", online));
    host.appendChild(groupEl("Offline", offline));
  }

  function renderMe() {
    const n = $("#msn-myname"), d = $("#msn-mydp"), p = $("#msn-mypsm");
    if (n) n.textContent = `${playerName()} (${STATUS[myStatus]})`;
    if (d) d.src = IMG.user48;
    if (p) p.textContent = store.data.msnPsm || "<Type a personal message>";
  }

  function statusMenu(x, y) {
    showMenu(Object.keys(STATUS).filter(k => k !== "offline").map(k => ({
      label: STATUS[k], check: myStatus === k,
      action: () => { myStatus = k; renderMe(); },
    })), x, y);
  }

  function drift() {
    if (quiet()) return;
    const c = pick(CONTACTS);
    const was = state[c.id];
    const next = pick(["online", "online", "online", "away", "busy", "brb", "offline"]);
    if (next === was) return;
    state[c.id] = next;
    renderList();
    if (was === "offline" && next !== "offline") {
      sysSnd("msnOnline", .45);
      toast(c, "has just signed in.", c.id);
    }
  }

  function lobbySys(text) { sys("lobby", text); }
  function lobbySay(who, text) { say("lobby", who, text, who === playerName()); }
  function botChat(kind, vars) {
    return;
    const now = Date.now();
    if (now - lastLobbyAt < 2600 || Math.random() < .45) return;
    lastLobbyAt = now;
    const pool = LOBBY_LINES[kind];
    if (!pool) return;
    let t = pick(pool);
    if (vars) for (const k in vars) t = t.split("{" + k + "}").join(vars[k]);
    const c = pick(CONTACTS.filter(x => state[x.id] === "online")) || CONTACTS[0];
    setTimeout(() => say("lobby", c.name, t, false), rand(300, 1400));
  }

  const myRow = $("#msn-me");
  if (myRow) myRow.addEventListener("click", e => {
    const r = myRow.getBoundingClientRect();
    statusMenu(r.left + 30, r.bottom);
  });
  const psm = $("#msn-mypsm");
  if (psm) psm.addEventListener("dblclick", () => {
    const v = prompt("Personal message:", store.data.msnPsm || "");
    if (v != null) { store.data.msnPsm = v.slice(0, 60); store.save(); renderMe(); }
  });
  const lobbyBtn = $("#msn-lobby");
  if (lobbyBtn) lobbyBtn.addEventListener("click", () => openConv("lobby"));

  renderMe();
  renderList();
  setInterval(drift, 26000);

  function menus(label, winId) {
    if (label === "File") return [
      { label: "Sign Out", disabled: 1 },
      { sep: 1 },
      { label: "Close", action: () => closeWin(winId) },
    ];
    if (label === "Contacts") return [
      { label: "Add a Contact...", action: () => showError(".NET Messenger Service", "The service is temporarily unavailable. Please try again later.", true) },
      { sep: 1 },
      { label: "Sort Contacts By", disabled: 1 },
    ];
    if (label === "Actions") return [
      { label: "Send an Instant Message...", action: () => openConv("lobby") },
      { label: "Send a Nudge", action: () => nudge(winId && winId.indexOf("win-conv") === 0 ? convIdFromWin(winId) : "lobby") },
      { sep: 1 },
      { label: "Start a Video Conversation", disabled: 1 },
      { label: "Send a File or Photo...", disabled: 1 },
    ];
    if (label === "Tools") return [
      { label: "Change Personal Message...", action: () => {
        const v = prompt("Personal message:", store.data.msnPsm || "");
        if (v != null) { store.data.msnPsm = v.slice(0, 60); store.save(); renderMe(); }
      } },
      { sep: 1 },
      { label: "Options...", disabled: 1 },
    ];
    if (label === "Help") return [
      { label: "About Messenger", action: () => showError("About Messenger", "MSN Messenger\nVersion 7.0 (7.0.0813)", true) },
    ];
    return null;
  }
  function convIdFromWin(winId) {
    for (const id of Object.keys(convs)) if (convs[id].el && convs[id].el.id === winId) return id;
    return "lobby";
  }
  return {
    menus,
    openList: () => openWin("win-chat"),
    incoming: (id, text) => say(id, byId(id).name, text, false),
    place: (id, x, y) => { const r = conv(id); r.el.style.left = x + "px"; r.el.style.top = y + "px"; },
    openConv, lobbySys, lobbySay, botChat, setHumans,
    dmIn: (from, text) => say("u:" + from, from, text, false),
    lobbySeed: (who, text) => say("lobby", who, text, who === playerName(), true),
    dmSeed: (who, text, mine) => say("u:" + who, mine ? playerName() : who, text, mine, true),
    dmSys: (who, text) => { if (convs["u:" + who]) sys("u:" + who, text); },
    nudgeLobby: () => nudge("lobby"),
    renderList, renderMe,
    convIdFor: convId,
  };
}
