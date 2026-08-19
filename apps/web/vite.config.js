import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import musicPlugin from "./scripts/music-plugin.mjs";

/**
 * THE ARCADE'S WALLET IS FETCHED, NOT COPIED.
 *
 * This app used to carry eight files of it in src/arcade/, kept in step by a
 * sync script. They were byte-identical to C:\GIELINORrcade\web\ by
 * construction -- that was the point -- and they still cost a sync, a rebuild
 * and a re-vendor every time a wallet bug was fixed, in three separate repos,
 * for a fix that was already written.
 *
 * The copies existed for one reason and it was never about the wallet: a
 * bundler in a separate repository cannot resolve `#arcade/web/wallet.js`,
 * because that import map is the arcade's and the file is not in this tree.
 * Build-time resolution, nothing else.
 *
 * SO IT IS NOT RESOLVED AT BUILD TIME ANY MORE. Every world is served from one
 * origin -- voidsolana.com/cursors/ sits beside voidsolana.com/arcade/web/,
 * which the arcade's .vercelignore publishes on purpose -- so the specifier is
 * a real URL on the same site. Marked external below, the import survives into
 * the output untouched and the browser fetches the one copy the arcade serves,
 * `must-revalidate`, so a fix lands the moment GIELINOR deploys.
 *
 * THE CSP ALLOWS IT WITHOUT A CHANGE. vercel.json sends `script-src 'self'`,
 * and this is 'self': the same origin the page came from. That is only true
 * because the worlds share the portal's site rather than sitting on subdomains
 * -- the same property that makes one wallet approval cover every game.
 *
 * WHAT THIS TRADES, PLAINLY: no version pinning. A broken wallet.js breaks
 * every world at once instead of one at a time. Chosen deliberately; the way
 * back is to import a copy again.
 *
 * AND DEV FETCHES IT TOO, from the arcade checkout next door, so `npm run dev`
 * exercises the real module over a real request rather than a bundled stand-in.
 * Without a checkout it 404s, which is loud and honest.
 */
function serveArcade() {
  const root = path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    process.env.ARCADE ?? "../../../GIELINOR",
    "arcade/web",
  );
  const handler = (req, res, next) => {
    if (!req.url || !req.url.startsWith("/arcade/web/")) return next();
    const rel = decodeURIComponent(req.url.slice("/arcade/web/".length).split("?")[0]);
    const file = path.resolve(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.statusCode = 404;
      res.end(`no arcade checkout for: ${rel}`);
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    fs.createReadStream(file).pipe(res);
  };
  return {
    name: "serve-arcade-wallet",
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}

/* Normal multi-file build. It used to be a single inlined HTML file, which was
   a hard requirement of the Claude artifact host — and it cost 8.7 MB on every
   first visit, because 10.6 MB of the 12.9 was audio that base64 inflated by a
   third and gzip could not touch. We host on a real domain now, so:

   - small assets (icons, the 80 emoticons, minesweeper sprites) still inline
     into the JS/CSS at the 4 KB default: one request, no waterfall.
   - the four MP3s and the XP sound scheme become real files, fetched only when
     something actually plays them and cached by filename hash afterwards.
   - a redeploy only re-downloads the HTML and the code chunk; every asset keeps
     its content hash, so the browser keeps its copy.

   First paint goes from ~8.7 MB to a few hundred KB. */
export default defineConfig({
  /* the playlist is whatever is in public/music/ — see scripts/music-plugin.mjs */
  plugins: [musicPlugin("public/music", "public/video"), serveArcade()],
  base: "./",                     /* relative URLs: the folder can be served from anywhere */
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 4096,
    /* xp.css ships a selector lightningcss rejects (`:before:not(...)`) */
    cssMinify: "esbuild",
    /* the 184 real XP cursor files are individually tiny, and the 4 KB default
       would inline most of them as data URIs — 800 KB straight into first
       paint. They load on demand or not at all, so: always real files. */
    assetsInlineLimit: (filePath) => /xp[\\/]cursors[\\/]/.test(filePath) ? false : undefined,
    rollupOptions: {
      /* The arcade's wallet is a URL on this same site, not a file in this
         repo. Marked external so the import survives into the output untouched
         and the browser fetches the arcade's one copy. See serveArcade above. */
      external: [/^\/arcade\/web\//],
      output: {
        /* audio in its own folder so it is obvious what the weight is */
        assetFileNames: info => {
          const n = info.names && info.names[0] || info.name || "";
          if (/\.(mp3|wav|cur|ani)$/i.test(n)) return "media/[name]-[hash][extname]";
          /* Agent sprite sheets are big and load only when a companion is
             shown, so they belong with the audio in the on-demand bucket */
          if (/^(rover|merlin|clippy|links|genie|bonzi)\.png$/i.test(n)) return "media/[name]-[hash][extname]";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});
