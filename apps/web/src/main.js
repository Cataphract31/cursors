import "xp.css";
import "./style.css";
import WebampImport from "webamp";
import { IMG, SNDF } from "./assets.js";
const Webamp = (WebampImport && WebampImport.default) ? WebampImport.default : WebampImport;

"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const desktop=$("#desktop"), curlayer=$("#curlayer"), fxlayer=$("#fxlayer");
let W=desktop.clientWidth, H=desktop.clientHeight;
addEventListener("resize",()=>{W=desktop.clientWidth;H=desktop.clientHeight;syncArena();});
const SMALL=innerWidth<700;

/* ---- money: integer units, 1 unit = 0.001 SOL ---- */
const STAKE=100, FEE_PLAT=1, FEE_RAKE=2, ENTRY=97, MAXCUR=5;
const fmtS=u=>((u<0?"-":"")+(Math.abs(u)/1000).toFixed(3));
const fmtSign=u=>(u<0?"-":"+")+(Math.abs(u)/1000).toFixed(3);

/* ---- round timing (seconds) ---- */
const T_JOIN=10, T_BATTLE=60, T_SHUT=12, T_RESULTS=6;
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
let lastAlert=0;
function msnAlert(){
  const now=performance.now();
  if(now-lastAlert<3500) return;
  lastAlert=now; sysSnd("msnAlert",.45);
}
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
let zTop=100, focusedId=null;
const openApps=new Map();
const NOTAB=new Set(["win-logoff","win-shutdown","win-results","win-error","win-confirm","win-props","win-run"]);
function tabTitle(id){ const a=openApps.get(id); if(a&&a.title) return a.title; const t=$("#"+id+" .title-bar-text"); return t?t.textContent:id; }
function tabIconHTML(id){
  const el=$("#"+id+" .title-bar .tb-ico");
  if(!el) return "";
  const img=el.querySelector("img");
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
    if(a.min){ a.min=false; focusedId=id; showWamp(); try{ webamp.reopen(); }catch(e){} }
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
  store.data.wins[el.id]={l:el.style.left,t:el.style.top,w:el.style.width||"",h:el.style.height||"",max:el.classList.contains("maxed")?1:0};
  store.save();
}
function applyWinRect(el){
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
  focusWin(id);
  if(id==="win-run") setTimeout(()=>{ const i=$("#run-in"); i.value=""; i.focus(); },0);
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
function focusWin(id){
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
$$(".window").forEach(w=>{
  w.addEventListener("pointerdown",()=>{ if(openApps.has(w.id)) focusWin(w.id); });
  const tb=w.querySelector(".title-bar");
  const btnMin=w.querySelector('.title-bar-controls button[aria-label="Minimize"]');
  const btnClose=w.querySelector('.title-bar-controls button[aria-label="Close"]');
  if(btnMin) btnMin.addEventListener("click",e=>{e.stopPropagation();minWin(w.id);});
  if(btnClose) btnClose.addEventListener("click",e=>{e.stopPropagation();closeWin(w.id);});
  if(!w.classList.contains("fixed")&&btnClose){
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
    const r=w.getBoundingClientRect(), dx=e.clientX-r.left, dy=e.clientY-r.top;
    const move=ev=>{
      w.style.left=clamp(ev.clientX-dx,-r.width+80,W-40)+"px";
      w.style.top=clamp(ev.clientY-dy,0,H-30)+"px";
    };
    const up=()=>{removeEventListener("pointermove",move);removeEventListener("pointerup",up);saveWinRect(w);};
    addEventListener("pointermove",move); addEventListener("pointerup",up);
  });
});

/* ================= desktop icons ================= */
const SYSICONS=[
  {id:"computer",label:"My Computer",ico:"computer32",app:"win-computer",sys:1},
  {id:"recycle",label:"Recycle Bin",ico:"bin32",app:"win-recycle",sys:1},
  {id:"cursors",label:"CURSORS.EXE",ico:"@ic-app",app:"win-cursors",sys:1},
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
      if(!moved) return;
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
function openFolderWin(name){
  $("#win-folder .title-bar-text").textContent=name;
  $("#folderbody").innerHTML=`This folder is empty.<br><span style="color:#8A8A7A">0 objects · 0 bytes of conviction</span>`;
  openWin("win-folder");
}
function openIcon(ic){
  sysSnd("nav",.5);
  if(ic.app==="folder"){
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
  binFiles.unshift(ic.label);
  store.data.userIcons=store.data.userIcons.filter(u=>u.id!==ic.id);
  delete store.data.icons[ic.id]; delete store.data.texts[ic.id];
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
function showError(title,text){
  $("#win-error .title-bar-text").textContent=title;
  $("#errtext").textContent=text;
  openWin("win-error",{silent:true}); sError();
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
  showConfirm("Empty Recycle Bin","Permanently delete all dead cursors and files? They are already dead.",()=>{
    binDead=[]; binFiles=[]; renderBin(); sCrunch();
  });
}

/* ================= context menus ================= */
const ctx=$("#ctx");
function buildMenu(host,items){
  for(const it of items){
    if(it.sep){ const s=document.createElement("div"); s.className="csep"; host.appendChild(s); continue; }
    const d=document.createElement("div");
    d.className="cit"+(it.disabled?" dis":"")+(it.bold?" bold":"");
    d.textContent=it.label;
    if(it.sub){
      d.classList.add("has-sub");
      const sub=document.createElement("div"); sub.className="csub";
      buildMenu(sub,it.sub); d.appendChild(sub);
    }
    if(!it.disabled&&it.action) d.addEventListener("pointerup",e=>{ e.stopPropagation(); hideMenu(); sClick(); it.action(); });
    host.appendChild(d);
  }
}
function showMenu(items,x,y){
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
  if(ic.id==="recycle") items.push({label:"Empty Recycle Bin",action:emptyBin});
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
document.addEventListener("contextmenu",e=>{
  e.preventDefault();
  hideMenu();
  if(e.target.closest("#webamp,#webamp-slot")) return; /* Winamp draws its own menus */
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
      {label:"Paint",action:()=>{ closeStart(); showError("Paint","mspaint.exe ships in a later update. Draw your losses from memory."); }},
      {label:"Calculator",action:()=>{ closeStart(); showError("Calculator","Cannot compute expected value: it is zero. It is always zero. Read the README."); }}]},
    {label:"Games",sub:[
      {label:"Minesweeper",action:()=>{ closeStart(); showError("Minesweeper","winmine.exe ships in a later update. This whole desktop is the minefield."); }},
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
  "control":"win-dispprops","desk.cpl":"win-dispprops",
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
function showBalloon(){
  $("#balloon").style.display="block"; sBalloon();
  setTimeout(()=>{ $("#balloon").style.display="none"; },8500);
}
$("#balloon").addEventListener("click",()=>$("#balloon").style.display="none");

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
const WALLPAPERS=[["bliss","Bliss"],["none","(None)"]];
let wpSel=WALLPAPERS.some(w=>w[0]===store.data.wallpaper)?store.data.wallpaper:"bliss";
function wpApplyTo(el,id){
  el.style.backgroundImage=id==="bliss"?`url(${IMG.bliss})`:"none";
  el.style.backgroundColor="#3A6EA5";
}
function setWallpaper(id){
  if(!WALLPAPERS.some(w=>w[0]===id)) id="bliss";
  wpApplyTo($("#wallpaper"),id);
  store.data.wallpaper=id; store.save();
}
function renderWplist(){
  const host=$("#wplist"); host.innerHTML="";
  for(const [id,name] of WALLPAPERS){
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

/* ================= chat (messenger) ================= */
const chatmsgs=$("#chatmsgs");
const EMO=[[":)","🙂"],[":(","☹️"],[":D","😄"],[";)","😉"],[":P","😛"],["(y)","👍"],["<3","❤️"],[":o","😮"]];
function emojify(t){ for(const [k,v] of EMO) t=t.split(k).join(v); return t; }
let lastChatAt=0;
function chatMsg(name,text){
  const w=document.createElement("div"); w.className="who";
  const b=document.createElement("b"); b.textContent=name; w.appendChild(b);
  w.appendChild(document.createTextNode(" says:"));
  const x=document.createElement("div"); x.className="txt"; x.textContent=emojify(text);
  chatmsgs.appendChild(w); chatmsgs.appendChild(x);
  trimChat(); chatmsgs.scrollTop=chatmsgs.scrollHeight;
}
function chatSys(text){
  const d=document.createElement("div"); d.className="sys"; d.textContent=text;
  chatmsgs.appendChild(d); trimChat(); chatmsgs.scrollTop=chatmsgs.scrollHeight;
}
function trimChat(){ while(chatmsgs.children.length>120) chatmsgs.firstChild.remove(); }
function botChat(kind,vars){
  const now=performance.now();
  if(now-lastChatAt<2600||Math.random()<.45) return;
  lastChatAt=now;
  const L={
    join:["gm","pot looks juicy","deploying this round, who else","0.1 printer warming up","ez round incoming","who wants to die today"],
    kill:["LOL {l}","{w} eating good","rip {l}, seen worse rolls","gg {l}","{w} is a problem","bro really touched {w}"],
    bigkill:["{w} IS FAT NOW","someone kill {w} already","{w} carrying the whole pot","free lottery ticket walking around"],
    bank:["{n} banked. coward","smart exit tbh","{n} took the money and ran","paper hands {n}"],
    shutdown:["RUN","exit rush GO","camping the door hehe","everybody OUT","see you at start"],
    shrink:["walls closing LOL","640x480 no escape","resolution diff","small screen big problems"],
    idle:["anyone else lagging or is that the vibes","this desktop needs a screensaver","dial up holding strong","nudge me again and see what happens","imagine losing a 90:10"]
  }[kind];
  if(!L) return;
  let t=pick(L);
  if(vars) for(const k in vars) t=t.split("{"+k+"}").join(vars[k]);
  setTimeout(()=>{ chatMsg(pick(BOTS).name,t); msnAlert(); },rand(300,1400));
}
function sendChat(){
  const inp=$("#chatin"), t=inp.value.trim();
  if(!t) return;
  inp.value=""; sChat();
  chatMsg(playerName(),t);
  if(Math.random()<.5) botChat("idle");
}
$("#chatsend").addEventListener("click",sendChat);
$("#chatin").addEventListener("keydown",e=>{ if(e.key==="Enter") sendChat(); });
let lastNudge=0;
$("#chatnudge").addEventListener("click",()=>{
  const now=performance.now();
  if(now-lastNudge<4000) return;
  lastNudge=now; sNudge();
  chatSys("you have just sent a nudge.");
  const w=$("#win-chat");
  w.classList.remove("nudged"); void w.offsetWidth; w.classList.add("nudged");
});

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

/* -- seven house tracks: authored below, rendered offline to WAV, played by the real player -- */
const FOUR="x---x---x---x---", OFF8="--x---x---x---x-", HAT16="xxxxxxxxxxxxxxxx", CLAP24="----x-------x---";
const WTRK=[
{name:"cloudless",bpm:138,root:110,pump:1,leadInst:"saw",
 prog:[{r:0,c:[0,3,7]},{r:-4,c:[-4,0,5]},{r:3,c:[3,7,12]},{r:-2,c:[-2,2,5]}],
 leads:[{len:32,n:[[0,19,2],[2,17,1],[4,15,2],[6,19,2],[8,24,3],[12,22,1],[14,19,2],[16,17,2],[18,15,1],[20,12,2],[24,15,2],[26,17,1],[28,19,4]]}],
 arr:[
  {b:8,k:FOUR,h:OFF8,bass:"sub",ch:"pad"},
  {b:8,k:FOUR,c:CLAP24,h:OFF8,bass:"roll",ch:"pad",riser:1},
  {b:16,k:FOUR,c:CLAP24,h:HAT16,o:OFF8,bass:"roll",ch:"offstab",ld:0,crash:1},
  {b:8,bass:"sub",ch:"pad",ld:0,riser:1},
  {b:16,k:FOUR,c:CLAP24,h:HAT16,o:OFF8,bass:"roll",ch:"offstab",ld:0,crash:1},
  {b:4,k:FOUR,bass:"sub",ch:"pad"}]},
{name:"gigadance",bpm:134,root:82.41,pump:1,leadInst:"saw",
 prog:[{r:0,c:[0,3,7]},{r:-4,c:[-4,0,3]},{r:3,c:[3,7,10]},{r:-2,c:[-2,2,5]}],
 leads:[{len:32,n:[[0,12,1],[2,12,1],[4,15,2],[6,19,1],[8,19,2],[10,17,1],[12,15,1],[14,14,2],[16,12,1],[18,12,1],[20,14,2],[22,15,2],[24,19,3],[28,14,4]]}],
 arr:[
  {b:4,k:FOUR,bass:"off8"},
  {b:8,k:FOUR,c:CLAP24,h:OFF8,bass:"off8",ch:"stab24"},
  {b:4,k:FOUR,c:CLAP24,h:OFF8,bass:"off8",ch:"stab24",riser:1},
  {b:16,k:FOUR,c:CLAP24,h:HAT16,bass:"off8",ch:"offstab",ld:0,crash:1},
  {b:8,bass:"sub",ch:"pad",ld:0},
  {b:16,k:FOUR,c:CLAP24,h:HAT16,bass:"off8",ch:"offstab",ld:0,crash:1},
  {b:4,k:FOUR,bass:"off8",ch:"pad"}]},
{name:"nightcoreur",bpm:168,root:92.5,pump:1,leadInst:"saw",
 prog:[{r:0,c:[0,3,7]},{r:-4,c:[-4,0,3]},{r:3,c:[3,7,10]},{r:-2,c:[-2,2,5]}],
 leads:[{len:64,n:[[0,12,1],[2,15,1],[4,17,1],[6,19,2],[8,19,1],[10,17,1],[12,15,1],[14,17,2],[16,19,1],[18,20,1],[20,22,2],[24,19,2],[28,17,1],[30,15,1],[32,14,1],[34,15,1],[36,17,2],[40,15,2],[44,14,1],[46,12,1],[48,15,1],[50,17,1],[52,19,2],[56,22,2],[60,24,4]]}],
 arr:[
  {b:4,k:FOUR,h:OFF8,bass:"oct"},
  {b:4,k:FOUR,c:CLAP24,h:OFF8,bass:"oct",ch:"stab24",riser:1},
  {b:20,k:FOUR,c:CLAP24,h:HAT16,bass:"oct",ch:"offstab",ld:0,crash:1},
  {b:4,bass:"sub",ch:"pad",riser:1},
  {b:20,k:FOUR,c:CLAP24,h:HAT16,bass:"oct",ch:"offstab",ld:0,crash:1},
  {b:4,k:FOUR,bass:"oct"}]},
{name:"chip8",bpm:150,root:130.81,leadInst:"chip",
 prog:[{r:0,c:[0,4,7]},{r:-3,c:[-3,0,4]},{r:5,c:[5,9,12]},{r:-5,c:[-5,-1,2]}],
 leads:[{len:64,n:[[0,12,2],[4,16,2],[8,19,2],[12,16,1],[14,14,1],[16,12,2],[20,14,2],[24,16,4],[32,17,2],[36,16,1],[38,14,1],[40,12,2],[44,9,2],[48,7,2],[52,9,1],[54,11,1],[56,12,6]]}],
 arr:[
  {b:4,h:HAT16,bass:"walk",ch:"arp32"},
  {b:16,k:FOUR,s:CLAP24,h:HAT16,bass:"walk",ch:"arp32",ld:0,crash:1},
  {b:8,k:FOUR,h:HAT16,bass:"walk",ch:"arpU"},
  {b:16,k:FOUR,s:CLAP24,h:HAT16,bass:"walk",ch:"arp32",ld:0,crash:1},
  {b:4,bass:"walk",ch:"arpU"}]},
{name:"dialtone",bpm:128,root:130.81,swing:.24,leadInst:"dark",
 prog:[{r:0,c:[0,3,7]},{r:5,c:[5,8,12]},{r:-4,c:[-4,0,3]},{r:-2,c:[-2,2,5]}],
 leads:[{len:32,n:[[0,15,3],[6,14,1],[8,12,2],[14,10,1],[16,12,3],[22,15,2],[26,17,1],[28,15,3]]}],
 arr:[
  {b:8,bass:"sub",ch:"pad"},
  {b:16,k:"x-----x---x-----",s:"----x-------x--x",h:"x-x-x-x-x-x-x-xx",bass:"off8",ch:"pad",ld:0,crash:1},
  {b:8,k:"x-----x---x-----",h:"x-x-x-x-x-x-x-x-",bass:"sub",ch:"stab24"},
  {b:16,k:"x-----x---x-----",s:"----x-------x--x",h:"x-x-x-x-x-x-x-xx",bass:"off8",ch:"pad",ld:0},
  {b:4,bass:"sub",ch:"pad"}]},
{name:"vaporlounge",bpm:84,root:87.31,swing:.3,leadInst:"soft",
 prog:[{r:0,c:[0,4,7,11]},{r:-3,c:[-3,0,4,7]},{r:2,c:[2,5,9,12]},{r:-5,c:[-5,-1,2,5]}],
 leads:[{len:64,n:[[0,16,3],[6,14,2],[10,12,2],[16,11,4],[24,9,2],[32,14,3],[38,12,2],[42,11,1],[44,9,4],[52,7,3]]}],
 arr:[
  {b:4,bass:"jazz",ch:"pad"},
  {b:24,k:"x---------x-----",s:"--------x-------",h:"x-x-x-x-x-x-x-x-",o:"------x---------",bass:"jazz",ch:"pad",ld:0},
  {b:4,bass:"jazz",ch:"pad"}]},
{name:"shatterhand",bpm:174,root:82.41,leadInst:"dark",
 prog:[{r:0,c:[0,3,7]},{r:0,c:[0,3,7]},{r:-4,c:[-4,0,3]},{r:-2,c:[-2,2,5]}],
 leads:[{len:32,n:[[0,12,2],[4,15,1],[6,15,1],[8,14,2],[12,10,2],[16,12,2],[20,15,2],[24,19,3],[30,15,1]]}],
 arr:[
  {b:8,h:HAT16,bass:"reese"},
  {b:20,k:"x--------x------",s:"----x-------x---",h:HAT16,bass:"reese",ch:"stab24",ld:0,crash:1},
  {b:8,bass:"sub",ch:"pad",ld:0},
  {b:20,k:"x--------x------",s:"----x-------x---",h:HAT16,bass:"reese",ch:"stab24",ld:0,crash:1},
  {b:4,h:HAT16,bass:"reese"}]}
];
WTRK.forEach(T=>{
  T._secs=[]; let b0=0;
  for(const s of T.arr){ s.bar0=b0; for(let i=0;i<s.b;i++) T._secs.push(s); b0+=s.b; }
  T._bars=b0; T._steps=b0*16; T._dur=T._steps*(60/T.bpm/4);
});

/* -- instrument rack (E = one offline render environment) -- */
function nz(E,t,dur,vol,freq,type,dest,q){
  const s=E.c.createBufferSource(); s.buffer=E.nb; s.loop=true;
  const f=E.c.createBiquadFilter(); f.type=type||"bandpass"; f.frequency.value=freq; f.Q.value=q||.8;
  const g=E.c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
  s.connect(f); f.connect(g); g.connect(dest||E.drums);
  s.start(t,(t*7919)%.5); s.stop(t+dur+.03);
}
function kick(E,t,T){
  const o=E.c.createOscillator(),g=E.c.createGain();
  o.type="sine"; o.frequency.setValueAtTime(165,t); o.frequency.exponentialRampToValueAtTime(46,t+.09);
  g.gain.setValueAtTime(.95,t); g.gain.exponentialRampToValueAtTime(.001,t+.27);
  o.connect(g); g.connect(E.drums); o.start(t); o.stop(t+.3);
  nz(E,t,.014,.3,3200,"highpass");
  if(T.pump){ const gg=E.duck.gain,b=60/T.bpm; gg.setValueAtTime(.3,t); gg.linearRampToValueAtTime(1,t+b*.82); }
}
function snare(E,t){
  nz(E,t,.16,.32,1900,"bandpass",E.drums,.7); nz(E,t,.08,.2,420,"lowpass");
  const o=E.c.createOscillator(),g=E.c.createGain();
  o.type="triangle"; o.frequency.value=196;
  g.gain.setValueAtTime(.25,t); g.gain.exponentialRampToValueAtTime(.001,t+.09);
  o.connect(g); g.connect(E.drums); o.start(t); o.stop(t+.12);
}
function clap(E,t){ [0,.013,.026].forEach(d=>nz(E,t+d,.045,.22,1200,"bandpass",E.drums,1.6)); nz(E,t+.028,.2,.16,1200,"bandpass",E.drums,1.2); }
function hat(E,t,open){ nz(E,t,open?.24:.045,open?.13:.15,8800,"highpass"); }
function crash(E,t){
  nz(E,t,1.1,.17,6500,"highpass");
  const o=E.c.createOscillator(),g=E.c.createGain();
  o.type="sine"; o.frequency.setValueAtTime(70,t); o.frequency.exponentialRampToValueAtTime(38,t+.4);
  g.gain.setValueAtTime(.5,t); g.gain.exponentialRampToValueAtTime(.001,t+.9);
  o.connect(g); g.connect(E.drums); o.start(t); o.stop(t+1);
}
function riser(E,t,dur){
  const s=E.c.createBufferSource(); s.buffer=E.nb; s.loop=true;
  const f=E.c.createBiquadFilter(); f.type="bandpass"; f.Q.value=1.2;
  f.frequency.setValueAtTime(300,t); f.frequency.exponentialRampToValueAtTime(6400,t+dur);
  const g=E.c.createGain(); g.gain.setValueAtTime(.0012,t); g.gain.exponentialRampToValueAtTime(.11,t+dur); g.gain.setValueAtTime(.0001,t+dur+.01);
  s.connect(f); f.connect(g); g.connect(E.mel); s.start(t,.2); s.stop(t+dur+.05);
}
function fr(T,semi){ return T.root*Math.pow(2,semi/12); }
function bassN(E,t,T,semi,dur,vel){
  const f=fr(T,semi);
  const lp=E.c.createBiquadFilter(); lp.type="lowpass"; lp.Q.value=5;
  lp.frequency.setValueAtTime(1200,t); lp.frequency.exponentialRampToValueAtTime(300,t+Math.min(.16,dur));
  const g=E.c.createGain(); g.gain.setValueAtTime(vel||.3,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
  const o=E.c.createOscillator(); o.type="sawtooth"; o.frequency.value=f;
  const o2=E.c.createOscillator(); o2.type="square"; o2.frequency.value=f/2;
  const g2=E.c.createGain(); g2.gain.value=.5;
  o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(E.mel);
  o.start(t); o.stop(t+dur+.03); o2.start(t); o2.stop(t+dur+.03);
}
function subN(E,t,T,semi,dur){
  const o=E.c.createOscillator(),g=E.c.createGain();
  o.type="sine"; o.frequency.value=fr(T,semi);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.3,t+.02); g.gain.setValueAtTime(.3,t+dur*.8); g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g); g.connect(E.mel); o.start(t); o.stop(t+dur+.05);
}
function chipB(E,t,T,semi,dur){
  const o=E.c.createOscillator(),g=E.c.createGain();
  o.type="triangle"; o.frequency.value=fr(T,semi);
  g.gain.setValueAtTime(.32,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g); g.connect(E.mel); o.start(t); o.stop(t+dur+.03);
}
function reese(E,t,T,semi,dur){
  const lp=E.c.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=520; lp.Q.value=2;
  const g=E.c.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.2,t+.05); g.gain.setValueAtTime(.2,t+dur*.9); g.gain.linearRampToValueAtTime(0,t+dur);
  lp.connect(g); g.connect(E.mel);
  [-18,18].forEach(d=>{ const o=E.c.createOscillator(); o.type="sawtooth"; o.frequency.value=fr(T,semi); o.detune.value=d; o.connect(lp); o.start(t); o.stop(t+dur+.05); });
}
function stab(E,t,T,semis,dur,vel){
  const lp=E.c.createBiquadFilter(); lp.type="lowpass"; lp.Q.value=1;
  lp.frequency.setValueAtTime(3800,t); lp.frequency.exponentialRampToValueAtTime(950,t+dur);
  const g=E.c.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vel,t+.015); g.gain.exponentialRampToValueAtTime(.001,t+dur);
  lp.connect(g); g.connect(E.mel);
  for(const s of semis) for(const d of[-8,8]){
    const o=E.c.createOscillator(); o.type="sawtooth"; o.frequency.value=fr(T,s+12); o.detune.value=d;
    o.connect(lp); o.start(t); o.stop(t+dur+.03);
  }
}
function pad(E,t,T,semis,dur){
  const lp=E.c.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=1500; lp.Q.value=.5;
  const g=E.c.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.055,t+dur*.25); g.gain.setValueAtTime(.055,t+dur*.75); g.gain.linearRampToValueAtTime(0,t+dur);
  lp.connect(g); g.connect(E.mel);
  for(const s of semis) for(const d of[-6,6]){
    const o=E.c.createOscillator(); o.type="sawtooth"; o.frequency.value=fr(T,s+12); o.detune.value=d;
    o.connect(lp); o.start(t); o.stop(t+dur+.05);
  }
}
function arpN(E,t,T,semi,dur,vel,type){
  const o=E.c.createOscillator(),g=E.c.createGain();
  o.type=type||"square"; o.frequency.value=fr(T,semi+12);
  g.gain.setValueAtTime(vel,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g); g.connect(E.mel); o.start(t); o.stop(t+dur+.02);
}
function leadN(E,t,T,semi,dur,kind){
  const base=kind==="soft"?.11:kind==="chip"?.1:.13;
  const mk=(tt,v)=>{
    const lp=E.c.createBiquadFilter(); lp.type="lowpass"; lp.Q.value=1;
    lp.frequency.setValueAtTime(kind==="dark"?1400:3400,tt); lp.frequency.exponentialRampToValueAtTime(kind==="dark"?700:1300,tt+dur);
    const g=E.c.createGain(); g.gain.setValueAtTime(0,tt); g.gain.linearRampToValueAtTime(v,tt+(kind==="soft"?.05:.01)); g.gain.exponentialRampToValueAtTime(.001,tt+dur);
    lp.connect(g); g.connect(E.mel);
    const types=kind==="chip"?["square"]:kind==="soft"?["triangle","triangle"]:["sawtooth","square"];
    types.forEach((ty,i)=>{ const o=E.c.createOscillator(); o.type=ty; o.frequency.value=fr(T,semi+12); o.detune.value=i?7:-7; o.connect(lp); o.start(tt); o.stop(tt+dur+.03); });
  };
  mk(t,base);
  if(kind==="saw"||kind==="dark"){ const e=(60/T.bpm)*.75; mk(t+e,base*.38); mk(t+e*2,base*.16); }
}
function schedStepE(E,T,step,t){
  const bar=step>>4, s=step&15, sec=T._secs[bar], st=60/T.bpm/4;
  const t0=t+(((s&1)&&T.swing)?st*T.swing:0);
  const chd=T.prog[bar%T.prog.length];
  if(sec.crash&&bar===sec.bar0&&s===0) crash(E,t0);
  if(sec.riser&&bar===sec.bar0+sec.b-2&&s===0) riser(E,t0,st*32);
  if(sec.k&&sec.k[s]==="x") kick(E,t0,T);
  if(sec.s&&sec.s[s]==="x") snare(E,t0);
  if(sec.c&&sec.c[s]==="x") clap(E,t0);
  if(sec.o&&sec.o[s]==="x") hat(E,t0,1); else if(sec.h&&sec.h[s]==="x") hat(E,t0,0);
  switch(sec.bass){
    case "off8": if(s%4===2) bassN(E,t0,T,chd.r,st*1.6,.3); break;
    case "roll": if(s%4!==0) bassN(E,t0,T,chd.r-12,st*.92,s%4===2?.32:.24); break;
    case "oct": bassN(E,t0,T,(s%2)?chd.r:chd.r-12,st*.9,.27); break;
    case "sub": if(s===0||s===8) subN(E,t0,T,chd.r-12,st*7.6); break;
    case "walk": if(s%2===0){ const wp=[0,7,12,7]; chipB(E,t0,T,chd.r-12+wp[(s>>1)%4],st*1.7); } break;
    case "jazz": if(s===0) subN(E,t0,T,chd.r-12,st*7); else if(s===8) subN(E,t0,T,chd.r-5,st*6); break;
    case "reese": if(s===0) reese(E,t0,T,chd.r-12,st*16); break;
  }
  switch(sec.ch){
    case "offstab": if(s%4===2) stab(E,t0,T,chd.c,st*1.6,.12); break;
    case "stab24": if(s===4||s===12) stab(E,t0,T,chd.c,st*2.6,.13); break;
    case "pad": if(s===0) pad(E,t0,T,chd.c,st*16); break;
    case "arpU": arpN(E,t0,T,chd.c[[0,1,2,1][s%4]]+((s%8>=4)?12:0),st*.9,.06,"sawtooth"); break;
    case "arp32": arpN(E,t0,T,chd.c[s%3],st*.48,.055); arpN(E,t0+st/2,T,chd.c[(s+1)%3]+12,st*.48,.05); break;
  }
  const li=(sec.ld==null)?-1:sec.ld;
  if(li>=0){
    const ph=T.leads[li], pos=((bar-sec.bar0)*16+s)%ph.len;
    for(const n of ph.n) if(n[0]===pos) leadN(E,t0,T,n[1],st*n[2]*1.05,T.leadInst);
  }
}
function mkRack(c){
  const comp=c.createDynamicsCompressor();
  comp.threshold.value=-12; comp.knee.value=20; comp.ratio.value=6; comp.attack.value=.004; comp.release.value=.2;
  const master=c.createGain(); master.gain.value=.9;
  comp.connect(master); master.connect(c.destination);
  const mel=c.createGain(), duck=c.createGain(), drums=c.createGain();
  mel.gain.value=.9;
  mel.connect(duck); duck.connect(comp); drums.connect(comp);
  const nb=c.createBuffer(1,c.sampleRate,c.sampleRate);
  const d=nb.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  return {c,mel,duck,drums,nb};
}
function wavBlob(buf){
  const ch=buf.getChannelData(0), n=ch.length, sr=buf.sampleRate;
  const b=new ArrayBuffer(44+n*2), v=new DataView(b);
  const ws=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
  ws(0,"RIFF"); v.setUint32(4,36+n*2,true); ws(8,"WAVE"); ws(12,"fmt ");
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
  ws(36,"data"); v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){ const s=Math.max(-1,Math.min(1,ch[i])); v.setInt16(44+i*2,s<0?s*0x8000:s*0x7FFF,true); }
  return new Blob([b],{type:"audio/wav"});
}
function renderTrack(T){
  const sr=32000, st=60/T.bpm/4;
  const oc=new OfflineAudioContext(1,Math.ceil((T._dur+1.2)*sr),sr);
  const E=mkRack(oc);
  for(let s2=0;s2<T._steps;s2++) schedStepE(E,T,s2,.06+s2*st);
  return oc.startRendering().then(wavBlob);
}

/* -- render queue: tracks appear in the playlist as they finish baking -- */
const wavURL=[]; let queued=false;
function toTrack(i){ const T=WTRK[i]; return {url:wavURL[i],duration:T._dur,metaData:{artist:"the house",title:T.name}}; }
function queueRenders(){
  if(queued) return; queued=true;
  let i=0;
  (function step(){
    if(i>=WTRK.length) return;
    const idx=i++;
    let p;
    try{ p=renderTrack(WTRK[idx]); }catch(e){ p=Promise.reject(e); }
    p.then(b=>{
      wavURL[idx]=URL.createObjectURL(b);
      if(webamp){ try{ webamp.appendTracks([toTrack(idx)]); }catch(e){ console.error("[winamp] appendTracks failed:",e); } }
    })
     .catch(e=>console.error("[winamp] render failed:",WTRK[idx].name,e))
     .then(()=>setTimeout(step,400));
  })();
}
setTimeout(queueRenders,300); /* eager: tracks are usually all baked before the player is first opened */

/* -- lifecycle: Webamp is a normal process-table entry (kind:"webamp").
   #webamp-wrap is OURS (webamp replaces the inner slot only), so hide/show
   never depends on webamp's internal DOM, and the taskbar tab is just a
   render of openApps like every other window. */
function wampEntry(){
  return {el:null,min:false,kind:"webamp",notab:false,title:"Winamp",icon:`<img src="${IMG.amp16}" alt="">`};
}
function openWinamp(){
  queueRenders();
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
        initialTracks:wavURL.map((u,i)=>u?toTrack(i):null).filter(Boolean),
        zIndex:4800
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
$("#geo-guest").addEventListener("click",()=>openWin("win-chat"));
$("#geo-deploy").addEventListener("click",()=>openWin("win-cursors"));

/* ================= game state ================= */
const BOTS=["mumu","bobo","clippy","bonk","solja","xp_chad","deg404"].map(n=>({name:n}));
let wallet=5000, walletShown=5000;
let stats={kills:0,deaths:0,best:0};
let curs=[], binDead=[];
let myTickets=0, globalTickets=1437200, rakeAccrued=0;
let stance="attack";
const auto={on:false,count:3,bankAt:2};

/* arena = the whole desktop */
let arena={x0:0,y0:0,x1:W,y1:H};
function syncArena(){ arena={x0:0,y0:0,x1:W,y1:H}; }

let phase="boot", phaseT=0, roundNo=0, roundId=0;
let R=null;
function newRoundRecord(){ return {pot:0,deploys:0,myIn:0,myOut:0,myKills:0,bigBank:null,deaths:0}; }

const CURSVG=`<svg viewBox="0 0 14 22"><use href="#ic-cursor"/></svg>`;
function makeCur(owner,isMine){
  const el=document.createElement("div");
  el.className="cur grace"+(isMine?" me":"");
  el.innerHTML=CURSVG+`<div class="tag"><span class="nm">${owner}</span><span class="bt"></span><span class="mx"></span></div>`;
  curlayer.appendChild(el);
  let x,y,ax,ay;
  if(isMine){ x=clamp(W/2+rand(-60,60),arena.x0+20,arena.x1-20); y=arena.y1-8; ax=x; ay=arena.y1-80; }
  else{
    const side=Math.floor(rand(0,4));
    x=side===0?arena.x0+6:side===1?arena.x1-6:rand(arena.x0+40,arena.x1-40);
    y=side===2?arena.y0+6:side===3?arena.y1-6:rand(arena.y0+40,arena.y1-40);
    ax=clamp(x+rand(-40,40),arena.x0+50,arena.x1-50); ay=clamp(y+rand(-40,40),arena.y0+50,arena.y1-50);
  }
  const c={owner,isMine,el,x,y,ax,ay,bounty:ENTRY,
    h:rand(0,Math.PI*2),spd:rand(78,124),mode:"hold",prevMode:"roam",recallT:0,
    grace:1.4,riskAt:1.5+Math.random()*5,dead:false,s:1,r:10};
  updateTag(c);
  return c;
}
function updateTag(c){
  const m=c.bounty/ENTRY;
  c.el.querySelector(".bt").textContent=fmtS(c.bounty);
  c.el.querySelector(".mx").textContent=m>=1.05?"×"+(m>=10?m.toFixed(0):m.toFixed(1)):"";
  c.s=Math.min(2.6,1+.35*Math.log2(Math.max(1,m)));
  c.r=10*c.s;
  const sv=c.el.querySelector("svg");
  sv.style.width=(17*c.s)+"px"; sv.style.height=(26*c.s)+"px";
  const tag=c.el.querySelector(".tag");
  tag.style.left=(13*c.s)+"px"; tag.style.top=(25*c.s)+"px";
}
function removeCur(c){
  c.dead=true; c.el.remove();
  curs=curs.filter(x=>x!==c);
  updatePanel();
}
const myCurs=()=>curs.filter(c=>c.isMine&&!c.dead);

/* ================= phases ================= */
function setPhase(p,t){ phase=p; phaseT=t; renderPhase(); }
function startJoin(){
  roundNo++; roundId++;
  R=newRoundRecord();
  closeWin("win-results",{silent:true});
  setPhase("join",T_JOIN);
  sRound();
  log(`— round ${roundNo}: deploys open —`);
  chatSys(`round ${roundNo} — deploys open`);
  botChat("join");
  const rid=roundId;
  for(const b of BOTS){
    const n=pick([1,1,2,2,3]);
    for(let i=0;i<n;i++) setTimeout(()=>{ if(roundId===rid&&phase==="join") botDeploy(b.name); },rand(500,(T_JOIN-2)*1000));
  }
  if(auto.on){
    for(let i=0;i<auto.count;i++) setTimeout(()=>{ if(roundId===rid&&phase==="join") deploy(true); },400+i*400);
  }
  updatePanel();
}
function startBattle(){
  const owners=new Set(curs.map(c=>c.owner));
  if(owners.size<2){ cancelRound(); return; }
  setPhase("battle",T_BATTLE);
  for(const c of curs){ c.mode="roam"; c.prevMode="roam"; }
  log("battle begins");
  updatePanel();
}
let shutFired=false;
function startShutdownRush(){
  shutFired=true;
  openWin("win-shutdown",{silent:true});
  sShut();
  chatSys("system is shutting down — all cursors recalling");
  botChat("shutdown");
  for(const c of curs) if(!c.dead&&c.mode!=="duel") forceRecall(c);
  updatePanel();
}
function forceRecall(c){
  if(c.mode!=="recall"){ c.mode="recall"; c.prevMode="recall"; c.recallT=RECALL_SECS; }
}
function endBattle(){
  for(const c of [...curs]) if(!c.dead) bank(c,true);
  closeWin("win-shutdown",{silent:true});
  startResults();
}
function cancelRound(){
  for(const c of [...curs]){
    if(c.isMine){ wallet+=STAKE; myTickets-=200; R.myIn-=STAKE; }
    removeCur(c);
  }
  log("round cancelled — not enough players. refunded.");
  chatSys("round cancelled — refunds issued");
  startResults();
}
function startResults(){
  setPhase("results",T_RESULTS);
  const net=R.myOut-R.myIn;
  const lines=[
    `round ${roundNo}`,
    `pot&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${fmtS(R.pot)} SOL · ${R.deploys} cursors`,
    `graveyard&nbsp;: ${R.deaths} dead`,
    R.bigBank?`top bank&nbsp;&nbsp;: ${R.bigBank.owner} ${fmtS(R.bigBank.amt)} (×${(R.bigBank.amt/ENTRY).toFixed(1)})`:`top bank&nbsp;&nbsp;: —`,
    `you&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: in ${fmtS(R.myIn)} · out ${fmtS(R.myOut)} · <b>${fmtSign(net)}</b>`,
    `<span class="dim">next round in ${T_RESULTS}s…</span>`
  ];
  $("#resultsbody").innerHTML=lines.join("<br>");
  if(R.myIn>0) openWin("win-results");
  const share=myTickets>0?myTickets/(globalTickets+myTickets):0;
  rakeAccrued+=share*R.deploys*FEE_RAKE;
  log(`round ${roundNo} over. pot ${fmtS(R.pot)}`);
  updatePanel();
}
function phaseTick(dt){
  if(phase==="boot") return;
  phaseT-=dt;
  if(phase==="join"&&phaseT<=0){ shutFired=false; startBattle(); }
  else if(phase==="battle"){
    const elapsed=T_BATTLE-phaseT;
    if(!shutFired&&phaseT<=T_SHUT) startShutdownRush();
    if(shutFired) $("#shuttimer").textContent="0:"+String(Math.max(0,Math.ceil(phaseT))).padStart(2,"0");
    if(phaseT<=0||(elapsed>3&&curs.length===0)) endBattle();
  }
  else if(phase==="results"&&phaseT<=0) startJoin();
  renderPhase();
}
let lastPhaseText="";
function renderPhase(){
  const t=Math.max(0,Math.ceil(phaseT));
  const mm="0:"+String(t).padStart(2,"0");
  const txt=phase==="join"?`ROUND ${roundNo} · JOIN ${mm}`
    :phase==="battle"?(shutFired?`SHUTDOWN ${mm}`:`BATTLE ${mm}`)
    :phase==="results"?`RESULTS · next ${mm}`:"BOOT";
  if(txt===lastPhaseText) return;
  lastPhaseText=txt;
  const pl=$("#phaseline");
  pl.textContent=txt;
  pl.classList.toggle("battle",phase==="battle");
  $("#phasechip").textContent=`R${roundNo} · ${txt.replace(`ROUND ${roundNo} · `,"")}`;
}

/* ================= deploy / recall / bank ================= */
function canDeploy(){ return phase==="join"||(phase==="battle"&&!shutFired); }
function deploy(silent){
  if(!canDeploy()||myCurs().length>=MAXCUR||wallet<STAKE) return;
  wallet-=STAKE;
  myTickets+=200;
  R.myIn+=STAKE;
  R.pot+=ENTRY; R.deploys++;
  const c=makeCur(playerName(),true);
  if(phase==="battle"){ c.mode="roam"; c.prevMode="roam"; }
  curs.push(c);
  if(!silent) sysSnd("hwin",.5);   /* new hardware detected: 1 cursor */
  log(`you deployed 0.100 (${myCurs().length}/${MAXCUR})`);
  updatePanel();
}
function botDeploy(name){
  if(!canDeploy()) return;
  if(curs.filter(c=>c.owner===name).length>=3) return;
  const c=makeCur(name,false);
  if(phase==="battle"){ c.mode="roam"; c.prevMode="roam"; }
  curs.push(c);
  R.pot+=ENTRY; R.deploys++;
  globalTickets+=200;
  updatePanel();
}
function recallAll(){
  if(phase==="join"){
    for(const c of [...myCurs()]){
      wallet+=STAKE; myTickets-=200; R.myIn-=STAKE; R.pot-=ENTRY; R.deploys--;
      removeCur(c);
    }
    sClick(); log("undeployed — refunded in full");
  }else if(phase==="battle"){
    let n=0;
    for(const c of myCurs()) if(c.mode==="roam"){ forceRecall(c); n++; }
    if(n){ sClick(); log(`recalling ${n} cursor${n>1?"s":""} — banking in ${RECALL_SECS}s`); }
  }
  updatePanel();
}
$("#btn-deploy").addEventListener("click",()=>deploy(false));
$("#btn-recall").addEventListener("click",recallAll);
$("#st-attack").addEventListener("click",()=>{ stance="attack"; sClick(); updatePanel(); });
$("#st-defend").addEventListener("click",()=>{ stance="defend"; sClick(); updatePanel(); });
function bank(c,atShutdown){
  const m=(c.bounty/ENTRY).toFixed(1);
  if(!R.bigBank||c.bounty>R.bigBank.amt) R.bigBank={owner:c.owner,amt:c.bounty};
  if(c.isMine){
    wallet+=c.bounty; R.myOut+=c.bounty;
    stats.best=Math.max(stats.best,c.bounty/ENTRY);
    if(c.bounty>=ENTRY*10) sysSnd("tada",.6); else sBank();
    float(fmtSign(c.bounty)+" ×"+m,c.x,c.y,false);
    goldBurst(c.x,c.y);
    log(`you banked ${fmtS(c.bounty)} (×${m})${atShutdown?" at shutdown":""}`);
  }else{
    if(c.bounty>=ENTRY*2){ log(`${c.owner} banked ${fmtS(c.bounty)} (×${m})`); botChat("bank",{n:c.owner}); }
  }
  removeCur(c);
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
setInterval(()=>{
  if(!canDeploy()) return;
  if(auto.on&&myCurs().length<auto.count&&wallet>=STAKE) deploy(true);
  if(phase==="battle"&&Math.random()<.35) botDeploy(pick(BOTS).name);
},2200);

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
    const dx=42-c.x, dy=(H-6)-c.y, dist=Math.hypot(dx,dy);
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
    const aggr=phase==="battle"?(.7+1.5*(T_BATTLE-phaseT)/T_BATTLE):1;
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
  w.bounty+=pot; w.mode=w.prevMode;
  if(w.mode==="recall"&&w.recallT<=0) w.recallT=.3;
  updateTag(w);
  explode(l);
  R.deaths++;
  binDead.unshift({name:l.owner,bounty:pot}); renderBin();
  removeCur(l);
  log(`${w.owner} > ${l.owner}  +${fmtS(pot)}`);
  if(pot>=ENTRY*2) chatSys(`${w.owner} killed ${l.owner} for ${fmtS(pot)}`);
  if(l.isMine){
    stats.deaths++;
    if(myCurs().length===0){ sDie(); bsod(w.owner,pot); }
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
  for(let i=0;i<12;i++){
    const s=document.createElement("div");
    s.className="shard";
    s.style.left=c.x+"px"; s.style.top=c.y+"px";
    const ang=rand(0,Math.PI*2), d=rand(26,86)*c.s;
    s.style.setProperty("--dx",Math.cos(ang)*d+"px");
    s.style.setProperty("--dy",Math.sin(ang)*d+"px");
    s.style.setProperty("--rot",rand(-260,260)+"deg");
    fxlayer.appendChild(s); setTimeout(()=>s.remove(),750);
  }
  const p=document.createElement("div");
  p.className="pop"; p.style.left=(c.x-17)+"px"; p.style.top=(c.y-17)+"px";
  fxlayer.appendChild(p); setTimeout(()=>p.remove(),500);
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
  f.style.left=clamp(x-20,4,W-80)+"px"; f.style.top=clamp(y-30,4,H-30)+"px";
  fxlayer.appendChild(f); setTimeout(()=>f.remove(),1250);
}

/* ================= BSOD ================= */
const bsodEl=$("#bsod");
function bsod(killer,lost){
  bsodEl.textContent=
`A problem has been detected and your last cursor has been terminated.

KILLED_BY              : ${killer}
LOST                   : ${fmtS(lost)} SOL

Deploys are still open. Go again.

Press any key to continue `;
  const u=document.createElement("span"); u.className="blink"; u.textContent="_";
  bsodEl.appendChild(u);
  bsodEl.style.display="block";
  const hide=()=>{ bsodEl.style.display="none"; removeEventListener("keydown",hide); bsodEl.removeEventListener("click",hide); };
  addEventListener("keydown",hide); bsodEl.addEventListener("click",hide);
  setTimeout(hide,auto.on?1100:1600);
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
function renderBin(){
  binDead=binDead.slice(0,30);
  binFiles=binFiles.slice(0,15);
  const lines=binFiles.map(f=>`${f.slice(0,22).padEnd(24)}(file)`)
    .concat(binDead.map(d=>`${d.name.padEnd(10)} lost ${fmtS(d.bounty)}`));
  $("#binpaper").textContent=lines.length?lines.join("\n"):"(empty)";
}
function updatePanel(){
  const mine=myCurs();
  const liveVal=mine.reduce((s,c)=>s+c.bounty,0);
  const dep=$("#btn-deploy");
  dep.disabled=!canDeploy()||mine.length>=MAXCUR||wallet<STAKE;
  dep.textContent=wallet<STAKE?"▸ INSUFFICIENT FUNDS"
    :mine.length>=MAXCUR?"▸ MAX 5 CURSORS LIVE"
    :canDeploy()?"▸ DEPLOY 0.1 SOL":"▸ DEPLOYS OPEN NEXT ROUND";
  const rec=$("#btn-recall");
  rec.disabled=!mine.length||phase==="results"||(phase==="battle"&&!mine.some(c=>c.mode==="roam"));
  rec.textContent=phase==="join"?"◂ UNDEPLOY (refund)":`◂ RECALL ALL (${RECALL_SECS}s)`;
  $("#st-attack").classList.toggle("on",stance==="attack");
  $("#st-defend").classList.toggle("on",stance==="defend");
  $("#livecount").textContent=mine.length;
  $("#liveval").textContent=fmtS(liveVal);
  const share=myTickets>0?100*myTickets/(globalTickets+myTickets):0;
  $("#rakeline").textContent=`rakeback: ${myTickets.toLocaleString()} tk · ${share.toFixed(2)}% · +${(rakeAccrued/1000).toFixed(4)} SOL`;
  const pl=wallet+liveVal-5000;
  $("#statline").textContent=`kills ${stats.kills} · deaths ${stats.deaths} · best ×${stats.best.toFixed(1)} · P/L ${fmtSign(pl)}`;
}
function updateSys(){
  const total=curs.reduce((s,c)=>s+c.bounty,0);
  let top=null; for(const c of curs) if(!top||c.bounty>top.bounty) top=c;
  $("#syspaper").innerHTML=
    `cursors online&nbsp;: <b>${curs.length}</b><br>`+
    `round pot&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <b>${fmtS(R?R.pot:0)} SOL</b><br>`+
    `on the field&nbsp;&nbsp;&nbsp;: <b>${fmtS(total)} SOL</b><br>`+
    `biggest bounty&nbsp;: <b>${top?top.owner+" "+fmtS(top.bounty):"—"}</b><br>`+
    `dead this boot&nbsp;: <b>${binDead.length}</b><br>`+
    `global tickets&nbsp;: <b>${(globalTickets+myTickets).toLocaleString()}</b>`;
}
setInterval(updateSys,1000);
setInterval(()=>{ if(Math.random()<.25) botChat("idle"); },9000);

/* logoff reset */
$("#btn-logoff-yes").addEventListener("click",()=>{
  sClick();
  for(const c of [...myCurs()]) removeCur(c);
  wallet=5000; walletShown=5000;
  stats={kills:0,deaths:0,best:0};
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
  if(phase==="battle"||phase==="join"){
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
  }
  requestAnimationFrame(frame);
}

/* ================= boot ================= */
if(SMALL){
  $("#win-cursors").style.left="4px"; $("#win-cursors").style.top="4px"; $("#win-cursors").style.width="min(316px,96vw)";
  $("#win-chat").style.left="4px"; $("#win-chat").style.top="calc(100% - 296px)";
  $("#win-log").style.left="unset";
}
syncArena();
renderIcons();
setWallpaper(store.data.wallpaper);
renderWplist();
$("#sv-sel").value=store.data.saver.t;
$("#sv-wait").value=store.data.saver.wait;
R=newRoundRecord();
log("CURSORS.EXE started");
openWin("win-cursors",{silent:true});
if(!SMALL) openWin("win-chat",{silent:true});
openWin("win-log",{silent:true});
if(SMALL) minWin("win-log");
focusWin("win-cursors");
chatSys("welcome to the desktop. say gm.");
renderBin(); updatePanel(); updateSys();
startJoin();
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
let PLAYER=store.data.userName||null;
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
if(sessionStorage.getItem("cxp.booted")){
  desktopEntered=true;
  setTimeout(showBalloon,900);
}else{
  showBootThenLogin();
}
