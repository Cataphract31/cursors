import "xp.css";
import "./style.css";
import WebampImport from "webamp";
import { IMG, SNDF, TRACKS, MINE, EMO, PAINT } from "./assets.js";
import { initMinesweeper } from "./minesweeper.js";
import { initMessenger } from "./messenger.js";
import { initPaint } from "./paint.js";
import { initExplorer } from "./explorer.js";
const Webamp = (WebampImport && WebampImport.default) ? WebampImport.default : WebampImport;

"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const desktop=$("#desktop"), curlayer=$("#curlayer"), fxlayer=$("#fxlayer");
/* the mobile shell: below 760px apps are full-screen sheets (one at a time),
   the taskbar is an app switcher, and the game HUD is a fixed thumb bar.
   Decided once, at boot — the class must be on <body> before W/H are read. */
const MOBILE=innerWidth<760;
if(MOBILE) document.body.classList.add("mobile");
let W=desktop.clientWidth, H=desktop.clientHeight;
addEventListener("resize",()=>{W=desktop.clientWidth;H=desktop.clientHeight;syncArena();});

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
let AC=null, muted=false;
function ac(){ if(!AC) AC=new (window.AudioContext||window.webkitAudioContext)(); return AC; }
function tone(f,dur,type,vol,delay,slide){
  if(muted) return;
  try{
    const c=ac(),t=c.currentTime+(delay||0);
    const o=c.createOscillator(),g=c.createGain();
    o.type=type||"square"; o.frequency.setValueAtTime(f,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+dur);
    g.gain.setValueAtTime(vol||.05,t);
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
function sysSnd(name,vol){
  if(muted) return;
  try{
    const a=new Audio(SNDF[name]);
    a.volume=vol==null?.55:vol;
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
function noiseBurst(dur,vol,delay){
  if(muted) return;
  try{
    const c=ac(), t=c.currentTime+(delay||0);
    const b=c.createBuffer(1,Math.max(1,Math.floor(c.sampleRate*dur)),c.sampleRate);
    const d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    const n=c.createBufferSource(); n.buffer=b;
    const g=c.createGain(); g.gain.value=vol;
    n.connect(g).connect(c.destination); n.start(t);
  }catch(e){}
}
const sCrunch=()=>sysSnd("recycle",.6);
const chime  =()=>sysSnd("logon",.7);
addEventListener("pointerdown",()=>{ if(AC&&AC.state==="suspended") AC.resume(); },{capture:true});
$("#sndico").addEventListener("click",()=>{ muted=!muted; $("#sndico").classList.toggle("muted",muted); });

/* ================= shell persistence ================= */
const store={
  data:{},
  load(){
    try{ this.data=JSON.parse(localStorage.getItem("cursorsxp")||"{}"); }catch(e){ this.data={}; }
    this.data.icons=this.data.icons||{};
    this.data.wins=this.data.wins||{};
    this.data.userIcons=this.data.userIcons||[];
    this.data.texts=this.data.texts||{};
    this.data.wallpaper=this.data.wallpaper||"bliss";
    this.data.saver=this.data.saver||{t:"stars",wait:3};
  },
  save(){ clearTimeout(this._t); this._t=setTimeout(()=>{ try{ localStorage.setItem("cursorsxp",JSON.stringify(this.data)); }catch(e){} },250); }
};
store.load();
/* identity lives up here: the Messenger reads it while it boots */
let PLAYER=store.data.userName||null;

/* ================= real XP assets into the static shell ================= */
function icoNode(key){
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
function showWamp(){ const w=wampWrap(); if(w) w.style.display=""; }
function hideWamp(){ const w=wampWrap(); if(w) w.style.display="none"; }
function wampHidden(){ const w=wampWrap(); return !w||w.style.display==="none"; }
let zTop=100, focusedId=null;
const openApps=new Map();
const NOTAB=new Set(["win-logoff","win-shutdown","win-error","win-confirm","win-props","win-run","win-cert"]);
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
function renderTaskbar(){
  const host=$("#tabs"); host.innerHTML="";
  for(const [id,a] of openApps){
    if(a.notab) continue;
    const tab=document.createElement("button");
    tab.className="task-tab"+(id===focusedId&&!a.min?" on":"");
    tab.dataset.win=id;
    tab.innerHTML=`${a.icon}<span></span>`;
    tab.querySelector("span").textContent=tabTitle(id);
    tab.addEventListener("click",()=>tabClick(id));
    host.appendChild(tab);
    a.tabEl=tab;
  }
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
function openWin(id,opts){
  if(id==="win-amp"){ winampApp.open(); return; }
  opts=opts||{};
  const el=document.getElementById(id);
  const was=openApps.has(id);
  if(!was&&!el._rectApplied){ applyWinRect(el); el._rectApplied=true; }
  el.style.display="flex";
  if(!was){
    openApps.set(id,{el,min:false,notab:NOTAB.has(id),icon:tabIconHTML(id)});
    if(id==="win-chat"&&!opts.silent) sysSnd("msnOnline",.5);
  }
  else if(openApps.get(id).min){ restoreWin(id); return; }
  requestAnimationFrame(()=>fitWin(el));
  focusWin(id);
  if(id==="win-run") setTimeout(()=>{ const i=$("#run-in"); i.value=""; i.focus(); },0);
}
/* no window may hang off the screen — the small-screen safety net */
function fitWin(el){
  if(!el||el.classList.contains("maxed")) return;
  if(MOBILE&&!el.classList.contains("fixed")) return; /* sheets: CSS owns the rect */
  const r=el.getBoundingClientRect();
  if(!r.width&&!r.height) return;
  if(r.height>H-6) el.style.height=(H-10)+"px";
  const h=Math.min(r.height,H-10), w=Math.min(r.width,W-4);
  if(r.width>W-4) el.style.width=w+"px";
  if(MOBILE){ /* dialogs on the phone: centered, upper third, clear of the HUD */
    el.style.left=Math.max(2,Math.round((W-w)/2))+"px";
    el.style.top=Math.max(8,Math.round((H-h)/3))+"px";
    return;
  }
  if(r.top+h>H-2||r.top<0) el.style.top=clamp(H-h-2,0,Math.max(0,H-h-2))+"px";
  if(r.left+w>W-2) el.style.left=Math.max(2,W-w-2)+"px";
  if(r.left<0) el.style.left="2px";
}
function restoreWin(id){
  const a=openApps.get(id); if(!a) return;
  if(a.kind==="webamp"){ if(a.min) tabClick(id); return; }
  a.min=false;
  a.el.style.display="flex";
  a.el.style.opacity="0"; a.el.style.transform="scale(.92)";
  requestAnimationFrame(()=>{
    a.el.style.transition="transform .12s ease-out,opacity .12s ease-out";
    a.el.style.opacity=""; a.el.style.transform="";
    setTimeout(()=>{ a.el.style.transition=""; },140);
  });
  sysSnd("restore",.5);
  focusWin(id);
}
function closeWin(id,opts){
  if(id==="win-amp"){ winampApp.close(); return; }
  const a=openApps.get(id); if(!a) return;
  if(id==="win-mine") mine.pause(); /* the clock does not run while the box is shut */
  if(id==="win-paint") paint.commit(); /* half-finished text/curves/selections land before the lid shuts */
  a.el.style.display="none"; a.el.classList.remove("focused");
  openApps.delete(id);
  if(focusedId===id) focusedId=null;
  renderTaskbar();
}
function minWin(id){
  const a=openApps.get(id); if(!a||a.min) return;
  if(a.kind==="webamp"){ tabClick(id); return; }
  a.min=true;
  if(focusedId===id) focusedId=null;
  renderTaskbar();
  const el=a.el, r=el.getBoundingClientRect();
  let tx=40;
  if(a.tabEl){ const tr=a.tabEl.getBoundingClientRect(); tx=tr.left+tr.width/2; }
  el.style.transition="transform .17s ease-in,opacity .17s ease-in";
  el.style.transformOrigin="0 100%";
  el.style.transform=`translate(${tx-r.left}px,${H-r.top}px) scale(.06)`;
  el.style.opacity="0";
  sMini();
  setTimeout(()=>{ el.style.display="none"; el.style.transition=""; el.style.transform=""; el.style.opacity=""; el.style.transformOrigin=""; },180);
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
/* a "sheet" is a real app window; .fixed dialogs float above the sheet */
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
  }
  zTop++; focusedId=id;
  for(const [k,a] of openApps){
    if(a.kind==="webamp") continue;
    const on=k===id;
    a.el.classList.toggle("focused",on);
    a.el.classList.toggle("inactive",!on);
    tbInactive(a.el,!on);
  }
  const el=document.getElementById(id);
  if(el) el.style.zIndex=zTop;
  renderTaskbar();
}
const CURMAP={n:"n-resize",s:"s-resize",e:"e-resize",w:"w-resize",ne:"ne-resize",nw:"nw-resize",se:"se-resize",sw:"sw-resize"};
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
  w.addEventListener("pointerdown",()=>{ if(openApps.has(w.id)) focusWin(w.id); });
  const tb=w.querySelector(".title-bar");
  const btnMin=w.querySelector('.title-bar-controls button[aria-label="Minimize"]');
  const btnClose=w.querySelector('.title-bar-controls button[aria-label="Close"]');
  if(btnMin) btnMin.addEventListener("click",e=>{e.stopPropagation();minWin(w.id);});
  if(btnClose) btnClose.addEventListener("click",e=>{e.stopPropagation();closeWin(w.id);});
  if(!MOBILE&&!w.classList.contains("fixed")&&btnClose){
    const btnMax=document.createElement("button");
    btnMax.setAttribute("aria-label","Maximize");
    btnClose.before(btnMax);
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
      const mv=ev=>{
        let left=r.left, top=r.top, width=r.width, height=r.height;
        const dx=ev.clientX-sx, dy=ev.clientY-sy;
        if(d.includes("e")) width=Math.max(minw,r.width+dx);
        if(d.includes("s")) height=Math.max(minh,r.height+dy);
        if(d.includes("w")){ width=Math.max(minw,r.width-dx); left=r.left+(r.width-width); }
        if(d.includes("n")){ height=Math.max(minh,r.height-dy); top=r.top+(r.height-height); }
        w.style.left=left+"px"; w.style.top=top+"px"; w.style.width=width+"px"; w.style.height=height+"px";
      };
      const up=()=>{ reszActive=null; removeEventListener("pointermove",mv); removeEventListener("pointerup",up); saveWinRect(w); };
      addEventListener("pointermove",mv); addEventListener("pointerup",up);
    },true);
  }
  tb.addEventListener("pointerdown",e=>{
    if(e.target.closest(".title-bar-controls")) return;
    if(w.classList.contains("maxed")) return;
    if(MOBILE&&!w.classList.contains("fixed")) return; /* sheets don't drag */
    const r=w.getBoundingClientRect(), dx=e.clientX-r.left, dy=e.clientY-r.top;
    const move=ev=>{
      w.style.left=clamp(ev.clientX-dx,-r.width+80,W-40)+"px";
      w.style.top=clamp(ev.clientY-dy,0,H-30)+"px";
    };
    const up=()=>{removeEventListener("pointermove",move);removeEventListener("pointerup",up);saveWinRect(w);};
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
];
const CELLW=84, CELLH=86, GX=12, GY=8;
let curTxtIcon=null, binFiles=[];
function allIcons(){ return SYSICONS.concat(store.data.userIcons); }
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
  const host=$("#icons"); host.innerHTML="";
  for(const ic of allIcons()){
    const p=posOf(ic);
    const el=document.createElement("div");
    el.className="icon"; el.dataset.iid=ic.id;
    el.style.left=(GX+p.c*CELLW)+"px"; el.style.top=(GY+p.r*CELLH)+"px";
    el.appendChild(icoNode(ic.ico));
    const lbl=document.createElement("div"); lbl.className="lbl"; lbl.textContent=ic.label;
    el.appendChild(lbl);
    hookIcon(el,ic);
    host.appendChild(el);
  }
}
function selectOnly(el){ $$(".icon").forEach(i=>i.classList.remove("sel")); if(el) el.classList.add("sel"); }
function hookIcon(el,ic){
  el.addEventListener("pointerdown",e=>{
    if(e.button===2){ selectOnly(el); return; }
    e.stopPropagation();
    selectOnly(el);
    const sx=e.clientX, sy=e.clientY;
    const ox=parseFloat(el.style.left), oy=parseFloat(el.style.top);
    let moved=false;
    const mv=ev=>{
      const dx=ev.clientX-sx, dy=ev.clientY-sy;
      if(!moved&&dx*dx+dy*dy<25) return;
      moved=true; el.style.opacity=".6"; el.style.zIndex="90";
      el.style.left=(ox+dx)+"px"; el.style.top=(oy+dy)+"px";
    };
    const up=()=>{
      removeEventListener("pointermove",mv); removeEventListener("pointerup",up);
      el.style.opacity=""; el.style.zIndex="";
      if(!moved){
        /* on the phone the desktop is a launcher: one tap opens (unless this
           release is the tail end of a long-press that already opened a menu) */
        if(MOBILE&&e.pointerType==="touch"&&performance.now()-lpFiredAt>600) openIcon(ic);
        return;
      }
      const maxC=Math.max(0,Math.floor((W-GX-72)/CELLW));
      const maxR=Math.max(0,Math.floor((H-GY-84)/CELLH));
      let c=clamp(Math.round((parseFloat(el.style.left)-GX)/CELLW),0,maxC);
      let r=clamp(Math.round((parseFloat(el.style.top)-GY)/CELLH),0,maxR);
      let guard=0;
      while(!cellFree(c,r,ic.id)&&guard++<300){ r++; if(r>maxR){ r=0; c=c+1>maxC?0:c+1; } }
      store.data.icons[ic.id]={c,r}; store.save();
      renderIcons();
    };
    addEventListener("pointermove",mv); addEventListener("pointerup",up);
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
  }else if(ic.app==="folder"){
    openFolderWin(ic.label);
  }else if(ic.app==="usertxt"){
    curTxtIcon=ic;
    $("#win-usertxt .title-bar-text").textContent=ic.label+" - Notepad";
    $("#usertxtarea").value=store.data.texts[ic.id]||"";
    openWin("win-usertxt");
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
    e.stopPropagation();
    if(e.key==="Enter") commit();
    if(e.key==="Escape"){ done=true; renderIcons(); }
  });
  inp.addEventListener("blur",commit);
  inp.addEventListener("pointerdown",e=>e.stopPropagation());
}
function deleteIcon(ic){
  /* the whole icon goes in the bin, not just its name — otherwise Restore
     has nothing to put back, and a Recycle Bin that cannot restore is a joke */
  binFiles.unshift(Object.assign({},ic));
  store.data.userIcons=store.data.userIcons.filter(u=>u.id!==ic.id);
  delete store.data.icons[ic.id];
  store.save(); renderBin(); renderIcons(); sCrunch();
}
function arrangeIcons(shuffle){
  const list=allIcons().slice();
  if(shuffle) list.sort(()=>Math.random()-.5);
  else list.sort((a,b)=>a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
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
  selectOnly(null);
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
      el.classList.toggle("sel",hit);
    }
  };
  const up=()=>{marquee.style.display="none";removeEventListener("pointermove",move);removeEventListener("pointerup",up);};
  addEventListener("pointermove",move); addEventListener("pointerup",up);
});

/* ================= shared dialogs ================= */
let confirmCb=null;
function showError(title,text,quiet){
  $("#win-error .title-bar-text").textContent=title;
  $("#errtext").textContent=text;
  openWin("win-error",{silent:true});
  if(!quiet) sError();
}
function showConfirm(title,text,cb){
  $("#win-confirm .title-bar-text").textContent=title;
  $("#conftext").textContent=text;
  confirmCb=cb; openWin("win-confirm");
}
function showProps(ic){
  const host=$("#prop-ico"); host.innerHTML=""; host.appendChild(icoNode(ic.ico));
  $("#prop-name").textContent=ic.label;
  const type=ic.sys?"System file":(ic.kind==="folder"?"File Folder":"Text Document");
  $("#prop-rows").innerHTML=`Type: <b>${type}</b><br>Location: <b>C:\\Desktop</b><br>Size: <b>4.00 KB (4,096 bytes of nostalgia)</b><br>Created: <b>Tuesday, August 24, 2001</b>`;
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
    (binDead.length?`\n\n${binDead.length} of them are cursors worth ${fmtS(worth)} SOL when they died. Deleting the file does not give it back.`:""),
    ()=>{ binDead=[]; binFiles=[]; renderBin(); sCrunch(); });
}

