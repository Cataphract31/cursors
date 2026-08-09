/* Deterministic randomness for the arena — a straight JS port of THIN ICE's
   audited rng.ts (sfc32, 128-bit seed). Every draw the sim makes during an
   epoch flows through one of these streams, and the seed is committed
   (sha256 published) before the epoch and revealed at the crash.

   Why sfc32 and not something smaller: the commit ceremony publishes a hash
   of the seed BEFORE play. A 32-bit seed would make that hash an oracle —
   enumerate 4.3 billion candidates and you have every duel in advance. 128
   bits closes that, and sfc32 uses only int32 ops, which ECMAScript specifies
   exactly, so any replay reproduces the epoch bit for bit. */

import { createHash, randomBytes } from "node:crypto";

export function sfc32(a, b, c, d) {
  let s0 = a >>> 0, s1 = b >>> 0, s2 = c >>> 0, s3 = d >>> 0;
  const rng = {
    next() {
      const t = (((s0 + s1) | 0) + s3) | 0;
      s3 = (s3 + 1) | 0;
      s0 = s1 ^ (s1 >>> 9);
      s1 = (s2 + (s2 << 3)) | 0;
      s2 = (s2 << 21) | (s2 >>> 11);
      s2 = (s2 + t) | 0;
      return (t >>> 0) / 4294967296;
    },
  };
  /* diffuse before anyone reads: the first draws must not correlate with the
     raw seed bytes */
  for (let i = 0; i < 12; i++) rng.next();
  return rng;
}

export function rngFromSeedHex(seedHex) {
  if (!/^[0-9a-fA-F]{32,}$/.test(seedHex))
    throw new Error(`seed must be at least 128 bits of hex, got "${seedHex}"`);
  const w = i => parseInt(seedHex.slice(i * 8, i * 8 + 8), 16) >>> 0;
  return sfc32(w(0), w(1), w(2), w(3));
}

export function newSeedHex() { return randomBytes(16).toString("hex"); }

export function commitOf(seedHex) {
  return createHash("sha256").update(seedHex).digest("hex");
}
