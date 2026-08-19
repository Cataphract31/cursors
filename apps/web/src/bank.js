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

import { approve, arcadeUrl, authHeaders, onDepositArrival, sessionToken, shortAddress } from "./wallet.js";

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

/* HOW MUCH A PRESS IS WORTH, AND WHY THESE NUMBERS AND NOT OURS.

   THE RUNGS ARE THE ARCADE'S. This panel replaced the arcade's own BANK on
   this world (`ownBank` in the registry), and the thing it replaced has since
   grown a quick-amount row of its own -- `PRESETS` in arcade/web/bank.js. A
   player who funds an account on the portal and then funds one here should be
   pressing the same ladder in both places, so the ladder is copied rather than
   invented: same six rungs, in the same order. What is ours is the furniture
   around them.

   BOTH HALVES GET THE SAME RUNGS, which is the arcade's rule and worth keeping
   for its reason: the withdraw tab feels like the deposit tab because the row
   under the field does not change shape between them. The two are FILTERED
   differently -- a deposit rung greys against what the wallet can send, a
   withdrawal rung against the balance and the withdrawal floor -- and that is
   the whole difference.

   It starts at 0.01 rather than 0.05 because the first thing anybody does with
   a bank holding real money is put a trivial amount through it to see whether
   it works.

   MIN AND MAX ARE COMPUTED, not typed, so they follow the box: MIN is whatever
   the arcade currently calls the smallest withdrawal (50,000 lamports today,
   and nothing here has to change when that moves), and MAX is what the wallet
   can send after the network fee, or the whole balance in the books. MIN is on
   the withdraw half only, because a floor is a real refusal there and nothing
   at all on the deposit side. */
const RUNGS = [
  { lamports: 10_000_000, label: "0.01" },
  { lamports: 50_000_000, label: "0.05" },
  { lamports: 100_000_000, label: "0.1" },
  { lamports: 250_000_000, label: "0.25" },
  { lamports: 500_000_000, label: "0.5" },
  { lamports: 1_000_000_000, label: "1" },
];

/** Receipts per page. Five fits the panel without pushing the fold on a phone. */
const PER_PAGE = 5;

/*
 * HOW LONG THIS PANEL WAITS. fetch() has no deadline of its own, and without
 * one there is no moment at which this panel HAS to admit it does not know
 * what happened -- which is what UNTOUCHED below is for.
 *
 * Two numbers, because the two kinds of call fail differently: a read is
 * repeated every four seconds by the poll and may give up quickly, while a
 * withdrawal waits on a signer on another machine whose worst case is over a
 * minute, so cutting it short turns answers that were coming into unknowns.
 */
const READ_MS = 15_000;
const MOVE_MS = 60_000;

/*
 * THE REFUSALS THAT MEAN THE MONEY DEFINITELY DID NOT MOVE.
 *
 * The box DEBITS THE LEDGER BEFORE it asks the signer, so "your balance has
 * not been touched" is a sentence that has to be earned by a named refusal
 * rather than said after every failure -- a dropped connection can reject this
 * fetch with the transfer already on its way. Each code below is a path in the
 * arcade's custody.withdraw() that either refuses before the debit or refunds
 * it; anything else means this browser does not know, and says so.
 *
 * ADDING A CODE HERE IS A CLAIM ABOUT THE SERVER. The list is the arcade's, in
 * arcade/web/bank.js, which has the long version and must not drift from this.
 */
const UNTOUCHED = new Set([
  "NO_SESSION",           /* never reached the withdrawal at all */
  "BAD_BODY",
  "BAD_AMOUNT",
  "BAD_ACCOUNT",
  "BELOW_MINIMUM",
  "DEPOSIT_NOT_FINAL",
  "ALREADY_WITHDRAWING",
  "INSUFFICIENT_FUNDS",   /* the ledger refused the debit, atomically */
  "CHAIN_UNREACHABLE",    /* before the debit, or refunded after it */
  "CUSTODY_SHORT",
  "SIGNER_AWAY",
  "SIGNER_REFUSED",       /* refunded, and nothing was ever signed */
  "SIGNER_TIMEOUT",       /* ditto -- no signature means nothing can land */
  "BAD_SIGNATURE",        /* refunded before anything went on the wire */
]);