/* ================= context menus ================= */
const ctx=$("#ctx");
let menuShownAt=0; /* a long-press opens the menu under the finger — the release must not pick an item */
function buildMenu(host,items){
  for(const it of items){
    if(it.sep){ const s=document.createElement("div"); s.className="csep"; host.appendChild(s); continue; }
    const d=document.createElement("div");
    d.className="cit"+(it.disabled?" dis":"")+(it.bold?" bold":"")+(it.check?" chk":"");
    d.textContent=it.label;
    if(it.sub){
      d.classList.add("has-sub");
      const sub=document.createElement("div"); sub.className="csub";
      buildMenu(sub,it.sub); d.appendChild(sub);
    }
    if(!it.disabled&&it.action) d.addEventListener("pointerup",e=>{
      if(e.pointerType==="touch"&&performance.now()-menuShownAt<400) return;
      e.stopPropagation(); hideMenu(); sClick(); it.action();
    });
    host.appendChild(d);
  }
}
function showMenu(items,x,y){
  menuShownAt=performance.now();
  ctx.innerHTML=""; buildMenu(ctx,items);
  ctx.style.display="block"; ctx.style.left="0px"; ctx.style.top="0px";
  const r=ctx.getBoundingClientRect();
  ctx.style.left=Math.min(x,innerWidth-r.width-4)+"px";
  ctx.style.top=Math.min(y,innerHeight-r.height-4)+"px";
  sMenu();
}
function hideMenu(){ ctx.style.display="none"; }
addEventListener("pointerdown",e=>{ if(!e.target.closest("#ctx")) hideMenu(); },true);
function desktopMenu(){
  return [
    {label:"Arrange Icons By",sub:[
      {label:"Name",action:()=>arrangeIcons(false)},
      {label:"Vibes",action:()=>arrangeIcons(true)},
      {sep:1},
      {label:"Auto Arrange",action:()=>arrangeIcons(false)}]},
    {label:"Refresh",action:refreshDesktop},
    {sep:1},
    {label:"Paste",disabled:1},
    {label:"Paste Shortcut",disabled:1},
    {sep:1},
    {label:"New",sub:[
      {label:"Folder",action:newFolder},
      {label:"Text Document",action:newTextDoc},
      {label:"Cursor (0.1 SOL)",action:()=>{ openWin("win-cursors"); deploy(false); }}]},
    {sep:1},
    {label:"Properties",action:()=>openWin("win-dispprops")}
  ];
}
function iconMenu(ic){
  const items=[{label:"Open",bold:1,action:()=>openIcon(ic)}];
  if(ic.id==="recycle"){
    items.push({label:"Empty Recycle Bin",action:emptyBin});
    items.push({label:"Hall of Pain",action:()=>hallOfPain()});
  }
  if(ic.id==="computer") items.push({label:"Explore",action:()=>{ openWin("win-explorer"); explorer.go("C:\\"); }});
  items.push({sep:1});
  if(ic.sys){
    items.push({label:"Delete",action:()=>showError("Cannot Delete "+ic.label,"This is a system file. The desktop needs it more than you do.")});
    items.push({label:"Rename",action:()=>showError("Cannot Rename "+ic.label,"System files keep their names. It builds character.")});
  }else{
    items.push({label:"Delete",action:()=>deleteIcon(ic)});
    items.push({label:"Rename",action:()=>startRename(ic)});
  }
  items.push({sep:1},{label:"Properties",action:()=>showProps(ic)});
  return items;
}
function winMenu(id){
  if(id==="win-amp") return [{label:"Close",bold:1,action:()=>closeWin("win-amp")}];
  const el=document.getElementById(id);
  const fixed=el.classList.contains("fixed");
  return [
    {label:"Restore",disabled:!el.classList.contains("maxed"),action:()=>maxWin(id)},
    {label:"Move",disabled:1},
    {label:"Size",disabled:fixed},
    {label:"Minimize",disabled:NOTAB.has(id),action:()=>minWin(id)},
    {label:"Maximize",disabled:fixed,action:()=>maxWin(id)},
    {sep:1},
    {label:"Close",bold:1,action:()=>closeWin(id)}
  ];
}
function taskbarMenu(){
  return [
    {label:"Toolbars",disabled:1},
    {sep:1},
    {label:"Cascade Windows",action:cascadeWins},
    {label:"Show the Desktop",action:showDesktopToggle},
    {sep:1},
    {label:"Task Manager",action:()=>openWin("win-taskmgr")},
    {sep:1},
    {label:"Lock the Taskbar",disabled:1},
    {label:"Properties",disabled:1}
  ];
}
function trayMenu(){
  return [
    {label:"Adjust Date/Time",action:()=>openWin("win-datetime")},
    {sep:1},
    {label:"Customize Notifications",disabled:1}
  ];
}

