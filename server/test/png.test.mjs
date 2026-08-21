import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { validGalleryPng } from "../png.js";

const pngHead = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d]),
  Buffer.from("IHDR", "ascii"),
]);

const withBody = bytes =>
  "data:image/png;base64," + Buffer.concat([pngHead, bytes]).toString("base64");

test("a real png header passes", () => {
  assert.ok(validGalleryPng(withBody(Buffer.alloc(64, 7))));
});

test("the smallest legal payload passes", () => {
  assert.ok(validGalleryPng(withBody(Buffer.alloc(2, 1))));
});

test("attribute breakout payloads fail", () => {
  for (const evil of [
    'data:image/png;base64,iVBOR" onerror="fetch(\'//evil\')" x="',
    'data:image/png;base64,iVBORw0KGgo=><script>alert(1)</script>',
    'data:image/png;base64,AAAA" onload=\'steal()\' alt="',
  ]) assert.equal(validGalleryPng(evil), false);
});

test("wrong magic, wrong chunk, or junk after the prefix fails", () => {
  const badSig = Buffer.concat([Buffer.from([0x00, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0, 0, 0, 13]), Buffer.from("IHDR", "ascii")]);
  assert.equal(validGalleryPng("data:image/png;base64," + badSig.toString("base64")), false);

  const badChunk = Buffer.concat([pngHead.slice(0, 8), Buffer.from([0, 0, 0, 13]),
    Buffer.from("JUNK", "ascii")]);
  assert.equal(validGalleryPng("data:image/png;base64," + badChunk.toString("base64")), false);

  assert.equal(validGalleryPng("data:image/png;base64,notbase64!!"), false);
  assert.equal(validGalleryPng("data:image/png;base64,"), false);
  assert.equal(validGalleryPng("data:image/jpeg;base64," + pngHead.toString("base64")), false);
  assert.equal(validGalleryPng("data:image/png;base64," + pngHead.toString("base64") + "<img src=x>"), false);
});

test("non-strings and oversize payloads fail", () => {
  assert.equal(validGalleryPng(null), false);
  assert.equal(validGalleryPng(undefined), false);
  assert.equal(validGalleryPng(42), false);
  assert.equal(validGalleryPng({}), false);
  assert.equal(validGalleryPng(withBody(Buffer.alloc(400_000)), 400_000), false);
});

test("the size cap is on the whole data url, and is enforceable", () => {
  const small = withBody(Buffer.alloc(16));
  assert.ok(small.length < 400_000);
  assert.ok(validGalleryPng(small));
  assert.equal(validGalleryPng(small, small.length - 1), false);
});
