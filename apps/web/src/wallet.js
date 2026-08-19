/* THIS DESKTOP'S WALLET, WHICH IS THE ARCADE'S WALLET WEARING THIS WORLD'S NAME.

   Everything that used to be in this file -- provider discovery, the sign-in
   ceremony, the session cookie, resume, disconnect -- lives once, in
   src/arcade/wallet.js, which is a verbatim copy of the arcade's own
   arcade/web/wallet.js. The five tables inside the arcade repo import that
   module directly and are shims exactly like this one; this world is a
   separate repository, so its copy is fetched by scripts/sync-arcade.mjs and
   checked for drift on every build. That script's header has the argument for
   why a copy rather than an import, and it is a fact about bundlers rather
   than a preference.

   THE CODE THAT WAS HERE WAS 94% THAT FILE. Not by accident: it was forked
   from it. The functional differences were the localStorage key on the last
   line of this file and, silently, everything the arcade had learnt since --
   Mobile Wallet Adapter, the phone deeplink round trip, the wallet chooser,
   and the advice shown when a phone browser has no wallet in it at all. A
   player on a phone could not connect to this desktop and could connect to
   every other table in the arcade, which is what six copies of a handshake
   buys.

   WHAT STAYS HERE is the name, the deposit approval, and nothing else ever
   should. If this file grows a third idea, that idea belongs upstairs where
   the other tables can have it too.

   ONE THING CHANGES FOR RETURNING PLAYERS, and it is worth knowing rather than
   discovering: the "you have connected here before" flag moves from
   `cursors.wallet` to `gielinor.cursors.wallet`. Anybody whose browser holds
   the old key resumes anyway -- the domain-wide `zinc_wallet` cookie grants
   the same opt-in and is checked beside it -- so the only person affected is
   somebody who connected on this desktop, never on any other table, and has
   since lost that cookie. They press connect once more. */

import { Wallet as ArcadeWallet } from "/arcade/web/wallet.js";

export {
  authHeaders,
  claimedWallet,
  /* Drops a session the BOX has stopped honouring, locally and without a
     signature. My Wallet needs it for the same reason the arcade's own panels
     do -- see the 401 branch in bank.js, and forgetSession's note upstairs. */
  forgetSession,
  onDepositArrival,
  sessionToken,
  shortAddress,
  signOut,
} from "/arcade/web/wallet.js";
export { arcadeUrl } from "/arcade/web/origin.js";

/** The arcade's wallet, told which table it is standing at. */
export class Wallet extends ArcadeWallet {
  /** @param {(state: {address: string|null, name: string|null}) => void} [onChange] */
  constructor(onChange = () => {}) {
    super(onChange, { id: "cursors" });
  }
}

/**
 * APPROVE AND BROADCAST A TRANSFER THE ARCADE BUILT. The one call in this file
 * that moves money.
 *
 * WHY THE BYTES COME FROM THE BOX AND NOT FROM HERE. A System Program transfer
 * is about sixty bytes laid out in one exact order, and the arcade already has
 * a tested implementation of it that its withdrawal signer builds against.
 * Writing a second one here -- in a browser, in the least testable place in
 * the system -- is the mistake tools/signer-core.mjs in the arcade repo exists
 * to warn about: two implementations agree until they do not, and the day they
 * stop, money goes somewhere nobody meant.
 *
 * WHAT STOPS THIS BEING "SIGN WHATEVER THE SERVER SENDS", which is the shape
 * of every drainer. Two things, and neither is trust in the server:
 *
 *   1. The WALLET decodes the transaction and shows what it does -- who is
 *      paid and how much -- before anybody presses anything. That readout is
 *      rendered by the wallet, not by this page, so a lying arcade would be
 *      lying in a box it does not control.
 *   2. The arcade's own route will not build anything else. `to` is custody's
 *      address and `from` is the wallet the session proved; there is no
 *      destination field to poison. See createCustodyRoutes.
 *
 * ITS TWIN IS approveTransfer IN THE ARCADE'S bank.js, and the two agree. This
 * is the last piece of the handshake still written out twice, and the reason
 * is that it lives in the arcade's BANK rather than in its wallet, and this
 * world does not use that bank. If it ever moves upstairs, delete this and
 * import it.
 *
 * TWO ENCODINGS, TRIED IN ORDER. Phantom deserialises a TRANSACTION from the
 * parameter its own documentation calls `message`, so sending the documented
 * base58 message failed a real deposit with "Reached end of buffer
 * unexpectedly". The box publishes both forms and this tries the transaction
 * first; `transaction` is absent on an older box, and then this is the
 * single-form call it always was. See prepareDeposit in the arcade's
 * custody.js for the bytes and how they were checked.
 *
 * A REFUSAL MUST NOT BE RETRIED: a form the wallet cannot deserialise fails
 * before any dialog appears, so falling back shows the player nothing, but
 * somebody who said no must not be asked again in another encoding.
 *
 * @param {object} provider an injected Solana provider
 * @param {object|string} prepared the whole answer from
 *        /api/custody/deposit/prepare -- a bare base58 message is still taken,
 *        because that is what this took for its first two months
 * @returns {Promise<string>} the transaction signature
 */