/**
 * The box's sentence, ended properly, so another can be put after it.
 *
 * Half the messages from the arcade's custody.js end in a full stop and half
 * do not, and this panel puts a second sentence after every one of them.
 * Without this, the screen that moves money says things like "the signer did
 * not answer Your balance has not been touched."
 */
const ended = (text) => {
  const t = String(text ?? "").trim();
  return !t || /[.!?]$/.test(t) ? t : `${t}.`;
};

/**
 * A BUTTON THAT HAS TO BE PRESSED TWICE, because withdrawing is the only
 * control on this desktop that cannot be undone. An XP confirm dialog would do
 * the job and would also put a modal in front of the one panel this machine
 * deliberately built without one.
 *
 * KEYED ON THE AMOUNT: arm at 0.1, retype 0.5, press once, and a confirm that
 * only remembered "they pressed it before" would send the 0.5 unconfirmed. It
 * expires too, so an armed button is not a trap left for whoever next touches
 * the machine.
 *
 * Ported from createArming in the arcade's bank.js, which has the test.
 */
const HOLD_MS = 5000;
function createArming({ holdMs = HOLD_MS, clock = Date.now } = {}) {
  let key = null;
  let at = 0;
  return {
    /** @returns {'armed'|'fire'} whether this press asked or acted */
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
  let page = 0;               /* which page of this tab's receipts is showing */
  let info = null;            /* address, network, minWithdrawal, networkFee */
  let arcade = 0;             /* lamports in the books */
  let chain = null;           /* lamports in the player's own wallet, or null */
  let spendable = 0;          /* chain minus the fee the transfer itself costs */
  let history = { deposits: [], withdrawals: [] };
  let served = false;         /* the box paged this answer itself */
  let pending = 0;            /* deposited, not yet final -- cannot leave yet */
  let sessionWallet = null;   /* who the BOX says it pays; never the cookie */
  const arming = createArming();
  let seenTop;                /* newest deposit's signature; undefined = never looked */
  /* A PHONE DEPOSIT THAT FINISHED WHILE THIS PAGE DID NOT EXIST. Approving on
     a phone is a NAVIGATION: the wallet app takes over, this tab is destroyed,
     and the answer arrives on a fresh load before there is a panel to show it
     on. Held here until there is. */
  let arrival = null;
  let onScreen = false;
  let busy = false;
  let timer = null;
  /* A deposit just approved: poll harder until the arcade sees it, then stop.
     Counted in ticks so a tab left open overnight is not still hammering. */
  let watching = 0;

  const put = (el, text) => { el.textContent = String(text ?? ""); };
  const say = (text, kind = "") => { sayEl.className = "lgb-say" + (kind ? " " + kind : ""); put(sayEl, text); };

  /* ---------- talking to the arcade ---------- */

  /**
   * WHAT A FAILURE FROM HERE CARRIES, because the withdraw half decides what
   * it is allowed to promise from it:
   *
   *   code      what the box called it, when the box answered at all
   *   status    the HTTP status, same condition
   *   answered  whether an answer was received AND understood. FALSE means the
   *             request may or may not have been carried out, and this panel
   *             must not claim otherwise. See UNTOUCHED above.
   *
   * @param {string} path
   * @param {RequestInit & {timeoutMs?: number}} [opts]
   */
  async function api(path, opts = {}) {
    const { timeoutMs = READ_MS, ...init } = opts;
    /* AbortController rather than AbortSignal.timeout(): the timer is cleared
       on the way out, so a welcome screen left open for an hour is not also
       leaving a pending timeout behind for every poll it ever ran. */
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
      /* Aborted, DNS, reset, offline. From here none of them can be told
         apart, and none of them says whether the box acted on the request. */
      throw Object.assign(
        new Error(stop.signal.aborted ? "The arcade did not answer in time." : "Could not reach the arcade."),
        { code: stop.signal.aborted ? "TIMEOUT" : "OFFLINE", answered: false });
    } finally {
      clearTimeout(bell);
    }

    /* A BODY IS JSON BECAUSE THE HEADER SAYS SO. Anything else is somebody
       between this desktop and the box -- a proxy's error page, a captive
       portal, a CDN -- and its contents are not a message from the arcade. */
    const isJson = /\bapplication\/json\b/i.test(res.headers.get("content-type") ?? "");
    let parsed = null;
    if (isJson) {
      try { parsed = await res.text().then(t => (t ? JSON.parse(t) : null)); } catch (e) { parsed = null; }
    }
    if (!res.ok) {
      throw Object.assign(new Error(parsed?.error?.message ?? `The arcade said ${res.status}.`),
        /* A status from the box is an answer even when the body was junk;
           what makes it useful is the code, and UNTOUCHED checks for that. */
        { status: res.status, code: parsed?.error?.code, answered: true });
    }
    if (!isJson) {
      throw Object.assign(new Error("The arcade answered with something that was not an answer."),
        { status: res.status, code: "NOT_JSON", answered: false });
    }
    return parsed;
  }

  /**
   * WHAT CAN LEAVE RIGHT NOW, which is not the balance.
   *
   * A deposit is credited the moment the cluster confirms it, and the box will
   * not pay it out again until it is FINAL -- so for a few seconds after a
   * deposit lands there is money in the books that cannot go anywhere. Read,
   * not guessed: `pending` comes from the same place the refusal does. A MAX
   * that offers more than the box will accept is a refusal somebody has to
   * read to understand.
   */
  const free = () => Math.max(0, arcade - pending);

  /**
   * THE BOX PAYS THE SESSION'S WALLET, AND THIS BROWSER MAY BE ON ANOTHER ONE.
   *
   * The extension can be switched to a different account at any moment, and
   * the session it was signed with does not move with it. Whichever of the two
   * is stale, the player is not looking at the account that is about to be
   * paid -- and a withdrawal whose destination they cannot see is the one
   * press on this panel that must not be available. Reconnecting settles it,
   * because signing in again is what makes the two agree.
   *
   * BOTH ARE READ AS FUNCTIONS. The poll refreshes the session's wallet and
   * the extension can change under it, so a value taken once when the panel
   * was drawn is a value that stops being true while somebody looks at it.
   */
  const mismatch = () => Boolean(sessionWallet && wallet?.address && sessionWallet !== wallet.address);

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
      served = false; pending = 0; sessionWallet = null;
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
      /* ONE PAGE OF ONE DIRECTION, chosen by the tab that is up. An older box
         has never heard of these three and answers with everything, which is
         exactly the shape this panel used to read -- see drawLog. */
      api(`/api/custody/history?kind=${which === "deposit" ? "in" : "out"}`
        + `&page=${page + 1}&perPage=${PER_PAGE}`),
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
      /* WHO THE BOX SAYS IT PAYS. Never the cookie: an extension switched to
         another account leaves the cookie saying one thing and the session
         another, and the session is the one the money follows. */
      sessionWallet = typeof bal.value.wallet === "string" ? bal.value.wallet : null;
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
      history = hist.value ?? {};
      /* WHICH SHAPE CAME BACK. A box that pages sends `rows` and the
         arithmetic that goes with them; one that does not sends the two whole
         lists it always sent. Both are handled, because the browser code and
         the box deploy separately and for the length of that gap a page and
         the server it is talking to are different versions of the same
         feature -- in whichever direction happens to be ahead. A money screen
         that answers a version skew with an empty panel is the worst possible
         way to fail. */
      served = Array.isArray(history.rows);
      pending = Number(history.pending ?? 0);
      /* The pager draws the page it was GIVEN, not the one it asked for: the
         box clamps both numbers, so trusting our own would let the pager
         disagree with the list underneath it. */
      if (served) page = Math.max(0, Number(history.page ?? 1) - 1);

      /* A deposit landing while somebody watches is the whole point of the
         fast poll, and it is worth saying out loud rather than leaving them to
         notice a number changed. Keyed on the newest deposit's SIGNATURE
         rather than on how many there are, because with the box paging there
         is no total to count -- the withdraw tab is not even sent deposits,
         which is why an answer about the other direction is skipped rather
         than read as "they all disappeared". */
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

  /* ---------- the preset row ---------- */

  /**
   * What each chip is worth RIGHT NOW, in lamports.
   *
   * A rung is a constant; MIN and MAX are questions asked fresh every time,
   * because the balance moves under this panel while somebody reads it -- the
   * arena below is still settling duels on the same money.
   */
  function presetValue(pre) {
    if (pre.lamports !== undefined) return pre.lamports;
    if (pre.kind === "min") return info?.minWithdrawal ?? 0;
    /* MAX on the withdraw half is what can LEAVE, not what is in the books:
       offering a number the box will refuse is a refusal somebody has to read
       to understand. */
    return which === "deposit" ? spendable : free();
  }

  /** Build the row. Once per tab, not once per poll: see syncPresets. */
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

  /** Hands off while a transfer is in flight, the same as the amount field. */
  function lockPresets(on) {
    for (const b of presetsEl.children) b.disabled = on || b.disabled;
    if (!on) syncPresets();
  }

  /**
   * Which presets are affordable, and which one is currently typed.
   *
   * Separate from buildPresets because the four-second poll runs through here:
   * replacing the buttons under a thumb that is already on one is how a press
   * lands on a different amount than the one it aimed at.
   */
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

  /* ---------- what the form is allowed to do right now ---------- */

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
    /* AN ARMED BUTTON SAYS WHAT THE NEXT PRESS DOES. Anything that changes the
       amount has already disarmed by the time this runs, so the label can only
       be showing for the number in the field. */
    const armed = arming.armed();
    put(goEl, armed !== null && armed === amtEl.value.trim()
      ? `Press again to send ${sol(want ?? 0)} SOL`
      : (want ? `Withdraw ${sol(want)} SOL` : "Withdraw"));

    /*
     * THE BOX PAYS THE SESSION'S WALLET AND THIS BROWSER IS ON ANOTHER ONE, so
     * whoever is looking at this cannot see the account about to be paid. That
     * is the one press here that must not be available.
     */
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
      /* TWO DIFFERENT REFUSALS, because they need two different answers from
         the person reading them. "You do not have it" means go and win some;
         "it is still confirming" means wait a few seconds and press again --
         and saying the first when the second is true reads as the arcade
         having lost the deposit sitting right there in the balance above. */
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
    /* The floor is the box's to set and it is small now, so it is worth saying
       up front: somebody with 0.0004 SOL in the books should be able to see,
       before typing anything, that it is theirs to take out. */
    const floor = info ? ` Smallest is ${sol(info.minWithdrawal)} SOL.` : "";
    return `Paid to ${to} — the only address the arcade will pay, so a stolen session cannot send your balance anywhere else.${floor}`;
  }

  /* ---------- the two verbs ---------- */

  async function doDeposit() {
    const want = toLamports(amtEl.value);
    if (want === null || want <= 0) return;
    busy = true; goEl.disabled = true; amtEl.disabled = true; lockPresets(true);
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
      /* THE WHOLE ANSWER, not just the message: the box publishes the transfer
         in two encodings because the wallet in front of us may refuse the
         documented one. See approve() in wallet.js for the deposit that failed
         and made that necessary. */
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
      /* Poll hard for two minutes. The arcade's own scan is a minute wide,
         which is far too slow for somebody standing here watching. */
      watching = 30;
      await poke();
      await refresh();
    } catch (err) {
      if (err?.code === "CANCELLED") say("Cancelled. Nothing was sent.");
      else if (err?.code === "NO_TX_API") manualFallback();
      /* The extension moved and the session did not. Its message already says
         which way round it is and what to do, and "Nothing has left your
         wallet" is true here -- the wallet was never asked. */
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
      /* An amount, and nothing else. There is no destination field, and adding
         one would be the whole vulnerability. */
      const out = await api("/api/custody/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: want }),
        /* The box debits, then waits on a signer on another machine whose own
           worst case is over a minute. Cutting this short would turn answers
           that were coming into unknowns. */
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
      /* SAY WHAT THE BOX SAID -- AND ONLY PROMISE WHAT THE BOX ANSWERED. A
         named refusal from UNTOUCHED gets the reassurance; anything else gets
         the truth, which is that this browser does not know, and somewhere to
         go and find out. */
      const sure = err?.answered && UNTOUCHED.has(err.code);
      const why = ended(err.message);
      /* Red is "this did not happen". The yellow this panel already uses for a
         withdrawal in flight is the honest colour for "we do not know". */
      say(sure
        /* The box sometimes says it itself, and saying it twice in two
           different sentences reads as a script that is not listening. */
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

  /**
   * THE ROWS THIS TAB IS ABOUT, newest first.
   *
   * The two books are separate here because they were separate in the
   * question: somebody on the withdrawal tab is checking whether a payout
   * went out, and a merged list of four meant that receipt was as likely as
   * not to have been pushed off the bottom by deposits they were not asking
   * about.
   */
  /**
   * The most recent deposit in whatever shape this answer came in, or null.
   * Sorted rather than assumed: two shapes, two orderings to trust otherwise.
   */
  function newestDeposit() {
    const rows = Array.isArray(history.rows)
      ? history.rows.filter(r => r.kind === "in").map(r => ({ at: r.at, signature: r.signature, lamports: r.amount }))
      : (history.deposits ?? []).map(d => ({ at: d.at, signature: d.signature, lamports: d.lamports }));
    return rows.sort((a, b) => b.at - a.at)[0] ?? null;
  }

  function rowsForTab() {
    const want = which === "deposit" ? "in" : "out";
    if (Array.isArray(history.rows)) {
      /* Filtered by the box already; filtered again because a page drawing
         withdrawals under a DEPOSITS heading is worse than a short list. */
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
    /* THE BOX'S ARITHMETIC WHEN THERE IS SOME. It sent one page and the
       numbers that describe it; slicing that page again here would be this
       panel doing the sum a second time and getting to disagree. An older box
       sent everything, and then the slice below is the only paging there is. */
    const pages = served ? Math.max(1, Number(history.pages ?? 1))
      : Math.max(1, Math.ceil(rows.length / PER_PAGE));
    const total = served ? Number(history.total ?? rows.length) : rows.length;
    /* A deposit landing while page 2 is open must not leave somebody staring
       at a page that no longer exists. */
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

  /**
   * SHOW WHAT THE WALLET APP SAID, once there is somewhere to show it.
   *
   * Cleared on read: a success line reappearing the next time somebody opens
   * this screen would be the arcade telling them money had just moved when
   * nothing had.
   */
  function showArrival() {
    if (!arrival || !onScreen) return;
    const done = arrival;
    arrival = null;
    /* Whatever tab was up, the answer is about a deposit. */
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
    /* Same watch the desktop path arms: the box's own scan is a minute wide
       and somebody standing here has just been sent back from their wallet. */
    watching = 30;
    poke().then(refresh).catch(() => {});
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
    buildPresets();
    drawLog();
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
      showArrival();
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
      /*
       * AND TELL THE SHARED WALLET WHERE A FINISHED PHONE DEPOSIT GOES.
       *
       * Without this the arcade's own bank opens on top of the desktop at the
       * end of a deposit -- a gold OSRS panel over Windows XP, which is the
       * exact thing `ownBank` exists to prevent. onDepositArrival is the seam
       * for it; see completeDeeplink in src/arcade/wallet.js.
       */
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
        /* The other half is a different question to the box now, so the log
           under it is a fetch rather than a re-slice. */
        if (sessionToken()) refresh().catch(() => {});
      });
      amtEl.addEventListener("input", () => {
        /* THE AMOUNT CHANGED, SO THE CONFIRMATION IS FOR A NUMBER NOBODY IS
           LOOKING AT ANY MORE. press() is keyed on the text and would refuse
           anyway; this is what makes the button stop SAYING it is armed. */
        arming.disarm();
        restate();
      });
      amtEl.addEventListener("keydown", e => { if (e.key === "Enter" && !goEl.disabled) goEl.click(); });
      /* A page the box holds has to be ASKED for; a page we sliced ourselves
         is already here. turn() covers both, so the arrows do not have to know
         which kind of box they are talking to. */
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
        /* THE ONLY IRREVERSIBLE PRESS ON THIS DESKTOP GETS TWO. Keyed on the
           text in the field, so re-typing the amount between the two presses
           asks again rather than sending the new number unconfirmed. */
        if (arming.press(amtEl.value.trim()) === "armed") {
          sysSnd("nav", .4);
          restate();
          /* Re-draw when the arming lapses, so a button that has quietly gone
             back to meaning "ask me" does not go on saying "press again". */
          setTimeout(() => { if (onScreen && !busy) restate(); }, HOLD_MS + 60);
          return;
        }
        void doWithdraw();
      });
    },
  };
}
