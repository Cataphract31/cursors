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

   THAT LAST PARAGRAPH DESCRIBED A GAP, AND THIS FILE IS WHERE IT CLOSED. The
   signed challenge it says "until that exists" about now exists: the arcade
   issues a nonce, the wallet signs it, and what comes back is a session token
   that IS a credential. So connecting here signs you in, and the address stays
   what it always was -- a name -- with the signature doing the proving. This
   machine's own mpToken is untouched and still holds the seat; what the
   session buys is money, which a seat never could.

   Nothing here approves a TRANSACTION. Signing a sentence proves a key is
   yours; it moves nothing, and the sentence the wallet displays says so.

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
/* The arcade's proof, as opposed to the arcade's claim. `zinc_wallet` above is
   a name this browser goes by; this is the token minted in exchange for a
   signature, and it is the only thing that makes a balance safe to key to an
   address. Every world on this domain reads it, so signing in once anywhere
   signs you in everywhere. */
const SESSION_COOKIE = "zinc_session";

/* WHERE THE ARCADE'S ISSUER LIVES.
   This page is static and its API is not: the client is served from Vercel and
   every route that knows anything runs on the box. Same arrangement as the
   game socket a few lines up in main.js, same hard-coded origin, and localhost
   is exempt by hostname so a local run does not sign in against production. */
const ARCADE = "https://gielinor.34-70-75-204.sslip.io";
const arcadeUrl = (path) => {
  try {
    const q = new URLSearchParams(location.search).get("arcade");
    if (q) return q.replace(/\/+$/, "") + path;
    if (/^(localhost|127\.)/.test(location.hostname)) return path;
  } catch (e) { /* no location; fall through to the deployed box */ }
  return ARCADE + path;
};
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

/** One cookie by name, or "". */
function cookie(name) {
  try {
    const found = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
    return found ? decodeURIComponent(found[1]) : "";
  } catch (e) { return ""; }
}

/**
 * The arcade session this browser holds, or null.
 *
 * Shape-checked before it is ever sent. A truncated or mangled cookie should
 * read as "signed out" rather than as a token the server has to reject, and a
 * rejected one costs a round trip and a visible error on the login screen.
 */
export function sessionToken() {
  const token = cookie(SESSION_COOKIE);
  return /^[0-9a-f]{64}$/.test(token) ? token : null;
}

/** Write the arcade session where every world on this domain reads it, or clear it. */
export function carrySession(token) {
  try {
    const host = location.hostname;
    const parts = [`${SESSION_COOKIE}=${token ? encodeURIComponent(token) : ""}`, "Path=/"];
    if (host === "voidsolana.com" || host.endsWith(".voidsolana.com")) parts.push("Domain=.voidsolana.com");
    parts.push(`Max-Age=${token ? MAX_AGE : 0}`, "SameSite=Lax");
    if (location.protocol === "https:") parts.push("Secure");
    document.cookie = parts.join("; ");
  } catch (e) { /* no cookie jar; this browser cannot stay signed in */ }
}

/**
 * Prove the address is yours, and keep what the arcade gives back.
 *
 * The wallet signs exactly the sentence the ISSUER sent, byte for byte.
 * Rebuilding it here would be a second implementation of the one thing that
 * must never disagree, and a signature over slightly different bytes verifies
 * against nothing at all.
 *
 * Returns false rather than throwing on every failure path -- a declined
 * popup, an old box with no issuer on it -- because the caller's fallback is
 * the same in all of them: carry on with the address as a name, which is what
 * this file did for its whole life before now.
 */
async function signIn(provider, address) {
  if (typeof provider?.signMessage !== "function") return false;
  try {
    const asked = await fetch(arcadeUrl("/api/auth/challenge"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: address }),
    });
    if (!asked.ok) return false;
    const { nonce, statement } = await asked.json();
    if (!nonce || !statement) return false;

    const { signature } = await provider.signMessage(new TextEncoder().encode(statement), "utf8");
    const proof = await fetch(arcadeUrl("/api/auth/verify"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wallet: address,
        nonce,
        signature: btoa(String.fromCharCode(...signature)),
      }),
    });
    if (!proof.ok) return false;
    const { token } = await proof.json();
    if (typeof token !== "string" || !token) return false;
    carrySession(token);
    return true;
  } catch (e) {
    return false;
  }
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
      /* AND SIGN IN, here, on the explicit press -- never on resume(). A
         signature popup belongs to a gesture the player just made. Firing one
         at somebody who only came back to watch is how a site teaches people
         to dismiss wallet dialogs without reading them, which is the habit
         every drainer relies on. If they decline they keep the name and play
         as a spectator, which is what this screen already did. */
      if (!sessionToken()) await signIn(this.provider, this.address);
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
    /* The session goes with the wallet. Leaving it behind would mean a player
       who pressed disconnect is still spending from the same balance on the
       next reload, which is not what that button says. */
    carrySession(null);
    this.#set(null);
  }
}
