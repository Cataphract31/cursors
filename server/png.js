// The gallery accepts a data URL from strangers and shows it to everyone.
// A prefix check ("does it start with data:image/png;base64,") is not a check:
// everything after the comma was free text, so a payload like
//   data:image/png;base64,iVBOR" onerror="...
// rode into every client's <img src="${png}"> intact. The renderer now escapes
// too, but the server does not get to rely on that -- this is the one place
// user bytes are stored verbatim and rebroadcast, so the bytes themselves are
// pinned here: base64 charset only, decodable, and the decoded head must be a
// real PNG signature followed by an IHDR chunk header.
const DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;

export const GALLERY_PNG_MAX = 400_000;

export function validGalleryPng(png, maxChars = GALLERY_PNG_MAX) {
  if (typeof png !== "string" || png.length > maxChars) return false;
  const m = DATA_URL.exec(png);
  if (!m || m[1].length < 24) return false;
  const head = Buffer.from(m[1].slice(0, 32), "base64");
  return head.length >= 16
    && head.readUInt32BE(0) === 0x89504e47   // \x89 P N G
    && head.readUInt32BE(4) === 0x0d0a1a0a   // \r \n \x1a \n
    && head.readUInt32BE(8) === 0x0000000d   // IHDR chunk is always 13 bytes
    && head.readUInt32BE(12) === 0x49484452; // "IHDR"
}