/* ---- menu bars actually drop menus ---- */
function menubarMenu(label,id){
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
      label:n,check:$("#"+P[n]).classList.contains("on"),action:()=>cxShow(P[n])}));
    if(label==="Help") return [
      {label:"How it works",action:()=>openWin("win-readme")},
      {label:"Verify fairness",action:()=>cxShow("cx-verify")},
      {sep:1},
      {label:"About CURSORS.EXE",action:()=>showError("About CURSORS.EXE",
        "CURSORS.EXE · version 5.1 (Build 2600.casino)\nRTP 99% · P(reach ×N)=1/N · the edge is the fee.\nThis product is licensed to: whoever is losing right now.",true)}];
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
        "CURSORS XP · version 5.1 (Build 2600.casino)\nThis product is licensed to: whoever is losing right now.",true)}];
  }
  return [{label:"(nothing here)",disabled:1}];
}
$$(".menubar span").forEach(m=>m.addEventListener("click",e=>{
  e.stopPropagation();
  const win=m.closest(".window"); if(!win) return;
  const r=m.getBoundingClientRect();
  if(win.id==="win-mine"){
    (m.textContent==="Game"?mine.gameMenu:mine.helpMenu)(r.left,r.bottom+2);
    return;
  }
  if(win.id==="win-paint"){ paint.menu(m.textContent,r.left,r.bottom+2); return; }
  if(win.id==="win-explorer"){ explorer.menu(m.textContent,r.left,r.bottom+2); return; }
  showMenu(menubarMenu(m.textContent,win.id),r.left,r.bottom+2);
}));