export async function approve(provider, prepared) {
  const prep = typeof prepared === "string" ? { message: prepared } : (prepared ?? {});

  /*
   * A PHONE LEAVES THE PAGE HERE, AND DOES NOT COME BACK TO THIS FUNCTION.
   *
   * On a phone the wallet is another app and the only way to reach it is a
   * link, so approving is a NAVIGATION: this tab is destroyed, the wallet
   * opens, and the player returns to a fresh page load carrying the signed
   * transaction in its query string. src/arcade/deeplink.js picks it up there
   * and hands it to the box; completeDeeplink reports the outcome to whoever
   * registered with onDepositArrival, which is My Wallet.
   *
   * So the promise below never settles, on purpose. There is nothing to return
   * to a caller that is about to stop existing, and resolving with something
   * falsy would make the deposit form paint a failure half a second before the
   * page went away.
   */
  if (provider?.isDeeplink) {
    await provider.deposit(prep);
    return new Promise(() => {});
  }

  if (typeof provider?.request !== "function") {
    const no = new Error("This wallet cannot be asked to send a transaction from a page.");
    no.code = "NO_TX_API";
    throw no;
  }

  /* THE EXTENSION MAY HAVE MOVED WHILE THE SESSION DID NOT. The transfer the
     box built pays FROM one exact account -- the wallet the session proved --
     so an extension standing on a different one produces a refusal deep inside
     the wallet that reads to a player as "the arcade is broken". Caught here,
     where there is room to say which of the two moved. */
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

  /* Which encoding this wallet takes, asked rather than sniffed: a provider
     that wants raw bytes says so itself, and the box publishes the identical
     transaction in base64 for it. Nothing sets this yet -- it is what the
     Android Mobile Wallet Adapter path will set when it lands -- and asking
     costs one comparison. */
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
      /* 4001 is the number every wallet reuses for "the person said no", and
         being told you cancelled is a different sentence from being told it
         failed. */
      if (err?.code === 4001 || /reject|denied|cancel/i.test(String(err?.message ?? ""))) {
        const no = new Error("Deposit cancelled.");
        no.code = "CANCELLED";
        throw no;
      }
      /* A wallet that does not do this at all will not do it in either form.
         -32601 is JSON-RPC "no such method"; some wallets say it in words. */
      if (err?.code === -32601
        || /unsupported|not supported|unknown method|invalid method/i.test(String(err?.message ?? ""))) {
        const no = new Error("This wallet cannot be asked to send a transaction from a page.");
        no.code = "NO_TX_API";
        throw no;
      }
      /* Anything else is worth trying the other encoding for. The FIRST failure
         is the one reported if both fail, because it is the one about the form
         the wallet was most likely to accept. */
      firstError ??= err;
    }
  }
  if (firstError) throw firstError;

  const signature = typeof out === "string" ? out : out?.signature;
  if (!signature) throw new Error("the wallet approved it but gave back no transaction id");
  return String(signature);
}

/** `7Xb2..9dKp`, locally, so one message does not pull in a second name. */
const short = (a) => {
  const s = String(a ?? "");
  return s.length > 12 ? `${s.slice(0, 4)}..${s.slice(-4)}` : s;
};
