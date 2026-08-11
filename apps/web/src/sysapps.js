/* The XP applications: cmd.exe, Control Panel, Services, Device Manager and
   the Group Policy editor. Import-free sibling module, same contract as
   minesweeper/messenger/paint/explorer — main.js injects assets and shell
   hooks, and the build's smoke runner executes this file in node.

   The rule for all five: they read real state and they do real things. The
   filesystem cmd walks is the one Explorer walks. The services list is what
   the machine is actually running, the game included, and stopping one stops
   it. Device Manager's pointing devices ARE the cursors on the field. Group
   Policy settings actually apply. None of this is a screenshot with a title
   bar on it. */
export function initSysApps(deps) {
  const { $, $$, store, sysSnd, showMenu, showError, openWin, closeWin, hooks } = deps;

  const el = (tag, cls, txt) => {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt != null) d.textContent = txt;
    return d;
  };
  const padL = (s, n) => { s = String(s); return s.length >= n ? s : " ".repeat(n - s.length) + s; };
  const padR = (s, n) => { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); };
  const groupN = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const zero2 = n => (n < 10 ? "0" : "") + n;

  /* ================================================================
     1. cmd.exe — a real interpreter over the real filesystem
     ================================================================ */
  const CMDVER = "Microsoft Windows XP [Version 5.1.2600]";
  const HOME = "C:\\Documents and Settings\\Administrator";
  let cwd = HOME;
  const hist = [];
  let histAt = 0, line = "", screen = null, kbd = null, cmdReady = false;

  let promptFmt = null;   /* PROMPT overrides $P$G */