/* ================= Minesweeper ================= */
const mine=initMinesweeper({
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
  store, sysSnd, showError, showMenu, showConfirm,
  setWallpaperFrom,
  close:()=>closeWin("win-paint"),
  setTitle:name=>{ $("#win-paint .title-bar-text").textContent=name+" - Paint"; renderTaskbar(); },
  isFocused:()=>focusedId==="win-paint",
  openAttributes:(w,h)=>{ $("#pa-w").value=w; $("#pa-h").value=h; openWin("win-paintattr"); },
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
const explorer=initExplorer({
  IMG,
  els:{
    list:$("#ex-list"), tasks:$("#ex-tasks"), addr:$("#ex-addr"), addrico:$("#ex-addrico"),
    addrGo:$("#ex-go"), back:$("#ex-back"), fwd:$("#ex-fwd"), up:$("#ex-up"),
    viewsBtn:$("#ex-views"), foldersBtn:$("#ex-folders"), searchBtn:$("#ex-search"),
    st1:$("#ex-st1"), st2:$("#ex-st2"), st3:$("#ex-st3"),
  },
  store, sysSnd, showMenu, showError, icoNode,
  setTitle:name=>{ $("#win-explorer .title-bar-text").textContent=name; renderTaskbar(); },
  hooks:{
    openWin, close:()=>closeWin("win-explorer"),
    playerName:()=>playerNameFull(),
    openStart:()=>startmenu.classList.add("open"),
    openIcon:ic=>openIcon(ic),
    desktopFiles:()=>allIcons(),
    deadCount:()=>binDead.length,
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
    openPicture:p=>{ openWin("win-paint"); paint.loadDataURL(p.data,true); },
    systemProperties:()=>{ $("#sp-user").textContent=playerNameFull(); openWin("win-sysprops"); },
    openDriveProps:info=>{
      $("#dv-used").textContent=info.usedStr;
      $("#dv-free").textContent=info.freeStr;
      $("#dv-cap").textContent=info.totalStr;
      $("#dv-barfill").style.width=(100*info.used/info.total).toFixed(1)+"%";
      $("#dv-note").textContent=info.dead
        ? `${info.dead} dead cursors are stored on this volume. They are why it is filling up.`
        : "This disk is mostly empty. Nothing has died yet.";
      openWin("win-driveprops");
      requestAnimationFrame(()=>info.draw($("#dv-pie")));
    },
  },
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
  const icon=e.target.closest(".icon");
  const tb=e.target.closest(".title-bar");
  const tab=e.target.closest(".task-tab");
  const tray=e.target.closest("#tray");
  const bar=e.target.closest("#taskbar");
  const win=e.target.closest(".window");
  if(icon){ const ic=iconById(icon.dataset.iid); if(ic){ selectOnly(icon); showMenu(iconMenu(ic),e.clientX,e.clientY); } }
  else if(tb){ const w=tb.closest(".window"); showMenu(winMenu(w.id),e.clientX,e.clientY); }
  else if(tab){ showMenu(winMenu(tab.dataset.win),e.clientX,e.clientY); }
  else if(tray){ showMenu(trayMenu(),e.clientX,e.clientY); }
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
    const cell=target.closest&&target.closest(".ms-c");
    if(cell){ /* Minesweeper: long-press plants a flag (its cells speak mousedown) */
      cell.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:2,buttons:2,clientX:sx,clientY:sy}));
      cell.dispatchEvent(new MouseEvent("mouseup",{bubbles:true,button:2,clientX:sx,clientY:sy}));
    }else{
      target.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:sx,clientY:sy}));
    }
  },550);
  const cleanup=()=>{
    removeEventListener("pointermove",onMove,true);
    removeEventListener("pointerup",onEnd,true);
    removeEventListener("pointercancel",onEnd,true);
    removeEventListener("contextmenu",onNative,true);
  };
  const onMove=ev=>{
    const dx=ev.clientX-sx, dy=ev.clientY-sy;
    if(dx*dx+dy*dy>81){ clearTimeout(t); cleanup(); } /* moved: it's a drag/scroll */
  };
  const onEnd=()=>{ clearTimeout(t); cleanup(); };
  addEventListener("pointermove",onMove,true);
  addEventListener("pointerup",onEnd,true);
  addEventListener("pointercancel",onEnd,true);
},true);
/* the release of a long-press must not ALSO left-click (compat mouse events) */
addEventListener("touchend",e=>{
  if(performance.now()-lpFiredAt<700) e.preventDefault();
},{capture:true,passive:false});

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
function cascadeWins(){
  let i=0;
  for(const [id,a] of openApps){
    if(NOTAB.has(id)||a.kind==="webamp") continue;
    if(a.min){ a.min=false; a.el.style.display="flex"; }
    a.el.classList.remove("maxed");
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
$("#startbtn").addEventListener("click",e=>{ e.stopPropagation(); sClick(); startmenu.classList.toggle("open"); });
addEventListener("pointerdown",e=>{ if(!e.target.closest("#startmenu,#startbtn")) closeStart(); });
addEventListener("keydown",e=>{
  if(e.key==="Escape"){ closeStart(); hideMenu(); }
  if(e.ctrlKey&&e.shiftKey&&e.key==="Escape"){ openWin("win-taskmgr"); }
});
function allProgramsMenu(){
  const go=id=>()=>{ closeStart(); sysSnd("nav",.5); openWin(id); };
  return [
    {label:"CURSORS.EXE",bold:1,action:go("win-cursors")},
    {label:"Internet Explorer",action:go("win-ie")},
    {label:"Windows Messenger",action:go("win-chat")},
    {label:"Winamp",action:go("win-amp")},
    {sep:1},
    {label:"Accessories",sub:[
      {label:"Notepad",action:go("win-readme")},
      {label:"Paint",action:go("win-paint")},
      {label:"Calculator",action:()=>{ closeStart(); showError("Calculator","Cannot compute expected value: it is zero. It is always zero. Read the README."); }}]},
    {label:"Games",sub:[
      {label:"Minesweeper",action:go("win-mine")},
      {label:"Solitaire",action:()=>{ closeStart(); showError("Solitaire","You are already gambling."); }}]},
    {sep:1},
    {label:"Windows Update",action:()=>{ closeStart(); showError("Windows Update","0 critical updates available. The house is already patched."); }},
  ];
}
function smAction(act,itemEl){
  switch(act){
    case "email": showError("Outlook Express","No mail account is configured. Nobody writes anymore. Try the Messenger."); break;
    case "wmp": showError("Windows Media Player","Another application (winamp.exe) has exclusive control of the llama."); break;
    case "mydocs": openFolderWin("My Documents"); break;
    case "mypics": openFolderWin("My Pictures"); break;
    case "connect": showError("Network Connections","Dial-up to Solana Mainnet: no dial tone. Ships with the chain update."); break;
    case "printers": showError("Printers and Faxes","CURSORS-PRINTER is out of ink. It was printing money."); break;
    case "search": showError("Search Companion","The puppy looked everywhere. Whatever you lost is in the Recycle Bin."); break;
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
  "cursors":"win-cursors","cursors.exe":"win-cursors",
  "taskmgr":"win-taskmgr","taskmgr.exe":"win-taskmgr",
  "winamp":"win-amp","winamp.exe":"win-amp",
  "msnmsgr":"win-chat","msmsgs":"win-chat",
  "iexplore":"win-ie","iexplore.exe":"win-ie",
  "notepad":"win-readme","notepad.exe":"win-readme",
  "winmine":"win-mine","winmine.exe":"win-mine",
  "mspaint":"win-paint","mspaint.exe":"win-paint","paint":"win-paint","pbrush":"win-paint",
  "control":"win-dispprops","desk.cpl":"win-dispprops",
  "explorer":"win-explorer","explorer.exe":"win-explorer","c:":"win-explorer","sysdm.cpl":"win-sysprops",
  "timedate.cpl":"win-datetime",
};
function runCommand(){
  const v=$("#run-in").value.trim();
  closeWin("win-run");
  if(!v) return;
  const k=v.toLowerCase();
  if(RUNMAP[k]){ sysSnd("nav",.5); openWin(RUNMAP[k]); return; }
  if(k==="cmd"||k==="cmd.exe"||k==="command"){ showError("cmd.exe","The console subsystem ships in the next update. The house always ships."); return; }
  if(k==="gpedit.msc"){ showError("Group Policy","You do not have permission to edit Group Policy. The house edge is a policy."); return; }
  if(k==="devmgmt.msc"){ showError("Device Manager","1 unknown device detected: your luck. Driver ships in the next update."); return; }
  if(k==="regedit"||k==="regedit.exe"){ showError("Registry Editor","HKEY_CURRENT_LOSER is locked by another process."); return; }
  if(k==="format c:"||k==="format c"){ showError("Format Local Disk (C:)","The disk is in use by CURSORS.EXE. Your losses are load-bearing and cannot be erased."); return; }
  showError("Run","Windows cannot find '"+v+"'. Make sure you typed the name correctly, and then try again.");
}
$("#run-ok").addEventListener("click",runCommand);
$("#run-cancel").addEventListener("click",()=>closeWin("win-run"));
$("#run-browse").addEventListener("click",()=>showError("Browse","There is nothing else. This is the whole computer."));
$("#run-in").addEventListener("keydown",e=>{ e.stopPropagation(); if(e.key==="Enter") runCommand(); if(e.key==="Escape") closeWin("win-run"); });
$("#btn-logoff-no").addEventListener("click",()=>{ sClick(); closeWin("win-logoff"); });
function tickClock(){ $("#clock").textContent=new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}); }
tickClock(); setInterval(tickClock,10000);
let balloonT=null;
function showBalloon(head,text){
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
  store.data.wallpaperData=dataUrl;
  store.data.wallpaperMode=mode||"center";
  wpSel="painted";
  setWallpaper("painted");
  renderWplist();
  log("wallpaper set from Paint ("+store.data.wallpaperMode+")");
  showBalloon("Your desktop has been redecorated","Right-click the desktop → Properties to put Bliss back.");
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
$("#dp-apply").addEventListener("click",()=>{ setWallpaper(wpSel); applySaverUI(); sClick(); });
$("#dp-ok").addEventListener("click",()=>{ setWallpaper(wpSel); applySaverUI(); closeWin("win-dispprops"); });
$("#dp-cancel").addEventListener("click",()=>{ wpSel=store.data.wallpaper; renderWplist(); closeWin("win-dispprops"); });
$("#sv-test").addEventListener("click",()=>{ applySaverUI(); if($("#sv-sel").value!=="none") startSaver($("#sv-sel").value); });

/* ================= screensavers ================= */
const saverCv=$("#saver");
let saverOn=false, saverRaf=0, saverState=null, saverStartAt=0, lastAct=performance.now();
["pointermove","pointerdown","keydown","wheel"].forEach(ev=>addEventListener(ev,()=>{
  lastAct=performance.now();
  if(saverOn&&performance.now()-saverStartAt>450) stopSaver();
},{passive:true}));
function saverInit(type,w,h){
  const st={type,w,h};
  if(type==="stars") st.stars=Array.from({length:160},()=>({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random()*.9+.1}));
  if(type==="ribbons") st.rib=Array.from({length:3},(_,i)=>({pts:[],x:Math.random()*w,y:Math.random()*h,a:Math.random()*6.28,hue:i*120}));
  if(type==="bounce") st.b={x:w/2,y:h/2,dx:2.2,dy:1.7,hue:180};
  return st;
}
function saverFrame(cv,g,st,dt){
  const w=cv.width,h=cv.height;
  if(st.type==="stars"){
    g.fillStyle="rgba(0,0,0,.5)"; g.fillRect(0,0,w,h);
    g.fillStyle="#fff";
    for(const s of st.stars){
      s.z-=dt*.28;
      if(s.z<=.05){ s.x=Math.random()*2-1; s.y=Math.random()*2-1; s.z=1; }
      const px=w/2+s.x/s.z*w*.5, py=h/2+s.y/s.z*h*.5;
      const r=Math.max(.4,(1-s.z)*2.4*(w/800+.4));
      if(px>=0&&px<w&&py>=0&&py<h){ g.beginPath(); g.arc(px,py,r,0,6.28); g.fill(); }
    }
  }else if(st.type==="ribbons"){
    g.fillStyle="rgba(0,0,0,.06)"; g.fillRect(0,0,w,h);
    for(const rb of st.rib){
      rb.a+=(Math.random()-.5)*.55;
      rb.x+=Math.cos(rb.a)*95*dt*(w/500+.3); rb.y+=Math.sin(rb.a)*95*dt*(w/500+.3);
      if(rb.x<0||rb.x>w) rb.a=Math.PI-rb.a;
      if(rb.y<0||rb.y>h) rb.a=-rb.a;
      rb.x=clamp(rb.x,0,w); rb.y=clamp(rb.y,0,h);
      rb.hue=(rb.hue+45*dt)%360;
      rb.pts.push({x:rb.x,y:rb.y}); if(rb.pts.length>26) rb.pts.shift();
      g.strokeStyle=`hsl(${rb.hue} 90% 60%)`; g.lineWidth=Math.max(1.5,w/320);
      g.beginPath();
      rb.pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));
      g.stroke();
    }
  }else if(st.type==="bounce"){
    g.fillStyle="#000"; g.fillRect(0,0,w,h);
    const b=st.b, fs=Math.max(11,w/16);
    g.font=`bold ${fs}px "Lucida Console",Consolas,monospace`;
    const tw=g.measureText("CURSORS.EXE").width;
    b.x+=b.dx*(w/600+.4); b.y+=b.dy*(w/600+.4);
    if(b.x<4||b.x+tw>w-4){ b.dx*=-1; b.hue=(b.hue+67)%360; }
    if(b.y<fs+4||b.y>h-8){ b.dy*=-1; b.hue=(b.hue+67)%360; }
    b.x=clamp(b.x,4,Math.max(5,w-4-tw)); b.y=clamp(b.y,fs+4,h-8);
    g.fillStyle=`hsl(${b.hue} 90% 60%)`;
    g.fillText("CURSORS.EXE",b.x,b.y);
  }
}
function startSaver(type){
  if(saverOn) return;
  saverOn=true; saverStartAt=performance.now();
  saverCv.width=innerWidth; saverCv.height=innerHeight;
  saverCv.style.display="block";
  const g=saverCv.getContext("2d");
  g.fillStyle="#000"; g.fillRect(0,0,saverCv.width,saverCv.height);
  saverState=saverInit(type,saverCv.width,saverCv.height);
  let last=performance.now();
  const loop=t=>{
    if(!saverOn) return;
    const dt=Math.min(.05,(t-last)/1000); last=t;
    saverFrame(saverCv,g,saverState,dt);
    saverRaf=requestAnimationFrame(loop);
  };
  saverRaf=requestAnimationFrame(loop);
}
function stopSaver(){ saverOn=false; cancelAnimationFrame(saverRaf); saverCv.style.display="none"; }
setInterval(()=>{
  if(saverOn||!desktopActive()) return;
  if(store.data.saver.t==="none") return;
  if((performance.now()-lastAct)/60000>=store.data.saver.wait) startSaver(store.data.saver.t);
},5000);
const svPrev=$("#sv-prev");
let miniState=null, miniType=null, lastMini=0;
(function miniLoop(t){
  requestAnimationFrame(miniLoop);
  if($("#win-dispprops").style.display!=="flex"||!$("#dp-saver").classList.contains("on")){ miniState=null; lastMini=0; return; }
  const type=$("#sv-sel").value;
  const g=svPrev.getContext("2d");
  if(type==="none"){ g.fillStyle="#000"; g.fillRect(0,0,svPrev.width,svPrev.height); miniState=null; return; }
  if(!miniState||miniType!==type){
    miniType=type; miniState=saverInit(type,svPrev.width,svPrev.height);
    g.fillStyle="#000"; g.fillRect(0,0,svPrev.width,svPrev.height);
  }
  const now=performance.now();
  const dt=lastMini?Math.min(.05,(now-lastMini)/1000):.016;
  lastMini=now;
  saverFrame(svPrev,g,miniState,dt);
})();

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
setInterval(()=>{ if($("#win-datetime").style.display==="flex") drawClock(); },1000);
$("#clock").addEventListener("dblclick",()=>{ calM=null; renderCal(); drawClock(); openWin("win-datetime"); });
$("#dt-ok").addEventListener("click",()=>closeWin("win-datetime"));
$("#dt-cancel").addEventListener("click",()=>closeWin("win-datetime"));
$("#dt-apply").addEventListener("click",()=>showError("Date and Time","You do not have permission to change the time. The house controls the clock."));

