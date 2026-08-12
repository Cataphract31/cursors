/* The noise apps: Volume Control (sndvol32), Sound Recorder, Windows Media
   Player 9. Import-free sibling module, same shape as writeapps.js.

   The mixer is real routing, not a prop: Volume Control is the tray master,
   Wave scales every game sound, CD Audio scales the music players. Sound
   Recorder records the actual microphone (locally — nothing leaves the
   machine) and its Effects menu does real DSP on the buffer. WMP9 plays the
   same MacLeod tracks Winamp does, with an analyser driving the bars. */

export function initSoundApps(deps) {
  const { $, store, sysSnd, showMenu, showError, openWin, closeWin, hooks } = deps;

  /* ---------- shared mixer state ---------- */
  const COLS = [
    ["master", "Volume Control"],
    ["wave", "Wave"],
    ["synth", "SW Synth"],
    ["cd", "CD Audio"],
    ["line", "Line In"],
  ];
  function mix() {
    store.data.mixer = store.data.mixer || {};
    for (const [k] of COLS) store.data.mixer[k] = store.data.mixer[k] || { v: 100, m: 0, b: 50 };
    return store.data.mixer;
  }
  const factor = k => { const c = mix()[k]; return c.m ? 0 : c.v / 100; };
  function applyMix() {
    if (sr && sr.gain) { try { sr.gain.gain.value = hooks.getMuted() ? 0 : hooks.getMaster() * factor("wave"); } catch (e) {} } try { wmpVol(); } catch (e) {} try { ampVol(); } catch (e) {} try { tvVol(); } catch (e) {} try { tourVol(); } catch (e) {} }
  /* Winamp is a program on this machine, so it goes through the mixer like
     one: its own slider is the app's volume, Wave is its bus, and Volume
     Control is the master over both. */
  function ampVol() { if (hooks.ampVolume) hooks.ampVolume(factor("wave")); }
  function tvVol() { if (hooks.tvVolume) hooks.tvVolume(factor("wave")); }
  function tourVol() { if (hooks.tourVolume) hooks.tourVolume(factor("wave")); }

  /* ================= sndvol32 ================= */
  function volRender() {
    const m = mix();
    const host = $("#sv32-cols"); host.innerHTML = "";
    for (const [k, label] of COLS) {
      const col = document.createElement("div");
      col.className = "sv32-col";
      col.innerHTML =
        `<div class="sv32-name">${label}</div>` +
        `<div class="sv32-brow">Balance:<br><input type="range" class="sv32-bal" min="0" max="100" value="${m[k].b}"></div>` +
        `<div class="sv32-vrow"><span>Volume:</span><input type="range" class="sv32-vol" min="0" max="100" value="${k === "master" ? Math.round(hooks.getMaster() * 100) : m[k].v}"></div>` +
        `<label class="sv32-mute"><input type="checkbox" class="sv32-m"${(k === "master" ? hooks.getMuted() : m[k].m) ? " checked" : ""}> Mute${k === "master" ? " all" : ""}</label>` +
        (k === "master" && store.data.mixAdv ? `<button class="xbtn sv32-adv">Advanced</button>` : "");
      const vs = col.querySelector(".sv32-vol"), mc = col.querySelector(".sv32-m"),
            bs = col.querySelector(".sv32-bal");
      vertDrag(vs);
      vs.addEventListener("input", () => {
        if (k === "master") hooks.setMaster(vs.value / 100);
        else { m[k].v = +vs.value; store.save(); applyMix(); }
      });
      mc.addEventListener("change", () => {
        if (k === "master") hooks.setMuted(mc.checked);
        else { m[k].m = mc.checked ? 1 : 0; store.save(); applyMix(); }
        if (k === "wave" && !mc.checked) sysSnd("ding", .5);   /* proof of life */
      });
      bs.addEventListener("input", () => { m[k].b = +bs.value; store.save(); });
      const adv = col.querySelector(".sv32-adv");
      if (adv) adv.addEventListener("click", svAdvOpen);
      host.appendChild(col);
    }
  }
  /* Native vertical <input type=range> only reacts to clicks in some
     engines. Owning the pointer makes the thumb ride the drag like the
     real sndvol32 knob did. */
  let dragging = null;
  function vertDrag(inp) {
    inp.addEventListener("pointerdown", e => {
      e.preventDefault();
      inp.setPointerCapture(e.pointerId);
      dragging = inp;
      const set = ev => {
        const r = inp.getBoundingClientRect();
        const f = 1 - (ev.clientY - r.top) / r.height;
        const v = Math.round(Math.max(0, Math.min(1, f)) * 100);
        if (+inp.value !== v) { inp.value = v; inp.dispatchEvent(new Event("input", { bubbles: false })); }
      };
      set(e);
      const mv = ev => set(ev);
      const up = () => { dragging = null; inp.removeEventListener("pointermove", mv); inp.removeEventListener("pointerup", up); inp.removeEventListener("pointercancel", up); };
      inp.addEventListener("pointermove", mv);
      inp.addEventListener("pointerup", up);
      inp.addEventListener("pointercancel", up);
    });
  }
  function openMixer() { volRender(); openWin("win-sndvol"); }
  function mixerMenu(which, x, y) {
    const M = {
      Options: [
        { label: "Properties", action: () => showError("Properties", "Mixer device: cursor$ AC'97 Audio\n\nPlayback controls: Volume Control, Wave, SW Synth, CD Audio, Line In.", true) },
        { label: "Advanced Controls", check: !!store.data.mixAdv,
          action: () => { store.data.mixAdv = store.data.mixAdv ? 0 : 1; store.save(); volRender(); } },
        { sep: 1 },
        { label: "Exit", action: () => closeWin("win-sndvol") },
      ],
      Help: [{ label: "About Volume Control", action: () => showError("About Volume Control", "Volume Control\nVersion 5.1", true) }],
    };
    showMenu(M[which] || [], x, y);
  }
  /* Advanced Controls — bass and treble, remembered and cosmetic, which is
     what they were on most AC'97 drivers */
  function svAdvOpen() {
    const b = $("#sv-bass"), t = $("#sv-treble");
    if (!b || !t) return;
    b.value = store.data.mixBass ?? 50;
    t.value = store.data.mixTreble ?? 50;
    openWin("win-svadv");
  }
  const svB = $("#sv-bass"), svT = $("#sv-treble"), svOk = $("#svadv-ok");
  if (svB) svB.addEventListener("input", () => { store.data.mixBass = +svB.value; store.save(); });
  if (svT) svT.addEventListener("input", () => { store.data.mixTreble = +svT.value; store.save(); });
  if (svOk) svOk.addEventListener("click", () => closeWin("win-svadv"));

  /* ================= Sound Recorder ================= */
  const sr = { ac: null, buf: null, playing: null, recording: null, chunks: [], stream: null, pos: 0, raf: 0, analyser: null };
  const scope = () => $("#sr-scope");
  function srAC() { if (!sr.ac) sr.ac = new (window.AudioContext || window.webkitAudioContext)(); return sr.ac; }
  function srLabel() {
    $("#sr-pos").textContent = sr.pos.toFixed(2) + " sec.";
    $("#sr-len").textContent = (sr.buf ? sr.buf.duration : 0).toFixed(2) + " sec.";
    const sl = $("#sr-slider");
    sl.max = sr.buf ? Math.ceil(sr.buf.duration * 100) : 0;
    sl.value = Math.round(sr.pos * 100);
  }
  /* the green oscilloscope: a flat line at rest, the analyser when live */
  function srDrawFlat() {
    const cv = scope(), g = cv.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = "#0c0"; g.beginPath();
    g.moveTo(0, cv.height / 2); g.lineTo(cv.width, cv.height / 2); g.stroke();
  }
  function srDrawLive() {
    const cv = scope(), g = cv.getContext("2d");
    const data = new Uint8Array(sr.analyser.frequencyBinCount);
    const loop = () => {
      if (!sr.analyser) return;
      sr.analyser.getByteTimeDomainData(data);
      g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height);
      g.strokeStyle = "#0c0"; g.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = i / data.length * cv.width, y = data[i] / 255 * cv.height;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      sr.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(sr.raf); loop();
  }
  function srStopAll() {
    if (sr.playing) { try { sr.playing.stop(); } catch (e) {} sr.playing = null; }
    if (sr.recording) { try { sr.recording.stop(); } catch (e) {} }
    if (sr.stream) { sr.stream.getTracks().forEach(t => t.stop()); sr.stream = null; }
    if (sr.analyser) { sr.analyser = null; cancelAnimationFrame(sr.raf); }
    srDrawFlat(); srLabel();
  }
  async function srRecord() {
    /* two quick clicks = two getUserMedia awaits = an orphaned hot mic */
    if (sr.pending) return;
    srStopAll();
    sr.pending = true;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) {
      sr.pending = false;
      showError("Sound Recorder", "Another program is using the recording device, or no recording device is installed.");
      return;
    }
    sr.pending = false;
    if (sr.recording || sr.stream) { stream.getTracks().forEach(t => t.stop()); return; }
    sr.stream = stream; sr.chunks = [];
    const ac = srAC();
    const src = ac.createMediaStreamSource(stream);
    sr.analyser = ac.createAnalyser(); sr.analyser.fftSize = 512;
    src.connect(sr.analyser);          /* scope only — the mic is never routed to the speakers */
    srDrawLive();
    const rec = new MediaRecorder(stream);
    sr.recording = rec;
    rec.ondataavailable = e => sr.chunks.push(e.data);
    rec.onstop = async () => {
      sr.recording = null;
      try {
        const ab = await new Blob(sr.chunks).arrayBuffer();
        sr.buf = await srAC().decodeAudioData(ab);
        sr.pos = 0;
      } catch (e) {}
      srStopAll();
    };
    rec.start();
    /* the real one recorded 60 seconds at a time */
    setTimeout(() => { if (sr.recording === rec) rec.stop(); }, 60000);
    srLabel();
  }
  function srPlay() {
    if (!sr.buf || sr.playing) return;
    const ac = srAC();
    const node = ac.createBufferSource();
    node.buffer = sr.buf;
    sr.analyser = ac.createAnalyser(); sr.analyser.fftSize = 512;
    const gain = ac.createGain();
    gain.gain.value = hooks.getMuted() ? 0 : hooks.getMaster() * factor("wave");
    sr.gain = gain;   /* applyMix re-aims this while the clip plays */
    node.connect(sr.analyser); sr.analyser.connect(gain); gain.connect(ac.destination);
    const from = Math.min(sr.pos, sr.buf.duration);
    const t0 = ac.currentTime - from;
    node.start(0, from);
    sr.playing = node;
    srDrawLive();
    const tick = setInterval(() => {
      if (!sr.playing) { clearInterval(tick); return; }
      sr.pos = Math.min(sr.buf.duration, ac.currentTime - t0);
      srLabel();
    }, 60);
    node.onended = () => { sr.playing = null; sr.gain = null; sr.pos = 0; srStopAll(); };
  }
  /* Effects — real DSP on the buffer, exactly what the menu claims */
  function srMap(fn, lenScale) {
    if (!sr.buf) return;
    const ac = srAC(), old = sr.buf;
    const nu = ac.createBuffer(old.numberOfChannels, Math.ceil(old.length * (lenScale || 1)), old.sampleRate);
    for (let c = 0; c < old.numberOfChannels; c++) fn(old.getChannelData(c), nu.getChannelData(c), old.sampleRate);
    sr.buf = nu; sr.pos = 0; srLabel();
  }
  const srEcho = () => srMap((a, b, rate) => {
    const d = Math.round(rate * .18);
    for (let i = 0; i < b.length; i++) b[i] = (a[i] || 0) + (i >= d ? a[i - d] * .45 : 0);
  });
  const srReverse = () => srMap((a, b) => { for (let i = 0; i < b.length; i++) b[i] = a[a.length - 1 - i]; });
  const srSpeed = f => srMap((a, b) => {
    for (let i = 0; i < b.length; i++) b[i] = a[Math.min(a.length - 1, Math.round(i * f))] || 0;
  }, 1 / f);
  function srSave() {
    if (!sr.buf) { showError("Sound Recorder", "There is no sound to save."); return; }
    hooks.saveWav(sr.buf);
  }
  function recorderMenu(which, x, y) {
    const M = {
      File: [
        { label: "New", action: () => { srStopAll(); sr.buf = null; sr.pos = 0; srLabel(); } },
        { label: "Save As...", action: srSave },
        { sep: 1 },
        { label: "Exit", action: () => { srStopAll(); closeWin("win-sndrec"); } },
      ],
      Edit: [{ label: "Audio Properties", action: openMixer }],
      Effects: [
        { label: "Increase Speed (by 100%)", disabled: !sr.buf, action: () => srSpeed(2) },
        { label: "Decrease Speed", disabled: !sr.buf, action: () => srSpeed(.5) },
        { sep: 1 },
        { label: "Add Echo", disabled: !sr.buf, action: srEcho },
        { label: "Reverse", disabled: !sr.buf, action: srReverse },
      ],
      Help: [{ label: "About Sound Recorder", action: () => showError("About Sound Recorder", "Sound Recorder\nVersion 5.1\n\nRecordings stay on this machine.", true) }],
    };
    showMenu(M[which] || [], x, y);
  }
  function openRecorder() { srDrawFlat(); srLabel(); openWin("win-sndrec"); }
  $("#sr-play").addEventListener("click", srPlay);
  $("#sr-stop").addEventListener("click", srStopAll);
  $("#sr-rec").addEventListener("click", srRecord);
  $("#sr-home").addEventListener("click", () => { sr.pos = 0; srLabel(); });
  $("#sr-end").addEventListener("click", () => { if (sr.buf) sr.pos = sr.buf.duration; srLabel(); });
  $("#sr-slider").addEventListener("input", () => { sr.pos = $("#sr-slider").value / 100; srLabel(); });

  /* ================= WMP 9 ================= */
  const wmp = { audio: null, i: 0, tracks: [], ac: null, analyser: null, raf: 0, srcNode: null };
  function wmpAudio() {
    if (!wmp.audio) {
      wmp.audio = new Audio();
      wmp.audio.addEventListener("ended", () => wmpPlay(wmp.i + 1));
      wmp.audio.addEventListener("timeupdate", () => {
        const a = wmp.audio;
        $("#wmp-seek").value = a.duration ? Math.round(a.currentTime / a.duration * 1000) : 0;
        $("#wmp-time").textContent = clock(a.currentTime) + " / " + clock(a.duration || 0);
      });
    }
    return wmp.audio;
  }
  /* Media Player plays clips too. The <video> is a second element rather than a
     mode of the first: an <audio> cannot show a picture, and the analyser is
     permanently wired to the audio element once created, so a clip has to keep
     its own audio path. Only one of the two is ever unpaused. */
  function wmpVideo() {
    if (!wmp.video) {
      wmp.video = $("#wmp-video");
      wmp.video.addEventListener("ended", () => wmpPlay(wmp.i + 1));
      wmp.video.addEventListener("timeupdate", () => {
        const v = wmp.video;
        $("#wmp-seek").value = v.duration ? Math.round(v.currentTime / v.duration * 1000) : 0;
        $("#wmp-time").textContent = clock(v.currentTime) + " / " + clock(v.duration || 0);
      });
    }
    return wmp.video;
  }
  /* whichever element the current item is using */
  const wmpEl = () => (wmp.isVideo ? wmpVideo() : wmpAudio());
  const clock = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  function wmpVol() {
    const vol = Math.min(1, ($("#wmp-vol").value / 100) * hooks.getMaster() * factor("cd"));
    const mute = hooks.getMuted() || !!mix().cd.m;
    /* both elements, always: the fader must mean the same thing to a clip */
    for (const el of [wmpAudio(), wmp.video]) if (el) { el.volume = vol; el.muted = mute; }
  }
  function wmpPlay(i) {
    const t = wmp.tracks[(i + wmp.tracks.length) % wmp.tracks.length];
    wmp.i = (i + wmp.tracks.length) % wmp.tracks.length;
    /* stop whatever was playing before the mode flips, or a clip and a track
       end up playing over each other */
    try { wmpAudio().pause(); } catch (e) {}
    if (wmp.video) { try { wmp.video.pause(); } catch (e) {} }
    wmp.isVideo = !!t.video;
    $("#win-wmp").classList.toggle("playing-video", wmp.isVideo);
    const a = wmpEl();
    a.src = t.url; wmpVol();
    a.play().catch(() => {});
    $("#wmp-title").textContent = (t.artist ? t.artist + " — " : "") + t.title;
    $$0(".wmp-row.on") && $$0(".wmp-row.on").classList.remove("on");
    const row = $("#wmp-list").children[wmp.i]; if (row) row.classList.add("on");
    /* the bars read the analyser on the audio element; a clip is its own picture */
    if (!wmp.isVideo) wmpViz(); else cancelAnimationFrame(wmp.raf);
  }
  const $$0 = sel => document.querySelector(sel);
  function wmpViz() {
    /* bars off an analyser — Ambience will not be missed */
    if (!wmp.ac) {
      wmp.ac = new (window.AudioContext || window.webkitAudioContext)();
      wmp.srcNode = wmp.ac.createMediaElementSource(wmpAudio());
      wmp.analyser = wmp.ac.createAnalyser(); wmp.analyser.fftSize = 64;
      wmp.srcNode.connect(wmp.analyser); wmp.analyser.connect(wmp.ac.destination);
    }
    if (wmp.ac.state === "suspended") wmp.ac.resume();
    const cv = $("#wmp-viz"), g = cv.getContext("2d");
    const data = new Uint8Array(wmp.analyser.frequencyBinCount);
    cancelAnimationFrame(wmp.raf);
    const loop = () => {
      /* the loop re-armed itself forever: Stop left a 60fps canvas drawing a
         flat line and minting 24 gradients a frame for the rest of the
         session, which on a phone nothing ever came along to cancel */
      const a = wmpAudio();
      if (!a || a.paused || a.ended) { wmp.raf = 0; return; }
      wmp.analyser.getByteFrequencyData(data);
      g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height);
      const n = 24, bw = cv.width / n;
      for (let i = 0; i < n; i++) {
        const v = data[i + 2] / 255;
        const grd = g.createLinearGradient(0, cv.height, 0, cv.height * (1 - v));
        grd.addColorStop(0, "#1a6fd4"); grd.addColorStop(1, "#8fd0ff");
        g.fillStyle = grd;
        g.fillRect(i * bw + 1, cv.height * (1 - v), bw - 2, cv.height * v);
      }
      wmp.raf = requestAnimationFrame(loop);
    };
    loop();
  }
  function openWmp() {
    if (!wmp.tracks.length) {
      /* clips sit under the music, marked, the way Media Player has always
         mixed a library rather than keeping two of them */
      wmp.tracks = [...hooks.tracks(), ...(hooks.videos ? hooks.videos() : [])];
      const host = $("#wmp-list"); host.innerHTML = "";
      wmp.tracks.forEach((t, i) => {
        const r = document.createElement("div");
        r.className = "wmp-row" + (t.video ? " vid" : "");
        r.textContent = (i + 1) + ". " + t.title + (t.video ? "  (video)" : "");
        r.addEventListener("dblclick", () => wmpPlay(i));
        host.appendChild(r);
      });
    }
    openWin("win-wmp");
  }
  /* open Media Player already playing one thing — how a file opens an app */
  function playMedia(item) {
    openWmp();
    const i = wmp.tracks.findIndex(t => t.url === item.url);
    if (i >= 0) wmpPlay(i);
  }
  $("#wmp-playbtn").addEventListener("click", () => {
    const a = wmpEl();
    if (a.src && !a.paused) { a.pause(); return; }
    if (a.src) { wmpVol(); a.play().catch(() => {}); if (!wmp.isVideo) wmpViz(); return; }
    wmpPlay(0);
  });
  $("#wmp-stop").addEventListener("click", () => { const a = wmpEl(); a.pause(); a.currentTime = 0; });
  $("#wmp-prev").addEventListener("click", () => wmpPlay(wmp.i - 1));
  $("#wmp-next").addEventListener("click", () => wmpPlay(wmp.i + 1));
  $("#wmp-seek").addEventListener("input", () => {
    const a = wmpEl();
    if (a.duration) a.currentTime = $("#wmp-seek").value / 1000 * a.duration;
  });
  $("#wmp-vol").addEventListener("input", wmpVol);

  return {
    openMixer, openRecorder, openWmp, playMedia,
    mixerMenu, recorderMenu,
    stopWmp(){ try{
      for (const el of [wmp.audio, wmp.video]) if (el) { el.pause(); el.currentTime = 0; }
      cancelAnimationFrame(wmp.raf);
    }catch(e){} },
    stopRecorder(){ srStopAll(); },
    factor,                       /* wave/cd scaling for the shell's own sounds */
    /* Winamp's bus. Webamp re-applies its own gain on every state change, and
       it changes state on every time tick, so the answer has to be available
       when it asks — not only when the fader moves. */
    ampBus: () => factor("wave"),
    /* The master slider moves the shell's volume, which calls back in here.
       Rebuilding the mixer at that point destroyed the input being dragged, so
       the master knob moved one step per click while the other four rode the
       drag. Patch the master column in place instead, and never touch the
       control that currently has the pointer. */
    mixerChanged() {
      wmpVol();
      ampVol();
      tvVol();
      tourVol();
      const win = $("#win-sndvol");
      if (!win || win.style.display === "none") return;
      const col = $("#sv32-cols") && $("#sv32-cols").firstElementChild;
      if (!col) return;
      const vs = col.querySelector(".sv32-vol"), mc = col.querySelector(".sv32-m");
      const v = Math.round(hooks.getMaster() * 100);
      if (vs && vs !== dragging && +vs.value !== v) vs.value = v;
      if (mc) mc.checked = hooks.getMuted();
    },
  };
}
