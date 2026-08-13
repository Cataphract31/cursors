# CURSORS.EXE

PvP gambling on a Windows XP desktop. Deploy a white cursor for a fixed 0.1 SOL; it roams the desktop; touch an enemy cursor and someone dies. Odds are proportional to bounty, winner takes all, every touch is EV-neutral. Rounds, not continuous. Solana, eventually.

You get one decision — **when to stop**. Cursors fight on their own and only ever fight inside 4x their own size, so a fresh deploy cannot be eaten by the monster across the desktop.

Sibling project of THIN ICE (`c:\ZINC`) — round-based like it, and deliberately built to reuse its audited fairness, ledger, chain, and server machinery. Copy from there, never edit there. See `docs/reuse-from-thinice.md`.

## Layout

npm workspace, mirroring THIN ICE's `apps/*` shape (server joins later):

- `apps/web/` — the desktop, Vite app (vanilla JS modules, no framework yet).
  - `src/main.js` — all app code (window manager, shell, game, Winamp integration). Split into modules as it grows.
  - `src/style.css` — all styles.
  - `index.html` — markup.
  - `scripts/smoke.mjs` — runs the whole module under a stub DOM in node; catches strict-mode/load-time crashes pre-build.
  - `scripts/postbuild.mjs` — escapes U+FFFD and audits the `dist/` Vercel serves.
  - `scripts/shot.mjs` · `probe.mjs` · `tourshot.mjs` — headless Edge drivers over CDP: screenshot, screenshot + `EVAL_EXPR`, and element-clipped capture (used to regenerate the How to Play slides; also does mid-session `ROTATE=WxH`).
- `server/` — the authoritative sim, ws server and sqlite ledger. Deploys separately, see `server/DEPLOY.md`.
- `docs/` — design and reuse notes.

Commands (repo root): `npm install`, `npm run dev` (Vite dev server with HMR), `npm run build` (smoke test → multi-file `apps/web/dist/`). Server tests: `cd server && npm test`.

The build is deliberately **multi-file** — it was one inlined HTML file only because the Claude artifact host demanded it, which cost 8.7 MB on every first visit. Do not reintroduce `vite-plugin-singlefile`.

Winamp is the real one — [Webamp](https://github.com/captbaritone/webamp) from npm, inlined at build. The house tracks are real MP3s in `public/music/`, fetched only when something plays them.

## Economics (agreed so far)

- Fixed entry: 0.100 SOL per cursor = 0.097 arena + 0.001 platform fee (1%) + 0.002 rakeback pool (2%).
- Up to 5 cursors per player per round; own cursors cluster, never fight each other.
- Duel: P(A wins) = A/(A+B), winner takes both bounties. P(ever reaching ×N) = 1/N.
- **The food chain**: a cursor only fights inside **4×** its own size. This decides which fights happen, never how they resolve, so every duel is still A/(A+B) and the ladder still prices ×N at 1/N. Measured against the free-for-all: whale-farming of fresh deploys 83% → 0%, "new player eaten by something enormous" 35.8% → 3.3%, per-deploy variance −35%, right tail unchanged.
- **Weight classes** are worn, not chosen: one rank per 4× step (plain, 3D-White at 4×, 3D-Bronze at 16×, Dinosaur at 64×), each a real XP pointer scheme, swapped live when you cross a boundary. A rank step is exactly the reach of the rule, so "can I fight that" reads off the arrow.
- **Two verbs: DEPLOY and RECALL.** Stances were cut once the food chain made every reachable fight close to even.
- Each deploy mints 200 rakeback tickets, 45-day half-life; ticket share pays the 2% pool. Effective RTP 99%.
- Round shape: deploys open → battle → the disk fills → shutdown rush → BSOD → results. There is no clock: **every death writes a 12 MB corpse to C:, and a full disk is the crash.** Nothing is confiscated; the crash banks everyone in full.
- The field is sized to the crowd at each epoch start (~32k px² per cursor, 16:10, capped at 3×) and announced with the seed commit, so it is fixed for the round and identical for everyone in it.

## Deploy

Vercel builds this repo directly: root `vercel.json` runs `npm run build`
(workspace -> apps/web) and serves `apps/web/dist`. Nothing built is committed.
Ship = push to `main`. The game server (server/) deploys separately over ssh —
see server/DEPLOY.md.
