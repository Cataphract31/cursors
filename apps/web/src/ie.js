/* Internet Explorer 6, and the web behind it: cursor$land, the ring it belongs
   to, and the "page cannot be displayed" you get for everything else.
   The pages are written in real 2003 tag soup — <center>, <font>, <marquee>,
   nested tables — on purpose. View > Source is a feature here, so the source
   has to look handmade, because it is.
   Import-free like the other app modules: the build's smoke runner executes
   this file in node. main.js injects the icons and the shell hooks. */

export function initIE(deps) {
  const { IMG, els, store, sysSnd, snd, showMenu, showError, hooks } = deps;

  const HOME = "http://www.cursor.land/";
  const PHONE = "555-0134";

  let url = null, past = [], future = [], loading = null, timers = [];
  let online = false, offline = false, popped = false, srcHTML = "", pageTitle = "";
  let pending = null, hits = 133721, popN = 0;
  const HISTORY = [];

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const key = u => String(u).trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

  /* ---------- the guestbook is real, and it persists ---------- */
  function guests() {
    if (!store.data.guest) {
      store.data.guest = [
        { who: "mumu", when: "14 Aug 2003", txt: "first!!! also i am up 4.2 SOL all time (this account)" },
        { who: "bobo", when: "16 Aug 2003", txt: "cool site. how do i get my cursor back" },
        { who: "xp_chad", when: "02 Sep 2003", txt: "banked at x2 six times in a row. i have solved it." },
        { who: "clippy", when: "11 Sep 2003", txt: "It looks like you're chasing a loss. Would you like help with that?" },
        { who: "deg404", when: "29 Nov 2003", txt: "the rng is crackable. email me. do not email the webmaster." },
        { who: "solja", when: "03 Jan 2004", txt: "webmaster please add music i have a midi" },
      ];
      store.save();
    }
    return store.data.guest;
  }

  /* ================= the sites ================= */
  /* every page is a function, so the ones with live numbers in them can be */

  const NAV = `<table border="0" cellpadding="3" cellspacing="0"><tr>
  <td><a href="/" data-go="http://www.cursor.land/">home</a></td>
  <td><font color="#00BB00">&#183;</font></td>
  <td><a href="/odds.html" data-go="http://www.cursor.land/odds.html">the odds</a></td>
  <td><font color="#00BB00">&#183;</font></td>
  <td><a href="/hall.html" data-go="http://www.cursor.land/hall.html">hall of fame</a></td>
  <td><font color="#00BB00">&#183;</font></td>
  <td><a href="/guest.html" data-go="http://www.cursor.land/guest.html">guestbook</a></td>
  <td><font color="#00BB00">&#183;</font></td>
  <td><a href="http://www.cursorwebring.org/" data-go="http://www.cursorwebring.org/">webring</a></td>
</tr></table>`;

  const RING = `<!-- webring code. paste this on your own page. do not edit it. -->
<table class="ringbox" border="1" cellpadding="6" cellspacing="0"><tr><td>
<center>
<font size="1">this site is member #7 of</font><br>
<b><a data-go="http://www.cursorwebring.org/">THE CURSOR WEBRING</a></b><br>
<font size="1">[ <a data-go="ring:prev">&lt;&lt; prev</a> |
<a data-go="ring:rand">random</a> |
<a data-go="ring:next">next &gt;&gt;</a> |
<a data-go="http://www.cursorwebring.org/">list all</a> ]</font>
</center>
</td></tr></table>`;

  const SITES = {};
  const site = (u, o) => { SITES[key(u)] = Object.assign({ url: u }, o); };

  site("http://www.cursor.land/", {
    title: "cursor$land - the #1 cursor fightring on the net",
    cls: "geo",
    body: () => `<marquee behavior="scroll" scrollamount="4" class="marq">
  &#9733;&#8226;*&#168;*&#8226;.&#184;&#184;.&#8226;*&#168;*&#8226;&#9733; welcome to cursor$land &#9733;&#8226;*&#168;*&#8226;.&#184;&#184;.&#8226;*&#168;*&#8226;&#9733;
  the #1 cursor fightring on the information superhighway &#9733; winner takes all &#9733; tell your friends &#9733;
</marquee>

<center>
<h1>~ cursor$land ~</h1>
<font size="1">est. 2003 &#183; webmaster: admin &#183; last updated: never</font>
<div class="rainbow"></div>
${NAV}
<div class="rainbow"></div>

<table border="0" cellpadding="8" cellspacing="0" width="100%"><tr>
<td valign="top" width="62%">
  <p><b>welcome 2 my page!!</b></p>
  <p>this is the homepage of cursor$land, where cursors fight for money and
  nobody lies to you about it. you deploy a cursor for <b>0.1 SOL</b>. it fights
  on its own. when two of them touch, one dies and the other one takes the
  money. you decide <u>one thing only</u>: when to stop.</p>
  <p><a data-act="deploy"><b>&gt;&gt;&gt; ENTER THE ARENA &lt;&lt;&lt;</b></a><br>
  <font size="1">(opens CURSORS.EXE. costs real money. always did.)</font></p>
  <p>read <a data-go="http://www.cursor.land/odds.html">the odds</a> first if you
  are new. it is one page, it is not selling anything, and that is how you will
  know it is the only honest page on this webring.</p>
  <div class="constr"></div>
  <font size="1">this page is under construction and always will be</font>
</td>
<td valign="top" width="38%">
  <table border="1" cellpadding="5" cellspacing="0" class="sidebox"><tr><td>
    <center>
    <font size="1">you are visitor</font><br>
    <span class="cnt" id="ie-hits">${String(hits).padStart(7, "0")}</span><br>
    <font size="1">since 14 aug 2003</font>
    </center>
  </td></tr></table>
  <br>
  <center>
  <a data-act="amp"><span class="badge">&#9835; now playing: cursor.mid</span></a><br>
  <span class="badge">BEST VIEWED IN 800&#215;600</span><br>
  <span class="badge">MADE WITH NOTEPAD</span><br>
  <span class="badge">Y2K COMPLIANT</span><br>
  <span class="badge">NO RIGHTS RESERVED</span>
  </center>
</td>
</tr></table>

<div class="rainbow"></div>
${RING}
<p><font size="1">sign my <a data-go="http://www.cursor.land/guest.html">guestbook</a> &#183;
<a data-act="mail">email the webmaster</a> &#183;
this page sets no cookies because we could not get them working</font></p>
</center>`,
  });

  site("http://www.cursor.land/odds.html", {
    title: "cursor$land - the odds",
    cls: "geo",
    body: () => {
      const rows = [2, 3, 5, 10, 25, 100].map(n => `  <tr>
    <td align="center">&#215;${n}</td>
    <td align="center">1 / ${n}</td>
    <td align="center">${(100 / n).toFixed(n >= 25 ? 1 : 0)}%</td>
    <td align="center">${n === 2 ? "a coin" : n === 100 ? "once a career" : "1 run in " + n}</td>
  </tr>`).join("\n");
      return `<center>
<h1>~ the odds ~</h1>
<font size="1">the only page on this webring that is not shouting</font>
<div class="rainbow"></div>
${NAV}
<div class="rainbow"></div>

<table border="0" cellpadding="8" cellspacing="0" width="94%"><tr><td align="left">
<p><b>1. every touch is a coin weighted by money.</b><br>
when cursor A (carrying <i>a</i>) touches cursor B (carrying <i>b</i>), A wins
with probability <b>a / (a + b)</b>. that is the whole duel. the winner takes the
loser's bounty. the house does not take a cut of it, does not tilt it, and is
not watching it.</p>

<p><b>2. so every fight is fair, and therefore every run is too.</b><br>
because each touch pays exactly what it risks, chaining them cannot bend the
average. the chance that a cursor ever reaches <b>&#215;N</b> its entry is
<b>1/N</b>. exactly. not about. not usually.</p>

<table border="1" cellpadding="4" cellspacing="0" class="oddstable">
  <tr><th>bank at</th><th>chance</th><th>%</th><th>in plain english</th></tr>
${rows}
</table>

<p><b>3. the fee is the edge, and it is the whole edge.</b><br>
entry is 0.100 SOL: <b>0.097</b> into the arena, <b>0.001</b> to the platform
(1%), <b>0.002</b> back to players as rakeback (2%). played long enough that is
an <b>RTP of 99%</b>. no single collision has an edge inside it. we take the fee
at the door and then we get out of the way.</p>

<p><b>4. bet size cannot change your variance. only banking can.</b><br>
every cursor costs the same 0.1 SOL, so there is no bet-sizing lever to pull.
cash at &#215;2 often and you win small often. ride for &#215;50 and you will
lose 49 times out of 50 without being cheated once.</p>

<p><b>5. there is no jackpot.</b><br>
the chain <i>is</i> the lottery, and it is priced honestly, which is why it does
not need a siren on it.</p>

<p><font size="1">if a page on this webring tells you it has a system, it wants
your 2 SOL. <a data-go="http://deg404.neocities.org/">deg404</a> is the purest
example. read it, then come back here.</font></p>
</td></tr></table>
<div class="rainbow"></div>
${RING}
</center>`;
    },
  });

  site("http://www.cursor.land/hall.html", {
    title: "cursor$land - hall of fame",
    cls: "geo",
    body: () => {
      const h = hooks.hall();
      const board = h.top.length
        ? h.top.map((t, i) => `  <tr>
    <td>${i + 1}. <b>${esc(t.name)}</b>${t.mine ? ' <font color="#ff0">(you)</font>' : ""}</td>
    <td align="right">&#215;${t.mult.toFixed(1)}</td>
    <td align="left"><font size="1">${esc(t.note)}</font></td>
  </tr>`).join("\n")
        : `  <tr><td colspan="3"><center><font size="1">nothing has happened yet. deploy something.</font></center></td></tr>`;
      return `<center>
<h1>~ hall of fame ~</h1>
<font size="1">live from the arena. this table is not decoration.</font>
<div class="rainbow"></div>
${NAV}
<div class="rainbow"></div>

<table border="1" cellpadding="5" cellspacing="0" class="oddstable" width="88%">
  <tr><th align="left" width="34%">cursor</th><th width="70">peak</th><th align="left">how it went</th></tr>
${board}
</table>

<p><font size="1">uptime <b>${esc(h.uptime)}</b> &#183;
alive right now <b>${h.alive}</b> &#183;
dead so far <b>${h.dead}</b> &#183;
your biggest bank <b>${esc(h.bigBank)}</b></font></p>

<div class="constr"></div>
<p><b>the other hall.</b><br>
<font size="1">every cursor that dies gets a certificate saying what its odds
were at the moment it lost. the ones that died as heavy favourites are the
interesting ones. they are filed in the <a data-act="hall">Hall of Pain</a>, in
the Recycle Bin, where they belong.</font></p>
<div class="rainbow"></div>
${RING}
</center>`;
    },
  });

  site("http://www.cursor.land/guest.html", {
    title: "cursor$land - sign my guestbook",
    cls: "geo",
    body: () => {
      const g = guests();
      const list = g.map(e => `<table border="1" cellpadding="5" cellspacing="0" class="gbentry" width="88%"><tr><td align="left">
  <b>${esc(e.who)}</b> <font size="1" color="#888">wrote on ${esc(e.when)}</font><br>
  ${esc(e.txt)}
</td></tr></table>`).join("\n<br>\n");
      return `<center>
<h1>~ guestbook ~</h1>
<font size="1">${g.length} entries &#183; unmoderated &#183; no takebacks</font>
<div class="rainbow"></div>
${NAV}
<div class="rainbow"></div>

<table border="1" cellpadding="8" cellspacing="0" class="sidebox" width="88%"><tr><td>
<center><b>sign it</b></center>
<table border="0" cellpadding="3" cellspacing="0" width="100%">
  <tr><td width="74"><font size="1">your name</font></td>
      <td><input id="gb-who" class="gbin" value="${esc(hooks.playerName())}" maxlength="18" spellcheck="false"></td></tr>
  <tr><td valign="top"><font size="1">message</font></td>
      <td><textarea id="gb-txt" class="gbin" rows="3" maxlength="220" spellcheck="false"></textarea></td></tr>
  <tr><td></td><td><a data-act="gb-post"><b>[ sign my guestbook ]</b></a></td></tr>
</table>
</td></tr></table>
<br>
${list}
<div class="rainbow"></div>
${RING}
</center>`;
    },
  });

  /* ---------- the ring ---------- */
  const MEMBERS = [
    { n: "cursor$land", u: "http://www.cursor.land/", d: "the honest one. the odds page is not a bit.", ok: 1 },
    { n: "MUMU'S CURSOR PAGE", u: "http://mumu.tripod.com/", d: "shrine to one guy's wins. the losses are on another account.", ok: 1 },
    { n: "deg404 // RNG CRACKED", u: "http://deg404.neocities.org/", d: "sells a bot. read it for the education.", ok: 1 },
    { n: "bobo's homepage", u: "http://www.angelfire.com/biz/bobo/", d: "under construction since 2003.", ok: 1 },
    { n: "MSN Search", u: "http://search.msn.com/", d: "indexes the entire web. all ten pages of it, counting the 404.", ok: 1 },
    { n: "cursor tactics quarterly", u: "http://www.cursortactics.com/", d: "host suspended", ok: 0 },
    { n: "XP_CHAD SYSTEM (works!!)", u: "http://xpchad.tripod.com/system/", d: "account deleted by tripod", ok: 0 },
    { n: "the cursor graveyard", u: "http://graveyard.cursor.land/", d: "domain expired", ok: 0 },
    { n: "clippy fan club", u: "http://clippy.homestead.com/", d: "needs a plugin that no longer exists", ok: 0 },
    { n: "solja's midi archive", u: "http://solja.geocities.com/midi/", d: "geocities closed in 2009", ok: 0 },
  ];
  const LIVE = MEMBERS.filter(m => m.ok);

  site("http://www.cursorwebring.org/", {
    title: "THE CURSOR WEBRING",
    cls: "ring",
    body: () => `<center>
<table border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td bgcolor="#000080" align="center" height="40">
  <font color="#FFFF00" size="4"><b>&#9679; THE CURSOR WEBRING &#9679;</b></font><br>
  <font color="#FFFFFF" size="1">${MEMBERS.length} sites &#183; ${LIVE.length} still answering &#183; join by emailing the ringmaster (do not)</font>
</td></tr></table>
<br>
<font size="1">[ <a data-go="ring:prev">&lt;&lt; prev</a> |
<a data-go="ring:rand">random site</a> |
<a data-go="ring:next">next &gt;&gt;</a> ]</font>
<br><br>
<table border="1" cellpadding="6" cellspacing="0" width="94%">
<tr bgcolor="#C0C0C0"><th align="left">#</th><th align="left">site</th><th align="left">status</th></tr>
${MEMBERS.map((m, i) => `<tr>
  <td>${i + 1}</td>
  <td><a data-go="${m.u}">${esc(m.n)}</a><br><font size="1" color="#555">${esc(m.u)}</font></td>
  <td><font size="1" color="${m.ok ? "#008000" : "#AA0000"}"><b>${m.ok ? "ok" : "dead"}</b></font><br>
      <font size="1" color="#555">${esc(m.d)}</font></td>
</tr>`).join("\n")}
</table>
<br>
<font size="1">the ring had 34 sites in 2004. this is what is left. the survivors
are the ones that were not selling anything &#8212; plus deg404, who is
immortal.</font>
</center>`,
  });

  site("http://mumu.tripod.com/", {
    title: "MUMU'S CURSOR PAGE  ***UPDATED***",
    cls: "mumu",
    body: () => `<center>
<marquee behavior="alternate" scrollamount="6" class="marq"><b>*** MUMU IS UP 4.2 SOL ALL TIME ***</b></marquee>
<h1>MUMU'S CURSOR PAGE</h1>
<span class="blink"><font color="#FF0000" size="2"><b>NEW!!</b></font></span>
<font size="1">updated 3 mar 2004</font>
<hr>
<table border="0" cellpadding="10" cellspacing="0" width="100%"><tr>
<td valign="top" align="left">
<p><b>WHO I AM</b><br>
mumu. i have been deploying since day one. i am up <b>4.2 SOL</b> all time on
this account.</p>

<p><b>MY STRATEGY (do not steal)</b></p>
<ol>
  <li>only deploy when the visitor counter ends in 7</li>
  <li>never bank on an even multiple, they are "sticky"</li>
  <li>if you lose twice, deploy three. this is called <b>the ladder</b></li>
  <li>DEFEND when the arena feels hot. you will know</li>
  <li>never play sundays</li>
</ol>
<p><font size="1">i have not lost with this since i started using it (on this
account).</font></p>

<p><b>PROOF</b></p>
<pre class="ascii">
  +--------------------------+
  |  banked  x6.2    +0.52   |   &lt;-- screenshot
  |  banked  x2.0    +0.10   |
  |  banked  x11.4   +1.04   |
  +--------------------------+
</pre>
<p><font size="1">(the other screenshots are on my old pc)</font></p>

<p><b>LINKS</b><br>
<a data-go="http://www.cursor.land/">cursor$land</a> &#8212; webmaster is a hater<br>
<a data-go="http://www.cursor.land/odds.html">"the odds"</a> &#8212; do not read this, it is demoralising<br>
<a data-go="http://www.cursorwebring.org/">the ring</a><br>
<a data-act="mail">email me</a> for coaching (0.5 SOL/hr)</p>
</td>
<td valign="top" width="150" align="center">
  <table border="1" cellpadding="4" cellspacing="0"><tr><td bgcolor="#000000">
  <font color="#00FF00" size="1">visitors<br><b>0000${Math.floor(hits / 40)}</b></font>
  </td></tr></table>
  <br><span class="badge">NETSCAPE OK</span>
  <br><span class="badge">NO BOTS HERE</span>
  <br><br>
  <font size="1" color="#888">webcam:<br>offline</font>
</td>
</tr></table>
<hr>
${RING}
</center>`,
  });

  site("http://deg404.neocities.org/", {
    title: "deg404 // THE RNG IS CRACKED",
    cls: "hax",
    pop: 1,
    body: () => `<pre class="ascii big">
      _              _  _    ___   _  _
   __| | ___  __ _  | || |  / _ \\ | || |
  / _\` |/ -_)/ _\` | |_  _|| (_) ||_  _|
  \\__,_|\\___|\\__, |   |_|  \\___/   |_|
             |___/
</pre>
<center><font color="#00FF00" size="3"><b>&gt;&gt; I HAVE CRACKED THE RNG &lt;&lt;</b></font></center>
<hr class="hax-hr">
<p>after <b>3 months</b> of analysis i have reverse engineered the cursor duel
algorithm. i am not going to explain how. what i will tell you is that the
outcome of every collision is <b>decided in advance</b>, and i can read it.</p>

<p>i built a tool. it is called <b>CURSORBOT 9000</b>. it watches the arena and
tells you exactly when to bank.</p>

<table border="1" cellpadding="10" cellspacing="0" class="haxbox"><tr><td>
<center>
<font size="4"><b>CURSORBOT 9000</b></font><br>
<font size="1">win rate: <b>94%</b> &#183; verified by me</font><br><br>
<b>2 SOL</b> &#183; one time payment &#183; lifetime updates<br><br>
<a data-act="buy"><b>[ DOWNLOAD NOW &#8212; cursorbot9000.exe ]</b></a>
</center>
</td></tr></table>

<p><b>TESTIMONIALS</b></p>
<ul>
  <li>"i made my money back in one session" &#8212; <i>xp_chad</i></li>
  <li>"i cannot log in anymore but the bot worked" &#8212; <i>bonk</i></li>
  <li>"who is this" &#8212; <i>mumu</i></li>
</ul>

<p><b>FAQ</b></p>
<p><b>Q:</b> if you cracked it, why are you selling a bot for 2 SOL<br>
<b>A:</b> exposure.</p>
<p><b>Q:</b> is this a scam<br>
<b>A:</b> no.</p>

<hr class="hax-hr">
<p><font size="1" color="#0a0">this site is hosted free, the counter is fake, and
the 94% is a number i chose. the duel is <b>a / (a+b)</b>, computed from a seed
that is published before the epoch and revealed after it, which you can check
yourself &#8212; see <a data-go="http://www.cursor.land/odds.html">the odds</a>.
if the rng were crackable, this page would not be free.</font></p>`,
  });

  site("http://www.angelfire.com/biz/bobo/", {
    title: "bobo's homepage",
    cls: "bobo",
    body: () => `<center>
<br><br>
<h1>bobo's homepage</h1>
<div class="constr"></div>
<p><b>UNDER CONSTRUCTION</b></p>
<p><font size="1">check back soon!!</font></p>
<br>
<p><font size="1" color="#888">last modified: 04 sep 2003</font></p>
<br><br>
<a data-act="mail"><span class="badge">&#9993; email me</span></a>
<br><br><br>
${RING}
</center>`,
  });

  /* ---------- the search engine, which indexes the entire web ---------- */
  const RESULTS = [
    { t: "cursor$land - the #1 cursor fightring on the net", u: "http://www.cursor.land/",
      d: "deploy a cursor for 0.1 SOL. it fights on its own. you decide when to stop. sign my guestbook." },
    { t: "the odds - cursor$land", u: "http://www.cursor.land/odds.html",
      d: "P(ever reaching xN) = 1/N, exactly. fee 1%, rakeback 2%, RTP 99%. no system, no jackpot, no siren." },
    { t: "THE CURSOR WEBRING", u: "http://www.cursorwebring.org/",
      d: "10 member sites, 5 still answering. join by emailing the ringmaster." },
    { t: "MUMU'S CURSOR PAGE ***UPDATED***", u: "http://mumu.tripod.com/",
      d: "my strategy (do not steal). never bank on an even multiple. never play sundays." },
    { t: "deg404 // THE RNG IS CRACKED", u: "http://deg404.neocities.org/",
      d: "CURSORBOT 9000. win rate 94%, verified by me. 2 SOL, one time payment." },
    { t: "hall of fame - cursor$land", u: "http://www.cursor.land/hall.html",
      d: "live from the arena: peaks, deaths, and the certificate of everyone who lost as a favourite." },
  ];
  site("http://search.msn.com/", {
    title: "MSN Search",
    cls: "srch",
    body: q => {
      const query = q || "";
      const honest = /win|system|strateg|guarantee|beat|crack|trick|hack|rig|cheat|edge/i.test(query);
      const list = query ? (honest ? [RESULTS[1]].concat(RESULTS.filter(r => r !== RESULTS[1])) : RESULTS) : [];
      return `<table border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td bgcolor="#000084" height="36">
&nbsp;<font color="#FFFFFF" size="4"><b>msn</b></font><font color="#FFCC00" size="4"><b>Search</b></font>
</td></tr></table>
<br>
<center>
<table border="0" cellpadding="2" cellspacing="0"><tr>
<td><input id="sq" class="gbin" style="width:320px" value="${esc(query)}" spellcheck="false"></td>
<td><a data-act="search"><b>[ Search the Web ]</b></a></td>
</tr></table>
<font size="1" color="#666">the web has ten pages on it, counting the one that says the page cannot be displayed. this indexes all of them.</font>
</center>
<br>
${query ? `<p><font size="1" color="#666">Results <b>1-${list.length}</b> of about <b>${list.length}</b>
containing "<b>${esc(query)}</b>". (0.04 seconds)</font></p>
${honest ? `<table border="0" cellpadding="8" cellspacing="0" width="100%" bgcolor="#FFFFCC"><tr><td>
<font size="1">you are looking for a way to win. the top result answers that
question completely and takes ninety seconds to read. everything under it is
someone selling you the opposite answer.</font>
</td></tr></table><br>` : ""}
${list.map(r => `<div class="hit">
  <a data-go="${r.u}"><b>${esc(r.t)}</b></a><br>
  ${esc(r.d)}<br>
  <font size="1" color="#008000">${esc(r.u)}</font>
</div>`).join("\n")}` : `<center><font size="1" color="#666">type something above.</font></center>`}`;
    },
  });

  /* ---------- the two failure pages, carbon copy ---------- */
  function page404(u) {
    return `<div class="err404">
<h1>The page cannot be displayed</h1>
<p>The page you are looking for is currently unavailable. The Web site might be
experiencing technical difficulties, or you may need to adjust your browser
settings.</p>
<hr>
<p><b>Please try the following:</b></p>
<ul>
  <li>Click the <a data-act="refresh">Refresh</a> button, or try again later.</li>
  <li>If you typed the page address in the Address bar, make sure that it is
      spelled correctly.</li>
  <li>To check your connection settings, click the <b>Tools</b> menu, and then
      click <b>Internet Options</b>. On the <b>Connections</b> tab, click
      <b>Settings</b>. The settings should match those provided by your local
      area network (LAN) administrator or Internet service provider (ISP).</li>
  <li>Some sites require 128-bit connection security. Click the <b>Help</b> menu
      and then click <b>About Internet Explorer</b> to determine what strength
      security you have installed.</li>
  <li>Click the <a data-go="http://search.msn.com/">Search</a> button to look for
      information on the Internet.</li>
</ul>
<p><font size="1">You asked for <b>${esc(u)}</b>. It was probably never there.
Most of them were not.</font></p>
<hr>
<p><b>Cannot find server or DNS Error</b><br>
Internet Explorer</p>
</div>`;
  }
  function pageOffline(u) {
    return `<div class="err404">
<h1>Web page unavailable while offline</h1>
<p>The Web page you requested is not available offline. To view this page, click
<b>Connect</b>.</p>
<hr>
<p><a data-act="connect"><b>[ Connect ]</b></a>
&nbsp; <font size="1">requested: ${esc(u)}</font></p>
<hr>
<p><b>Internet Explorer</b></p>
</div>`;
  }

  /* ---------- resolving whatever somebody typed ---------- */
  function resolve(u) {
    const k = key(u);
    if (!k || k === "about:blank") return { url: "about:blank", title: "about:blank", cls: "", html: "" };
    if (SITES[k]) { const s = SITES[k]; return { url: s.url, title: s.title, cls: s.cls, html: s.body(), pop: s.pop }; }
    /* search results keep the query in the address bar, like the real thing */
    const m = /^search\.msn\.com\/results\?q=(.*)$/.exec(k);
    if (m) {
      const q = decodeURIComponent(m[1].replace(/\+/g, " "));
      const s = SITES["search.msn.com"];
      return { url: "http://search.msn.com/results?q=" + encodeURIComponent(q),
        title: "MSN Search: " + q, cls: s.cls, html: s.body(q) };
    }
    return { url: /^[a-z]+:\/\//i.test(u) ? u : "http://" + String(u).replace(/^\/+/, ""),
      title: "The page cannot be displayed", cls: "err", html: page404(u), bad: 1 };
  }

  /* ================= the browser ================= */
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function setTitle(t) { pageTitle = t; if (deps.setTitle) deps.setTitle(t + " - Microsoft Internet Explorer"); }
  function buttons() {
    els.back.disabled = !past.length;
    els.fwd.disabled = !future.length;
    els.stop.disabled = !loading;
  }
  function progress(p) {
    els.prog.style.visibility = p == null ? "hidden" : "visible";
    if (p != null) els.progbar.style.width = Math.round(p * 100) + "%";
  }
  function status(t) { els.st1.textContent = t; }

  function go(u, opts) {
    opts = opts || {};
    /* ring links are shortcuts, not addresses */
    if (u === "ring:prev" || u === "ring:next" || u === "ring:rand") {
      const here = LIVE.findIndex(m => key(m.u) === key(url || ""));
      const i = u === "ring:rand"
        ? Math.floor(Math.random() * LIVE.length)
        : (here < 0 ? 0 : (here + (u === "ring:next" ? 1 : LIVE.length - 1)) % LIVE.length);
      u = LIVE[i].u;
    }
    if (!u) return;
    if (!online) { pending = u; dialup(); return; }
    if (offline) { render({ url: u, title: "Web page unavailable while offline", cls: "err", html: pageOffline(u) }, true); return; }

    const r = resolve(u);
    if (!opts.replace && url) { past.push(url); future.length = 0; }
    clearTimers(); loading = r; buttons();
    els.addr.value = r.url;
    els.throb.classList.add("spin");
    status("Opening page " + r.url + "...");
    /* a page over dial-up arrives in fits, so the bar does too */
    const steps = 4 + Math.floor(Math.random() * 3), span = 260 + Math.random() * 620;
    for (let i = 1; i <= steps; i++) later(() => progress(i / steps), (span * i) / steps);
    later(() => render(r), span + 90);
  }

  function render(r, noHist) {
    loading = null;
    url = r.url;
    els.addr.value = r.url;
    els.throb.classList.remove("spin");
    progress(null);
    els.page.className = "ie-doc " + (r.cls || "");
    srcHTML = r.html;
    els.page.innerHTML = r.html;
    els.page.scrollTop = 0;
    setTitle(r.title);
    status("Done");
    buttons();
    if (!noHist && r.url !== "about:blank" && HISTORY.indexOf(r.url) < 0) HISTORY.unshift(r.url);
    if (r.pop && !popped) { popped = true; later(popup, 900); }
    if (r.bad) sysSnd("exclaim", .4);
  }

  function stop() {
    if (!loading) return;
    clearTimers();
    const half = loading; loading = null;
    els.throb.classList.remove("spin");
    progress(null); status("Done"); buttons();
    els.page.className = "ie-doc err";
    els.page.innerHTML = page404(half.url);
    srcHTML = els.page.innerHTML;
    setTitle("The page cannot be displayed");
  }

  /* ---------- the popup, because this is 2003 and nobody blocks them ---------- */
  function popup() {
    const id = "win-iepop-" + (++popN);
    const el = document.createElement("div");
    el.className = "window fixed";
    el.id = id;
    el.style.left = "calc(50% - 152px)"; el.style.top = "130px";
    el.style.width = "304px"; el.style.height = "236px";   /* popups came in one size: annoying */
    el.innerHTML = `
      <div class="title-bar">
        <div class="tb-l"><img class="tb-ico" src="${IMG.ie16}" alt=""><div class="title-bar-text">CONGRATULATIONS - Microsoft Internet Explorer</div></div>
        <div class="title-bar-controls"><button aria-label="Close"></button></div>
      </div>
      <div class="win-body pad">
        <div class="ie-doc iepop">
          <center>
          <marquee behavior="alternate" scrollamount="7" class="marq"><b>*** YOU ARE THE 1,000,000th VISITOR ***</b></marquee>
          <h1 class="blink">YOU HAVE WON!!</h1>
          <p>click below to claim your prize<br>
          <font size="1">(prize must be claimed within 60 seconds)</font></p>
          <p><a data-act="claim"><b>[ CLAIM PRIZE ]</b></a></p>
          <p><font size="1" color="#888">you are visitor 1,000,000. so was everyone.</font></p>
          </center>
        </div>
      </div>`;
    hooks.desk.appendChild(el);
    el.querySelector("[data-act=claim]").addEventListener("click", () => {
      hooks.closeWin(id);
      el.remove();
      showError("Prize", "Your prize is nothing.\n\nIt was always nothing. The only thing on this computer that pays out is priced at 0.1 SOL and tells you the odds up front.", true);
    });
    el.querySelector('button[aria-label="Close"]').addEventListener("click", () => later(() => el.remove(), 400));
    hooks.wireWindow(el);
    hooks.openWin(id);
    sysSnd("exclaim", .5);
  }

  /* ---------- dial-up ---------- */
  function dialup() {
    els.dlUser.value = hooks.playerName();
    hooks.openWin("win-dialup");
  }
  /* the handshake, synthesised: dial tone, DTMF, ringback, answer tone, carrier.
     scheduled one step at a time so Cancel actually shuts it up. */
  function modemStep(i) {
    const T = snd.tone, N = snd.noise;
    if (i === 0) {
      T(350, .7, "sine", .04); T(440, .7, "sine", .04);
      const DT = [[697, 1209], [941, 1336], [941, 1477], [697, 1209], [852, 1336], [770, 1477], [941, 1209]];
      DT.forEach((p, k) => { T(p[0], .08, "sine", .05, .85 + k * .13); T(p[1], .08, "sine", .05, .85 + k * .13); });
    }
    if (i === 1) [0, 1].forEach(k => { T(440, .8, "sine", .04, k * 1.5); T(480, .8, "sine", .04, k * 1.5); });
    if (i === 2) {
      T(2100, .55, "sine", .045);
      N(.35, .022, .5);
      for (let k = 0; k < 8; k++) T(500 + Math.random() * 1900, .12, "sawtooth", .025, .8 + k * .11);
    }
    if (i === 3) { N(.9, .035); T(1800, .5, "square", .018, .1, -1100); }
  }
  const DIALSTEPS = [
    { t: 0, s: "Dialing " + PHONE + "..." },
    { t: 1900, s: "Waiting for a reply..." },
    { t: 4900, s: "Verifying user name and password..." },
    { t: 6700, s: "Registering your computer on the network..." },
  ];
  function connect() {
    hooks.closeWin("win-dialup");
    hooks.openWin("win-dialing");
    DIALSTEPS.forEach((d, i) => later(() => {
      els.dgText.textContent = d.s;
      els.dgBar.style.width = ((i + 1) / (DIALSTEPS.length + 1) * 100) + "%";
      modemStep(i);
    }, d.t));
    later(() => {
      els.dgBar.style.width = "100%";
      hooks.closeWin("win-dialing");
      online = true; offline = false;
      hooks.setNet(true);
      sysSnd("hwin", .5);
      hooks.balloon("Connected at 56.6 Kbps", "cursor$net is connected.\nThis is as fast as it is ever going to get.");
      const u = pending || HOME; pending = null;
      go(u, { replace: !url });
    }, 8100);
  }
  function hangup() {
    online = false; offline = true;
    hooks.setNet(false);
    sysSnd("hwout", .5);
    status("Working offline");
  }
  function cancelDial() {
    clearTimers();
    hooks.closeWin("win-dialing");
    hooks.closeWin("win-dialup");
    offline = true;
    const u = pending || HOME; pending = null;
    render({ url: u, title: "Web page unavailable while offline", cls: "err", html: pageOffline(u) }, true);
  }

  /* ---------- clicks inside a page ---------- */
  const ACTIONS = {
    deploy: () => { hooks.openWin("win-cursors"); hooks.deploy(); },
    amp: () => hooks.openWin("win-amp"),
    mail: () => hooks.openLobby(),
    hall: () => hooks.hallOfPain(),
    refresh: () => go(url || HOME, { replace: true }),
    /* reconnecting means dialing again — go() re-opens the dial-up box itself */
    connect: () => { offline = false; online = false; go(pending || url || HOME, { replace: true }); },
    search: () => {
      const q = els.page.querySelector("#sq");
      go("http://search.msn.com/results?q=" + encodeURIComponent(((q && q.value) || "").trim()));
    },
    buy: () => showError("Security Warning",
      "cursorbot9000.exe\n\nPublisher: unknown. This file has an invalid digital signature.\n\nWindows has blocked this download, which is the single most valuable thing this computer has ever done for you.", true),
    claim: () => {},
    "gb-post": () => {
      const who = els.page.querySelector("#gb-who"), txt = els.page.querySelector("#gb-txt");
      const t = ((txt && txt.value) || "").trim();
      if (!t) { showError("Guestbook", "Write something first.", true); return; }
      const d = new Date();
      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      guests().unshift({
        who: ((who && who.value) || "").trim().slice(0, 18) || "anonymous",
        when: d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(),
        txt: t.slice(0, 220),
      });
      store.save();
      sysSnd("ding", .5);
      go("http://www.cursor.land/guest.html", { replace: true });
    },
  };
  els.page.addEventListener("click", e => {
    const a = e.target.closest("[data-go],[data-act]");
    if (!a) return;
    e.preventDefault();
    if (a.dataset.act) { const f = ACTIONS[a.dataset.act]; if (f) f(); return; }
    sysSnd("nav", .4);
    go(a.dataset.go);
  });
  els.page.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Enter" && e.target.id === "sq") { e.preventDefault(); ACTIONS.search(); }
  });

  /* the hit counter only moves while somebody is looking at it */
  setInterval(() => {
    if (!hooks.isOpen()) return;
    if (Math.random() < .45) hits++;
    const el = els.page.querySelector("#ie-hits");
    if (el) el.textContent = String(hits).padStart(7, "0");
  }, 1600);

  /* ---------- menus ---------- */
  const FAVS = [
    { label: "cursor$land", u: HOME },
    { label: "the odds", u: "http://www.cursor.land/odds.html" },
    { label: "hall of fame", u: "http://www.cursor.land/hall.html" },
    { label: "guestbook", u: "http://www.cursor.land/guest.html" },
    { label: "THE CURSOR WEBRING", u: "http://www.cursorwebring.org/" },
    { label: "MSN Search", u: "http://search.msn.com/" },
  ];
  function srcName() {
    const last = key(url || "").split("/").pop();
    return last && /\./.test(last) && !/^[a-z0-9-]+\.(com|org|net|land)$/i.test(last) ? last : "index.html";
  }
  /* View > Source has to look like somebody typed it, because somebody did */
  function srcView() {
    const u = url || "";
    return `<!-- saved from url=(${String(u.length).padStart(4, "0")})${u} -->
<html>

<head>
<title>${pageTitle}</title>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">
<meta name="GENERATOR" content="Microsoft FrontPage Express 2.0">
</head>

<body bgcolor="#000000" text="#00FF00" link="#5599FF" vlink="#9955FF">
${srcHTML}
</body>

</html>`;
  }
  function menu(label, x, y) {
    const items =
      label === "File" ? [
        { label: "New Window", disabled: 1 },
        { label: "Open...", action: () => hooks.openWin("win-run") },
        { sep: 1 },
        { label: "Save As...", disabled: 1 },
        { label: "Print...", action: () => noPrinter() },
        { sep: 1 },
        { label: "Work Offline", check: offline, action: () => (offline ? ACTIONS.connect() : hangup()) },
        { label: "Close", action: () => hooks.close() },
      ] :
      label === "Edit" ? [
        { label: "Cut", disabled: 1 }, { label: "Copy", disabled: 1 }, { label: "Paste", disabled: 1 },
        { sep: 1 },
        { label: "Select All", disabled: 1 },
        { label: "Find (on This Page)...", action: () => showError("Find", "Find is not implemented.\n\nThe page is right there.", true) },
      ] :
      label === "View" ? [
        { label: "Toolbars", sub: [
          { label: "Standard Buttons", check: 1 }, { label: "Address Bar", check: 1 }, { label: "Links", check: 1 }] },
        { label: "Status Bar", check: 1 },
        { sep: 1 },
        { label: "Refresh", action: () => ACTIONS.refresh() },
        { label: "Text Size", sub: ["Largest", "Larger", "Medium", "Smaller", "Smallest"].map(n => ({ label: n, check: n === "Medium" })) },
        { sep: 1 },
        { label: "Source", action: () => hooks.openText(srcName(), srcView()) },
      ] :
      label === "Favorites" ? [
        { label: "Add to Favorites...", action: () => showError("Add Favorite",
          "Your Favorites folder already contains this page.\n\nIt contains every page. There are ten.", true) },
        { label: "Organize Favorites...", disabled: 1 },
        { sep: 1 },
      ].concat(FAVS.map(f => ({ label: f.label, action: () => go(f.u) }))) :
      label === "Tools" ? [
        { label: "Mail and News", sub: [
          { label: "Read Mail", action: () => hooks.openLobby() },
          { label: "New Message", action: () => hooks.openLobby() }] },
        { label: "Synchronize...", disabled: 1 },
        { label: "Windows Update", action: () => go("http://windowsupdate.microsoft.com/") },
        { sep: 1 },
        { label: "Internet Options...", action: () => showError("Internet Options",
          "These settings are managed by your system administrator.\n\nYou are the system administrator. This is a known issue.", true) },
      ] :
      label === "Help" ? [
        { label: "Contents and Index", action: () => hooks.openWin("win-readme") },
        { label: "Tip of the Day", action: () => showError("Tip of the Day", pick([
          "Did you know? P(ever reaching x N) = 1/N. Exactly.",
          "Did you know? You can bank at any moment. That is the entire skill.",
          "Did you know? Every collision is a coin weighted by money, and the house is not in it.",
          "Did you know? The 94% on deg404's site is a number he chose."]), true) },
        { sep: 1 },
        { label: "About Internet Explorer", action: () => showError("About Internet Explorer",
          "Microsoft Internet Explorer\nVersion 6.0.2900.2180\nCipher Strength: 128-bit\n\nThis browser has ten pages to visit. Four of them are lying to you, and one of them says so.", true) },
      ] : [{ label: "(nothing here)", disabled: 1 }];
    showMenu(items, x, y);
  }
  function noPrinter() {
    showError("Print", "No printer is installed.\n\nThere has never been a printer. The icon is decorative.", true);
  }

  /* ---------- chrome ---------- */
  els.back.addEventListener("click", () => {
    if (!past.length) return;
    future.push(url); const u = past.pop();
    sysSnd("nav", .4); go(u, { replace: true });
  });
  els.fwd.addEventListener("click", () => {
    if (!future.length) return;
    past.push(url); const u = future.pop();
    sysSnd("nav", .4); go(u, { replace: true });
  });
  els.stop.addEventListener("click", stop);
  els.refresh.addEventListener("click", () => go(url || HOME, { replace: true }));
  els.home.addEventListener("click", () => go(HOME));
  els.search.addEventListener("click", () => go("http://search.msn.com/"));
  els.media.addEventListener("click", () => hooks.openWin("win-amp"));
  els.mail.addEventListener("click", () => hooks.openLobby());
  els.print.addEventListener("click", noPrinter);
  els.favs.addEventListener("click", e => {
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(FAVS.map(f => ({ label: f.label, action: () => go(f.u) })), r.left, r.bottom + 2);
  });
  els.hist.addEventListener("click", e => {
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(HISTORY.length
      ? HISTORY.slice(0, 12).map(u => ({ label: u.replace(/^http:\/\/(www\.)?/, ""), action: () => go(u) }))
      : [{ label: "(nothing yet)", disabled: 1 }], r.left, r.bottom + 2);
  });
  els.go.addEventListener("click", () => go(els.addr.value));
  els.addr.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Enter") go(els.addr.value);
  });
  els.addr.addEventListener("focus", () => els.addr.select());
  els.links.querySelectorAll("[data-go]").forEach(a =>
    a.addEventListener("click", () => go(a.dataset.go)));
  els.dlConnect.addEventListener("click", connect);
  els.dlOffline.addEventListener("click", cancelDial);
  els.dlSettings.addEventListener("click", () => showError("cursor$net Settings",
    "Modem: Standard 56000 bps Modem\nPhone number: " + PHONE + "\nRedial attempts: 10\n\nThere are no other settings. There was never any point to this button.", true));
  els.dgCancel.addEventListener("click", cancelDial);

  buttons(); progress(null); status("Done");

  /* openWin calls this on the way in: an empty browser dials out by itself */
  function boot() { if (!url && !loading) go(HOME); }
  function open() { hooks.openWin("win-ie"); }

  return {
    open, boot, go, menu, stop, hangup, popup,
    url: () => url,
    isOnline: () => online,
    /* dev: skip the handshake and be on the wire already */
    connectNow: () => { online = true; offline = false; hooks.setNet(true); },
  };
}
