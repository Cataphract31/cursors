import { approve, arcadeUrl, authHeaders, forgetSession, onDepositArrival, sessionToken, shortAddress } from "./wallet.js";

const LAMPORTS = 1_000_000_000;

export function sol(lamports) {
  const n = Number(lamports ?? 0) / LAMPORTS;
  return n.toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
}

export function toLamports(text) {
  const s = String(text ?? "").trim();
  if (!/^\d*(\.\d*)?$/.test(s) || s === "" || s === ".") return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > 9) return null;
  const n = Number(whole || "0") * LAMPORTS + Number((frac + "000000000").slice(0, 9));
  return Number.isSafeInteger(n) ? n : null;
}

const UNIT = 1_000_000;

const RUNGS = [
  { lamports: 10_000_000, label: "0.01" },
  { lamports: 50_000_000, label: "0.05" },
  { lamports: 100_000_000, label: "0.1" },
  { lamports: 250_000_000, label: "0.25" },
  { lamports: 500_000_000, label: "0.5" },
  { lamports: 1_000_000_000, label: "1" },
];

const PER_PAGE = 5;

const READ_MS = 15_000;
const MOVE_MS = 60_000;

const UNTOUCHED = new Set([
  "NO_SESSION",
  "BAD_BODY",
  "BAD_AMOUNT",
  "BAD_ACCOUNT",
  "BELOW_MINIMUM",
  "DEPOSIT_NOT_FINAL",
  "ALREADY_WITHDRAWING",
  "INSUFFICIENT_FUNDS",
  "CHAIN_UNREACHABLE",
  "CUSTODY_SHORT",
  "SIGNER_AWAY",
  "SIGNER_REFUSED",
  "SIGNER_TIMEOUT",
  "BAD_SIGNATURE",
]);

const ended = (text) => {
  const t = String(text ?? "").trim();
  return !t || /[.!?]$/.test(t) ? t : `${t}.`;
};

const HOLD_MS = 5000;
function createArming({ holdMs = HOLD_MS, clock = Date.now } = {}) {
  let key = null;
  let at = 0;
  return {
    press(next) {
      const live = key !== null && key === next && clock() - at < holdMs;
      if (live) { key = null; return "fire"; }
      key = next;
      at = clock();
      return "armed";
    },
    disarm() { key = null; },
    armed() {
      if (key === null) return null;
      if (clock() - at >= holdMs) { key = null; return null; }
      return key;
    },
  };
}

function explorer(signature, network) {
  const q = network && network !== "mainnet" ? `?cluster=${encodeURIComponent(network)}` : "";
  return `https://solscan.io/tx/${encodeURIComponent(signature)}${q}`;
}

