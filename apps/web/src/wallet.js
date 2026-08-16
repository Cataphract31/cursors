/* Connect a Solana wallet, with no wallet library at all.

   WHY THIS ADDS NO DEPENDENCY
   Phantom, Solflare and Backpack all inject a provider object into the page
   (window.phantom.solana, window.solflare, window.backpack). connect() and the
   publicKey it hands back are plain browser API, so this whole file is about
   forty lines of logic and @solana/web3.js stays out of a repo that ships two
   runtime dependencies on purpose. A wallet ADAPTER would be a dependency; a
   wallet is not.

   WHAT CONNECTING DOES, AND WHAT IT DELIBERATELY DOES NOT DO
   It answers the login screen's question. Your address becomes the name on
   your cursors and on the scoreboard instead of one you typed. That is all.

   It does NOT become your credential, and nothing you own is keyed to it. The
   reasoning rather than the rule: the multiplayer seat is held by mpToken, a
   secret this browser keeps and sends; a public key is the opposite of a
   secret, since publishing it is the entire point of one. Key the seat to the
   address and anybody who can read the field can play as you. Making an
   address a real credential takes a signed challenge (signMessage against a
   server nonce, verified with Ed25519), and until that exists the honest
   thing is for the address to be a NAME and for the token to stay the key it
   already is.

   Nothing here signs, sends or spends. No transaction is ever built.

   ONE CONNECTION FOR THE WHOLE ARCADE
   This machine lives on cursors.voidsolana.com, beside a portal and three
   other worlds on their own hosts under the same registrable domain. A cookie
   may be scoped to that domain and to nothing broader, so `zinc_wallet` is
   read here when the player connected somewhere else, and written here when
   they connect on this screen — connect once, anywhere, and every world knows
   you. Its VALUE is never trusted as proof: an address in a cookie is a
   claim, so its presence counts only as the opt-in bit, and the wallet itself
   still decides, through onlyIfTrusted, whether this origin gets the address
   without a popup. */

const PREF_KEY = "cursors.wallet";
const COOKIE = "zinc_wallet";
/* A month: long enough to be a convenience, short enough to lapse. */
const MAX_AGE = 60 * 60 * 24 * 30;

/** The injected providers, in the order a page should prefer them. */
function findProvider() {
  const w = window;
  if (w.phantom?.solana?.isPhantom) return { provider: w.phantom.solana, name: "Phantom" };
  if (w.solflare?.isSolflare) return { provider: w.solflare, name: "Solflare" };
  if (w.backpack?.isBackpack) return { provider: w.backpack, name: "Backpack" };
  if (w.solana) return { provider: w.solana, name: "Wallet" };
  return null;
}

/** `7Xb2..9dKp`, which is how an address is written when it is a name. */
export function shortAddress(address) {
  const a = String(address ?? "");
  return a.length > 12 ? `${a.slice(0, 4)}..${a.slice(-4)}` : a;
}

/** Leave the opt-in where the rest of the arcade can find it, or take it back. */
function carry(address) {
  try {
    const host = location.hostname;
    const parts = [`${COOKIE}=${address ? encodeURIComponent(address) : ""}`, "Path=/"];
    /* Only ever the registrable domain, and only while standing on it: off it,
       a Domain naming another site is not an error, it is silently dropped —
       which is worse, because then this appears to work locally and is missing
       in production. */
    if (host === "voidsolana.com" || host.endsWith(".voidsolana.com")) parts.push("Domain=.voidsolana.com");
    parts.push(`Max-Age=${address ? MAX_AGE : 0}`, "SameSite=Lax");
    if (location.protocol === "https:") parts.push("Secure");
    document.cookie = parts.join("; ");
  } catch (e) { /* no cookie jar; this browser just will not carry it */ }
}

/** Has this player already opted in, here or on any other world? */
function optedIn() {
  try { if (localStorage.getItem(PREF_KEY) === "1") return true; } catch (e) { /* storage off */ }
  try {
    return document.cookie.split(";").some(c => {
      const [name, value] = c.trim().split("=");
      return name === COOKIE && Boolean(value);
    });
  } catch (e) { return false; }
}

export class Wallet {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.address = null;
    this.walletName = null;
    const found = findProvider();
    this.provider = found?.provider ?? null;
    this.providerName = found?.name ?? null;

    /* A wallet can be disconnected from the wallet's own interface, and a
       screen still showing an address after that is lying about who is here. */
    this.provider?.on?.("disconnect", () => this.#set(null));
    this.provider?.on?.("accountChanged", key => this.#set(key ? key.toString() : null));
  }

  get available() { return Boolean(this.provider); }

  #set(address) {
    this.address = address;
    this.walletName = address ? this.providerName : null;
    try {
      if (address) localStorage.setItem(PREF_KEY, "1");
      else localStorage.removeItem(PREF_KEY);
    } catch (e) { /* storage disabled; the session works, it just will not resume */ }
    carry(address);
    this.onChange({ address: this.address, name: this.walletName });
  }

  /* Reconnect silently if this browser — or any other world on this domain —
     has connected before. onlyIfTrusted is the whole point: it resolves for a
     wallet that has already approved this origin and rejects otherwise, so a
     returning player keeps their name without every fresh visitor being shown
     a popup they did not ask for. */
  async resume() {
    if (!this.provider || !optedIn()) return;
    try {
      const out = await this.provider.connect({ onlyIfTrusted: true });
      const key = out?.publicKey ?? this.provider.publicKey;
      if (key) this.#set(key.toString());
    } catch (e) {
      /* Not trusted any more, or locked. Silence is correct: this runs at load
         and nobody asked for it. */
    }
  }

  /** Ask, with the popup. Throws with something sayable if it does not happen. */
  async connect() {
    if (!this.provider) {
      const err = new Error("No Solana wallet in this browser. Install Phantom or Solflare, then reload.");
      err.code = "NO_WALLET";
      throw err;
    }
    try {
      const out = await this.provider.connect();
      const key = out?.publicKey ?? this.provider.publicKey;
      if (!key) throw new Error("the wallet connected without giving an address");
      this.#set(key.toString());
      return this.address;
    } catch (err) {
      /* 4001 is the wallet standard's "user rejected", and it is not an error
         worth a red line — they changed their mind, which is allowed. */
      if (err?.code === 4001) {
        const no = new Error("Wallet connection cancelled.");
        no.code = "CANCELLED";
        throw no;
      }
      throw err;
    }
  }

  async disconnect() {
    try { await this.provider?.disconnect?.(); } catch (e) { /* it is going regardless */ }
    this.#set(null);
  }
}