/* the handful of variables the shell really expanded, so %random% works */
  const expandVars = t => String(t)
    .replace(/%random%/ig, () => Math.floor(Math.random() * 32768))
    .replace(/%date%/ig, () => new Date().toLocaleDateString())
    .replace(/%time%/ig, () => new Date().toLocaleTimeString([], { hour12: false }))
    .replace(/%cd%/ig, () => cwd)
    .replace(/%username%/ig, () => hooks.sysInfo().owner)
    .replace(/%computername%/ig, () => hooks.sysInfo().host);
  function cmdWrite(text) {
    const d = el("div", "cmd-line");
    d.textContent = text === "" ? "\u00a0" : text;
    screen.insertBefore(d, screen.lastChild);
  }
  const cmdPrompt = () => (promptFmt != null ? promptFmt : cwd + ">");
  function drawInput() {
    const c = screen.lastChild;
    c.textContent = cmdPrompt() + line;
    c.appendChild(el("i", "cmd-caret"));
    screen.scrollTop = screen.scrollHeight;
  }
  function cmdClear() {
    screen.innerHTML = "";
    screen.appendChild(el("div", "cmd-line cmd-input"));
    drawInput();
    return true;
  }

  /* --- paths, resolved against Explorer's tree --- */
  function normPath(p) {
    p = p.replace(/\//g, "\\").replace(/\\+$/, "") || "C:\\";
    if (/^[a-z]:$/i.test(p)) p = p.toUpperCase() + "\\";
    return p;
  }
  function parentDir(p) {
    if (/^[A-Za-z]:\\?$/.test(p)) return "C:\\";
    const i = p.lastIndexOf("\\");
    return i <= 2 ? "C:\\" : p.slice(0, i);
  }
  function resolvePath(arg) {
    if (!arg) return cwd;
    let p = arg.replace(/^"|"$/g, "").replace(/\//g, "\\");
    if (p === ".") return cwd;
    if (p === "\\") return "C:\\";
    if (/^[a-zA-Z]:/.test(p)) return normPath(p);
    let base = cwd;
    for (const part of p.split("\\")) {
      if (!part || part === ".") continue;
      if (part === "..") { base = parentDir(base); continue; }
      base = base === "C:\\" ? "C:\\" + part : base + "\\" + part;
    }
    return normPath(base);
  }
  const listDir = p => hooks.fsList(p);

  function stampNow() {
    const d = new Date();
    const h12 = ((d.getHours() + 11) % 12) + 1;
    return `${zero2(d.getMonth() + 1)}/${zero2(d.getDate())}/${d.getFullYear()}  ` +
           `${padL(h12, 2)}:${zero2(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`;
  }
  function doDir(arg) {
    const p = resolvePath(arg);
    const items = listDir(p);
    if (!items) { cmdWrite("The system cannot find the path specified."); return; }
    cmdWrite(" Volume in drive C has no label.");
    cmdWrite(" Volume Serial Number is C0DE-5A17");
    cmdWrite("");
    cmdWrite(" Directory of " + p);
    cmdWrite("");
    let files = 0, dirs = 0, bytes = 0;
    if (p !== "C:\\" && p !== "My Computer") {
      cmdWrite(`${stampNow()}    <DIR>          .`);
      cmdWrite(`${stampNow()}    <DIR>          ..`);
      dirs += 2;
    }
    for (const it of items) {
      if (it.kind === "folder" || it.kind === "drive") {
        cmdWrite(`${stampNow()}    <DIR>          ${it.name}`); dirs++;
      } else {
        cmdWrite(`${stampNow()}    ${padL(groupN(it.size || 0), 14)} ${it.name}`);
        files++; bytes += it.size || 0;
      }
    }
    cmdWrite(`${padL(files, 16)} File(s) ${padL(groupN(bytes), 15)} bytes`);
    cmdWrite(`${padL(dirs, 16)} Dir(s)  ${padL(groupN(hooks.diskFree()), 15)} bytes free`);
  }
  function childPath(parent, it) {
    if (it.go) return it.go;
    return parent === "C:\\" ? "C:\\" + it.name : parent + "\\" + it.name;
  }
  function doTree(p, prefix, depth) {
    const subs = (listDir(p) || []).filter(i => i.kind === "folder" || i.kind === "drive");
    subs.forEach((it, i) => {
      const last = i === subs.length - 1;
      cmdWrite(prefix + (last ? "\\---" : "+---") + it.name);
      if (depth < 4) doTree(childPath(p, it), prefix + (last ? "    " : "|   "), depth + 1);
    });
  }
  function doType(arg) {
    if (!arg) { cmdWrite("The syntax of the command is incorrect."); return; }
    const p = resolvePath(arg);
    const dir = parentDir(p), name = p.slice(dir.length + 1).toLowerCase();
    const items = listDir(dir);
    if (!items) { cmdWrite("The system cannot find the path specified."); return; }
    const hit = items.find(i => i.name.toLowerCase() === name);
    if (!hit) { cmdWrite("The system cannot find the file specified."); return; }
    if (hit.kind === "folder") { cmdWrite("Access is denied."); return; }
    const body = hooks.fsRead(hit);
    if (body == null) { cmdWrite("Access is denied."); return; }
    for (const l of String(body).split("\n")) cmdWrite(l);
  }

  const HELPROWS = [
    ["ARENA", "Reports the state of the arena. ARENA /? for options."],
    ["CD", "Displays the name of or changes the current directory."],
    ["CHKDSK", "Checks a disk and displays a status report."],
    ["CLS", "Clears the screen."],
    ["COLOR", "Sets the default console foreground and background colors."],
    ["CURSOR", "Deploys, lists and recalls cursors. CURSOR /? for options."],
    ["DATE", "Displays the current date."],
    ["DIR", "Displays a list of files and subdirectories in a directory."],
    ["ECHO", "Displays messages."],
    ["EXIT", "Quits the CMD.EXE program (command interpreter)."],
    ["HELP", "Provides Help information for Windows commands."],
    ["HOSTNAME", "Prints the name of the current host."],
    ["IPCONFIG", "Displays all current TCP/IP network configuration values."],
    ["NET", "Manages network resources. Try NET START."],
    ["PING", "Tests connectivity to another host."],
    ["PROMPT", "Changes the cmd.exe command prompt."],
    ["SC", "Communicates with the Service Controller. Try SC QUERY."],
    ["SHUTDOWN", "Allows proper local shutdown of machine. Try SHUTDOWN -s -t 60."],
    ["START", "Starts a separate window to run a specified program."],
    ["SYSTEMINFO", "Displays machine configuration."],
    ["TASKKILL", "Terminates a running process."],
    ["TASKLIST", "Displays all currently running tasks."],
    ["TELNET", "Connects to a host on a given port."],
    ["TIME", "Displays the current time."],
    ["TITLE", "Sets the window title for a CMD.EXE session."],
    ["TRACERT", "Traces the route taken to a destination."],
    ["TREE", "Graphically displays the directory structure of a path."],
    ["TYPE", "Displays the contents of a text file."],
    ["VER", "Displays the Windows version."],
    ["VOL", "Displays a disk volume label and serial number."],
  ];

  const CMDS = {
    help() {
      cmdWrite("For more information on a specific command, type HELP command-name");
      cmdWrite("");
      for (const [c, d] of HELPROWS) cmdWrite(padR(c, 12) + d);
    },
    cls() { return cmdClear(); },
    ver() { cmdWrite(""); cmdWrite(CMDVER); },
    vol() {
      cmdWrite(" Volume in drive C has no label.");
      cmdWrite(" Volume Serial Number is C0DE-5A17");
    },
    hostname() { cmdWrite(hooks.sysInfo().host); },
    date() { cmdWrite("The current date is: " + new Date().toDateString()); },
    time() { cmdWrite("The current time is: " + new Date().toLocaleTimeString([], { hour12: false })); },
    exit() { closeWin("win-cmd"); return true; },
    echo(a) { cmdWrite(a ? expandVars(a) : "ECHO is on."); },
    cd(a) {
      if (!a) { cmdWrite(cwd); return; }
      const p = resolvePath(a);
      if (!listDir(p)) { cmdWrite("The system cannot find the path specified."); return; }
      cwd = p;
    },
    dir(a) { doDir(a); },
    tree(a) {
      const p = resolvePath(a);
      cmdWrite("Folder PATH listing for volume C");
      cmdWrite("Volume serial number is C0DE-5A17");
      cmdWrite(p);
      doTree(p, "", 0);
    },
    type(a) { doType(a); },
    color(a) {
      const HEX = "0123456789ABCDEF";
      const PAL = ["#000000", "#000080", "#008000", "#008080", "#800000", "#800080", "#808000", "#C0C0C0",
                   "#808080", "#0000FF", "#00FF00", "#00FFFF", "#FF0000", "#FF00FF", "#FFFF00", "#FFFFFF"];
      const s = (a || "").trim().toUpperCase();
      if (!s) { screen.style.background = ""; screen.style.color = ""; return; }
      if (!/^[0-9A-F]{2}$/.test(s)) { cmdWrite("Sets the default console foreground and background colors."); return; }
      screen.style.background = PAL[HEX.indexOf(s[0])];
      screen.style.color = PAL[HEX.indexOf(s[1])];
    },
    ipconfig() {
      const n = hooks.netInfo();
      cmdWrite("");
      cmdWrite("Windows IP Configuration");
      cmdWrite("");
      cmdWrite("PPP adapter cursor$net:");
      cmdWrite("");
      cmdWrite("        Connection-specific DNS Suffix  . : " + (n.up ? "cursor.land" : ""));
      cmdWrite("        IP Address. . . . . . . . . . . . : " + (n.up ? n.ip : "0.0.0.0"));
      cmdWrite("        Subnet Mask . . . . . . . . . . . : " + (n.up ? "255.255.255.255" : "0.0.0.0"));
      cmdWrite("        Default Gateway . . . . . . . . . : " + (n.up ? n.gw : ""));
      cmdWrite("");
      if (!n.up) cmdWrite("Media disconnected. Dial cursor$net from Internet Explorer.");
    },
    ping(a) {
      const host = (a || "").trim().split(/\s+/)[0];
      if (!host) { cmdWrite("Usage: ping target_name"); return; }
      const n = hooks.netInfo();
      if (!n.up) { cmdWrite("Ping request could not find host " + host + ". Please check the name and try again."); return; }
      cmdWrite("");
      cmdWrite(`Pinging ${host} [${n.gw}] with 32 bytes of data:`);
      cmdWrite("");
      let tot = 0, lo = 1e9, hi = 0;
      for (let i = 0; i < 4; i++) {
        const ms = Math.max(1, Math.round(n.rtt * (0.8 + Math.random() * 0.5)));
        tot += ms; lo = Math.min(lo, ms); hi = Math.max(hi, ms);
        cmdWrite(`Reply from ${n.gw}: bytes=32 time=${ms}ms TTL=118`);
      }
      cmdWrite("");
      cmdWrite(`Ping statistics for ${n.gw}:`);
      cmdWrite("    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),");
      cmdWrite("Approximate round trip times in milli-seconds:");
      cmdWrite(`    Minimum = ${lo}ms, Maximum = ${hi}ms, Average = ${Math.round(tot / 4)}ms`);
    },
    chkdsk() {
      cmdWrite("The type of the file system is NTFS.");
      cmdWrite("Volume label is CURSORS.");
      cmdWrite("");
      const stages = ["Verifying files...", "Verifying indexes...", "Verifying security descriptors..."];
      let i = 0;
      const step = () => {
        if (i < stages.length) { cmdWrite(stages[i++]); setTimeout(step, 500); return; }
        const free = hooks.diskFree ? hooks.diskFree() : 9 * 1024 * 1024 * 1024;
        const totKB = Math.round(20 * 1024 * 1024), freeKB = Math.round(free / 1024);
        cmdWrite("Windows has checked the file system and found no problems.");
        cmdWrite("");
        cmdWrite("  " + totKB.toLocaleString("en-US") + " KB total disk space.");
        cmdWrite("  " + (totKB - freeKB).toLocaleString("en-US") + " KB in use.");
        cmdWrite("  " + freeKB.toLocaleString("en-US") + " KB available on disk.");
      };
      step();
    },
    shutdown(a) {
      const s = (a || "").trim();
      if (!s || /[-\/]\?/.test(s)) {
        cmdWrite("Usage: shutdown [-s | -r | -a] [-t xx]");
        cmdWrite("       -s: Shutdown the computer");
        cmdWrite("       -r: Shutdown and restart the computer");
        cmdWrite("       -a: Abort a system shutdown");
        cmdWrite("       -t xx: Set timeout for shutdown to xx seconds");
        return;
      }
      if (/(^|\s)-a(\s|$)/.test(s)) {
        if (!hooks.shutdownAbort || !hooks.shutdownAbort())
          cmdWrite("Unable to abort the system shutdown because no shutdown was in progress.");
        return;
      }
      if (/(^|\s)-[sr](\s|$)/.test(s)) {
        const m = /-t\s+(\d+)/.exec(s);
        hooks.shutdownBox(Math.min(600, m ? +m[1] : 30));
      }
    },
    prompt(a) {
      /* $P$G is the default; the real one accepted the whole $-code set */
      promptFmt = (a || "").trim()
        ? a.replace(/\$p/ig, cwd).replace(/\$g/ig, ">").replace(/\$l/ig, "<")
            .replace(/\$b/ig, "|").replace(/\$\$/g, "$").slice(0, 40)
        : null;
    },
    title(a) {
      const t = document.querySelector("#win-cmd .title-bar-text");
      if (t) t.textContent = a || "C:\\WINDOWS\\system32\\cmd.exe";
    },
    tracert(a) {
      const host = (a || "").trim().split(/\s+/)[0];
      if (!host) { cmdWrite("Usage: tracert target_name"); return; }
      const n = hooks.netInfo();
      if (!n.up) { cmdWrite("Unable to resolve target system name " + host + "."); return; }
      cmdWrite("");
      cmdWrite("Tracing route to " + host + " [" + n.gw + "]");
      cmdWrite("over a maximum of 30 hops:");
      cmdWrite("");
      const hops = [["192.168.0.1", 1], ["10.64.0.1", Math.round(n.rtt * .4)], [n.gw, n.rtt]];
      let i = 0;
      const step = () => {
        if (i >= hops.length) { cmdWrite(""); cmdWrite("Trace complete."); return; }
        const [ip, base] = hops[i]; i++;
        const t = () => Math.max(1, Math.round(base * (0.8 + Math.random() * 0.5))) + " ms";
        cmdWrite("  " + i + "    " + padR(t(), 8) + padR(t(), 8) + padR(t(), 8) + ip);
        setTimeout(step, 350);
      };
      step();
    },
    telnet(a) {
      const host = (a || "").trim().split(/\s+/)[0];
      if (!host) { cmdWrite("Usage: telnet host [port]"); return; }
      const n = hooks.netInfo();
      cmdWrite("Connecting To " + host + "...");
      if (!n.up || host !== "arena.cursor.land") {
        setTimeout(() => cmdWrite("Could not open connection to the host, on port 23: Connect failed"), 1400);
        return;
      }
      /* the arena, over telnet: two cursors walk in and one walks out */
      const el = document.createElement("div");
      el.style.whiteSpace = "pre"; el.style.minHeight = "13px";
      screen.appendChild(el); screen.scrollTop = screen.scrollHeight;
      const W2 = 34; let f = 0;
      const anim = setInterval(() => {
        f++;
        const gap = Math.max(0, W2 - f * 2);
        const l = Math.floor((W2 - gap) / 2);
        if (gap > 0) el.textContent = " ".repeat(l) + "\u25b6" + " ".repeat(gap) + "\u25c0";
        else if (f < W2 / 2 + 4) el.textContent = " ".repeat(Math.floor(W2 / 2)) + (f % 2 ? "\u2739" : "\u2716");
        else {
          clearInterval(anim);
          el.textContent = " ".repeat(Math.floor(W2 / 2)) + "\u25b6";
          cmdWrite("");
          cmdWrite("Connection to host lost.");
        }
        screen.scrollTop = screen.scrollHeight;
      }, 130);
    },
    tasklist() {
      cmdWrite("");
      cmdWrite(padR("Image Name", 26) + padR("PID", 8) + padR("Session Name", 16) + padL("Mem Usage", 12));
      cmdWrite("=".repeat(25) + " " + "=".repeat(7) + " " + "=".repeat(15) + " " + "=".repeat(12));
      for (const p of hooks.processes())
        cmdWrite(padR(p.name, 26) + padR(p.pid, 8) + padR("Console", 16) + padL(groupN(p.mem) + " K", 12));
    },
    taskkill(a) {
      const m = /(?:\/im\s+)?(\S+)\s*$/i.exec((a || "").replace(/\/f\b/ig, "").trim());
      if (!m) { cmdWrite("ERROR: Invalid syntax. Type TASKKILL /? for usage."); return; }
      const name = m[1].toLowerCase();
      const p = hooks.processes().find(x => x.name.toLowerCase() === name);
      if (!p) { cmdWrite(`ERROR: The process "${m[1]}" not found.`); return; }
      if (p.critical) {
        cmdWrite(`ERROR: The process "${p.name}" with PID ${p.pid} could not be terminated.`);
        cmdWrite("Reason: Access is denied.");
        return;
      }
      cmdWrite(`SUCCESS: The process "${p.name}" with PID ${p.pid} has been terminated.`);
      hooks.killProcess(p);
    },
    systeminfo() {
      const i = hooks.sysInfo();
      cmdWrite("");
      const rows = [
        ["Host Name", i.host],
        ["OS Name", "Microsoft Windows XP Professional"],
        ["OS Version", "5.1.2600 Service Pack 3 Build 2600"],
        ["Registered Owner", i.owner],
        ["System Up Time", i.uptime],
        ["System Manufacturer", "cursor$land"],
        ["System Model", "ARENA-1280x800"],
        ["Total Physical Memory", i.memTotal],
        ["Available Physical Memory", i.memFree],
        ["Page File Location(s)", "C:\\pagefile.sys"],
      ];
      for (const [k, v] of rows) cmdWrite(padR(k + ":", 28) + v);
    },
    net(a) {
      const parts = (a || "").trim().split(/\s+/);
      if ((parts[0] || "").toLowerCase() === "send") {
        const to = parts[1], text = parts.slice(2).join(" ");
        if (!to || !text) { cmdWrite("The syntax of this command is:"); cmdWrite(""); cmdWrite("NET SEND {name | *} message"); return; }
        if (!hooks.toastsOn || !hooks.toastsOn()) {
          cmdWrite("An error occurred while sending a message to " + to + ".");
          cmdWrite("");
          cmdWrite("The Messenger service has not been started.");
          return;
        }
        hooks.msgPopup(hooks.sysInfo().host, to, text);
        cmdWrite("The message was successfully sent to " + to + ".");
        return;
      }
      if ((a || "").trim().split(/\s+/)[0].toLowerCase() === "start") {
        cmdWrite("These Windows services are started:");
        cmdWrite("");
        for (const s of SERVICES.filter(s => s.state === "Started")) cmdWrite("   " + s.display);
        cmdWrite("");
        cmdWrite("The command completed successfully.");
      } else {
        cmdWrite("The syntax of this command is:");
        cmdWrite("");
        cmdWrite("NET START");
      }
    },
    sc(a) {
      const parts = (a || "").trim().split(/\s+/);
      if ((parts[0] || "").toLowerCase() !== "query") {
        cmdWrite("DESCRIPTION:");
        cmdWrite("        SC is a command line program used for communicating with");
        cmdWrite("        the Service Control Manager.");
        cmdWrite("Usage: sc query [service name]");
        return;
      }
      const one = parts[1] && SERVICES.find(s => s.name.toLowerCase() === parts[1].toLowerCase());
      const set = one ? [one] : SERVICES.filter(s => s.state === "Started");
      for (const s of set) {
        cmdWrite("");
        cmdWrite("SERVICE_NAME: " + s.name);
        cmdWrite("        TYPE               : 20  WIN32_SHARE_PROCESS");
        cmdWrite("        STATE              : " + (s.state === "Started" ? "4  RUNNING" : "1  STOPPED"));
        cmdWrite("        WIN32_EXIT_CODE    : 0  (0x0)");
      }
      cmdWrite("");
    },
    start(a) {
      const t = (a || "").trim();
      if (!t) { cmdWrite("The system cannot find the path specified."); return; }
      if (hooks.runCommand(t.toLowerCase())) return;
      cmdWrite("The system cannot find the file " + t + ".");
    },
    arena(a) {
      const opt = (a || "").trim().toUpperCase();
      if (opt === "/?") {
        cmdWrite("Reports the state of the arena.");
        cmdWrite("");
        cmdWrite("ARENA            Summary of the current epoch.");
        cmdWrite("ARENA /LIST      Every cursor on the field.");
        cmdWrite("ARENA /DISK      Corpse budget and free space.");
        return;
      }
      const s = hooks.arenaState();
      if (opt === "/LIST") {
        cmdWrite("");
        cmdWrite(padR("ID", 7) + padR("OWNER", 16) + padR("BOUNTY", 10) + padR("MULT", 8) + "STATE");
        cmdWrite("=".repeat(6) + " " + "=".repeat(15) + " " + "=".repeat(9) + " " + "=".repeat(7) + " " + "=".repeat(8));
        for (const c of s.cursors)
          cmdWrite(padR(c.id, 7) + padR(c.owner, 16) + padR(c.bounty, 10) + padR("x" + c.mult, 8) + c.mode);
        cmdWrite("");
        cmdWrite(s.cursors.length + " cursor(s) on the field.");
        return;
      }
      if (opt === "/DISK") {
        cmdWrite("");
        cmdWrite(padR("Corpse size:", 24) + "12 MB");
        cmdWrite(padR("Corpses to a crash:", 24) + s.corpses);
        cmdWrite(padR("Corpses written:", 24) + s.deaths);
        cmdWrite(padR("Disk in use:", 24) + s.diskPct + "%");
        cmdWrite("");
        cmdWrite("When C: is full, CURSORS.EXE cannot write the next corpse and stops.");
        cmdWrite("Every live cursor is banked at full value before that happens.");
        return;
      }
      cmdWrite("");
      cmdWrite(padR("Epoch:", 24) + s.epoch + (s.net ? "  (beta server)" : "  (offline sandbox)"));
      cmdWrite(padR("Phase:", 24) + s.phase);
      cmdWrite(padR("Uptime:", 24) + s.uptime);
      cmdWrite(padR("Cursors on field:", 24) + s.cursors.length);
      cmdWrite(padR("Value in play:", 24) + s.inPlay + " SOL");
      cmdWrite(padR("Disk:", 24) + s.diskPct + "% (" + s.deaths + "/" + s.corpses + " corpses)");
      cmdWrite(padR("Seed commit:", 24) + (s.commit || "(none)"));
    },
    cursor(a) {
      const parts = (a || "").trim().split(/\s+/);
      const sub = (parts[0] || "").toUpperCase();
      if (!sub || sub === "/?") {
        cmdWrite("Deploys, lists and recalls cursors.");
        cmdWrite("");
        cmdWrite("CURSOR /LIST                   Your cursors.");
        cmdWrite("CURSOR /DEPLOY [n]             Deploy n cursors, 0.1 SOL each.");
        cmdWrite("CURSOR /RECALL                 Bank everything you have out.");
        cmdWrite("CURSOR /STANCE ATTACK|DEFEND   Standing order for all of them.");
        return;
      }
      if (sub === "/LIST") {
        const mine = hooks.arenaState().cursors.filter(c => c.mine);
        if (!mine.length) { cmdWrite("You have no cursors on the field."); return; }
        cmdWrite("");
        cmdWrite(padR("ID", 7) + padR("BOUNTY", 10) + padR("MULT", 8) + "STATE");
        for (const c of mine) cmdWrite(padR(c.id, 7) + padR(c.bounty, 10) + padR("x" + c.mult, 8) + c.mode);
        return;
      }
      if (sub === "/DEPLOY") {
        const n = Math.max(1, Math.min(5, parseInt(parts[1], 10) || 1));
        let ok = 0;
        for (let i = 0; i < n; i++) if (hooks.deploy()) ok++;
        cmdWrite(ok ? `Deployed ${ok} cursor(s).` : "Deploy refused. Check your balance and your live count.");
        return;
      }
      if (sub === "/RECALL") { hooks.recall(); cmdWrite("Recall order issued. Banking takes three seconds."); return; }
      if (sub === "/STANCE") {
        const st = (parts[1] || "").toLowerCase();
        if (st !== "attack" && st !== "defend") { cmdWrite("Usage: CURSOR /STANCE ATTACK|DEFEND"); return; }
        hooks.stance(st);
        cmdWrite("Standing order: " + st.toUpperCase());
        return;
      }
      cmdWrite("Invalid switch. Type CURSOR /? for usage.");
    },
  };
  const ALIAS = { chdir: "cd", ls: "dir", clear: "cls", quit: "exit", cat: "type" };
  const DENIED = ["del", "erase", "rmdir", "rd", "mkdir", "md", "copy", "xcopy", "move", "ren", "rename", "format", "attrib", "diskpart"];

  function runLine(raw) {
    const t = raw.trim();
    if (!t) return;
    const sp = t.indexOf(" ");
    const word = sp < 0 ? t : t.slice(0, sp);
    let cmd = word.toLowerCase();
    const arg = sp < 0 ? "" : t.slice(sp + 1).trim();
    if (ALIAS[cmd]) cmd = ALIAS[cmd];
    if (DENIED.indexOf(cmd) >= 0) { cmdWrite("Access is denied."); return; }
    const fn = CMDS[cmd];
    if (!fn) {
      cmdWrite(`'${word}' is not recognized as an internal or external command,`);
      cmdWrite("operable program or batch file.");
      return;
    }
    try { return fn(arg); }
    catch (e) { cmdWrite("The system cannot execute the specified program."); }
  }

  function cmdKey(e) {
    if (e.key === "Enter") {
      const cur = screen.lastChild;
      cur.textContent = cmdPrompt() + line;
      cur.className = "cmd-line";
      screen.appendChild(el("div", "cmd-line cmd-input"));
      const l = line;
      line = "";
      if (l.trim()) { hist.push(l); if (hist.length > 60) hist.shift(); }
      histAt = hist.length;
      if (!runLine(l)) { cmdWrite(""); drawInput(); }
      return true;
    }
    if (e.key === "Backspace") { line = line.slice(0, -1); drawInput(); return true; }
    if (e.key === "ArrowUp") { if (histAt > 0) { histAt--; line = hist[histAt] || ""; drawInput(); } return true; }
    if (e.key === "ArrowDown") { histAt = Math.min(hist.length, histAt + 1); line = hist[histAt] || ""; drawInput(); return true; }
    if (e.key === "Escape") { line = ""; drawInput(); return true; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { line += e.key; drawInput(); return true; }
    return false;
  }

  function cmdOpen() {
    if (!cmdReady) {
      cmdReady = true;
      screen.innerHTML = "";
      screen.appendChild(el("div", "cmd-line cmd-input"));
      cmdWrite(CMDVER);
      cmdWrite("(C) Copyright 1985-2001 Microsoft Corp.");
      cmdWrite("");
      drawInput();
    }
    setTimeout(() => { try { kbd.focus({ preventScroll: true }); } catch (e) { /* older engines */ } }, 30);
  }

  /* ================================================================
     2. Services — the real console, and stopping one really stops it
     ================================================================ */
  /* Two tiers, and the line between them is the whole point.

     `local` services touch nothing but your own machine — your sound, your
     theme, your notifications — so you may stop them and the only person
     affected is you.

     Everything else belongs to the house: the arena, the ledger, the fairness
     provider, the plumbing they sit on. This is a live multiplayer game played
     for money. A control that appears to stop the rakeback ledger is a lie
     even when it is only lying to you, so those services refuse with the error
     a real managed machine gives you, and the properties sheet greys out. */
  const SERVICES = [
    { name: "AudioSrv", display: "Windows Audio", state: "Started", start: "Automatic", logon: "Local System", local: 1, ctl: "audio",
      desc: "Manages audio devices for Windows-based programs. Stopping it mutes this computer.",
      path: "C:\\WINDOWS\\System32\\svchost.exe -k netsvcs" },
    { name: "Themes", display: "Themes", state: "Started", start: "Automatic", logon: "Local System", local: 1, ctl: "themes",
      desc: "Provides user experience theme management. Stopping it returns this desktop to the classic appearance.",
      path: "C:\\WINDOWS\\System32\\svchost.exe -k netsvcs" },
    { name: "Messenger", display: "Messenger", state: "Started", start: "Automatic", logon: "Local System", local: 1, ctl: "toasts",
      desc: "Transmits alert messages between clients and servers. Stopping it silences pop-up notifications on this computer. The lobby keeps running.",
      path: "C:\\WINDOWS\\System32\\svchost.exe -k netsvcs" },
    { name: "W32Time", display: "Windows Time", state: "Started", start: "Automatic", logon: "Local System", local: 1, ctl: "clock",
      desc: "Maintains date and time synchronization. Stopping it stops the clock in the notification area.",
      path: "C:\\WINDOWS\\System32\\svchost.exe -k netsvcs" },
    { name: "Spooler", display: "Print Spooler", state: "Started", start: "Automatic", logon: "Local System", local: 1,
      desc: "Loads files to memory for later printing.", path: "C:\\WINDOWS\\system32\\spoolsv.exe" },
    { name: "Schedule", display: "Task Scheduler", state: "Started", start: "Automatic", logon: "Local System", local: 1,
      desc: "Enables a user to configure and schedule automated tasks on this computer.",
      path: "C:\\WINDOWS\\System32\\svchost.exe -k netsvcs" },
    { name: "SysMain", display: "Error Reporting Service", state: "Started", start: "Automatic", logon: "Local System", local: 1,
      desc: "Allows error reporting for services and applications running in non-standard environments.",
      path: "C:\\WINDOWS\\System32\\svchost.exe -k netsvcs" },
    { name: "Alerter", display: "Alerter", state: "Stopped", start: "Manual", logon: "Local Service", local: 1,
      desc: "Notifies selected users and computers of administrative alerts.",
      path: "C:\\WINDOWS\\System32\\svchost.exe -k LocalService" },
    { name: "ClipSrv", display: "ClipBook", state: "Stopped", start: "Manual", logon: "Local System", local: 1,
      desc: "Enables ClipBook Viewer to store information and share it with remote computers.",
      path: "C:\\WINDOWS\\system32\\clipsrv.exe" },
    { name: "TlntSvr", display: "Telnet", state: "Stopped", start: "Disabled", logon: "Local System", local: 1,
      desc: "Enables a remote user to log on to this computer and run programs.",
      path: "C:\\WINDOWS\\system32\\tlntsvr.exe" },
    { name: "wuauserv", display: "Automatic Updates", state: "Stopped", start: "Disabled", logon: "Local System", local: 1,
      desc: "Enables the download and installation of Windows updates.",
      path: "C:\\WINDOWS\\system32\\svchost.exe -k netsvcs" },
    { name: "SharedAccess", display: "Windows Firewall/Internet Connection Sharing", state: "Stopped", start: "Disabled", logon: "Local System", local: 1,
      desc: "Provides network address translation and name resolution for computers on your home network.",
      path: "C:\\WINDOWS\\System32\\svchost.exe -k netsvcs" },

    /* --- the house's own, all protected --- */
    { name: "Arena", display: "CURSORS.EXE Arena Service", state: "Started", start: "Automatic", logon: "Local System",
      desc: "Runs the cursor arena and writes a 12 MB corpse for every death. This service runs on the game server, not on this computer, and cannot be controlled from here.",
      path: "\\\\CURSORS-BETA\\arena.dll" },
    { name: "Rake", display: "Rakeback Ticket Ledger", state: "Started", start: "Automatic", logon: "Local System",
      desc: "Mints 200 tickets per deploy and decays every balance on a 45-day half-life. Runs on the game server. Your rakeback accrues whether this computer is on or not.",
      path: "\\\\CURSORS-BETA\\ledger.dll" },
    { name: "Fairness", display: "Commit-Reveal Fairness Provider", state: "Started", start: "Automatic", logon: "Local System",
      desc: "Publishes sha256(seed) before each epoch and reveals the seed at the crash. Runs on the game server, where nobody with a keyboard can turn it off.",
      path: "\\\\CURSORS-BETA\\rng.dll" },
    { name: "PlugPlay", display: "Plug and Play", state: "Started", start: "Automatic", logon: "Local System",
      desc: "Enables this computer to recognize and adapt to hardware changes. Every deployed cursor arrives through this service.",
      path: "C:\\WINDOWS\\system32\\services.exe" },
    { name: "EventLog", display: "Event Log", state: "Started", start: "Automatic", logon: "Local System",
      desc: "Enables event log messages issued by Windows-based programs to be viewed in Event Viewer.",
      path: "C:\\WINDOWS\\system32\\services.exe" },
    { name: "RpcSs", display: "Remote Procedure Call (RPC)", state: "Started", start: "Automatic", logon: "Local System",
      desc: "Provides the endpoint mapper and other miscellaneous RPC services.",
      path: "C:\\WINDOWS\\system32\\svchost.exe -k rpcss" },
    { name: "RasMan", display: "Remote Access Connection Manager", state: "Started", start: "Manual", logon: "Local System",
      desc: "Creates a network connection. Manages the dial-up connection to cursor$net.",
      path: "C:\\WINDOWS\\System32\\svchost.exe -k netsvcs" },
  ];
  SERVICES.sort((a, b) => a.display.localeCompare(b.display));

  let svcSel = null;

  function svcApply(s, started) {
    s.state = started ? "Started" : "Stopped";
    if (s.ctl) hooks.serviceChanged(s.ctl, started);
  }
  /* the error a real managed machine gives you, verbatim */
  function svcDenied(s, verb) {
    showError("Services",
      "Could not " + verb + " the " + s.display + " service on Local Computer.\n\n" +
      "Error 5: Access is denied.");
  }
  function svcAct(s, action) {
    if (!s) return;
    if (!s.local) { svcDenied(s, action === "start" ? "start" : action === "restart" ? "restart" : "stop"); return; }
    if (action === "start" && s.state === "Started") return;
    if (action !== "start" && s.state !== "Started") return;
    if (action === "restart") { svcApply(s, false); setTimeout(() => { svcApply(s, true); svcRender(); }, 400); }
    else svcApply(s, action === "start");
    sysSnd(action === "start" ? "hwin" : "hwout", .45);
    svcRender();
  }
  function svcMenu(s, x, y) {
    svcSel = s; svcRender();
    showMenu([
      { label: "Start", disabled: !s.local || s.state === "Started", action: () => svcAct(s, "start") },
      { label: "Stop", disabled: !s.local || s.state !== "Started", action: () => svcAct(s, "stop") },
      { label: "Restart", disabled: !s.local || s.state !== "Started", action: () => svcAct(s, "restart") },
      { sep: 1 },
      { label: "Properties", bold: true, action: () => svcProps(s) },
    ], x, y);
  }
  function svcProps(s) {
    const b = $("#mmcprops-body");
    $("#win-mmcprops .title-bar-text").textContent = s.display + " Properties (Local Computer)";
    b.innerHTML = "";
    const kv = (k, v) => {
      const r = el("div", "pr-row");
      r.appendChild(el("span", "pr-k", k));
      r.appendChild(el("span", "pr-v", v));
      b.appendChild(r);
    };
    b.appendChild(el("div", "xtabs on-one")).appendChild(el("span", "xtab on", "General"));
    kv("Service name:", s.name);
    kv("Display name:", s.display);
    const d = el("div", "pr-row");
    d.appendChild(el("span", "pr-k", "Description:"));
    d.appendChild(el("span", "pr-desc", s.desc));
    b.appendChild(d);
    kv("Path to executable:", s.path);
    const sr = el("div", "pr-row");
    sr.appendChild(el("span", "pr-k", "Startup type:"));
    const sel = el("select");
    for (const o of ["Automatic", "Manual", "Disabled"]) {
      const op = el("option", null, o);
      if (o === s.start) op.selected = true;
      sel.appendChild(op);
    }
    sel.disabled = !s.local;
    sel.addEventListener("change", () => { s.start = sel.value; svcRender(); });
    sr.appendChild(sel);
    b.appendChild(sr);
    b.appendChild(el("div", "pr-hr"));
    kv("Service status:", s.state);
    const row = el("div", "pr-btns");
    for (const [label, act, on] of [["Start", "start", s.local && s.state !== "Started"],
                                    ["Stop", "stop", s.local && s.state === "Started"],
                                    ["Pause", "pause", false],
                                    ["Resume", "resume", false]]) {
      const btn = el("button", "xbtn", label);
      btn.disabled = !on;
      btn.addEventListener("click", () => { svcAct(s, act); svcProps(s); });
      row.appendChild(btn);
    }
    b.appendChild(row);
    if (!s.local) b.appendChild(el("div", "pr-locked",
      "You do not have permission to start, stop or configure this service."));
    const foot = el("div", "dlg-foot");
    const ok = el("button", "xbtn", "OK");
    ok.addEventListener("click", () => closeWin("win-mmcprops"));
    foot.appendChild(ok);
    b.appendChild(foot);
    openWin("win-mmcprops");
  }
  function svcRender() {
    const list = $("#svc-list");
    if (!list) return;
    list.innerHTML = "";
    const head = el("div", "mmc-row mmc-head");
    for (const [t, c] of [["Name", "c-name"], ["Description", "c-desc"], ["Status", "c-st"], ["Startup Type", "c-start"], ["Log On As", "c-log"]])
      head.appendChild(el("span", "mmc-c " + c, t));
    list.appendChild(head);
    for (const s of SERVICES) {
      const r = el("div", "mmc-row" + (s === svcSel ? " sel" : ""));
      r.appendChild(el("span", "mmc-c c-name", s.display));
      r.appendChild(el("span", "mmc-c c-desc", s.desc));
      r.appendChild(el("span", "mmc-c c-st", s.state === "Started" ? "Started" : ""));
      r.appendChild(el("span", "mmc-c c-start", s.start));
      r.appendChild(el("span", "mmc-c c-log", s.logon));
      r.addEventListener("click", () => { svcSel = s; svcRender(); svcStatus(); });
      r.addEventListener("dblclick", () => svcProps(s));
      r.addEventListener("contextmenu", e => { e.preventDefault(); svcMenu(s, e.clientX, e.clientY); });
      list.appendChild(r);
    }
    svcStatus();
  }
  function svcStatus() {
    const st = $("#svc-status");
    if (st) st.textContent = svcSel ? svcSel.display + "  —  " + svcSel.desc.split(".")[0] + "." : SERVICES.length + " service(s)";
  }

  /* ================================================================
     3. Device Manager — the pointing devices are the live cursors
     ================================================================ */
  const DEVCLASSES = [
    { name: "Computer", items: () => [{ n: "ACPI Multiprocessor PC" }] },
    { name: "Disk drives", items: () => [{ n: "CURSOR$LAND ARENA-20G SCSI Disk Device", note: "The round clock. Every death writes 12 MB here." }] },
    { name: "Display adapters", items: () => [{ n: "cursor$land Bliss Accelerator 8 MB" }] },
    { name: "DVD/CD-ROM drives", items: () => [{ n: "GENERIC DVD-ROM 16X", warn: true, note: "No disc in drive." }] },
    { name: "Human Interface Devices", items: () => [{ n: "HID-compliant consumer control device" }, { n: "USB Human Interface Device" }] },
    { name: "Keyboards", items: () => [{ n: "Standard 101/102-Key or Microsoft Natural PS/2 Keyboard" }] },
    {
      name: "Mice and other pointing devices",
      /* the whole point of this console existing in this game */
      items: () => {
        const s = hooks.arenaState();
        const out = [{ n: "PS/2 Compatible Mouse" }];
        for (const c of s.cursors)
          out.push({
            id: c.id,
            n: `${c.owner} cursor (#${c.id})`,
            note: `Carrying ${c.bounty} SOL, x${c.mult}. State: ${c.mode}.` + (c.mine ? " This device is yours." : ""),
            live: true, mine: c.mine,
          });
        if (s.cursors.length === 0) out.push({ n: "No cursors deployed", warn: true, note: "Deploy from CURSORS.EXE to add a pointing device." });
        return out;
      },
    },
    { name: "Monitors", items: () => [{ n: "Plug and Play Monitor" }] },
    { name: "Network adapters", items: () => [{ n: "cursor$net Dial-Up Adapter", warn: () => !hooks.netInfo().up, note: () => hooks.netInfo().up ? "Connected at 56.6 Kbps." : "This device is not connected. Dial from Internet Explorer." }] },
    { name: "Ports (COM & LPT)", items: () => [{ n: "Communications Port (COM1)" }, { n: "Printer Port (LPT1)" }] },
    { name: "Sound, video and game controllers", items: () => [{ n: "Audio Codecs" }, { n: "Legacy Audio Drivers" }, { n: "cursor$land Wave Device" }] },
    { name: "System devices", items: () => [{ n: "ACPI Fixed Feature Button" }, { n: "System CMOS/real time clock" }, { n: "hopium.sys", warn: true, note: "This device is not working properly because Windows cannot load the drivers required for this device. (Code 31)" }, { n: "copium.drv", warn: true, note: "Windows cannot verify the digital signature for the drivers required for this device. (Code 52)" }] },
    { name: "Universal Serial Bus controllers", items: () => [{ n: "Standard OpenHCD USB Host Controller" }, { n: "USB Root Hub" }] },
  ];
  const devOpen = new Set(["Mice and other pointing devices"]);
  let devSel = null;

  const devVal = v => (typeof v === "function" ? v() : v);

  function devRender() {
    const host = $("#dev-tree");
    if (!host) return;
    host.innerHTML = "";
    const root = el("div", "mmc-node root");
    root.appendChild(el("i", "mmc-tw open"));
    root.appendChild(el("span", "mmc-lbl", hooks.sysInfo().host));
    host.appendChild(root);
    for (const cls of DEVCLASSES) {
      const open = devOpen.has(cls.name);
      const n = el("div", "mmc-node lvl1");
      const tw = el("i", "mmc-tw" + (open ? " open" : ""));
      tw.addEventListener("click", e => { e.stopPropagation(); open ? devOpen.delete(cls.name) : devOpen.add(cls.name); devRender(); });
      n.appendChild(tw);
      n.appendChild(el("span", "mmc-lbl", cls.name));
      n.addEventListener("click", () => { open ? devOpen.delete(cls.name) : devOpen.add(cls.name); devRender(); });
      host.appendChild(n);
      if (!open) continue;
      for (const it of cls.items()) {
        const warn = devVal(it.warn);
        const d = el("div", "mmc-node lvl2" + (devSel && devSel.n === it.n ? " sel" : "") + (warn ? " warn" : "") + (it.mine ? " mine" : ""));
        d.appendChild(el("i", "mmc-dot" + (it.live ? " live" : "") + (warn ? " bad" : "")));
        d.appendChild(el("span", "mmc-lbl", it.n));
        d.addEventListener("click", () => { devSel = Object.assign({ cls: cls.name }, it); devRender(); devStatus(); });
        d.addEventListener("dblclick", () => devProps(Object.assign({ cls: cls.name }, it)));
        d.addEventListener("contextmenu", e => {
          e.preventDefault();
          devSel = Object.assign({ cls: cls.name }, it); devRender();
          showMenu([
            { label: "Update Driver...", action: () => showError("Hardware Update Wizard", "Windows could not find a better match for your hardware than the software you currently have installed.") },
            /* recalling your own cursor from Device Manager is fair game — it
               is your money and it is the same order the RECALL button sends.
               Somebody else's cursor is not yours to disable. */
            { label: "Disable", disabled: !it.mine, action: () => hooks.recallOne(it.id) },
            { label: "Uninstall", disabled: true },
            { sep: 1 },
            { label: "Scan for hardware changes", action: () => { devRender(); sysSnd("hwin", .4); } },
            { sep: 1 },
            { label: "Properties", bold: true, action: () => devProps(Object.assign({ cls: cls.name }, it)) },
          ], e.clientX, e.clientY);
        });
        host.appendChild(d);
      }
    }
    devStatus();
  }
  function devStatus() {
    const st = $("#dev-status");
    if (st) st.textContent = devSel ? devSel.cls + "  \\  " + devSel.n : "";
  }
  function devProps(it) {
    const b = $("#mmcprops-body");
    $("#win-mmcprops .title-bar-text").textContent = it.n + " Properties";
    b.innerHTML = "";
    b.appendChild(el("div", "xtabs on-one")).appendChild(el("span", "xtab on", "General"));
    const row = (k, v) => {
      const r = el("div", "pr-row");
      r.appendChild(el("span", "pr-k", k));
      r.appendChild(el("span", "pr-v", v));
      b.appendChild(r);
    };
    row("Device type:", it.cls);
    row("Manufacturer:", it.live ? "cursor$land" : "(Standard system devices)");
    row("Location:", it.live ? "on the arena bus" : "PCI bus 0, device 1, function 0");
    b.appendChild(el("div", "pr-hr"));
    const st = el("div", "pr-row");
    st.appendChild(el("span", "pr-k", "Device status:"));
    st.appendChild(el("span", "pr-status" + (devVal(it.warn) ? " bad" : ""),
      devVal(it.note) || "This device is working properly."));
    b.appendChild(st);
    const foot = el("div", "dlg-foot");
    const ok = el("button", "xbtn", "OK");
    ok.addEventListener("click", () => closeWin("win-mmcprops"));
    foot.appendChild(ok);
    b.appendChild(foot);
    openWin("win-mmcprops");
  }

  /* ================================================================
     4. Group Policy — settings that actually take effect
     ================================================================ */
  const POLICIES = {
    "Computer Configuration/Windows Settings/Security Settings": [
      { id: "audit", n: "Audit account logon events", d: "Determines whether to audit each instance of a user logging on.", ro: true },
      { id: "cad", n: "Interactive logon: Do not require CTRL+ALT+DEL", d: "This computer has no CTRL+ALT+DEL. The Welcome screen is the logon.", ro: true },
    ],
    "Computer Configuration/Administrative Templates/System": [
      { id: "nocmd", n: "Prevent access to the command prompt", d: "Prevents users from running the interactive command prompt, cmd.exe. If you enable this setting, cmd.exe closes and will not reopen from Run or the Start menu." },
      { id: "noregedit", n: "Prevent access to registry editing tools", d: "Disables regedit.exe. This computer ships without it, so the setting has nothing to disable.", ro: true },
      { id: "verbose", n: "Verbose vs normal status messages", d: "Directs the system to display highly detailed status messages during startup and shutdown. Enable it and the boot screen prints what it is actually doing." },
    ],
    "User Configuration/Administrative Templates/Desktop": [
      { id: "nodesktop", n: "Hide and disable all items on the desktop", d: "Removes icons, shortcuts and other default and user-defined items from the desktop. The arena and the taskbar are not affected." },
      { id: "nobin", n: "Remove Recycle Bin icon from desktop", d: "Removes most occurrences of the Recycle Bin icon. Death certificates remain readable from My Computer." },
      { id: "nowall", n: "Prohibit changes to the desktop background", d: "Prevents users from changing the wallpaper, including from Paint's File > Set As Background." },
    ],
    "User Configuration/Administrative Templates/Start Menu and Taskbar": [
      { id: "norun", n: "Remove Run menu from Start Menu", d: "Removes the Run command from the Start menu and disables the Run dialog." },
      { id: "noclock", n: "Remove Clock from the system notification area", d: "Prevents the clock in the system notification area from being displayed." },
      { id: "nobal", n: "Turn off all balloon notifications", d: "Prevents notification balloons from appearing above the notification area." },
    ],
    "User Configuration/Administrative Templates/CURSORS.EXE": [
      { id: "nocrt", n: "Turn off CRT glass", d: "Disables the scanlines, glare and curvature applied to the whole display. Equivalent to clearing the CRT box in Display Properties." },
      { id: "noauto", n: "Prohibit autoplay", d: "Removes the AUTOPLAY controls from the dashboard and stops any autoplay already running. Deploys and recalls remain manual." },
      { id: "nosound", n: "Mute all system and game sounds", d: "Silences every sound the machine makes, as if Mute were ticked in the volume flyout." },
      { id: "showodds", n: "Always show duel odds", d: "Displays each cursor's win probability above it at all times, not only during a duel. The number is a/(a+b) by bounty and it is the same number the server used." },
    ],
  };
  const POLPATHS = Object.keys(POLICIES);
  const polOpen = new Set(["Computer Configuration", "User Configuration",
    "User Configuration/Administrative Templates", "Computer Configuration/Administrative Templates"]);
  let polPath = POLPATHS[POLPATHS.length - 1], polSel = null;

  const polState = () => (store.data.gp = store.data.gp || {});
  function polSet(id, v) {
    polState()[id] = v;
    store.save();
    hooks.policyChanged(id, v);
  }
  const polGet = id => polState()[id] || "Not configured";

  /* the tree is derived from the policy paths, so adding a policy adds its folder */
  function polTree() {
    const nodes = [];
    const seen = new Set();
    for (const p of POLPATHS) {
      const parts = p.split("/");
      for (let i = 0; i < parts.length; i++) {
        const key = parts.slice(0, i + 1).join("/");
        if (seen.has(key)) continue;
        seen.add(key);
        nodes.push({ key, label: parts[i], depth: i, leaf: i === parts.length - 1 });
      }
    }
    return nodes;
  }
  function polRender() {
    const tree = $("#pol-tree");
    if (!tree) return;
    tree.innerHTML = "";
    const root = el("div", "mmc-node root");
    root.appendChild(el("i", "mmc-tw open"));
    root.appendChild(el("span", "mmc-lbl", "Local Computer Policy"));
    tree.appendChild(root);
    for (const n of polTree()) {
      const parent = n.key.split("/").slice(0, -1).join("/");
      if (parent && !polOpen.has(parent)) continue;
      let hidden = false;
      const parts = n.key.split("/");
      for (let i = 1; i < parts.length; i++) if (!polOpen.has(parts.slice(0, i).join("/"))) hidden = true;
      if (hidden) continue;
      const has = POLPATHS.some(p => p !== n.key && p.indexOf(n.key + "/") === 0);
      const d = el("div", "mmc-node lvl" + Math.min(3, n.depth + 1) + (n.key === polPath ? " sel" : ""));
      const tw = el("i", "mmc-tw" + (has ? (polOpen.has(n.key) ? " open" : "") : " none"));
      if (has) tw.addEventListener("click", e => {
        e.stopPropagation();
        polOpen.has(n.key) ? polOpen.delete(n.key) : polOpen.add(n.key);
        polRender();
      });
      d.appendChild(tw);
      d.appendChild(el("span", "mmc-lbl", n.label));
      d.addEventListener("click", () => {
        if (POLICIES[n.key]) { polPath = n.key; polSel = null; }
        else { polOpen.has(n.key) ? polOpen.delete(n.key) : polOpen.add(n.key); }
        polRender();
      });
      tree.appendChild(d);
    }
    const list = $("#pol-list");
    list.innerHTML = "";
    const head = el("div", "mmc-row mmc-head");
    head.appendChild(el("span", "mmc-c c-pol", "Setting"));
    head.appendChild(el("span", "mmc-c c-state", "State"));
    list.appendChild(head);
    for (const p of (POLICIES[polPath] || [])) {
      const r = el("div", "mmc-row" + (polSel === p ? " sel" : ""));
      const nm = el("span", "mmc-c c-pol");
      nm.appendChild(el("i", "pol-ico"));
      nm.appendChild(el("span", null, p.n));
      r.appendChild(nm);
      r.appendChild(el("span", "mmc-c c-state", polGet(p.id)));
      r.addEventListener("click", () => { polSel = p; polRender(); });
      r.addEventListener("dblclick", () => polProps(p));
      r.addEventListener("contextmenu", e => {
        e.preventDefault(); polSel = p; polRender();
        showMenu([{ label: "Properties", bold: true, action: () => polProps(p) },
                  { sep: 1 },
                  { label: "Help", action: () => polProps(p) }], e.clientX, e.clientY);
      });
      list.appendChild(r);
    }
    const st = $("#pol-status");
    if (st) st.textContent = polSel ? polSel.d : (POLICIES[polPath] || []).length + " setting(s)";
  }
  function polProps(p) {
    const b = $("#mmcprops-body");
    $("#win-mmcprops .title-bar-text").textContent = p.n + " Properties";
    b.innerHTML = "";
    const tabs = el("div", "xtabs");
    const t1 = el("span", "xtab on", "Setting"), t2 = el("span", "xtab", "Explain");
    tabs.appendChild(t1); tabs.appendChild(t2);
    b.appendChild(tabs);
    const setting = el("div", "pol-pane");
    const explain = el("div", "pol-pane", p.d);
    explain.style.display = "none";
    t1.addEventListener("click", () => { t1.className = "xtab on"; t2.className = "xtab"; setting.style.display = ""; explain.style.display = "none"; });
    t2.addEventListener("click", () => { t2.className = "xtab on"; t1.className = "xtab"; explain.style.display = ""; setting.style.display = "none"; });
    setting.appendChild(el("div", "pol-title", p.n));
    const cur = polGet(p.id);
    for (const opt of ["Not configured", "Enabled", "Disabled"]) {
      const lab = el("label", "pol-radio");
      const r = el("input");
      r.type = "radio"; r.name = "polstate"; r.checked = cur === opt; r.disabled = !!p.ro;
      r.addEventListener("change", () => { polSet(p.id, opt); polRender(); });
      lab.appendChild(r);
      lab.appendChild(el("span", null, opt));
      setting.appendChild(lab);
    }
    if (p.ro) setting.appendChild(el("div", "pol-note", "This setting cannot be changed on this computer."));
    b.appendChild(setting);
    b.appendChild(explain);
    const foot = el("div", "dlg-foot");
    const ok = el("button", "xbtn", "OK");
    ok.addEventListener("click", () => closeWin("win-mmcprops"));
    foot.appendChild(ok);
    b.appendChild(foot);
    openWin("win-mmcprops");
  }

  /* ================================================================
     5. Control Panel — category view and classic view, both real
     ================================================================ */
  const APPLETS = [
    { n: "Display", ico: "cpanel32", d: "Change the appearance of your desktop, such as the background, screen saver, colors, font sizes, and screen resolution.", open: () => openWin("win-dispprops"), cat: "appearance" },
    { n: "Date and Time", ico: "cpanel32", d: "Set the date, time, and time zone for your computer.", open: () => hooks.openClock(), cat: "datetime" },
    { n: "Sounds and Audio Devices", ico: "trayVol", d: "Change the sound scheme for your computer, or configure the settings for your speakers and recording devices.", open: () => hooks.openVolume(), cat: "sounds" },
    { n: "System", ico: "computer32", d: "See information about your computer, and change settings for hardware, performance, and automatic updates.", open: () => openWin("win-sysprops"), cat: "performance" },
    { n: "Administrative Tools", ico: "@ic-mmc", d: "Configure administrative settings for your computer.", open: () => openWin("win-services"), cat: "performance" },
    { n: "Add or Remove Programs", ico: "@ic-cpl", d: "Install or remove programs and Windows components.", open: () => hooks.addRemove(), cat: "performance" },
    { n: "Network Connections", ico: "connect32", d: "Connect to other computers, networks, and the Internet.", open: () => hooks.openNetwork(), cat: "network" },
    { n: "Internet Options", ico: "ie32", d: "Configure your Internet display and connection settings.", open: () => hooks.openIE(), cat: "network" },
    { n: "Mouse", ico: "@ic-dev", d: "Customize your mouse settings, such as the button configuration, double-click speed, mouse pointers, and motion speed.", open: () => hooks.openMouse ? hooks.openMouse() : openWin("win-devmgr"), cat: "printers" },
    { n: "Printers and Faxes", ico: "printer32", d: "Show installed printers and fax printers and help you add new ones.", open: () => hooks.printers(), cat: "printers" },
    { n: "User Accounts", ico: "user48", d: "Change user account settings and passwords for people who share this computer.", open: () => hooks.userAccounts(), cat: "users" },
    { n: "Fonts", ico: "folder32", d: "View, add, or remove fonts on your computer.", open: () => hooks.fonts(), cat: "appearance" },
    { n: "Folder Options", ico: "openfolder32", d: "Customize the display of files and folders, change file associations, and make network files available offline.", open: () => hooks.folderOptions(), cat: "appearance" },
    { n: "Accessibility Options", ico: "help32", d: "Adjust your computer settings for vision, hearing, and mobility.", open: () => hooks.accessibility(), cat: "accessibility" },
  ];
  const CATS = [
    { id: "appearance", n: "Appearance and Themes", ico: "cpanel32", tasks: ["Change the computer's theme", "Change the desktop background", "Choose a screen saver"] },
    { id: "network", n: "Network and Internet Connections", ico: "connect32", tasks: ["Set up or change your Internet connection", "Create a connection to the network at your workplace"] },
    { id: "performance", n: "Performance and Maintenance", ico: "computer32", tasks: ["See basic information about your computer", "Free up space on your hard disk", "Back up your data"] },
    { id: "printers", n: "Printers and Other Hardware", ico: "printer32", tasks: ["View installed printers or fax printers", "Add a printer"] },
    { id: "users", n: "User Accounts", ico: "user48", tasks: ["Change an account", "Create a new account"] },
    { id: "datetime", n: "Date, Time, Language, and Regional Options", ico: "cpanel32", tasks: ["Change the date and time", "Change the format of numbers, dates, and times"] },
    { id: "sounds", n: "Sounds, Speech, and Audio Devices", ico: "trayVol", tasks: ["Adjust the system volume", "Change the sound scheme"] },
    { id: "accessibility", n: "Accessibility Options", ico: "help32", tasks: ["Adjust the contrast for text and colors on your screen", "Configure Windows to work for your vision, hearing, and mobility needs"] },
  ];

  function cplRender() {
    const host = $("#cpl-body");
    if (!host) return;
    const classic = !!store.data.cplClassic;
    host.innerHTML = "";
    host.appendChild(el("div", "menubar")).innerHTML = "<span>File</span><span>Edit</span><span>View</span><span>Favorites</span><span>Tools</span><span>Help</span>";
    const split = el("div", "cpl-split");
    /* the blue task pane, which is where XP put the view switch */
    const side = el("div", "cpl-side");
    const box = el("div", "cpl-box");
    box.appendChild(el("div", "cpl-boxhead", "Control Panel"));
    const sw = el("a", "cpl-task", classic ? "Switch to Category View" : "Switch to Classic View");
    sw.addEventListener("click", () => { store.data.cplClassic = !classic; store.save(); sysSnd("nav", .4); cplRender(); });
    box.appendChild(sw);
    side.appendChild(box);
    const box2 = el("div", "cpl-box");
    box2.appendChild(el("div", "cpl-boxhead", "See Also"));
    for (const [label, fn] of [["Windows Update", () => hooks.windowsUpdate()],
                               ["Help and Support", () => openWin("win-help")],
                               ["Command Prompt", () => openWin("win-cmd")]]) {
      const a = el("a", "cpl-task", label);
      a.addEventListener("click", fn);
      box2.appendChild(a);
    }
    side.appendChild(box2);
    split.appendChild(side);

    const main = el("div", "cpl-main" + (classic ? " classic" : ""));
    if (classic) {
      for (const a of APPLETS) {
        const it = el("div", "cpl-applet");
        it.appendChild(deps.icoNode(a.ico));
        it.appendChild(el("span", "cpl-aname", a.n));
        it.title = a.d;
        it.addEventListener("dblclick", () => { sysSnd("nav", .4); a.open(); });
        it.addEventListener("click", () => { if (deps.isMobile) { sysSnd("nav", .4); a.open(); } });
        main.appendChild(it);
      }
    } else {
      main.appendChild(el("h1", "cpl-h1", "Pick a category"));
      const grid = el("div", "cpl-cats");
      for (const c of CATS) {
        const card = el("div", "cpl-cat");
        const ic = el("div", "cpl-caticon");
        ic.appendChild(deps.icoNode(c.ico));
        card.appendChild(ic);
        const body = el("div", "cpl-catbody");
        body.appendChild(el("div", "cpl-catname", c.n));
        for (const t of c.tasks) body.appendChild(el("div", "cpl-cattask", t));
        card.appendChild(body);
        card.addEventListener("click", () => {
          sysSnd("nav", .4);
          const a = APPLETS.find(x => x.cat === c.id);
          if (a) a.open();
        });
        grid.appendChild(card);
      }
      main.appendChild(grid);
    }
    split.appendChild(main);
    host.appendChild(split);
  }

  /* ================================================================
     MMC chrome: one host, three consoles (which is what MMC is)
     ================================================================ */
  function mmcShell(body, kind) {
    body.innerHTML = "";
    const bar = el("div", "menubar");
    bar.innerHTML = "<span>File</span><span>Action</span><span>View</span><span>Help</span>";
    body.appendChild(bar);
    const tb = el("div", "mmc-tb");
    for (const g of ["back", "fwd", "up", "sep", "show", "refresh", "sep", "help"])
      tb.appendChild(el("i", g === "sep" ? "mmc-tbsep" : "mmc-tbb " + g));
    body.appendChild(tb);
    const split = el("div", "mmc-split");
    const left = el("div", "mmc-tree");
    const right = el("div", "mmc-right");
    if (kind === "services") {
      left.innerHTML = "";
      const root = el("div", "mmc-node root");
      root.appendChild(el("i", "mmc-tw open"));
      root.appendChild(el("span", "mmc-lbl", "Services (Local)"));
      left.appendChild(root);
      const n = el("div", "mmc-node lvl1 sel");
      n.appendChild(el("i", "mmc-tw none"));
      n.appendChild(el("span", "mmc-lbl", "Services"));
      left.appendChild(n);
      /* Extended/Standard is XP's description-pane toggle, and it toggles */
      const tabs = el("div", "mmc-tabs");
      const ex = el("span", "on", "Extended"), sd = el("span", null, "Standard");
      ex.addEventListener("click", () => { ex.className = "on"; sd.className = ""; right.classList.remove("standard"); });
      sd.addEventListener("click", () => { sd.className = "on"; ex.className = ""; right.classList.add("standard"); });
      tabs.appendChild(ex); tabs.appendChild(sd);
      right.appendChild(tabs);
      const list = el("div", "mmc-list"); list.id = "svc-list";
      right.appendChild(list);
    } else if (kind === "devmgr") {
      left.id = "dev-tree";
      left.classList.add("wide");
      right.style.display = "none";
    } else {
      left.id = "pol-tree";
      const list = el("div", "mmc-list"); list.id = "pol-list";
      right.appendChild(list);
    }
    split.appendChild(left);
    split.appendChild(right);
    body.appendChild(split);
    const st = el("div", "mmc-status");
    st.id = kind === "services" ? "svc-status" : kind === "devmgr" ? "dev-status" : "pol-status";
    body.appendChild(st);
  }

  let built = {};
  function openConsole(kind) {
    const id = kind === "services" ? "win-services" : kind === "devmgr" ? "win-devmgr" : "win-gpedit";
    const body = document.querySelector('#' + id + ' .mmc-body');
    if (!built[kind]) { mmcShell(body, kind); built[kind] = true; }
    if (kind === "services") svcRender();
    else if (kind === "devmgr") devRender();
    else polRender();
    openWin(id);
  }

  /* Device Manager is a live view of the field: refresh it while it is open */
  setInterval(() => {
    if (built.devmgr && document.getElementById("win-devmgr").style.display === "flex") devRender();
  }, 1500);

  return {
    cmdOpen,
    key:e=>cmdKey(e),   /* dev hashes drive the console like a keyboard */
    cplRender,
    openConsole,
    services: () => SERVICES,
    serviceOn: ctl => { const s = SERVICES.find(x => x.ctl === ctl); return !s || s.state === "Started"; },
    /* msconfig's Services tab drives the same list this console does */
    svcSet: (name, on) => {
      const s = SERVICES.find(x => x.name === name || x.display === name);
      if (!s) return false;
      if (!s.local) { svcDenied(s, on ? "start" : "stop"); return false; }
      svcApply(s, on);
      try { svcRender(); } catch (e) {}
      return true;
    },
    policy: id => polGet(id),
    policyOn: id => polGet(id) === "Enabled",
    init: () => { screen = $("#cmd-screen"); kbd = $("#cmd-kbd"); wireCmd(); },
  };

  function wireCmd() {
    const focusKbd = () => { try { kbd.focus({ preventScroll: true }); } catch (e) { /* older engines */ } };
    screen.addEventListener("pointerdown", e => { e.stopPropagation(); focusKbd(); });
    /* the real keyboard path is a hidden input, so a phone raises its on-screen
       keyboard and the shell's --kb handling lifts the window clear of it */
    kbd.addEventListener("keydown", e => { e.stopPropagation(); if (cmdKey(e)) e.preventDefault(); });
    /* An Android IME does not send a usable keydown — it reports keyCode 229
       with key "Unidentified" and delivers the real text on `input`. Throwing
       that away is why the prompt stayed empty while you typed on a phone.
       Take the characters from here and let keydown keep the control keys.
       (The on-screen-keyboard applet dispatches synthetic keydowns at this
       same field, so both paths have to keep working.) */
    kbd.addEventListener("input", () => {
      const txt = kbd.value;
      kbd.value = "";
      if (!txt) return;
      for (const ch of txt) cmdKey({ key: ch });
    });
    document.getElementById("win-cmd").addEventListener("pointerdown", () => setTimeout(focusKbd, 0));
  }
}
