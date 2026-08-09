import { defineConfig } from "vite";

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
