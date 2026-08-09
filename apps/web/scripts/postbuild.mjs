// Post-build for artifact publishing:
// 1. escape any literal U+FFFD chars (artifact pipeline rejects them; webamp's
//    string_decoder ships "�" literals) — safe inside JS strings.
// 2. dist/artifact.html: strip the doctype/html/head/body skeleton, because the
//    artifact host wraps content in its own skeleton.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distPath = join(root, "dist", "index.html");
let s = readFileSync(distPath, "utf8");

const FFFD = String.fromCharCode(0xfffd);
const count = s.split(FFFD).length - 1;
if (count) s = s.replaceAll(FFFD, "\\ufffd");
writeFileSync(distPath, s);

let a = s;
a = a.replace(/^<!doctype html>\s*/i, "");
a = a.replace(/<html[^>]*>/i, "").replace(/<\/html>/i, "");
a = a.replace(/<head[^>]*>/i, "").replace(/<\/head>/i, "");
a = a.replace(/<body[^>]*>/i, "").replace(/<\/body>/i, "");
writeFileSync(join(root, "dist", "artifact.html"), a.trim() + "\n");

console.log("postbuild: escaped", count, "U+FFFD; wrote dist/artifact.html (", a.length, "chars )");
