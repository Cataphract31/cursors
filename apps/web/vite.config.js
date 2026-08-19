import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import musicPlugin from "./scripts/music-plugin.mjs";

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

export default defineConfig({
  plugins: [musicPlugin("public/music", "public/video"), serveArcade()],
  base: "./",
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 4096,
    cssMinify: "esbuild",
    assetsInlineLimit: (filePath) => /xp[\\/]cursors[\\/]/.test(filePath) ? false : undefined,
    rollupOptions: {
      external: [/^\/arcade\/web\//],
      output: {
        assetFileNames: info => {
          const n = info.names && info.names[0] || info.name || "";
          if (/\.(mp3|wav|cur|ani)$/i.test(n)) return "media/[name]-[hash][extname]";
          if (/^(rover|merlin|clippy|links|genie|bonzi)\.png$/i.test(n)) return "media/[name]-[hash][extname]";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});