export function initBank({ $, wallet, sysSnd = () => {}, onArcadeBalance = () => {}, onSignIn = () => {} }) {
  const panel = $("#lg-bank");
  const note = $("#lg-banknote");
  let signingIn = false;
  const amtEl = $("#lgb-amt");
  const goEl = $("#lgb-go");
  const sayEl = $("#lgb-say");
  const logEl = $("#lgb-log");
  const loghEl = $("#lgb-logh");
  const pagerEl = $("#lgb-pager");
  const prevEl = $("#lgb-prev");
  const nextEl = $("#lgb-next");
  const pgatEl = $("#lgb-pgat");
  const presetsEl = $("#lgb-presets");
  const arcadeEl = $("#lgb-arcade");
  const chainEl = $("#lgb-chain");
  const chainLbl = $("#lgb-chainlbl");
  const whoEl = $("#lgb-who");
  const dustEl = $("#lgb-dust");
  const tabs = [$("#lgb-t-dep"), $("#lgb-t-wd")];

  let which = "deposit";
  let page = 0;
  let info = null;
  let arcade = 0;
  let chain = null;
  let spendable = 0;
  let history = { deposits: [], withdrawals: [] };
  let served = false;
  let pending = 0;
  let sessionWallet = null;
  const arming = createArming();
  let seenTop;
  let arrival = null;
  let onScreen = false;
  let busy = false;
  let timer = null;
  let watching = 0;

  const put = (el, text) => { el.textContent = String(text ?? ""); };
  const say = (text, kind = "") => { sayEl.className = "lgb-say" + (kind ? " " + kind : ""); put(sayEl, text); };

  async function api(path, opts = {}) {
    const { timeoutMs = READ_MS, ...init } = opts;
    const stop = new AbortController();
    const bell = setTimeout(() => stop.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(arcadeUrl(path), {
        ...init,
        signal: stop.signal,
        headers: { ...(init.headers ?? {}), ...authHeaders() },
      });
    } catch (err) {
      throw Object.assign(
        new Error(stop.signal.aborted ? "The arcade did not answer in time." : "Could not reach the arcade."),
        { code: stop.signal.aborted ? "TIMEOUT" : "OFFLINE", answered: false });
    } finally {
      clearTimeout(bell);
    }

    const isJson = /\bapplication\/json\b/i.test(res.headers.get("content-type") ?? "");
    let parsed = null;
    if (isJson) {
      try { parsed = await res.text().then(t => (t ? JSON.parse(t) : null)); } catch (e) { parsed = null; }
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || parsed?.error?.code === "NO_SESSION") {
        forgetSession();
        draw();
      }
      throw Object.assign(new Error(parsed?.error?.message ?? `The arcade said ${res.status}.`),
        { status: res.status, code: parsed?.error?.code, answered: true });
    }
    if (!isJson) {
      throw Object.assign(new Error("The arcade answered with something that was not an answer."),
        { status: res.status, code: "NOT_JSON", answered: false });
    }
    return parsed;
  }

  const free = () => Math.max(0, arcade - pending);

  const mismatch = () => Boolean(sessionWallet && wallet?.address && sessionWallet !== wallet.address);

  async function refresh() {
    if (!sessionToken()) {
      arcade = 0; chain = null; history = { deposits: [], withdrawals: [] };
      served = false; pending = 0; sessionWallet = null;
      put(arcadeEl, "—"); put(chainEl, "—"); put(whoEl, "not signed in");
      dustEl.hidden = true;
      drawLog();
      return;
    }
    const [bal, hist, mine] = await Promise.allSettled([
      api("/api/ledger/balance"),
      api(`/api/custody/history?kind=${which === "deposit" ? "in" : "out"}`
        + `&page=${page + 1}&perPage=${PER_PAGE}`),
      api("/api/custody/wallet"),
    ]);
    if (bal.status === "fulfilled") {
      const was = arcade;
      arcade = Number(bal.value.balance ?? 0);
      if (arcade !== was) { try { onArcadeBalance(arcade); } catch (e) {} }
      put(arcadeEl, `${sol(arcade)} SOL`);
      arcadeEl.classList.remove("stale");
      sessionWallet = typeof bal.value.wallet === "string" ? bal.value.wallet : null;
      const held = Number(bal.value.held ?? 0);
      put(whoEl, held > 0
        ? `${shortAddress(bal.value.wallet)} · ${sol(held)} staked`
        : shortAddress(bal.value.wallet));
      const dust = arcade % UNIT;
      dustEl.hidden = dust === 0;
      if (dust) put(dustEl, `CURSORS.EXE shows ${(Math.floor(arcade / UNIT) / 1000).toFixed(3)} — the last ${sol(dust)} is under its 0.001 step.`);
    } else {
      arcadeEl.classList.add("stale");
    }
    if (hist.status === "fulfilled") {
      history = hist.value ?? {};
      served = Array.isArray(history.rows);
      pending = Number(history.pending ?? 0);
      if (served) page = Math.max(0, Number(history.page ?? 1) - 1);

      if (!served || history.kind !== "out") {
        const top = newestDeposit();
        const id = top?.signature ?? null;
        if (watching && seenTop !== undefined && id && id !== seenTop) {
          watching = 0;
          say(`Credited. ${sol(top.lamports)} SOL is in the arcade.`, "ok");
          sysSnd("ding", .6);
        }
        seenTop = id;
      }
      drawLog();
    }
    if (mine.status === "fulfilled") {
      chain = Number(mine.value.lamports ?? 0);
      spendable = Number(mine.value.spendable ?? 0);
      put(chainEl, `${sol(chain)} SOL`);
      chainEl.classList.remove("stale");
      put(chainLbl, `in ${wallet?.walletName || "your wallet"}`);
    } else {
      chainEl.classList.add("stale");
      if (chain === null) put(chainEl, "—");
    }
    restate();
  }

  async function poke() {
    try { await api("/api/custody/deposit/check", { method: "POST" }); }
    catch (e) {}
  }

  function presetValue(pre) {
    if (pre.lamports !== undefined) return pre.lamports;
    if (pre.kind === "min") return info?.minWithdrawal ?? 0;
    return which === "deposit" ? spendable : free();
  }

  function buildPresets() {
    presetsEl.textContent = "";
    const list = [
      ...(which === "withdraw" ? [{ kind: "min", label: "min" }] : []),
      ...RUNGS,
      { kind: "max", label: "max" },
    ];
    for (const pre of list) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lgb-preset";
      b.textContent = pre.label;
      b.addEventListener("click", () => {
        if (busy || b.disabled) return;
        const want = presetValue(pre);
        if (want <= 0) return;
        amtEl.value = sol(want);
        sysSnd("nav", .3);
        restate();
      });
      b._pre = pre;
      presetsEl.appendChild(b);
    }
    syncPresets();
  }

  function lockPresets(on) {
    for (const b of presetsEl.children) b.disabled = on || b.disabled;
    if (!on) syncPresets();
  }

  function syncPresets() {
    const typed = toLamports(amtEl.value);
    for (const b of presetsEl.children) {
      const want = presetValue(b._pre);
      const min = which === "withdraw" ? (info?.minWithdrawal ?? 0) : 1;
      const tooMuch = which === "deposit"
        ? (chain !== null && want > spendable)
        : want > free();
      b.disabled = busy || want < min || tooMuch;
      b.classList.toggle("on", typed !== null && typed === want && want > 0);
    }
  }

  function restate() {
    if (busy) return;
    syncPresets();
    const want = toLamports(amtEl.value);
    const typed = amtEl.value.trim();
    if (which === "deposit") {
      put(goEl, want ? `Deposit ${sol(want)} SOL` : "Deposit");
      goEl.classList.remove("out");
      if (!typed) { goEl.disabled = true; if (!sayEl.classList.contains("ok")) say(depositHint()); return; }
      if (want === null) { goEl.disabled = true; say("That is not an amount of SOL.", "bad"); return; }
      if (want <= 0) { goEl.disabled = true; say("That is not an amount of SOL.", "bad"); return; }
      if (chain !== null && want > spendable) {
        goEl.disabled = true;
        say(`Your wallet holds ${sol(chain)} SOL, and ${sol(info?.networkFee ?? 5000)} of it has to stay behind for the network fee.`, "bad");
        return;
      }
      goEl.disabled = false;
      say(depositHint());
      return;
    }
    goEl.classList.add("out");
    const armed = arming.armed();
    put(goEl, armed !== null && armed === amtEl.value.trim()
      ? `Press again to send ${sol(want ?? 0)} SOL`
      : (want ? `Withdraw ${sol(want)} SOL` : "Withdraw"));

    if (mismatch()) {
      goEl.disabled = true;
      say(`Wrong wallet. The arcade pays ${shortAddress(sessionWallet)}, this browser is on `
        + `${shortAddress(wallet.address)}. Reconnect the one you want paying.`, "bad");
      return;
    }
    if (!typed) { goEl.disabled = true; if (!sayEl.classList.contains("ok")) say(withdrawHint()); return; }
    if (want === null || want <= 0) { goEl.disabled = true; say("That is not an amount of SOL.", "bad"); return; }
    if (want > free()) {
      goEl.disabled = true;
      say(arcade > free()
        ? `${sol(arcade - free())} SOL is still confirming on chain. ${sol(free())} SOL can go now.`
        : `You have ${sol(arcade)} SOL in the arcade.`, "bad");
      return;
    }
    if (info && want < info.minWithdrawal) {
      goEl.disabled = true;
      say(`The smallest withdrawal is ${sol(info.minWithdrawal)} SOL.`, "bad");
      return;
    }
    goEl.disabled = false;
    const fee = info?.networkFee ?? 5000;
    say(armed !== null && armed === amtEl.value.trim()
      ? `Press again to send ${sol(want - fee)} SOL to ${shortAddress(sessionWallet ?? wallet?.address)}. It cannot be taken back.`
      : `You receive ${sol(want - fee)} SOL after the ${sol(fee)} SOL network fee.`,
      armed !== null && armed === amtEl.value.trim() ? "busy" : "");
  }

  function depositHint() {
    if (!info) return "The arcade is not taking deposits on this box.";
    return `Your wallet approves the transfer. Sent to the arcade at ${shortAddress(info.address)}; `
      + `credited to ${wallet?.address ? shortAddress(wallet.address) : "the wallet you signed in with"}.`;
  }
  function withdrawHint() {
    const to = wallet?.address ? shortAddress(wallet.address) : "the wallet you signed in with";
    const floor = info ? ` Smallest is ${sol(info.minWithdrawal)} SOL.` : "";
    return `Paid to ${to} — the only address the arcade will pay, so a stolen session cannot send your balance anywhere else.${floor}`;
  }

  async function doDeposit() {
    const want = toLamports(amtEl.value);
    if (want === null || want <= 0) return;
    busy = true; goEl.disabled = true; amtEl.disabled = true; lockPresets(true);
    const label = goEl.textContent;
    put(goEl, "Check your wallet…");
    say("Building the transfer…", "busy");
    try {
      const prep = await api("/api/custody/deposit/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: want }),
      });
      say("Approve it in your wallet.", "busy");
      const signature = await approve(wallet?.provider, prep);
      sysSnd("ding", .55);
      say("");
      const line = document.createElement("span");
      line.textContent = `${sol(want)} SOL sent. Watching for it to confirm… `;
      const a = document.createElement("a");
      a.href = explorer(signature, prep.network ?? info?.network);
      a.target = "_blank"; a.rel = "noopener noreferrer";
      a.textContent = "view it on chain";
      sayEl.className = "lgb-say ok";
      sayEl.append(line, a);
      amtEl.value = "";
      watching = 30;
      await poke();
      await refresh();
    } catch (err) {
      if (err?.code === "CANCELLED") say("Cancelled. Nothing was sent.");
      else if (err?.code === "NO_TX_API") manualFallback();
      else if (err?.code === "WRONG_ACCOUNT") say(err.message, "bad");
      else say(`${ended(err.message)} Nothing has left your wallet.`, "bad");
    } finally {
      busy = false; amtEl.disabled = false; lockPresets(false);
      put(goEl, label);
      restate();
    }
  }

  async function doWithdraw() {
    const want = toLamports(amtEl.value);
    if (want === null || want <= 0) return;
    busy = true; goEl.disabled = true; amtEl.disabled = true; lockPresets(true);
    const label = goEl.textContent;
    put(goEl, "Sending…");
    say("Asking the signer…", "busy");
    try {
      const out = await api("/api/custody/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: want }),
        timeoutMs: MOVE_MS,
      });
      sysSnd("ding", .55);
      say("");
      const line = document.createElement("span");
      line.textContent = out.signature
        ? `${sol(out.receiving)} SOL on its way. `
        : `${sol(out.receiving)} SOL accepted, waiting on the signer. `;
      sayEl.className = out.state === "sent" || out.state === "confirmed" ? "lgb-say ok" : "lgb-say busy";
      sayEl.appendChild(line);
      if (out.signature) {
        const a = document.createElement("a");
        a.href = explorer(out.signature, info?.network);
        a.target = "_blank"; a.rel = "noopener noreferrer";
        a.textContent = "view it on chain";
        sayEl.appendChild(a);
      }
      amtEl.value = "";
      arming.disarm();
      await refresh();
    } catch (err) {
      const sure = err?.answered && UNTOUCHED.has(err.code);
      const why = ended(err.message);
      say(sure
        ? (/untouched/i.test(why) ? why : `${why} Your balance has not been touched.`)
        : `${why} It may or may not have gone. Do not send it again — check the log below `
          + "and the balance above in a few seconds.",
        sure ? "bad" : "busy");
    } finally {
      busy = false; amtEl.disabled = false; lockPresets(false);
      put(goEl, label);
      restate();
    }
  }

  function manualFallback() {
    if (!info) { say("This wallet cannot send a transaction from a page, and the arcade is not taking deposits on this box.", "bad"); return; }
    sayEl.className = "lgb-say";
    sayEl.textContent = "";
    const p = document.createElement("div");
    p.textContent = "This wallet will not take a transaction from a page. Send SOL to the arcade yourself:";
    const code = document.createElement("code");
    code.textContent = info.address;
    const copy = document.createElement("button");
    copy.className = "lgb-max";
    copy.type = "button";
    copy.textContent = "copy address";
    copy.style.marginTop = "4px";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(info.address);
        copy.textContent = "copied";
      } catch (e) {
        const r = document.createRange();
        r.selectNodeContents(code);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        copy.textContent = "selected — press Ctrl+C";
      }
    });
    const warn = document.createElement("div");
    warn.className = "lgb-say bad";
    warn.style.margin = "6px 0 0";
    warn.textContent = info.warning;
    sayEl.append(p, code, document.createElement("br"), copy, warn);
  }

  function newestDeposit() {
    const rows = Array.isArray(history.rows)
      ? history.rows.filter(r => r.kind === "in").map(r => ({ at: r.at, signature: r.signature, lamports: r.amount }))
      : (history.deposits ?? []).map(d => ({ at: d.at, signature: d.signature, lamports: d.lamports }));
    return rows.sort((a, b) => b.at - a.at)[0] ?? null;
  }

  function rowsForTab() {
    const want = which === "deposit" ? "in" : "out";
    if (Array.isArray(history.rows)) {
      return history.rows
        .filter(r => r.kind === want)
        .map(r => ({ at: r.at, kind: r.kind, lamports: r.amount, signature: r.signature, state: r.state }))
        .sort((a, b) => b.at - a.at);
    }
    if (want === "in") {
      return (history.deposits ?? [])
        .map(d => ({ at: d.at, kind: "in", lamports: d.lamports, signature: d.signature, state: d.state ?? "on chain" }))
        .sort((a, b) => b.at - a.at);
    }
    return (history.withdrawals ?? [])
      .map(w => ({ at: w.at, kind: "out", lamports: w.sent, signature: w.signature, state: w.state }))
      .sort((a, b) => b.at - a.at);
  }

  function drawLog() {
    const rows = rowsForTab();
    const pages = served ? Math.max(1, Number(history.pages ?? 1))
      : Math.max(1, Math.ceil(rows.length / PER_PAGE));
    const total = served ? Number(history.total ?? rows.length) : rows.length;
    if (page > pages - 1) page = pages - 1;
    if (page < 0) page = 0;
    const shown = served ? rows : rows.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

    const signedIn = Boolean(sessionToken());
    loghEl.hidden = !signedIn;
    loghEl.textContent = "";
    if (signedIn) {
      const what = document.createElement("span");
      what.textContent = which === "deposit" ? "Deposits" : "Withdrawals";
      const many = document.createElement("span");
      many.textContent = total ? String(total) : "";
      loghEl.append(what, many);
    }

    logEl.textContent = "";
    if (signedIn && !total) {
      const empty = document.createElement("div");
      empty.className = "lgb-le";
      empty.textContent = which === "deposit" ? "Nothing in yet." : "Nothing out yet.";
      logEl.appendChild(empty);
    }
    for (const r of shown) {
      const li = document.createElement("div");
      li.className = "lgb-le";
      const left = document.createElement("b");
      left.className = r.kind === "in" ? "in" : "out";
      left.textContent = `${r.kind === "in" ? "+" : "−"}${sol(r.lamports)} SOL`;
      const right = document.createElement("span");
      if (r.signature) {
        const a = document.createElement("a");
        a.href = explorer(r.signature, info?.network);
        a.target = "_blank"; a.rel = "noopener noreferrer";
        a.textContent = r.state;
        right.appendChild(a);
      } else {
        right.textContent = r.state;
      }
      li.append(left, right);
      logEl.appendChild(li);
    }

    pagerEl.hidden = !signedIn || pages < 2;
    prevEl.disabled = page === 0;
    nextEl.disabled = page >= pages - 1;
    put(pgatEl, `${page + 1} of ${pages}`);
  }

  function showArrival() {
    if (!arrival || !onScreen) return;
    const done = arrival;
    arrival = null;
    which = "deposit";
    page = 0;
    draw();
    if (done.kind !== "deposited") {
      say(done.message ?? "That did not finish.", done.kind === "cancelled" ? "" : "bad");
      return;
    }
    sysSnd("ding", .55);
    say("");
    sayEl.className = "lgb-say ok";
    const line = document.createElement("span");
    line.textContent = `${done.lamports ? `${sol(done.lamports)} SOL` : "Deposit"} sent. `;
    sayEl.appendChild(line);
    if (done.signature) {
      const a = document.createElement("a");
      a.href = explorer(done.signature, info?.network);
      a.target = "_blank"; a.rel = "noopener noreferrer";
      a.textContent = "view it on chain";
      sayEl.appendChild(a);
    }
    watching = 30;
    poke().then(refresh).catch(() => {});
  }

  function draw() {
    const signedIn = Boolean(sessionToken() && wallet?.address);
    panel.hidden = !signedIn;
    note.hidden = signedIn;
    document.getElementById("login")?.classList.toggle("hasbank", signedIn);
    if (!signedIn) {
      note.replaceChildren();
      if (wallet?.address) {
        const line = document.createElement("div");
        line.className = "lgb-notetxt";
        line.textContent = "Your wallet is connected. Sign in to reach your money.";
        const go = document.createElement("button");
        go.className = "lgb-signin";
        go.textContent = "Sign in";
        go.addEventListener("click", () => {
          if (signingIn) return;
          signingIn = true;
          go.disabled = true;
          go.textContent = "Check your wallet…";
          Promise.resolve(onSignIn())
            .catch(() => {})
            .finally(() => { signingIn = false; draw(); });
        });
        note.append(line, go);
        return;
      }
      put(note, "Connect a wallet above to deposit or withdraw. Guests play in a sandbox where nothing is staked.");
      return;
    }
    for (const t of tabs) t.classList.toggle("on", t.dataset.bk === which);
    buildPresets();
    drawLog();
    restate();
  }

  function tick() {
    if (!onScreen || !sessionToken()) return;
    if (watching > 0) watching -= 1;
    if (watching > 0 || which === "deposit") poke().then(refresh).catch(() => {});
    else refresh().catch(() => {});
  }

  async function learn() {
    if (info) return;
    try { info = await api("/api/custody/deposit"); }
    catch (e) { info = null; }
  }

  return {
    async active(on) {
      onScreen = Boolean(on);
      clearInterval(timer); timer = null;
      if (!onScreen) return;
      draw();
      if (!sessionToken()) return;
      await learn();
      draw();
      refresh().catch(() => {});
      timer = setInterval(tick, 4000);
      showArrival();
    },

    sync() {
      if (!onScreen) return;
      this.active(true);
    },

    async check() {
      if (!sessionToken()) return { signedIn: false, arcade: null };
      await learn();
      try {
        const bal = await api("/api/ledger/balance");
        arcade = Number(bal.balance ?? 0);
        return { signedIn: true, arcade };
      } catch (e) {
        return { signedIn: true, arcade: null };
      }
    },

    tell(text, kind) { say(text, kind); },

    show(tab) {
      if (tab === "deposit" || tab === "withdraw") which = tab;
      draw();
      if (!panel.hidden) panel.scrollIntoView({ block: "nearest" });
    },

    mount() {
      onDepositArrival(done => { arrival = done ?? null; showArrival(); });
      for (const t of tabs) t.addEventListener("click", () => {
        if (busy) return;
        which = t.dataset.bk;
        sysSnd("nav", .4);
        amtEl.value = "";
        page = 0;
        arming.disarm();
        say("");
        draw();
        if (sessionToken()) refresh().catch(() => {});
      });
      amtEl.addEventListener("input", () => {
        arming.disarm();
        restate();
      });
      amtEl.addEventListener("keydown", e => { if (e.key === "Enter" && !goEl.disabled) goEl.click(); });
      const turn = (to) => {
        page = to;
        sysSnd("nav", .3);
        if (served) refresh().catch(() => {});
        else drawLog();
      };
      prevEl.addEventListener("click", () => { if (page > 0) turn(page - 1); });
      nextEl.addEventListener("click", () => turn(page + 1));
      goEl.addEventListener("click", () => {
        if (busy || goEl.disabled) return;
        if (which === "deposit") { void doDeposit(); return; }
        if (arming.press(amtEl.value.trim()) === "armed") {
          sysSnd("nav", .4);
          restate();
          setTimeout(() => { if (onScreen && !busy) restate(); }, HOLD_MS + 60);
          return;
        }
        void doWithdraw();
      });
    },
  };
}