/* ================= task manager ================= */
let duelPulse=0, tmSel=null, tmHist=[];
const TMPROCS=["cursors.exe","explorer.exe","msnmsgr.exe","winamp.exe","wallet.dll","hopium.sys","rundll32.exe","svchost.exe","svchost.exe","mumu.exe","copium.drv","System Idle Process"];
function tmCpu(){ return Math.min(99,Math.round(3+duelPulse*24+curs.length*.6+Math.random()*4)); }
setInterval(()=>{
  duelPulse=Math.max(0,duelPulse-.34);
  if($("#win-taskmgr").style.display!=="flex") return;
  const cpu=tmCpu();
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
    for(const name of TMPROCS){
      const c=name==="System Idle Process"?100-cpu
        :name==="cursors.exe"?Math.max(1,cpu-6)
        :Math.round(Math.random()*2);
      const row=document.createElement("div"); row.className="row";
      row.innerHTML=`<span>${name}</span><span>${String(c).padStart(2,"0")}</span>`;
      host.appendChild(row);
    }
  }
  if($("#tm-perf").classList.contains("on")){
    tmHist.push(cpu); if(tmHist.length>60) tmHist.shift();
    const cv=$("#tmgraph"), g=cv.getContext("2d");
    g.fillStyle="#000"; g.fillRect(0,0,cv.width,cv.height);
    g.strokeStyle="#123A12"; g.lineWidth=1;
    for(let x=0;x<cv.width;x+=15){ g.beginPath(); g.moveTo(x+.5,0); g.lineTo(x+.5,cv.height); g.stroke(); }
    for(let y=0;y<cv.height;y+=15){ g.beginPath(); g.moveTo(0,y+.5); g.lineTo(cv.width,y+.5); g.stroke(); }
    g.strokeStyle="#2FD858"; g.lineWidth=1.5; g.beginPath();
    tmHist.forEach((v,i)=>{
      const x=cv.width-(tmHist.length-i)*5, y=cv.height-v/100*cv.height;
      i?g.lineTo(x,y):g.moveTo(x,y);
    });
    g.stroke();
    $("#tmstats").innerHTML=`CPU Usage: <b>${cpu}%</b> · Commit Charge: <b>${fmtS(wallet)} SOL</b><br>Cursors on field: <b>${curs.length}</b> · Uptime: it's 2003, nobody reboots`;
  }
  $("#tmfoot").textContent=`Processes: ${TMPROCS.length} · CPU Usage: ${cpu}%`;
},700);
$("#tm-end").addEventListener("click",()=>{ if(tmSel&&openApps.has(tmSel)){ closeWin(tmSel); tmSel=null; } });
$("#tm-switch").addEventListener("click",()=>{
  if(!tmSel||!openApps.has(tmSel)) return;
  const a=openApps.get(tmSel);
  if(a.kind==="webamp"){ if(a.min) tabClick(tmSel); }
  else focusWin(tmSel);
});

