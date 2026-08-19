import { Wallet as ArcadeWallet } from "/arcade/web/wallet.js";

export {
  authHeaders,
  claimedWallet,
  forgetSession,
  onDepositArrival,
  sessionToken,
  shortAddress,
  signOut,
} from "/arcade/web/wallet.js";
export { arcadeUrl } from "/arcade/web/origin.js";

export class Wallet extends ArcadeWallet {
  constructor(onChange = () => {}) {
    super(onChange, { id: "cursors" });
  }
}

export async function approve(provider, prepared) {
  const prep = typeof prepared === "string" ? { message: prepared } : (prepared ?? {});

  if (provider?.isDeeplink) {
    await provider.deposit(prep);
    return new Promise(() => {});
  }

  if (typeof provider?.request !== "function") {
    const no = new Error("This wallet cannot be asked to send a transaction from a page.");
    no.code = "NO_TX_API";
    throw no;
  }

  let active = provider.publicKey?.toString?.() ?? null;
  if (!active) {
    try {
      const out = await provider.connect();
      active = (out?.publicKey ?? provider.publicKey)?.toString?.() ?? null;
    } catch (err) {
      if (err?.code === 4001) {
        const no = new Error("Cancelled. Nothing was sent.");
        no.code = "CANCELLED";
        throw no;
      }
      throw err;
    }
  }
  if (active && prep.from && active !== prep.from) {
    const no = new Error(`Your wallet is on ${short(active)} but the arcade knows you as `
      + `${short(prep.from)}. Switch back in the wallet, or reconnect as ${short(active)} first.`);
    no.code = "WRONG_ACCOUNT";
    throw no;
  }

  const forms = provider.arcadeAccepts === "base64"
    ? [prep.transactionBase64].filter(Boolean)
    : [prep.transaction, prep.message].filter(Boolean);
  if (!forms.length) {
    const no = new Error("The arcade did not send anything to approve.");
    no.code = "NO_TX_API";
    throw no;
  }

  let out;
  let firstError = null;
  for (const form of forms) {
    try {
      out = await provider.request({ method: "signAndSendTransaction", params: { message: form } });
      firstError = null;
      break;
    } catch (err) {
      if (err?.code === 4001 || /reject|denied|cancel/i.test(String(err?.message ?? ""))) {
        const no = new Error("Deposit cancelled.");
        no.code = "CANCELLED";
        throw no;
      }
      if (err?.code === -32601
        || /unsupported|not supported|unknown method|invalid method/i.test(String(err?.message ?? ""))) {
        const no = new Error("This wallet cannot be asked to send a transaction from a page.");
        no.code = "NO_TX_API";
        throw no;
      }
      firstError ??= err;
    }
  }
  if (firstError) throw firstError;

  const signature = typeof out === "string" ? out : out?.signature;
  if (!signature) throw new Error("the wallet approved it but gave back no transaction id");
  return String(signature);
}

const short = (a) => {
  const s = String(a ?? "");
  return s.length > 12 ? `${s.slice(0, 4)}..${s.slice(-4)}` : s;
};
