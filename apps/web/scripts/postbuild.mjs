// Post-build: publish the single-file build into upload/cursors/, the folder
// the owner's Vercel project serves. The whole game is one self-contained HTML
// file (vite-plugin-singlefile inlines everything), so "deploying" is copying
// one file — Vercel needs no build step, it just serves the folder as-is.
// Claude artifacts are deprecated (owner, 2026-08-09); dist/artifact.html is
// no longer written.
//
// The U+FFFD escaping stays: webamp's string_decoder ships literal "�" chars
// and at least one hosting pipeline rejected them. Escaping inside JS strings
// is proven safe, so the deploy copy keeps it as armor.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(webRoot));
const distPath = join(webRoot, "dist", "index.html");
let s = readFileSync(distPath, "utf8");

const FFFD = String.fromCharCode(0xfffd);
const count = s.split(FFFD).length - 1;
if (count) s = s.replaceAll(FFFD, "\\ufffd");
writeFileSync(distPath, s);

const uploadDir = join(repoRoot, "upload", "cursors");
mkdirSync(uploadDir, { recursive: true });
writeFileSync(join(uploadDir, "index.html"), s);

console.log("postbuild: escaped", count, "U+FFFD; wrote upload/cursors/index.html (", s.length, "chars )");