/* ================= Windows Messenger ================= */
const msn=initMessenger({
  EMO, IMG, $, store, sysSnd, playerName:()=>playerName(),
  wireWindow, openWin, closeWin,
  isOpen:id=>openApps.has(id)&&!openApps.get(id).min,
  showMenu, showError, desk:desktop,
});
const chatSys=t=>msn.lobbySys(t);
const botChat=(kind,vars)=>msn.botChat(kind,vars);

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
    webamp.onClose(()=>closeWinamp());
    webamp.onMinimize(()=>{
      const a=openApps.get("win-amp");
      if(a){ a.min=true; if(focusedId==="win-amp") focusedId=null; }
      hideWamp(); sMini(); renderTaskbar();
    });
    showWamp(); /* wrapper must be visible BEFORE render: webamp centers its stack on the slot's rect */
    webamp.renderWhenReady(document.getElementById("webamp-slot")).then(()=>showWamp());
  }else{
    showWamp();
    try{ webamp.reopen(); }catch(e){}
  }
  openApps.set("win-amp",wampEntry());
  focusedId="win-amp";
  renderTaskbar();
}
function closeWinamp(){
  hideWamp();
  if(openApps.delete("win-amp")){
    if(focusedId==="win-amp") focusedId=null;
    renderTaskbar();
  }
}
return {open:openWinamp,close:closeWinamp};
})();

/* ================= geocities ================= */
let geoN=133721;
setInterval(()=>{ if($("#win-ie").style.display==="block"){ geoN+=Math.random()<.4?1:0; $("#geocnt").textContent=String(geoN).padStart(7,"0"); } },1500);
$("#geo-guest").addEventListener("click",()=>msn.openConv("lobby"));
$("#geo-deploy").addEventListener("click",()=>openWin("win-cursors"));

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
  CMAG=Math.max(1,.52/AS);
  el.style.setProperty("--cmag",CMAG);
  for(const c of curs) updateTag(c);
}

let phase="boot", phaseT=0, roundNo=0, roundId=0;
let epochLen=150, upT=0, epochStart=0;   /* uptime never resets: the desktop stays up, only CURSORS.EXE crashes */
let R=null, epochHist=[];
function newRoundRecord(){ return {pot:0,deploys:0,myIn:0,myOut:0,myKills:0,bigBank:null,deaths:0}; }

