import { randomBytes } from "node:crypto";

const GAME = "cursors";

const DEFAULT_URL = "http://127.0.0.1:8080";

export class LedgerError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
    this.status = status;
  }
  get isBroke() { return this.code === "INSUFFICIENT_FUNDS"; }
  get isNotAWallet() { return this.code === "BAD_ACCOUNT"; }
}

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

  const boot = randomBytes(4).toString("hex");

  const refFor = (roundId, cursorId) => `${GAME}:${boot}:e${roundId}:c${cursorId}`;

  const settleRef = async (ref, payoutLamports, memo = "replayed after a restart") => {
    await call("settle", { body: { ref, payout: payoutLamports, memo } });
  };

  return {
    enabled,
    refFor,
    settleRef,

    async hold(wallet, lamports, roundId, cursorId) {
      const r = await call("hold", {
        body: {
          wallet, amount: lamports, ref: refFor(roundId, cursorId),
          game: GAME, memo: `epoch ${roundId} cursor ${cursorId}`,
        },
      });
      return { freeLamports: Number(r.balance || 0), heldLamports: Number(r.held || 0) };
    },

    async settle(roundId, cursorId, payoutLamports) {
      await settleRef(refFor(roundId, cursorId), payoutLamports, `epoch ${roundId}`);
    },

    async release(roundId, cursorId, why = "recalled in grace") {
      await call("release", { body: { ref: refFor(roundId, cursorId), memo: why } });
    },

    async balanceOf(wallet) {
      const r = await call("balance", { method: "GET", params: { wallet } });
      return { freeLamports: Number(r.balance || 0), heldLamports: Number(r.held || 0) };
    },

    async sweep() {
      const r = await call("sweep", { body: { game: GAME } });
      return Number(r.released || 0);
    },
  };
}
