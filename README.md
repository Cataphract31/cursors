# CURSORS.EXE

PvP gambling on a Windows XP desktop. Deploy a white cursor for a fixed 0.1 SOL; it roams the desktop; touch an enemy cursor and someone dies. Odds are proportional to bounty, winner takes all, every touch is EV-neutral. Rounds, not continuous. Solana, eventually.

Sibling project of THIN ICE (`c:\ZINC`) — round-based like it, and deliberately built to reuse its audited fairness, ledger, chain, and server machinery. Copy from there, never edit there. See `docs/reuse-from-thinice.md`.

## Layout

- `prototype/index.html` — self-contained playable prototype, play money, no build step. Open it in a browser or via the published artifact.
- `docs/` — design and reuse notes.

## Economics (agreed so far)

- Fixed entry: 0.100 SOL per cursor = 0.097 arena + 0.001 platform fee (1%) + 0.002 rakeback pool (2%).
- Up to 5 cursors per player per round; own cursors cluster, never fight each other.
- Duel: P(A wins) = A/(A+B), winner takes both bounties. P(ever reaching ×N) = 1/N.
- Each deploy mints 200 rakeback tickets, 45-day half-life; ticket share pays the 2% pool. Effective RTP 99%.
- Round shape: join (deploys open) → battle (duels; late join in the first 30s) → shutdown (last 15s, all cursors auto-recall to start) → results. Nothing is confiscated at shutdown.