const CURSVG=`<svg viewBox="0 0 14 22"><use href="#ic-cursor"/></svg>`;
function makeCur(owner,isMine){
  const el=document.createElement("div");
  el.className="cur grace"+(isMine?" me":"");
  el.innerHTML=CURSVG+`<div class="tag"><span class="nm">${owner}</span><span class="bt"></span><span class="mx"></span></div>`;
  curlayer.appendChild(el);
  let x,y,ax,ay;
  if(isMine){ x=clamp(AW/2+rand(-60,60),arena.x0+20,arena.x1-20); y=arena.y1-8; ax=x; ay=arena.y1-80; }
  else{
    const side=Math.floor(rand(0,4));
    x=side===0?arena.x0+6:side===1?arena.x1-6:rand(arena.x0+40,arena.x1-40);
    y=side===2?arena.y0+6:side===3?arena.y1-6:rand(arena.y0+40,arena.y1-40);
    ax=clamp(x+rand(-40,40),arena.x0+50,arena.x1-50); ay=clamp(y+rand(-40,40),arena.y0+50,arena.y1-50);
  }
  const c={owner,isMine,el,x,y,ax,ay,bounty:ENTRY,
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
  const sv=c.el.querySelector("svg");
  sv.style.width=(17*v)+"px"; sv.style.height=(26*v)+"px";
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
  epochLen=rand(EPOCH_MIN,EPOCH_MAX);
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
    /* the playfield hiccups back to life; nothing about the money does */
    $("#arena").classList.add("crashed");
    setTimeout(()=>$("#arena").classList.remove("crashed"),900);
    degauss();   /* the tube collects itself after a stop error */
    startEpoch();
  }
  renderPhase();
}
function fmtUp(s){ const t=Math.floor(s); return `${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`; }
let lastPhaseText="";
function renderPhase(){
  const mm="0:"+String(Math.max(0,Math.ceil(phaseT))).padStart(2,"0");
  const live=curs.reduce((s,c)=>s+c.bounty,0);
  const txt=phase==="battle"
    ?(shutFired?`⚠ SHUTDOWN ${mm} — BANKING ALL`:`UPTIME ${fmtUp(upT)} · ${fmtS(live)} LIVE`)
    :phase==="crash"?"☠ CRASHED · RESTARTING…":"BOOT";
  if(txt===lastPhaseText) return;
  lastPhaseText=txt;
  const urgent=shutFired||phase==="crash";
  const pl=$("#phaseline");
  pl.textContent=txt;
  pl.classList.toggle("battle",urgent);
  const chip=phase==="crash"?`R${roundNo} · CRASHED`:shutFired?`R${roundNo} · SHUTDOWN ${mm}`:`R${roundNo} · UP ${fmtUp(upT)}`;
  $("#phasechip").textContent=chip;
  const mp=$("#mh-phase");
  mp.textContent=chip;
  mp.classList.toggle("battle",urgent);
}

