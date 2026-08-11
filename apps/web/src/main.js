import "xp.css";
import "./style.css";
import WebampImport from "webamp";
import { IMG, SNDF, TRACKS, MINE, EMO, PAINT, AGENT_PNG, AGENT_DEF, CURFILES } from "./assets.js";
import { initMinesweeper } from "./minesweeper.js";
import { initMessenger, CONTACTS as MSN_CONTACTS } from "./messenger.js";
import { initOE } from "./oe.js";
import { initSysInfo } from "./sysinfo.js";
import { initFreeCell } from "./freecell.js";
import { initSpider } from "./spider.js";
import { initHearts } from "./hearts.js";
import { initSolBounce } from "./solbounce.js";
import { initPaint } from "./paint.js";
import { initExplorer } from "./explorer.js";
import { initIE } from "./ie.js";
import { initSysApps } from "./sysapps.js";
import { initCompanion } from "./companion.js";
import { initNet } from "./net.js";
import { initMouse } from "./mouse.js";
import { initSavers } from "./savers.js";
import { initDepthApps } from "./depthapps.js";
import { initWriteApps } from "./writeapps.js";
import { initSoundApps } from "./soundapps.js";
import { initSysMaint } from "./sysmaint.js";
import { initTour } from "./tour.js";
import { initTourXP } from "./tourxp.js";
import { initAccess } from "./access.js";
const Webamp = (WebampImport && WebampImport.default) ? WebampImport.default : WebampImport;

"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const desktop=$("#desktop"), curlayer=$("#curlayer"), fxlayer=$("#fxlayer");
/* the mobile shell: apps are full-screen sheets (one at a time), the taskbar
   is an app switcher, and the game HUD is a permanent thumb bar. Decided once,
   at boot — the class must be on <body> before W/H are read.
   The test is the DEVICE, not the window. A phone lying down is 844px wide and
   used to fall through to the desktop shell, which is unusable with a thumb;
   the screen's short side does not change when you rotate, so the shell can
   never flip underneath a running game either. A narrow desktop window still
   gets the phone shell, because that is how the phone shell gets tested. */
const COARSE=matchMedia("(pointer:coarse)").matches;
const SHORTSIDE=Math.min(screen.width||innerWidth,screen.height||innerHeight);
/* 600 on a touch device, not 760: the widest phone is ~440 CSS px across and
   the narrowest tablet is ~744 (iPad mini), so 600 sits in the gap and a
   tablet keeps the real desktop, which it has the room for. */
const MOBILE=COARSE?SHORTSIDE<600:innerWidth<760;
if(MOBILE) document.body.classList.add("mobile");
/* landscape is a different shell, not a wider one: lying down, height is the
   scarce axis, so the HUD stands up as a right rail and the taskbar keeps the
   floor. One class; the CSS variables do the rest. */
function syncOrient(){ if(MOBILE) document.body.classList.toggle("land",innerWidth>innerHeight); }
syncOrient();
let W=desktop.clientWidth, H=desktop.clientHeight;
addEventListener("resize",()=>{
  syncOrient();W=desktop.clientWidth;H=desktop.clientHeight;syncArena();reflowIcons();
  /* maximized means "as big as the desktop", including after the desktop grew */
  $$(".window.maxed").forEach(el=>{ el.style.left="0px"; el.style.top="0px"; el.style.width=W+"px"; el.style.height=H+"px"; });
  if(MOBILE){
    /* rotation: dialogs re-center into the new viewport, Winamp re-stacks */
    for(const a of openApps.values())
      if(a.el&&a.el.classList.contains("fixed")&&!a.min&&a.el.style.display!=="none")
        requestAnimationFrame(()=>fitWin(a.el));
    const wa=openApps.get("win-amp");
    if(wa&&!wa.min&&webamp&&!wampHidden()){
      try{ webamp.centerWindowsInContainer(); }catch(e){}
      setTimeout(wampFit,60);
    }
  }
});
/* iOS never tells you the keyboard opened — it just shrinks the visual
   viewport out from under a layout that still thinks it owns the screen, and
   the Messenger composer ends up beneath the keys. Measure the gap, publish it
   as --kb, and the CSS moves the taskbar and the HUD out of the way. */
function mobKeyboard(){
  const vv=window.visualViewport; if(!vv) return;
  const kb=Math.max(0,innerHeight-vv.height-vv.offsetTop);
  const up=kb>120;                       /* an accessory bar on its own is not a keyboard */
  document.body.classList.toggle("kb",up);
  document.documentElement.style.setProperty("--kb",(up?Math.round(kb):0)+"px");
  W=desktop.clientWidth; H=desktop.clientHeight; syncArena();
  if(up&&document.activeElement) try{ document.activeElement.scrollIntoView({block:"nearest"}); }catch(e){}
}
if(MOBILE&&window.visualViewport){
  visualViewport.addEventListener("resize",mobKeyboard);
  visualViewport.addEventListener("scroll",mobKeyboard);
}

/* ---- money: integer units, 1 unit = 0.001 SOL ---- */
const STAKE=100, FEE_PLAT=1, FEE_RAKE=2, ENTRY=97, MAXCUR=5;
const fmtS=u=>((u<0?"-":"")+(Math.abs(u)/1000).toFixed(3));
const fmtSign=u=>(u<0?"-":"+")+(Math.abs(u)/1000).toFixed(3);

/* ---- round timing (seconds) ---- */
/* The game is continuous: one perpetual battle, deploys always open. Epochs
   exist underneath (the fairness ceremony will need bounded seed windows),
   but the player never sees a round end — they see the system CRASH, bank
   everyone in full, and come straight back. Length is randomized so the
   crash cannot be camped by the clock. */
const T_SHUT=12, T_CRASH=5, EPOCH_MIN=110, EPOCH_MAX=195;
const RECALL_SECS=3, DUEL_MS=700;

/* ================= audio ================= */
let AC=null, muted=false, masterVol=.7;   /* the tray slider, 0..1 — see volFlyout() */
let snd=null;   /* the sndvol32 module, once booted — its Wave slider scales everything below */
const waveF=()=>snd?snd.factor("wave"):1;
/* every oscillator on this machine is the software synthesiser, so SW Synth is
   its fader: the dial-up handshake, the deploy sweep, the kill chirp. Sampled
   sounds are Wave. That is exactly the split sndvol32 was drawing. */
const synthF=()=>snd?snd.factor("synth"):1;
const vol=v=>(v==null?.55:v)*masterVol*waveF();
function ac(){ if(!AC) AC=new (window.AudioContext||window.webkitAudioContext)(); return AC; }
function tone(f,dur,type,v,delay,slide){
  if(muted) return;
  try{
    const c=ac(),t=c.currentTime+(delay||0);
    const o=c.createOscillator(),g=c.createGain();
    o.type=type||"square"; o.frequency.setValueAtTime(f,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+dur);
    g.gain.setValueAtTime((v||.05)*masterVol*synthF(),t);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+.03);
  }catch(e){}
}
/* -- game synths (game flavor stays ours) -- */
const sDeploy=()=>tone(280,.2,"sawtooth",.05,0,520);
const sDuel  =()=>{tone(880,.06,"square",.04);tone(660,.06,"square",.04,.09);};
const sKill  =()=>{tone(190,.16,"sawtooth",.08,0,-110);tone(1568,.09,"square",.05,.13);tone(2093,.13,"square",.05,.21);};
const sDie   =()=>tone(380,.55,"sawtooth",.09,0,-300);
const sBank  =()=>[523,659,784,1046].forEach((f,i)=>tone(f,.11,"square",.05,i*.07));
const sRound =()=>[392,523,659].forEach((f,i)=>tone(f,.12,"square",.045,i*.09));
const sShut  =()=>{tone(220,.3,"sawtooth",.07,0,-60);tone(220,.3,"sawtooth",.07,.4,-60);};
const sRes   =()=>{tone(700,.08,"square",.05);tone(500,.1,"square",.05,.1);};
/* -- OS sounds: the real 2001 scheme (see assets.js) -- */
function sysSnd(name,v){
  if(muted) return;
  try{
    const a=new Audio(SNDF[name]);
    a.volume=Math.min(1,vol(v));
    a.play().catch(()=>{});
  }catch(e){}
}
const sClick =()=>{};                 /* XP buttons are silent */
const sChat  =()=>{};
const sMenu  =()=>{};
const sOpen  =()=>{};                 /* XP opens windows silently */
const sClose =()=>{};
const sMini  =()=>sysSnd("minimize");
const sMaxi  =()=>sysSnd("restore");
const sError =()=>sysSnd("critical",.6);
const sBalloon=()=>sysSnd("balloon",.6);
const sNudge =()=>sysSnd("msnNudge",.65);
function noiseBurst(dur,v,delay){
  if(muted) return;
  try{
    const c=ac(), t=c.currentTime+(delay||0);
    const b=c.createBuffer(1,Math.max(1,Math.floor(c.sampleRate*dur)),c.sampleRate);
    const d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    const n=c.createBufferSource(); n.buffer=b;
    const g=c.createGain(); g.gain.value=v*masterVol*synthF();   /* generated noise: synth bus */
    n.connect(g).connect(c.destination); n.start(t);
  }catch(e){}
}
const sCrunch=()=>sysSnd("recycle",.6);
const chime  =()=>sysSnd("logon",.7);
addEventListener("pointerdown",()=>{ if(AC&&AC.state==="suspended") AC.resume(); },{capture:true});
/* XP's tray volume: one click opens the little panel, the slider is the master
   for every sound the machine makes, and Mute is a checkbox, not a hidden
   toggle you discover by clicking the icon and losing your audio. */
const volf=$("#volflyout");
function volSync(){
  $("#sndico").classList.toggle("muted",muted||masterVol<=0);
  $("#vf-slider").value=Math.round(masterVol*100);
  $("#vf-mute").checked=muted;
  $("#sndico").dataset.tip=muted?"Volume: muted":"Volume: "+Math.round(masterVol*100)+"%";
  store.data.vol={v:masterVol,m:muted?1:0}; store.save();
  if(snd) snd.mixerChanged();
}
function volOpen(on){
  volf.classList.toggle("on",on);
  if(!on) return;
  const r=$("#sndico").getBoundingClientRect(), tb=$("#taskbar").getBoundingClientRect();
  /* clamp against the flyout's real width, not a guess: on a phone the tray
     sits hard against the right edge and a 72px guess put it off-screen */
  const w=volf.offsetWidth||72;
  volf.style.left=Math.max(4,Math.min(innerWidth-w-4,Math.round(r.left+r.width/2-w/2)))+"px";
  volf.style.top=Math.round(tb.top-volf.offsetHeight-2)+"px";
}
$("#sndico").addEventListener("click",e=>{ e.stopPropagation(); volOpen(!volf.classList.contains("on")); });
/* XP hides the icons you never touch behind the chevron; the chevron brings them back */
$("#tray-chev").addEventListener("click",()=>{
  const showing=document.body.classList.toggle("tray-open");
  $("#tray-chev").textContent=showing?"›":"‹";
});
$("#vf-slider").addEventListener("input",e=>{
  masterVol=(+e.target.value)/100;
  if(masterVol>0&&muted) muted=false;
  volSync();
});
$("#vf-slider").addEventListener("change",()=>{ if(!muted) sysSnd("balloon",.5); });   /* XP previews on release */
$("#vf-mute").addEventListener("change",e=>{ muted=e.target.checked; volSync(); });
/* capture-phase, so stopPropagation inside the flyout can't save it — the
   guard has to be the target check itself, or the slider closes on grab */
addEventListener("pointerdown",e=>{ if(!e.target.closest("#volflyout,#sndico")) volOpen(false); },true);

/* ================= shell persistence ================= */
const store={
  data:{},
  load(){
    try{ this.data=JSON.parse(localStorage.getItem("cursorsxp")||"{}")||{}; }catch(e){ this.data={}; }
    this.data.icons=this.data.icons||{};
    this.data.wins=this.data.wins||{};
    this.data.userIcons=this.data.userIcons||[];
    this.data.texts=this.data.texts||{};
    this.data.wallpaper=this.data.wallpaper||"bliss";
    this.data.saver=this.data.saver||{t:"pipes",wait:3};   /* Pipes. obviously. */
    /* desktop shell switches, all straight off XP's desktop menu */
    if(this.data.alignGrid==null) this.data.alignGrid=1;
    if(this.data.showIcons==null) this.data.showIcons=1;
    if(this.data.lockWeb==null) this.data.lockWeb=0;
    this.data.autoArr=this.data.autoArr||0;
    this.data.iconSort=this.data.iconSort||"name";
    this.data.unusedIcons=this.data.unusedIcons||[];
    this.data.pinned=this.data.pinned||[];
  },
  save(){ clearTimeout(this._t); this._t=setTimeout(()=>this.flush(),250); },
  flush(){ clearTimeout(this._t); try{ localStorage.setItem("cursorsxp",JSON.stringify(this.data)); }catch(e){} }
};
store.load();
/* the debounce must not eat the write that raced a reload */
addEventListener("pagehide",()=>store.flush());
/* identity lives up here: the Messenger reads it while it boots */
let PLAYER=store.data.userName||null;

/* ================= real XP assets into the static shell ================= */
/* The Recycle Bin icon is a gauge. The vendored winXP set only has the empty
   bin and no MIT source for the full one turned up, so rather than fake XP's
   crumpled paper the corpses poke out of it themselves — the same cursor
   symbol the arena draws, because that is literally what is in there. Every
   surface that asks icoNode for a bin gets the current level, and the level
   comes off diskPct() like the bar, the tray chip and Explorer's pie. */
let binLevel=0;
const PAPER=`fill="#FCFBF4" stroke="#8A8A78" stroke-width=".65" stroke-linejoin="round"`;
const FOLD=`stroke="#CBCBBA" stroke-width=".5" fill="none" stroke-linecap="round"`;
/* one discarded sheet: a rectangle on a tilt with a single crease, which is
   all XP's own full bin is once you look at it at 32px */
const sheet=(x,y,a,w,h)=>`<g transform="translate(${x},${y}) rotate(${a})">`+
  `<rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx=".5" ${PAPER}/>`+
  `<path d="M${-w/2+.4} ${-h/6} H${w/2-.4}" ${FOLD}/></g>`;
const BINSPILL=[
  sheet(13,7.2,-12,6.4,8.4),
  sheet(8.4,7.4,-30,5.6,7.6),
  sheet(18.6,6.2,17,6,8)+sheet(5,11,-72,5.2,7.2),
];
const binSpill=()=>BINSPILL.slice(0,binLevel).join("");
function binFillLevel(f){ return f<=0?0:f<.35?1:f<.8?2:3; }
function syncBinIcon(f){
  /* the disk drives the level, but an emptied bin must LOOK emptied — the
     drive keeps its corpses in multiplayer, the icon does not lie about yours */
  const lv=binEmpty()?0:binFillLevel(f);
  if(lv===binLevel) return;
  binLevel=lv;
  for(const svg of document.querySelectorAll(".binico svg")) svg.innerHTML=binSpill();
}
function icoNode(key){
  if(key==="bin32"||key==="bin16"){
    const box=document.createElement("span");
    box.className="binico";
    box.innerHTML=`<img src="${IMG.bin32}" alt="" draggable="false"><svg viewBox="0 0 32 32">${binSpill()}</svg>`;
    return box;
  }
  if(key&&key[0]==="@"){
    const box=document.createElement("span");
    box.className="svgbox";
    box.innerHTML=`<svg viewBox="0 0 32 32" style="width:100%;height:100%;display:block"><use href="#${key.slice(1)}"/></svg>`;
    return box;
  }
  const img=document.createElement("img");
  img.src=IMG[key]||IMG[key.replace(/16$/,"32")]||IMG.folder16;
  img.alt=""; img.draggable=false;
  return img;
}
$$(".xico[data-ico]").forEach(el=>{ el.appendChild(icoNode(el.dataset.ico)); });
/* Paint's sprite sheets reach CSS as variables so the stylesheet stays asset-free */
document.documentElement.style.setProperty("--pt-tools",`url(${PAINT.tools})`);
document.documentElement.style.setProperty("--pt-trans",`url(${PAINT.transparency})`);
document.documentElement.style.setProperty("--pt-air",`url(${PAINT.airbrush})`);
$("#startbtn").src=IMG.startBtn;
$("#sm-ava").src=IMG.user48;
$("#sm-allarrow").src=IMG.allProg;
$("#lg-avaimg").src=IMG.user48;
$("#lg-offimg").src=IMG.off32;
$$(".boot-flag,.lg-flag").forEach(el=>{ el.src=IMG.flag; });
/* legacy saved icons (pre-asset builds) get real icons */
for(const u of store.data.userIcons) if(!u.ico) u.ico=u.kind==="folder"?"folder32":"note32";

/* ================= window manager ================= */
/* One process table is the single source of truth. The taskbar is a pure
   render of it — rebuilt on every mutation, never patched in place. Webamp
   is a normal entry (kind:"webamp"), so zombie tabs are impossible. */
let webamp=null;
function wampWrap(){ return document.getElementById("webamp-wrap"); }
function showWamp(){ const w=wampWrap(); if(w){ w.style.display=""; wampFit(); } }
/* Webamp draws at a fixed 275px-wide stack that is taller than a phone lying
   down. Scale the whole rig to whatever room the desktop actually has. */
function wampFit(){
  const w=wampWrap(); if(!w||!MOBILE) return;
  w.style.transform=""; w.style.transformOrigin="0 0";
  const inner=w.querySelector("#webamp")||w.firstElementChild;
  if(!inner) return;
  const r=inner.getBoundingClientRect();
  if(!r.width||!r.height) return;
  const availW=Math.max(160,desktop.clientWidth-8), availH=Math.max(160,desktop.clientHeight-8);
  const s=Math.min(1,availW/r.width,availH/r.height);
  if(s<1) w.style.transform="scale("+s.toFixed(3)+")";
}
function hideWamp(){ const w=wampWrap(); if(w) w.style.display="none"; }
function wampHidden(){ const w=wampWrap(); return !w||w.style.display==="none"; }
let zTop=100, focusedId=null;
/* CURSORS.EXE floats over the desktop by default (View > Always on Top):
   the game must stay watchable while MSN and IE cover the rest. Bands:
   normal windows ride zTop (100..4500), the pinned HUD sits at 5000,
   desktop dialogs at 6000+ (a dialog must never hide under the HUD),
   mobile dialogs at 8500, taskbar 9000, menus 99990. */
const AOT_Z=4900, FIX_Z=6000; let fixTop=0;   /* 4900: above windows, under the arena's 5000 */
let hudTop=store.data.hudTop!==false;
function assertHudTop(){
  if(MOBILE||!hudTop) return;
  const a=openApps.get("win-cursors");
  if(!a||a.min||!a.el) return;
  a.el.style.zIndex=AOT_Z;
}
function setHudTop(on){
  hudTop=!!on; store.data.hudTop=hudTop; store.save();
  const el=document.getElementById("win-cursors");
  if(!hudTop&&el) el.style.zIndex=++zTop; else assertHudTop();
}
/* a marathon of clicking can walk zTop into the HUD band; fold it back */
function renormZ(){
  if(zTop<4500) return;
  const ws=[...openApps.values()].filter(a=>a.el&&!a.el.classList.contains("fixed"))
    .sort((a,b)=>((+a.el.style.zIndex)||0)-((+b.el.style.zIndex)||0));
  zTop=100; for(const a of ws) a.el.style.zIndex=++zTop;
  zTop++;   /* the window being focused right now lands above the compacted stack */
}
const openApps=new Map();
const NOTAB=new Set(["win-logoff","win-shutdown","win-error","win-confirm","win-props","win-run","win-cert","win-runas"]);
function tabTitle(id){ const a=openApps.get(id); if(a&&a.title) return a.title; const t=$("#"+id+" .title-bar-text"); return t?t.textContent:id; }
function tabIconHTML(id){
  const el=$("#"+id+" .title-bar .tb-ico");
  if(!el) return "";
  /* .tb-ico is either a wrapper (static windows) or the <img> itself (conversations) */
  const img=el.tagName==="IMG"?el:el.querySelector("img");
  if(img) return `<img src="${img.src}" alt="">`;
  const u=el.querySelector("use");
  return u?`<svg><use href="${u.getAttribute("href")}"/></svg>`:"";
}
/* Auto-hide: the bar drops off the bottom and comes back when the pointer
   reaches the edge — or whenever the Start menu is open, which is XP's rule
   too, otherwise clicking Start would slide the thing out from under you. */
function syncAutoHide(){
  document.body.classList.toggle("tb-auto",!!store.data.tbAuto);
  if(!store.data.tbAuto) document.body.classList.remove("tb-peek");
}
let tbPeekT=null;
addEventListener("pointermove",e=>{
  if(!store.data.tbAuto) return;
  const near=e.clientY>=innerHeight-3;
  const over=e.target.closest&&e.target.closest("#taskbar,#startmenu");
  clearTimeout(tbPeekT);
  if(near||over) document.body.classList.add("tb-peek");
  else tbPeekT=setTimeout(()=>{
    if(!$("#startmenu")||$("#startmenu").style.display==="none") document.body.classList.remove("tb-peek");
  },420);
},{passive:true});
function renderTaskbar(){
  const host=$("#tabs"); host.innerHTML="";
  for(const [id,a] of openApps){
    if(a.notab) continue;
    const tab=document.createElement("button");
    tab.className="task-tab"+(id===focusedId&&!a.min?" on":"");
    tab.dataset.win=id;
    tab.innerHTML=`${a.icon}<span></span>`;
    tab.querySelector("span").textContent=tabTitle(id);
    host.appendChild(tab);
    a.tabEl=tab;
  }
  /* Cursors crawl above every window by design — that is the point of the
     desktop. But on a phone a sheet IS the whole screen, and tags scrolling
     over a Stats table is just noise, so behind a sheet the arena drops to a
     hint of motion and comes straight back when you close it. */
  /* the arena stays at full strength behind everything: the fight is the
     product, and a window is not a reason to stop watching it */
}
function tabClick(id){
  const a=openApps.get(id); if(!a) return;
  if(a.kind==="webamp"){
    /* truth = actual visibility, not just the flag — a desync can never zombie */
    if(a.min||wampHidden()){ a.min=false; focusedId=id; showWamp(); try{ webamp.reopen(); }catch(e){} }
    else{ a.min=true; if(focusedId===id) focusedId=null; hideWamp(); }
    renderTaskbar(); return;
  }
  if(a.min) restoreWin(id);
  else if(id===focusedId) minWin(id);
  else focusWin(id);
}
function tbInactive(el,inactive){
  const tb=el&&el.querySelector?el.querySelector(".title-bar"):null;
  if(tb) tb.classList.toggle("inactive",inactive);
}
function saveWinRect(el){
  if(MOBILE) return; /* sheet/popup positions must never leak into desktop rects */
  store.data.wins[el.id]={l:el.style.left,t:el.style.top,w:el.style.width||"",h:el.style.height||"",max:el.classList.contains("maxed")?1:0};
  store.save();
}
function applyWinRect(el){
  if(MOBILE) return; /* CSS owns sheets; fitWin centers popups */
  const s=store.data.wins[el.id]; if(!s) return;
  if(s.max){ el._prevRect={l:s.l,t:s.t,w:s.w,h:s.h}; el.classList.add("maxed"); el.style.left="0px"; el.style.top="0px"; el.style.width=W+"px"; el.style.height=H+"px"; return; }
  if(s.l) el.style.left=Math.min(parseFloat(s.l)||0,W-60)+"px";
  if(s.t) el.style.top=clamp(parseFloat(s.t)||0,0,H-40)+"px";
  if(s.w) el.style.width=s.w;
  if(s.h) el.style.height=s.h;
}
let ie=null;   /* the browser, wired further down; openWin needs the handle */
let netUp=false;   /* cursor$net dial-up state, published by ie.setNet for ipconfig/ping */
/* declared here because boot-time code reads them: `sys` is the XP applications
   module (assigned further down) and these two are local service switches */
let sys=null, toastsOn=true, clockOn=true, msnAuto=true;
let readmeText=null;
/* Windows Update used to steer IE at windowsupdate.microsoft.com, which is a
   dead address here and answered with "page cannot be displayed" from three
   different menus. It answers the question instead. */
function windowsUpdate(){
  openWin("win-ie");
  try{ ie.connectNow&&ie.connectNow(); }catch(e){}
  try{ ie.go("http://windowsupdate.microsoft.com/"); }catch(e){}
}
/* Windows Classic style, straight from the Appearance tab */
{
  const sel=document.getElementById("ds-style");
  if(sel){
    if(store.data.classicStyle){ sel.selectedIndex=1; document.body.classList.add("classic-theme"); }
    sel.addEventListener("change",()=>{
      const classic=sel.selectedIndex===1;
      document.body.classList.toggle("classic-theme",classic);
      store.data.classicStyle=classic?1:0; store.save();
    });
  }
}
function openWin(id,opts){
  if(id==="win-ie"&&MP.on&&MP.tv&&MP.tv.now) setTimeout(()=>{ try{ mpTvSync(); }catch(e){} },200);
  if(id==="win-mine"){ try{ mine.resume(); }catch(e){} }
  if(id==="win-hearts"){ try{ hearts.resume(); }catch(e){} }
  if(id==="win-tourxp"&&!tourxp.live()){ try{ tourxp.open(); return; }catch(e){} }
  if(id==="win-tour"&&!$("#tour-img").src){ try{ tour.open(true); return; }catch(e){} }
  if(id==="win-amp"){ winampApp.open(); return; }
  if(id==="win-readme"&&write){
    if(readmeText===null) readmeText=$("#win-readme .paper").textContent;
    write.openNotepad({title:"README.txt",get:()=>readmeText,set:null});
    return;
  }
  opts=opts||{};
  const el=document.getElementById(id);
  const was=openApps.has(id);
  const prevFocus=focusedId;   /* the sheet this dialog belongs to */
  if(!was&&!el._rectApplied){ applyWinRect(el); el._rectApplied=true; }
  el.style.display="flex";
  if(!was){
    openApps.set(id,{el,min:false,notab:NOTAB.has(id),icon:tabIconHTML(id)});
    /* Add or Remove Programs reports what you actually used, so count it */
    const uc=store.data.useCount=store.data.useCount||{};
    const ul=store.data.useLast=store.data.useLast||{};
    uc[id]=(uc[id]||0)+1; ul[id]=Date.now(); store.save();
    if(id==="win-chat"&&!opts.silent) sysSnd("msnOnline",.5);
  }
  else if(openApps.get(id).min){ restoreWin(id); return; }
  requestAnimationFrame(()=>fitWin(el));
  noteDialog(id,prevFocus);
  focusWin(id);
  if(id==="win-run") setTimeout(()=>{ const i=$("#run-in"); i.value=""; i.focus(); },0);
  if(id==="win-ie"&&ie) ie.boot();   /* an empty browser dials out on its own */
  if(id==="win-cmd"){ if(sys.policyOn("nocmd")){ closeWin("win-cmd"); showError("Command Prompt","The command prompt has been disabled by your administrator.\n\nPress any key to continue . . ."); return; } sys.cmdOpen(); }
  if(id==="win-control") sys.cplRender();
  if(id==="win-winver") fillWinver();
  if(id==="win-autoplay") fillAutoplay();
  if(id==="win-utilman") fillUtilman();
  if(id==="win-services") sys.openConsole("services");
  if(id==="win-devmgr") sys.openConsole("devmgr");
  if(id==="win-gpedit") sys.openConsole("gpedit");
  if(id==="win-eventvwr"||id==="win-msinfo"||id==="win-dxdiag") sysinfo.wake(id);
  if(!was) smTouch(id);
}
/* no window may hang off the screen — the small-screen safety net */
function fitWin(el){
  if(!el||el.classList.contains("maxed")) return;
  if(MOBILE&&!el.classList.contains("fixed")) return; /* sheets: CSS owns the rect */
  const r=el.getBoundingClientRect();
  if(!r.width&&!r.height) return;
  /* Measure the desktop NOW rather than trusting the cached W/H. On iOS the
     visible height moves with the URL bar between resize events, and a dialog
     placed against a stale height is a dialog whose buttons are below the fold
     — which is exactly how the dial-up box became unreachable on a phone. */
  const dh=desktop.clientHeight||H, dw=desktop.clientWidth||W;
  if(r.height>dh-6) el.style.height=(dh-10)+"px";
  const h=Math.min(r.height,dh-10), w=Math.min(r.width,dw-4);
  if(r.width>dw-4) el.style.width=w+"px";
  if(MOBILE){ /* dialogs on the phone: centred, high, and never past the bottom */
    el.style.left=Math.max(2,Math.round((dw-w)/2))+"px";
    el.style.top=clamp(Math.round((dh-h)/3),6,Math.max(6,dh-h-6))+"px";
    return;
  }
  H=dh; W=dw;
  if(r.top+h>H-2||r.top<0) el.style.top=clamp(H-h-2,0,Math.max(0,H-h-2))+"px";
  if(r.left+w>W-2) el.style.left=Math.max(2,W-w-2)+"px";
  if(r.left<0) el.style.left="2px";
}
function restoreWin(id){
  const a=openApps.get(id); if(!a) return;
  if(a.kind==="webamp"){ if(a.min) tabClick(id); return; }
  clearTimeout(a._minT);   /* a minimize still animating must not re-hide us */
  a.min=false;
  a.el.style.display="flex";
  /* the reverse of minimize: the window zooms back OUT of its taskbar tab */
  const r=a.el.getBoundingClientRect();
  let tx=40;
  if(a.tabEl){ const tr=a.tabEl.getBoundingClientRect(); tx=tr.left+tr.width/2; }
  a.el.style.transformOrigin="0 100%";
  a.el.style.opacity="0";
  a.el.style.transform=`translate(${tx-r.left}px,${H-r.top}px) scale(.06)`;
  requestAnimationFrame(()=>{
    a.el.style.transition="transform .17s ease-out,opacity .17s ease-out";
    a.el.style.opacity=""; a.el.style.transform="";
    setTimeout(()=>{ a.el.style.transition=""; a.el.style.transformOrigin=""; },190);
  });
  sysSnd("restore",.5);
  focusWin(id);
}
function closeWin(id,opts){
  try{ if(id==="win-magnifier"&&access.magnifying()) access.stopMagnifier(); }catch(e){}
  if(id==="win-copy") fileOpCancel=true;   /* the X on a progress dialog is Cancel */
  dlgOwner.delete(id);
  /* dialogs owned by a closing sheet go free (and visible) again */
  for(const [k,own] of [...dlgOwner]) if(own===id){
    dlgOwner.delete(k);
    const d=openApps.get(k); if(d&&d.el&&!d.min) d.el.style.display="flex";
  }
  if(id==="win-amp"){ winampApp.close(); return; }
  const a=openApps.get(id); if(!a) return;
  clearTimeout(a._minT);   /* close mid-minimize must not hide the next open */
  if(id==="win-mine") mine.pause(); /* the clock does not run while the box is shut */
  if(id==="win-hearts") hearts.pause();   /* the computer players stop dealing to an empty room */
  if(id==="win-paint") paint.commit(); /* half-finished text/curves/selections land before the lid shuts */
  /* closing is quitting. A hidden window that keeps making noise is a bug,
     not a feature — every app that runs something stops it here. */
  if(id==="win-solitaire"){
    const fr=$("#solitaire-frame");
    if(fr){ fr.src="about:blank"; delete fr.dataset.live; }
  }
  if(id==="win-wmp"&&snd) snd.stopWmp();
  if(id==="win-tourxp") tourxp.stop();
  if(id==="win-sndrec"&&snd) snd.stopRecorder();   /* also releases the microphone */
  if(id==="win-pictview"&&write) write.stopViewer();
  if(id==="win-ie"){ try{ ytPlayer&&ytPlayer.pauseVideo&&ytPlayer.pauseVideo(); }catch(e){} }
  a.el.style.display="none"; a.el.classList.remove("focused");
  openApps.delete(id);
  if(focusedId===id){ focusedId=null; focusNextTop(); }
  renderTaskbar();
}
/* XP hands focus to whatever is on top after a close/minimize */
function focusNextTop(){
  let best=null,bz=-1;
  for(const [k,b] of openApps){
    if(b.min||!b.el||b.el.classList.contains("fixed")) continue;
    const z=+b.el.style.zIndex||0;
    if(z>bz){ bz=z; best=k; }
  }
  if(best) focusWin(best);
}
function minWin(id){
  const a=openApps.get(id); if(!a||a.min) return;
  clearTimeout(a._minT);
  if(a.kind==="webamp"){ tabClick(id); return; }
  a.min=true;
  if(focusedId===id){ focusedId=null; focusNextTop(); }
  renderTaskbar();
  const el=a.el, r=el.getBoundingClientRect();
  let tx=40;
  if(a.tabEl){ const tr=a.tabEl.getBoundingClientRect(); tx=tr.left+tr.width/2; }
  el.style.transition="transform .17s ease-in,opacity .17s ease-in";
  el.style.transformOrigin="0 100%";
  el.style.transform=`translate(${tx-r.left}px,${H-r.top}px) scale(.06)`;
  el.style.opacity="0";
  sMini();
  a._minT=setTimeout(()=>{ el.style.display="none"; el.style.transition=""; el.style.transform=""; el.style.opacity=""; el.style.transformOrigin=""; },180);
  el.classList.remove("focused"); el.classList.add("inactive");
  tbInactive(el,true);
}
function maxWin(id){
  if(MOBILE) return; /* sheets are already the whole screen */
  const el=document.getElementById(id);
  if(el.classList.contains("fixed")) return;
  if(el.classList.contains("maxed")){
    el.classList.remove("maxed");
    const p=el._prevRect;
    if(p){ el.style.left=p.l; el.style.top=p.t; el.style.width=p.w; el.style.height=p.h; }
    sysSnd("restore",.5);
  }else{
    el._prevRect={l:el.style.left,t:el.style.top,w:el.style.width,h:el.style.height};
    el.classList.add("maxed");
    el.style.left="0px"; el.style.top="0px"; el.style.width=W+"px"; el.style.height=H+"px";
    sMaxi();
  }
  saveWinRect(el);
}
/* a "sheet" is a real app window; .fixed dialogs float above the sheet.
   On the phone a sheet fills the screen, so a dialog that falls behind one is
   not "behind a window", it is gone — which is how the dial-up box vanished
   the moment you switched apps and came back to Internet Explorer. Dialogs
   therefore live in their own z-band above every sheet, and they remember
   which sheet opened them so they travel with it. */
const DLG_Z = 8500;
let dlgTop = 0;
const dlgOwner = new Map();
function noteDialog(id, owner){
  if(!MOBILE) return;
  const el=document.getElementById(id);
  if(!el||!el.classList.contains("fixed")) return;
  if(owner&&owner!==id&&isSheet(owner)) dlgOwner.set(id,owner);
}
/* focusing a sheet hides the dialogs that belong to other sheets and brings
   back the ones that belong to this one */
function syncDialogs(sheetId){
  for(const [k,a] of openApps){
    if(!a.el||!a.el.classList.contains("fixed")) continue;
    const own=dlgOwner.get(k);
    if(!own) continue;
    const mine=own===sheetId;
    a.el.style.display=mine?"flex":"none";
    if(mine) a.el.style.zIndex=DLG_Z+(++dlgTop);
  }
}
function isSheet(id){
  const el=document.getElementById(id);
  return !!el&&!el.classList.contains("fixed")&&!NOTAB.has(id);
}
function focusWin(id){
  if(MOBILE&&isSheet(id)){
    /* one sheet at a time: focusing a sheet sends every other sheet home.
       Webamp just hides (its audio keeps playing behind the sheet). */
    for(const [k,a] of openApps){
      if(k===id||a.min) continue;
      if(a.kind==="webamp"){ a.min=true; hideWamp(); continue; }
      if(!isSheet(k)) continue;
      a.min=true; a.el.style.display="none"; a.el.classList.remove("focused");
    }
    syncDialogs(id);
  }
  zTop++; focusedId=id;
  for(const [k,a] of openApps){
    if(a.kind==="webamp") continue;
    const on=k===id;
    a.el.classList.toggle("focused",on);
    a.el.classList.toggle("inactive",!on);
    tbInactive(a.el,!on);
  }
  renormZ();
  const el=document.getElementById(id);
  if(el){
    const a0=openApps.get(id);
    if(a0&&!a0.min&&el.style.display==="none") el.style.display="flex";
    const fixed=el.classList.contains("fixed");
    /* dialogs sit above every normal window: on the phone above the sheets,
       on the desktop above the pinned CURSORS.EXE too */
    if(MOBILE&&fixed){ if(dlgTop>400) dlgTop=0; el.style.zIndex=DLG_Z+(++dlgTop); }
    else if(fixed){
      if(fixTop>2400){
        fixTop=0;
        for(const a of openApps.values()) if(a.el&&a.el.classList.contains("fixed")) a.el.style.zIndex=FIX_Z+(++fixTop);
      }
      el.style.zIndex=FIX_Z+(++fixTop);
    }
    else el.style.zIndex=zTop;
  }
  assertHudTop();
  renderTaskbar();
}
/* resize cursors route through the scheme vars, so a skinned pointer skins
   the window edges too; unset vars fall back to the native keyword */
const CURMAP={n:"var(--cur-ns,n-resize)",s:"var(--cur-ns,s-resize)",e:"var(--cur-we,e-resize)",w:"var(--cur-we,w-resize)",
  ne:"var(--cur-nesw,ne-resize)",nw:"var(--cur-nwse,nw-resize)",se:"var(--cur-nwse,se-resize)",sw:"var(--cur-nesw,sw-resize)"};
function edgeDir(w,e){
  const r=w.getBoundingClientRect();
  const x=e.clientX-r.left, y=e.clientY-r.top;
  let d="";
  if(y<6) d+="n"; else if(y>r.height-8) d+="s";
  if(x<8) d+="w"; else if(x>r.width-8) d+="e";
  return d;
}
let reszActive=null;
/* every window — markup or runtime-created (conversations) — gets wired here */
function wireWindow(w){
  w.addEventListener("pointerdown",()=>{
    if(openApps.has(w.id)) focusWin(w.id);
    $$(".icon.sel").forEach(i=>i.classList.remove("sel"));
  });
  const tb=w.querySelector(".title-bar");
  const btnMin=w.querySelector('.title-bar-controls button[aria-label="Minimize"]');
  const btnClose=w.querySelector('.title-bar-controls button[aria-label="Close"]');
  if(btnMin) btnMin.addEventListener("click",e=>{e.stopPropagation();minWin(w.id);});
  if(btnClose) btnClose.addEventListener("click",e=>{e.stopPropagation();closeWin(w.id);});
  if(!MOBILE&&!w.classList.contains("fixed")&&btnClose){
    let btnMax=w.querySelector('.title-bar-controls button[aria-label="Maximize"]');
    if(!btnMax){
      btnMax=document.createElement("button");
      btnMax.setAttribute("aria-label","Maximize");
      btnClose.before(btnMax);
    }
    btnMax.addEventListener("click",e=>{e.stopPropagation();maxWin(w.id);});
    tb.addEventListener("dblclick",e=>{ if(!e.target.closest(".title-bar-controls")) maxWin(w.id); });
    w.addEventListener("pointermove",e=>{
      if(reszActive) return;
      const d=w.classList.contains("maxed")?"":edgeDir(w,e);
      w.style.cursor=d?CURMAP[d]:"";
    });
    w.addEventListener("pointerdown",e=>{
      if(w.classList.contains("maxed")) return;
      if(e.target.closest(".title-bar-controls")) return;
      const d=edgeDir(w,e); if(!d) return;
      e.stopPropagation(); e.preventDefault();
      if(openApps.has(w.id)) focusWin(w.id);
      const r=w.getBoundingClientRect();
      const minw=+(w.dataset.minw||232), minh=+(w.dataset.minh||130);
      const sx=e.clientX, sy=e.clientY;
      reszActive=true;
      document.body.classList.add("win-drag");
      const mv=ev=>{
        let left=r.left, top=r.top, width=r.width, height=r.height;
        const dx=ev.clientX-sx, dy=ev.clientY-sy;
        if(d.includes("e")) width=Math.max(minw,r.width+dx);
        if(d.includes("s")) height=Math.max(minh,r.height+dy);
        if(d.includes("w")){ width=Math.max(minw,r.width-dx); left=r.left+(r.width-width); }
        if(d.includes("n")){ height=Math.max(minh,r.height-dy); top=r.top+(r.height-height); }
        w.style.left=left+"px"; w.style.top=top+"px"; w.style.width=width+"px"; w.style.height=height+"px";
      };
      const up=()=>{ reszActive=null; document.body.classList.remove("win-drag"); removeEventListener("pointermove",mv); removeEventListener("pointerup",up); saveWinRect(w); };
      addEventListener("pointermove",mv); addEventListener("pointerup",up);
    },true);
  }
  tb.addEventListener("pointerdown",e=>{
    if(e.target.closest(".title-bar-controls")) return;
    if(w.classList.contains("maxed")) return;
    if(MOBILE&&!w.classList.contains("fixed")) return; /* sheets don't drag */
    const r=w.getBoundingClientRect(), dx=e.clientX-r.left, dy=e.clientY-r.top;
    document.body.classList.add("win-drag");
    const move=ev=>{
      w.style.left=clamp(ev.clientX-dx,-r.width+80,W-40)+"px";
      w.style.top=clamp(ev.clientY-dy,0,H-30)+"px";
    };
    const up=()=>{document.body.classList.remove("win-drag");removeEventListener("pointermove",move);removeEventListener("pointerup",up);saveWinRect(w);};
    addEventListener("pointermove",move); addEventListener("pointerup",up);
  });
}
$$(".window").forEach(wireWindow);

/* ================= desktop icons ================= */
const SYSICONS=[
  {id:"computer",label:"My Computer",ico:"computer32",app:"win-explorer",sys:1},
  {id:"recycle",label:"Recycle Bin",ico:"bin32",app:"bin",sys:1},
  {id:"cursors",label:"CURSORS.EXE",ico:"@ic-app",app:"win-cursors",sys:1},
  {id:"mine",label:"Minesweeper",ico:"mine32",app:"win-mine",sys:1},
  {id:"paint",label:"Paint",ico:"paint32",app:"win-paint",sys:1},
  {id:"ie",label:"Internet Explorer",ico:"ie32",app:"win-ie",sys:1},
  {id:"chat",label:"Windows Messenger",ico:"msn32",app:"win-chat",sys:1},
  {id:"amp",label:"Winamp",ico:"amp16",app:"win-amp",sys:1},
  {id:"log",label:"fights.log",ico:"note32",app:"win-log",sys:1},
  {id:"readme",label:"README.txt",ico:"note32",app:"win-readme",sys:1},
  /* Control Panel on the desktop is a real XP option (Desktop Items -> General),
     and the two applets nobody finds by accident get their own shortcuts. */
  {id:"cpl",label:"Control Panel",ico:"@ic-cpl",app:"win-control",sys:1,lnk:1},
  {id:"mouse",label:"Mouse Properties",ico:"@ic-dev",app:"run",cmd:"main.cpl",sys:1,lnk:1},
  {id:"oe",label:"Outlook Express",ico:"outlook32",app:"win-oe",sys:1,lnk:1},
  {id:"calc",label:"Calculator",ico:"calc32",app:"run",cmd:"calc",sys:1,lnk:1},
  /* the crowded-desktop look: everything from the last four phases, pinned
     the way a 2003 family PC accreted shortcuts nobody ever cleaned up */
  {id:"solitaire",label:"Solitaire",ico:"@ic-cards",app:"run",cmd:"sol",sys:1,lnk:1},
  {id:"wmp",label:"Windows Media Player",ico:"wmp32",app:"run",cmd:"wmplayer",sys:1,lnk:1},
  {id:"sndrec",label:"Sound Recorder",ico:"wavdoc16",app:"run",cmd:"sndrec32",sys:1,lnk:1},
  {id:"notepad",label:"Notepad",ico:"note32",app:"run",cmd:"notepad",sys:1,lnk:1},
  {id:"wordpad",label:"WordPad",ico:"writedoc16",app:"run",cmd:"wordpad",sys:1,lnk:1},
];
const CELLW=MOBILE?68:84, CELLH=MOBILE?72:86, GX=12, GY=8;
/* rotating a phone changes how many icons fit in a column, so the default grid
   has to be recomputed — but iOS fires resize on every URL-bar nudge, so only
   rebuild when the row count actually moved. */
let iconRows=-1;
function reflowIcons(){
  const rows=Math.max(1,Math.floor((H-GY-70)/CELLH)+1);
  if(rows===iconRows) return;
  iconRows=rows; renderIcons();
}
let curTxtIcon=null, binFiles=[];
function allIcons(){
  let a=SYSICONS.concat(store.data.userIcons);
  /* Group Policy, applied where the icons are built rather than after */
  if(sys&&sys.policyOn("nobin")) a=a.filter(i=>i.id!=="recycle");
  /* Add or Remove Programs really removes the shortcut */
  try{ a=a.filter(i=>!i.sys||maint.installed(i.id)); }catch(e){}
  /* A phone screen is a tenth of a desktop's. The crowded-desktop shortcuts
     (the .lnk ones this machine accreted) would cover the arena, so on the
     phone they stay in All Programs where there is room for them. */
  if(MOBILE) a=a.filter(i=>!i.lnk);
  return a;
}
function iconById(id){ return allIcons().find(i=>i.id===id); }
function posOf(ic){ return store.data.icons[ic.id]||{c:ic._dc||0,r:ic._dr||0}; }
function cellFree(c,r,exceptId){
  return !allIcons().some(ic=>{ const p=posOf(ic); return ic.id!==exceptId&&p.c===c&&p.r===r; });
}
function firstFreeCell(){
  const maxR=Math.max(1,Math.floor((H-GY-80)/CELLH));
  for(let c=0;c<12;c++) for(let r=0;r<=maxR;r++) if(cellFree(c,r,null)) return {c,r};
  return {c:0,r:0};
}
function layoutDefaults(){
  const rows=Math.max(1,Math.floor((H-GY-70)/CELLH)+1);
  SYSICONS.forEach((ic,i)=>{ ic._dc=Math.floor(i/rows); ic._dr=i%rows; });
}
function renderIcons(){
  layoutDefaults();
  iconRows=Math.max(1,Math.floor((H-GY-70)/CELLH)+1);
  const host=$("#icons"); host.innerHTML="";
  host.style.display=store.data.showIcons?"":"none";
  for(const ic of allIcons()){
    const p=posOf(ic);
    const el=document.createElement("div");
    el.className="icon"; el.dataset.iid=ic.id;
    if(p.x!=null){ el.style.left=p.x+"px"; el.style.top=p.y+"px"; }
    else{ el.style.left=(GX+p.c*CELLW)+"px"; el.style.top=(GY+p.r*CELLH)+"px"; }
    el.appendChild(icoNode(ic.ico));
    const lbl=document.createElement("div"); lbl.className="lbl"; lbl.textContent=ic.label;
    el.appendChild(lbl);
    hookIcon(el,ic);
    host.appendChild(el);
  }
}
function selectOnly(el){ $$(".icon").forEach(i=>i.classList.remove("sel")); if(el) el.classList.add("sel"); }
const selIcons=()=>$$(".icon.sel");
/* Ctrl toggles one out of the group, Shift takes the run between the anchor and
   here (XP walks the rendered order, which is the order #icons is built in) */
let selAnchor=null;
function selectWith(el,e){
  const all=[...$("#icons").children];
  if(e.ctrlKey||e.metaKey){ el.classList.toggle("sel"); selAnchor=el; return; }
  if(e.shiftKey&&selAnchor&&selAnchor!==el){
    const a=all.indexOf(selAnchor), b=all.indexOf(el);
    if(a>=0&&b>=0){
      all.forEach(i=>i.classList.remove("sel"));
      for(let i=Math.min(a,b);i<=Math.max(a,b);i++) all[i].classList.add("sel");
      return;
    }
  }
  /* clicking inside an existing multi-selection keeps it, so the group can be
     dragged — collapsing to one on pointerdown made group drags impossible */
  if(!el.classList.contains("sel")||selIcons().length<=1) selectOnly(el);
  selAnchor=el;
}
/* Dragging with the RIGHT button and letting go asks what you meant. XP's
   quiet power feature, and the only way to make a shortcut without the wizard. */
function rightDrag(el,ic,e){
  const sx=e.clientX, sy=e.clientY;
  const ox=parseFloat(el.style.left), oy=parseFloat(el.style.top);
  let moved=false;
  const mv=ev=>{
    const dx=ev.clientX-sx, dy=ev.clientY-sy;
    if(!moved&&dx*dx+dy*dy<64) return;
    moved=true; el.style.opacity=".6";
    el.style.left=(ox+dx)+"px"; el.style.top=(oy+dy)+"px";
  };
  const up=ev=>{
    removeEventListener("pointermove",mv,true); removeEventListener("pointerup",up,true);
    el.style.opacity="";
    if(!moved) return;
    const dropX=ev.clientX, dropY=ev.clientY;
    const home=()=>{ el.style.left=ox+"px"; el.style.top=oy+"px"; };
    const land=nu=>{
      const maxC=Math.max(0,Math.floor((W-GX-72)/CELLW)), maxR=Math.max(0,Math.floor((H-GY-84)/CELLH));
      let c=clamp(Math.round((dropX-GX-36)/CELLW),0,maxC), r=clamp(Math.round((dropY-GY-40)/CELLH),0,maxR);
      let g=0; while(!cellFree(c,r,nu.id)&&g++<300){ r++; if(r>maxR){ r=0; c=c+1>maxC?0:c+1; } }
      store.data.icons[nu.id]={c,r}; store.save(); renderIcons();
    };
    /* the menu is modal in spirit: any dismissal puts the icon back */
    let acted=false;
    showMenu([
      {label:"Move Here",bold:1,disabled:!!ic.sys,action:()=>{ acted=true; land(ic); }},
      {label:"Copy Here",disabled:!!ic.sys,action:()=>{
        acted=true; home();
        const nu=copyOf(ic,ic.label);
        store.data.userIcons.push(nu); store.save(); renderIcons(); land(nu);
      }},
      {label:"Create Shortcuts Here",action:()=>{
        acted=true; home();
        const nu=Object.assign({},ic,{id:"user_"+userN++,label:ic.label+" - Shortcut",sys:0,lnk:1});
        delete nu._dc; delete nu._dr;
        store.data.userIcons.push(nu); store.save(); renderIcons(); land(nu);
      }},
      {sep:1},
      {label:"Cancel",action:()=>{ acted=true; home(); }},
    ],dropX,dropY);
    /* dismissing the menu without choosing is a cancel */
    setTimeout(()=>{
      const watch=setInterval(()=>{
        if(ctx.style.display==="block") return;
        clearInterval(watch); if(!acted) home();
      },120);
    },0);
  };
  addEventListener("pointermove",mv,true); addEventListener("pointerup",up,true);
}
function hookIcon(el,ic){
  el.addEventListener("pointerdown",e=>{
    if(e.button===2){
      if(!el.classList.contains("sel")) selectOnly(el);
      rightDrag(el,ic,e);
      return;
    }
    e.stopPropagation();
    selectWith(el,e);
    const sx=e.clientX, sy=e.clientY;
    const ox=parseFloat(el.style.left), oy=parseFloat(el.style.top);
    /* everything selected travels together, each keeping its own offset */
    const crew=selIcons().filter(o=>o!==el).map(o=>({el:o,id:o.dataset.iid,
      x:parseFloat(o.style.left),y:parseFloat(o.style.top)}));
    let moved=false;
    const mv=ev=>{
      const dx=ev.clientX-sx, dy=ev.clientY-sy;
      if(!moved&&dx*dx+dy*dy<(e.pointerType==="touch"?196:25)) return;
      if(!moved){ crew.forEach(o=>{ o.el.classList.add("dragging"); o.el.style.zIndex="89"; }); }
      moved=true; el.style.opacity=".6"; el.style.zIndex="90";
      el.style.left=(ox+dx)+"px"; el.style.top=(oy+dy)+"px";
      for(const o of crew){ o.el.style.left=(o.x+dx)+"px"; o.el.style.top=(o.y+dy)+"px"; }
    };
    const cancel=()=>{
      removeEventListener("pointermove",mv); removeEventListener("pointerup",up); removeEventListener("pointercancel",cancel);
      el.style.opacity=""; el.style.zIndex="";
      crew.forEach(o=>{ o.el.classList.remove("dragging"); o.el.style.zIndex=""; });
    };
    const up=ev0=>{
      removeEventListener("pointermove",mv); removeEventListener("pointerup",up); removeEventListener("pointercancel",cancel);
      el.style.opacity=""; el.style.zIndex="";
      if(!moved){
        /* on the phone the desktop is a launcher: one tap opens (unless this
           release is the tail end of a long-press that already opened a menu) */
        if(MOBILE&&e.pointerType==="touch"&&performance.now()-lpFiredAt>600&&performance.now()-menuDismissAt>500) openIcon(ic);
        /* Folder Options, "single-click to open an item" — it means the desktop too */
        else if(!MOBILE&&e.button===0&&!e.ctrlKey&&!e.shiftKey&&maint.fo().click==="single") openIcon(ic);
        return;
      }
      crew.forEach(o=>{ o.el.classList.remove("dragging"); o.el.style.zIndex=""; });
      /* a folder window under the pointer takes the drop instead of the desktop */
      if(dropIntoFolder(ev0,[ic].concat(crew.map(o=>iconById(o.id))).filter(Boolean))) return;
      if(store.data.autoArr){ arrangeIcons(store.data.iconSort); return; }   /* Auto Arrange wins: the grid re-packs itself */
      if(!store.data.alignGrid){
        /* Align to Grid off: the icon stays exactly where you dropped it, XP's one concession to chaos */
        store.data.icons[ic.id]={x:clamp(parseFloat(el.style.left),0,W-72),y:clamp(parseFloat(el.style.top),0,H-84)};
        store.save(); renderIcons(); return;
      }
      const maxC=Math.max(0,Math.floor((W-GX-72)/CELLW));
      const maxR=Math.max(0,Math.floor((H-GY-84)/CELLH));
      let c=clamp(Math.round((parseFloat(el.style.left)-GX)/CELLW),0,maxC);
      let r=clamp(Math.round((parseFloat(el.style.top)-GY)/CELLH),0,maxR);
      let guard=0;
      while(!cellFree(c,r,ic.id)&&guard++<300){ r++; if(r>maxR){ r=0; c=c+1>maxC?0:c+1; } }
      store.data.icons[ic.id]={c,r}; store.save();
      for(const o of crew){
        let cc=clamp(Math.round((parseFloat(o.el.style.left)-GX)/CELLW),0,maxC);
        let rr=clamp(Math.round((parseFloat(o.el.style.top)-GY)/CELLH),0,maxR);
        let g2=0;
        while(!cellFree(cc,rr,o.id)&&g2++<300){ rr++; if(rr>maxR){ rr=0; cc=cc+1>maxC?0:cc+1; } }
        store.data.icons[o.id]={c:cc,r:rr};
      }
      store.save();
      renderIcons();
    };
    addEventListener("pointermove",mv); addEventListener("pointerup",up); addEventListener("pointercancel",cancel);
  });
  el.addEventListener("dblclick",()=>{ sClick(); openIcon(ic); });
}
/* every folder in the shell now opens the real Explorer at a real path */
function openFolderWin(name){
  const p=name==="My Documents"?explorer.DOCS
    :name==="My Pictures"?explorer.PICS
    :explorer.HOME+"\\Desktop\\"+name;
  openWin("win-explorer");
  explorer.go(p);
}
function openIcon(ic){
  sysSnd("nav",.5);
  if(ic.app==="bin"){
    openWin("win-explorer"); explorer.go("Recycle Bin");
  }else if(ic.id==="computer"){
    /* the icon names a place, so it goes there — Explorer remembers its last
       path, and My Computer opening on the Recycle Bin is not My Computer */
    openWin("win-explorer"); explorer.go("My Computer");
  }else if(ic.app==="folder"){
    openFolderWin(ic.label);
  }else if(ic.app==="paintdoc"){
    /* double-click views; the viewer's pencil hands it to Paint — XP's split */
    write.openViewer(viewerList(),0);
  }else if(ic.app==="recwav"){
    const buf=recWavs.get(ic.id);
    if(!buf){ showError("Windows Media Player","Windows Media Player cannot play the file. The file is either corrupt or the Player does not support the format you are trying to play."); return; }
    const ac=new (window.AudioContext||window.webkitAudioContext)();
    const nsrc=ac.createBufferSource(); nsrc.buffer=buf;
    const g=ac.createGain(); g.gain.value=muted?0:masterVol*waveF();
    nsrc.connect(g).connect(ac.destination); nsrc.start();
  }else if(ic.app==="wavdoc"){
    showError("Windows Media Player","Windows Media Player cannot play the file. The file is either corrupt or the Player does not support the format you are trying to play.");
  }else if(ic.app==="run"){
    runNamed(ic.cmd);
  }else if(ic.app==="applnk"){
    openWin(ic.target);
  }else if(ic.app==="deadlnk"){
    showError("Problem with Shortcut",`The item '${(ic.loc||ic.label).split(/[\\/]/).pop()}' that this shortcut refers to has been changed or moved, so this shortcut will no longer work properly.

Do you want to delete this shortcut?`);
  }else if(ic.app==="usertxt"){
    /* .txt opens the real Notepad; .doc/.rtf open WordPad, like the OS says */
    if(/\.(doc|rtf)$/i.test(ic.label)) write.openWordpad(docForIcon(ic));
    else write.openNotepad(docForIcon(ic));
  }else openWin(ic.app);
}
$("#usertxtarea").addEventListener("input",()=>{
  if(curTxtIcon){ store.data.texts[curTxtIcon.id]=$("#usertxtarea").value; store.save(); }
});
let userN=(store.data.userIcons.reduce((m,i)=>Math.max(m,+(i.id.split("_")[1])||0),0))+1;
function newFolder(){
  const p=firstFreeCell();
  const ic={id:"user_"+userN++,label:"New Folder",ico:"folder32",app:"folder",kind:"folder"};
  store.data.userIcons.push(ic); store.data.icons[ic.id]=p; store.save();
  renderIcons(); startRename(ic);
}
function newTextDoc(){
  const p=firstFreeCell();
  const ic={id:"user_"+userN++,label:"New Text Document.txt",ico:"note32",app:"usertxt",kind:"txt"};
  store.data.userIcons.push(ic); store.data.icons[ic.id]=p; store.save();
  renderIcons(); startRename(ic);
}
function startRename(ic){
  const el=[...$("#icons").children].find(x=>x.dataset.iid===ic.id);
  if(!el) return;
  const lbl=el.querySelector(".lbl");
  const inp=document.createElement("input");
  inp.value=ic.label; inp.className="renamer";
  lbl.replaceWith(inp); inp.focus(); inp.select();
  let done=false;
  const commit=()=>{ if(done) return; done=true; ic.label=inp.value.trim()||ic.label; store.save(); renderIcons(); };
  inp.addEventListener("keydown",e=>{
  if(e.key==="F3"&&desktopActive()){ e.preventDefault(); openWin("win-explorer"); explorer.openSearch(); return; }
    e.stopPropagation();
    if(e.key==="Enter") commit();
    if(e.key==="Escape"){ done=true; renderIcons(); }
  });
  inp.addEventListener("blur",commit);
  inp.addEventListener("pointerdown",e=>e.stopPropagation());
}
function deleteIcon(ic){
  /* Recycle Bin Properties decides whether this asks first and whether the
     bin is even involved — both switches are that dialog's, and both are real */
  const nobin=maint.binOpt("nobin"), ask=maint.binOpt("confirm");
  if(ask){
    showConfirm(nobin?"Confirm File Delete":"Confirm File Delete",
      nobin?`Are you sure you want to permanently delete '${ic.label}'?`
           :`Are you sure you want to send '${ic.label}' to the Recycle Bin?`,
      ()=>reallyDelete(ic,nobin));
    return;
  }
  reallyDelete(ic,nobin);
}
function reallyDelete(ic,nobin){
  /* the whole icon goes in the bin, not just its name — otherwise Restore
     has nothing to put back, and a Recycle Bin that cannot restore is a joke */
  if(!nobin) binFiles.unshift(Object.assign({},ic));
  store.data.userIcons=store.data.userIcons.filter(u=>u.id!==ic.id);
  delete store.data.icons[ic.id];
  store.save(); renderBin(); renderIcons(); sCrunch();
}
/* every file lies about its size, but it lies consistently */
function fakeKB(ic){ let h=0; for(const ch of ic.id) h=(h*31+ch.charCodeAt(0))>>>0; return 1+h%940; }
function iconType(ic){ return ic.kind==="folder"?"File Folder":ic.kind==="bmp"?"Bitmap Image":ic.kind==="wav"?"Wave Sound":ic.kind==="lnk"?"Shortcut":ic.sys?"Application":"Text Document"; }
function arrangeIcons(mode){
  const list=allIcons().slice();
  const byName=(a,b)=>a.label.toLowerCase().localeCompare(b.label.toLowerCase());
  if(mode==="size") list.sort((a,b)=>fakeKB(a)-fakeKB(b)||byName(a,b));
  else if(mode==="type") list.sort((a,b)=>iconType(a).localeCompare(iconType(b))||byName(a,b));
  else if(mode==="modified") list.sort((a,b)=>(+(a.id.split("_")[1])||-1)-(+(b.id.split("_")[1])||-1));
  else list.sort(byName);
  if(mode==="name"||mode==="size"||mode==="type"||mode==="modified"){ store.data.iconSort=mode; }
  const rows=Math.max(1,Math.floor((H-GY-70)/CELLH)+1);
  store.data.icons={};
  list.forEach((ic,i)=>{ store.data.icons[ic.id]={c:Math.floor(i/rows),r:i%rows}; });
  store.save(); renderIcons(); sClick();
}
function refreshDesktop(){
  $("#icons").style.visibility="hidden"; sClick();
  setTimeout(()=>{ $("#icons").style.visibility=""; },90);
}

/* ================= marquee select ================= */
const marquee=$("#marquee");
desktop.addEventListener("pointerdown",e=>{
  if(e.target.closest(".icon,.window,#taskbar,#startmenu,#balloon,#ctx")) return;
  /* Ctrl+band adds to the selection instead of replacing it */
  const keep=(e.ctrlKey||e.metaKey)?selIcons():[];
  if(!keep.length) selectOnly(null);
  closeStart();
  if(e.pointerType==="touch") return;
  if(e.button===2) return;
  const sx=e.clientX, sy=e.clientY;
  const move=ev=>{
    marquee.style.display="block";
    const l=Math.min(sx,ev.clientX), t=Math.min(sy,ev.clientY);
    const w=Math.abs(ev.clientX-sx), h=Math.abs(ev.clientY-sy);
    marquee.style.left=l+"px"; marquee.style.top=t+"px";
    marquee.style.width=w+"px"; marquee.style.height=h+"px";
    for(const el of $("#icons").children){
      const r=el.getBoundingClientRect();
      const hit=r.left<l+w&&r.right>l&&r.top<t+h&&r.bottom>t;
      el.classList.toggle("sel",hit||keep.includes(el));
    }
  };
  const up=()=>{marquee.style.display="none";removeEventListener("pointermove",move);removeEventListener("pointerup",up);};
  addEventListener("pointermove",move); addEventListener("pointerup",up);
});

/* ================= Solitaire ================= */
/* rjanjic's MIT js-solitaire, which already wears the classic Windows deck.
   Same recipe as pinball: lazy iframe, our chrome, their game. */
/* The vendored Solitaire is from 2013 and speaks onmousedown/onmousemove only.
   A phone never sends those for a drag, so the game was unplayable by touch:
   this bridges one finger onto the three mouse events it listens for. It is
   injected into the frame, which is same-origin, so no fork of the game. */
function solitaireTouch(d){
  const send=(type,t)=>{
    const el=d.elementFromPoint(t.clientX,t.clientY)||d.body;
    el.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,
      clientX:t.clientX,clientY:t.clientY,button:0,buttons:type==="mouseup"?0:1}));
  };
  let down=null;
  d.addEventListener("touchstart",e=>{
    if(e.touches.length!==1) return;
    down=e.touches[0]; e.preventDefault(); send("mousedown",down);
  },{passive:false});
  d.addEventListener("touchmove",e=>{
    if(!down||e.touches.length!==1) return;
    e.preventDefault(); send("mousemove",e.touches[0]);
  },{passive:false});
  d.addEventListener("touchend",e=>{
    if(!down) return;
    const t=e.changedTouches[0];
    e.preventDefault(); send("mouseup",t);
    /* a tap is a click as well: the deck and the auto-move both want one */
    if(Math.abs(t.clientX-down.clientX)<8&&Math.abs(t.clientY-down.clientY)<8) send("click",t);
    down=null;
  },{passive:false});
}
/* seven columns of cards need ~700px. A phone has 390. Scale the board rather
   than clip it — the frame is laid out at full width and shrunk to fit, which
   keeps every column on screen and keeps touch coordinates correct. */
function solitaireFit(fr,d){
  const fit=()=>{
    const host=fr.parentElement;
    if(!host) return;
    /* the felt runs to the edges of the window instead of stopping where the
       game's own page does */
    try{
      const board=d.querySelector(".window__content")||d.body;
      const bg=d.defaultView.getComputedStyle(board).backgroundColor;
      if(bg&&bg!=="rgba(0, 0, 0, 0)") host.style.background=bg;
    }catch(e){}
    const w=host.clientWidth, h=host.clientHeight;
    const need=(d&&d.body&&d.body.scrollWidth)||700;
    const sc=Math.min(1,w/Math.max(560,need));
    fr.style.width=Math.round(w/sc)+"px";
    fr.style.height=Math.round(h/sc)+"px";
    fr.style.transformOrigin="0 0";
    fr.style.transform=sc<1?"scale("+sc+")":"";
  };
  fit();
  if(solitaireFit._prev) removeEventListener("resize",solitaireFit._prev);
  solitaireFit._prev=fit;
  addEventListener("resize",fit);
  setTimeout(fit,400);
}
function solitaireOpen(){
  const fr=$("#solitaire-frame");
  if(!fr.dataset.live){
    fr.dataset.live="1";
    fr.src="solitaire/";   /* same trailing-slash rule as pinball */
    fr.addEventListener("load",()=>{
      try{
        const d=fr.contentDocument;
        const st=d.createElement("style");
        st.textContent=".window__heading{display:none!important}"+
          "html,body{margin:0!important;background:transparent!important}"+
          ".window{border:0!important;box-shadow:none!important;background:transparent!important}";
        d.head.appendChild(st);
        d.addEventListener("pointerdown",()=>{ try{ focusWin("win-solitaire"); }catch(e){} },true);
        solitaireTouch(d);
        solitaireFit(fr,d);
        solb.arm(fr);
      }catch(e){}
    },{once:true});
  }
  openWin("win-solitaire");
}
/* ================= file operations ================= */
/* XP never moved a file without showing you it moving. Every multi-item shell
   operation runs through here: the flying-paper animation, the segmented bar,
   a per-item caption, and a Cancel that stops where it got to and leaves the
   rest alone — which is what XP's Cancel actually did. Nothing here touches
   money; it is the desktop's own filing cabinet. */
let fileOpT=null, fileOpCancel=false;
function fileOp(opts){
  const items=opts.items||[];
  const each=opts.each||(()=>{});
  const per=Math.max(90,Math.min(420,Math.round(1400/Math.max(1,items.length))));
  fileOpCancel=false;
  $("#copy-title").textContent=opts.title||"Copying...";
  $("#copy-bar").style.width="0%";
  $("#copy-line").textContent=opts.line||"";
  $("#copy-sub").textContent="";
  const anim=$("#win-copy .cpy-anim");
  anim.classList.remove("done");
  const ico=u=>u?`url("${u}")`:"";
  $("#win-copy .cpy-src").style.backgroundImage=ico(opts.fromIcon||IMG.openfolder32);
  $("#win-copy .cpy-dst").style.backgroundImage=ico(opts.toIcon||IMG.folder32);
  openWin("win-copy",{silent:true});
  let i=0;
  const step=()=>{
    if(fileOpCancel||i>=items.length){
      clearTimeout(fileOpT); anim.classList.add("done");
      const done=i;
      closeWin("win-copy");
      if(opts.then) opts.then(done,fileOpCancel);
      return;
    }
    const it=items[i++];
    try{ each(it,i-1); }catch(e){}
    $("#copy-bar").style.width=Math.round(100*i/items.length)+"%";
    $("#copy-sub").textContent=(opts.label?opts.label(it):String(it))+"   ("+i+" of "+items.length+")";
    fileOpT=setTimeout(step,per);
  };
  fileOpT=setTimeout(step,per);
}
$("#copy-cancel").addEventListener("click",()=>{ fileOpCancel=true; });

/* dropping desktop icons onto an open folder window files them there */
function dropIntoFolder(ev,ics){
  if(!ev||!ics||!ics.length) return false;
  const el=document.elementFromPoint(ev.clientX,ev.clientY);
  const win=el&&el.closest&&el.closest("#win-explorer");
  if(!win||win.style.display==="none") return false;
  const dest=explorer.path?explorer.path():null;
  /* My Documents is the one folder with a real receiving list behind it
     (the same one Send To fills), so it is the one that accepts a drop */
  if(dest!==explorer.DOCS){ renderIcons(); return true; }
  const movable=ics.filter(i=>i&&!i.sys);
  if(!movable.length){
    showError("Move Items","These are system folders and cannot be moved.");
    renderIcons(); return true;
  }
  store.data.sentDocs=store.data.sentDocs||[];
  fileOp({title:"Moving...",line:"Moving "+(movable.length===1?"1 item":movable.length+" items")+" to My Documents",
    fromIcon:IMG.openfolder32,toIcon:IMG.docs32,
    label:i=>i.label,items:movable,
    each:ic=>{
      if(!store.data.sentDocs.some(d=>d.label===ic.label))
        store.data.sentDocs.push({label:ic.label,ico:ic.ico,kind:ic.kind||"txt"});
      store.data.userIcons=store.data.userIcons.filter(u=>u!==ic);
      delete store.data.icons[ic.id];
    },
    then:()=>{ store.save(); renderIcons(); explorer.render(); sysSnd("nav",.4); }});
  return true;
}

/* ================= shared dialogs ================= */
let confirmCb=null;
function showError(title,text,quiet){
  try{ access.narrate&&access.narrate(String(title)+". "+String(text)); }catch(e){}
  $("#win-error .title-bar-text").textContent=title;
  $("#errtext").textContent=text;
  openWin("win-error",{silent:true});
  if(!quiet) sError();
}
/* dialogs answer the keyboard: Enter = OK/Yes, Escape = close/No */
addEventListener("keydown",e=>{
  if(e.key!=="Enter"&&e.key!=="Escape") return;
  if(e.target.closest("input,textarea,select")) return;
  const err=openApps.has("win-error"), conf=openApps.has("win-confirm");
  if(!err&&!conf) return;
  e.preventDefault();
  const zc=conf?+document.getElementById("win-confirm").style.zIndex||0:-1;
  const ze=err?+document.getElementById("win-error").style.zIndex||0:-1;
  if(conf&&zc>=ze){ $(e.key==="Enter"?"#conf-yes":"#conf-no").click(); }
  else closeWin("win-error");
});
function showConfirm(title,text,cb){
  $("#win-confirm .title-bar-text").textContent=title;
  $("#conftext").textContent=text;
  confirmCb=cb; openWin("win-confirm");
}
function showProps(ic){
  const host=$("#prop-ico"); host.innerHTML=""; host.appendChild(icoNode(ic.ico));
  $("#prop-name").textContent=ic.label;
  const type=iconType(ic);
  const kb=ic.sys?4:fakeKB(ic);
  $("#prop-rows").innerHTML=`Type: <b>${type}</b><br>Location: <b>C:\\Documents and Settings\\Administrator\\Desktop</b><br>Size: <b>${kb.toFixed(2)} KB (${(kb*1024).toLocaleString("en-US")} bytes)</b><br>Created: <b>Tuesday, August 24, 2001</b>`;
  openWin("win-props");
}
$("#err-ok").addEventListener("click",()=>closeWin("win-error"));
$("#prop-ok").addEventListener("click",()=>closeWin("win-props"));
$("#conf-yes").addEventListener("click",()=>{ const cb=confirmCb; confirmCb=null; closeWin("win-confirm"); if(cb) cb(); });
$("#conf-no").addEventListener("click",()=>{ confirmCb=null; closeWin("win-confirm"); });
function emptyBin(){
  if(binEmpty()){ showError("Recycle Bin","The Recycle Bin is already empty."); return; }
  const n=binDead.length+binFiles.length;
  const worth=binDead.reduce((s,d)=>s+d.lost,0);
  showConfirm("Confirm Multiple File Delete",
    `Are you sure you want to delete these ${n} items?`+
    (binDead.length?`\n\n${binDead.length} dead cursors, ${fmtS(worth)} SOL. No refund.`:""),
    ()=>{
      const all=binFiles.map(f=>f.label).concat(binDead.map(d=>d.name+"_"+String(d.id).padStart(4,"0")+".cur"));
      fileOp({title:"Deleting...",line:"Deleting "+all.length+" items",
        fromIcon:IMG.bin32,toIcon:IMG.bin32,items:all,label:x=>x,
        then:()=>{ binDead=[]; binFiles=[]; renderBin(); syncBinIcon(diskPct().f); sCrunch(); }});
    });
}

/* ---- Run As ---- */
let runAsIc=null;
function runAsDialog(ic){
  runAsIc=ic;
  $("#ras-user").textContent=(store.data.userName||"Administrator");
  $("#ras-cur").checked=true; $("#ras-other").checked=false;
  $("#ras-name").disabled=$("#ras-pass").disabled=true;
  openWin("win-runas");
}
$("#ras-cur").addEventListener("change",()=>{ $("#ras-name").disabled=$("#ras-pass").disabled=true; });
$("#ras-other").addEventListener("change",()=>{ $("#ras-name").disabled=$("#ras-pass").disabled=false; $("#ras-name").focus(); });
$("#ras-ok").addEventListener("click",()=>{
  const other=$("#ras-other").checked, who=$("#ras-name").value.trim();
  closeWin("win-runas");
  if(other){
    showError("Run As",`Unable to log on: ${who||"user"}.

Logon failure: unknown user name or bad password.`);
    return;
  }
  if(runAsIc) openIcon(runAsIc);
});
$("#ras-cancel").addEventListener("click",()=>closeWin("win-runas"));

/* ---- Create Shortcut wizard ---- */
let scwPage=1;
function shortcutWizard(){
  scwPage=1; $("#scw-loc").value=""; $("#scw-name").value="";
  scwShow(); openWin("win-shortcutwiz");
  setTimeout(()=>$("#scw-loc").focus(),50);
}
function scwShow(){
  $("#scw-p1").style.display=scwPage===1?"":"none";
  $("#scw-p2").style.display=scwPage===2?"":"none";
  $("#scw-back").disabled=scwPage===1;
  $("#scw-next").textContent=scwPage===2?"Finish":"Next >";
}
/* what a typed location resolves to: known .exe names land on real apps */
const SCW_APPS={"cursors.exe":"win-cursors","iexplore.exe":"win-ie","mspaint.exe":"win-paint",
  "winmine.exe":"win-mine","msnmsgr.exe":"win-chat","notepad.exe":"win-readme","cmd.exe":"win-cmd",
  "taskmgr.exe":"win-taskmgr","services.msc":"win-services","gpedit.msc":"win-gpedit","winamp.exe":"win-amp"};
function scwResolve(loc){
  const base=loc.toLowerCase().split(/[\\/]/).pop();
  return SCW_APPS[base]||null;
}
$("#scw-browse").addEventListener("click",()=>{ openWin("win-explorer"); explorer.go("C:\\"); });
$("#scw-back").addEventListener("click",()=>{ scwPage=1; scwShow(); });
$("#scw-next").addEventListener("click",()=>{
  if(scwPage===1){
    const loc=$("#scw-loc").value.trim();
    if(!loc){ showError("Create Shortcut","You must type a location. To continue, type the location of the item and then click Next."); return; }
    $("#scw-name").value=loc.split(/[\/]/).pop().replace(/\.[a-z0-9]+$/i,"")||loc;
    scwPage=2; scwShow(); setTimeout(()=>{ $("#scw-name").focus(); $("#scw-name").select(); },50);
    return;
  }
  const loc=$("#scw-loc").value.trim(), nm=$("#scw-name").value.trim()||"New Shortcut";
  const ic={id:"user_"+userN++,label:nm,ico:"note32",app:"deadlnk",kind:"lnk",target:scwResolve(loc),loc};
  if(ic.target){ ic.app="applnk"; ic.ico=(SMAPPS[ic.target]||{}).ico||"note32"; }
  store.data.userIcons.push(ic); store.data.icons[ic.id]=firstFreeCell(); store.save();
  renderIcons(); closeWin("win-shortcutwiz"); sysSnd("nav",.4);
});
$("#scw-cancel").addEventListener("click",()=>closeWin("win-shortcutwiz"));

/* ---- Desktop Cleanup Wizard ---- */
let dcwPage=1;
function cleanupWizard(){
  dcwPage=1; dcwShow(); openWin("win-cleanup");
}
function dcwShow(){
  $("#dcw-p1").style.display=dcwPage===1?"":"none";
  $("#dcw-p2").style.display=dcwPage===2?"":"none";
  $("#dcw-p3").style.display=dcwPage===3?"":"none";
  $("#dcw-back").disabled=dcwPage===1;
  $("#dcw-next").textContent=dcwPage===3?"Finish":"Next >";
  if(dcwPage===2){
    const host=$("#dcw-list"); host.innerHTML="";
    const cand=store.data.userIcons.filter(ic=>!ic.unused);
    if(!cand.length) host.innerHTML='<div style="padding:8px" class="dim">There are no unused shortcuts on your desktop.</div>';
    for(const ic of cand){
      const row=document.createElement("label");
      row.style.cssText="display:flex;gap:6px;align-items:center;padding:2px 6px";
      row.innerHTML=`<input type="checkbox" data-uid="${ic.id}"> <span></span> <span class="dim" style="margin-left:auto">Never</span>`;
      row.children[1].textContent=ic.label;
      host.appendChild(row);
    }
  }
  if(dcwPage===3){
    const ids=[...$("#dcw-list").querySelectorAll("input:checked")].map(i=>i.dataset.uid);
    $("#dcw-sum").textContent=ids.length
      ? store.data.userIcons.filter(ic=>ids.includes(ic.id)).map(ic=>ic.label).join("\n")
      : "(none)";
    $("#dcw-sum").style.whiteSpace="pre-line";
  }
}
$("#dcw-back").addEventListener("click",()=>{ dcwPage--; dcwShow(); });
$("#dcw-next").addEventListener("click",()=>{
  if(dcwPage<3){ dcwPage++; dcwShow(); return; }
  const ids=[...$("#dcw-list").querySelectorAll("input:checked")].map(i=>i.dataset.uid);
  if(ids.length){
    const moved=store.data.userIcons.filter(ic=>ids.includes(ic.id));
    store.data.userIcons=store.data.userIcons.filter(ic=>!ids.includes(ic.id));
    for(const ic of moved){ delete store.data.icons[ic.id]; store.data.unusedIcons.push(ic); }
    /* the folder itself appears on the desktop once something is in it */
    if(!store.data.userIcons.some(ic=>ic.id==="unusedfld")){
      store.data.userIcons.push({id:"unusedfld",label:"Unused Desktop Shortcuts",ico:"folder32",app:"folder",kind:"folder"});
      store.data.icons.unusedfld=firstFreeCell();
    }
    store.save(); renderIcons();
  }
  closeWin("win-cleanup"); sysSnd("nav",.4);
});
$("#dcw-cancel").addEventListener("click",()=>closeWin("win-cleanup"));

/* ================= context menus ================= */
const ctx=$("#ctx");
let menuShownAt=0; /* a long-press opens the menu under the finger — the release must not pick an item */
let ctxArmed=false;   /* touch may only pick an item with a tap that STARTED on the open menu */
let menuDismissAt=0;  /* the tap that dismissed a menu must not also click what was under it */
function buildMenu(host,items){
  for(const it of items){
    if(!it) continue;   /* menus may hold conditional entries */
    if(it.sep){ const s=document.createElement("div"); s.className="csep"; host.appendChild(s); continue; }
    const d=document.createElement("div");
    d.className="cit"+(it.disabled?" dis":"")+(it.bold?" bold":"")+(it.check?" chk":"");
    const lb=document.createElement("span"); lb.className="clabel"; lb.textContent=it.label;
    d.appendChild(lb);
    if(it.accel){ const a=document.createElement("span"); a.className="caccel"; a.textContent=it.accel; d.appendChild(a); }
    if(it.sub){
      d.classList.add("has-sub");
      const sub=document.createElement("div"); sub.className="csub";
      buildMenu(sub,it.sub); d.appendChild(sub);
      /* a submenu longer than the screen is unreadable and unclickable; XP
         shifts it up to fit and flips it left of the parent when the right
         edge runs out. visibility:hidden still has layout, so measuring
         before the hover reveal is safe. */
      d.addEventListener("mouseenter",()=>{
        sub.style.top=""; sub.style.left=""; sub.style.right="";
        sub.style.maxHeight=""; sub.style.overflowY="";
        const r=sub.getBoundingClientRect();
        if(r.height>innerHeight-12){ sub.style.maxHeight=(innerHeight-12)+"px"; sub.style.overflowY="auto"; }
        const r2=sub.getBoundingClientRect();
        const over=r2.bottom-(innerHeight-6);
        if(over>0) sub.style.top=(-3-over)+"px";
        if(r2.right>innerWidth-4){ sub.style.left="auto"; sub.style.right="100%"; }
      });
    }
    if(!it.disabled&&it.action) d.addEventListener("pointerup",e=>{
      if(e.pointerType==="touch"&&(!ctxArmed||performance.now()-menuShownAt<120)) return;
      e.stopPropagation(); hideMenu(); sClick(); it.action();
    });
    host.appendChild(d);
  }
}
function showMenu(items,x,y){
  menuShownAt=performance.now(); ctxArmed=false;
  ctx.innerHTML=""; buildMenu(ctx,items);
  ctx.style.display="block"; ctx.style.left="0px"; ctx.style.top="0px";
  ctx.style.maxHeight=""; ctx.style.overflowY="";
  let r=ctx.getBoundingClientRect();
  if(r.height>innerHeight-8){
    /* submenus inside a scrolling root would clip, but a menu nobody can
       read clips harder; the shift-up path below handles the normal case */
    ctx.style.maxHeight=(innerHeight-8)+"px"; ctx.style.overflowY="auto";
    r=ctx.getBoundingClientRect();
  }
  ctx.style.left=Math.min(x,innerWidth-r.width-4)+"px";
  ctx.style.top=Math.max(4,Math.min(y,innerHeight-r.height-4))+"px";
  sMenu();
}
function hideMenu(){ ctx.style.display="none"; ctx.querySelectorAll(".kbd").forEach(e=>e.classList.remove("kbd")); }
/* menus walk with the keyboard, exactly as far as XP let them */
addEventListener("keydown",e=>{
  if(ctx.style.display!=="block") return;
  if(e.key==="Escape"){ hideMenu(); e.preventDefault(); return; }
  /* the deepest open (hovered or keyboard-entered) menu level owns the keys */
  let host=ctx;
  for(;;){ const nxt=host.querySelector(":scope>.cit.kbd>.csub.open, :scope>.cit:hover>.csub"); if(nxt&&getComputedStyle(nxt).visibility!=="hidden") host=nxt; else break; }
  const its=[...host.children].filter(c=>c.classList.contains("cit")&&!c.classList.contains("dis"));
  if(!its.length) return;
  const cur=its.findIndex(c=>c.classList.contains("kbd"));
  const setK=i=>{ its.forEach(c=>c.classList.remove("kbd")); its[(i+its.length)%its.length].classList.add("kbd"); };
  if(e.key==="ArrowDown"){ setK(cur+1); e.preventDefault(); }
  else if(e.key==="ArrowUp"){ setK(cur<0?its.length-1:cur-1); e.preventDefault(); }
  else if(e.key==="ArrowRight"&&cur>=0&&its[cur].classList.contains("has-sub")){
    its[cur].querySelector(".csub").classList.add("open"); e.preventDefault();
  }
  else if(e.key==="ArrowLeft"&&host!==ctx){ host.classList.remove("open"); host.closest(".cit").classList.add("kbd"); e.preventDefault(); }
  else if(e.key==="Enter"&&cur>=0){ its[cur].dispatchEvent(new PointerEvent("pointerup",{bubbles:true})); e.preventDefault(); }
},true);
addEventListener("pointerdown",e=>{
  if(!e.target.closest("#ctx")){ if(ctx.style.display==="block") menuDismissAt=performance.now(); hideMenu(); }
  else ctxArmed=true;
},true);
/* ---- the shell clipboard: Cut/Copy/Paste on desktop icons ---- */
let clip=null;   /* {mode:"copy"|"cut", ic} */
function copyOf(ic,label){
  const nu=Object.assign({},ic,{id:"user_"+userN++,label:label||ic.label,sys:0});
  delete nu._dc; delete nu._dr;
  return nu;
}
function pasteClip(asShortcut){
  if(!clip) return;
  const src=clip.ic;
  if(asShortcut){
    const nu=copyOf(src,src.label+" - Shortcut");
    nu.kind="lnk"; nu.shortcut=1;
    store.data.userIcons.push(nu); store.data.icons[nu.id]=firstFreeCell();
  }else if(clip.mode==="cut"&&!src.sys){
    /* a desktop-to-desktop move: the icon just lands at the next free cell */
    store.data.icons[src.id]=firstFreeCell(); clip=null;
  }else{
    const nu=copyOf(src,"Copy of "+src.label);
    if(src.kind==="txt") store.data.texts[nu.id]=store.data.texts[src.id]||"";
    store.data.userIcons.push(nu); store.data.icons[nu.id]=firstFreeCell();
  }
  store.save(); renderIcons();
}
/* ---- the New submenu factory: every document type XP offered ---- */
function newItem(kind){
  const p=firstFreeCell();
  const DEF={
    folder:{label:"New Folder",ico:"folder32",app:"folder"},
    briefcase:{label:"New Briefcase",ico:"folder32",app:"folder"},
    bmp:{label:"New Bitmap Image.bmp",ico:"bmpdoc32",app:"paintdoc"},
    doc:{label:"New WordPad Document.doc",ico:"writedoc16",app:"usertxt"},
    rtf:{label:"New Rich Text Document.rtf",ico:"writedoc16",app:"usertxt"},
    txt:{label:"New Text Document.txt",ico:"note32",app:"usertxt"},
    wav:{label:"New Wave Sound.wav",ico:"wavdoc16",app:"wavdoc"},
    zip:{label:"New Compressed (zipped) Folder.zip",ico:"folder32",app:"folder"},
  }[kind];
  const ic=Object.assign({id:"user_"+userN++,kind},DEF);
  store.data.userIcons.push(ic); store.data.icons[ic.id]=p; store.save();
  renderIcons(); startRename(ic);
}
function desktopMenu(){
  return [
    {label:"Arrange Icons By",sub:[
      {label:"Name",action:()=>arrangeIcons("name")},
      {label:"Size",action:()=>arrangeIcons("size")},
      {label:"Type",action:()=>arrangeIcons("type")},
      {label:"Modified",action:()=>arrangeIcons("modified")},
      {sep:1},
      {label:"Show in Groups",disabled:1},
      {label:"Auto Arrange",check:!!store.data.autoArr,action(){ store.data.autoArr=store.data.autoArr?0:1; if(store.data.autoArr) arrangeIcons(store.data.iconSort); store.save(); }},
      {label:"Align to Grid",check:!!store.data.alignGrid,action(){ store.data.alignGrid=store.data.alignGrid?0:1; store.save(); }},
      {sep:1},
      {label:"Show Desktop Icons",check:!!store.data.showIcons,action(){ store.data.showIcons=store.data.showIcons?0:1; store.save(); renderIcons(); }},
      {label:"Lock Web Items on Desktop",check:!!store.data.lockWeb,action(){ store.data.lockWeb=store.data.lockWeb?0:1; store.save(); }},
      {sep:1},
      {label:"Run Desktop Cleanup Wizard",action:cleanupWizard}]},
    {label:"Refresh",action:refreshDesktop},
    {sep:1},
    {label:"Paste",disabled:!clip,action:()=>pasteClip(false)},
    {label:"Paste Shortcut",disabled:!clip,action:()=>pasteClip(true)},
    binFiles.length?{label:"Undo Delete",accel:"Ctrl+Z",action:()=>restoreOne(binFiles[0])}:{label:"Undo",accel:"Ctrl+Z",disabled:1},
    {sep:1},
    {label:"New",sub:[
      {label:"Folder",action:()=>newItem("folder")},
      {label:"Shortcut",action:shortcutWizard},
      {sep:1},
      {label:"Briefcase",action:()=>newItem("briefcase")},
      {label:"Bitmap Image",action:()=>newItem("bmp")},
      {label:"WordPad Document",action:()=>newItem("doc")},
      {label:"Rich Text Document",action:()=>newItem("rtf")},
      {label:"Text Document",action:()=>newItem("txt")},
      {label:"Wave Sound",action:()=>newItem("wav")},
      {label:"Compressed (zipped) Folder",action:()=>newItem("zip")},
      {sep:1},
      {label:"Cursor (0.1 SOL)",action:()=>{ openWin("win-cursors"); deploy(false); }}]},
    {sep:1},
    {label:"Properties",action:()=>openWin("win-dispprops")}
  ];
}
function sendToMenu(ic){
  return [
    {label:"Compressed (zipped) Folder",action(){
      const nu=copyOf(ic,ic.label.replace(/\.[a-z]+$/i,"")+".zip");
      nu.kind="folder"; nu.app="folder"; nu.ico="folder32";
      store.data.userIcons.push(nu); store.data.icons[nu.id]=firstFreeCell();
      store.save(); renderIcons();
    }},
    {label:"Desktop (create shortcut)",action(){ clip={mode:"copy",ic}; pasteClip(true); clip=null; }},
    {label:"Mail Recipient",action:()=>openWin("win-chat")},
    {label:"My Documents",action(){
      store.data.sentDocs=store.data.sentDocs||[];
      if(!store.data.sentDocs.some(d=>d.label===ic.label)) store.data.sentDocs.push({label:ic.label,ico:ic.ico,kind:ic.kind||"txt"});
      store.save();
      if(openApps.has("win-explorer")) explorer.render();
    }},
    {sep:1},
    {label:"3½ Floppy (A:)",action:()=>showError(ic.label,
      "A:\\ is not accessible.\n\nThe device is not ready.")},
  ];
}
function iconMenu(ic){
  const items=[{label:"Open",bold:1,action:()=>openIcon(ic)}];
  if(ic.id==="recycle"){
    items.push({label:"Explore",action:()=>{ openWin("win-explorer"); explorer.go("Recycle Bin"); }});
    items.push({label:"Empty Recycle Bin",disabled:binEmpty(),action:emptyBin});
    items.push({label:"Hall of Pain",action:()=>hallOfPain()});
  }
  if(ic.id==="computer"){
    items.push({label:"Explore",action:()=>{ openWin("win-explorer"); explorer.go("C:\\"); }});
    items.push({label:"Search...",action:()=>{ openWin("win-explorer"); explorer.openSearch(); }});
    items.push({label:"Manage",action:()=>openWin("win-services")});
  }
  if(ic.sys&&ic.app&&ic.app.indexOf("win-")===0) items.push({label:"Run as...",action:()=>runAsDialog(ic)});
  items.push({sep:1});
  items.push({label:"Send To",sub:sendToMenu(ic)});
  items.push({sep:1});
  items.push({label:"Cut",disabled:!!ic.sys,action(){ clip={mode:"cut",ic}; }});
  items.push({label:"Copy",action(){ clip={mode:"copy",ic}; }});
  items.push({sep:1});
  items.push({label:"Create Shortcut",action(){ clip={mode:"copy",ic}; pasteClip(true); clip=null; }});
  if(ic.sys){
    /* the real strings: XP refused politely and blamed the disk */
    items.push({label:"Delete",action:()=>showError("Error Deleting File or Folder",
      `Cannot delete ${ic.label}: Access is denied.\n\nMake sure the disk is not full or write-protected and that the file is not currently in use.`)});
    items.push({label:"Rename",action:()=>showError("Error Renaming File or Folder",
      `Cannot rename ${ic.label}: Access is denied.\n\nMake sure the disk is not full or write-protected and that the file is not currently in use.`)});
  }else{
    items.push({label:"Delete",action:()=>deleteIcon(ic)});
    items.push({label:"Rename",action:()=>startRename(ic)});
  }
  items.push({sep:1},{label:"Properties",action:()=>ic.id==="recycle"?maint.openBinProps():showProps(ic)});
  return items;
}
/* Move and Size drive the window with the arrow keys, exactly like Alt+Space M did */
function kbdWinDrive(id,mode){
  const el=document.getElementById(id); if(!el) return;
  const orig={l:el.offsetLeft,t:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight};
  const minw=+(el.dataset.minw||232), minh=+(el.dataset.minh||130);
  const onKey=e=>{
    e.preventDefault(); e.stopPropagation();
    const d=e.shiftKey?1:8;
    if(e.key==="Escape"){
      el.style.left=orig.l+"px"; el.style.top=orig.t+"px";
      if(mode==="size"){ el.style.width=orig.w+"px"; el.style.height=orig.h+"px"; }
      end(); return;
    }
    if(e.key==="Enter"){ saveWinRect(el); end(); return; }
    const dx=e.key==="ArrowLeft"?-d:e.key==="ArrowRight"?d:0;
    const dy=e.key==="ArrowUp"?-d:e.key==="ArrowDown"?d:0;
    if(!dx&&!dy) return;
    if(mode==="move"){ el.style.left=clamp(el.offsetLeft+dx,-el.offsetWidth+80,W-40)+"px"; el.style.top=clamp(el.offsetTop+dy,0,H-30)+"px"; }
    else{ el.style.width=Math.max(minw,el.offsetWidth+dx)+"px"; el.style.height=Math.max(minh,el.offsetHeight+dy)+"px"; }
  };
  const onDown=()=>end();
  const end=()=>{ removeEventListener("keydown",onKey,true); removeEventListener("pointerdown",onDown,true); };
  addEventListener("keydown",onKey,true);
  addEventListener("pointerdown",onDown,true);
}
function winMenu(id){
  if(id==="win-amp") return [{label:"Close",bold:1,accel:"Alt+F4",action:()=>closeWin("win-amp")}];
  const el=document.getElementById(id);
  const fixed=el.classList.contains("fixed");
  const maxed=el.classList.contains("maxed");
  return [
    {label:"Restore",disabled:!maxed,action:()=>maxWin(id)},
    {label:"Move",disabled:maxed,action:()=>kbdWinDrive(id,"move")},
    {label:"Size",disabled:fixed||maxed,action:()=>kbdWinDrive(id,"size")},
    {label:"Minimize",disabled:NOTAB.has(id),action:()=>minWin(id)},
    {label:"Maximize",disabled:fixed||maxed,action:()=>maxWin(id)},
    {sep:1},
    {label:"Close",bold:1,accel:"Alt+F4",action:()=>closeWin(id)}
  ];
}
function tileWins(vert){
  const ids=[...openApps.entries()].filter(([id,a])=>!a.min&&!NOTAB.has(id)&&a.kind!=="webamp").map(([id])=>id);
  if(!ids.length) return;
  const n=ids.length, tb=H;
  ids.forEach((id,i)=>{
    const el=document.getElementById(id);
    if(el.classList.contains("maxed")) maxWin(id);
    if(vert){ el.style.left=Math.floor(W*i/n)+"px"; el.style.top="0px"; el.style.width=Math.floor(W/n)+"px"; el.style.height=tb+"px"; }
    else{ el.style.left="0px"; el.style.top=Math.floor(tb*i/n)+"px"; el.style.width=W+"px"; el.style.height=Math.floor(tb/n)+"px"; }
    saveWinRect(el);
  });
  sClick();
}
function taskbarMenu(){
  return [
    {label:"Toolbars",sub:[
      {label:"Address",check:!!store.data.tbAddr,action(){ store.data.tbAddr=store.data.tbAddr?0:1; store.save(); syncTaskToolbars(); }},
      {label:"Links",check:!!store.data.tbLinks,action(){ store.data.tbLinks=store.data.tbLinks?0:1; store.save(); syncTaskToolbars(); }},
      {label:"Desktop",check:!!store.data.tbDesk,action(){ store.data.tbDesk=store.data.tbDesk?0:1; store.save(); syncTaskToolbars(); }},
      {label:"Quick Launch",check:store.data.quickLaunch!==0,action(){
        store.data.quickLaunch=store.data.quickLaunch===0?1:0; store.save();
        $$("#taskbar .qlb").forEach(b=>b.style.display=store.data.quickLaunch===0?"none":"");
      }}]},
    {sep:1},
    {label:"Cascade Windows",action:cascadeWins},
    {label:"Tile Windows Horizontally",action:()=>tileWins(false)},
    {label:"Tile Windows Vertically",action:()=>tileWins(true)},
    {label:"Show the Desktop",action:showDesktopToggle},
    {sep:1},
    {label:"Task Manager",action:()=>openWin("win-taskmgr")},
    {sep:1},
    {label:"Lock the Taskbar",check:!!store.data.lockTb,action(){ store.data.lockTb=store.data.lockTb?0:1; store.save(); }},
    {label:"Auto-hide the taskbar",check:!!store.data.tbAuto,action(){ store.data.tbAuto=store.data.tbAuto?0:1; store.save(); syncAutoHide(); }},
    {label:"Properties",disabled:1}
  ];
}
function trayMenu(target){
  if(target&&target.id==="sndico") return [
    {label:"Open Volume Control",bold:1,action:()=>snd.openMixer()},
    {label:"Adjust Audio Properties",action:()=>volOpen(true)},
  ];
  if(target&&target.id==="netico") return [
    {label:"Disable",action:()=>showError("Network Connections","You do not have sufficient privileges to disable this connection.")},
    {label:"Status",action:()=>openWin("win-dialup")},
    {label:"Repair",action(){
      showBalloon("Repairing connection...","cursor$net 56.6 Kbps");
      setTimeout(()=>showError("Repair Local Area Connection","The following steps of the repair operation completed successfully:\n\nRenewing the IP address.\nFlushing the ARP cache.\nFlushing the NetBIOS name cache.\nFlushing the DNS resolver cache.",true),1400);
    }},
    {sep:1},
    {label:"Open Network Connections",action:()=>openWin("win-dialup")},
  ];
  if(target&&target.dataset&&target.dataset.ico==="trayUsb") return [
    {label:"Safely Remove Hardware",bold:1,action:()=>showError("Safely Remove Hardware",
      "The device 'USB Mass Storage Device' cannot be stopped right now. Try stopping the device again later.")},
  ];
  if(target&&target.dataset&&target.dataset.ico==="trayRisk") return [
    {label:"Open Security Center",bold:1,action:()=>showError("Windows Security Center",
      "Your computer might be at risk.\n\nAntivirus software might not be installed.")},
  ];
  return [
    {label:"Adjust Date/Time",action:()=>openWin("win-datetime")},
    {sep:1},
    {label:"Customize Notifications...",disabled:1}
  ];
}
/* ---- the edit-control menu, with the submenu nobody ever used ---- */
function editMenu(t){
  const hasSel=()=>t.selectionStart!==t.selectionEnd;
  const ins=ch=>{
    const s=t.selectionStart, e=t.selectionEnd, v=t.value;
    t.value=v.slice(0,s)+ch+v.slice(e);
    t.selectionStart=t.selectionEnd=s+ch.length;
    t.dispatchEvent(new Event("input",{bubbles:true})); t.focus();
  };
  const UNI=[["LRM","Left-to-right mark","\u200E"],["RLM","Right-to-left mark","\u200F"],
    ["ZWJ","Zero width joiner","\u200D"],["ZWNJ","Zero width non-joiner","\u200C"],
    ["LRE","Start of left-to-right embedding","\u202A"],["RLE","Start of right-to-left embedding","\u202B"],
    ["LRO","Start of left-to-right override","\u202D"],["RLO","Start of right-to-left override","\u202E"],
    ["PDF","Pop directional formatting","\u202C"],["NADS","National digit shapes substitution","\u206E"],
    ["NODS","Nominal (European) digit shapes","\u206F"],["ASS","Activate symmetric swapping","\u206B"],
    ["ISS","Inhibit symmetric swapping","\u206A"],["AAFS","Activate Arabic form shaping","\u206D"],
    ["IAFS","Inhibit Arabic form shaping","\u206C"],["RS","Record Separator (Block separator)","\u001E"],
    ["US","Unit Separator (Segment separator)","\u001F"]];
  const ro=t.readOnly||t.disabled;
  return [
    {label:"Undo",accel:"Ctrl+Z",disabled:ro,action:()=>{ t.focus(); document.execCommand("undo"); }},
    {sep:1},
    {label:"Cut",accel:"Ctrl+X",disabled:ro||!hasSel(),action:()=>{ t.focus(); document.execCommand("cut"); }},
    {label:"Copy",accel:"Ctrl+C",disabled:!hasSel(),action:()=>{ t.focus(); document.execCommand("copy"); }},
    {label:"Paste",accel:"Ctrl+V",disabled:ro,action:async()=>{ t.focus(); try{ ins(await navigator.clipboard.readText()); }catch(e){ document.execCommand("paste"); } }},
    {label:"Delete",accel:"Del",disabled:ro||!hasSel(),action:()=>{ t.focus(); document.execCommand("delete"); }},
    {sep:1},
    {label:"Select All",accel:"Ctrl+A",action:()=>{ t.focus(); t.select(); }},
    {sep:1},
    {label:"Right to left Reading order",check:t.dir==="rtl",disabled:ro,action:()=>{ t.dir=t.dir==="rtl"?"":"rtl"; }},
    {label:"Show Unicode control characters",disabled:1},
    {label:"Insert Unicode control character",disabled:ro,sub:UNI.map(([ab,name,ch])=>({label:ab+"\u2002"+name,action:()=>ins(ch)}))},
  ];
}

/* ---- menu bars actually drop menus ---- */
function menubarMenu(label,id){
  if(id==="win-freecell") return freecell.menus(label);
  if(id==="win-spider") return spider.menus(label);
  if(id==="win-hearts") return hearts.menus(label);
  if(id==="win-regedit"&&depth.regMenus){ const m=depth.regMenus(label); if(m) return m; }
  if(id==="win-calc"&&depth.calcMenus){ const m=depth.calcMenus(label); if(m) return m; }
  if((id==="win-chat"||id.indexOf("win-conv")===0)&&msn.menus){ const m=msn.menus(label,id); if(m) return m; }
  if(id==="win-cursors"){
    const P={Play:"cx-play",Stats:"cx-stats",Rakeback:"cx-rake",History:"cx-hist",Verify:"cx-verify"};
    if(label==="Game") return [
      {label:"Deploy 0.1 SOL",bold:1,action:()=>deploy(false)},
      {label:"Recall All",action:recallAll},
      {sep:1},
      {label:"Autoplay",check:auto.on,action:()=>$("#ap-toggle").click()},
      {sep:1},
      {label:"Exit",action:()=>closeWin(id)}];
    if(label==="View") return Object.keys(P).map(n=>({
      label:n,check:$("#"+P[n]).classList.contains("on"),action:()=>cxShow(P[n])}))
      .concat([{sep:1},{label:"Always on Top",check:hudTop,action:()=>setHudTop(!hudTop)}]);
    if(label==="Help") return [
      {label:"Quick Tour",action:()=>tour.open(true)},
      {label:"How it works",action:()=>openWin("win-help")},
      {label:"Verify fairness",action:()=>cxShow("cx-verify")},
      {sep:1},
      {label:"About CURSORS.EXE",action:()=>showError("About CURSORS.EXE",
        "CURSORS.EXE\nVersion 5.1 (Build 2600)\n\nRTP 99% · P(A wins) = A/(A+B)\nFee 0.001 · rakeback 0.002 per deploy\n\nThis product is licensed to:\n"+playerNameFull(),true)}];
  }
  switch(label){
    case "File": return [
      {label:"New",disabled:1},{label:"Open...",disabled:1},{label:"Save",disabled:1},
      {label:"Save As...",disabled:1},{sep:1},
      {label:"Exit",action:()=>closeWin(id)}];
    case "Edit": return [
      {label:"Undo",disabled:1},{sep:1},
      {label:"Cut",disabled:1},{label:"Copy",disabled:1},{label:"Paste",disabled:1},
      {label:"Delete",disabled:1},{sep:1},{label:"Select All",disabled:1}];
    case "Format": return [
      {label:"Word Wrap",disabled:1},{label:"Font...",disabled:1}];
    case "View": return [
      {label:"Status Bar",disabled:1},{sep:1},{label:"Refresh",action:()=>{}}];
    case "Options": return [
      {label:"Always On Top",disabled:1},{label:"Minimize On Use",disabled:1}];
    case "Shut Down": return [
      {label:"Turn Off",action:()=>{ sysSnd("shutdown",.55); $("#shutdown").style.display="grid"; }},
      {label:"Restart",action:()=>{ sessionStorage.removeItem("cxp.booted"); location.reload(); }}];
    case "Help": return [
      {label:"Help Topics",action:()=>openWin("win-readme")},{sep:1},
      {label:"About",action:()=>showError("About "+tabTitle(id),
        "Microsoft Windows XP\nVersion 5.1 (Build 2600)\n\nThis product is licensed to:\n"+playerNameFull(),true)}];
  }
  return [{label:"(nothing here)",disabled:1}];
}
/* delegated: windows built after boot (Messenger conversations) route too */
document.addEventListener("click",e=>{
  const m=e.target.closest(".menubar span"); if(!m) return;
  e.stopPropagation();
  const win=m.closest(".window"); if(!win) return;
  const r=m.getBoundingClientRect();
  if(win.id==="win-mine"){
    (m.textContent==="Game"?mine.gameMenu:mine.helpMenu)(r.left,r.bottom+2);
    return;
  }
  if(win.id==="win-paint"){ paint.menu(m.textContent,r.left,r.bottom+2); return; }
  if(win.id==="win-notepad"){ write.notepadMenu(m.textContent,r.left,r.bottom+2); return; }
  if(win.id==="win-wordpad"){ write.wordpadMenu(m.textContent,r.left,r.bottom+2); return; }
  if(win.id==="win-clipbook"){ showMenu([{label:"Exit",action:()=>closeWin("win-clipbook")}],r.left,r.bottom+2); return; }
  if(win.id==="win-sndvol"){ snd.mixerMenu(m.textContent,r.left,r.bottom+2); return; }
  if(win.id==="win-sndrec"){ snd.recorderMenu(m.textContent,r.left,r.bottom+2); return; }
  if(win.id==="win-explorer"){ explorer.menu(m.textContent,r.left,r.bottom+2); return; }
  if(win.id==="win-taskmgr"){ tmMenu(m.textContent,r.left,r.bottom+2); return; }
  if(win.id==="win-oe"){ const mm=oe.menus(m.textContent); if(mm){ showMenu(mm,r.left,r.bottom+2); return; } }
  if(win.id==="win-eventvwr"||win.id==="win-msinfo"){ showMenu(sysinfo.menus(m.textContent,win.id),r.left,r.bottom+2); return; }
  if(win.id==="win-ie"){ ie.menu(m.textContent,r.left,r.bottom+2); return; }
  showMenu(menubarMenu(m.textContent,win.id),r.left,r.bottom+2);
});

/* ================= Minesweeper ================= */
const mine=initMinesweeper({
  customDialog:cb=>{
    openWin("win-minecustom");
    $("#mc-ok").onclick=()=>{
      const h=Math.max(9,Math.min(24,+$("#mc-h").value||16));
      const w=Math.max(9,Math.min(30,+$("#mc-w").value||30));
      const m=Math.max(10,Math.min((h-1)*(w-1),+$("#mc-m").value||45));
      closeWin("win-minecustom"); cb({h,w,m});
    };
    $("#mc-cancel").onclick=()=>closeWin("win-minecustom");
  },
  MINE,
  host:$("#ms-grid"),
  headEls:{counter:$("#ms-counter"),timer:$("#ms-timer"),face:$("#ms-face")},
  store, sysSnd, showError, showMenu,
  playerName:()=>playerName(),
  close:()=>closeWin("win-mine"),
  onWin:(lv,t)=>{
    log(`minesweeper: ${lv} cleared in ${t}s`);
    if(lv!=="beginner") chatSys(`${playerName()} swept ${lv} in ${t}s`);
  }
});
/* ================= Paint ================= */
const paint=initPaint({
  PAINT,
  els:{
    canvas:$("#pt-canvas"), overlay:$("#pt-overlay"), box:$("#pt-box"), wrap:$("#pt-wrap"),
    tools:$("#pt-tools"), opts:$("#pt-opts"), colors:$("#pt-colors"), left:$("#pt-left"),
    status:$("#pt-status"), st1:$("#pt-st1"), st2:$("#pt-st2"), st3:$("#pt-st3"),
  },
  store, sysSnd, showError, showMenu, showConfirm, isMobile:MOBILE,
  publish:png=>mpPublishPainting("untitled by "+playerName(),png),
  setWallpaperFrom,
  close:()=>closeWin("win-paint"),
  setTitle:name=>{ $("#win-paint .title-bar-text").textContent=name+" - Paint"; renderTaskbar(); },
  isFocused:()=>focusedId==="win-paint",
  openAttributes:(w,h)=>{ $("#pa-w").value=w; $("#pa-h").value=h; openWin("win-paintattr"); },
  openStretchSkew:()=>{ $("#ss-hs").value=100; $("#ss-vs").value=100; $("#ss-hd").value=0; $("#ss-vd").value=0; openWin("win-stretchskew"); },
  /* the fake disk gets a real file; keep few, they live in localStorage */
  savePicture:url=>{
    store.data.pictures=store.data.pictures||[];
    const n="untitled"+(store.data.pictures.length+1)+".png";
    store.data.pictures.unshift({name:n,data:url});
    store.data.pictures=store.data.pictures.slice(0,6);
    store.save();
    if(openApps.has("win-explorer")) explorer.render();
    return n;
  },
});
$("#pa-ok").addEventListener("click",()=>{
  paint.setSize(+$("#pa-w").value||1,+$("#pa-h").value||1);
  closeWin("win-paintattr");
});
$("#pa-cancel").addEventListener("click",()=>closeWin("win-paintattr"));
$("#ss-ok").addEventListener("click",()=>{
  paint.stretchSkew(+$("#ss-hs").value,+$("#ss-vs").value,+$("#ss-hd").value,+$("#ss-vd").value);
  closeWin("win-stretchskew");
});
$("#ss-cancel").addEventListener("click",()=>closeWin("win-stretchskew"));
$("#pa-default").addEventListener("click",()=>{ $("#pa-w").value=384; $("#pa-h").value=272; });
$$("#win-paintattr input").forEach(i=>i.addEventListener("keydown",e=>{
  e.stopPropagation();
  if(e.key==="Enter") $("#pa-ok").click();
}));
/* the canvas grips resize the image, exactly like the real three handles */
$$("#pt-box .pt-h").forEach(h=>h.addEventListener("pointerdown",e=>{
  e.preventDefault(); e.stopPropagation();
  const dir=h.dataset.grip, s=paint.size();
  const sx=e.clientX, sy=e.clientY;
  const mv=ev=>{
    const w=dir==="s"?s.w:Math.max(1,s.w+Math.round(ev.clientX-sx));
    const ht=dir==="e"?s.h:Math.max(1,s.h+Math.round(ev.clientY-sy));
    paint.setSize(w,ht);
  };
  const up=()=>{ removeEventListener("pointermove",mv); removeEventListener("pointerup",up); };
  addEventListener("pointermove",mv); addEventListener("pointerup",up);
}));

/* ================= Windows Explorer ================= */
function openTextWindow(name,body){
  curTxtIcon=null;
  $("#win-usertxt .title-bar-text").textContent=name+" - Notepad";
  $("#usertxtarea").value=body;
  openWin("win-usertxt");
}
/* the Search Companion's cast, drawn from scratch — Explorer's search pane and
   the chooser dialog both pull their characters from here */
const companion=initCompanion({$,store,sysSnd,openWin,closeWin,AGENT_PNG,AGENT_DEF});
let schemeSeen=null, cosmeticApplying=false;
/* the pointer schemes: main.cpl, the trails, and the arena identity */
const mouse=initMouse({$,store,sysSnd,CURFILES,openWin,closeWin,icoNode,
  openDevice:()=>openWin("win-devmgr"),
  /* fires once during boot before the net layer exists — hence the try */
  /* applyScheme also runs at boot and during a restore, so a point is only
     worth taking when the scheme genuinely changed under the user's hand */
  onScheme:id=>{ try{ if(MP.on) mpSend({t:"skin",skin:id}); }catch(e){}
    try{ if(!cosmeticApplying&&schemeSeen!==null&&schemeSeen!==id) maint.point("Pointer scheme change"); }catch(e){}
    schemeSeen=id; },
});
/* Calculator, Character Map, Disk Defragmenter, Registry Editor */
/* ================= FreeCell / Spider ================= */
const freecell=initFreeCell({
  host:$("#fc-board"),
  store, sysSnd, showError, showConfirm,
  setTitle:t=>{ $("#win-freecell .title-bar-text").textContent=t; renderTaskbar(); },
  isFocused:()=>focusedId==="win-freecell",
  close:()=>closeWin("win-freecell"),
});
const spider=initSpider({
  host:$("#sp-board"),
  store, sysSnd, showError, showConfirm,
  isFocused:()=>focusedId==="win-spider",
  close:()=>closeWin("win-spider"),
});
const hearts=initHearts({
  host:$("#ht-board"),
  sysSnd, showError, showConfirm,
  isFocused:()=>focusedId==="win-hearts",
  close:()=>closeWin("win-hearts"),
  /* the shell names the table; XP asked you for these at first run */
  playerName:()=>playerNameFull(),
  botNames:()=>["Pauline","Michele","Ben"],
});
const solb=initSolBounce({ sysSnd });
const depth=initDepthApps({$,store,sysSnd,showMenu,showError,openWin,closeWin,hooks:{
  setPsm:v=>{ store.data.msnPsm=String(v||"").slice(0,60); store.save(); try{ msn.renderMe(); }catch(e){} },
  disk:()=>{ const d=diskPct(); return {pct:d.pct,corpses:(binDead&&binDead.length)||0}; },
  regGame:()=>({ name:playerNameFull(), wallet:fmtS(Math.round(wallet))+" SOL",
    kills:stats.kills, deaths:stats.deaths, scheme:mouse.labelOf(mouse.current()),
    epoch:roundNo, uptime:fmtUp(upT) }),
  schemeLabel:()=>mouse.labelOf(mouse.current()),
}});
/* Notepad, WordPad, Picture and Fax Viewer, Clipboard Viewer */
const write=initWriteApps({$,store,sysSnd,showMenu,showError,openWin,closeWin,hooks:{
  browseTexts(open){
    /* Open... lists every text on the machine, which is the desktop's */
    const texts=store.data.userIcons.filter(i=>i.app==="usertxt");
    if(!texts.length){ showError("Open","There are no text documents on the Desktop."); return; }
    showMenu(texts.map(ic=>({label:ic.label,action:()=>open(docForIcon(ic))})),innerWidth/2-80,140);
  },
  saveTextToDesktop(title,text,then){
    const base=title.replace(/\.txt$/i,"");
    let name=base+".txt", n=2;
    while(store.data.userIcons.some(i=>i.label===name)) name=base+" ("+(n++)+").txt";
    const ic={id:"user_"+userN++,label:name,ico:"note32",app:"usertxt",kind:"txt"};
    store.data.userIcons.push(ic);
    store.data.icons[ic.id]=firstFreeCell();
    store.data.texts[ic.id]=text;
    store.save(); renderIcons(); sysSnd("nav",.4);
    if(then) then(ic);
  },
  docForIcon,
  bliss:()=>IMG.bliss,
  editInPaint(it){ openWin("win-paint"); paint.loadDataURL(it.data,true); },
  shellClip(){
    if(!clip) return null;
    return { label:clip.ic.label, kind:(clip.mode==="cut"?"Move":"Copy")+" — 1 object", icoHTML:"" };
  },
}});
snd=initSoundApps({$,store,sysSnd,showMenu,showError,openWin,closeWin,hooks:{
  getMaster:()=>masterVol,
  /* the mixer reaches Winamp through the app object: wampApplyVol lives
     inside its closure, and the mixer can be touched before it exists */
  ampVolume:bus=>{ try{ winampApp.applyVol(bus); }catch(e){} },
  tvVolume:bus=>{ try{ tvApplyVol(bus); }catch(e){} },
  tourVolume:bus=>{ try{ tourxp.setVol(bus); }catch(e){} },
  getMuted:()=>muted,
  setMaster:v=>{ masterVol=clamp(v,0,1); volSync(); },
  setMuted:m=>{ muted=!!m; volSync(); },
  tracks:()=>TRACKS,
  saveWav(buf){
    /* a desktop .wav that really plays — this session only; a reload turns it
       back into an ordinary dead file, which is very 2001 */
    let name="Sound.wav", n=2;
    while(store.data.userIcons.some(i=>i.label===name)) name="Sound ("+(n++)+").wav";
    const ic={id:"user_"+userN++,label:name,ico:"wavdoc16",app:"recwav",kind:"wav"};
    store.data.userIcons.push(ic); store.data.icons[ic.id]=firstFreeCell(); store.save();
    recWavs.set(ic.id,buf); renderIcons(); sysSnd("nav",.4);
  },
}});
const recWavs=new Map();   /* id -> AudioBuffer, session-lifetime */
/* System Restore, the System Configuration Utility, Folder Options */
const tour=initTour({ $, store, openWin, closeWin, sysSnd });
tour.init();
/* Tour Windows XP - the Microsoft tour, next to our own How to Play card.
   Its music is a program on this machine, so it rides the mixer: the tour's
   own speaker button is the app switch, Wave is the bus, Volume Control is
   the master, and Mute is silence. */
const tourxp=initTourXP({ $, store, sysSnd, openWin, closeWin, IMG, CURFILES,
  isFocused:()=>focusedId==="win-tourxp",
  hooks:{
    getMaster:()=>masterVol,
    getMuted:()=>muted,
    waveBus:()=>(snd&&snd.ampBus?snd.ampBus():1),
  }});
tourxp.init();
const maint=initSysMaint({$,store,sysSnd,showError,showConfirm,openWin,closeWin,icoNode,hooks:{
  /* a restore point puts every one of these back where it was */
  applyCosmetic(){
    cosmeticApplying=true;
    wpSel=store.data.wallpaper||"bliss";
    setWallpaper(wpSel); renderWplist();
    try{ mouse.applyScheme(store.data.curScheme||""); }catch(e){}
    $("#sv-sel").value=store.data.saver.t; $("#sv-wait").value=store.data.saver.wait;
    $("#crt-chk").checked=store.data.crt!==false; applyCrt();
    $$("#taskbar .qlb").forEach(b=>b.style.display=store.data.quickLaunch===0?"none":"");
    syncAutoHide(); renderIcons();
    try{ sys.cplRender(); }catch(e){}
    try{ explorer.render(); }catch(e){}
    try{ if(MP.on) mpSend({t:"skin",skin:store.data.curScheme||""}); }catch(e){}
    cosmeticApplying=false;
  },
  applyStartup:on=>applyStartupItems(on),
  diskBytes:()=>diskPct().total,
  startSaver:()=>startSaver(store.data.saver.t==="none"?"pipes":store.data.saver.t),
  diskCleanup:()=>{ openWin("win-explorer"); explorer.go("C:" + String.fromCharCode(92)); setTimeout(()=>explorer.driveProperties(),350); },
  openDefrag:()=>depth.openDefrag(),
  freeBytes:()=>{ const d=diskPct(); return Math.max(0,d.total-Math.round(d.total*d.pct/100)); },
  usage(){
    const c=store.data.useCount||{}, l=store.data.useLast||{}, out={};
    for(const k in c) out[k]={n:c[k],last:l[k]||0};
    return out;
  },
  /* a program that was just installed or removed changes the desktop, the
     menus and the quick launch bar all at once */
  shellRefresh(){ renderIcons(); syncQuickLaunch(); renderMru(); },
  windowsUpdate(){ windowsUpdate(); },
  services:()=>sys.services(),
  setService:(name,on)=>sys.svcSet(name,on),
  folderOptions(){ try{ explorer.render(); }catch(e){} },
  /* the same path the Start menu takes, so a restart is a restart */
  restart(){ closeStart(); sysSnd("shutdown",.55);
    const sd=$("#shutdown"); sd.style.display="grid";
    /* clicking the shutdown screen boots it early; do not boot it twice */
    setTimeout(()=>{ if(sd.style.display!=="grid") return; sd.style.display="none"; showBootThenLogin(); },1600); },
}});
maint.init();
/* the Magnifier, the On-Screen Keyboard, High Contrast and StickyKeys */
const access=initAccess({$,store,sysSnd,showError,openWin,closeWin,hooks:{
  getMuted:()=>muted,
  confirm:(t,b,ok)=>showConfirm(t,b,ok),
}});
access.init();
/* the Startup tab is not decoration: unchecking one of these really stops it */
/* Quick Launch shows only what is installed and what startup left running */
function syncQuickLaunch(){
  const amp=$('#ql [data-app="win-amp"]'), chat=$('#ql [data-app="win-chat"]');
  try{
    if(amp) amp.style.display=(maint.installed("amp")&&maint.startupOn("winampa"))?"":"none";
    if(chat) chat.style.display=maint.installed("chat")?"":"none";
  }catch(e){}
}
function applyStartupItems(on){
  msnAuto=on("msmsgs");
  syncQuickLaunch();
  $("#sndico").style.display=on("soundman")?"":"none";
  $("#phasechip").style.display=on("cursors")?"":"none";
}
function docForIcon(ic){
  return { title:ic.label,
    get:()=>store.data.texts[ic.id]||"",
    set:t=>{ store.data.texts[ic.id]=t; store.save(); } };
}
function viewerList(){
  /* every picture the machine actually has, in one strip */
  const out=[];
  (store.data.pictures||[]).forEach((p,i)=>out.push({name:p.name,data:p.data,
    del:()=>{ store.data.pictures.splice(i,1); store.save(); }}));
  if(store.data.wallpaperData) out.push({name:"wallpaper.bmp",data:store.data.wallpaperData});
  try{ for(const g of (mpGalleryData()||[])) out.push({name:g.by+".png",data:g.png}); }catch(e){}
  out.push({name:"Bliss.bmp",data:IMG.bliss});
  return out;
}
const explorer=initExplorer({
  IMG,
  els:{
    list:$("#ex-list"), tasks:$("#ex-tasks"), addr:$("#ex-addr"), addrico:$("#ex-addrico"),
    addrGo:$("#ex-go"), back:$("#ex-back"), fwd:$("#ex-fwd"), up:$("#ex-up"),
    viewsBtn:$("#ex-views"), foldersBtn:$("#ex-folders"), searchBtn:$("#ex-search"),
    st1:$("#ex-st1"), st2:$("#ex-st2"), st3:$("#ex-st3"),
  },
  store, sysSnd, showMenu, showError, icoNode, isMobile:MOBILE,
  setTitle:name=>{ $("#win-explorer .title-bar-text").textContent=name; renderTaskbar(); },
  hooks:{
    openWin, close:()=>closeWin("win-explorer"),
    playerName:()=>playerNameFull(),
    openStart:()=>startmenu.classList.add("open"),
    browse:u=>{ openWin("win-ie"); ie.go(u); },
    openIcon:ic=>openIcon(ic),
    desktopFiles:()=>allIcons(),
    sentDocs:()=>store.data.sentDocs||[],
    unusedFiles:()=>store.data.unusedIcons||[],
    openDefrag:()=>depth.openDefrag(),
    openRegedit:()=>depth.openRegedit(),
    folderOptions:()=>maint.openFolderOptions(),
    bootIni:()=>maint.bootIniText(),
    openFonts:()=>maint.openFonts(),
    ieFavs:()=>store.data.ieFavs||[],
    deadCount:()=>binDead.length,
    serverDisk:()=>{ if(!MP.on||!MP.disk) return {
        used:20*1024*1024*1024-(LOCAL_CORPSES-Math.min(localDeaths,LOCAL_CORPSES))*12*1024*1024,
        total:20*1024*1024*1024};
      const base=MP.disk.total-MP.corpses*MP.disk.corpse;
      return {used:base+Math.round(MP.fill*MP.corpses)*MP.disk.corpse,total:MP.disk.total}; },
    binContents:()=>({
      files:binFiles,
      deaths:binDead.map(d=>Object.assign({lostStr:fmtS(d.lost)},d)),
    }),
    emptyBin:()=>emptyBin(),
    restore:one=>one?restoreOne(one):restoreAll(),
    deathCert:d=>deathCert(d),
    hallOfPain:()=>hallOfPain(),
    logSize:()=>logpaper.textContent.length||1024,
    tracks:()=>TRACKS,
    openText:openTextWindow,
    openPicture:p=>{
      const list=viewerList(), i=list.findIndex(x=>x.name===p.name);
      write.openViewer(list,Math.max(0,i));
    },
    systemProperties:()=>{ $("#sp-user").textContent=playerNameFull(); openWin("win-sysprops"); },
    openDriveProps:info=>{
      $("#dv-used").textContent=info.usedStr;
      $("#dv-free").textContent=info.freeStr;
      $("#dv-cap").textContent=info.totalStr;
      $("#dv-barfill").style.width=(100*info.used/info.total).toFixed(1)+"%";
      /* online the corpses belong to the whole server, not to what this
         browser happened to witness, so the volume reports the epoch's count */
      const d=diskPct();
      $("#dv-note").textContent=d.dead
        ? `${d.dead}/${d.cap} corpses. Full disk = crash, everyone banked.`
        : "No deaths yet this round.";
      openWin("win-driveprops");
      requestAnimationFrame(()=>info.draw($("#dv-pie")));
    },
  },
  companion,
});
$("#cert-ok").addEventListener("click",()=>closeWin("win-cert"));
$("#cert-hall").addEventListener("click",()=>{ closeWin("win-cert",{silent:true}); hallOfPain(); });
$("#dv-ok").addEventListener("click",()=>closeWin("win-driveprops"));
$("#sp-ok").addEventListener("click",()=>closeWin("win-sysprops"));
$("#dv-clean").addEventListener("click",()=>showConfirm("Disk Cleanup",
  "Empty the Recycle Bin to reclaim space? The dead cursors go with it.",()=>{
    binDead=[]; binFiles=[]; renderBin(); sCrunch();
    closeWin("win-driveprops"); explorer.driveProperties();
  }));
/* toolbar art comes from the real IE/Explorer button set */
$("#ex-backi").src=IMG.navBack; $("#ex-fwdi").src=IMG.navFwd; $("#ex-upi").src=IMG.navUp;
$("#ex-searchi").src=IMG.navSearch; $("#ex-foldersi").src=IMG.navFolders; $("#ex-viewsi").src=IMG.navDrop;

document.addEventListener("contextmenu",e=>{
  e.preventDefault();
  hideMenu();
  if(e.target.closest("#pt-box,.pt-sw")) return;  /* Paint uses the right button to draw */
  if(e.target.closest("#webamp,#webamp-slot")) return; /* Winamp draws its own menus */
  if(e.target.closest(".ms-grid")) return;             /* right-click plants flags */
  const lgAdmin=e.target.closest("#tile-admin");
  if(lgAdmin){
    showMenu([{label:"Log on as a different user",action(){
      PLAYER=null; delete store.data.userName; store.save();
      syncIdentity();
      $("#lg-inputrow").style.display="flex"; $("#lg-user").value=""; $("#lg-user").focus();
      $("#lg-sub").textContent="pick a name for the scoreboard";
    }}],e.clientX,e.clientY);
    return;
  }
  /* any text control gets XP's edit menu — including the one submenu nobody ever opened */
  const ed=e.target.closest("textarea,input");
  if(ed&&(ed.tagName==="TEXTAREA"||/^(text|search|number|url|password|)$/.test(ed.type||""))){
    showMenu(editMenu(ed),e.clientX,e.clientY); return;
  }
  const smItem=e.target.closest(".sm-item[data-app],.sm-item[data-act]");
  if(smItem){ showMenu(startItemMenu(smItem),e.clientX,e.clientY); return; }
  const icon=e.target.closest(".icon");
  const tb=e.target.closest(".title-bar");
  const tab=e.target.closest(".task-tab");
  const tray=e.target.closest("#tray");
  const bar=e.target.closest("#taskbar");
  const win=e.target.closest(".window");
  if(icon){ const ic=iconById(icon.dataset.iid); if(ic){ selectOnly(icon); showMenu(iconMenu(ic),e.clientX,e.clientY); } }
  else if(tb){ const w=tb.closest(".window"); showMenu(winMenu(w.id),e.clientX,e.clientY); }
  else if(tab){ showMenu(winMenu(tab.dataset.win),e.clientX,e.clientY); }
  else if(tray){ showMenu(trayMenu(e.target.closest(".trayico")),e.clientX,e.clientY); }
  else if(bar){ showMenu(taskbarMenu(),e.clientX,e.clientY); }
  else if(win){ /* app body: ours, but nothing to offer */ }
  else if(e.target.closest("#desktop")){ showMenu(desktopMenu(),e.clientX,e.clientY); }
});

/* ================= long-press = right-click ================= */
/* Capture phase, because icons stopPropagation their pointerdowns. Android
   fires a native contextmenu on long-press (sawNative) — then we stand down. */
let lpFiredAt=0;
addEventListener("pointerdown",e=>{
  if(e.pointerType!=="touch") return;
  if(e.target.closest&&e.target.closest("[data-nolongpress]")) return; /* drawing surfaces keep the finger */
  const sx=e.clientX, sy=e.clientY, target=e.target;
  let sawNative=false;
  const onNative=()=>{ sawNative=true; };
  addEventListener("contextmenu",onNative,true);
  const t=setTimeout(()=>{
    cleanup();
    if(sawNative) return;
    lpFiredAt=performance.now();
    if(navigator.vibrate) navigator.vibrate(12);
    const live=target.isConnected?target:(document.elementFromPoint(sx,sy)||document.body);
    const cell=live.closest&&live.closest(".ms-c");
    if(cell){ /* Minesweeper: long-press plants a flag (its cells speak mousedown) */
      cell.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:2,buttons:2,clientX:sx,clientY:sy}));
      cell.dispatchEvent(new MouseEvent("mouseup",{bubbles:true,button:2,clientX:sx,clientY:sy}));
    }else{
      live.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:sx,clientY:sy}));
    }
  },550);
  const cleanup=()=>{
    removeEventListener("pointermove",onMove,true);
    removeEventListener("pointerup",onEnd,true);
    removeEventListener("pointercancel",onCancel,true);
    removeEventListener("contextmenu",onNative,true);
  };
  const onMove=ev=>{
    const dx=ev.clientX-sx, dy=ev.clientY-sy;
    if(dx*dx+dy*dy>196){ clearTimeout(t); cleanup(); } /* moved: it's a drag/scroll */
  };
  const onEnd=()=>{ clearTimeout(t); cleanup(); };
  /* pointercancel is NOT a release. iOS raises it the moment it decides the
     press belongs to its own callout/selection gesture — which is precisely
     the gesture we are trying to answer. Let the timer run; a real scroll is
     already caught by onMove. */
  const onCancel=()=>{
    removeEventListener("pointermove",onMove,true);
    removeEventListener("pointerup",onEnd,true);
    removeEventListener("pointercancel",onCancel,true);
  };
  addEventListener("pointermove",onMove,true);
  addEventListener("pointerup",onEnd,true);
  addEventListener("pointercancel",onCancel,true);
},true);
/* the release of a long-press must not ALSO left-click (compat mouse events) */
addEventListener("touchend",e=>{
  if(performance.now()-lpFiredAt<700||(ctx.style.display==="block"&&!ctxArmed)) e.preventDefault();
},{capture:true,passive:false});

/* taskbar tabs activate on pointerup, delegated: renderTaskbar rebuilds the
   nodes constantly, and on iOS a tap whose node died mid-press never clicks */
let tabPtrAt=0;
$("#tabs").addEventListener("pointerup",e=>{
  const t=e.target.closest(".task-tab"); if(!t) return;
  if(performance.now()-lpFiredAt<700||performance.now()-menuDismissAt<500) return;
  tabPtrAt=performance.now(); tabClick(t.dataset.win);
});
$("#tabs").addEventListener("click",e=>{   /* keyboard activation only */
  const t=e.target.closest(".task-tab"); if(!t||performance.now()-tabPtrAt<500) return;
  tabClick(t.dataset.win);
});

/* ================= quick launch / cascade ================= */
let deskStash=null;
$("#ql-desk").addEventListener("click",()=>{
  sClick();
  if(deskStash){ const s=deskStash; deskStash=null; s.forEach(id=>{ if(openApps.has(id)) restoreWin(id); }); }
  else{
    deskStash=[...openApps.entries()].filter(([id,a])=>!a.min&&!NOTAB.has(id)).map(([id])=>id);
    if(deskStash.length) deskStash.forEach(minWin); else deskStash=null;
  }
});
$$("#ql .qlb[data-app]").forEach(b=>b.addEventListener("click",()=>{ sysSnd("nav",.5); openWin(b.dataset.app); }));
function showDesktopToggle(){ $("#ql-desk").click(); }
/* Address, Links and Desktop: the three toolbars everyone right-clicked on by
   accident and then could not find again. They do what they say. */
function syncTaskToolbars(){
  $("#tb-addr").classList.toggle("on",!!store.data.tbAddr);
  $("#tb-links").classList.toggle("on",!!store.data.tbLinks);
  $("#tb-desk").classList.toggle("on",!!store.data.tbDesk);
  if(store.data.tbLinks&&!$("#tb-links-in").children.length){
    for(const [label,url] of [["cursorTV","http://tv.cursor.land/"],["the gallery","http://gallery.cursor.land/"],
        ["hall of fame","http://hall.cursor.land/"]]){
      const b=document.createElement("button"); b.className="tbb"; b.textContent=label;
      b.addEventListener("click",()=>{ sysSnd("nav",.4); openWin("win-ie"); try{ ie.connectNow(); }catch(e){} ie.go(url); });
      $("#tb-links-in").appendChild(b);
    }
  }
  if(store.data.tbDesk){
    const host=$("#tb-desk-in"); host.innerHTML="";
    for(const ic of allIcons().filter(i=>i.sys).slice(0,7)){
      const b=document.createElement("button"); b.className="tbb";
      b.appendChild(icoNode(ic.ico));
      b.title=ic.label;
      b.addEventListener("click",()=>openIcon(ic));
      host.appendChild(b);
    }
  }
}
$("#tb-addr-go").addEventListener("click",()=>{
  const v=$("#tb-addr-in").value.trim(); if(!v) return;
  $("#tb-addr-in").value="";
  /* the real one took a path, a program name or a URL, in that order */
  if(/^(https?:|www\.|[\w-]+\.(com|net|org|land))/i.test(v)){
    openWin("win-ie"); try{ ie.connectNow(); }catch(e){} ie.go(/^https?:/i.test(v)?v:"http://"+v);
  }else if(!runNamed(v)) showError("Windows",
    `Cannot find '${v}'. Make sure you typed the name correctly, and then try again.`);
});
$("#tb-addr-in").addEventListener("keydown",e=>{ e.stopPropagation(); if(e.key==="Enter") $("#tb-addr-go").click(); });
function cascadeWins(){
  let i=0;
  for(const [id,a] of openApps){
    if(NOTAB.has(id)||a.kind==="webamp") continue;
    if(a.min){ a.min=false; a.el.style.display="flex"; }
    if(a.el.classList.contains("maxed")){
      a.el.classList.remove("maxed");
      const p=a.el._prevRect;
      if(p){ a.el.style.width=p.w; a.el.style.height=p.h; }
    }
    a.el.style.left=(36+i*26)+"px"; a.el.style.top=(24+i*26)+"px";
    focusWin(id); i++;
  }
}

/* ================= tooltips ================= */
const tip=$("#xptip"); let tipTimer=null;
addEventListener("pointerover",e=>{
  const t=e.target.closest("[data-tip]");
  clearTimeout(tipTimer); tip.style.display="none";
  if(!t) return;
  tipTimer=setTimeout(()=>{
    tip.textContent=t.dataset.tip==="@clock"
      ? new Date().toLocaleDateString([],{weekday:"long",year:"numeric",month:"long",day:"numeric"})
      : t.dataset.tip;
    tip.style.display="block";
    const r=t.getBoundingClientRect(), tr=tip.getBoundingClientRect();
    tip.style.left=clamp(r.left,4,innerWidth-tr.width-4)+"px";
    tip.style.top=(r.top-tr.height-6<4? r.bottom+6 : r.top-tr.height-6)+"px";
  },500);
});
addEventListener("pointerdown",()=>{ clearTimeout(tipTimer); tip.style.display="none"; },true);

/* ================= start menu / tray ================= */
const startmenu=$("#startmenu");
function closeStart(){ startmenu.classList.remove("open"); }
/* XP's left column below the pinned pair is a most-recently-used list. Ours is
   too: opening an app promotes it, so the menu reshapes around how you play. */
const SMAPPS={
  "win-cursors":{label:"CURSORS.EXE",ico:"@ic-app"},
  "win-ie":{label:"Internet Explorer",ico:"ie32"},
  "win-chat":{label:"Windows Messenger",ico:"msn32"},
  "win-amp":{label:"Winamp",ico:"amp16"},
  "win-paint":{label:"Paint",ico:"paint32"},
  "win-mine":{label:"Minesweeper",ico:"mine32"},
  "win-explorer":{label:"My Computer",ico:"computer32"},
  "win-log":{label:"fights.log",ico:"note32"},
  "win-readme":{label:"README.txt",ico:"note32"},
  "win-oe":{label:"Outlook Express",ico:"outlook32"},
  "win-help":{label:"Help and Support",ico:"help32"},
  "win-dispprops":{label:"Display Properties",ico:"cpanel32"},
  "win-datetime":{label:"Date and Time",ico:"cpanel32"},
  "win-cmd":{label:"Command Prompt",ico:"@ic-cmd"},
  "win-control":{label:"Control Panel",ico:"@ic-cpl"},
  "win-services":{label:"Services",ico:"@ic-mmc"},
  "win-devmgr":{label:"Device Manager",ico:"@ic-dev"},
  "win-gpedit":{label:"Group Policy",ico:"@ic-pol"},
};
const SM_DEFAULT=["win-cursors","win-chat","win-amp","win-paint","win-mine","win-log"];
function smRecent(){
  /* pinned apps leave the MRU: XP never listed a program twice */
  const r=(store.data.recent||[]).filter(id=>SMAPPS[id]&&!store.data.pinned.includes(id));
  for(const id of SM_DEFAULT) if(r.length<6&&r.indexOf(id)<0&&!store.data.pinned.includes(id)) r.push(id);
  return r.slice(0,6);
}
function smTouch(id){
  if(!SMAPPS[id]||id==="win-ie") return;   /* Internet is pinned above the line */
  const r=(store.data.recent||[]).filter(x=>x!==id);
  r.unshift(id);
  store.data.recent=r.slice(0,8);
  store.save();
  renderMru();
}
function renderMru(){
  const host=$("#sm-mru"); if(!host) return;
  host.innerHTML="";
  for(const id of smRecent()){
    const a=SMAPPS[id];
    const el=document.createElement("div");
    el.className="sm-item";
    el.dataset.app=id;
    el.innerHTML=`<i class="xico"></i><div class="sm-texts"><div class="sm-text"></div></div>`;
    el.querySelector(".xico").appendChild(icoNode(a.ico));
    el.querySelector(".sm-text").textContent=a.label;
    el.addEventListener("click",()=>{ closeStart(); sysSnd("nav",.5); openWin(id); });
    host.appendChild(el);
  }
}
/* pinned items live above the separator and survive reloads, like real pins */
function renderPinned(){
  const host=$("#sm-pinned"); if(!host) return;
  host.innerHTML="";
  for(const id of store.data.pinned){
    const a=SMAPPS[id]; if(!a) continue;
    const el=document.createElement("div");
    el.className="sm-item"; el.dataset.app=id;
    el.innerHTML=`<i class="xico"></i><div class="sm-texts"><div class="sm-text"></div></div>`;
    el.querySelector(".xico").appendChild(icoNode(a.ico));
    el.querySelector(".sm-text").textContent=a.label;
    el.addEventListener("click",()=>{ closeStart(); sysSnd("nav",.5); openWin(id); });
    host.appendChild(el);
  }
}
renderPinned();
/* the MRU used to be drawn only when an app was opened, so the phone — which
   boots to a bare desktop on purpose — showed a Start menu with an empty left
   column until you launched something */
renderMru();
function startItemMenu(el){
  const id=el.dataset.app;
  const items=[{label:"Open",bold:1,action:()=>{ closeStart(); el.click(); }}];
  if(id&&SMAPPS[id]){
    const pinned=store.data.pinned.includes(id);
    items.push({sep:1});
    items.push(pinned
      ?{label:"Unpin from Start menu",action(){ store.data.pinned=store.data.pinned.filter(p=>p!==id); store.save(); renderPinned(); }}
      :{label:"Pin to Start menu",action(){ if(!store.data.pinned.includes(id)) store.data.pinned.push(id); store.save(); renderPinned(); }});
    if(el.closest("#sm-mru")) items.push({label:"Remove from This List",action(){
      store.data.recent=(store.data.recent||[]).filter(r=>r!==id); store.save(); renderMru();
    }});
  }
  items.push({sep:1},{label:"Properties",disabled:1});
  return items;
}
$("#startbtn").addEventListener("click",e=>{ e.stopPropagation(); sClick(); startmenu.classList.toggle("open"); });
addEventListener("pointerdown",e=>{ if(!e.target.closest("#startmenu,#startbtn")) closeStart(); });
addEventListener("keydown",e=>{
  /* F11 is theater mode, and Escape leaves it — the two keys everybody
     already tries on a video that fills the window */
  if(e.key==="F11"&&ie&&openApps.has("win-ie")){ e.preventDefault(); ie.theater(!ie.isTheater()); return; }
  if(e.key==="Escape"&&ie&&ie.isTheater()){ ie.theater(false); return; }
  if(e.key==="Escape"){ closeStart(); hideMenu(); }
  if(e.ctrlKey&&e.shiftKey&&e.key==="Escape"){ openWin("win-taskmgr"); }
  else if(e.ctrlKey&&e.key==="Escape"){ e.preventDefault(); sClick(); startmenu.classList.toggle("open"); }
});
/* ---------- the Alt+Tab box ---------- */
/* the OS eats real Alt+Tab in a browser, so Ctrl+Tab drives the same box —
   grey panel, icon strip, caption underneath, exactly the XP shape */
let atBox=null, atList=[], atSel=0;
function altTabShow(){
  atList=[...openApps.entries()].filter(([id,a])=>!NOTAB.has(id)).map(([id,a])=>({id,a}));
  if(!atList.length) return false;
  if(!atBox){
    atBox=document.createElement("div");
    atBox.id="alttab";
    atBox.innerHTML=`<div class="at-icons"></div><div class="at-cap"></div>`;
    document.body.appendChild(atBox);
  }
  const host=atBox.querySelector(".at-icons"); host.innerHTML="";
  atList.forEach((w,i)=>{
    const c=document.createElement("span");
    c.className="at-cell"+(i===atSel?" on":"");
    c.innerHTML=w.a.icon||"";
    host.appendChild(c);
  });
  atBox.querySelector(".at-cap").textContent=(atList[atSel]&&winTitle(atList[atSel].id))||"";
  atBox.style.display="block";
  return true;
}
function winTitle(id){
  const a=openApps.get(id);
  if(a&&a.title) return a.title;
  const t=$("#"+id+" .title-bar-text"); return t?t.textContent:id;
}
function altTabEnd(commit){
  if(!atBox||atBox.style.display!=="block") return;
  atBox.style.display="none";
  if(commit&&atList[atSel]){ const {id,a}=atList[atSel]; if(a.min) restoreWin(id); else focusWin(id); }
  atSel=0;
}
addEventListener("keydown",e=>{
  if(e.key==="Tab"&&(e.ctrlKey||e.altKey)&&!e.shiftKey){
    e.preventDefault();
    if(!atBox||atBox.style.display!=="block"){ atSel=0; if(!altTabShow()) return; }
    else { atSel=(atSel+1)%atList.length; altTabShow(); }
  }
  if(e.key==="Tab"&&(e.ctrlKey||e.altKey)&&e.shiftKey&&atBox&&atBox.style.display==="block"){
    e.preventDefault(); atSel=(atSel-1+atList.length)%atList.length; altTabShow();
  }
},true);
addEventListener("keyup",e=>{ if(e.key==="Control"||e.key==="Alt") altTabEnd(true); },true);
/* ---------- desktop keyboard verbs: F2 rename, Delete, Shift+Delete, F5 ---------- */
addEventListener("keydown",e=>{
  if(e.target.closest("input,textarea,select")) return;
  if(e.key==="z"&&(e.ctrlKey||e.metaKey)){
    /* the desktop menu advertises Undo Delete; the keyboard honours it */
    if(binFiles.length){ e.preventDefault(); restoreOne(binFiles[0]); }
    return;
  }
  const selEl=$(".icon.sel");
  if(e.key==="F2"&&selEl){
    e.preventDefault();
    const ic=iconById(selEl.dataset.iid);
    if(ic&&!ic.sys) startRename(ic);
    return;
  }
  if(e.key==="Delete"&&selEl){
    e.preventDefault();
    const ic=iconById(selEl.dataset.iid);
    if(!ic) return;
    if(ic.sys){
      showError("Error Deleting File or Folder",
        `Cannot delete ${ic.label}: Access is denied.\n\nMake sure the disk is not full or write-protected and that the file is not currently in use.`);
      return;
    }
    if(e.shiftKey){
      showConfirm("Confirm File Delete",`Are you sure you want to permanently delete '${ic.label}'?`,()=>{
        store.data.userIcons=store.data.userIcons.filter(u=>u.id!==ic.id);
        delete store.data.icons[ic.id];
        store.save(); renderIcons(); sCrunch();
      });
    }else deleteIcon(ic);
    return;
  }
  if(e.key==="F5"&&desktopActive()&&!e.target.closest(".window")){
    e.preventDefault(); refreshDesktop();
  }
});
function allProgramsMenu(){
  const go=id=>()=>{ closeStart(); sysSnd("nav",.5); openWin(id); };
  /* Add or Remove Programs took it off the disk, so it is off the menu too */
  const has=id=>{ try{ return maint.installed(id); }catch(e){ return true; } };
  const only=(id,item)=>has(id)?[item]:[];
  return [
    {label:"CURSORS.EXE",bold:1,action:go("win-cursors")},
    {label:"Internet Explorer",action:go("win-ie")},
    {label:"Outlook Express",action:go("win-oe")},
    ...only("chat",{label:"Windows Messenger",action:go("win-chat")}),
    ...only("amp",{label:"Winamp",action:go("win-amp")}),
    {sep:1},
    ...only("wmp",{label:"Windows Media Player",action:()=>{ closeStart(); smAction("wmp"); }}),
    {sep:1},
    {label:"Accessories",sub:[
      {label:"Accessibility",sub:[
        {label:"Accessibility Wizard",action:()=>{ closeStart(); access.openAccessOptions(); }},
        {label:"Magnifier",action:()=>{ closeStart(); access.openMagnifier(); }},
        {label:"Narrator",action:()=>openWin("win-narrator")},
        {label:"On-Screen Keyboard",action:()=>{ closeStart(); access.openOSK(); }}]},
      {label:"System Tools",sub:[
        {label:"Disk Cleanup",action:()=>{ closeStart(); openWin("win-explorer"); explorer.go("C:\\"); setTimeout(()=>explorer.driveProperties(),350); }},
        {label:"Disk Defragmenter",action:()=>{ closeStart(); depth.openDefrag(); }},
        {label:"System Restore",action:()=>{ closeStart(); maint.openRestore(); }},
        {label:"Scheduled Tasks",action:()=>{ closeStart(); maint.openTasks(); }},
        {label:"System Information",action:()=>{ closeStart(); sysinfo.openMsinfo(); }},
        {label:"Character Map",action:()=>{ closeStart(); depth.openCharmap(); }},
        {label:"Fonts",action:()=>{ closeStart(); maint.openFonts(); }}]},
      {label:"Entertainment",sub:[
        ...only("sndrec",{label:"Sound Recorder",action:()=>{ closeStart(); snd.openRecorder(); }}),
        {label:"Volume Control",action:()=>{ closeStart(); snd.openMixer(); }},
        ...only("wmp",{label:"Windows Media Player",action:()=>{ closeStart(); snd.openWmp(); }})]},
      {sep:1},
      ...only("notepad",{label:"Notepad",action:()=>{ closeStart(); write.openNotepad(null); }}),
      ...only("wordpad",{label:"WordPad",action:()=>{ closeStart(); write.openWordpad(null); }}),
      ...only("paint",{label:"Paint",action:go("win-paint")}),
      ...only("calc",{label:"Calculator",action:()=>{ closeStart(); depth.openCalc(); }}),
      {label:"Command Prompt",action:go("win-cmd")},
      {label:"Tour Windows XP",action:go("win-tourxp")}]},
    {label:"Administrative Tools",sub:[
      {label:"Services",action:go("win-services")},
      {label:"Device Manager",action:go("win-devmgr")},
      {label:"Group Policy",action:go("win-gpedit")},
      {label:"Event Viewer",action:go("win-eventvwr")},
      {label:"System Configuration Utility",action:()=>{ closeStart(); maint.openMsconfig(); }},
      {label:"Add or Remove Programs",action:()=>{ closeStart(); maint.openAddRemove(); }},
      {sep:1},
      {label:"Control Panel",action:go("win-control")}]},
    {label:"Games",sub:[
      ...only("mine",{label:"Minesweeper",action:go("win-mine")}),
      ...only("solitaire",{label:"Solitaire",action:()=>{ closeStart(); solitaireOpen(); }}),
      {label:"FreeCell",action:go("win-freecell")},
      {label:"Spider Solitaire",action:go("win-spider")},
      {label:"Hearts",action:go("win-hearts")},
      {label:"Pinball",disabled:1}]},
    {label:"Startup",sub:[
      {label:"CURSORS.EXE",action:go("win-cursors")}]},
    {sep:1},
    {label:"How to Play",action:()=>{ closeStart(); tour.open(true); }},
    {label:"Help and Support",action:go("win-help")},
    {label:"Windows Update",action:()=>{ closeStart(); windowsUpdate(); }},
  ];
}
function smAction(act,itemEl){
  switch(act){
    case "email": oe.open(); break;
    case "wmp": showError("Windows Media Player","Another application (winamp.exe) has exclusive control of the llama."); break;
    case "mydocs": openFolderWin("My Documents"); break;
    case "mypics": openFolderWin("My Pictures"); break;
    case "connect": showError("Network Connections","Dial-up to Solana Mainnet: no dial tone. Ships with the chain update."); break;
    case "printers": showError("Printers and Faxes","CURSORS-PRINTER is out of ink. It was printing money."); break;
    case "search": openWin("win-explorer"); explorer.openSearch(); break;
    case "allprograms":{
      const r=itemEl.getBoundingClientRect();
      showMenu(allProgramsMenu(),r.right+4,Math.max(8,r.top-180));
      return;
    }
  }
}
$$(".sm-item").forEach(it=>it.addEventListener("click",()=>{
  if(it.dataset.app){ closeStart(); sysSnd("nav",.5); openWin(it.dataset.app); }
  else if(it.dataset.act){
    const act=it.dataset.act;
    if(act!=="allprograms"){ closeStart(); sysSnd("nav",.5); }
    smAction(act,it);
  }
}));
$("#sm-logoff").addEventListener("click",()=>{ closeStart(); openWin("win-logoff"); });
$("#sm-off").addEventListener("click",()=>{ closeStart(); sysSnd("shutdown",.55); $("#shutdown").style.display="grid"; });
$("#shutdown").addEventListener("click",()=>{ $("#shutdown").style.display="none"; showBootThenLogin(); });

/* ---- Run dialog ---- */
const RUNMAP={
  "tour":"win-tour",
  "tourstart":"win-tourxp","tourstart.exe":"win-tourxp","tourxp":"win-tourxp",
  "cursors":"win-cursors","cursors.exe":"win-cursors",
  "taskmgr":"win-taskmgr","taskmgr.exe":"win-taskmgr",
  "winamp":"win-amp","winamp.exe":"win-amp",
  "msnmsgr":"win-chat","msmsgs":"win-chat",
  "iexplore":"win-ie","iexplore.exe":"win-ie",
  "notepad":"win-readme","notepad.exe":"win-readme",
  "winmine":"win-mine","winmine.exe":"win-mine",
  "mspaint":"win-paint","mspaint.exe":"win-paint","paint":"win-paint","pbrush":"win-paint",
  "calc":"win-calc","calc.exe":"win-calc",
  "charmap":"win-charmap","charmap.exe":"win-charmap",
  "dfrg.msc":"win-defrag","defrag":"win-defrag",
  "main.cpl":"win-mouse",
  "desk.cpl":"win-dispprops",
  "explorer":"win-explorer","explorer.exe":"win-explorer","c:":"win-explorer","sysdm.cpl":"win-sysprops",
  "timedate.cpl":"win-datetime",
  "cmd":"win-cmd","cmd.exe":"win-cmd","command":"win-cmd","command.com":"win-cmd",
  "control.exe":"win-control","control panel":"win-control",
  "services.msc":"win-services","services":"win-services",
  "devmgmt.msc":"win-devmgr","devmgmt":"win-devmgr","hdwwiz.cpl":"win-devmgr",
  "gpedit.msc":"win-gpedit","gpedit":"win-gpedit",
  "mmc":"win-services","taskman":"win-taskmgr","appwiz.cpl":"win-control",
  "msconfig":"win-msconfig","msconfig.exe":"win-msconfig",
  "rstrui":"win-restore","rstrui.exe":"win-restore",
  "msimn":"win-oe","msimn.exe":"win-oe",
  "eventvwr":"win-eventvwr","eventvwr.msc":"win-eventvwr","eventvwr.exe":"win-eventvwr",
  "msinfo32":"win-msinfo","msinfo32.exe":"win-msinfo",
  "dxdiag":"win-dxdiag","dxdiag.exe":"win-dxdiag",
  "winver":"win-winver","winver.exe":"win-winver",
  "utilman":"win-utilman","utilman.exe":"win-utilman",
  "narrator":"win-narrator","narrator.exe":"win-narrator",
};
/* one resolver for the Run box, cmd's START and Control Panel's applets */
/* one table maps a Run name to the component that owns it */
const RUNOWNER={ "calc":"calc","calc.exe":"calc","notepad":"notepad","notepad.exe":"notepad",
  "mspaint":"paint","mspaint.exe":"paint","paint":"paint","pbrush":"paint",
  "sndrec32":"sndrec","sndrec32.exe":"sndrec","wordpad":"wordpad","wordpad.exe":"wordpad",
  "write":"wordpad","write.exe":"wordpad","winmine":"mine","winmine.exe":"mine",
  "sol":"solitaire","sol.exe":"solitaire","solitaire":"solitaire",
  "msnmsgr":"chat","msmsgs":"chat","wmplayer":"wmp","wmplayer.exe":"wmp",
  "winamp":"amp","winamp.exe":"amp" };
function runNamed(k){
  k=String(k||"").trim().toLowerCase().replace(/^"|"$/g,"");
  if(RUNOWNER[k]&&!maint.installed(RUNOWNER[k])){
    showError("Run","Windows cannot find '"+k+"'. Make sure you typed the name correctly, and then try again."+"\n\n"+"It was removed with Add or Remove Programs.");
    return true;
  }
  if(k==="control"){ openWin("win-control"); return true; }
  if(k==="dfrg.msc"||k==="defrag"||k==="defrag.exe"){ depth.openDefrag(); return true; }
  if(k==="main.cpl"){ mouse.open(); return true; }
  if(k==="notepad"||k==="notepad.exe"){ write.openNotepad(null); return true; }
  if(k==="wordpad"||k==="wordpad.exe"||k==="write"||k==="write.exe"){ write.openWordpad(null); return true; }
  if(k==="clipbrd"||k==="clipbrd.exe"){ write.openClipbook(); return true; }
  if(k==="sol"||k==="sol.exe"||k==="solitaire"){ solitaireOpen(); return true; }
  if(k==="freecell"||k==="freecell.exe"){ openWin("win-freecell"); return true; }
  if(k==="spider"||k==="spider.exe"){ openWin("win-spider"); return true; }
  if(k==="mshearts"||k==="mshearts.exe"||k==="hearts"){ openWin("win-hearts"); return true; }
  if(k==="msconfig"||k==="msconfig.exe"){ maint.openMsconfig(); return true; }
  if(k==="appwiz.cpl"||k==="add or remove programs"){ maint.openAddRemove(); return true; }
  if(k==="fonts"||k==="control fonts"){ maint.openFonts(); return true; }
  if(k==="cttune"||k==="cttune.exe"||k==="cleartype"){ maint.openClearType(); return true; }
  if(k==="control schedtasks"||k==="tasks"||k==="schedtasks"){ maint.openTasks(); return true; }
  if(k==="magnify"||k==="magnify.exe"){ access.openMagnifier(); return true; }
  if(k==="osk"||k==="osk.exe"){ access.openOSK(); return true; }
  if(k==="access.cpl"||k==="accessibility"){ access.openAccessOptions(); return true; }
  if(k==="rstrui"||k==="rstrui.exe"||k==="system restore"){ maint.openRestore(); return true; }
  if(k==="control folders"||k==="folders"||k==="folder options"){ maint.openFolderOptions(); return true; }
  if(k==="sndvol32"||k==="sndvol32.exe"||k==="sndvol"){ snd.openMixer(); return true; }
  if(k==="sndrec32"||k==="sndrec32.exe"){ snd.openRecorder(); return true; }
  if(k==="wmplayer"||k==="wmplayer.exe"){ snd.openWmp(); return true; }
  if(RUNMAP[k]){ sysSnd("nav",.5); openWin(RUNMAP[k]); return true; }
  return false;
}
function runCommand(){
  const v=$("#run-in").value.trim();
  closeWin("win-run");
  if(!v) return;
  const k=v.toLowerCase();
  if(runNamed(k)) return;
  if(k==="regedit"||k==="regedit.exe"){ depth.openRegedit(); return; }
  if(k==="format c:"||k==="format c"){ showError("Format Local Disk (C:)","The disk is in use by CURSORS.EXE and cannot be formatted."); return; }
  /* Run took URLs in 2003, and so does this one */
  if(!/\.(exe|msc|cpl|dll|bat|com|ini|sys|txt|log)$/i.test(k)&&
     (/^(https?:\/\/|www\.)/i.test(k)||/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(k))){
    sysSnd("nav",.5); openWin("win-ie"); ie.go(v); return;
  }
  showError("Run","Windows cannot find '"+v+"'. Make sure you typed the name correctly, and then try again.");
}
$("#run-ok").addEventListener("click",runCommand);
$("#run-cancel").addEventListener("click",()=>closeWin("win-run"));
$("#run-browse").addEventListener("click",()=>showError("Browse","There is nothing else. This is the whole computer."));
$("#run-in").addEventListener("keydown",e=>{ e.stopPropagation(); if(e.key==="Enter") runCommand(); if(e.key==="Escape") closeWin("win-run"); });
$("#btn-logoff-no").addEventListener("click",()=>{ sClick(); closeWin("win-logoff"); });
$("#btn-logoff-switch").addEventListener("click",()=>{
  /* Switch User keeps the session running underneath, exactly as it did */
  sClick(); closeWin("win-logoff",{silent:true}); showLogin(true);
});
function tickClock(){ if(!clockOn) return; $("#clock").textContent=new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}); }
tickClock(); setInterval(tickClock,10000);
let balloonT=null;
function showBalloon(head,text){
  try{ access.narrate&&access.narrate(String(head)+". "+String(text)); }catch(e){}
  if(!toastsOn||(sys&&sys.policyOn("nobal"))) return;   /* Messenger service / policy */
  $("#balloon-h").textContent=head||"Take a tour of CURSORS.EXE";
  $("#balloon-t").textContent=text||"auto-battler. deploy any time. attack or defend from the dashboard. bank before shutdown.";
  $("#balloon").style.display="block"; sBalloon();
  clearTimeout(balloonT);
  balloonT=setTimeout(()=>{ $("#balloon").style.display="none"; },8500);
}
$("#balloon").addEventListener("click",()=>$("#balloon").style.display="none");

/* ================= the CRT ================= */
function applyCrt(){
  document.body.classList.toggle("crt-off",store.data.crt===false);
  $("#crt-chk").checked=store.data.crt!==false;
}
$("#crt-chk").addEventListener("change",()=>{
  store.data.crt=$("#crt-chk").checked; store.save(); applyCrt(); sClick();
  if(store.data.crt) degauss();   /* turning the tube on deserves the thunk */
});
applyCrt();
let degaussT=null;
function degauss(){
  if(store.data.crt===false) return;
  document.body.classList.remove("degaussing");
  void document.body.offsetWidth;   /* restart the animation */
  document.body.classList.add("degaussing");
  clearTimeout(degaussT);
  degaussT=setTimeout(()=>document.body.classList.remove("degaussing"),950);
}

/* ================= xp tabs ================= */
$$(".xtabs").forEach(tabs=>{
  tabs.querySelectorAll(".xtab").forEach(t=>t.addEventListener("click",()=>{
    sClick();
    tabs.querySelectorAll(".xtab").forEach(x=>x.classList.toggle("on",x===t));
    const body=tabs.parentElement;
    body.querySelectorAll(".xpane").forEach(p=>p.classList.toggle("on",p.id===t.dataset.pane));
  }));
});

/* ================= display properties ================= */
/* "painted" is whatever Paint last sent to File > Set As Background. It only
   appears in the list once it exists, exactly like a real wallpaper file. */
function wallpapers(){
  const list=[["bliss","Bliss"]];
  if(store.data.wallpaperData) list.push(["painted","Untitled (Paint)"]);
  list.push(["none","(None)"]);
  return list;
}
let wpSel=store.data.wallpaper||"bliss";
function wpApplyTo(el,id){
  el.style.backgroundColor="#3A6EA5";
  if(id==="painted"&&store.data.wallpaperData){
    const mode=store.data.wallpaperMode||"center";
    el.style.backgroundImage=`url(${store.data.wallpaperData})`;
    el.style.backgroundRepeat=mode==="tile"?"repeat":"no-repeat";
    el.style.backgroundSize=mode==="stretch"?"100% 100%":"auto";
    el.style.backgroundPosition="center";
    el.style.imageRendering="pixelated";
    return;
  }
  el.style.backgroundImage=id==="bliss"?`url(${IMG.bliss})`:"none";
  el.style.backgroundRepeat="no-repeat";
  el.style.backgroundSize="cover";
  el.style.backgroundPosition="center";
  el.style.imageRendering="";
}
function setWallpaper(id){
  if(!wallpapers().some(w=>w[0]===id)) id="bliss";
  wpApplyTo($("#wallpaper"),id);
  store.data.wallpaper=id; store.save();
}
/* Paint hands the desktop a PNG; the desktop is now a meme surface */
function setWallpaperFrom(dataUrl,mode){
  if(sys&&sys.policyOn("nowall")){ showError("Desktop","Your system administrator has disabled changes to the desktop background."); return; }
  store.data.wallpaperData=dataUrl;
  store.data.wallpaperMode=mode||"center";
  wpSel="painted";
  setWallpaper("painted");
  renderWplist();
  log("wallpaper set from Paint ("+store.data.wallpaperMode+")");
  showBalloon("Desktop redecorated","Right-click the desktop → Properties to undo.");
}
function renderWplist(){
  const host=$("#wplist"); host.innerHTML="";
  for(const [id,name] of wallpapers()){
    const d=document.createElement("div"); d.textContent=name;
    d.classList.toggle("on",id===wpSel);
    d.addEventListener("click",()=>{ wpSel=id; renderWplist(); });
    host.appendChild(d);
  }
  wpApplyTo($("#dp-prev"),wpSel);
}
function applySaverUI(){
  store.data.saver.t=$("#sv-sel").value;
  store.data.saver.wait=clamp(+$("#sv-wait").value||3,1,60);
  store.save();
}
$("#dp-apply").addEventListener("click",()=>{ maint.point("Display settings change"); setWallpaper(wpSel); applySaverUI(); sClick(); });
$("#dp-ok").addEventListener("click",()=>{ maint.point("Display settings change"); setWallpaper(wpSel); applySaverUI(); closeWin("win-dispprops"); });
$("#dp-cancel").addEventListener("click",()=>{ wpSel=store.data.wallpaper; renderWplist(); closeWin("win-dispprops"); });
$("#sv-test").addEventListener("click",()=>{ applySaverUI(); if($("#sv-sel").value!=="none") startSaver($("#sv-sel").value); });

/* ================= screensavers ================= */
/* the roster is XP's own, rendered by savers.js; this section owns only the
   idle timer, the fullscreen canvas and the Display Properties preview */
const savers=initSavers({store,IMG,hooks:{
  /* My Pictures Slideshow: whatever the machine actually has - your Paint
     saves, the painted wallpaper, the gallery, and Bliss as the floor */
  pictures(){
    const out=[];
    for(const p of (store.data.pictures||[])) out.push(p.data);
    if(store.data.wallpaperData) out.push(store.data.wallpaperData);
    try{ for(const g of (mpGalleryData()||[])) out.push(g.png); }catch(e){}
    out.push(IMG.bliss);
    return out;
  },
}});
/* the old three-saver ids live in stores in the wild; map them once */
if(store.data.saver&&["ribbons","bounce"].includes(store.data.saver.t)) store.data.saver.t="pipes";
if(store.data.saver&&!savers.has(store.data.saver.t)&&store.data.saver.t!=="none") store.data.saver.t="pipes";
const saverCv=$("#saver");
let saverOn=false, saverRaf=0, saverState=null, saverStartAt=0, lastAct=performance.now();
["pointermove","pointerdown","keydown","wheel"].forEach(ev=>addEventListener(ev,()=>{
  lastAct=performance.now();
  if(saverOn&&performance.now()-saverStartAt>450) stopSaver();
},{passive:true}));
function startSaver(type){
  if(saverOn) return;
  saverOn=true; saverStartAt=performance.now();
  saverCv.width=innerWidth; saverCv.height=innerHeight;
  saverCv.style.display="block";
  const g=saverCv.getContext("2d");
  g.fillStyle="#000"; g.fillRect(0,0,saverCv.width,saverCv.height);
  saverState=savers.create(type,saverCv.width,saverCv.height);
  let last=performance.now();
  const loop=t=>{
    if(!saverOn) return;
    const dt=Math.min(.05,(t-last)/1000); last=t;
    saverState.frame(g,dt);
    saverRaf=requestAnimationFrame(loop);
  };
  saverRaf=requestAnimationFrame(loop);
}
function stopSaver(){
  saverOn=false; cancelAnimationFrame(saverRaf);
  if(saverState){ saverState.destroy(); saverState=null; }
  saverCv.style.display="none";
}
setInterval(()=>{
  if(saverOn||!desktopActive()) return;
  if(store.data.saver.t==="none") return;
  if((performance.now()-lastAct)/60000>=store.data.saver.wait) startSaver(store.data.saver.t);
},5000);
/* the Screen Saver tab: XP's list, a working Settings... per saver, and the
   tilted-monitor preview running the real thing at thumbnail size */
{
  const sel=$("#sv-sel");
  sel.innerHTML="";
  for(const s of savers.list()){
    const o=document.createElement("option");
    o.value=s.id; o.textContent=s.label;
    sel.appendChild(o);
  }
  sel.value=savers.has(store.data.saver.t)?store.data.saver.t:"none";
  sel.addEventListener("change",()=>{ $("#sv-settings").disabled=!(savers.list().find(s=>s.id===sel.value)||{}).settings; });
  $("#sv-settings").disabled=!(savers.list().find(s=>s.id===sel.value)||{}).settings;
}
const svPrev=$("#sv-prev");
let miniState=null, miniType=null, lastMini=0;
(function miniLoop(){
  requestAnimationFrame(miniLoop);
  if($("#win-dispprops").style.display!=="flex"||!$("#dp-saver").classList.contains("on")){
    if(miniState){ miniState.destroy(); miniState=null; }
    lastMini=0; return;
  }
  const type=$("#sv-sel").value;
  const g=svPrev.getContext("2d");
  if(type==="none"||!savers.has(type)){ g.fillStyle="#000"; g.fillRect(0,0,svPrev.width,svPrev.height); if(miniState){miniState.destroy();miniState=null;} return; }
  if(!miniState||miniType!==type){
    miniType=type;
    if(miniState) miniState.destroy();
    miniState=savers.create(type,svPrev.width,svPrev.height);
    g.fillStyle="#000"; g.fillRect(0,0,svPrev.width,svPrev.height);
  }
  const now=performance.now();
  const dt=lastMini?Math.min(.05,(now-lastMini)/1000):.016;
  lastMini=now;
  miniState.frame(g,dt);
})();
/* per-saver Settings... - the real dialogs asked for text and joints */
$("#sv-settings").addEventListener("click",()=>{
  const id=$("#sv-sel").value, c=savers.cfgOf(id);
  const host=$("#svo-body"); host.innerHTML="";
  const row=(label,el)=>{ const d=document.createElement("div"); d.className="aprow";
    const s=document.createElement("span"); s.className="lb"; s.textContent=label;
    d.appendChild(s); d.appendChild(el); host.appendChild(d); return el; };
  const fields={};
  if(id==="pipes"){
    $("#win-saveropts .title-bar-text").textContent="3D Pipes Settings";
    const j=document.createElement("select");
    for(const [v,l] of [["elbow","Elbows"],["ball","Ball"],["mixed","Mixed"]]){ const o=document.createElement("option"); o.value=v; o.textContent=l; j.appendChild(o); }
    j.value=c.joint||"elbow"; fields.joint=row("Joint type",j);
    const m=document.createElement("input"); m.type="checkbox"; m.checked=c.multiple!==0;
    const lb=document.createElement("label"); lb.style.cssText="display:flex;gap:6px;align-items:center;padding:2px 0";
    lb.appendChild(m); lb.appendChild(document.createTextNode(" Multiple pipes"));
    host.appendChild(lb); fields.multiple=m;
  }else if(id==="text3d"){
    $("#win-saveropts .title-bar-text").textContent="3D Text Settings";
    const t=document.createElement("input"); t.type="text"; t.maxLength=16; t.value=c.text||"CURSORS"; t.style.flex="1";
    fields.text=row("Custom text",t);
    const r=document.createElement("select");
    for(const [v,l] of [["spin","Spin"],["seesaw","See-Saw"],["wobble","Wobble"]]){ const o=document.createElement("option"); o.value=v; o.textContent=l; r.appendChild(o); }
    r.value=c.rot||"spin"; fields.rot=row("Rotation type",r);
  }else if(id==="marquee"){
    $("#win-saveropts .title-bar-text").textContent="Marquee Setup";
    const t=document.createElement("input"); t.type="text"; t.maxLength=60; t.value=c.text||"Your message here"; t.style.flex="1";
    fields.text=row("Text",t);
    const sp=document.createElement("input"); sp.type="range"; sp.min=1; sp.max=11; sp.value=c.speed||6; sp.style.flex="1";
    fields.speed=row("Speed",sp);
  }else if(id==="slideshow"){
    $("#win-saveropts .title-bar-text").textContent="My Pictures Screen Saver Options";
    const d=document.createElement("input"); d.type="number"; d.min=3; d.max=30; d.value=c.dwell||6; d.style.width="56px";
    fields.dwell=row("Seconds per picture",d);
  }else if(id==="stars"){
    $("#win-saveropts .title-bar-text").textContent="Starfield Setup";
    const n=document.createElement("input"); n.type="number"; n.min=20; n.max=500; n.value=c.n||160; n.style.width="64px";
    fields.n=row("Number of stars",n);
    const sp=document.createElement("input"); sp.type="range"; sp.min=1; sp.max=5; sp.value=c.speed||1; sp.style.flex="1";
    fields.speed=row("Warp speed",sp);
  }
  $("#svo-ok").onclick=()=>{
    for(const k in fields){
      const f=fields[k];
      c[k]=f.type==="checkbox"?(f.checked?1:0):f.type==="number"||f.type==="range"?+f.value:f.value;
    }
    store.save(); miniState=null; miniType=null;   /* preview rebuilds with new settings */
    closeWin("win-saveropts");
  };
  $("#svo-cancel").onclick=()=>closeWin("win-saveropts");
  openWin("win-saveropts");
});

/* ================= date & time ================= */
let calM=null, calY=null;
function renderCal(){
  const now=new Date();
  if(calM===null){ calM=now.getMonth(); calY=now.getFullYear(); }
  $("#cal-title").textContent=new Date(calY,calM,1).toLocaleDateString([],{month:"long",year:"numeric"});
  const first=new Date(calY,calM,1).getDay();
  const days=new Date(calY,calM+1,0).getDate();
  let html="<tr>"+["S","M","T","W","T","F","S"].map(d=>`<th>${d}</th>`).join("")+"</tr><tr>";
  let cell=0;
  for(let i=0;i<first;i++){ html+="<td></td>"; cell++; }
  for(let d=1;d<=days;d++){
    const today=d===now.getDate()&&calM===now.getMonth()&&calY===now.getFullYear();
    html+=`<td${today?' class="today"':""}>${d}</td>`;
    if(++cell%7===0) html+="</tr><tr>";
  }
  $("#caltable").innerHTML=html+"</tr>";
}
$("#cal-prev").addEventListener("click",()=>{ sClick(); calM--; if(calM<0){calM=11;calY--;} renderCal(); });
$("#cal-next").addEventListener("click",()=>{ sClick(); calM++; if(calM>11){calM=0;calY++;} renderCal(); });
function drawClock(){
  const cv=$("#anaclock"), g=cv.getContext("2d");
  const r=50, cx=55, cy=55;
  g.clearRect(0,0,110,110);
  g.fillStyle="#FCFBF6"; g.strokeStyle="#4A6FA5"; g.lineWidth=2;
  g.beginPath(); g.arc(cx,cy,r,0,6.283); g.fill(); g.stroke();
  g.strokeStyle="#8A96A8"; g.lineWidth=1;
  for(let i=0;i<12;i++){
    const a=i/12*6.283;
    g.beginPath();
    g.moveTo(cx+Math.sin(a)*(r-6),cy-Math.cos(a)*(r-6));
    g.lineTo(cx+Math.sin(a)*(r-2),cy-Math.cos(a)*(r-2));
    g.stroke();
  }
  const n=new Date();
  const hr=(n.getHours()%12+n.getMinutes()/60)/12*6.283;
  const mn=(n.getMinutes()+n.getSeconds()/60)/60*6.283;
  const sc=n.getSeconds()/60*6.283;
  g.lineWidth=3.4; g.strokeStyle="#1A3A6E";
  g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.sin(hr)*(r-24),cy-Math.cos(hr)*(r-24)); g.stroke();
  g.lineWidth=2.2;
  g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.sin(mn)*(r-13),cy-Math.cos(mn)*(r-13)); g.stroke();
  g.lineWidth=1; g.strokeStyle="#C33";
  g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.sin(sc)*(r-9),cy-Math.cos(sc)*(r-9)); g.stroke();
  $("#digiclock").textContent=n.toLocaleTimeString([],{hour12:false});
}
/* The Time Zone tab. XP had a world map here; we cannot ship one, so the space
   does the job a time zone tab is actually for — it reads the machine's real
   zone and shows you what time it is in the other ones. Nothing invented. */
const TZWORLD=[["Los Angeles","America/Los_Angeles"],["New York","America/New_York"],
  ["London","Europe/London"],["Berlin","Europe/Berlin"],["Dubai","Asia/Dubai"],
  ["Singapore","Asia/Singapore"],["Tokyo","Asia/Tokyo"],["Sydney","Australia/Sydney"],
  ["UTC","UTC"]];
function tzLocal(){ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"; }catch(e){ return "UTC"; } }
function tzOffsetLabel(zone,d){
  try{
    const p=new Intl.DateTimeFormat("en-US",{timeZone:zone,timeZoneName:"longOffset"}).formatToParts(d);
    const o=p.find(x=>x.type==="timeZoneName");
    return o?o.value.replace("GMT","GMT").replace(/^GMT$/,"GMT+00:00"):"GMT";
  }catch(e){ return "GMT"; }
}
function tzTime(zone,d){
  try{ return d.toLocaleTimeString("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit"}); }
  catch(e){ return "--:--"; }
}
function renderTz(){
  const d=new Date(), here=tzLocal();
  const sel=$("#tz-sel");
  if(!sel.options.length){
    /* the machine's own zone first, then the zones a lobby actually spans */
    const zones=[here].concat(TZWORLD.map(z=>z[1]).filter(z=>z!==here));
    for(const z of zones){
      const o=document.createElement("option");
      o.value=z; o.textContent=`(${tzOffsetLabel(z,d)}) ${z.replace(/_/g," ")}`;
      sel.appendChild(o);
    }
    sel.value=here;
    /* the checkbox is disabled and honest about why: the browser reports the
       machine's DST state, it does not let a page change it */
    $("#tz-dst").checked=tzIsDst(here,d);
    $("#tz-dst").title="This is what your operating system reports. A web page cannot change it.";
  }
  const host=$("#tz-world"); host.innerHTML="";
  /* the machine's own zone always appears, even when it is not on the list */
  const rows=TZWORLD.some(z=>z[1]===here)?TZWORLD:[[here.split("/").pop().replace(/_/g," "),here]].concat(TZWORLD);
  for(const [city,zone] of rows){
    const row=document.createElement("div");
    if(zone===here||zone===sel.value) row.className="here";
    row.innerHTML=`<span>${city}</span><b>${tzTime(zone,d)} ${tzOffsetLabel(zone,d)}</b>`;
    host.appendChild(row);
  }
}
/* DST = this zone is currently further from UTC than its own winter offset */
function tzMinutes(zone,d){
  try{
    const v=new Intl.DateTimeFormat("en-US",{timeZone:zone,timeZoneName:"longOffset"})
      .formatToParts(d).find(x=>x.type==="timeZoneName").value;
    const m=/GMT([+-])(\d{1,2}):?(\d{2})?/.exec(v);
    return m?(m[1]==="-"?-1:1)*(+m[2]*60+(+m[3]||0)):0;
  }catch(e){ return 0; }
}
function tzIsDst(zone,d){
  const jan=tzMinutes(zone,new Date(d.getFullYear(),0,1));
  const jul=tzMinutes(zone,new Date(d.getFullYear(),6,1));
  return tzMinutes(zone,d)>Math.min(jan,jul);
}
$("#tz-sel").addEventListener("change",renderTz);
setInterval(()=>{ if($("#win-datetime").style.display==="flex"){ drawClock(); renderTz(); } },1000);
function openClockProps(){ calM=null; renderCal(); drawClock(); renderTz(); openWin("win-datetime"); }
/* XP opened this on a double-click. A phone has no double-click worth the
   name, so a tap is enough there. */
$("#clock").addEventListener("dblclick",openClockProps);
if(MOBILE) $("#clock").addEventListener("click",openClockProps);
$("#dt-ok").addEventListener("click",()=>closeWin("win-datetime"));
$("#dt-cancel").addEventListener("click",()=>closeWin("win-datetime"));
/* XP's own string, verbatim — the clock reads the machine and a web page may
   not set it, which is exactly what Windows says when you lack the right. */
$("#dt-apply").addEventListener("click",()=>showError("Date and Time",`You do not have permission to perform this task.

Contact your computer administrator.`));

/* ================= task manager ================= */
let duelPulse=0, tmSel=null, tmHist=[];
const TMPROCS_ALL=["cursors.exe","explorer.exe","msnmsgr.exe","winamp.exe","wallet.dll","hopium.sys","rundll32.exe","svchost.exe","svchost.exe","mumu.exe","copium.drv","System Idle Process"];
/* MSConfig's Startup boxes are load-bearing here too: clearing wallet or
   ctfmon really takes the row out of Task Manager */
function TMPROCS(){
  return TMPROCS_ALL.filter(n=>!(n==="wallet.dll"&&!maint.startupOn("wallet"))
    &&!(n==="rundll32.exe"&&!maint.startupOn("ctfmon")));
}
function tmCpu(){ return Math.min(99,Math.round(3+duelPulse*24+curs.length*.6+Math.random()*4)); }
let tmPfHist=[], tmNetHist=[], tmProcSel=null, tmNetLast=0;
function tmHeapMB(){
  /* real memory where the browser will tell us; a plausible commit elsewhere */
  try{ return Math.round(performance.memory.usedJSHeapSize/1048576); }catch(e){ return 96+Math.round(upT/60)%32; }
}
function tmGraph(cv,hist,color){
  const g=cv.getContext("2d");
  g.fillStyle="#000"; g.fillRect(0,0,cv.width,cv.height);
  g.strokeStyle="#123A12"; g.lineWidth=1;
  for(let x=0;x<cv.width;x+=12){ g.beginPath(); g.moveTo(x+.5,0); g.lineTo(x+.5,cv.height); g.stroke(); }
  for(let y=0;y<cv.height;y+=12){ g.beginPath(); g.moveTo(0,y+.5); g.lineTo(cv.width,y+.5); g.stroke(); }
  g.strokeStyle=color; g.lineWidth=1.5; g.beginPath();
  hist.forEach((v,i)=>{
    const x=cv.width-(hist.length-i)*4, y=cv.height-Math.min(1,v/100)*cv.height;
    i?g.lineTo(x,y):g.moveTo(x,y);
  });
  g.stroke();
}
/* View > Update Speed is real: it is this interval. Paused means paused. */
const TM_SPEED={high:350,normal:700,low:2800,paused:0};
let tmSpeed=store.data.tmSpeed||"normal", tmTimer=null;
function tmSetSpeed(k){
  tmSpeed=k; store.data.tmSpeed=k; store.save();
  clearInterval(tmTimer); tmTimer=null;
  if(TM_SPEED[k]) tmTimer=setInterval(tmTick,TM_SPEED[k]);
}
function tmTick(){
  duelPulse=Math.max(0,duelPulse-.34);
  const open=$("#win-taskmgr").style.display==="flex";
  $("#tray-cpu").style.display=open?"flex":"none";
  if(!open) return;
  const cpu=tmCpu();
  $("#tray-cpu i").style.height=Math.max(8,cpu)+"%";
  $("#tray-cpu").dataset.tip="CPU Usage: "+cpu+"%";
  if($("#tm-apps").classList.contains("on")){
    const host=$("#tmapps"); host.innerHTML="";
    for(const [id] of openApps){
      if(NOTAB.has(id)||id==="win-taskmgr") continue;
      const row=document.createElement("div");
      row.className="row"+(tmSel===id?" on":"");
      row.innerHTML=`<span>${tabTitle(id)}</span><span>Running</span>`;
      row.addEventListener("click",()=>{
        tmSel=id;
        [...host.children].forEach(r=>r.classList.remove("on"));
        row.classList.add("on");
      });
      host.appendChild(row);
    }
  }
  if($("#tm-procs").classList.contains("on")){
    const host=$("#tmprocs"); host.innerHTML="";
    const hdr=document.createElement("div"); hdr.className="row hdr";
    hdr.innerHTML="<span>Image Name</span><span>CPU</span>";
    host.appendChild(hdr);
    for(const name of TMPROCS()){
      const c=name==="System Idle Process"?100-cpu
        :name==="cursors.exe"?Math.max(1,cpu-6)
        :Math.round(Math.random()*2);
      const row=document.createElement("div"); row.className="row"+(tmProcSel===name?" on":"");
      row.innerHTML=`<span>${name}</span><span>${String(c).padStart(2,"0")}</span>`;
      row.addEventListener("click",()=>{ tmProcSel=name;
        [...host.children].forEach(r=>r.classList.remove("on")); row.classList.add("on"); });
      row.addEventListener("contextmenu",e=>{
        e.preventDefault(); e.stopPropagation();
        tmProcSel=name;
        [...host.children].forEach(r=>r.classList.remove("on")); row.classList.add("on");
        showMenu([
          {label:"End Process",action:()=>$("#tm-endproc").click()},
          {label:"End Process Tree",action:()=>$("#tm-endproc").click()},
          {sep:1},
          {label:"Set Priority",sub:[
            {label:"Realtime",disabled:1},{label:"High",disabled:1},{label:"AboveNormal",disabled:1},
            {label:"Normal",check:1,disabled:1},{label:"BelowNormal",disabled:1},{label:"Low",disabled:1},
          ]},
        ],e.clientX,e.clientY);
      });
      host.appendChild(row);
    }
  }
  if($("#tm-perf").classList.contains("on")){
    tmHist.push(cpu); if(tmHist.length>60) tmHist.shift();
    const heap=tmHeapMB();
    tmPfHist.push(Math.min(100,heap/4)); if(tmPfHist.length>60) tmPfHist.shift();
    tmGraph($("#tmgraph"),tmHist,"#2FD858");
    tmGraph($("#tmpf"),tmPfHist,"#E8D830");
    $("#tm-cpugauge i").style.height=cpu+"%"; $("#tm-cpugauge b").textContent=cpu+"%";
    $("#tm-pfgauge i").style.height=Math.min(100,heap/4)+"%"; $("#tm-pfgauge b").textContent=heap+" MB";
    $("#tmstats").innerHTML=
      `<span>Handles: <b>${(4200+curs.length*31)%9999}</b></span><span>Commit Charge: <b>${heap} MB</b></span>`+
      `<span>Threads: <b>${390+binDead.length%99}</b></span><span>Physical Memory: <b>523 MB</b></span>`+
      `<span>Processes: <b>${TMPROCS().length}</b></span><span>Up Time: <b>${fmtUpLong(performance.now()/1000)}</b></span>`;
  }
  if($("#tm-net").classList.contains("on")){
    /* real traffic: socket messages per tick, scaled to a 56.6k's idea of busy */
    const d=tmNetMsgs-tmNetLast; tmNetLast=tmNetMsgs;
    const pct=Math.min(100,d*4);
    tmNetHist.push(pct); if(tmNetHist.length>85) tmNetHist.shift();
    tmGraph($("#tmnet"),tmNetHist,"#E8D830");
    $("#tm-netpct").textContent=(MP.on?pct:0)+"%";
  }
  if($("#tm-users").classList.contains("on")) $("#tm-user1").textContent=playerNameFull();
  $("#tmfoot").textContent=`Processes: ${TMPROCS().length} · CPU Usage: ${cpu}% · Commit Charge: ${tmHeapMB()}M`;
}
tmSetSpeed(tmSpeed);
/* the tray meter follows the window, not the update speed — View > Paused
   pauses the numbers, it does not leave a dead meter in the notification area */
setInterval(()=>{
  const open=$("#win-taskmgr").style.display==="flex";
  $("#tray-cpu").style.display=open?"flex":"none";
},1200);
/* the menubar Task Manager has carried, unread, since 2001 */
function tmOpt(k){ return !!(store.data.tmOpts||{})[k]; }
function tmSetOpt(k,v){
  const o=store.data.tmOpts=store.data.tmOpts||{};
  o[k]=v?1:0; store.save();
  if(k==="ontop") $("#win-taskmgr").classList.toggle("always-on-top",!!v);
}
function tmMenu(label,x,y){
  if(label==="File") return showMenu([
    {label:"New Task (Run...)",action:()=>{ openWin("win-run"); setTimeout(()=>$("#run-in").focus(),60); }},
    {sep:1},
    {label:"Exit Task Manager",action:()=>closeWin("win-taskmgr")},
  ],x,y);
  if(label==="Options") return showMenu([
    {label:"Always On Top",check:tmOpt("ontop"),action:()=>tmSetOpt("ontop",!tmOpt("ontop"))},
    {label:"Minimize On Use",check:tmOpt("minuse"),action:()=>tmSetOpt("minuse",!tmOpt("minuse"))},
    {label:"Hide When Minimized",check:tmOpt("hidemin"),action:()=>tmSetOpt("hidemin",!tmOpt("hidemin"))},
    {label:"Show 16-bit tasks",check:1,disabled:1},
  ],x,y);
  if(label==="View") return showMenu([
    {label:"Refresh Now",accel:"F5",action:()=>{ tmTick(); sysSnd("nav",.35); }},
    {label:"Update Speed",sub:[
      {label:"High",check:tmSpeed==="high",action:()=>tmSetSpeed("high")},
      {label:"Normal",check:tmSpeed==="normal",action:()=>tmSetSpeed("normal")},
      {label:"Low",check:tmSpeed==="low",action:()=>tmSetSpeed("low")},
      {label:"Paused",check:tmSpeed==="paused",action:()=>tmSetSpeed("paused")},
    ]},
    {sep:1},
    {label:"Select Columns...",action:()=>showError("Select Columns",
      "All columns are already shown.")},
  ],x,y);
  if(label==="Shut Down") return showMenu([
    {label:"Stand by",action:()=>{ startSaver(store.data.saver.t==="none"?"pipes":store.data.saver.t); }},
    {label:"Hibernate",action:()=>showError("Task Manager","Hibernation is not enabled on this computer. The disk is busy holding corpses.")},
    {sep:1},
    {label:"Turn Off",action:()=>{ closeWin("win-taskmgr"); sysSnd("shutdown",.55); $("#shutdown").style.display="grid"; }},
    {label:"Restart",action:()=>{ closeWin("win-taskmgr"); sysSnd("shutdown",.55);
      const sd=$("#shutdown"); sd.style.display="grid";
      setTimeout(()=>{ if(sd.style.display!=="grid") return; sd.style.display="none"; showBootThenLogin(); },1600); }},
    {sep:1},
    {label:"Log Off "+playerName(),action:()=>{ closeWin("win-taskmgr"); openWin("win-logoff"); }},
    {label:"Switch User",action:()=>showError("Task Manager","There is one account on this computer. Guest tried and was refused.")},
  ],x,y);
  return showMenu([
    {label:"Task Manager Help Topics",action:()=>showError("Windows Task Manager",
      "The graphs are real: memory is this page, the network graph is arena traffic.")},
    {sep:1},
    {label:"About Windows Task Manager",action:()=>showError("About Windows Task Manager",
      "Windows Task Manager\nVersion 5.1 (Build 2600.xpsp2)\n\nIt watches this computer. It has no opinion about the arena.")},
  ],x,y);
}
/* Minimize On Use: opening something from Applications drops Task Manager out of the way */
function tmMinOnUse(){ if(tmOpt("minuse")&&openApps.has("win-taskmgr")) minWin("win-taskmgr"); }

$("#tm-endproc").addEventListener("click",()=>{
  if(!tmProcSel) return;
  showConfirm("Task Manager Warning",
    `WARNING: Terminating a process can cause undesired results including loss of data and system instability. The process will not be given the chance to save its state or data before it is terminated. Are you sure you want to terminate the process?`,
    ()=>{
      if(tmProcSel==="cursors.exe"){ closeWin("win-cursors"); }
      else if(tmProcSel==="explorer.exe"){
        /* the classic: the shell blinks out, then picks itself back up */
        $("#taskbar").style.display="none"; $("#icons").style.display="none";
        setTimeout(()=>{ $("#taskbar").style.display=""; $("#icons").style.display=store.data.showIcons?"":"none"; sysSnd("logon",.4); },2600);
      }
      else if(tmProcSel==="System Idle Process") showError("Task Manager","The operation could not be completed."+String.fromCharCode(10,10)+"Access is denied.");
      else if(tmProcSel==="winamp.exe") closeWin("win-amp");
      else if(tmProcSel==="msnmsgr.exe") closeWin("win-chat");
      else showError("Task Manager","The operation could not be completed."+String.fromCharCode(10,10)+"Access is denied.");
    });
});
$("#tm-disconnect").addEventListener("click",()=>showError("Task Manager","Guest is already disconnected."));
$("#tm-logoffbtn").addEventListener("click",()=>{ openWin("win-logoff"); });
$("#tm-end").addEventListener("click",()=>{ if(tmSel&&openApps.has(tmSel)){ closeWin(tmSel); tmSel=null; } });
$("#tm-switch").addEventListener("click",()=>{
  if(!tmSel||!openApps.has(tmSel)) return;
  const a=openApps.get(tmSel);
  if(a.kind==="webamp"){ if(a.min) tabClick(tmSel); }
  else focusWin(tmSel);
  tmMinOnUse();   /* Options > Minimize On Use */
});

/* ================= Windows Messenger ================= */
const msn=initMessenger({
  EMO, IMG, $, store, sysSnd, playerName:()=>playerName(),
  wireWindow, openWin, closeWin,
  isOpen:id=>openApps.has(id)&&!openApps.get(id).min,
  showMenu, showError, desk:desktop,
  lobbyNet:t=>{ if(!MP.on) return false; mpSend({t:"chat",text:t}); return true; },
  /* Online, the buddy list is real people and the bots are programs. Programs
     do not make small talk, and scripted chatter in a room with real players in
     it is just noise pretending to be company. */
  netLive:()=>MP.on,
  toastsOn:()=>toastsOn,
});
/* ================= Outlook Express ================= */
const oe=initOE({
  IMG, $, store, sysSnd,
  playerName:()=>playerName(),
  wireWindow, openWin, closeWin,
  showMenu, showError, showConfirm,
  desk:desktop,
  /* read-only getters — the statement mail reads these at display time */
  hooks:{
    wallet:()=>wallet,
    rake:()=>rakeAccrued,
    tickets:()=>myTickets,
    deploys:()=>stats.deploys,
    staked:()=>stats.tIn,
    banked:()=>stats.tOut,
    epoch:()=>roundNo,
    contacts:()=>MSN_CONTACTS.map(c=>({name:c.name,status:"Online"})),
  },
});
const sysinfo=initSysInfo({
  $,store,sysSnd,showMenu,showError,openWin,closeWin,icoNode,
  tone,   /* the mixer-respecting oscillator: SW Synth fader applies */
  hooks:{
    appLog:()=>appEvents,
    sysLog:()=>sysEvents,
    uptime:()=>upT,
    tasks:()=>liveProcesses().map(p=>({name:p.name,pid:p.pid})),
    cursorCount:()=>curs.length,
  },
});
const chatSys=t=>msn.lobbySys(t);
/* the lobby is for real players. Scripted chatter was authored joke copy
   pretending to be company, so there is none — the log still reports facts. */
const botChat=()=>{};

/* ================= the XP applications ================= */
/* cmd.exe, Control Panel, Services, Device Manager, Group Policy. They read
   live state through these hooks and they change it — a service you stop is
   stopped, a policy you enable applies, and Device Manager's pointing devices
   are the cursors currently on the field. */
const PROC_BASE=[
  {name:"System Idle Process",pid:0,mem:28,critical:1},
  {name:"System",pid:4,mem:236,critical:1},
  {name:"smss.exe",pid:412,mem:388,critical:1},
  {name:"csrss.exe",pid:476,mem:3820,critical:1},
  {name:"winlogon.exe",pid:500,mem:2704,critical:1},
  {name:"services.exe",pid:544,mem:3388,critical:1},
  {name:"lsass.exe",pid:556,mem:1216,critical:1},
  {name:"svchost.exe",pid:728,mem:4980},
  {name:"svchost.exe",pid:816,mem:3944},
  {name:"spoolsv.exe",pid:1104,mem:4288},
  {name:"explorer.exe",pid:1520,mem:14740,critical:1},
];
let killedProcs=new Set();
const PROC_WIN={"iexplore.exe":"win-ie","mspaint.exe":"win-paint","winmine.exe":"win-mine",
  "msmsgs.exe":"win-chat","cmd.exe":"win-cmd"};
function liveProcesses(){
  const out=PROC_BASE.filter(p=>!killedProcs.has(p.pid)).map(p=>Object.assign({},p));
  out.push({name:"cursors.exe",pid:9001,mem:34200+curs.length*420,critical:1});
  if(openApps.has("win-ie")) out.push({name:"iexplore.exe",pid:2244,mem:19860});
  if(openApps.has("win-paint")) out.push({name:"mspaint.exe",pid:2360,mem:8104});
  if(openApps.has("win-mine")) out.push({name:"winmine.exe",pid:2412,mem:2288});
  if(openApps.has("win-chat")) out.push({name:"msmsgs.exe",pid:2488,mem:12560});
  if(openApps.has("win-cmd")) out.push({name:"cmd.exe",pid:2596,mem:2464});
  return out;
}
function fmtUpLong(t){
  const d=Math.floor(t/86400), h=Math.floor(t%86400/3600), m=Math.floor(t%3600/60);
  return `${d} Days, ${h} Hours, ${m} Minutes, ${Math.floor(t%60)} Seconds`;
}
sys=initSysApps({
  $,$$,store,sysSnd,showMenu,showError,openWin,closeWin,
  icoNode,isMobile:MOBILE,
  hooks:{
    openMouse:()=>mouse.open(),
    /* --- filesystem: cmd walks the same tree Explorer does --- */
    fsList:pth=>explorer.list(pth),
    discIn:()=>discIn, insertDisc, autoPlay:autoPlayPrompt, ejectDisc,
    fsRead:it=>{
      if(it.dead) return `A cursor died here.\n\n  owner        ${it.dead.name}\n  killed by    ${it.dead.killer}\n  carrying     ${(it.dead.lost/1000).toFixed(3)} SOL\n  its odds     ${it.dead.odds}%\n  survived     ${it.dead.lived}s\n\nOpen it in the Recycle Bin for the certificate.`;
      if(typeof it.text==="string") return it.text;
      if(it.act) return null;
      return null;
    },
    diskFree:()=>{ const d=diskPct(); return Math.max(0,d.total-Math.round(d.total*d.pct/100)); },
    /* --- machine --- */
    sysInfo:()=>({
      host:"CURSORLAND", owner:playerNameFull(),
      uptime:fmtUpLong(upT),
      memTotal:"512 MB", memFree:(512-Math.min(420,Math.round(120+curs.length*4)))+" MB",
    }),
    netInfo:()=>({ up:MP.on||netUp, ip:MP.on?"10.64.0."+(1+(roundNo%250)):"192.168.0.14",
      gw:"34.70.75.204", rtt:MP.on?46:38 }),
    processes:liveProcesses,
    /* only your own decorative processes can be killed; cursors.exe is marked
       critical and taskkill refuses it, because the arena is not local */
    killProcess:p=>{ killedProcs.add(p.pid); },
    shutdownBox:secs=>sysShutdown(secs),
    shutdownAbort:()=>sysShutdownAbort(),
    msgPopup:(from,to,text)=>showError("Messenger Service",
      "Message from "+from+" to "+to+" on "+new Date().toLocaleString()+String.fromCharCode(10,10)+text,true),
    toastsOn:()=>toastsOn,
    /* --- the arena, as data --- */
    arenaState:()=>({
      epoch:roundNo, phase:phase.toUpperCase(), uptime:fmtUp(upT), net:MP.on,
      commit:(commitHex||"").slice(0,32),
      corpses:diskPct().cap, deaths:diskPct().dead, diskPct:diskPct().pct,
      inPlay:fmtS(curs.reduce((a,c)=>a+c.bounty,0)),
      cursors:curs.map(c=>({ id:c.id||c.mpid||"-", owner:c.owner, mine:!!c.isMine,
        bounty:fmtS(c.bounty), mult:(c.bounty/ENTRY).toFixed(1), mode:c.mode })),
    }),
    deploy:()=>{ const n=myCurs().length; deploy(false); return myCurs().length>n||MP.on; },
    recall:()=>recallAll(),
    stance:st=>{ stance=st; mpSend({t:"stance",s:st}); updatePanel(); },
    recallOne:id=>{
      const c=curs.find(x=>x.id===id&&x.isMine);
      if(!c) return;
      if(MP.on){ c._bankReq=true; c._bankAt=Date.now(); mpSend({t:"recallOne",id:c.id}); }
      else if(c.mode==="roam"){ c.prevMode="recall"; c.mode="recall"; c.recallT=RECALL_SECS; }
      log(`recall order: cursor #${id}`);
    },
    /* --- shell --- */
    runCommand:t=>runNamed(t),
    confirm:(title,body,ok)=>showConfirm(title,body,ok),
    openClock:()=>openClockProps(),
    openVolume:()=>{ $("#sndico").click(); },
    openIE:()=>openWin("win-ie"),
    openNetwork:()=>{ if(ie&&ie.dial) ie.dial(); else openWin("win-ie"); },
    printers:()=>showError("Printers and Faxes","There are no printers installed on this computer."),
    userAccounts:()=>openWin("win-logoff"),
    accessibility:()=>access.openAccessOptions(),
    addRemove:()=>maint.openAddRemove(),
    fonts:()=>maint.openFonts(),
    clearType:()=>maint.openClearType(),
    folderOptions:()=>maint.openFolderOptions(),
    systemRestore:()=>maint.openRestore(),
    windowsUpdate:()=>windowsUpdate(),
    /* --- services and policies actually do things --- */
    serviceChanged:(ctl,on)=>applyService(ctl,on),
    policyChanged:(id,v)=>applyPolicy(id,v),
  },
});
sys.init();

/* A stopped service changes THIS computer and nothing else.
   The arena, the rakeback ledger and the fairness provider run on the game
   server, so they are not in here at all — Services refuses to touch them and
   tells you why. This is a live game played for money: a switch that appears
   to stop the ledger would be a lie even if it only lied to the person who
   flipped it, and a switch that actually stopped it would be an exploit. */
function applyService(ctl,on){
  if(ctl==="audio"){ muted=!on||$("#vf-mute").checked; volSync(); }
  if(ctl==="themes") document.body.classList.toggle("classic-theme",!on);
  if(ctl==="toasts"){ toastsOn=on; if(!on) $("#balloon").style.display="none"; }
  if(ctl==="clock"){ clockOn=on; $("#clock").textContent=on?$("#clock").textContent:"--:--"; }
}

/* a Group Policy setting really applies */
function applyPolicy(id,v){
  const on=v==="Enabled";
  if(id==="nocrt"){ if(on) $("#crt-chk").checked=false; applyCrt(); }
  if(id==="nosound"){ muted=on; volSync(); }
  if(id==="nodesktop") $("#icons").style.display=on?"none":"";
  if(id==="nobin") renderIcons();
  if(id==="norun") $$("#startmenu [data-act=run]").forEach(e=>e.style.display=on?"none":"");
  if(id==="noclock") $("#clock").style.display=on?"none":"";
  if(id==="nobal") if(on) $("#balloon").style.display="none";
  if(id==="noauto"){ if(on&&auto.on){ setAuto(false); updatePanel(); } $(".aprow").parentElement&&$$("#cx-play .aprow").forEach(e=>e.style.display=on?"none":""); }
  if(id==="showodds") document.body.classList.toggle("showodds",on);
  if(id==="nocmd"&&on) closeWin("win-cmd");
  if(id==="verbose") document.body.classList.toggle("verbose-boot",on);
}
function policyOn(id){ return sys.policyOn(id); }

/* ================= Winamp — the real thing (Webamp, MIT, (c) Jordan Eldredge) ================= */
const winampApp=(()=>{

/* fetch shim: decode data: URIs locally so the bundled classic skin loads under any CSP */
if(window.fetch){
  const of=window.fetch.bind(window);
  window.fetch=function(u,o){
    const url=(typeof u==="string")?u:(u&&u.url);
    if(url&&url.slice(0,5)==="data:"){
      try{
        const ci=url.indexOf(","), meta=url.slice(5,ci), body=url.slice(ci+1);
        const mime=meta.split(";")[0]||"application/octet-stream";
        let bytes;
        if(meta.indexOf("base64")>=0){
          const bin=atob(body); bytes=new Uint8Array(bin.length);
          for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
        }else bytes=new TextEncoder().encode(decodeURIComponent(body));
        return Promise.resolve(new Response(new Blob([bytes],{type:mime}),{status:200}));
      }catch(e){}
    }
    return of(u,o);
  };
}

/* -- the house playlist: real era MP3s, freely licensed --
   Kevin MacLeod (incompetech.com), CC BY — attribution lives in README.txt. */
const initialAmpTracks=()=>TRACKS.map(t=>({url:t.url,metaData:{artist:t.artist,title:t.title}}));

/* -- lifecycle: Webamp is a normal process-table entry (kind:"webamp").
   #webamp-wrap is OURS (webamp replaces the inner slot only), so hide/show
   never depends on webamp's internal DOM, and the taskbar tab is just a
   render of openApps like every other window. */
function wampEntry(){
  return {el:null,min:false,kind:"webamp",notab:false,title:"Winamp",icon:`<img src="${IMG.amp16}" alt="">`};
}
function openWinamp(){
  const ex=openApps.get("win-amp");
  if(ex){
    ex.min=false; focusedId="win-amp";
    showWamp();
    try{ webamp.reopen(); }catch(e){ console.error("[winamp] reopen failed:",e); }
    renderTaskbar(); return;
  }
  if(!webamp){
    try{
      webamp=new Webamp({
        initialTracks:initialAmpTracks(),
        zIndex:4800,
        enableHotkeys:true /* the real Winamp hotkeys, incl. Ctrl+D double-size */
      });
    }catch(e){
      console.error("[winamp] boot failed:",e); webamp=null;
      showError("winamp.exe","WINAMP caused a General Protection Fault in module LOADER.DLL. Reboot (F5) and try again.");
      return;
    }
    /* the tray master and the mixer's Wave fader really move Winamp: its own
       slider stays where the user left it and we scale the output gain under
       it, re-applied after every store change because webamp resets that gain
       from its own state on a track change and on a seek */
    try{ webamp.store.subscribe(()=>wampApplyVol()); }catch(e){}
    wampApplyVol();
    webamp.onClose(()=>closeWinamp());
    webamp.onMinimize(()=>{
      const a=openApps.get("win-amp");
      if(a){ a.min=true; if(focusedId==="win-amp") focusedId=null; }
      hideWamp(); sMini(); renderTaskbar();
    });
    showWamp(); /* wrapper must be visible BEFORE render: webamp centers its stack on the slot's rect */
    webamp.renderWhenReady(document.getElementById("webamp-slot")).then(()=>{ showWamp(); setTimeout(wampFit,120); });
  }else{
    showWamp();
    try{ webamp.reopen(); }catch(e){}
  }
  openApps.set("win-amp",wampEntry());
  focusedId="win-amp";
  renderTaskbar();
}
/* volume = Winamp's own slider x the Wave fader x the master; muted is silent */
function wampApplyVol(bus){
  if(!webamp||!webamp.media||!webamp.media.setVolume) return;
  let own=100;
  try{ own=webamp.store.getState().media.volume; }catch(e){}
  const wave=bus!=null?bus:(snd&&snd.ampBus?snd.ampBus():1);
  const eff=muted?0:Math.max(0,Math.min(100,own*masterVol*wave));
  try{ webamp.media.setVolume(eff); }catch(e){}
}
function closeWinamp(){
  hideWamp();
  if(openApps.delete("win-amp")){
    if(focusedId==="win-amp") focusedId=null;
    renderTaskbar();
  }
}
/* dev only, behind the same #desktop hash the other probes use: the gain node
   is buried inside webamp, and a screenshot cannot show you a volume */
if(location.hash.indexOf("#desktop")===0)
  window.__amp={gain:()=>{ try{ return webamp.media._gainNode.gain.value; }catch(e){ return null; } },
    own:()=>{ try{ return webamp.store.getState().media.volume; }catch(e){ return null; } }};
return {open:openWinamp,close:closeWinamp,applyVol:wampApplyVol};
})();

/* ================= Internet Explorer ================= */
/* the chrome is in index.html, the web it browses is in ie.js. the hall of
   fame page reads live game state, so the handmade web is not a diorama. */
function ieHall(){
  const alive=curs.map(c=>({
    name:c.owner,mine:c.isMine,mult:(c.peak||c.bounty)/ENTRY,
    note:c.mode==="recall"?"banking out now":"still alive, carrying "+fmtS(c.bounty),
  }));
  const dead=binDead.map(d=>({
    name:d.name,mine:d.mine,mult:d.mult,
    note:"killed by "+d.killer+" — it was "+d.odds+"% to win that one",
  }));
  return {
    top:alive.concat(dead).sort((a,b)=>b.mult-a.mult).slice(0,8),
    uptime:fmtUp(upT),alive:curs.length,dead:binDead.length,
    bigBank:stats.bigBank?fmtS(stats.bigBank)+" SOL":"nothing yet",
  };
}
ie=initIE({
  IMG,
  els:{
    back:$("#ie-back"), fwd:$("#ie-fwd"), stop:$("#ie-stop"), refresh:$("#ie-refresh"),
    home:$("#ie-home"), search:$("#ie-search"), favs:$("#ie-favs"), media:$("#ie-media"),
    hist:$("#ie-hist"), mail:$("#ie-mail"), print:$("#ie-print"),
    addr:$("#ie-addr"), go:$("#ie-go"), links:$("#ie-links"), page:$("#ie-page"),
    throb:$("#ie-throb"), prog:$("#ie-prog"), progbar:$("#ie-progbar"), st1:$("#ie-st1"),
    side:$("#ie-side"), sideBody:$("#ie-side-body"), sideTitle:$("#ie-side-title"), sideX:$("#ie-side-x"),
    afName:$("#af-name"), afUrl:$("#af-url"), afOk:$("#af-ok"), afCancel:$("#af-cancel"),
    ofList:$("#of-list"), ofInfo:$("#of-info"), ofRename:$("#of-rename"), ofDelete:$("#of-delete"),
    ofUp:$("#of-up"), ofDown:$("#of-down"), ofClose:$("#of-close"),
    ioHome:$("#io-home"), ioCache:$("#io-cache"), ioAdv:$("#io-adv"), ioOk:$("#io-ok"), ioCancel:$("#io-cancel"),
    ioUseCur:$("#io-usecur"), ioUseDef:$("#io-usedef"), ioUseBlank:$("#io-useblank"),
    ioDelCookies:$("#io-delcookies"), ioDelFiles:$("#io-delfiles"), ioClearHist:$("#io-clearhist"),
    ioCerts:$("#io-certs"), ioDialSet:$("#io-dialset"),
    dlUser:$("#dl-user"), dlConnect:$("#dl-connect"), dlOffline:$("#dl-offline"),
    dlSettings:$("#dl-settings"),
    dgText:$("#dg-text"), dgBar:$("#dg-bar"), dgCancel:$("#dg-cancel"),
  },
  store, sysSnd, showMenu, showError,
  snd:{tone,noise:noiseBurst},
  setTitle:t=>{ $("#win-ie .title-bar-text").textContent=t; renderTaskbar(); },
  hooks:{
    openWin, closeWin, wireWindow, desk:desktop,
    close:()=>closeWin("win-ie"),
    isOpen:()=>openApps.has("win-ie"),
    playerName:()=>playerName(),
    deploy:()=>deploy(false),
    openLobby:()=>msn.openConv("lobby"),
    hallOfPain:()=>hallOfPain(),
    openText:openTextWindow,
    balloon:(h,t)=>showBalloon(h,t),
    setNet:on=>{ netUp=on; $("#netico").style.display=on?"":"none"; },
    hall:ieHall,
    mpOn:()=>MP.on,
    netGuests:()=>mpGuestData(),
    postGuest:(who,txt)=>mpGuestPost(who,txt),
    netGallery:()=>mpGalleryData(),
    tvMounted:p=>mpTvMounted(p),
    tvFit:()=>tvFit(),
    windowsUpdate:()=>windowsUpdate(),
    galleryMounted:()=>mpGalleryOpen(),
    setWallpaperFrom:(u,mode)=>setWallpaperFrom(u,mode),
  },
});
/* the toolbar is the real IE6 button set, same archive as Explorer's */
$("#ie-backi").src=IMG.navBack;   $("#ie-fwdi").src=IMG.navFwd;
$("#ie-stopi").src=IMG.navStop;   $("#ie-refreshi").src=IMG.navRefresh;
$("#ie-homei").src=IMG.navHome;   $("#ie-searchi").src=IMG.navSearch;
$("#ie-favsi").src=IMG.navFav;    $("#ie-mediai").src=IMG.navMedia;
$("#ie-histi").src=IMG.navHistory;$("#ie-maili").src=IMG.navMail;
$("#ie-printi").src=IMG.printer32;$("#ie-linksi").src=IMG.navLinks;
$("#ie-throbi").src=IMG.ie32;     $("#ie-addrico").src=IMG.ie16;
$("#ie-zonei").src=IMG.earth16;
$("#hlp-backi").src=IMG.navBack; $("#hlp-homei").src=IMG.navHome; $("#hlp-searchi").src=IMG.navSearch;
/* shutting the dial-up box with the X means the same thing as Work Offline */
$('#win-dialup .title-bar-controls button[aria-label="Close"]').addEventListener("click",()=>$("#dl-offline").click());
$('#win-dialing .title-bar-controls button[aria-label="Close"]').addEventListener("click",()=>$("#dg-cancel").click());

/* ================= game state ================= */
const BOTS=["mumu","bobo","clippy","bonk","solja","xp_chad","deg404"].map(n=>({name:n}));
let wallet=5000, walletShown=5000;
let stats={kills:0,deaths:0,best:0,deploys:0,banks:0,bigBank:0,tIn:0,tOut:0};
let curs=[], binDead=[];
let myTickets=0, globalTickets=1437200, rakeAccrued=0;
let stance="attack";
const auto={on:false,count:3,bankAt:2};

/* The arena is a FIXED logical playfield (not "however big your window is"),
   scaled to fit the screen. Two reasons, one of them load-bearing for real
   money: every player must fight on an identical battlefield, and on a phone
   you then see the whole fight instead of a corner of it. */
const AW=1280, AH=800;
let arena={x0:0,y0:0,x1:AW,y1:AH};
let AS=1, CMAG=1, AROT=false;
function syncArena(){
  arena={x0:0,y0:0,x1:AW,y1:AH};
  const el=$("#arena"); if(!el) return;
  /* Portrait phones ROTATE THE VIEW 90° instead of letterboxing. The sim is
     untouched — same fixed field, same positions, same fairness — but shown
     sideways the field fills the screen (~0.49 scale instead of ~0.30) and
     cursors spread everywhere instead of hiding in a strip behind the icons.
     Text elements counter-rotate so they stay readable. */
  AROT=MOBILE&&H>W;
  if(AROT){
    AS=Math.min(W/AH,H/AW);
    const ox=Math.round((W-AH*AS)/2), oy=Math.round((H-AW*AS)/2);
    /* origin 0,0: point (x,y) → scale → rotate90 (x,y)→(-y,x) → translate */
    el.style.transform=`translate(${ox+AH*AS}px,${oy}px) rotate(90deg) scale(${AS})`;
  }else{
    AS=Math.min(W/AW,H/AH);
    const ox=Math.round((W-AW*AS)/2), oy=Math.round((H-AH*AS)/2);
    el.style.transform=`translate(${ox}px,${oy}px) scale(${AS})`;
  }
  el.classList.toggle("rot",AROT);
  /* counter-magnify the sprites so cursors stay legible on a scaled-down arena */
  /* the arena is drawn small so the whole field fits, then the sprites are
     magnified back up. A phone needs a much higher floor: at .52 an arrow came
     out nine pixels wide on a screen held at arm's length. */
  CMAG=Math.max(1,(MOBILE?.95:.52)/AS);
  el.style.setProperty("--cmag",CMAG);
  for(const c of curs) updateTag(c);
}

let phase="boot", phaseT=0, roundNo=0, roundId=0;
/* the offline sandbox ends its rounds the same way the server does — when the
   disk fills — so a disconnected player is not playing a different game */
const LOCAL_CORPSES=900;
let localDeaths=0;
let epochLen=150, upT=0, epochStart=0;   /* uptime never resets: the desktop stays up, only CURSORS.EXE crashes */
let R=null, epochHist=[];
function newRoundRecord(){ return {pot:0,deploys:0,myIn:0,myOut:0,myKills:0,bigBank:null,deaths:0}; }

let localCurId=0;   /* the offline sandbox numbers its cursors too — Device Manager lists them by id */
const CURSVG=`<svg viewBox="0 0 14 22"><use href="#ic-cursor"/></svg>`;
/* the arena wears your scheme: if the owner picked one, their cursor IS that
   arrow, for everyone. offline the bots have taste too. */
const BOTSKINS={mumu:"bronze",deg404:"inv",xp_chad:"black",clippy:"std-l",bonk:"variations"};
function skinCurEl(el,skin){
  if(!skin||!mouse) return;
  mouse.arenaArrow(skin,u=>{
    if(!u) return;
    const svg=el.querySelector("svg"); if(!svg) return;
    const img=document.createElement("img");
    img.className="curskin"; img.src=u; img.draggable=false;
    if(svg.style.width) img.style.width=svg.style.width;     /* keep the bounty/cmag size */
    if(svg.style.height) img.style.height=svg.style.height;
    svg.replaceWith(img);
  });
}
function makeCur(owner,isMine){
  const el=document.createElement("div");
  el.className="cur grace"+(isMine?" me":"");
  el.innerHTML=CURSVG+`<div class="tag"><span class="nm">${owner}</span><span class="bt"></span><span class="mx"></span></div>`;
  skinCurEl(el,isMine?(store.data.curScheme||""):BOTSKINS[owner]||"");
  curlayer.appendChild(el);
  /* pick the emptiest of eight candidate landing spots — deploying into an
     existing scrum is the arena choosing your fight for you (see server sim) */
  let x,y,ax,ay;
  { let bd=-1;
    for(let i=0;i<8;i++){
      let cx,cy;
      if(isMine){ cx=rand(arena.x0+70,arena.x1-70); cy=arena.y1-22; }
      else{
        const side=Math.floor(rand(0,4));
        cx=side===0?arena.x0+22:side===1?arena.x1-22:rand(arena.x0+50,arena.x1-50);
        cy=side===2?arena.y0+22:side===3?arena.y1-22:rand(arena.y0+50,arena.y1-50);
      }
      let d=1e9;
      for(const o of curs){ const q=(o.x-cx)**2+(o.y-cy)**2; if(q<d) d=q; }
      if(d>bd){ bd=d; x=cx; y=cy; }
      if(d>200*200) break;
    }
    if(isMine){ ax=x; ay=arena.y1-80; }
    else{ ax=clamp(x+rand(-40,40),arena.x0+50,arena.x1-50); ay=clamp(y+rand(-40,40),arena.y0+50,arena.y1-50); }
  }
  const c={id:++localCurId,owner,isMine,el,x,y,ax,ay,bounty:ENTRY,
    h:rand(0,Math.PI*2),spd:rand(78,124),mode:"hold",prevMode:"roam",recallT:0,
    grace:1.4,riskAt:1.5+Math.random()*5,dead:false,s:1,r:10,
    /* the death certificate is written from these — a cursor carries its own obituary */
    kills:0,peak:ENTRY,born:performance.now(),round:roundNo};
  updateTag(c);
  return c;
}
function updateTag(c){
  const m=c.bounty/ENTRY;
  if(c.bounty>(c.peak||0)) c.peak=c.bounty;
  c.el.querySelector(".bt").textContent=fmtS(c.bounty);
  c.el.querySelector(".mx").textContent=m>=1.05?"×"+(m>=10?m.toFixed(0):m.toFixed(1)):"";
  c.s=Math.min(2.6,1+.35*Math.log2(Math.max(1,m)));
  c.r=10*c.s;                       /* collision radius stays in logical units */
  const v=c.s*CMAG;                 /* magnification is purely visual */
  /* the sprite is an <svg> until the owner picks a pointer scheme, at which
     point skinCurEl swaps it for an <img class="curskin"> of the real .cur
     file. Asking for "svg" alone returned null for every skinned cursor and
     threw right here — on makeCur's last line, after the element was already
     in the layer but before the caller could take ownership of it. The result
     was an untracked arrow parked at the layer origin forever. */
  const sv=c.el.querySelector("svg,.curskin");
  if(sv){ sv.style.width=(17*v)+"px"; sv.style.height=(26*v)+"px"; }
  const tag=c.el.querySelector(".tag");
  /* rotated view: the tag's anchor maps (screenX,screenY)=(−top,+left), so
     these offsets land it just under the counter-rotated sprite */
  if(AROT){ tag.style.left=(18*v)+"px"; tag.style.top=(25*v)+"px"; }
  else{ tag.style.left=(13*v)+"px"; tag.style.top=(25*v)+"px"; }
}
function removeCur(c){
  c.dead=true; c.el.remove();
  curs=curs.filter(x=>x!==c);
  updatePanel();
}
const myCurs=()=>curs.filter(c=>c.isMine&&!c.dead);

/* ================= phases ================= */
function setPhase(p,t){ phase=p; phaseT=t; renderPhase(); }
function startEpoch(){
  roundNo++; roundId++;
  R=newRoundRecord();
  /* no clock: the disk decides. phaseT only becomes meaningful once the
     shutdown rush starts and caps it at T_SHUT seconds. */
  epochLen=1e9;
  localDeaths=0;
  epochStart=upT;
  shutFired=false;
  commitSeed();
  setPhase("battle",epochLen);
  if(roundNo===1){ log("system online — deploys are open"); }
  else{ log(`CURSORS.EXE restarted (epoch ${roundNo}) — deploys are open`); botChat("join"); }
  /* the bots pile back in over the first ten seconds, like nothing happened */
  const rid=roundId;
  for(const b of BOTS){
    const n=pick([1,1,2,2,3]);
    for(let i=0;i<n;i++) setTimeout(()=>{ if(roundId===rid&&phase==="battle"&&!shutFired) botDeploy(b.name); },rand(600,9500));
  }
  updatePanel();
}
let shutFired=false;
function startShutdownRush(){
  shutFired=true;
  phaseT=Math.min(phaseT,T_SHUT);
  openWin("win-shutdown",{silent:true});
  sShut();
  chatSys("CURSORS.EXE is not responding — all cursors recalling");
  botChat("shutdown");
  for(const c of curs) if(!c.dead&&c.mode!=="duel") forceRecall(c);
  updatePanel();
}
function forceRecall(c){
  if(c.mode!=="recall"){ c.mode="recall"; c.prevMode="recall"; c.recallT=RECALL_SECS; }
}
/* the epoch boundary, dressed as what it is: a crash that banks everyone */
function crashSystem(){
  if(phase!=="battle") return;   /* two timers in one batch = one crash */
  pushEv(sysEvents,"error","Save Dump",1001,
    "The computer has rebooted from a bugcheck. The bugcheck was: 0x0000007b. The disk filled with dead cursors. All live cursors were banked in full.");
  for(const c of [...curs]) if(!c.dead) bank(c,true);
  closeWin("win-shutdown",{silent:true});
  const share=myTickets>0?myTickets/(globalTickets+myTickets):0;
  rakeAccrued+=share*R.deploys*FEE_RAKE;
  /* the epoch goes into the History pane before R is reset */
  epochHist.unshift({no:roundNo,up:fmtUp(upT-epochStart),pot:R.pot,deploys:R.deploys,
    deaths:R.deaths,top:R.bigBank,net:R.myOut-R.myIn,myIn:R.myIn});
  epochHist=epochHist.slice(0,30);
  revealSeed();
  bsodShow(crashBsodText());
  sError();
  setPhase("crash",T_CRASH);
  log(`CURSORS.EXE crashed. epoch ${roundNo}: pot ${fmtS(R.pot)}, ${R.deaths} dead.`);
  chatSys("it crashed again. everyone got banked. we go again");
  updatePanel();
}
function phaseTick(dt){
  if(phase==="boot") return;
  upT+=dt; phaseT-=dt;
  if(phase==="battle"){
    if(!shutFired&&phaseT<=T_SHUT) startShutdownRush();
    if(shutFired) $("#shuttimer").textContent="0:"+String(Math.max(0,Math.ceil(phaseT))).padStart(2,"0");
    if(phaseT<=0) crashSystem();
  }
  else if(phase==="crash"&&phaseT<=0){
    bsodEl.style.display="none";
    errorReport();
    /* the playfield hiccups back to life; nothing about the money does */
    feedClear();
    $("#arena").classList.add("crashed");
    setTimeout(()=>$("#arena").classList.remove("crashed"),900);
    degauss();   /* the tube collects itself after a stop error */
    startEpoch();
  }
  renderPhase();
}
function fmtUp(s){
  const t=Math.max(0,Math.floor(s)), h=Math.floor(t/3600), m=Math.floor(t/60)%60;
  /* past an hour "860:23" reads as minutes and confuses everyone; roll it up */
  return h?`${h}:${String(m).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`
          :`${m}:${String(t%60).padStart(2,"0")}`;
}
/* The disk is the round clock now, so it gets a real gauge instead of a
   percentage buried in a status line. Offline there is no epoch budget, so the
   sandbox counts its own dead against the same nominal 64. */
let lastDisk=-1;
function diskPct(){
  const cap=MP.on?(MP.corpses||900):LOCAL_CORPSES;
  const f=MP.on?MP.fill:Math.min(1,localDeaths/cap);
  const total=MP.on&&MP.disk?MP.disk.total:20*1024*1024*1024;
  const cB=MP.on&&MP.disk?MP.disk.corpse:12*1024*1024;
  const base=total-cap*cB;
  return {f,cap,dead:Math.round(f*cap),cB,total,
    pct:Math.min(100,Math.round(100*(base+Math.round(f*cap)*cB)/total))};
}
function renderDisk(){
  /* fill = how far through the epoch's corpse budget we are (0..1); the number
     on the bar is the drive's real occupancy, which starts wherever Windows
     left it and hits 100% exactly when the round ends. Explorer's pie chart
     reads from the same arithmetic, so the two can never disagree. */
  const {f,cap,dead,cB,pct}=diskPct();
  const key=pct*10000+dead;
  if(key===lastDisk) return;
  lastDisk=key;
  syncBinIcon(f);
  const bar=$("#diskbar"), mbar=$("#mh-disk");
  $("#diskfill").style.width=pct+"%";
  $("#mh-diskfill").style.width=pct+"%";
  for(const b of [bar,mbar]){
    b.classList.toggle("warn",f>=.7&&f<.92);
    b.classList.toggle("crit",f>=.92);
  }
  const freeGB=(cap-dead)*cB/1073741824;
  $("#disktext").textContent=f>=.92
    ? `C: ${pct}% FULL — ${cap-dead} cursor${cap-dead===1?"":"s"} from a crash`
    : `C: ${pct}% full · ${dead}/${cap} dead cursors · ${freeGB.toFixed(2)} GB free`;
}
let lastPhaseText="";
function renderPhase(){
  const mm="0:"+String(Math.max(0,Math.ceil(phaseT))).padStart(2,"0");
  const live=curs.reduce((s,c)=>s+c.bounty,0);
  const txt=phase==="battle"
    ?(shutFired?`⚠ SHUTDOWN ${mm} — BANKING ALL`:`EPOCH ${roundNo} · UP ${fmtUp(upT-epochStart)} · ${fmtS(live)} LIVE`)
    :phase==="crash"?"☠ CRASHED · RESTARTING…":"BOOT";
  if(txt===lastPhaseText) return;
  lastPhaseText=txt;
  const urgent=shutFired||phase==="crash";
  const pl=$("#phaseline");
  pl.textContent=txt;
  pl.title=`Epoch ${roundNo} · full disk = crash · banked SOL carries over`;
  pl.classList.toggle("battle",urgent);
  const chip=phase==="crash"?`EPOCH ${roundNo} · CRASHED`:shutFired?`EPOCH ${roundNo} · SHUTDOWN ${mm}`
    :`EPOCH ${roundNo} · C: ${diskPct().pct}%`;
  $("#phasechip").textContent=chip;
  const mp=$("#mh-phase");
  mp.textContent=chip;
  mp.classList.toggle("battle",urgent);
  renderDisk();
}

/* ================= deploy / recall / bank ================= */
function canDeploy(){ return phase==="battle"&&!shutFired; }
function deploy(silent){
  if(!canDeploy()||myCurs().length>=MAXCUR) return;
  if(MP.on){
    if(!net||!net.up()){ log("reconnecting — deploy not sent"); return; }
    mpSend({t:"deploy"}); if(!silent) sysSnd("hwin",.5); return;
  }
  if(wallet<STAKE) return;
  wallet-=STAKE;
  myTickets+=200;
  R.myIn+=STAKE; stats.deploys++; stats.tIn+=STAKE;
  R.pot+=ENTRY; R.deploys++;
  const c=makeCur(playerName(),true);
  c.mode="roam"; c.prevMode="roam";
  curs.push(c);
  if(!silent) sysSnd("hwin",.5);   /* new hardware detected: 1 cursor */
  log(`you deployed 0.100 (${myCurs().length}/${MAXCUR})`);
  updatePanel();
}
function botDeploy(name){
  if(MP.on) return;   /* the server owns the population; a local bot here would never be drawn */
  if(!canDeploy()) return;
  if(curs.filter(c=>c.owner===name).length>=3) return;
  const c=makeCur(name,false);
  c.mode="roam"; c.prevMode="roam";
  curs.push(c);
  R.pot+=ENTRY; R.deploys++;
  globalTickets+=200;
  updatePanel();
}
function recallAll(){
  if(MP.on){
    const rc=[...mpCurs.values()].some(c=>c.isMine&&c.mode==="recall");
    mpSend({t:rc?"recallCancel":"recall"}); sClick(); return;
  }
  /* tapping again inside the 3s glide = changed your mind */
  if(phase==="battle"&&!shutFired){
    const rc=[...myCurs()].filter(c=>c.mode==="recall");
    if(rc.length&&![...myCurs()].some(c=>c.grace>0)){
      for(const c of rc){ c.mode="roam"; c.prevMode="roam"; c.recallT=0; }
      log("recall cancelled"); sClick(); updatePanel(); return;
    }
  }
  let refunded=0, recalled=0;
  for(const c of [...myCurs()]){
    if(c.grace>0){
      /* the misclick window: spawn protection means it cannot have fought yet,
         so undeploying inside it refunds in full with nothing to game */
      wallet+=STAKE; myTickets-=200; R.myIn-=STAKE; R.pot-=ENTRY; R.deploys--;
      removeCur(c); refunded++;
    }else if(c.mode==="roam"){ forceRecall(c); recalled++; }
  }
  if(refunded) log(`undeployed ${refunded} in grace — refunded in full`);
  if(recalled) log(`recalling ${recalled} cursor${recalled>1?"s":""} — banking in ${RECALL_SECS}s`);
  if(refunded||recalled) sClick();
  updatePanel();
}
$("#btn-deploy").addEventListener("click",()=>deploy(false));
$("#btn-recall").addEventListener("click",recallAll);
$("#st-attack").addEventListener("click",()=>{ stance="attack"; sClick(); mpSend({t:"stance",s:"attack"}); updatePanel(); });
$("#st-defend").addEventListener("click",()=>{ stance="defend"; sClick(); mpSend({t:"stance",s:"defend"}); updatePanel(); });
/* the mobile thumb bar mirrors the dashboard verbs; the info row opens the full app */
$("#mh-deploy").addEventListener("click",()=>deploy(false));
$("#mh-recall").addEventListener("click",recallAll);
$("#mh-attack").addEventListener("click",()=>{ stance="attack"; sClick(); mpSend({t:"stance",s:"attack"}); updatePanel(); });
$("#mh-defend").addEventListener("click",()=>{ stance="defend"; sClick(); mpSend({t:"stance",s:"defend"}); updatePanel(); });
$("#mh-info").addEventListener("click",()=>openWin("win-cursors"));
function bank(c,atShutdown){
  const m=(c.bounty/ENTRY).toFixed(1);
  if(!R.bigBank||c.bounty>R.bigBank.amt) R.bigBank={owner:c.owner,amt:c.bounty};
  if(c.isMine){
    wallet+=c.bounty; R.myOut+=c.bounty;
    stats.best=Math.max(stats.best,c.bounty/ENTRY);
    stats.banks++; stats.tOut+=c.bounty; stats.bigBank=Math.max(stats.bigBank,c.bounty);
    if(c.bounty>=ENTRY*10){
      /* the ×10: 1-in-10 exactly, and it should feel like it */
      sysSnd("tada",.6);
      for(let i=0;i<3;i++) setTimeout(()=>goldBurst(c.x+rand(-44,44),c.y+rand(-30,30)),i*170);
      jackpot(c.bounty);
    }else sBank();
    float(fmtSign(c.bounty)+" ×"+m,c.x,c.y,false);
    goldBurst(c.x,c.y);
    log(`you banked ${fmtS(c.bounty)} (×${m})${atShutdown?" at shutdown":""}`);
  }else{
    if(c.bounty>=ENTRY*2){ log(`${c.owner} banked ${fmtS(c.bounty)} (×${m})`); botChat("bank",{n:c.owner}); }
  }
  removeCur(c);
}

/* ================= CURSORS.EXE panes ================= */
function cxShow(id){
  $$("#win-cursors .cx-tab").forEach(t=>t.classList.toggle("on",t.dataset.cx===id));
  $$("#win-cursors .cx-pane").forEach(p=>p.classList.toggle("on",p.id===id));
  renderCx();
}
$$("#win-cursors .cx-tab").forEach(t=>t.addEventListener("click",()=>{ sClick(); cxShow(t.dataset.cx); }));
function renderCx(){
  if($("#cx-stats").classList.contains("on")) renderCxStats();
  else if($("#cx-rake").classList.contains("on")) renderCxRake();
  else if($("#cx-hist").classList.contains("on")) renderCxHist();
  else if($("#cx-verify").classList.contains("on")) renderCxVerify();
}
const cxKV=(k,v,cls)=>`<div class="cx-kv${cls?" "+cls:""}"><span>${k}</span><b>${v}</b></div>`;
function renderCxStats(){
  const liveVal=myCurs().reduce((s,c)=>s+c.bounty,0);
  const pl=wallet+liveVal-5000;
  const dead=binDead.filter(d=>d.mine);
  const lostToDeaths=dead.reduce((s,d)=>s+d.lost,0);
  $("#cx-stats").innerHTML=
    cxKV("session P/L",fmtSign(pl)+" SOL",pl>=0?"pos":"neg")+
    cxKV("deploys",`${stats.deploys} · ${fmtS(stats.tIn)} SOL staked`)+
    cxKV("banks",`${stats.banks} · ${fmtS(stats.tOut)} SOL out`)+
    cxKV("kills / deaths",`${stats.kills} / ${stats.deaths}`)+
    cxKV("lost to deaths",fmtS(lostToDeaths)+" SOL",lostToDeaths?"neg":"")+
    cxKV("best multiplier","×"+stats.best.toFixed(1))+
    cxKV("biggest bank",stats.bigBank?fmtS(stats.bigBank)+" SOL":"—")+
    cxKV("live right now",`${myCurs().length} cursor${myCurs().length===1?"":"s"} · ${fmtS(liveVal)} SOL`)+
    `<div class="cx-note">expected P/L: −1% (the fee). the rest is variance.</div>`;
}
function renderCxRake(){
  const share=myTickets>0?100*myTickets/(globalTickets+myTickets):0;
  $("#cx-rake").innerHTML=
    cxKV("your tickets",myTickets.toLocaleString())+
    cxKV("global tickets",globalTickets.toLocaleString())+
    cxKV("your share",share.toFixed(4)+"%")+
    cxKV("accrued",(rakeAccrued/1000).toFixed(4)+" SOL",rakeAccrued>0?"pos":"")+
    `<button class="xbtn big" id="rk-claim" style="margin-top:6px"${rakeAccrued>0?"":" disabled"}>CLAIM ${(rakeAccrued/1000).toFixed(4)} SOL</button>`+
    `<div class="cx-note">every deploy pays 0.002 SOL to the pool + 200 tickets to its owner.
     your payout = your ticket share. tickets halve every 45 days.</div>`;
}
$("#cx-rake").addEventListener("click",e=>{
  if(e.target.id!=="rk-claim"||rakeAccrued<=0) return;
  if(MP.on){ mpSend({t:"rake"}); sysSnd("tada",.4); return; }
  wallet+=rakeAccrued;
  log(`rakeback claimed: ${(rakeAccrued/1000).toFixed(4)} SOL`);
  rakeAccrued=0;
  sysSnd("tada",.4);
  renderCxRake(); updatePanel();
});
function renderCxHist(){
  const rows=epochHist.map(h=>
    `<tr><td>${h.no}</td><td>${h.up}</td><td class="n">${fmtS(h.pot)}</td><td class="n">${h.deploys}</td><td class="n">${h.deaths}</td>`+
    `<td>${h.top?`${esc(h.top.owner)} ${fmtS(h.top.amt)}`:"—"}</td>`+
    `<td class="n ${h.myIn?(h.net>=0?"pos":"neg"):""}">${h.myIn?fmtSign(h.net):"—"}</td></tr>`).join("");
  $("#cx-hist").innerHTML=
    `<table class="cxh"><thead><tr><th>#</th><th>up</th><th class="n">pot</th><th class="n">curs</th>`+
    `<th class="n">dead</th><th>top bank</th><th class="n">you</th></tr></thead>`+
    `<tbody>${rows||`<tr><td colspan="7" class="dim">no epochs finished yet</td></tr>`}</tbody></table>`;
}
/* ---- the fairness ceremony: committed before the epoch, revealed at the crash ---- */
let seedHex=null, commitHex=null, prevSeed=null, prevCommit=null, prevSeedEpoch=0;
function randHex(n){
  try{ const a=crypto.getRandomValues(new Uint8Array(n)); return [...a].map(x=>x.toString(16).padStart(2,"0")).join(""); }
  catch(e){ let s=""; for(let i=0;i<n*2;i++) s+="0123456789abcdef"[Math.floor(Math.random()*16)]; return s; }
}
function commitSeed(){
  seedHex=randHex(16); commitHex=null;
  try{
    crypto.subtle.digest("SHA-256",new TextEncoder().encode(seedHex))
      .then(b=>{ commitHex=[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""); renderCx(); });
  }catch(e){ commitHex="(sha-256 unavailable in this browser)"; }
}
function revealSeed(){ prevSeed=seedHex; prevCommit=commitHex; prevSeedEpoch=roundNo; }
function renderCxVerify(){
  $("#cx-verify").innerHTML=
    cxKV("duel odds","P(A wins) = A / (A + B)")+
    cxKV("reach ×N","P = 1/N. exactly.")+
    cxKV("house edge","the 1% entry fee. nothing else.")+
    `<div class="hr"></div>`+
    cxKV(`epoch ${roundNo} commitment`,"published while play is live")+
    `<div class="cx-seed">sha256: ${commitHex||"computing…"}</div>`+
    cxKV("its seed","sealed until the crash")+
    (prevSeed
      ? `<div class="hr"></div>`+
        cxKV(`epoch ${prevSeedEpoch} — revealed`,"check it yourself")+
        `<div class="cx-seed">seed:   ${prevSeed}\nsha256: ${prevCommit||"…"}</div>`
      : "")+
    (MP.on
      ? `<div class="cx-note">seed committed before the epoch, revealed at the crash.
     hash it yourself — it must match. every duel draws from it.</div>`
      : `<div class="cx-note">offline sandbox = browser RNG. connect and every duel
     draws from a committed, revealed seed.</div>`);
}

/* ================= autoplay ================= */
function setAuto(on){
  auto.on=on;
  const b=$("#ap-toggle");
  b.textContent=on?"ON":"OFF";
  b.classList.toggle("on",on);
}
/* Autoplay exists precisely so you can be away from the keyboard, so gating it
   on mouse activity would defeat the whole point — a tab left farming in the
   background is a legitimate way to play. What ends it is the machine going
   AWAY: the lid closes, the tab is frozen, the network drops. Past
   AUTO_AWAY_MS of that the switch is off when you get back, so a session that
   survived the night can never deploy on the first frame after it wakes.

   Two independent detectors, because neither one catches both cases:

     frozen  - the deploy loop below is a 1.8s interval, so if the wall clock
               has moved far more than that since it last ran, this tab was
               suspended (slept laptop, frozen background tab). Wall clock, not
               performance.now(), which stops ticking through a suspend.
     offline - the socket has been down continuously. Covers losing the network
               while the machine itself stays awake.

   A throttled background tab still fires its interval about once a minute, so
   merely being hidden never trips either one. Closing the page needs no
   detector at all: autoplay lives in this tab and dies with it. */
const AUTO_AWAY_MS=10*60*1000;
let lastTick=Date.now(), downSince=0;
function autoAwayCheck(){
  if(!auto.on) return;
  const t=Date.now();
  const gap=Math.max(t-lastTick, downSince?t-downSince:0);
  if(gap<=AUTO_AWAY_MS) return;
  setAuto(false);
  showBalloon("Autoplay is off",`Away ${Math.round(gap/60000)} min — deploys stopped.`);
}
$("#ap-toggle").addEventListener("click",()=>{
  setAuto(!auto.on); sClick();
});
$$(".apc").forEach(b=>b.addEventListener("click",()=>{ sClick(); auto.count=+b.dataset.c; $$(".apc").forEach(x=>x.classList.toggle("on",x===b)); }));
$$(".apb").forEach(b=>b.addEventListener("click",()=>{ sClick(); auto.bankAt=+b.dataset.b; $$(".apb").forEach(x=>x.classList.toggle("on",x===b)); }));
/* liquidity: the arena keeps a live bot population instead of coin-flipping.
   The target wobbles per epoch so the field breathes; play-money only — the
   real-money bot policy is a disclosed design still owed (see HANDOFF). */
setInterval(()=>{
  /* check against the previous stamps, then refresh: the run that discovers a
     two-hour gap must see it before it erases it */
  if(!MPURL||(net&&net.up())) downSince=0; else if(!downSince) downSince=Date.now();
  autoAwayCheck();
  lastTick=Date.now();
  /* bank-at must not depend on a painted frame: a hidden tab still banks.
     A recallOne that got lost in a blip re-arms after 6s. */
  if(MP.on&&auto.on&&auto.bankAt>0) for(const c of mpCurs.values()){
    if(!c.isMine||c.mode!=="roam") continue;
    if(c._bankReq&&c._bankAt&&Date.now()-c._bankAt>6000) c._bankReq=false;
    if(!c._bankReq&&c.bounty>=auto.bankAt*ENTRY){ c._bankReq=true; c._bankAt=Date.now(); mpSend({t:"recallOne",id:c.id}); }
  }
  if(!canDeploy()) return;
  if(auto.on&&myCurs().length<auto.count&&(MP.on||wallet>=STAKE)) deploy(true);
  if(MP.on) return;   /* the server runs the bots */
  const botCurs=curs.filter(c=>!c.isMine&&!c.dead).length;
  const target=7+(roundNo*3)%5;
  if(botCurs<target||Math.random()<.15) botDeploy(pick(BOTS).name);
},1800);

/* ================= movement / duels ================= */
function angDiff(a){ while(a>Math.PI)a-=2*Math.PI; while(a<-Math.PI)a+=2*Math.PI; return a; }
function centroid(owner,self){
  let x=0,y=0,n=0;
  for(const o of curs) if(o.owner===owner&&o!==self&&!o.dead){ x+=o.x; y+=o.y; n++; }
  return n?{x:x/n,y:y/n,n}:null;
}
function nearestEnemy(c){
  let best=null,bd=1e9;
  for(const o of curs){
    if(o===c||o.dead||o.owner===c.owner||o.grace>0||o.mode==="duel"||o.mode==="hold") continue;
    const d=(o.x-c.x)**2+(o.y-c.y)**2;
    if(d<bd){bd=d;best=o;}
  }
  return {best,bd};
}
function move(c,dt){
  if(c.grace>0){ c.grace-=dt; if(c.grace<=0) c.el.classList.remove("grace"); }
  let tx=null,ty=null,turn=2.4,sped=1;
  if(c.mode==="recall"){
    c.recallT-=dt;
    /* out through your own nearest edge point, not one shared corner */
    const dx=clamp(c.x,60,AW-60)-c.x, dy=(AH-18)-c.y, dist=Math.hypot(dx,dy);
    if(c.recallT<=0){ bank(c,false); return; }
    const sp=dist/Math.max(.2,c.recallT);
    c.x+=dx/Math.max(1,dist)*sp*dt; c.y+=dy/Math.max(1,dist)*sp*dt;
    c.el.style.transform=`translate(${c.x-8}px,${c.y-4}px)`;
    return;
  }
  if(c.mode==="hold"){ tx=c.ax; ty=c.ay; turn=2.0; }
  else{
    const st=c.isMine?stance:(c.bounty/ENTRY>=c.riskAt*.7?"defend":"attack");
    const {best,bd}=nearestEnemy(c);
    /* aggression ramps across the epoch: calm after a restart, frenzy before the crash */
    const aggr=phase==="battle"?(.7+1.5*clamp((epochLen-phaseT)/epochLen,0,1)):1;
    turn=2.6*aggr;
    if(best){
      if(bd<130*130) turn*=2.8;   /* close in: a 38px turn radius cannot reach a 20px contact */
      if(st==="attack"&&bd<520*520){ tx=best.x; ty=best.y; sped=1.12; }
      else if(st==="defend"&&bd<300*300){
        tx=c.x+(c.x-best.x); ty=c.y+(c.y-best.y); sped=.90;
      }
    }
    /* your own cursors regroup but never stack — they cannot fight each other,
       so a pile of them just looks broken (see the server sim for the whole note) */
    const SEP=34;
    let rx=0,ry=0;
    for(const o of curs){
      if(o===c||o.owner!==c.owner) continue;
      const dx=c.x-o.x, dy=c.y-o.y, d2=dx*dx+dy*dy;
      if(d2>SEP*SEP) continue;
      if(d2<1){ const a=(curs.indexOf(c)%8)/8*Math.PI*2; rx+=Math.cos(a)*SEP; ry+=Math.sin(a)*SEP; continue; }
      const d=Math.sqrt(d2);
      rx+=dx/d*(SEP-d); ry+=dy/d*(SEP-d);
    }
    if(rx||ry){ tx=c.x+rx*3; ty=c.y+ry*3; turn=Math.max(turn,5.5); }
    else{
      const cen=centroid(c.owner,c);
      if(cen&&((cen.x-c.x)**2+(cen.y-c.y)**2)>90*90){
        tx=tx===null?cen.x:(tx*.65+cen.x*.35);
        ty=ty===null?cen.y:(ty*.65+cen.y*.35);
      }
    }
  }
  if(tx!==null){
    const want=Math.atan2(ty-c.y,tx-c.x);
    c.h+=clamp(angDiff(want-c.h),-1,1)*turn*dt;
  }
  c.h+=(Math.random()-.5)*(c.mode==="hold"?2.2:3.0)*dt;
  /* one vector away from the near walls, not four axis pulls that cancel in a
     corner and weld a cursor to it (see the server sim for the whole note) */
  const M=64, WT=7;
  let wx=0,wy=0;
  if(c.x<arena.x0+M) wx+=(arena.x0+M-c.x)/M;
  if(c.x>arena.x1-M) wx-=(c.x-(arena.x1-M))/M;
  if(c.y<arena.y0+M) wy+=(arena.y0+M-c.y)/M;
  if(c.y>arena.y1-M) wy-=(c.y-(arena.y1-M))/M;
  if(wx||wy) c.h+=clamp(angDiff(Math.atan2(wy,wx)-c.h),-1,1)*WT*dt*Math.min(1,Math.hypot(wx,wy));
  const weight=1+.25*(c.s-1);
  /* attacking is 12% faster, defending 10% slower, so a hunt can actually end
     instead of the two of them orbiting forever. Duel odds never move. */
  const sp=c.spd*sped*(c.mode==="hold"?.5:1)/weight;
  const ux=c.x+Math.cos(c.h)*sp*dt, uy=c.y+Math.sin(c.h)*sp*dt;
  c.x=clamp(ux,arena.x0+24,arena.x1-24); c.y=clamp(uy,arena.y0+24,arena.y1-24);
  if(c.x!==ux) c.h=Math.PI-c.h;    /* the clamp bit: bounce, never weld */
  if(c.y!==uy) c.h=-c.h;
  c.el.style.transform=`translate(${c.x-8}px,${c.y-4}px)`;
}
function startDuel(a,b){
  duelPulse=Math.min(4,duelPulse+1);
  a.prevMode=a.mode; b.prevMode=b.mode;
  a.mode=b.mode="duel";
  a.el.classList.add("dueling"); b.el.classList.add("dueling");
  sDuel();
  const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
  const pA=Math.round(100*a.bounty/(a.bounty+b.bounty));
  const big=(a.bounty+b.bounty)>=ENTRY*5;
  const fx=document.createElement("div");
  fx.className="duelfx"+(big?" big":"");
  fx.innerHTML=`<span class="hg">⌛</span><br>${pA}:${100-pA}`;
  fx.style.left=(mx-28)+"px"; fx.style.top=(my-(big?58:46))+"px";
  fxlayer.appendChild(fx);
  setTimeout(()=>{ fx.remove(); resolveDuel(a,b); },DUEL_MS);
}
function resolveDuel(a,b){
  if(a.dead||b.dead) return;
  a.el.classList.remove("dueling"); b.el.classList.remove("dueling");
  if(phase!=="battle"){ a.mode=a.prevMode; b.mode=b.prevMode; return; }
  const pA=a.bounty/(a.bounty+b.bounty);
  const w=Math.random()<pA?a:b, l=w===a?b:a;
  const pot=l.bounty;
  w.bounty+=pot; w.kills++; w.mode=w.prevMode;
  if(w.mode==="recall"&&w.recallT<=0) w.recallT=.3;
  updateTag(w);
  explode(l);
  R.deaths++; localDeaths++;
  binDead.unshift(certify(l,w,w===a?1-pA:pA)); renderBin();
  if(!l.isMine) feedKill(binDead[0],false);
  removeCur(l);
  /* every corpse is 12 MB, and a full disk is a crash */
  if(localDeaths>=LOCAL_CORPSES){ setTimeout(crashSystem,0); }
  else if(!shutFired&&localDeaths>=LOCAL_CORPSES-6) startShutdownRush();
  renderDisk();
  log(`${w.owner} > ${l.owner}  +${fmtS(pot)}`);
  if(pot>=ENTRY*2) chatSys(`${w.owner} killed ${l.owner} for ${fmtS(pot)}`);
  if(l.isMine){
    stats.deaths++;
    /* your last cursor dying is not a system event — the system is fine, it
       has your money. You get the receipt in the feed, not a blue screen and
       not a window over the fight you are still watching. */
    if(myCurs().length===0){ sDie(); feedKill(binDead[0],!auto.on); }
    else { feedKill(binDead[0],false); float("cursor lost",l.x,l.y,true); }
  }else if(w.isMine){
    stats.kills++; R.myKills++;
    stats.best=Math.max(stats.best,w.bounty/ENTRY);
    sKill(); float(fmtSign(pot),w.x,w.y,false);
    if(R.myKills>=2) float(`${R.myKills} KILL STREAK`,w.x,w.y-24,false);
    botChat(w.bounty>=ENTRY*4?"bigkill":"kill",{w:playerName(),l:l.owner});
  }else{
    float(fmtSign(pot),w.x,w.y,true);
    botChat(w.bounty>=ENTRY*5?"bigkill":"kill",{w:w.owner,l:l.owner});
  }
  updatePanel();
}
function explode(c){
  /* a fat cursor dies bigger: more shards, further, and a wider ring */
  const n=Math.min(26,Math.round(10+8*c.s));
  for(let i=0;i<n;i++){
    const s=document.createElement("div");
    s.className="shard";
    s.style.left=c.x+"px"; s.style.top=c.y+"px";
    const ang=rand(0,Math.PI*2), d=rand(26,96)*c.s;
    s.style.setProperty("--dx",Math.cos(ang)*d+"px");
    s.style.setProperty("--dy",Math.sin(ang)*d+"px");
    s.style.setProperty("--rot",rand(-260,260)+"deg");
    fxlayer.appendChild(s); setTimeout(()=>s.remove(),750);
  }
  const p=document.createElement("div");
  const pw=Math.round(34*Math.min(2.2,.75+.45*c.s));
  p.className="pop";
  p.style.width=p.style.height=pw+"px";
  p.style.left=(c.x-pw/2)+"px"; p.style.top=(c.y-pw/2)+"px";
  fxlayer.appendChild(p); setTimeout(()=>p.remove(),500);
}
/* the ×10 moment: two seconds of VHS — scanlines, a tracking bar, chromatic
   aberration on the number, REC blinking in the corner, and gold raining
   through the arena. All CSS, no libraries, gone before it wears out. */
let jkT=null;
function jackpot(amt){
  const m=(amt/ENTRY).toFixed(1);
  const j=$("#jackpot");
  j.innerHTML=
    `<div class="jk-scan"></div><div class="jk-track"></div>`+
    `<div class="jk-rec"><i>●</i> REC</div><div class="jk-time">SP ${fmtUp(upT)}</div>`+
    `<div class="jk-mid"><div class="jk-x">×${m}</div>`+
    `<div class="jk-amt">+${fmtS(amt)} SOL BANKED</div>`+
    `<div class="jk-sub">P(reach ×10) = 1/10 · today you were the 1</div></div>`;
  j.style.display="block";
  clearTimeout(jkT);
  jkT=setTimeout(()=>{ j.style.display="none"; },2400);
  for(let i=0;i<26;i++) setTimeout(()=>{
    const s=document.createElement("div");
    s.className="shard gold";
    s.style.left=rand(arena.x0+30,arena.x1-30)+"px";
    s.style.top=(arena.y0+16)+"px";
    s.style.setProperty("--dx",rand(-36,36)+"px");
    s.style.setProperty("--dy",rand(340,720)+"px");
    s.style.setProperty("--rot",rand(-420,420)+"deg");
    s.style.animationDuration="1.15s";
    fxlayer.appendChild(s); setTimeout(()=>s.remove(),1200);
  },i*55);
}
function goldBurst(x,y){
  for(let i=0;i<9;i++){
    const s=document.createElement("div");
    s.className="shard gold";
    s.style.left=x+"px"; s.style.top=y+"px";
    const ang=rand(0,Math.PI*2), d=rand(30,90);
    s.style.setProperty("--dx",Math.cos(ang)*d+"px");
    s.style.setProperty("--dy",Math.sin(ang)*d+"px");
    s.style.setProperty("--rot",rand(-260,260)+"deg");
    fxlayer.appendChild(s); setTimeout(()=>s.remove(),750);
  }
}
function float(text,x,y,small){
  const f=document.createElement("div");
  f.className="float"+(small?" sm":"");
  f.textContent=text;
  f.style.left=clamp(x-20,4,AW-80)+"px"; f.style.top=clamp(y-30,4,AH-30)+"px";
  fxlayer.appendChild(f); setTimeout(()=>f.remove(),1250);
}

/* ================= the kill feed ================= */
/* Deaths used to arrive as a window. On a phone that window is the whole
   phone, and dying again while it was up put a second one on top of the first
   — people ended up stuck inside their own receipt. Same information, streamed
   instead of dealt: every death in the arena scrolls a fixed strip, your own
   sits longer in red, and the certificate is one tap away for whoever wants
   the numbers. Nothing here is modal and nothing here blocks the arena. */
const feedEl=$("#feed");
const FEEDGLYPH=`<svg viewBox="0 0 14 22"><use href="#ic-cursor"/></svg>`;
function feedDrop(el){
  if(!el||el.dataset.going) return;
  el.dataset.going="1";
  el.classList.add("out");
  setTimeout(()=>{ el.remove(); },520);
}
function feedPush(el,ms){
  feedEl.insertBefore(el,feedEl.firstChild);   /* newest first */
  /* the sticky red row is not pushed out by the traffic behind it */
  const plain=[...feedEl.children].filter(r=>!r.classList.contains("fd-mine")&&!r.dataset.going);
  while(plain.length>(MOBILE?3:5)) feedDrop(plain.pop());
  setTimeout(()=>feedDrop(el),ms);
  return el;
}
function feedClear(){ if(feedEl) feedEl.innerHTML=""; }
/* `mine` means this death emptied your side of the board: the moment the old
   certificate popup fired, and the only row that waits for you */
function feedKill(d,mine){
  if(!feedEl) return;
  const file=esc(d.name)+"_"+String(d.id).padStart(4,"0")+".cur";
  if(mine){
    const el=document.createElement("div");
    el.className="fd fd-mine";
    el.innerHTML=`<div class="fd-top">${FEEDGLYPH}<span class="fd-n">${file}</span></div>`+
      `<div class="fd-sub">${esc(d.killer)} took <b>${fmtS(d.lost)}</b> SOL`+
      ` · you were <span class="${d.odds>=50?"bad":""}">${d.odds}%</span></div>`+
      `<div class="fd-sub dim">tap for the certificate</div>`+
      `<span class="fd-x" role="button" aria-label="Dismiss">✕</span>`;
    el.addEventListener("click",e=>{
      feedDrop(el);
      if(!e.target.classList.contains("fd-x")) deathCert(d);
    });
    return feedPush(el,14000);
  }
  const el=document.createElement("div");
  el.className="fd"+(d.killerMine?" fd-kill":"")+(d.mine?" fd-lost":"");
  el.innerHTML=FEEDGLYPH+`<span class="fd-n">${file}</span>`+
    `<span class="fd-v">▸ ${esc(d.killer)}</span><b>${fmtS(d.lost)}</b>`;
  return feedPush(el,MOBILE?4400:5400);
}

/* ================= BSOD ================= */
/* The blue screen belongs to the BIG crash — the epoch boundary — not to a
   personal loss (your death gets a certificate; the system gets a funeral).
   The layout is the real NT stop screen: same paragraphs, same cadence, the
   receipt hiding in the Technical information block where the STOP code goes. */
const bsodEl=$("#bsod");
function bsodHide(){ bsodEl.style.display="none"; }
addEventListener("keydown",()=>{ if(bsodEl.style.display==="block") bsodHide(); });
bsodEl.addEventListener("click",bsodHide);
/* D: was empty forever. Now a disc goes in, and Windows asks the question it
   always asked. The disc is the music this machine already ships. */
let discIn=false;
function insertDisc(){
  discIn=true;
  try{ explorer.render&&explorer.render(); }catch(e){}
  sysSnd("hwin",.45);
  autoPlayPrompt();
}
function ejectDisc(){ discIn=false; try{ explorer.render&&explorer.render(); }catch(e){} }
function autoPlayPrompt(){
  const pref=store.data.apAlways;
  if(pref){ runAutoplay(pref); return; }
  openWin("win-autoplay");
}
const AP_ACTIONS=[
  {k:"amp",  ico:"amp16", label:"Play audio CD  using Winamp"},
  {k:"wmp",  ico:"wmp32", label:"Play audio CD  using Windows Media Player"},
  {k:"open", ico:"@ic-desk", label:"Open folder to view files  using Windows Explorer"},
  {k:"none", ico:"@ic-app", label:"Take no action"},
];
let apSel="amp";
function fillAutoplay(){
  const host=$("#ap-list"); host.innerHTML="";
  for(const a of AP_ACTIONS){
    const r=document.createElement("div");
    r.className="ap-row"+(a.k===apSel?" on":"");
    r.appendChild(icoNode(a.ico));
    const s=document.createElement("span"); s.textContent=a.label; r.appendChild(s);
    r.addEventListener("click",()=>{ apSel=a.k; fillAutoplay(); });
    r.addEventListener("dblclick",()=>{ apSel=a.k; $("#ap-ok").click(); });
    host.appendChild(r);
  }
}
function runAutoplay(k){
  if(k==="amp") openWin("win-amp");
  else if(k==="wmp") openWin("win-wmp");
  else if(k==="open"){ openWin("win-explorer"); explorer.go("My Computer"); }
}
$("#ap-ok").addEventListener("click",()=>{
  if($("#ap-always").checked){ store.data.apAlways=apSel; store.save(); }
  closeWin("win-autoplay"); runAutoplay(apSel);
});
$("#ap-cancel").addEventListener("click",()=>closeWin("win-autoplay"));
function fillWinver(){
  $("#wv-user").textContent=playerNameFull();
  $("#wv-mem").textContent=(500000+Math.round(Math.random()*40000)).toLocaleString("en-US");
  const f=document.querySelector("img.lg-flag")||document.querySelector(".lg-flag img")||document.querySelector("#boot img");
  if(f&&f.src) $("#wv-flag").src=f.src;
}
$("#wv-ok").addEventListener("click",()=>closeWin("win-winver"));
function fillUtilman(){
  const host=$("#um-list"); host.innerHTML="";
  const rows=[["Magnifier",()=>openWin("win-magnifier")],["Narrator",()=>openWin("win-narrator")],
    ["On-Screen Keyboard",()=>openWin("win-osk")]];
  for(const [name,go] of rows){
    const r=document.createElement("div"); r.className="um-row";
    const on=openApps.has(name==="Magnifier"?"win-magnifier":name==="Narrator"?"win-narrator":"win-osk");
    r.innerHTML=`<span>${name} <i>is ${on?"running":"not running"}</i></span>`;
    const b=document.createElement("button"); b.className="xbtn"; b.textContent="Start";
    b.addEventListener("click",()=>{ go(); fillUtilman(); });
    r.appendChild(b); host.appendChild(r);
  }
}
$("#um-ok").addEventListener("click",()=>closeWin("win-utilman"));
/* the recovered-from-a-serious-error box: fires once per crash, after reboot */
function errorReport(){
  if(!store.data.tourSeen) return;   /* not on top of a first-timer's card */
  openWin("win-errrep",{silent:true});
}
$("#er-send").addEventListener("click",()=>{ closeWin("win-errrep"); showBalloon("Error Reporting","The error report has been sent. Thank you."); });
$("#er-dont").addEventListener("click",()=>closeWin("win-errrep"));
/* shutdown.exe: the countdown box with no buttons. Only -a saves you. */
let ssT=null, ssLeft=0;
function sysShutdown(secs){
  ssLeft=Math.max(1,secs|0);
  $("#ss-who").textContent="CURSORLAND\\"+playerNameFull();
  openWin("win-sysshut",{silent:true}); sysSnd("balloon",.5);
  clearInterval(ssT);
  const tick=()=>{
    const h=String(Math.floor(ssLeft/3600)).padStart(2,"0"),
      mn=String(Math.floor(ssLeft/60)%60).padStart(2,"0"),
      sc=String(ssLeft%60).padStart(2,"0");
    $("#ss-timer").textContent=h+":"+mn+":"+sc;
    if(ssLeft--<=0){
      clearInterval(ssT); ssT=null; closeWin("win-sysshut");
      sysSnd("shutdown",.55); $("#shutdown").style.display="grid";
    }
  };
  tick(); ssT=setInterval(tick,1000);
}
function sysShutdownAbort(){
  if(!ssT) return false;
  clearInterval(ssT); ssT=null; closeWin("win-sysshut");
  return true;
}
/* CrashOnCtrlScroll, exactly as the registry documents it */
let cocsAt=0;
addEventListener("keydown",e=>{
  if(e.key==="ScrollLock"&&e.ctrlKey){
    const n=performance.now();
    if(n-cocsAt<3000){
      cocsAt=0;
      bsodShow("A problem has been detected and Windows has been shut down to prevent damage\nto your computer.\n\nMANUALLY_INITIATED_CRASH\n\nTechnical information:\n\n*** STOP: 0x000000E2 (0x00000000,0x00000000,0x00000000,0x00000000)\n\nThe end-user manually generated the crashdump.\n\nPress any key to continue");
    } else cocsAt=n;
  }
});
function bsodShow(text,ms){
  bsodEl.textContent=text;
  bsodEl.style.display="block";
  if(ms) setTimeout(bsodHide,ms);
}
function crashBsodText(){
  const net=R.myOut-R.myIn;
  const hex=n=>"0x"+Math.max(0,Math.round(n)).toString(16).toUpperCase().padStart(8,"0");
  return (
`A problem has been detected and CURSORS.EXE has been shut down to prevent
damage to your bankroll.

EPOCH_TERMINATED

All live cursors were banked at full value before termination. No SOL was
harmed. If this is the first time you've seen this Stop error screen,
deploy again. If this screen appears again, deploy again.

Check to make sure your cursors were properly banked. The pot below is
final. If you need someone to blame, press F8 to select Advanced Copium
Options, and then select luck.dll.

Technical information:

*** STOP: 0x0000000E (${hex(roundNo)},${hex(R.pot)},${hex(R.deploys)},${hex(R.deaths)})

***  arena.dll - epoch ${roundNo} · up ${fmtUp(upT-epochStart)} · pot ${fmtS(R.pot)} SOL · ${R.deploys} cursors · ${R.deaths} dead

***  ${R.bigBank?`top bank: ${R.bigBank.owner} ${fmtS(R.bigBank.amt)} (x${(R.bigBank.amt/ENTRY).toFixed(1)})`:"top bank: none. everyone died holding."}
***  you: in ${fmtS(R.myIn)} · out ${fmtS(R.myOut)} · net ${fmtSign(net)}

Beginning dump of dead cursors
Dead cursor dump complete.
Restarting automatically. Deploys reopen on restart.`);
}

/* ================= log / bin / panels ================= */
const logpaper=$("#logpaper");
const appEvents=[], sysEvents=[];
function pushEv(arr,t,src,id,text){
  arr.unshift({t,at:Date.now(),src,id,text:String(text)});
  if(arr.length>200) arr.pop();
}
function log(line){
  pushEv(appEvents,"info","CURSORS.EXE",1000,line);
  const t=new Date().toLocaleTimeString([],{hour12:false});
  logpaper.textContent+=`[${t}] ${line}\n`;
  while(logpaper.textContent.length>9000)
    logpaper.textContent=logpaper.textContent.slice(logpaper.textContent.indexOf("\n")+1);
  logpaper.scrollTop=logpaper.scrollHeight;
}
/* Every death writes a certificate. The interesting number is `odds`: the
   chance the loser had of winning that exact collision. A cursor that dies at
   8% was robbed by nothing — it was a fair draw and it came up the other way,
   and this is the piece of paper that says so. */
const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
let deathN=0;
function certify(l,w,pLose){
  return {
    id:++deathN,
    name:l.owner, mine:!!l.isMine,
    killer:w.owner, killerMine:!!w.isMine,
    lost:l.bounty,                       /* what it was carrying when it popped */
    mult:l.bounty/ENTRY,
    peak:l.peak||l.bounty,
    odds:Math.round(100*pLose),          /* its own win chance, in percent */
    kills:l.kills,
    lived:Math.max(1,Math.round((performance.now()-l.born)/1000)),
    round:l.round||roundNo,
    at:new Date().toLocaleTimeString([],{hour12:false}),
  };
}
const binEmpty=()=>!binDead.length&&!binFiles.length;
function renderBin(){
  binDead=binDead.slice(0,150);
  binFiles=binFiles.slice(0,40);
  /* the bin is a folder now, so "rendering" it means telling Explorer if it is looking */
  if(explorer.path()==="Recycle Bin") explorer.render();
}
function restoreOne(ic){
  binFiles=binFiles.filter(f=>f.id!==ic.id);
  store.data.userIcons.push(ic);
  store.data.icons[ic.id]=firstFreeCell();
  store.save(); renderIcons(); renderBin(); sysSnd("hwin",.5);
}
function restoreAll(){
  if(!binFiles.length){
    showError("Restore Items",binDead.length
      ? "Cursors cannot be restored."
      : "The Recycle Bin is empty.");
    return;
  }
  const list=binFiles.splice(0);
  fileOp({title:"Restoring...",line:"Restoring "+list.length+" item"+(list.length===1?"":"s"),
    fromIcon:IMG.bin32,toIcon:IMG.openfolder32,items:list,label:ic=>ic.label,
    each:ic=>{ store.data.userIcons.push(ic); store.data.icons[ic.id]=firstFreeCell(); },
    then:n=>{
      store.save(); renderIcons(); renderBin(); sysSnd("hwin",.5);
      showError("Restore Items",`${n} item${n===1?"":"s"} put back on the Desktop.`,true);
    }});
}
/* the Hall of Pain is the bin sorted by how much it hurt */
function hallOfPain(){
  const rows=binDead.slice().sort((a,b)=>b.lost-a.lost);
  const total=binDead.reduce((s,d)=>s+d.lost,0);
  const mine=binDead.filter(d=>d.mine);
  const myTotal=mine.reduce((s,d)=>s+d.lost,0);
  const tally={};
  for(const d of binDead) tally[d.killer]=(tally[d.killer]||0)+d.lost;
  const top=Object.entries(tally).sort((a,b)=>b[1]-a[1])[0];
  const worstOdds=binDead.filter(d=>d.odds>=50).sort((a,b)=>b.odds-a.odds)[0];
  $("#hall-sum").innerHTML=binDead.length
    ? `<div><b>${binDead.length}</b> cursors terminated · <b>${fmtS(total)} SOL</b> stopped existing</div>`+
      `<div>yours: <b>${mine.length}</b> · <b>${fmtS(myTotal)} SOL</b></div>`+
      (top?`<div>biggest earner: <b>${esc(top[0])}</b> (${fmtS(top[1])} SOL taken)</div>`:"")+
      (worstOdds?`<div class="hall-bad">worst beat: <b>${esc(worstOdds.name)}</b> — ${worstOdds.odds}% to win, dead</div>`:"")
    : "<div>Nothing has died yet.</div>";
  const body=$("#hall-rows");
  body.innerHTML="";
  rows.slice(0,40).forEach((d,i)=>{
    const tr=document.createElement("tr");
    if(d.mine) tr.className="me";
    tr.innerHTML=`<td>${i+1}</td><td>${esc(d.name)}_${String(d.id).padStart(4,"0")}.cur</td>`+
      `<td class="n">${fmtS(d.lost)}</td><td class="n">×${d.mult.toFixed(1)}</td>`+
      /* red marks a favourite that lost — the column people actually scan for */
      `<td class="n${d.odds>=50?" bad":""}">${d.odds}%</td><td>${esc(d.killer)}</td><td class="n">${d.round}</td>`;
    tr.addEventListener("click",()=>deathCert(d));
    body.appendChild(tr);
  });
  if(!rows.length) body.innerHTML=`<tr><td colspan="7" class="dim">(empty)</td></tr>`;
  openWin("win-hall");
}
/* the certificate itself: the receipt for one collision */
function deathCert(d){
  $("#win-cert .title-bar-text").textContent=`${d.name}_${String(d.id).padStart(4,"0")}.cur Properties`;
  $("#cert-file").textContent=`${d.name}_${String(d.id).padStart(4,"0")}.cur`;
  $("#cert-sub").textContent=`arena.dll · round ${d.round} · ${d.at}`;
  const row=(k,v,cls)=>`<div class="cert-r${cls?" "+cls:""}"><span>${k}</span><b>${v}</b></div>`;
  $("#cert-rows").innerHTML=
    row("killed by",esc(d.killer)+(d.killerMine?" (you)":""))+
    row("carrying",`${fmtS(d.lost)} SOL &nbsp;<span class="dim">×${d.mult.toFixed(1)}</span>`,"big")+
    row("peak",`${fmtS(d.peak)} SOL`)+
    row("odds to win",`${d.odds}%`,d.odds>=50?"bad":"")+
    row("record",`${d.kills} kill${d.kills===1?"":"s"} · ${d.lived}s`);
  openWin("win-cert");
}
function updatePanel(){
  const mine=myCurs();
  const liveVal=mine.reduce((s,c)=>s+c.bounty,0);
  const dep=$("#btn-deploy");
  const broke=wallet<STAKE&&!MP.on;   /* online, the server faucets the busted */
  dep.disabled=!canDeploy()||mine.length>=MAXCUR||broke;
  dep.textContent=broke?"▸ INSUFFICIENT FUNDS"
    :mine.length>=MAXCUR?"▸ MAX 5 CURSORS LIVE"
    :canDeploy()?"▸ DEPLOY 0.1 SOL"
    :phase==="crash"?"▸ RESTARTING…":"▸ SHUTDOWN IN PROGRESS";
  const rec=$("#btn-recall");
  const graced=mine.some(c=>c.grace>0);
  const recalling=!graced&&mine.some(c=>c.mode==="recall");
  rec.disabled=phase==="crash"||!(recalling||mine.some(c=>c.mode==="roam"||c.grace>0));
  rec.textContent=graced?"◂ UNDEPLOY (refund)":recalling?"◂ CANCEL RECALL":`◂ RECALL ALL (${RECALL_SECS}s)`;
  $("#st-attack").classList.toggle("on",stance==="attack");
  $("#st-defend").classList.toggle("on",stance==="defend");
  $("#livecount").textContent=mine.length;
  $("#liveval").textContent=fmtS(liveVal);
  const share=myTickets>0?100*myTickets/(globalTickets+myTickets):0;
  $("#rakeline").textContent=`rakeback: ${myTickets.toLocaleString()} tk · ${share.toFixed(2)}% · +${(rakeAccrued/1000).toFixed(4)} SOL`;
  const pl=wallet+liveVal-5000;
  $("#statline").textContent=`kills ${stats.kills} · deaths ${stats.deaths} · best ×${stats.best.toFixed(1)} · P/L ${fmtSign(pl)}`;
  /* the thumb bar shows the same state in fewer letters */
  const hd=$("#mh-deploy");
  hd.disabled=dep.disabled;
  hd.textContent=broke?"NO FUNDS":mine.length>=MAXCUR?"MAX 5 LIVE":canDeploy()?"▸ DEPLOY 0.1":phase==="crash"?"REBOOT…":"SHUTDOWN";
  const hrc=$("#mh-recall");
  hrc.disabled=rec.disabled;
  hrc.textContent=graced?"◂ UNDO":recalling?"◂ CANCEL":"◂ RECALL";
  $("#mh-attack").classList.toggle("on",stance==="attack");
  $("#mh-defend").classList.toggle("on",stance==="defend");
  $("#mh-live").textContent=`${mine.length}/5 · ${fmtS(liveVal)}`;
  renderCx();   /* whatever pane is open stays live */
}


/* logoff reset */
$("#btn-logoff-yes").addEventListener("click",()=>{
  sClick();
  if(MP.on){
    /* the server owns this session's money; a local wipe just desyncs the
       readout and lets autoplay double-deploy over invisible cursors */
    mpSend({t:"recall"});
    closeWin("win-logoff"); showLogin(true); return;
  }
  for(const c of [...myCurs()]) removeCur(c);
  wallet=5000; walletShown=5000;
  $("#walletamt").textContent=fmtS(5000)+" SOL";
  $("#mh-wallet").textContent=fmtS(5000)+" SOL";
  stats={kills:0,deaths:0,best:0,deploys:0,banks:0,bigBank:0,tIn:0,tOut:0};
  epochHist=[];
  myTickets=0; rakeAccrued=0;
  binDead=[]; binFiles=[]; renderBin();
  logpaper.textContent="";
  log("session reset. welcome back.");
  closeWin("win-logoff",{silent:true});
  sysSnd("logoff",.7);
  showLogin(true);
  updatePanel();
});

/* ================= multiplayer ================= */
/* The beta server (server/ in this repo) is the single authority: it runs the
   same sim, owns every balance, and commits its RNG seed before each epoch.
   Online, this client is a display — deploys/recalls/stances are requests,
   positions arrive as 10Hz snapshots we interpolate, deaths and banks arrive
   as events and reuse the exact solo FX paths. Offline (no server, dev
   hashes, file://) the local sandbox sim runs untouched. */
const MP={on:false,name:null,fill:0,disk:null,guest:null,gallery:null,tv:{now:null,queue:[]},chatSeeded:false};
function mpUrl(){
  try{
    const q=new URLSearchParams(location.search).get("server");
    if(q==="off") return null;
    if(q) return q;
    if(location.hash.indexOf("#desktop-mp")===0) return "ws://localhost:8788";
    if(location.hash.indexOf("#desktop")===0) return null;      /* dev screenshots stay deterministic */
    if(typeof location.hostname!=="string"||!location.hostname) return null;  /* smoke runner, odd hosts */
    if(location.protocol==="file:") return null;
    if(/^(localhost|127\.|192\.168\.)/.test(location.hostname)) return null;
    return "wss://cursors.34-70-75-204.sslip.io";
  }catch(e){ return null; }
}
const MPURL=mpUrl();
function mpSend(o){ if(MP.on) net.send(o); }
function mpHello(){
  /* no MP.on guard: a socket that reconnected during the 7s grace still needs
     a fresh hello (the server dropped everything about us with the old one).
     welcome purges and rebuilds, so a duplicate hello is harmless. */
  if(!net||!net.up()) return;
  net.send({t:"hello",token:store.data.mpToken||undefined,name:PLAYER||undefined,skin:store.data.curScheme||""});
  /* the server assumes new sockets are visible; a hidden tab reconnecting
     overnight would stream 15Hz snapshots to a renderer that never draws */
  net.send({t:"vis",on:document.visibilityState==="visible"});
}

/* ---- server cursors: same DOM, same tag scaling, positions interpolated ---- */
const mpCurs=new Map();   /* id -> cursor record (also pushed into curs[]) */
function mpMakeCur(id,owner,x,y,bounty,graceSecs,skin){
  const el=document.createElement("div");
  el.className="cur"+(graceSecs>0?" grace":"")+(owner===MP.name?" me":"");
  el.innerHTML=CURSVG+`<div class="tag"><span class="nm">${esc(owner)}</span><span class="bt"></span><span class="mx"></span></div>`;
  skinCurEl(el,skin||"");
  curlayer.appendChild(el);
  const c={id,owner,isMine:owner===MP.name,el,x,y,tx:x,ty:y,bounty,buf:[{t:performance.now(),x,y}],
    mode:"roam",prevMode:"roam",recallT:0,grace:graceSecs,riskAt:99,dead:false,
    s:1,r:10,h:0,spd:0,ax:x,ay:y,kills:0,peak:bounty,born:performance.now(),round:roundNo};
  el.style.transform=`translate(${x-8}px,${y-4}px)`;
  mpCurs.set(id,c); curs.push(c);
  updateTag(c);
  return c;
}
function mpRemove(c){ if(!c) return; mpCurs.delete(c.id); removeCur(c); }
const mpBlind=()=>document.visibilityState!=="visible";
function mpPurge(){
  for(const c of [...curs]) removeCur(c);
  mpCurs.clear();
  /* belt and braces: anything still in the layer is an orphan by definition,
     and an orphan is a cursor that can never be told to move or to die */
  for(const el of [...curlayer.querySelectorAll(".cur")]) el.remove();
}
const MPMODE={r:"roam",c:"recall",d:"duel"};

/* Snapshot interpolation. Positions arrive at 15Hz; we render the arena
   RENDER_DELAY behind the newest one and slide between the two samples that
   bracket that instant, which reproduces the server's motion exactly, just
   late. The previous version chased the latest position with an exponential
   filter — velocity proportional to error, so every cursor lurched as a packet
   landed and coasted as it caught up, a visible 10Hz pulse plus cut corners.
   The delay is free here: nobody steers a cursor, so nobody can feel it. */
const RENDER_DELAY=110, BUF_MAX=12;
function mpSample(c,x,y,at){
  c.buf.push({t:at,x,y});
  while(c.buf.length>BUF_MAX) c.buf.shift();
}
function mpFrame(dt,now){
  /* the frame's own timestamp, not performance.now(): the gap between the two
     is however much JS ran earlier this frame, and feeding that into the
     interpolator turns our own workload into visible jitter */
  const rt=now-RENDER_DELAY;
  for(const c of mpCurs.values()){
    const b=c.buf;
    if(b.length){
      if(rt<=b[0].t){ c.x=b[0].x; c.y=b[0].y; }
      else if(rt>=b[b.length-1].t){
        /* starved (packet loss, or the tab was in the background): hold the
           newest known position rather than inventing one */
        c.x=b[b.length-1].x; c.y=b[b.length-1].y;
        while(b.length>2) b.shift();
      }else{
        let i=b.length-2;
        while(i>0&&b[i].t>rt) i--;
        const a0=b[i], a1=b[i+1];
        const f=(rt-a0.t)/Math.max(1,a1.t-a0.t);
        c.x=a0.x+(a1.x-a0.x)*f; c.y=a0.y+(a1.y-a0.y)*f;
        while(b.length>2&&b[1].t<rt) b.shift();
      }
    }
    c.el.style.transform=`translate(${c.x-8}px,${c.y-4}px)`;
    if(c.grace>0){ c.grace-=dt; if(c.grace<=0) c.el.classList.remove("grace"); }
    /* client-side auto-bank: the "bank at ×N" knob rides along in autoplay */
    if(c.isMine&&auto.on&&auto.bankAt>0&&c.mode==="roam"&&!c._bankReq&&c.bounty>=auto.bankAt*ENTRY){
      c._bankReq=true; c._bankAt=Date.now(); mpSend({t:"recallOne",id:c.id});
    }
  }
  if(shutFired&&phaseT>0){
    phaseT-=dt; renderPhase();
    $("#shuttimer").textContent="0:"+String(Math.max(0,Math.ceil(phaseT))).padStart(2,"0");
  }
}

/* ---- event handlers: each one re-uses the solo game's FX verbatim ---- */
function mpWelcome(m){
  if(mpGraceT){ clearTimeout(mpGraceT); mpGraceT=null; log("reconnected"); }
  MP.on=true; MP.name=m.name;
  roundId++;   /* strands the sandbox's pending bot timers, which check it */
  store.data.mpToken=m.token; store.save();
  if(PLAYER!==m.name){ PLAYER=m.name; store.data.userName=m.name; store.save(); syncIdentity(); try{ msn.renderMe(); }catch(e){} }
  mpPurge();
  const keepMy=(roundNo===m.epoch.no&&R)?{i:R.myIn,o:R.myOut}:null;
  roundNo=m.epoch.no; R=newRoundRecord();
  if(keepMy){ R.myIn=keepMy.i; R.myOut=keepMy.o; }   /* same epoch: my ledger survives the blip */
  R.pot=m.epoch.pot; R.deploys=m.epoch.deploys; R.deaths=m.epoch.deaths;
  upT=m.epoch.up; epochStart=upT-(m.epoch.eup||0);   /* the epoch is older than our connection */
  phase=m.epoch.phase; shutFired=m.epoch.rush!=null; phaseT=shutFired?m.epoch.rush:999;
  /* the crash/rush UI we missed the events for */
  if(phase!=="crash"&&bsodEl.style.display==="block") bsodHide();
  if(!shutFired&&openApps.has("win-shutdown")) closeWin("win-shutdown");
  mpOff=null; mpOffWin.length=0;   /* the server clock restarted with the socket */
  commitHex=m.epoch.commit; seedHex=null;
  MP.fill=m.epoch.fill; MP.disk=m.epoch.disk; MP.corpses=m.epoch.corpses||64;
  for(const sc of m.epoch.curs){
    const c=mpMakeCur(sc.id,sc.owner,sc.x,sc.y,sc.bounty,sc.grace,sc.skin);
    c.mode=MPMODE[sc.mode]||"roam";
    if(c.mode==="duel") c.el.classList.add("dueling");
  }
  wallet=m.balance; walletShown=wallet;
  $("#walletamt").textContent=fmtS(Math.round(wallet))+" SOL";
  $("#mh-wallet").textContent=fmtS(Math.round(wallet))+" SOL";
  myTickets=m.tickets; globalTickets=m.glob; rakeAccrued=m.rake;
  if(m.tv&&typeof m.tv.srv==="number") tvSkew=m.tv.srv-Date.now();
  MP.tv=m.tv||MP.tv;
  tvWatchLast=false;               /* re-announce "watching" on the new socket */
  try{ mpTvSync(); }catch(e){}     /* the room may have changed videos while we were gone */
  if(!MP.chatSeeded){
    MP.chatSeeded=true;
    for(const e of (m.chat||[])) e.who==="*"?msn.lobbySys(e.text):msn.lobbySay(e.who,e.text);
  }
  mpSend({t:"guest"});
  MP.online=m.online;
  msn.setHumans(m.online);
  log(`connected to the beta arena as ${MP.name} — epoch ${roundNo}, ${m.online.length} online`);
  showBalloon("Connected",`Play money beta. You are ${MP.name} · ${m.online.length} online.`);
  updatePanel(); renderPhase();
}
/* Server clock -> local clock. Timestamping samples with their arrival time
   turned every millisecond of network jitter into fake acceleration; the
   snapshots are actually emitted on a perfect 66ms cadence, so we recover that
   cadence instead. offset = min(arrival - serverTs) over a rolling window: the
   minimum is the sample that queued the least, which is the closest thing to
   the true one-way delay, and it ignores the jitter above it. */
let mpOff=null, mpOffWin=[];
function mpClock(serverTs,arrival){
  const o=arrival-serverTs;
  mpOffWin.push(o);
  if(mpOffWin.length>80) mpOffWin.shift();
  const lo=Math.min(...mpOffWin);
  /* adopt a better (lower) offset at once, drift toward a worse one slowly, so
     a single delayed packet cannot shove the whole timeline */
  if(mpOff===null||lo<mpOff) mpOff=lo; else mpOff+=(lo-mpOff)*0.02;
  return serverTs+mpOff;
}
/* Coming back from a hidden tab (or a reconnect): throw away the stale world
   and rebuild it from the server's own description of right now. */
function mpResync(e){
  mpPurge();
  roundNo=e.no; commitHex=e.commit;
  R=R||newRoundRecord();
  R.pot=e.pot; R.deploys=e.deploys; R.deaths=e.deaths;
  upT=e.up; epochStart=upT-(e.eup||0); phase=e.phase; shutFired=e.rush!=null; phaseT=shutFired?e.rush:999;
  MP.fill=e.fill; MP.disk=e.disk; MP.corpses=e.corpses||MP.corpses;
  for(const sc of e.curs){
    const c=mpMakeCur(sc.id,sc.owner,sc.x,sc.y,sc.bounty,sc.grace,sc.skin);
    c.mode=MPMODE[sc.mode]||"roam";
    if(c.mode==="duel") c.el.classList.add("dueling");
  }
  updatePanel(); renderPhase();
}
function mpSnap(m){
  upT=m.up; R.pot=m.pot; MP.fill=m.fill;
  const at=m.ts?mpClock(m.ts,performance.now()):performance.now();
  const seen=new Set();
  for(const row of m.p){
    seen.add(row[0]);
    const c=mpCurs.get(row[0]);
    if(!c) continue;                       /* spawn event is in flight */
    mpSample(c,row[1],row[2],at);
    if(c.bounty!==row[3]){ c.bounty=row[3]; updateTag(c); }
    const mode=MPMODE[row[4]]||"roam";
    if(mode!==c.mode){
      c.mode=mode;
      c.el.classList.toggle("dueling",mode==="duel");
      if(mode!=="duel") c._bankReq=false;
    }
  }
  /* reconciliation after a hiccup: anything the server no longer has is gone */
  for(const c of [...mpCurs.values()]) if(!seen.has(c.id)) mpRemove(c);
  renderPhase();
}
function mpSpawn(m){
  if(mpCurs.has(m.id)) return;
  /* runs even while the tab is hidden: the record must exist so autoplay's
     "keep live N" counts it — it parks at its spawn point until the resync */
  const c=mpMakeCur(m.id,m.owner,m.x,m.y,m.bounty,m.grace,m.skin);
  if(c.isMine){
    R.myIn+=STAKE; stats.deploys++; stats.tIn+=STAKE;
    log(`you deployed 0.100 (${myCurs().length}/${MAXCUR})`);
  }
  updatePanel();
}
function mpDuel(m){
  const a=mpCurs.get(m.a), b=mpCurs.get(m.b);
  if(!a||!b) return;
  duelPulse=Math.min(4,duelPulse+1);
  a.mode=b.mode="duel";
  a.el.classList.add("dueling"); b.el.classList.add("dueling");
  sDuel();
  const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
  const big=(a.bounty+b.bounty)>=ENTRY*5;
  const fx=document.createElement("div");
  fx.className="duelfx"+(big?" big":"");
  fx.innerHTML=`<span class="hg">⌛</span><br>${m.pA}:${100-m.pA}`;
  fx.style.left=(mx-28)+"px"; fx.style.top=(my-(big?58:46))+"px";
  fxlayer.appendChild(fx);
  setTimeout(()=>fx.remove(),DUEL_MS);
}
function mpKill(m){
  const w=mpCurs.get(m.w), l=mpCurs.get(m.l);
  MP.fill=m.fill;
  const cert=m.cert;
  cert.mine=m.lOwner===MP.name;
  cert.killerMine=m.wOwner===MP.name;
  cert.at=new Date().toLocaleTimeString([],{hour12:false});
  binDead.unshift(cert); renderBin();
  if(!cert.mine) feedKill(cert,false);
  R.deaths++;
  if(l){ explode(l); mpRemove(l); }
  if(w){
    w.bounty+=m.pot; w.kills++; w.mode="roam";
    w.el.classList.remove("dueling");
    updateTag(w);
  }
  renderDisk();
  log(`${m.wOwner} > ${m.lOwner}  +${fmtS(m.pot)}`);
  if(cert.mine){
    stats.deaths++;
    if(myCurs().length===0){ sDie(); feedKill(cert,!auto.on); }
    else { feedKill(cert,false); if(l) float("cursor lost",l.x,l.y,true); }
  }else if(cert.killerMine){
    stats.kills++; R.myKills++;
    if(w){ stats.best=Math.max(stats.best,w.bounty/ENTRY); sKill(); float(fmtSign(m.pot),w.x,w.y,false);
      if(R.myKills>=2) float(`${R.myKills} KILL STREAK`,w.x,w.y-24,false); }
  }else if(w) float(fmtSign(m.pot),w.x,w.y,true);
  updatePanel();
}
function mpBank(m){
  const c=mpCurs.get(m.id);
  const mine=m.owner===MP.name;
  if(!R.bigBank||m.amt>R.bigBank.amt) R.bigBank={owner:m.owner,amt:m.amt};
  if(mine){
    R.myOut+=m.amt;
    stats.best=Math.max(stats.best,m.amt/ENTRY);
    stats.banks++; stats.tOut+=m.amt; stats.bigBank=Math.max(stats.bigBank,m.amt);
    const x=c?c.x:AW/2, y=c?c.y:AH/2;
    if(m.amt>=ENTRY*10){
      sysSnd("tada",.6);
      for(let i=0;i<3;i++) setTimeout(()=>goldBurst(x+rand(-44,44),y+rand(-30,30)),i*170);
      jackpot(m.amt);
    }else sBank();
    float(fmtSign(m.amt)+" ×"+m.mult.toFixed(1),x,y,false);
    goldBurst(x,y);
    log(`you banked ${fmtS(m.amt)} (×${m.mult.toFixed(1)})${m.shut?" at shutdown":""}`);
  }else if(m.amt>=ENTRY*2) log(`${m.owner} banked ${fmtS(m.amt)} (×${m.mult.toFixed(1)})`);
  if(c) mpRemove(c);
  updatePanel();
}
function mpCrash(m){
  closeWin("win-shutdown",{silent:true});
  R.pot=m.pot; R.deploys=m.deploys; R.deaths=m.deaths; R.bigBank=m.top;
  epochHist.unshift({no:m.no,up:fmtUp(m.up),pot:m.pot,deploys:m.deploys,deaths:m.deaths,
    top:m.top,net:R.myOut-R.myIn,myIn:R.myIn});
  epochHist=epochHist.slice(0,30);
  prevSeed=m.seed; prevCommit=m.commit; prevSeedEpoch=m.no;
  phase="crash"; shutFired=false;
  bsodShow(crashBsodText());
  sError();
  log(`CURSORS.EXE crashed. epoch ${m.no}: pot ${fmtS(m.pot)}, ${m.deaths} dead.`);
  mpPurge();
  updatePanel(); renderPhase();
}
function mpEpoch(m){
  bsodEl.style.display="none";
  if(phase==="crash") errorReport();
  roundNo=m.no; R=newRoundRecord();
  commitHex=m.commit; seedHex=null;
  phase="battle"; shutFired=false; phaseT=999;
  MP.fill=0; epochStart=upT;
  feedClear();
  $("#arena").classList.add("crashed");
  setTimeout(()=>$("#arena").classList.remove("crashed"),900);
  degauss();
  log(`CURSORS.EXE restarted (epoch ${m.no}) — deploys are open`);
  updatePanel(); renderPhase(); renderCx();
}
/* A blip is not a divorce. net.js retries at 2s, so hold the arena still and
   say so; only fall back to the local sandbox if the server is really gone.
   Yanking the player between two different games on every hiccup was worse
   than a few frozen seconds. */
let mpGraceT=null;
function mpDown(){
  if(!MP.on||mpGraceT) return;
  log("connection lost — reconnecting…");
  $("#phaseline").textContent="⚠ RECONNECTING…";
  msn.lobbySys("connection lost — trying to get back in");
  mpGraceT=setTimeout(()=>{
    mpGraceT=null;
    if(net.up()) return;              /* came back; mpWelcome already rebuilt the world */
    MP.on=false; MP.name=null;
    mpPurge(); msn.setHumans([]);
    showBalloon("Offline sandbox","Server gone. Fake bots, fake money. Reconnects on its own.");
    log("server unreachable — offline sandbox running");
    bsodEl.style.display="none";   /* the server died mid-crash-screen */
    startEpoch();
  },7000);
}
let tmNetMsgs=0;
function mpMsg(m){
  tmNetMsgs++;
  switch(m.t){
    case "welcome": mpWelcome(m); break;
    case "snap": if(MP.on) mpSnap(m); break;
    /* Blind means the server has stopped sending us positions, so a cursor
       built now would stand still on the edge it spawned at until the resync.
       Skip it: becoming visible asks for the whole world back anyway. */
    case "spawn": if(MP.on) mpSpawn(m); break;
    case "duel": if(MP.on&&!mpBlind()) mpDuel(m); break;
    case "kill": if(MP.on) mpKill(m); break;
    case "bank": if(MP.on) mpBank(m); break;
    case "refund": if(MP.on){ const c=mpCurs.get(m.id); if(c&&c.isMine){ R.myIn-=STAKE; stats.deploys--; stats.tIn-=STAKE; log("undeployed in grace — refunded in full"); } mpRemove(c); updatePanel(); } break;
    case "bal": if(MP.on){ wallet=m.balance; myTickets=m.tickets; globalTickets=m.glob; rakeAccrued=m.rake; updatePanel(); } break;
    case "rush": if(MP.on){ shutFired=true; phaseT=m.secs; openWin("win-shutdown",{silent:true}); sShut(); renderPhase(); updatePanel(); } break;
    case "resync": if(MP.on) mpResync(m.epoch); break;
    case "crash": if(MP.on) mpCrash(m); break;
    case "epoch": if(MP.on) mpEpoch(m); break;
    case "chat": if(MP.on) msn.lobbySay(m.who,m.text); break;
    case "sys": if(MP.on) msn.lobbySys(m.text); break;
    case "join": if(MP.on&&m.online){ MP.online=m.online; msn.setHumans(m.online); mpTvRenderQueue(); } break;   /* the sys line covers the greeting */
    case "part": if(MP.on){ msn.lobbySys(`${m.name} signed out`); if(m.online){ MP.online=m.online; msn.setHumans(m.online); mpTvRenderQueue(); } } break;
    case "guest": MP.guest=m.list;
      { const t=document.querySelector("#gb-txt"); if(!t||!t.value.trim()) mpRefreshIe("guest."); }
      break;
    case "gallery": MP.gallery=m.list; mpRefreshIe("gallery"); break;
    case "galAdd": if(m.item){ MP.gallery=[m.item,...(MP.gallery||[])].slice(0,16); mpRefreshIe("gallery"); } break;
    case "tv":
      if(typeof m.srv==="number") tvSkew=m.srv-Date.now();
      MP.tv={now:m.now,queue:m.queue,skip:m.skip,w:m.w};
      mpTvSync();
      break;
    case "err":
      if(m.msg==="signed in elsewhere"){
        /* both tabs share one token: retrying just kicks the other tab back.
           This tab stands down; the sandbox takes over. */
        try{ net.stop(); }catch(e){}
        if(mpGraceT){ clearTimeout(mpGraceT); mpGraceT=null; mpDrop(); }
        showBalloon("beta server","You signed in from another tab. This one went offline — reload it to take over.");
      }else if(m.msg) showBalloon("beta server",m.msg);
      break;
  }
}
const net=MPURL?initNet({url:MPURL,onMsg:mpMsg,onUp:()=>{ if(PLAYER) mpHello(); },onDown:mpDown}):null;
if(net) net.start();
/* a backgrounded tab cannot draw snapshots, so it asks not to be sent any —
   the single cheapest thing we can do for a free tier's egress budget */
document.addEventListener("visibilitychange",()=>{
  if(!MP.on) return;
  mpSend({t:"vis",on:document.visibilityState==="visible"});
});

/* ---- IE integration: the online guestbook, the gallery, cursorTV ---- */
function mpRefreshIe(urlPart){
  if(ie&&ie.url()&&ie.url().indexOf(urlPart)>=0) ie.go(ie.url(),{replace:true});
}
const MONS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtWhen(at){ const d=new Date(at); return `${d.getDate()} ${MONS[d.getMonth()]} ${d.getFullYear()}`; }
function mpGuestData(){
  if(!MP.on||!MP.guest) return null;
  return MP.guest.map(e=>({who:e.who,when:fmtWhen(e.at),txt:e.txt}));
}
function mpGuestPost(who,txt){
  if(!MP.on) return false;
  mpSend({t:"guestPost",who,text:txt});
  return true;
}
function mpGuestOpen(){ if(MP.on) mpSend({t:"guest"}); }
function mpGalleryData(){ return MP.on?(MP.gallery||[]):null; }
function mpGalleryOpen(){ if(MP.on&&MP.gallery==null) mpSend({t:"gallery"}); }
function mpPublishPainting(name,png){
  if(!MP.on){ showError("Gallery","Offline — nowhere to publish.",true); return; }
  if(png.length>400000){ showError("Gallery","Over the 400 KB limit.",true); return; }
  mpSend({t:"galleryPost",name,png});
  showError("Gallery","Sent to the gallery.",true);
}

/* ---- cursorTV: the lobby watches one YouTube video together ---- */
/* Sync model: the server owns {video, startedAt, queue}; every client seeks to
   the shared elapsed time. Playback starts muted (browser autoplay law) with a
   click-for-sound overlay. Queue is a fair FIFO, 3 pending per player, skip by
   vote. This is turntable.fm wearing an IE6 costume. */
let ytApi=0, ytPlayer=null, tvPage=null;
/* The room's clock is the SERVER's clock. A phone whose clock is two minutes
   fast would otherwise seek two minutes ahead of everybody and think the room
   was wrong, so every tv message carries the server's time and we keep the
   difference. Old servers do not send it; then the skew is zero and this
   behaves exactly as it did before. */
let tvSkew=0, tvLastSeek=0, tvFitObs=null, tvDurSent=null, tvVoted=null, tvWatchLast=false, tvGen=0;
/* the server cannot see how long a video is; the first screen that can read
   the duration tells it, and the channel advances on time even if every
   player is closed when the credits roll */
function tvReport(vid){
  if(tvDurSent===vid||!ytPlayer||!ytPlayer.getDuration) return;
  let d=0; try{ d=ytPlayer.getDuration()||0; }catch(e){}
  if(d>4){ tvDurSent=vid; mpSend({t:"tvDur",vid,dur:Math.round(d)}); }
}
function tvElapsed(){
  if(!MP.tv.now) return 0;
  return Math.max(0,(Date.now()+tvSkew-MP.tv.now.startedAt)/1000);
}
/* the picture is sized to the window, in both directions. 16:9 inside whatever
   box IE has: widen the window and it grows, make it taller and it grows. */
function tvFit(){
  const stage=document.getElementById("tv-stage");
  const doc=$("#ie-page");
  if(!stage||!doc) return;
  const th=$("#win-ie").classList.contains("theater");
  const availW=Math.max(160,doc.clientWidth-(th?0:22));
  /* out of theater, leave the bar and the decks room to exist below it */
  const availH=Math.max(150,th?doc.clientHeight:doc.clientHeight-150);
  let w=availW,h=w*9/16;
  if(h>availH){ h=availH; w=h*16/9; }
  stage.style.width=Math.round(w)+"px";
  stage.style.height=Math.round(h)+"px";
}
function mpTvMounted(page){
  tvPage=page;
  if(!MP.on) return;
  mpTvRenderQueue();
  const inp=page.querySelector("#tv-in");
  const add=()=>{
    const raw=(inp.value||"").trim();
    if(!raw){ showError("cursorTV","Paste a YouTube link.",true); return; }
    if(!MP.on){ showError("cursorTV","Not connected. The channel is shared, so it needs the arena.",true); return; }
    const m=/([\w-]{11})(?:[?&#/]|$)/.exec(raw.replace(/^\s*<|>\s*$/g,"").replace(/.*(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)/,""));
    if(!m){ showError("cursorTV","That is not a YouTube link.",true); return; }
    const vid=m[1]; inp.value="";
    /* the title travels with the queue entry so every screen shows words, not
       ids. oEmbed is CORS-open; when a blocker eats it, the id shows. */
    const ac=new AbortController(); setTimeout(()=>ac.abort(),2500);
    fetch("https://www.youtube.com/oembed?url=https%3A%2F%2Fyoutu.be%2F"+vid+"&format=json",{signal:ac.signal})
      .then(r=>r&&r.ok?r.json():null).catch(()=>null)
      .then(j=>mpSend({t:"tvQueue",vid,title:j&&j.title?String(j.title).slice(0,80):undefined}));
  };
  page.querySelector("#tv-add").addEventListener("click",add);
  inp.addEventListener("keydown",e=>{ e.stopPropagation(); if(e.key==="Enter") add(); });
  page.querySelector("#tv-skip").addEventListener("click",()=>mpSend({t:"tvSkip"}));
  const th=page.querySelector("#tv-theater"), ex=page.querySelector("#tv-exit");
  if(th) th.addEventListener("click",()=>ie.theater(!ie.isTheater()));
  if(ex) ex.addEventListener("click",()=>ie.theater(false));
  const live=page.querySelector("#tv-live");
  if(live){
    live.textContent="\u25CF LIVE";
    live.addEventListener("click",()=>tvCatchUp());
  }
  tvFit();
  /* one observer for the life of the page: every way IE can change size —
     dragged edge, maximize, sidebar, theater, phone rotation — lands here */
  if(!tvFitObs&&window.ResizeObserver){
    tvFitObs=new ResizeObserver(()=>tvFit());
    tvFitObs.observe($("#ie-page"));
  }
  const snd=page.querySelector("#tv-sound");
  if(snd) snd.addEventListener("click",()=>{ try{ ytPlayer.unMute(); snd.style.display="none"; }catch(e){} });
  if(ytApi===2) mpTvPlayer();
  else{
    window.onYouTubeIframeAPIReady=()=>{ ytApi=2; mpTvPlayer(); };
    if(!ytApi){
      ytApi=1;
      const sc=document.createElement("script");
      sc.src="https://www.youtube.com/iframe_api";
      sc.onerror=()=>tvFallback(MP.tv.now&&MP.tv.now.vid,-1);
      document.head.appendChild(sc);
    }
    /* a blocked script fires no error in some setups; it simply never runs */
    setTimeout(()=>{ if(ytApi!==2) tvFallback(MP.tv.now&&MP.tv.now.vid,-1); },12000);
  }
}
function mpTvPlayer(){
  if(!tvPage||!tvPage.isConnected||!MP.tv.now) return;
  const gen=++tvGen;
  let slot=tvPage.querySelector("#tv-slot");
  if(slot&&ytPlayer){
    /* fresh mount over a dead player from the last visit */
    try{ ytPlayer.destroy&&ytPlayer.destroy(); }catch(e){}
    ytPlayer=null;
  }
  if(!slot){
    /* the slot is gone because a fallback panel took the screen, or because a
       player is already sitting in it. Either way, clear the stage and build
       a fresh one: a late-arriving YouTube gets its picture back. */
    const st=tvPage.querySelector("#tv-stage");
    if(!st) return;
    const dead=st.querySelector("[data-failed]"), old=st.querySelector("iframe");
    if(dead) dead.remove();
    if(old) old.remove();
    try{ ytPlayer&&ytPlayer.destroy&&ytPlayer.destroy(); }catch(e){}
    const badge=tvPage.querySelector("#tv-live");
    if(badge) badge.style.display="";
    const sndBtn=tvPage.querySelector("#tv-sound");
    if(sndBtn) sndBtn.style.display="";
    slot=document.createElement("div");
    slot.id="tv-slot";
    st.insertBefore(slot,st.firstChild);
  }
  const vid=MP.tv.now.vid;
  const elapsed=tvElapsed();
  let ready=false;
  tvFit();
  ytPlayer=new YT.Player(slot,{
    width:"100%",height:"100%",videoId:vid,
    /* nocookie is the host that survives the most blockers, and an explicit
       origin is what the IFrame API asks for when it is embedded */
    host:"https://www.youtube-nocookie.com",
    playerVars:{autoplay:1,mute:1,start:Math.floor(elapsed),rel:0,modestbranding:1,
      playsinline:1,origin:location.origin},
    events:{
      onReady:()=>{ ready=true; tvReport(MP.tv.now?MP.tv.now.vid:vid); tvApplyVol(); },
      onStateChange:e=>{
        ready=true; tvReport(MP.tv.now?MP.tv.now.vid:vid);
        /* pressing play after a pause rejoins the broadcast rather than
           starting a private screening from where you left off */
        if(e.data===1) tvCatchUp();
        if(e.data===0) mpSend({t:"tvEnded",vid:MP.tv.now&&MP.tv.now.vid});
      },
      /* 2 bad id, 5 html5 error, 100 gone, 101/150 embedding disallowed */
      onError:e=>{
        const code=e&&e.data;
        /* 2/100/101/150 fail for the whole room, not just this screen — an
           unplayable video must not park the channel, so an erroring screen
           casts its own skip vote */
        if([2,100,101,150].indexOf(code)>=0&&tvVoted!==vid){ tvVoted=vid; mpSend({t:"tvSkip"}); }
        tvFallback(vid,code);
      },
    },
  });
  /* the embed can also fail without ever telling us — a blocker or a proxy
     returning something Chrome will not render leaves a dead grey box. If the
     player has not said a word in eight seconds, say so and offer the link. */
  setTimeout(()=>{ if(gen===tvGen&&!ready) tvFallback(vid,null); },12000);
}
/* what the TV shows when YouTube will not play inside this page */
function tvFallback(vid,code){
  if(!tvPage||!tvPage.isConnected) return;
  const box=tvPage.querySelector("#tv-slot")||tvPage.querySelector("iframe");
  if(!box||box.dataset.failed) return;
  const badge=tvPage.querySelector("#tv-live");
  if(badge) badge.style.display="none";
  const host=box.parentElement||box;
  const keep=host.querySelector("#tv-exit");
  const why=code===-1?"YouTube's player did not load. An ad blocker or a privacy extension will do this."
    :code===2?"That video id is not a video."
    :code===100?"That video is gone."
    :(code===101||code===150)?"The owner does not allow this one to be embedded."
    :"The video did not load. An ad blocker or a privacy extension will do this to YouTube embeds.";
  const d=document.createElement("div");
  d.dataset.failed="1";
  d.style.cssText="width:100%;height:100%;background:#000;color:#CFCFCF;display:flex;"+
    "flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:12px";
  const p1=document.createElement("div"); p1.style.cssText="font-size:12px"; p1.textContent=why;
  const p2=document.createElement("div"); p2.style.cssText="font-size:11px;color:#8FA8CC";
  p2.textContent="The lobby is still watching it together. The clock keeps running.";
  const a=document.createElement("a");
  a.href="https://www.youtube.com/watch?v="+encodeURIComponent(vid);
  a.target="_blank"; a.rel="noopener";
  a.style.cssText="color:#7FB2FF;font-size:12px";
  a.textContent="Open it on youtube.com";
  d.appendChild(p1); d.appendChild(p2); d.appendChild(a);
  host.innerHTML=""; host.appendChild(d);
  if(keep) host.appendChild(keep);
}
/* dev only, behind the same #desktop hash the other probes use: a screenshot
   cannot show you a clock, a skew or whether two machines are on the same
   frame of the same video */
/* dev only: drive any window from a probe, the same door the UI uses */
if(location.hash.indexOf("#desktop")===0) window.__open=id=>openWin(id);
if(location.hash.indexOf("#desktop")===0)
  window.__tv={
    go:()=>{ openWin("win-ie"); ie.connectNow(); ie.go("http://tv.cursor.land/"); },
    on:()=>MP.on,
    now:()=>MP.tv.now,
    skew:()=>tvSkew,
    live:()=>tvElapsed(),
    at:()=>{ try{ return ytPlayer.getCurrentTime(); }catch(e){ return null; } },
    state:()=>{ try{ return ytPlayer.getPlayerState(); }catch(e){ return null; } },
    badge:()=>{ const b=tvPage&&tvPage.querySelector("#tv-live"); return b?b.textContent:null; },
    theater:v=>{ ie.theater(v); return ie.isTheater(); },
    stage:()=>{ const st=document.getElementById("tv-stage");
      return st?{w:st.clientWidth,h:st.clientHeight,dw:$("#ie-page").clientWidth,dh:$("#ie-page").clientHeight}:null; },
    queue:v=>mpSend({t:"tvQueue",vid:v}),
    fit:()=>tvFit(),
    pause:()=>{ try{ ytPlayer.pauseVideo(); }catch(e){} },
    rejoin:()=>tvCatchUp(),
    drift:()=>tvDrift(),
  };
/* No auto-duck: the TV used to drop to 14% whenever any duel was on screen,
   which with a lobby full of bots meant the volume pumped constantly while
   you watched and only held still when the tab was hidden (a hidden tab gets
   no snapshots, so no .dueling class). Volume is the mixer's job:
   TV = master x Wave, like every other program on this machine. */
function tvApplyVol(bus){
  if(!ytPlayer||!ytPlayer.setVolume) return;
  const wave=bus!=null?bus:(snd&&snd.ampBus?snd.ampBus():1);
  try{ ytPlayer.setVolume(muted?0:Math.round(100*Math.max(0,Math.min(1,masterVol*wave)))); }catch(e){}
}
/* Everyone is watching the same broadcast, so there is one position and the
   server owns it. If this screen drifts — the tab slept, the phone locked, the
   window was shut for ten minutes, somebody hit pause — it rejoins the room at
   the room's position instead of playing a private copy from where it stopped.
   Time away is time missed, exactly like a television. */
function tvCatchUp(){
  if(!ytPlayer||!MP.tv.now||!ytPlayer.getCurrentTime) return;
  const live=tvElapsed();
  try{
    const st=ytPlayer.getPlayerState?ytPlayer.getPlayerState():-1;
    if(Math.abs((ytPlayer.getCurrentTime()||0)-live)>1.5&&Date.now()-tvLastSeek>4000){ ytPlayer.seekTo(live,true); tvLastSeek=Date.now(); }
    if(st===2||st===5) ytPlayer.playVideo();
  }catch(e){}
}
function tvDrift(){
  /* "watching" = the TV page is mounted, the tab visible, IE open */
  const watching=!!(tvPage&&tvPage.isConnected&&!document.hidden&&openApps.has("win-ie"));
  if(watching!==tvWatchLast){ tvWatchLast=watching; mpSend({t:"tvWatch",on:watching}); }
  if(!tvPage||!tvPage.isConnected||!ytPlayer||!MP.tv.now) return;
  let st=-1,cur=0;
  try{ st=ytPlayer.getPlayerState?ytPlayer.getPlayerState():-1; cur=ytPlayer.getCurrentTime()||0; }catch(e){ return; }
  const behind=tvElapsed()-cur;
  const badge=tvPage.querySelector("#tv-live");
  const off=st===2||st===-1||Math.abs(behind)>3;
  if(badge){
    badge.className=off?"behind":"";
    badge.textContent=off?"\u25CF BEHIND \u00B7 rejoin":"\u25CF LIVE";
  }
  /* only nudge a player that is actually running, and never twice in a row:
     a seek buffers, and buffering looks like falling behind */
  if(st===1&&Math.abs(behind)>2.5&&Date.now()-tvLastSeek>4000){
    try{ ytPlayer.seekTo(tvElapsed(),true); tvLastSeek=Date.now(); }catch(e){}
  }
}
setInterval(tvDrift,2000);
/* coming back to the tab is coming back to the room */
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden) setTimeout(()=>{ try{ mpTvSync(); }catch(e){} },300);
});
function mpTvSync(){
  if(!tvPage||!tvPage.isConnected) return;
  mpTvRenderQueue();
  if(!MP.tv.now){ tvDeadAir(); return; }
  if(ytApi!==2){ return; }
  try{
    /* same show, only late: seek, do not reload — reloading restarts the
       buffer and makes every window focus a black flash */
    let vid=null;
    try{ vid=(ytPlayer.getVideoData&&ytPlayer.getVideoData()||{}).video_id||null; }catch(e){}
    if(ytPlayer&&vid===MP.tv.now.vid){ tvCatchUp(); return; }
    if(ytPlayer&&ytPlayer.loadVideoById) ytPlayer.loadVideoById(MP.tv.now.vid,tvElapsed());
    else mpTvPlayer();
  }catch(e){ mpTvPlayer(); }
}
/* nothing queued: tear the player down and say so. stopVideo() alone leaves
   the last frame parked on screen, which reads as "the skip did nothing". */
function tvDeadAir(){
  tvGen++;   /* strand any watchdog belonging to the player we are killing */
  try{ ytPlayer&&ytPlayer.destroy&&ytPlayer.destroy(); }catch(e){}
  ytPlayer=null; tvDurSent=null; tvVoted=null;
  if(!tvPage||!tvPage.isConnected) return;
  const st=tvPage.querySelector("#tv-stage"); if(!st) return;
  const keep=st.querySelector("#tv-exit");
  const badge=tvPage.querySelector("#tv-live"); if(badge) badge.style.display="none";
  const snd=tvPage.querySelector("#tv-sound"); if(snd) snd.style.display="none";
  st.innerHTML="";
  const d=document.createElement("div");
  d.id="tv-slot";
  d.style.cssText="width:100%;height:100%;background:#000;color:#9AA8BC;display:flex;"+
    "flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:12px";
  const a=document.createElement("div"); a.style.cssText="font-size:13px;color:#CFCFCF"; a.textContent="no signal";
  const b=document.createElement("div"); b.style.cssText="font-size:11px"; b.textContent="Paste a YouTube link below to start the channel.";
  d.appendChild(a); d.appendChild(b);
  st.appendChild(d);
  if(keep) st.appendChild(keep);
}
function tvTitle(){
  try{ const d=ytPlayer&&ytPlayer.getVideoData&&ytPlayer.getVideoData(); return d&&d.title?d.title:null; }catch(e){ return null; }
}
function mpTvRenderQueue(){
  if(!tvPage||!tvPage.isConnected) return;
  const nowEl=tvPage.querySelector("#tv-now"), qEl=tvPage.querySelector("#tv-queue");
  const ttl=tvTitle();
  if(nowEl) nowEl.innerHTML=MP.tv.now
    ? `now playing: <b>${esc(MP.tv.now.title||ttl||MP.tv.now.vid)}</b> <font size="1">(queued by ${esc(MP.tv.now.by)})</font>`
    : `<font size="1">dead air. queue something.</font>`;
  const wEl=tvPage.querySelector("#tv-watch"), skEl=tvPage.querySelector("#tv-skipn");
  if(wEl) wEl.textContent=(MP.tv&&MP.tv.w!=null?MP.tv.w:(MP.online&&MP.online.length?MP.online.length:1))+" watching";
  if(skEl) skEl.textContent=MP.tv.skip&&MP.tv.skip.n?`· skip votes ${MP.tv.skip.n}/${MP.tv.skip.need}`:"";
  /* the server hands back the order it will ACTUALLY play in — rotated by
     person, not first-come — so the page shows the deck, not the inbox */
  if(qEl) qEl.innerHTML=MP.tv.queue.length
    ? MP.tv.queue.map((q,i)=>`<div${q.by===MP.name?' style="font-weight:bold"':''}>${i+1}. ${esc(q.title||q.vid)} <font size="1" color="#888">&#8212; ${esc(q.by)}${q.by===MP.name?" (you)":""}</font></div>`).join("")
    : `<font size="1">queue is empty</font>`;
}

/* ================= Help and Support Center ================= */
/* The one place in the product that answers questions in plain words instead
   of in character. It is where the honest-casino thesis gets stated without a
   joke attached, and where a first-time player finds out what the disk bar
   means and why the game crashes on purpose. Topics are functions so the ones
   that quote live numbers can. */
const HELP={
  start:{t:"What CURSORS.EXE is",group:"Start here",body:()=>`
    <h1>What CURSORS.EXE is</h1>
    <p>You deploy mouse cursors onto this desktop for <b>0.1 SOL</b> each. They
    fight on their own — you do not steer them. When two cursors owned by
    different players touch, one dies and the winner takes everything the loser
    was carrying.</p>
    <p>You make exactly one decision: <b>when to stop</b>. Recall a cursor and
    its bounty is banked to your wallet. Leave it out and it keeps fighting.</p>
    <h2>The three verbs</h2>
    <ul>
      <li><b>DEPLOY</b> — put a new cursor in, 0.1 SOL, up to five at once.</li>
      <li><b>ATTACK / DEFEND</b> — a standing order for all your cursors. Attack
      hunts the nearest enemy; defend runs from it and regroups.</li>
      <li><b>RECALL</b> — bank everything. Takes three seconds, during which
      your cursors can still be caught.</li>
    </ul>
    <p>A freshly deployed cursor is in <b>spawn grace</b> for a moment and
    cannot fight. Recall during grace and you get everything back — it is there
    for misclicks.</p>`},

  odds:{t:"The odds, stated plainly",group:"Start here",body:()=>`
    <h1>The odds, stated plainly</h1>
    <p>When cursor A (carrying <i>a</i>) meets cursor B (carrying <i>b</i>), A
    wins with probability <b>a / (a + b)</b>. Bigger pile, better odds, in exact
    proportion. The house takes nothing from the collision and does not tilt
    it.</p>
    <p>Because every fight pays exactly what it risks, chaining fights cannot
    bend the average. The chance a cursor ever reaches <b>×N</b> its entry is
    <b>1/N</b> — exactly.</p>
    <table>
      <tr><th>Bank at</th><th>Chance of getting there</th></tr>
      <tr><td>×2</td><td>1 in 2 &nbsp;(50%)</td></tr>
      <tr><td>×5</td><td>1 in 5 &nbsp;(20%)</td></tr>
      <tr><td>×10</td><td>1 in 10 &nbsp;(10%)</td></tr>
      <tr><td>×100</td><td>1 in 100 &nbsp;(1%)</td></tr>
    </table>
    <h2>Where the house edge is</h2>
    <p>Entry is 0.100 SOL: <b>0.097</b> goes into the arena, <b>0.001</b> to the
    platform, <b>0.002</b> back to players as rakeback. That fee is the entire
    edge — about <b>1%</b>, giving an RTP of <b>99%</b>. Nothing else in this
    game takes anything from you.</p>
    <div class="hlp-note">Expected profit is −1% of everything you stake. Every
    other number you see — your streak, your best multiplier, your worst beat —
    is variance. Running better than −1% is luck, not skill. Running worse is
    also luck.</div>
    <p>Bet size cannot change your variance, because every cursor costs the
    same. Only your banking discipline can. Cash at ×2 often and you win small
    often; ride for ×50 and you will lose 49 times in 50 without once being
    cheated.</p>`},

  disk:{t:"Why the computer crashes",group:"Start here",body:()=>{
    const cap=MP.on&&MP.corpses?MP.corpses:64;
    const dead=MP.on?Math.round(MP.fill*cap):binDead.length;
    return `
    <h1>Why the computer crashes</h1>
    <p>Every cursor that dies is written to the hard disk as a <b>12 MB</b>
    file. You can read them: they are in the Recycle Bin, one certificate each.
    Nothing deletes them while the round is running.</p>
    <p>So the disk fills up. When <b>C:</b> is full, CURSORS.EXE cannot write the
    next corpse and it crashes — a real stop error, the blue screen. That is the
    end of the round, and it is the only thing that ends a round. There is no
    timer.</p>
    <h2>The crash cannot cost you money</h2>
    <p>Before the blue screen, <b>every live cursor is banked at full value</b>.
    A few cursors before the disk fills, a shutdown warning appears and all
    cursors are recalled automatically. You keep everything you were carrying.</p>
    <p>This is why it is safe to make the ending predictable: rushing the disk
    just pays everyone else at fair odds.</p>
    <div class="hlp-note">Right now the disk is <b>${Math.round((dead/cap)*100)}% full</b>
    — ${dead} dead cursors of the ${cap} it takes to crash.</div>
    <p>The gauge under the CURSORS.EXE menu bar is that number. So is the pie
    chart in <b>My Computer → Local Disk (C:) → Properties</b>.</p>`;}},

  multi:{t:"The multiplayer beta",group:"Start here",body:()=>`
    <h1>The multiplayer beta</h1>
    <p>This is a <b>play-money beta</b>. Every player starts with 5.000 SOL that
    is not real and cannot be withdrawn. If you go broke, the faucet refills you.
    Nothing here touches a wallet or a chain.</p>
    <p>The arena is shared: the cursors you see belong to other people who are
    connected right now. Open <b>Windows Messenger</b> to see who is here — real
    players are listed above the bots.</p>
    <h2>About the bots</h2>
    <p>Seven bots play continuously so the arena is never empty. They are full
    economic participants under identical rules — same entry, same duel odds, no
    special information. They are listed as bots in the buddy list because
    pretending otherwise would be the one lie this game does not tell.</p>
    <h2>If the connection drops</h2>
    <p>The status line says <b>RECONNECTING</b> and the arena holds still. If the
    server does not come back, you drop into a local offline sandbox — same game,
    fake opponents, nothing shared. It reconnects on its own.</p>`},

  verify:{t:"How to check we are not cheating",group:"Fairness",body:()=>`
    <h1>How to check we are not cheating</h1>
    <p>Before each round the server generates a random seed, and publishes
    <b>sha256(seed)</b> — a fingerprint that cannot be reversed but also cannot
    be faked later. Every duel and every movement draw in that round comes from
    that seed.</p>
    <p>When the round crashes, the server <b>reveals the seed</b>. Hash it
    yourself. If it does not match the fingerprint published beforehand, the
    round was tampered with and you have the proof in your hands.</p>
    <p>Both values are in <b>CURSORS.EXE → Verify</b>, live.</p>
    <h2>What this does and does not prove</h2>
    <p>It proves the outcomes were fixed before play started and were not
    adjusted while watching your bets. It does not yet let you replay the whole
    round offline and re-derive every collision — that needs the full input log
    alongside the seed, and it ships with the real-money engine.</p>
    <div class="hlp-note">We would rather tell you exactly how far the proof
    goes than let you assume it goes further.</div>`},

  rake:{t:"Rakeback, and why it exists",group:"Fairness",body:()=>`
    <h1>Rakeback, and why it exists</h1>
    <p>Every deploy — yours or anyone else's — pays <b>0.002 SOL</b> into a
    rakeback pool and mints the person who deployed <b>200 tickets</b>.</p>
    <p>Your share of every future pool equals your share of all live tickets.
    Tickets decay with a <b>45-day half-life</b>, so the payroll always belongs
    to whoever is playing now rather than to whoever showed up first.</p>
    <p>That 0.002 is two-thirds of the 0.003 fee, which is what turns a 3% take
    into a <b>1% house edge</b> and a 99% RTP. Claim it from
    <b>CURSORS.EXE → Rakeback</b> whenever it is worth claiming.</p>`},

  bin:{t:"The Recycle Bin and death certificates",group:"The desktop",body:()=>`
    <h1>The Recycle Bin and death certificates</h1>
    <p>Every dead cursor files a certificate: what it was carrying, its peak
    value, how long it lived, who killed it, and <b>its odds in the collision
    that killed it</b>.</p>
    <p>So when a 92% favourite dies you get the receipt proving it was 92%.
    Cold comfort, but it is on paper.</p>
    <p><b>Hall of Pain</b> (in the bin's task pane) sorts the graveyard by
    damage and reddens the favourites that lost.</p>`},

  apps:{t:"The rest of the desktop",group:"The desktop",body:()=>`
    <h1>The rest of the desktop</h1>
    <p>Everything on the desktop actually works. Go poke at it.</p>
    <ul>
      <li><b>Internet Explorer</b> — a small handmade web, including cursorTV,
      where the whole lobby watches one video together with a shared queue.</li>
      <li><b>Paint</b> — all sixteen tools, aliased edges. File → Set As
      Background makes wallpaper; File → Publish to Gallery hangs it where every
      player can see it.</li>
      <li><b>Minesweeper</b> — the real rules, including chording.</li>
      <li><b>Winamp</b> — actually Winamp. Ctrl+D for double size.</li>
      <li><b>Windows Messenger</b> — the lobby is real chat with real players.</li>
      <li><b>My Computer</b> — a real C: drive whose free space is the round clock.</li>
    </ul>
    <p>Right-click almost anything. Most of it does what XP did.</p>`},
};
const HELP_ORDER=["start","odds","disk","multi","verify","rake","bin","apps"];
let helpAt="start", helpHist=[];
function renderHelp(){
  const side=$("#hlp-side"); side.innerHTML="";
  let group=null;
  for(const k of HELP_ORDER){
    const h=HELP[k];
    if(h.group!==group){
      group=h.group;
      const g=document.createElement("div");
      g.className="hlp-shead"; g.textContent=group;
      side.appendChild(g);
    }
    const a=document.createElement("a");
    a.textContent=h.t;
    a.className=k===helpAt?"on":"";
    a.addEventListener("click",()=>helpGo(k));
    side.appendChild(a);
  }
  $("#hlp-doc").innerHTML=HELP[helpAt].body();
  $("#hlp-doc").scrollTop=0;
  $("#hlp-back").disabled=!helpHist.length;
}
function helpGo(k,noHist){
  if(!HELP[k]) return;
  if(!noHist&&k!==helpAt) helpHist.push(helpAt);
  helpAt=k; sysSnd("nav",.4); renderHelp();
}
$("#hlp-back").addEventListener("click",()=>{ if(helpHist.length) helpGo(helpHist.pop(),true); });
$("#hlp-home").addEventListener("click",()=>helpGo("start"));
$("#hlp-search").addEventListener("keydown",e=>{
  e.stopPropagation();
  if(e.key!=="Enter") return;
  const q=e.target.value.trim().toLowerCase();
  if(!q) return;
  /* the whole library is eight pages, so a substring scan is the honest search */
  const hit=HELP_ORDER.find(k=>(HELP[k].t+" "+HELP[k].body()).toLowerCase().indexOf(q)>=0);
  if(hit) helpGo(hit);
  else showError("Search",`No Help topic contains "${e.target.value.trim()}".`,true);
});
renderHelp();

/* ================= main loop ================= */
let last=performance.now();
function frame(t){
  const dt=Math.min(.05,(t-last)/1000); last=t;
  if(MP.on){ mpFrame(dt,t); }
  else{
  phaseTick(dt);
  if(phase==="battle"){
    for(const c of [...curs]) if(!c.dead&&c.mode!=="duel") move(c,dt);
  }
  if(phase==="battle"){
    for(let i=0;i<curs.length;i++) for(let j=i+1;j<curs.length;j++){
      const a=curs[i],b=curs[j];
      if(a.dead||b.dead||a.grace>0||b.grace>0) continue;
      if(a.owner===b.owner) continue;
      if(a.mode==="duel"||b.mode==="duel"||a.mode==="hold"||b.mode==="hold") continue;
      const rr=a.r+b.r;
      if((a.x-b.x)**2+(a.y-b.y)**2<rr*rr) startDuel(a,b);
    }
    for(const c of curs){
      if(c.dead||c.mode!=="roam") continue;
      if(!c.isMine&&c.bounty/ENTRY>=c.riskAt&&Math.random()<dt*.5) forceRecall(c);
      if(c.isMine&&auto.on&&auto.bankAt>0&&c.bounty>=auto.bankAt*ENTRY) forceRecall(c);
    }
  }
  }
  if(Math.abs(walletShown-wallet)>.5){
    walletShown+=(wallet-walletShown)*Math.min(1,dt*7);
    if(Math.abs(walletShown-wallet)<.6) walletShown=wallet;
    $("#walletamt").textContent=fmtS(Math.round(walletShown))+" SOL";
    $("#mh-wallet").textContent=fmtS(Math.round(walletShown))+" SOL";
  }
  requestAnimationFrame(frame);
}

/* ================= boot ================= */
syncArena();
renderIcons();
syncAutoHide();
if(store.data.vol){ masterVol=clamp(+store.data.vol.v||0,0,1); muted=!!store.data.vol.m; }
volSync();
setWallpaper(store.data.wallpaper);
renderWplist();
$("#sv-sel").value=store.data.saver.t;
$("#sv-wait").value=store.data.saver.wait;
R=newRoundRecord();
log("CURSORS.EXE started");
explorer.render();
if(MOBILE){
  /* the phone boots to a clean desktop: icons, the arena, and the thumb bar.
     Every app is one tap away; none of them start covering the field. */
  $("#mh-wallet").textContent=fmtS(wallet)+" SOL";
}else{
  /* the desktop boots clean: one window, the game. Messenger and the log are
     one click away and their notifications (toasts, balloons) work closed —
     an opening screen that shows five windows is a cockpit, not an invitation */
  openWin("win-cursors",{silent:true});
  focusWin("win-cursors");
}
chatSys("connected to the lobby.");
syncTaskToolbars();
pushEv(sysEvents,"info","eventlog",6005,"The Event log service was started.");
pushEv(sysEvents,"info","eventlog",6009,"Microsoft (R) Windows (R) 5.01. 2600 Service Pack 2 Uniprocessor Free.");
renderBin(); updatePanel();
startEpoch();
requestAnimationFrame(frame);

/* ================= login / power flow ================= */
let desktopEntered=false;
function desktopActive(){
  return desktopEntered
    &&$("#login").style.display!=="flex"
    &&$("#boot").style.display!=="block"
    &&$("#shutdown").style.display!=="grid";
}
function enterDesktop(){
  desktopEntered=true;
  degauss();
  $("#login").style.opacity="0";
  setTimeout(()=>{
    const lg=$("#login");
    lg.style.display="none"; lg.style.opacity=""; lg.classList.remove("welcoming");
    if(store.data.tourSeen) showBalloon();   /* first visit gets the How to Play card instead */
    else setTimeout(()=>{ try{ tour.open(); }catch(e){} },3200);
    /* MSConfig nags every boot until you put startup back to Normal */
    try{ maint.applyStartup(); }catch(e){}
    setTimeout(()=>{ try{ maint.maybeNag(); }catch(e){} },2600);
  },520);
}
function playStartup(){
  if(muted) return;
  try{
    const a=new Audio(SNDF.startup); a.volume=Math.min(1,vol(.6));
    a.play().catch(()=>{
      /* autoplay blocked: play on the first gesture that isn't already a logon click */
      const once=e=>{
        removeEventListener("pointerdown",once,true);
        if(e.target.closest(".lg-tile")) return;
        try{ const b=new Audio(SNDF.startup); b.volume=Math.min(1,vol(.6)); b.play().catch(()=>{}); }catch(err){}
      };
      addEventListener("pointerdown",once,true);
    });
  }catch(e){}
}
function showLogin(skipStartup){
  const lg=$("#login");
  lg.style.display="flex"; lg.style.opacity=""; lg.classList.remove("welcoming");
  if(!skipStartup) playStartup();
}
function showBootThenLogin(){
  $("#boot").style.display="block";
  /* BOOT.INI is not a prop: /SOS lists the drivers, timeout= is how long this sits here */
  try{ if(maint.verboseBoot()) document.body.classList.add("verbose-boot"); }catch(e){}
  const toLogin=()=>{ $("#boot").style.display="none"; showLogin(); };
  let wait=4300;
  try{ wait=maint.bootWaitMs(); }catch(e){}
  const bt=setTimeout(toLogin,wait);
  $("#boot").addEventListener("pointerdown",()=>{ clearTimeout(bt); toLogin(); },{once:true});
}
/* ---- user identity: picked at the login screen, Phantom wallet later ---- */
function playerName(){ return PLAYER||"admin"; }
function playerNameFull(){ return PLAYER||"Administrator"; }
function syncIdentity(){
  $("#lg-name").textContent=playerNameFull();
  $("#sm-user").textContent=playerNameFull();
  $("#lg-sub").textContent=PLAYER?"click to log on":"click to begin";
}
function logon(){
  sessionStorage.setItem("cxp.booted","1");
  syncIdentity();
  $("#login").classList.add("welcoming");
  chime();
  setTimeout(enterDesktop,1500);
}
function commitUserName(){
  const raw=$("#lg-user").value.trim().replace(/[^\w .$-]/g,"").slice(0,14);
  if(!raw){
    const t=$("#tile-admin");
    t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake");
    sError(); return;
  }
  PLAYER=raw;
  store.data.userName=raw; store.save();
  mpHello();
  logon();
}
$("#tile-admin").addEventListener("click",e=>{
  if(e.target.closest(".lg-inputrow")) return;
  if(PLAYER){ logon(); return; }
  $("#lg-inputrow").style.display="flex";
  $("#lg-sub").textContent="pick a name for the scoreboard";
  $("#lg-user").focus();
});
$("#lg-go").addEventListener("click",commitUserName);
$("#lg-user").addEventListener("keydown",e=>{ if(e.key==="Enter") commitUserName(); });
syncIdentity();
$("#tile-guest").addEventListener("click",()=>{
  const t=$("#tile-guest");
  t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake");
  $("#guest-sub").textContent="gambling requires conviction";
  sError();
});
$("#lg-off").addEventListener("click",()=>{ sysSnd("shutdown",.55); $("#login").style.display="none"; $("#shutdown").style.display="grid"; });
if(location.hash.indexOf("#desktop")===0) sessionStorage.setItem("cxp.booted","1"); /* dev: skip boot/login */
if(location.hash==="#desktop-start") setTimeout(()=>$("#startmenu").classList.add("open"),400); /* dev: capture start menu */
if(location.hash==="#desktop-start-mru") setTimeout(()=>{ /* dev: does the menu reshape around use? */
  openWin("win-help"); openWin("win-mine"); openWin("win-paint");
  minWin("win-help"); minWin("win-mine"); minWin("win-paint");
  $("#startmenu").classList.add("open");
},400);
if(location.hash.indexOf("#desktop-allprog")===0) setTimeout(()=>{ /* dev: the All Programs flyout */
  $("#startmenu").classList.add("open");
  setTimeout(()=>$(".sm-item.allprog").click(),250);
},400);
if(location.hash.indexOf("#desktop-help")===0) setTimeout(()=>{ /* dev: Help and Support Center */
  openWin("win-help");
  const p=location.hash.replace("#desktop-help","").replace("-","");
  if(p) helpGo(p);
},450);
if(location.hash==="#desktop-logfill") setTimeout(()=>{ /* dev: does a long log blow the window out? */
  openWin("win-log");
  for(let i=0;i<60;i++) log("mumu > bobo  +0.097   (line "+i+")");
},500);
if(location.hash.indexOf("#desktop-msn")===0) setTimeout(()=>{ /* dev: capture messenger in use */
  const conv=id=>document.getElementById(msn.convIdFor(id));
  msn.openConv("bobo");
  const c=conv("bobo");
  c.style.left="270px"; c.style.top="70px";
  const ta=c.querySelector("textarea"), send=c.querySelector(".conv-send");
  const type=t=>{ ta.value=t; send.click(); };
  type("gm bobo (H) how bad is it today");
  setTimeout(()=>type("i banked at x2 :P (Y)"),1200);
  if(location.hash==="#desktop-msn-emo")
    setTimeout(()=>c.querySelector(".conv-emo").click(),2600);
  if(location.hash==="#desktop-msn-toast")
    setTimeout(()=>msn.incoming("mumu","you still alive? (bunny)"),2400);
},600);
if(location.hash.indexOf("#desktop-exp")===0) setTimeout(()=>{ /* dev: capture Explorer */
  openWin("win-explorer");
  const p=location.hash.replace("#desktop-exp","");
  if(p==="-c") explorer.go("C:\\");
  if(p==="-sys") explorer.go("C:\\WINDOWS\\system32");
  if(p==="-det"){ explorer.setView("details"); explorer.go("C:\\WINDOWS\\system32"); }
  if(p==="-game") explorer.go("C:\\Program Files\\CURSORS.EXE");
  if(p==="-props"){ explorer.go("C:\\"); setTimeout(()=>explorer.driveProperties(),400); }
  if(p==="-sysprops") setTimeout(()=>{ $("#sp-user").textContent=playerNameFull(); openWin("win-sysprops"); },300);
},600);
if(location.hash.indexOf("#desktop-ie")===0) setTimeout(()=>{ /* dev: capture the handmade web */
  const p=location.hash.replace("#desktop-ie","");
  if(p!=="-dial"&&p!=="-dialgo") ie.connectNow();   /* skip the handshake unless that is the shot */
  openWin("win-ie");
  const to={"-hall":"http://hall.cursor.land/","-guest":"http://guest.cursor.land/",
    "-gallery":"http://gallery.cursor.land/","-404":"http://www.cursortactics.com/",
    "-search":"http://search.msn.com/results?q=gallery"};
  if(to[p]) ie.go(to[p],{replace:true});
  if(p==="-post") setTimeout(()=>{
    ie.go("http://guest.cursor.land/",{replace:true});
    setTimeout(()=>{
      $("#gb-txt").value="testing the guestbook. if you can read this it saved.";
      $("#ie-page").querySelector("[data-act=gb-post]").click();
    },1100);
  },200);
  if(p==="-dialgo") setTimeout(()=>$("#dl-connect").click(),200);   /* dev: the handshake, mid-screech */
  if(p==="-src") setTimeout(()=>{                                    /* dev: View > Source, all the way to Notepad */
    ie.menu("View",300,120);
    const it=[...$("#ctx").children].find(c=>c.textContent==="Source");
    it.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,pointerType:"mouse"}));
  },1400);
},700);
if(location.hash.indexOf("#desktop-mp")===0) setTimeout(()=>{ /* dev: drive the LIVE local server (npm start in server/) */
  PLAYER=PLAYER||("shot"+Math.floor(Math.random()*900+100));
  mpHello();   /* the socket may have opened before the name existed */
  const p=location.hash.replace("#desktop-mp","");
  const when=fn=>{ const w=()=>{ MP.on?fn():setTimeout(w,300); }; w(); };
  if(p==="-play") when(()=>{ deploy(false); setTimeout(()=>deploy(false),500); });
  if(p==="-smooth") when(()=>{   /* TEMP: objective smoothness probe */
    const samples=new Map();
    let frames=0, probeT=0, dts=[];
    const tick=()=>{
      for(const c of mpCurs.values()){
        if(c.mode!=="roam") continue;
        let a=samples.get(c.id); if(!a){ a=[]; samples.set(c.id,a); }
        a.push([probeT,c.x,c.y]);
      }
      if(++frames<220) requestAnimationFrame(tt=>{ probeT=tt; tick(); }); else report();
    };
    const report=()=>{
      const cvs=[],speeds=[];
      for(const a of samples.values()){
        if(a.length<120) continue;
        const sp=[];
        for(let i=1;i<a.length;i++){
          const dt=(a[i][0]-a[i-1][0])/1000;
          if(dt<=0) continue;
          sp.push(Math.hypot(a[i][1]-a[i-1][1],a[i][2]-a[i-1][2])/dt);
        }
        if(sp.length<60) continue;
        const mean=sp.reduce((s,x)=>s+x,0)/sp.length;
        if(mean<5) continue;   /* parked/duelling cursors say nothing about smoothness */
        const sd=Math.sqrt(sp.reduce((s,x)=>s+(x-mean)**2,0)/sp.length);
        cvs.push(sd/mean); speeds.push(mean);
      }
      cvs.sort((x,y)=>x-y);
      const med=a=>a.length?a[Math.floor(a.length/2)]:NaN;
      const D=document.createElement("pre");
      D.style.cssText="position:fixed;left:8px;top:8px;z-index:999999;background:#fff;color:#000;font:12px monospace;padding:10px";
      const one=[...samples.values()][0]||[];
      for(let i=1;i<one.length;i++) dts.push(one[i][0]-one[i-1][0]);
      const mdt=dts.reduce((s,x)=>s+x,0)/Math.max(1,dts.length);
      const dcv=Math.sqrt(dts.reduce((s,x)=>s+(x-mdt)**2,0)/Math.max(1,dts.length))/mdt;
      D.textContent=["SMOOTHNESS PROBE ("+frames+" frames, "+cvs.length+" moving cursors)",
        "frame interval CV   "+(dcv*100).toFixed(1)+"%   (the browser's own jitter — a floor)",
        "median speed        "+med(speeds).toFixed(1)+" px/s   (server range 78-124)",
        "median speed CV     "+(med(cvs)*100).toFixed(1)+"%   (lower = smoother)",
        "worst speed CV      "+((cvs[cvs.length-1]||0)*100).toFixed(1)+"%"].join(String.fromCharCode(10));
      document.body.appendChild(D);
    };
    requestAnimationFrame(tt=>{ probeT=tt; tick(); });
  });
  if(p==="-buddies") when(()=>msn.openList());
  if(p==="-chat") when(()=>{
    msn.openConv("lobby");
    const c=document.getElementById(msn.convIdFor("lobby"));
    c.querySelector("textarea").value="anyone alive in here";
    c.querySelector(".conv-send").click();
  });
  if(p==="-tv"||p==="-gal"||p==="-guest") when(()=>{
    ie.connectNow(); openWin("win-ie");
    ie.go(p==="-tv"?"http://tv.cursor.land/":p==="-gal"?"http://gallery.cursor.land/":"http://guest.cursor.land/",{replace:true});
  });
},700);
if(location.hash==="#desktop-crash") setTimeout(()=>{ /* dev: fast-forward to the shutdown rush and crash */
  phaseT=Math.min(phaseT,T_SHUT+3);
},2500);
if(location.hash.indexOf("#desktop-cx")===0) setTimeout(()=>{ /* dev: capture a CURSORS.EXE pane */
  openWin("win-cursors");   /* the phone boots to a bare desktop */
  const p=location.hash.replace("#desktop-cx-","");
  if(["stats","rake","hist","verify"].indexOf(p)>=0) cxShow("cx-"+p);
  if(p==="hist"||p==="stats"){ /* fake a played session so the pane has flesh */
    stats={kills:4,deaths:2,best:6.2,deploys:11,banks:6,bigBank:601,tIn:1100,tOut:1289};
    epochHist=[
      {no:3,up:"2:41",pot:2140,deploys:22,deaths:9,top:{owner:"mumu",amt:388},net:112,myIn:300},
      {no:2,up:"3:05",pot:1750,deploys:18,deaths:11,top:{owner:playerName(),amt:601},net:301,myIn:300},
      {no:1,up:"1:58",pot:970,deploys:10,deaths:7,top:{owner:"bobo",amt:194},net:-200,myIn:200},
    ];
    renderCx();
  }
  if(p==="jackpot") jackpot(ENTRY*11);   /* dev: the VHS moment */
  if(p==="death"){ /* your last cursor dies -> the feed row, not a window */
    binDead.unshift({id:++deathN,name:playerName(),mine:true,killer:"mumu",killerMine:false,
      lost:485,mult:5,peak:485,odds:71,kills:3,lived:88,round:roundNo,at:"09:41:12"});
    feedKill(binDead[0],true);
  }
},900);
if(location.hash.indexOf("#desktop-dog")===0) setTimeout(()=>{ /* dev: the Search Companion */
  $("#balloon").style.display="none";
  const p=location.hash.replace("#desktop-dog","");
  if(p==="-pick"){ companion.chooser(); return; }
  openWin("win-explorer"); explorer.openSearch();
  if(p==="-found") setTimeout(()=>{ $(".srch-in").value="dll"; $$(".srch-btns .xbtn")[0].click(); },400);
  if(p==="-empty") setTimeout(()=>{ $(".srch-in").value="zzzzz"; $$(".srch-btns .xbtn")[0].click(); },400);
},900);
if(location.hash.indexOf("#desktop-sys")===0) setTimeout(()=>{ /* dev: the XP applications */
  $("#balloon").style.display="none";
  const p=location.hash.replace("#desktop-sys","");
  if(p==="-cmd"||p===""){
    openWin("win-cmd");
    if(p==="-cmd"){ const type=t=>{ for(const ch of t) sys.key({key:ch}); sys.key({key:"Enter"}); };
      setTimeout(()=>{ type("ver"); type("arena"); type("dir"); },300); }
  }
  if(p==="-control") openWin("win-control");
  if(p==="-classic"){ store.data.cplClassic=true; openWin("win-control"); }
  if(p==="-svc") openWin("win-services");
  if(p==="-svcprops") { openWin("win-services"); setTimeout(()=>$$("#svc-list .mmc-row")[2].dispatchEvent(new MouseEvent("dblclick",{bubbles:true})),300); }
  if(p==="-dev") openWin("win-devmgr");
  if(p==="-gp") openWin("win-gpedit");
  if(p==="-gpprops"){ openWin("win-gpedit"); setTimeout(()=>$$("#pol-list .mmc-row")[1].dispatchEvent(new MouseEvent("dblclick",{bubbles:true})),300); }
},900);
if(location.hash==="#desktop-mouse") setTimeout(()=>mouse.open(),300); /* dev: Mouse Properties */
if(location.hash==="#desktop-solitaire") setTimeout(()=>solitaireOpen(),400); /* dev: the classic deck */
if(location.hash==="#desktop-sound") setTimeout(()=>{ /* dev: mixer + recorder + WMP */
  snd.openMixer(); snd.openRecorder(); snd.openWmp();
},400);
if(location.hash==="#desktop-write") setTimeout(()=>{ /* dev: all four writing apps */
  write.openNotepad({title:"session.LOG",get:()=>".LOG\nfirst entry",set:null});
  write.openWordpad(null);
  write.openViewer(viewerList(),0);
  write.openClipbook();
},400);
if(location.hash==="#desktop-fileop") setTimeout(()=>{ /* dev: the copy dialog mid-flight */
  fileOp({title:"Copying...",line:"Copying 6 items to My Documents",
    fromIcon:IMG.openfolder32,toIcon:IMG.docs32,
    items:["Budget.doc","Holiday.bmp","notes.txt","tracks.wav","Backup.zip","readme.rtf"],
    label:x=>x});
},400);
if(location.hash==="#desktop-depth") setTimeout(()=>{ /* dev: the four depth apps at once */
  depth.openDefrag(); depth.openRegedit(); depth.openCalc(); depth.openCharmap();
},400);
if(location.hash.startsWith("#desktop-saver-")) setTimeout(()=>startSaver(location.hash.slice(15)),600); /* dev: any saver fullscreen */
if(location.hash==="#desktop-mouse-bronze") setTimeout(()=>{ /* dev: the gold cursor, applied and visible on the field */
  mouse.applyScheme("bronze");
  setTimeout(()=>{ mouse.open(); $$("#win-mouse .xtab").find(t=>t.dataset.pane==="mo-ptr").click(); },250);
},300);
if(location.hash==="#desktop-vol") setTimeout(()=>{ /* dev: the tray volume flyout */
  $("#balloon").style.display="none"; $("#sndico").click();
},900);
if(location.hash==="#desktop-clock") setTimeout(()=>{ /* dev: Date and Time Properties, real zones */
  $("#balloon").style.display="none"; openClockProps();
},900);
if(location.hash==="#desktop-clock-tz") setTimeout(()=>{ /* dev: the Time Zone tab */
  $("#balloon").style.display="none"; openClockProps();
  setTimeout(()=>$$("#win-datetime .xtab").find(t=>t.dataset.pane==="dt-tz").click(),200);
},900);
if(location.hash.indexOf("#desktop-disk")===0) setTimeout(()=>{ /* dev: the disk at a chosen fill — bar, tray chip, bin icon */
  const pc=parseInt(location.hash.replace("#desktop-disk","").replace("-",""),10);
  localDeaths=Math.round(LOCAL_CORPSES*(isFinite(pc)?pc:50)/100);
  /* a few real certificates so the bin is not "empty" while the drive is full */
  for(let i=0;i<Math.min(6,localDeaths);i++) binDead.push({id:++deathN,name:"bobo",mine:false,
    killer:"mumu",killerMine:false,lost:ENTRY,mult:1,peak:ENTRY,odds:50,kills:0,lived:20,
    round:roundNo,at:"09:41:0"+i});
  renderBin();
  renderPhase();
  $("#balloon").style.display="none";   /* the bin icon is what this shot is for */
},2600);
if(location.hash==="#desktop-binlive") setTimeout(()=>{ /* dev: does the open folder fill up as cursors actually die? */
  openWin("win-explorer"); explorer.go("Recycle Bin"); explorer.setView("details");
},600);
if(location.hash.indexOf("#desktop-bin")===0&&location.hash!=="#desktop-binlive") setTimeout(()=>{ /* dev: capture the Recycle Bin with a body count */
  const names=["mumu","bobo","clippy","bonk","solja","xp_chad","deg404",playerName()];
  for(let i=0;i<9;i++){
    const mult=[1,1,1.9,2.4,3.7,1,6.2,2.1,11.4][i];
    const mine=i===2||i===6;
    binDead.push({id:++deathN,name:mine?playerName():names[i%names.length],mine,
      killer:names[(i+3)%7],killerMine:i===4,lost:Math.round(ENTRY*mult),mult,
      peak:Math.round(ENTRY*mult*1.1),odds:[8,34,71,45,12,58,92,27,19][i],
      kills:[0,1,2,0,3,1,5,0,7][i],lived:[6,19,44,11,71,23,108,15,133][i],
      round:9+i,at:"09:4"+i+":1"+i});
  }
  binFiles.push({id:"user_dev1",label:"screenshot.png",ico:"pics32",app:"usertxt",kind:"txt"});
  openWin("win-explorer"); explorer.go("Recycle Bin");
  const p=location.hash.replace("#desktop-bin","");
  if(p==="-cert") setTimeout(()=>deathCert(binDead[6]),400);
  if(p==="-hall") setTimeout(()=>hallOfPain(),400);
  if(p==="-det") explorer.setView("details");
  /* dev: the two verbs, driven through the task pane exactly as a finger would */
  const task=t=>[...$$("#ex-tasks .ex-task")].find(a=>a.textContent.indexOf(t)>=0);
  if(p==="-empty") setTimeout(()=>task("Empty").click(),400);
  if(p==="-restore") setTimeout(()=>task("Restore").click(),400);
},600);
if(location.hash.indexOf("#desktop-paint")===0) setTimeout(()=>{ /* dev: capture Paint with art on the canvas */
  openWin("win-paint");
  const box=$("#pt-box"), cvv=$("#pt-canvas");
  const at=(x,y)=>{ const r=cvv.getBoundingClientRect(); return {clientX:r.left+x,clientY:r.top+y}; };
  const stroke=(pts,btn)=>{
    const opts={bubbles:true,button:btn||0,pointerId:1,pointerType:"mouse"};
    box.dispatchEvent(new PointerEvent("pointerdown",{...opts,...at(pts[0][0],pts[0][1])}));
    for(const p of pts.slice(1)) box.dispatchEvent(new PointerEvent("pointermove",{...opts,...at(p[0],p[1])}));
    dispatchEvent(new PointerEvent("pointerup",{...opts,...at(pts[pts.length-1][0],pts[pts.length-1][1])}));
  };
  const swatch=hex=>$(`#pt-colors .pt-sw[data-hex="${hex}"]`).click();
  const tool=i=>$$("#pt-tools .pt-tool")[i].click();
  tool(7); swatch("#FF0000");                            /* brush, red */
  stroke([[40,40],[70,90],[110,45],[150,95],[190,50]]);
  tool(14); swatch("#0000FF");                           /* ellipse, blue */
  stroke([[210,40],[300,110]]);
  tool(12); swatch("#008000");                           /* rectangle, green */
  stroke([[40,130],[170,210]]);
  tool(3); swatch("#FFFF00");                            /* fill, yellow */
  stroke([[100,170]]);
  tool(8); swatch("#FF00FF");                            /* airbrush, magenta */
  stroke([[230,150],[250,170],[270,150],[290,180],[250,200]]);
  tool(10); swatch("#000000");                           /* line */
  stroke([[210,230],[330,230]]);
  tool(9);                                               /* text, left on the box */
  if(location.hash==="#desktop-paint-wall"||location.hash==="#desktop-paint-props") setTimeout(()=>{  /* dev: the meme machine, end to end */
    const f=$$("#win-paint .menubar span")[0];
    f.click();
    const items=[...$("#ctx").children].filter(c=>c.classList.contains("cit"));
    const tiled=items.find(c=>c.textContent.indexOf("Tiled")>=0);
    tiled.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,pointerType:"mouse"}));
    minWin("win-paint");
    if(location.hash==="#desktop-paint-props") setTimeout(()=>openWin("win-dispprops"),300);
  },700);
},600);
if(location.hash.indexOf("#desktop-mine")===0) setTimeout(()=>{ /* dev: capture minesweeper mid-game */
  const w=$("#win-mine"); w.style.left="8px"; w.style.top="8px";
  openWin("win-mine");
  if(location.hash!=="#desktop-mine-play") return;
  const g=$("#ms-grid");
  const hit=(el,btn)=>{
    el.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:btn,buttons:btn===2?2:1}));
    el.dispatchEvent(new MouseEvent("mouseup",{bubbles:true,button:btn,buttons:0}));
  };
  const dead=()=>($("#ms-face img").src||"").indexOf("dead")>=0;
  const opens=()=>[...g.children].filter(e=>e.classList.contains("open")).length;
  /* play real games until one survives to a rich board, then stop on it */
  for(let guard=0;guard<400;guard++){
    if(dead()) mine.newGame();
    const hidden=[...g.children].filter(e=>e.className==="ms-c");
    if(!hidden.length){ mine.newGame(); continue; }
    hit(hidden[Math.floor(Math.random()*hidden.length)],0);
    if(!dead()&&opens()>=30) break;
  }
  const hidden=[...g.children].filter(e=>e.className==="ms-c");
  hit(hidden[0],2);                                   /* flag */
  if(hidden[1]){ hit(hidden[1],2); hit(hidden[1],2); } /* flag -> question */
},500);
if(location.hash==="#desktop-amptest"){ /* dev: reproduce the open/close/reopen cycle headlessly */
  const dlog=[];
  const D=document.createElement("pre");
  D.style.cssText="position:fixed;left:8px;top:8px;z-index:999999;background:#fff;color:#000;font:11px monospace;padding:8px;max-width:660px;white-space:pre-wrap";
  document.body.appendChild(D);
  const errs=[];
  const oe=console.error.bind(console);
  console.error=(...a)=>{ errs.push(a.map(String).join(" ").slice(0,160)); oe(...a); };
  const snap=tag=>{
    dlog.push(`[${tag}] entry=${openApps.has("win-amp")} tabs=${$("#tabs").children.length} wrapDisp='${wampWrap()?wampWrap().style.display:"?"}' tracks=${TRACKS.length} errs=${errs.length}`);
    if(errs.length) dlog.push("   last: "+errs[errs.length-1]);
    D.textContent=dlog.join("\n");
  };
  setTimeout(()=>{ snap("pre"); openWin("win-amp"); snap("opened"); },1400);
  setTimeout(()=>{ try{ webamp.close(); }catch(e){ dlog.push("close() threw: "+e); } snap("after-ui-close"); },3200);
  setTimeout(()=>{ openWin("win-amp"); snap("reopened"); },4800);
  setTimeout(()=>{ snap("final"); },6400);
}
if(sessionStorage.getItem("cxp.booted")){
  desktopEntered=true;
  setTimeout(()=>{ if(store.data.tourSeen) showBalloon(); else try{ tour.open(); }catch(e){} },1200);
}else{
  showBootThenLogin();
}
