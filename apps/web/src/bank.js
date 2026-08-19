/* MY WALLET: money into the arcade and back out, on the welcome screen.

   WHY IT IS HERE AND NOT IN A PANEL OF ITS OWN
   The arcade ships one BANK for every world it hosts -- one gold button in
   the corner of the page, one modal behind it, the same on every table. That
   is exactly right for a shelf of games that look like each other. This
   machine is a Windows XP desktop, so the shared furniture arrived as a gold
   OSRS button floating over the taskbar: the single most important control on
   the page, and the one thing on screen that looked like somebody else's
   browser extension. A control people distrust is a control they do not press.

   So the arcade's bank is switched off for this world (`ownBank` in the
   arcade's games.js) and this is what stands in its place. Same ledger, same
   custody wallet, same withdrawal that can only ever pay the address that
   signed in -- nothing about the money changed. What changed is that it is
   XP furniture now, on the screen this machine already uses to ask who you
   are, beside the tile that signs you in. A balance is what an identity is
   for; putting the two in one place is not decoration.

   THE DEPOSIT DOES THE TRANSFER FOR YOU, WHICH IS THE REAL CHANGE
   Depositing used to be: here is our address, copy it, paste it into your
   wallet, type the amount, get the network right, and hope. Every one of
   those steps is a place to lose money nobody can give back, and pasting an
   address is the step clipboard-swapping malware was written for. Now the
   arcade builds the transfer and your wallet is asked to approve it, with the
   destination and the amount rendered by the wallet -- software you trust,
   not this page.

   THE BYTES ARE NOT BUILT HERE. /api/custody/deposit/prepare returns them,
   because the arcade already owns one tested implementation of a System
   Program transfer and its withdrawal signer builds against the same
   function. A second implementation of money-moving bytes, in a browser, is
   the mistake the arcade's signer-core.mjs exists to warn about. See
   `approve` in wallet.js for what this page does and does not vouch for.

   THE MANUAL PATH IS STILL HERE, one press away, for a wallet that will not
   answer signAndSendTransaction. It is a fallback rather than the front door,
   and it is the only place the "money from an exchange is credited to the
   exchange" warning still appears -- because on the automatic path the
   transfer comes out of the wallet you signed in with, by construction, so
   there is nothing left to warn about. */

import { approve, arcadeUrl, authHeaders, sessionToken, shortAddress } from "./wallet.js";

const LAMPORTS = 1_000_000_000;

/** Lamports as a number of SOL a person would actually write. */
export function sol(lamports) {
  const n = Number(lamports ?? 0) / LAMPORTS;
  return n.toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * A typed amount of SOL as whole lamports, or null if it is not one.
 *
 * Deliberately NOT Math.round(parseFloat(x) * 1e9). 0.1 + 0.2 is the oldest
 * joke in the language and this is somebody's money: parseFloat("4.35") * 1e9
 * is 4349999999.999999, and rounding hides it right until the amount that
 * rounds the wrong way. The halves of the decimal string are made whole
 * separately, so nothing is ever a fraction.
 */
export function toLamports(text) {
  const s = String(text ?? "").trim();
  if (!/^\d*(\.\d*)?$/.test(s) || s === "" || s === ".") return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > 9) return null;
  const n = Number(whole || "0") * LAMPORTS + Number((frac + "000000000").slice(0, 9));
  return Number.isSafeInteger(n) ? n : null;
}

/* The game deals in thousandths of a SOL and the books count lamports, so a
   balance can hold a remainder too small for the arena to see. Rather than let
   this panel and CURSORS.EXE print two different numbers at each other, the
   remainder gets said out loud. */
const UNIT = 1_000_000;

/**
 * Which chain the box is pointed at, so a receipt links somewhere real.
 * The box tells us; guessing mainnet for a devnet signature shows "not found",
 * which reads as a lost deposit rather than as a wrong link.
 */
function explorer(signature, network) {
  const q = network && network !== "mainnet" ? `?cluster=${encodeURIComponent(network)}` : "";
  return `https://solscan.io/tx/${encodeURIComponent(signature)}${q}`;
}

/**
 * @param {object} deps
 * @param {(sel: string) => Element} deps.$
 * @param {object} deps.wallet the Wallet from wallet.js -- for its provider
 * @param {(name: string, vol?: number) => void} deps.sysSnd
 */