/* ================= deploy / recall / bank ================= */
function canDeploy(){ return phase==="battle"&&!shutFired; }
function deploy(silent){
  if(!canDeploy()||myCurs().length>=MAXCUR||wallet<STAKE) return;
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
$("#st-attack").addEventListener("click",()=>{ stance="attack"; sClick(); updatePanel(); });
$("#st-defend").addEventListener("click",()=>{ stance="defend"; sClick(); updatePanel(); });
/* the mobile thumb bar mirrors the dashboard verbs; the info row opens the full app */
$("#mh-deploy").addEventListener("click",()=>deploy(false));
$("#mh-recall").addEventListener("click",recallAll);
$("#mh-attack").addEventListener("click",()=>{ stance="attack"; sClick(); updatePanel(); });
$("#mh-defend").addEventListener("click",()=>{ stance="defend"; sClick(); updatePanel(); });
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
    `<div class="cx-note">expected P/L is −1% of everything you stake (the fee). All the rest
     of this page is variance. If your P/L is better than −1%, you are running hot, not smart.
     If it is worse, you are running cold, not cursed.</div>`;
}
function renderCxRake(){
  const share=myTickets>0?100*myTickets/(globalTickets+myTickets):0;
  $("#cx-rake").innerHTML=
    cxKV("your tickets",myTickets.toLocaleString())+
    cxKV("global tickets",globalTickets.toLocaleString())+
    cxKV("your share",share.toFixed(4)+"%")+
    cxKV("accrued",(rakeAccrued/1000).toFixed(4)+" SOL",rakeAccrued>0?"pos":"")+
    `<button class="xbtn big" id="rk-claim" style="margin-top:6px"${rakeAccrued>0?"":" disabled"}>CLAIM ${(rakeAccrued/1000).toFixed(4)} SOL</button>`+
    `<div class="cx-note">every deploy — yours or anyone's — pays 0.002 SOL into rakeback and
     mints the deployer 200 tickets. Your share of every future deploy's rakeback equals your
     share of tickets. Tickets decay with a 45-day half-life, so the payroll always belongs to
     whoever is playing <i>now</i>. You play, you become the house.</div>`;
}
$("#cx-rake").addEventListener("click",e=>{
  if(e.target.id!=="rk-claim"||rakeAccrued<=0) return;
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
    `<tbody>${rows||`<tr><td colspan="7" class="dim">no epochs finished yet — the first crash writes the first row</td></tr>`}</tbody></table>`;
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
    `<div class="cx-note">the contract: a random seed is committed (its hash published) before
     each epoch and revealed at the crash — hash the seed yourself and it must match. This
     prototype's duels still draw from the browser RNG; wiring the sim to the committed seed
     ships with the server. The ceremony is real today so you can hold us to it tomorrow.</div>`;
}

/* ================= autoplay ================= */
$("#ap-toggle").addEventListener("click",()=>{
  auto.on=!auto.on; sClick();
  const b=$("#ap-toggle");
  b.textContent=auto.on?"ON":"OFF";
  b.classList.toggle("on",auto.on);
});
$$(".apc").forEach(b=>b.addEventListener("click",()=>{ sClick(); auto.count=+b.dataset.c; $$(".apc").forEach(x=>x.classList.toggle("on",x===b)); }));
$$(".apb").forEach(b=>b.addEventListener("click",()=>{ sClick(); auto.bankAt=+b.dataset.b; $$(".apb").forEach(x=>x.classList.toggle("on",x===b)); }));
/* liquidity: the arena keeps a live bot population instead of coin-flipping.
   The target wobbles per epoch so the field breathes; play-money only — the
   real-money bot policy is a disclosed design still owed (see HANDOFF). */
setInterval(()=>{
  if(!canDeploy()) return;
  if(auto.on&&myCurs().length<auto.count&&wallet>=STAKE) deploy(true);
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
  let tx=null,ty=null,turn=2.4;
  if(c.mode==="recall"){
    c.recallT-=dt;
    const dx=40-c.x, dy=(AH-8)-c.y, dist=Math.hypot(dx,dy);
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
      if(st==="attack"&&bd<520*520){ tx=best.x; ty=best.y; }
      else if(st==="defend"&&bd<300*300){
        tx=c.x+(c.x-best.x); ty=c.y+(c.y-best.y);
      }
    }
    const cen=centroid(c.owner,c);
    if(cen&&((cen.x-c.x)**2+(cen.y-c.y)**2)>75*75){
      tx=tx===null?cen.x:(tx*.65+cen.x*.35);
      ty=ty===null?cen.y:(ty*.65+cen.y*.35);
    }
  }
  if(tx!==null){
    const want=Math.atan2(ty-c.y,tx-c.x);
    c.h+=clamp(angDiff(want-c.h),-1,1)*turn*dt;
  }
  c.h+=(Math.random()-.5)*(c.mode==="hold"?2.2:3.0)*dt;
  const M=30;
  if(c.x<arena.x0+M) c.h+=clamp(angDiff(0-c.h),-1,1)*4.5*dt;
  if(c.x>arena.x1-M) c.h+=clamp(angDiff(Math.PI-c.h),-1,1)*4.5*dt;
  if(c.y<arena.y0+M) c.h+=clamp(angDiff(Math.PI/2-c.h),-1,1)*4.5*dt;
  if(c.y>arena.y1-M) c.h+=clamp(angDiff(-Math.PI/2-c.h),-1,1)*4.5*dt;
  const weight=1+.25*(c.s-1);
  const sp=c.spd*(c.mode==="hold"?.5:1)/weight;
  c.x=clamp(c.x+Math.cos(c.h)*sp*dt,arena.x0+6,arena.x1-6);
  c.y=clamp(c.y+Math.sin(c.h)*sp*dt,arena.y0+6,arena.y1-6);
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
  R.deaths++;
  binDead.unshift(certify(l,w,w===a?1-pA:pA)); renderBin();
  removeCur(l);
  log(`${w.owner} > ${l.owner}  +${fmtS(pot)}`);
  if(pot>=ENTRY*2) chatSys(`${w.owner} killed ${l.owner} for ${fmtS(pot)}`);
  if(l.isMine){
    stats.deaths++;
    /* your last cursor dying is not a system event — the system is fine, it
       has your money. You get the death certificate, not a blue screen. */
    if(myCurs().length===0){ sDie(); if(!auto.on) deathCert(binDead[0]); }
    else float("cursor lost",l.x,l.y,true);
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

/* ================= BSOD ================= */
/* The blue screen belongs to the BIG crash — the epoch boundary — not to a
   personal loss (your death gets a certificate; the system gets a funeral).
   The layout is the real NT stop screen: same paragraphs, same cadence, the
   receipt hiding in the Technical information block where the STOP code goes. */
const bsodEl=$("#bsod");
function bsodShow(text,ms){
  bsodEl.textContent=text;
  bsodEl.style.display="block";
  const hide=()=>{ bsodEl.style.display="none"; removeEventListener("keydown",hide); bsodEl.removeEventListener("click",hide); };
  addEventListener("keydown",hide); bsodEl.addEventListener("click",hide);
  if(ms) setTimeout(hide,ms);
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
function log(line){
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
      ? "Cursors cannot be restored.\n\nEach one was resolved by a fair draw and the draw is final. That is the same rule that pays you when it goes the other way."
      : "The Recycle Bin is empty.");
    return;
  }
  const n=binFiles.length;
  for(const ic of binFiles.splice(0)){
    store.data.userIcons.push(ic);
    store.data.icons[ic.id]=firstFreeCell();
  }
  store.save(); renderIcons(); renderBin(); sysSnd("hwin",.5);
  showError("Restore Items",`${n} item${n===1?"":"s"} put back on the Desktop.`+
    (binDead.length?"\n\nThe cursors stay. They are not files, they are outcomes.":""),true);
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
      (worstOdds?`<div class="hall-bad">worst beat: <b>${esc(worstOdds.name)}</b> was ${worstOdds.odds}% to win and lost anyway</div>`:"")
    : "<div>Nothing has died yet. Give it a round.</div>";
  const body=$("#hall-rows");
  body.innerHTML="";
  rows.slice(0,40).forEach((d,i)=>{
    const tr=document.createElement("tr");
    if(d.mine) tr.className="me";
    tr.innerHTML=`<td>${i+1}</td><td>${esc(d.name)}_${String(d.id).padStart(4,"0")}.cur</td>`+
      `<td class="n">${fmtS(d.lost)}</td><td class="n">×${d.mult.toFixed(1)}</td>`+
      /* red is not decoration here: these are the ones that were favourite and lost */
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
  $("#cert-sub").textContent=`Cursor Termination Certificate · issued by arena.dll · round ${d.round}`;
  const row=(k,v,cls)=>`<div class="cert-r${cls?" "+cls:""}"><span>${k}</span><b>${v}</b></div>`;
  $("#cert-rows").innerHTML=
    row("owner",esc(d.name)+(d.mine?" (you)":""))+
    row("terminated by",esc(d.killer)+(d.killerMine?" (you)":""))+
    row("carrying",`${fmtS(d.lost)} SOL &nbsp;<span class="dim">×${d.mult.toFixed(1)}</span>`,"big")+
    row("peak value",`${fmtS(d.peak)} SOL`)+
    row("its odds",`${d.odds} : ${100-d.odds}`,d.odds>=50?"bad":"")+
    row("kills made",String(d.kills))+
    row("survived",`${d.lived} second${d.lived===1?"":"s"}`)+
    row("time of death",`${d.at} · round ${d.round}`);
  $("#cert-note").textContent=d.odds>=50
    ? `It was favourite at ${d.odds}% and lost anyway. Nothing went wrong. ${d.odds}% is not a promise, it is a rate, and this is the ${100-d.odds}% you were told about.`
    : d.odds<=15
      ? `It was ${d.odds}% to win, so it was ${100-d.odds}% to end exactly like this. The draw was fair and it went the likely way.`
      : `Odds ${d.odds}:${100-d.odds}, drawn once, weighted by bounty. No fee was taken from this collision — the house edge is the 1% entry fee and nothing else.`;
  openWin("win-cert");
}
function updatePanel(){
  const mine=myCurs();
  const liveVal=mine.reduce((s,c)=>s+c.bounty,0);
  const dep=$("#btn-deploy");
  dep.disabled=!canDeploy()||mine.length>=MAXCUR||wallet<STAKE;
  dep.textContent=wallet<STAKE?"▸ INSUFFICIENT FUNDS"
    :mine.length>=MAXCUR?"▸ MAX 5 CURSORS LIVE"
    :canDeploy()?"▸ DEPLOY 0.1 SOL"
    :phase==="crash"?"▸ RESTARTING…":"▸ SHUTDOWN IN PROGRESS";
  const rec=$("#btn-recall");
  const graced=mine.some(c=>c.grace>0);
  rec.disabled=phase==="crash"||!mine.some(c=>c.mode==="roam"||c.grace>0);
  rec.textContent=graced?"◂ UNDEPLOY (refund)":`◂ RECALL ALL (${RECALL_SECS}s)`;
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
  hd.textContent=wallet<STAKE?"NO FUNDS":mine.length>=MAXCUR?"MAX 5 LIVE":canDeploy()?"▸ DEPLOY 0.1":phase==="crash"?"REBOOT…":"SHUTDOWN";
  const hrc=$("#mh-recall");
  hrc.disabled=rec.disabled;
  hrc.textContent=graced?"◂ UNDO":"◂ RECALL";
  $("#mh-attack").classList.toggle("on",stance==="attack");
  $("#mh-defend").classList.toggle("on",stance==="defend");
  $("#mh-live").textContent=`${mine.length}/5 · ${fmtS(liveVal)}`;
  renderCx();   /* whatever pane is open stays live */
}
setInterval(()=>{ if(Math.random()<.25) botChat("idle"); },9000);

/* logoff reset */
$("#btn-logoff-yes").addEventListener("click",()=>{
  sClick();
  for(const c of [...myCurs()]) removeCur(c);
  wallet=5000; walletShown=5000;
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

/* ================= main loop ================= */
let last=performance.now();
function frame(t){
  const dt=Math.min(.05,(t-last)/1000); last=t;
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
chatSys("welcome to the desktop. say gm.");
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
    showBalloon();
  },520);
}
function playStartup(){
  if(muted) return;
  try{
    const a=new Audio(SNDF.startup); a.volume=.6;
    a.play().catch(()=>{
      /* autoplay blocked: play on the first gesture that isn't already a logon click */
      const once=e=>{
        removeEventListener("pointerdown",once,true);
        if(e.target.closest(".lg-tile")) return;
        try{ const b=new Audio(SNDF.startup); b.volume=.6; b.play().catch(()=>{}); }catch(err){}
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
  const toLogin=()=>{ $("#boot").style.display="none"; showLogin(); };
  const bt=setTimeout(toLogin,4300);
  $("#boot").addEventListener("pointerdown",()=>{ clearTimeout(bt); toLogin(); },{once:true});
}
/* ---- user identity: picked at the login screen, Phantom wallet later ---- */
function playerName(){ return PLAYER||"admin"; }
function playerNameFull(){ return PLAYER||"Administrator"; }
function syncIdentity(){
  $("#lg-name").textContent=playerNameFull();
  $("#sm-user").textContent=playerNameFull();
  $("#lg-sub").textContent=PLAYER?"click to log on":"5.000 SOL and dreams";
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
  if(p==="death"){ /* your last cursor dies -> certificate, not a bluescreen */
    binDead.unshift({id:++deathN,name:playerName(),mine:true,killer:"mumu",killerMine:false,
      lost:485,mult:5,peak:485,odds:71,kills:3,lived:88,round:roundNo,at:"09:41:12"});
    deathCert(binDead[0]);
  }
},900);
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
  setTimeout(showBalloon,900);
}else{
  showBootThenLogin();
}
