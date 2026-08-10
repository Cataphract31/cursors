# CURSORS.EXE

PvP gambling on a Windows XP desktop. Deploy a white cursor for a fixed 0.1 SOL; it roams the desktop; touch an enemy cursor and someone dies. Odds are proportional to bounty, winner takes all, every touch is EV-neutral. Rounds, not continuous. Solana, eventually.

Sibling project of THIN ICE (`c:\ZINC`) — round-based like it, and deliberately built to reuse its audited fairness, ledger, chain, and server machinery. Copy from there, never edit there. See `docs/reuse-from-thinice.md`.

## Layout

npm workspace, mirroring THIN ICE's `apps/*` shape (server joins later):

- `apps/web/` — the desktop, Vite app (vanilla JS modules, no framework yet).
  - `src/main.js` — all app code (window manager, shell, game, Winamp integration). Split into modules as it grows.
  - `src/style.css` — all styles.
  - `index.html` — markup.
  - `scripts/smoke.mjs` — runs the whole module under a stub DOM in node; catches strict-mode/load-time crashes pre-build.
  - `scripts/postbuild.mjs` — escapes U+FFFD and emits `dist/artifact.html` (skeleton-stripped) for artifact publishing.
- `docs/` — design and reuse notes.

Commands (repo root): `npm install`, `npm run dev` (Vite dev server with HMR), `npm run build` (smoke test → single-file `dist/index.html` + `dist/artifact.html`).

Winamp is the real one — [Webamp](https://github.com/captbaritone/webamp) from npm, inlined at build. The 7 house tracks are synthesized to WAV via OfflineAudioContext at runtime and appended to its playlist as they finish. Publishing: `dist/artifact.html` → the claude.ai artifact (single URL, kept stable).

## Economics (agreed so far)

- Fixed entry: 0.100 SOL per cursor = 0.097 arena + 0.001 platform fee (1%) + 0.002 rakeback pool (2%).
- Up to 5 cursors per player per round; own cursors cluster, never fight each other.
- Duel: P(A wins) = A/(A+B), winner takes both bounties. P(ever reaching ×N) = 1/N.
- Each deploy mints 200 rakeback tickets, 45-day half-life; ticket share pays the 2% pool. Effective RTP 99%.
- Round shape: join (deploys open) → battle (duels; late join in the first 30s) → shutdown (last 15s, all cursors auto-recall to start) → results. Nothing is confiscated at shutdown.

## Deploy

Vercel builds this repo directly: root `vercel.json` runs `npm run build`
(workspace -> apps/web) and serves `apps/web/dist`. Nothing built is committed.
Ship = push to `main`. The game server (server/) deploys separately over ssh —
see server/DEPLOY.md.
