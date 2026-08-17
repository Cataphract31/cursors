/*
 * THE ARCADE'S BOOKS, REACHED OVER HTTP.
 *
 * CURSORS KEPT ITS OWN MONEY, in a `players.balance` REAL column moved by
 * `p.balance -= STAKE` and `p.balance += paid`. Two problems, and the second is
 * the one that matters.
 *
 * It was single-sided, so it could drift for months with no symptom. And it was
 * REAL rather than an integer count of lamports -- a float, for money, which
 * cannot represent 0.1 exactly and accumulates error every time it is touched.
 * The arcade ledger stores whole lamports and refuses anything else.
 *
 * But the real problem was that it was a SEPARATE idea of what you own. Win
 * here and the money was not there at Barrows, because there was no "there".
 * There is one now, and this is how this game reaches it.
 *
 * WHAT THIS GAME MAY DO WITH MONEY, IN FULL: hold a stake, settle it, give it
 * back. Deploy holds, bank settles, an ungraced recall releases. It cannot
 * credit, debit, mint, or sign anything, and it holds no key material -- the
 * arcade's custody edge is the only place money enters or leaves, and it is
 * not here.
 *
 * THE SECOND COPY, ADMITTED. Thin Ice has this same client in TypeScript
 * (ZINC apps/server/src/arcade.ts). They are separate repositories that deploy
 * separately, so there is no import either can spell -- the same problem the
 * OSRS games had before `#arcade/*`, without the same fix available. What keeps
 * them honest is that the wire protocol is the contract and the arcade's own
 * tests pin it; if these two drift, the one that is wrong stops being able to
 * move money rather than quietly moving it differently.
 *
 * FAILURE IS CLOSED. If the books cannot be reached, no stake is taken and no
 * cursor is deployed.
 */

/** What the ledger calls this game in every row it writes. */
const GAME = "cursors";

/** Where the books live. Loopback, because LEDGER_KEY travels with the request. */
const DEFAULT_URL = "http://127.0.0.1:8080";

export class LedgerError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
    this.status = status;
  }
  /** The one failure a caller acts on differently: they cannot cover it. */
  get isBroke() { return this.code === "INSUFFICIENT_FUNDS"; }
  /** Not a wallet at all -- a spectator token. Also normal, also not a fault. */
  get isNotAWallet() { return this.code === "BAD_ACCOUNT"; }
}

/**
 * Is this URL on the loopback?
 *
 * Checked rather than assumed: the cost of getting it wrong is posting the
 * service key to somebody else's server, and the mistake would look like a
 * config typo rather than a breach.
 */
function isLoopback(url) {
  try {
    const h = new URL(url).hostname;
    return h === "127.0.0.1" || h === "localhost" || h === "::1" || h === "[::1]";
  } catch {
    return false;
  }
}

export function createLedger({
  url = process.env.ARCADE_LEDGER_URL || DEFAULT_URL,
  key = process.env.LEDGER_KEY || "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
} = {}) {
  const base = String(url).replace(/\/+$/, "");
  if (key && !isLoopback(base)) {
    throw new Error(`refusing to send LEDGER_KEY to ${base}: it may only travel over the loopback`);
  }
  const enabled = key !== "";

  async function call(route, { method = "POST", body = null, params = null } = {}) {
    if (!enabled) throw new LedgerError("LEDGER_CLOSED", "this server has no LEDGER_KEY", 503);
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    let res;
    try {
      res = await fetchImpl(`${base}/api/ledger/${route}${q}`, {
        method,
        headers: { "content-type": "application/json", "x-ledger-key": key },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new LedgerError("LEDGER_UNREACHABLE", `could not reach the arcade ledger: ${err.message}`, 503);
    }
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; }
    catch { throw new LedgerError("LEDGER_GARBAGE", `the ledger answered ${res.status} and not JSON`, 502); }
    if (!res.ok) {
      const e = (parsed && parsed.error) || {};
      throw new LedgerError(e.code || "LEDGER_REFUSED", e.message || `ledger said ${res.status}`, res.status);
    }
    return parsed;
  }

  /**
   * The ref for one cursor's stake.
   *
   * Every mutating call carries a ref the caller chooses, unique forever;
   * asking twice with the same ref returns the first answer instead of moving
   * money twice. That is what makes this safe over HTTP, which retries, and
   * across a crash, which replays.
   *
   * A cursor id is unique for the life of the process and a round id pins the
   * epoch, so together they name exactly one stake.
   */
  const refFor = (roundId, cursorId) => `${GAME}:e${roundId}:c${cursorId}`;

  return {
    enabled,
    refFor,

    /** Take a stake into escrow. Throws; `isBroke`/`isNotAWallet` are normal. */
    async hold(wallet, lamports, roundId, cursorId) {
      const r = await call("hold", {
        body: {
          wallet, amount: lamports, ref: refFor(roundId, cursorId),
          game: GAME, memo: `epoch ${roundId} cursor ${cursorId}`,
        },
      });
      return { freeLamports: Number(r.balance || 0), heldLamports: Number(r.held || 0) };
    },

    /** Settle a stake at what it returned. 0 is a loss, and is a settlement. */
    async settle(roundId, cursorId, payoutLamports) {
      await call("settle", {
        body: { ref: refFor(roundId, cursorId), payout: payoutLamports, memo: `epoch ${roundId}` },
      });
    },

    /** Give a stake back untouched. Idempotent. */
    async release(roundId, cursorId, why = "recalled in grace") {
      await call("release", { body: { ref: refFor(roundId, cursorId), memo: why } });
    },

    /** Where a wallet stands. FOR THE SCREEN ONLY -- `hold` is the check. */
    async balanceOf(wallet) {
      const r = await call("balance", { method: "GET", params: { wallet } });
      return { freeLamports: Number(r.balance || 0), heldLamports: Number(r.held || 0) };
    },

    /**
     * Release every hold this game still has open.
     *
     * For startup after a crash. Holds outlive the process that made them,
     * which is the point of them: money in flight is the only money a crash
     * can lose, so it is the only money that is never merely in flight.
     */
    async sweep() {
      const r = await call("sweep", { body: { game: GAME } });
      return Number(r.released || 0);
    },
  };
}