export function initBank({ $, wallet, sysSnd = () => {}, onArcadeBalance = () => {} }) {
  const panel = $("#lg-bank");
  const note = $("#lg-banknote");
  const amtEl = $("#lgb-amt");
  const goEl = $("#lgb-go");
  const maxEl = $("#lgb-max");
  const sayEl = $("#lgb-say");
  const logEl = $("#lgb-log");
  const arcadeEl = $("#lgb-arcade");
  const chainEl = $("#lgb-chain");
  const chainLbl = $("#lgb-chainlbl");
  const whoEl = $("#lgb-who");
  const dustEl = $("#lgb-dust");
  const tabs = [$("#lgb-t-dep"), $("#lgb-t-wd")];

  let which = "deposit";
  let info = null;            /* address, network, minWithdrawal, networkFee */
  let arcade = 0;             /* lamports in the books */
  let chain = null;           /* lamports in the player's own wallet, or null */
  let spendable = 0;          /* chain minus the fee the transfer itself costs */
  let history = { deposits: [], withdrawals: [] };
  let seenDeposits = 0;
  let onScreen = false;
  let busy = false;
  let timer = null;
  /* A deposit just approved: poll harder until the arcade sees it, then stop.
     Counted in ticks so a tab left open overnight is not still hammering. */
  let watching = 0;

  const put = (el, text) => { el.textContent = String(text ?? ""); };
  const say = (text, kind = "") => { sayEl.className = "lgb-say" + (kind ? " " + kind : ""); put(sayEl, text); };

  /* ---------- talking to the arcade ---------- */

  async function api(path, opts = {}) {
    const res = await fetch(arcadeUrl(path), {
      ...opts,
      headers: { ...(opts.headers ?? {}), ...authHeaders() },
    });
    const text = await res.text();
    const parsed = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw Object.assign(new Error(parsed?.error?.message ?? `the arcade said ${res.status}`),
        { status: res.status, code: parsed?.error?.code });
    }
    return parsed;
  }

  /**
   * THE NUMBERS ONLY -- never the markup.
   *
   * A poll that redrew the form would take the caret out of the amount field
   * every few seconds, and worse, it would wipe the receipt line the moment
   * after a deposit lands, which is the one moment somebody is reading it.
   * So this writes text nodes and nothing else.
   */
  async function refresh() {
    if (!sessionToken()) {
      arcade = 0; chain = null; history = { deposits: [], withdrawals: [] };
      put(arcadeEl, "—"); put(chainEl, "—"); put(whoEl, "not signed in");
      dustEl.hidden = true;
      drawLog();
      return;
    }
    /* Three calls, one round trip's worth of waiting. A failure in any of them
       leaves that number stale rather than blanking the panel: a balance that
       flickers to "—" on one bad request teaches people to distrust it. */
    const [bal, hist, mine] = await Promise.allSettled([
      api("/api/ledger/balance"),
      api("/api/custody/history"),
      api("/api/custody/wallet"),
    ]);
    if (bal.status === "fulfilled") {
      const was = arcade;
      arcade = Number(bal.value.balance ?? 0);
      /* THE DESKTOP IS SHOWING THE SAME MONEY, and this poll is the only thing
         in the build that notices it move. The arena's balance is PUSHED by
         the server -- on sign-in and on every settlement -- so it covers every
         way money moves inside the game and none of the ways it moves outside
         one: a deposit made right here, a withdrawal, a win paid by another
         game in the arcade. Somebody funded their account on this screen,
         clicked back to the desktop, and CURSORS.EXE went on showing what it
         showed before the deposit until the next kill or a reload.

         The number is NOT handed over, only the fact that it moved: the arena
         counts in whole play units and the books count in lamports, and a
         second place doing that conversion is a second place to get it wrong.
         main.js asks the server, which answers in the units it owns. */
      if (arcade !== was) { try { onArcadeBalance(arcade); } catch (e) {} }
      put(arcadeEl, `${sol(arcade)} SOL`);
      arcadeEl.classList.remove("stale");
      const held = Number(bal.value.held ?? 0);
      put(whoEl, held > 0
        ? `${shortAddress(bal.value.wallet)} · ${sol(held)} staked`
        : shortAddress(bal.value.wallet));
      /* the remainder the arena cannot see, named rather than hidden */
      const dust = arcade % UNIT;
      dustEl.hidden = dust === 0;
      if (dust) put(dustEl, `CURSORS.EXE shows ${(Math.floor(arcade / UNIT) / 1000).toFixed(3)} — the last ${sol(dust)} is under its 0.001 step.`);
    } else {
      arcadeEl.classList.add("stale");
    }
    if (hist.status === "fulfilled") {
      /* A deposit landing while somebody watches is the whole point of the
         fast poll, and it is worth saying out loud rather than leaving them to
         notice a number changed. */
      const before = seenDeposits;
      history = hist.value;
      seenDeposits = history.deposits?.length ?? 0;
      if (watching && seenDeposits > before) {
        watching = 0;
        say(`Credited. ${sol(history.deposits[0].lamports)} SOL is in the arcade.`, "ok");
        sysSnd("ding", .6);
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
      /* The chain being unreachable is not this player's problem and must not
         block a withdrawal, which needs none of this. */
      chainEl.classList.add("stale");
      if (chain === null) put(chainEl, "—");
    }
    restate();
  }

  /** "Somebody is watching." The box holds a cooldown; leaning on it is safe. */
  async function poke() {
    try { await api("/api/custody/deposit/check", { method: "POST" }); }
    catch (e) { /* the box's own minute-wide tick still gets it */ }
  }

  /* ---------- what the form is allowed to do right now ---------- */

  function restate() {
    if (busy) return;
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
    put(goEl, want ? `Withdraw ${sol(want)} SOL` : "Withdraw");
    goEl.classList.add("out");
    if (!typed) { goEl.disabled = true; if (!sayEl.classList.contains("ok")) say(withdrawHint()); return; }
    if (want === null || want <= 0) { goEl.disabled = true; say("That is not an amount of SOL.", "bad"); return; }
    if (want > arcade) { goEl.disabled = true; say(`You have ${sol(arcade)} SOL in the arcade.`, "bad"); return; }
    if (info && want < info.minWithdrawal) {
      goEl.disabled = true;
      say(`The smallest withdrawal is ${sol(info.minWithdrawal)} SOL.`, "bad");
      return;
    }
    goEl.disabled = false;
    say(`You receive ${sol(want - (info?.networkFee ?? 5000))} SOL after the ${sol(info?.networkFee ?? 5000)} SOL network fee.`);
  }

  function depositHint() {
    if (!info) return "The arcade is not taking deposits on this box.";
    return `Your wallet approves the transfer. Sent to the arcade at ${shortAddress(info.address)}; `
      + `credited to ${wallet?.address ? shortAddress(wallet.address) : "the wallet you signed in with"}.`;
  }
  function withdrawHint() {
    const to = wallet?.address ? shortAddress(wallet.address) : "the wallet you signed in with";
    return `Paid to ${to} — the only address the arcade will pay, so a stolen session cannot send your balance anywhere else.`;
  }

  /* ---------- the two verbs ---------- */

  async function doDeposit() {
    const want = toLamports(amtEl.value);
    if (want === null || want <= 0) return;
    busy = true; goEl.disabled = true; amtEl.disabled = true; maxEl.disabled = true;
    const label = goEl.textContent;
    put(goEl, "Check your wallet…");
    say("Building the transfer…", "busy");
    try {
      /* No destination in this body. `to` is custody and `from` is whoever the
         session proved -- neither is ours to choose. See the arcade's
         createCustodyRoutes for why that is not a courtesy. */
      const prep = await api("/api/custody/deposit/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: want }),
      });
      say("Approve it in your wallet.", "busy");
      const signature = await approve(wallet?.provider, prep.message);
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
      /* Poll hard for two minutes. The arcade's own scan is a minute wide,
         which is far too slow for somebody standing here watching. */
      watching = 30;
      await poke();
      await refresh();
    } catch (err) {
      if (err?.code === "CANCELLED") say("Cancelled. Nothing was sent.");
      else if (err?.code === "NO_TX_API") manualFallback();
      else say(`${err.message} Nothing has left your wallet.`, "bad");
    } finally {
      busy = false; amtEl.disabled = false; maxEl.disabled = false;
      put(goEl, label);
      restate();
    }
  }

  async function doWithdraw() {
    const want = toLamports(amtEl.value);
    if (want === null || want <= 0) return;
    busy = true; goEl.disabled = true; amtEl.disabled = true; maxEl.disabled = true;
    const label = goEl.textContent;
    put(goEl, "Sending…");
    say("Asking the signer…", "busy");
    try {
      /* An amount, and nothing else. There is no destination field, and adding
         one would be the whole vulnerability. */
      const out = await api("/api/custody/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: want }),
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
      await refresh();
    } catch (err) {
      /* Say what the box said. "The signer is not attached" means withdrawals
         are paused because the machine holding the key is away, and somebody
         told that will come back rather than assume the arcade ate their
         money. The balance is untouched on every one of these paths, which is
         the sentence worth adding. */
      say(`${err.message} Your balance has not been touched.`, "bad");
    } finally {
      busy = false; amtEl.disabled = false; maxEl.disabled = false;
      put(goEl, label);
      restate();
    }
  }

  /**
   * THE OLD WAY, for a wallet that will not be asked to send a transaction.
   *
   * This is the only place the exchange warning still belongs: on the
   * automatic path the money leaves the wallet that signed in, so it cannot
   * arrive from an address the player is unable to sign for. Here it can, and
   * that mistake is the one nothing in this panel can undo.
   */
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

  /* ---------- receipts ---------- */

  function drawLog() {
    const rows = [
      ...(history.deposits ?? []).map(d => ({ at: d.at, kind: "in", lamports: d.lamports, signature: d.signature, state: "on chain" })),
      ...(history.withdrawals ?? []).map(w => ({ at: w.at, kind: "out", lamports: w.sent, signature: w.signature, state: w.state })),
    ].sort((a, b) => b.at - a.at).slice(0, 4);
    logEl.textContent = "";
    for (const r of rows) {
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
  }

  /* ---------- the panel's own life ---------- */

  function draw() {
    const signedIn = Boolean(sessionToken() && wallet?.address);
    panel.hidden = !signedIn;
    note.hidden = signedIn;
    document.getElementById("login")?.classList.toggle("hasbank", signedIn);
    if (!signedIn) {
      put(note, wallet?.address
        ? "Connected, but not signed in. Press the wallet tile again to sign in and reach your money."
        : "Connect a wallet above to deposit or withdraw. Guests play in a sandbox where nothing is staked.");
      return;
    }
    for (const t of tabs) t.classList.toggle("on", t.dataset.bk === which);
    restate();
  }

  function tick() {
    if (!onScreen || !sessionToken()) return;
    if (watching > 0) watching -= 1;
    /* Ask the box to look for the deposit only while there is a reason to:
       a transfer we just watched go out, or a deposit tab somebody is sitting
       in front of. Otherwise this is a balance refresh and nothing more. */
    if (watching > 0 || which === "deposit") poke().then(refresh).catch(() => {});
    else refresh().catch(() => {});
  }

  /** Load what the box says about itself. Once; it does not change. */
  async function learn() {
    if (info) return;
    try { info = await api("/api/custody/deposit"); }
    catch (e) { info = null; }   /* custody off on this box; the panel says so */
  }

  return {
    /**
     * The welcome screen is up (or has gone away). Polling follows the screen:
     * a panel nobody can see must not be asking the arcade anything, and the
     * arena underneath this screen is still running on somebody's money.
     */
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
    },

    /** Something about the wallet changed: connected, signed in, gone. */
    sync() {
      if (!onScreen) return;
      this.active(true);
    },

    /**
     * Refresh and report, for the one decision this panel does not make:
     * whether the player has anything to play with. Signing in with an empty
     * arcade balance is the moment to be standing in front of a deposit
     * screen, not the moment to be dropped onto a desktop whose only button
     * says "not enough SOL".
     *
     * `arcade` is null when the box could not be asked -- which must read as
     * "carry on", never as "you are broke".
     */
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

    /** Say something in the panel's own voice, from outside it. */
    tell(text, kind) { say(text, kind); },

    /** Which half to show. Used by the shortcut that says "deposit". */
    show(tab) {
      if (tab === "deposit" || tab === "withdraw") which = tab;
      draw();
      /* A phone opens the welcome screen scrolled to the brand; somebody who
         pressed My Wallet wants the panel, so put it in front of them. */
      if (!panel.hidden) panel.scrollIntoView({ block: "nearest" });
    },

    /** Wire the controls. Called once, after the DOM exists. */
    mount() {
      for (const t of tabs) t.addEventListener("click", () => {
        if (busy) return;
        which = t.dataset.bk;
        sysSnd("nav", .4);
        amtEl.value = "";
        say("");
        draw();
      });
      amtEl.addEventListener("input", restate);
      amtEl.addEventListener("keydown", e => { if (e.key === "Enter" && !goEl.disabled) goEl.click(); });
      maxEl.addEventListener("click", () => {
        /* MAX means different things on the two tabs and both are exact: what
           the wallet can send after the fee it will pay, or the whole balance
           the books hold. */
        const most = which === "deposit" ? spendable : arcade;
        amtEl.value = most > 0 ? sol(most) : "";
        restate();
        amtEl.focus();
      });
      goEl.addEventListener("click", () => {
        if (busy || goEl.disabled) return;
        if (which === "deposit") void doDeposit();
        else void doWithdraw();
      });
    },
  };
}
