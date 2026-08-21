# CURSORS.EXE — pre-launch audit

Date: 2026-08-21 · Auditor: ox-alpha (static analysis + test run)
Scope: `server/` (sim, ws, ledger glue, sqlite), `apps/web/src/` (game, wallet/bank UI,
messenger, netpages), build/deploy configs (`vercel.json`, `cursors.service`,
`DEPLOY.md`, `HANDOFF.md`, vendored prod home in `C:\GIELINOR`).
Verification: `cd server && npm test` — 32/32 pass · `node scripts/smoke.mjs` — OK.

## Findings at a glance

| # | Severity | Finding |
|---|----------|---------|
| 1 | **CRITICAL** | Stored XSS on the production money origin via gallery `png` attribute injection, unmitigated (no CSP in prod) |
| 2 | High | The repo's security headers (incl. CSP) apply only to a dead Vercel project — prod origin ships none; deploy docs contradict reality |
| 3 | Medium | No rate limit on `deploy` → unauthenticated request amplification into the arcade ledger; free hold/release churn |
| 4 | Medium | Gallery list is up to ~6.4 MB per fetch; cheap bandwidth-amplification DoS vector |
| 5 | Medium | `uncaughtException`/`unhandledRejection` are logged and swallowed on a process that moves money |
| 6 | Medium | Guest identity is a client-supplied bearer token (localStorage, no expiry, no binding) — leaked token = identity/stats/chat hijack |
| 7 | Low | WS upgrade has no Origin check (CSWSH / third-party embedding) |
| 8 | Low | Guestbook signature (`who`) is client-controlled — trivial impersonation |
| 9 | Low | DM failure messages leak account existence (user enumeration oracle) |
| 10 | Low | `players` table unbounded; every name ever used is reserved forever |
| 11 | Low | `galleryPost` consumes a publish credit before the DB write, unprotected — a failed insert silently eats the credit |
| 12 | Low | Re-`hello` on a wallet-upgraded connection strands live cursors and leaks a stale `byKey` entry |
| 13 | Low | Sandbox-only cursor element interpolates owner name unescaped (self-XSS class) |
| 14 | Info | `main.js` `esc()` does not escape quotes — safe today, one refactor from an attribute sink |
| 15 | Info | Ops fragility: money origin, WSS URL and CSP all pin an sslip.io/IP name; documented, single-point-of-failure |

---

## 1. CRITICAL — Stored XSS on the production money origin (gallery)

**Chain:**

1. `server/server.js:344-346` — `galleryPost` accepts any string that
   `startsWith("data:image/png;base64,")` and is ≤ 400 000 chars. Everything after
   the prefix is **never validated as base64 or as a PNG**.
2. `apps/web/src/netpages.js:54` — renders it raw:

   ```js
   box.innerHTML = list.map(g => `<figure class="gal">
     <img src="${/^data:image\//.test(g.png) ? g.png : ""}" alt="">
   ...`)
   ```

   A payload such as `data:image/png;base64,iVBOR"><img src=x onerror="…">`
   breaks out of the `src` attribute → arbitrary HTML injected into `innerHTML`.
3. Every other user-content sink in the app is `textContent` or escaped — this is
   the one attribute-context sink fed straight from the DB.
4. **The production origin has no CSP.** The strict CSP in this repo's
   `vercel.json` applies only to this repo's Vercel project — which HANDOFF.md
   records as dead since 2026-08-16. Players load
   `www.voidsolana.com/cursors/`, served from the vendored copy in GIELINOR,
   whose `vercel.json` headers are only `nosniff`/`X-Frame-Options`/
   `Referrer-Policy`. `apps/web/index.html` carries no `<meta http-equiv="CSP">`.
   Inline `onerror=` handlers execute freely.

**Impact:** persistent, broadcast-to-everyone (server pushes `galAdd` on publish)
script execution on the origin that holds arcade sessions for real SOL:
steal/replay session tokens, impersonate players in chat/DMs, and — most
seriously — rewrite the persisted **money origin** (`arcade/web/origin.js`
persists it in localStorage) so later deposits are prepared by an attacker
endpoint and signed by users believing they're funding the arcade. Withdrawals
themselves are pinned server-side to the session's wallet (good), but deposits
and sessions are not safe from this.

**Fix (all three, they're one-line each):**
- `netpages.js`: `${esc(g.png)}` (the local `esc` already escapes `"`) — better,
  strip to `/^data:image\/png;base64,[A-Za-z0-9+/=]+$/` before use.
- `server.js galleryPost`: enforce the same strict base64 regex + decode-and-magic-byte-check server-side.
- GIELINOR `vercel.json`: ship the CSP this repo already wrote (it was authored,
  audited, and then left pointing at a project nobody loads).

## 2. HIGH — Security headers / deploy truth drift

Same facts as above, standalone: the carefully built header set in root
`vercel.json` (CSP, HSTS, Permissions-Policy, COOP) protects a project that
stopped deploying on 2026-08-16; the real origin ships none of them. Additionally
`server/DEPLOY.md` still documents the tar+scp redeploy while `cursors.service`
says `git pull` is the deploy — two contradictory runbooks for the box. Any new
header/CSP work will silently land nowhere until this is reconciled.

## 3. MEDIUM — `deploy` has no per-connection rate limit

`server.js:281` routes every `deploy` message into `deploy()` →
`ledger.hold(...)` HTTP call. While a player has < 5 live cursors, each message
costs a round-trip against the arcade ledger; with < cost, each returns
`INSUFFICIENT_FUNDS` but the call still happens. A scripted client can pump these
far faster than the UI (which is throttled by button state). Related churn:
deploy→instant-recall inside spawn grace moves a hold/release pair through the
ledger at effectively zero cost (`requestRecall` refunds graced cursors
unconditionally, `sim.js:137-145`). Cheap fix: min-interval timestamp on
`deploy` like `lastChat`/`lastDm` (500–1500 ms matches human play; auto-deploy
ticks at 1800 ms).

## 4. MEDIUM — Gallery fetch size / egress amplification

`db.galleryList` returns the latest 16 rows, each up to 400 KB of base64 →
~6.4 MB worst case per `gallery` request, allowed every 5 s per connection, 150
connections max → sustained multi-hundred-Mbps egress from a 220 MB-capped
process on a free-tier VM. Store thumbnails (or serve PNGs from object storage)
and send full images only for the lightbox; or cap the list response at a few
hundred KB.

## 5. MEDIUM — Errors swallowed on a money-moving process

`server.js:435-436`: `uncaughtException`/`unhandledRejection` log and continue.
After an unknown-state exception, continuing to accept stakes/settlements is
worse than dying: systemd has `Restart=always` and boot-time replay
(`settlePending`) + sweep make restarts safe by design — that machinery is
written and tested, so use it. Replace both handlers with log + `process.exit(1)`.

## 6. MEDIUM — Guest identity is an unauthenticated bearer token

`server.js:215` accepts any `[0-9a-f]{32}` as a returning identity;
`welcome` hands the token back and the client stores it in localStorage
(`main.js:4709`). Anyone who reads/guesses/phishes a token permanently owns that
name, stats, DM history, chat identity, and earned gallery credits. Funds are
safe (wallet requires the separate arcade session — verified: `deploy()` refuses
non-wallet keys), so this is reputation/social rather than money, but it is the
player's whole visible identity. Consider binding guest tokens to a
WebCrypto-generated keypair challenge, or at minimum allowing logout/revoke
(server currently has no revoke path; `players` rows live forever, see #10).

## 7. LOW — No Origin check on WS upgrade

Any web page can open a socket and act as a client. Token auth means CSWSH gains
nothing, but it enables hidden third-party viewers/proxies and unauthenticated
message pumping (#3). One `verifyClient`/`upgrade` origin allowlist closes it.

## 8. LOW — Guestbook impersonation

`guestPost` takes `who` from the message (`server.js:326`), sanitized only for
charset/length. Any player can sign entries as any other name. Use the
session's player name, or mark self-chosen names clearly.

## 9. LOW — Account-existence oracle in DM failures

`dmFail` distinguishes "is not signed in" (exists) from "no player called"
(doesn't exist) — `server.js:308`. Enumeration of registered names. Collapse to
one message client-side-visible, keep the distinction in logs if needed.

## 10. LOW — Unbounded identity namespace

`players` is never trimmed and `uniqueName` consults `db.nameTaken` forever —
every name ever registered blocks reuse globally, and rows accumulate. Add a
lastSeen-based prune (e.g., >90 d inactive and zero lifetime stake) or scope
name-reservation to recent activity.

## 11. LOW — Publish credit lost on DB failure

`server.js:348-350`: `gp.published++` then `db.galleryPost(...)` outside
try/catch. If the insert throws, `handle`'s catch logs, but the credit is spent.
Wrap the write first, increment after success (or compensate in catch).

## 12. LOW — Wallet session can downgrade itself via re-`hello`

A wallet-authed connection sending `hello` again gets a fresh guest key while
its live cursors stay keyed to the wallet — orders stop matching
(`recallOne(key…)` finds nothing), cursors orphan until re-`arcade`, and
`byKey[wallet]` keeps pointing at the connection after close. Either ignore
`hello` once upgraded, or migrate ownership explicitly.

## 13–15. Low/Info hygiene

- `main.js:3610` sandbox `makeCur` interpolates `owner` unescaped (own/local
  names only today; MP twin at `:4650` correctly uses `esc`). Align them.
- `main.js:4386` `esc()` omits `"`. Every current use is element content; leave
  a comment or add quote escaping so the next attribute-context use isn't a
  repeat of finding #1.
- `balances` Map in `server.js` grows per distinct wallet forever (tiny);
  `health` endpoint is open-CORS info disclosure (negligible); sslip.io-pinned
  money/ws/CSP names are a known, documented single point of failure
  (`DEPLOY.md` runbook exists — good).

## What is solid (verified, not just claimed)

- **Money conservation**: 32/32 tests pass, covering pot-vs-banked invariant,
  no double-banking on replayed recalls, ghost-session orders rejected,
  epoch rollover preserving balances, fee accounting on shutdown refunds,
  seed commit/reveal determinism. The hold→settle journal (`settlements`
  table + boot replay + sweep ordering: replay BEFORE sweep) closes the
  crash-between-bank-and-settle window correctly, with whole-ref persistence
  because `refFor` folds in a boot id.
- **Ledger key discipline**: `LEDGER_KEY` refused over non-loopback URLs;
  fail-closed when the ledger is down (deploy refused, nothing staked);
  wallet identities enter only via `ARCADE_AUTH_URL` verification — a client
  claiming an address proves nothing. Correct threat model, correctly enforced.
- **Withdrawal UX safety** (`bank.js`): payee hard-pinned to session wallet,
  wrong-wallet mismatch detection, press-twice arming with disarm on input
  change, explicit "may or may not have gone" handling for ambiguous errors,
  dust/sub-unit notice, all rendering through `textContent`.
- **systemd unit** is genuinely hardened: `ProtectSystem=strict`,
  `UMask=0077` (DB not world-readable), empty capability bounding, syscall
  filter, `PrivateTmp/PrivateDevices`, memory cap, honest comments about why
  `MemoryDenyWriteExecute` must stay absent for V8.
- **Client XSS posture elsewhere**: chat/DM/messenger/kill-feed/certificates/
  hall-of-fame all render through `textContent`, `createTextNode`, or escaped
  interpolation; emoticon substitution builds DOM nodes, never HTML.
- **Resource bounds server-side**: 512 KB WS payload cap, 150-connection cap,
  slow-sender termination (`bufferedAmount` guard), ping/pong liveness,
  trimmed chat/guestbook/DMs/gallery tables, snapshot broadcast only to
  visible clients at half tick rate.

## Pre-launch checklist (ordered)

1. Ship finding #1 fixes (client escape + server validation + prod CSP) — block launch on this.
2. Reconcile #2: decide the one real deploy path, delete the dead one, move the header set to GIELINOR.
3. Add `deploy` rate limit (#3) and gallery payload diet (#4).
4. Flip #5 to exit-on-uncaught.
5. Backlog: #6–#12.

## Remediation, same day (2026-08-21)

Applied in this repo + GIELINOR:

- **#1 closed.** `server/png.js` pins gallery uploads to decodable base64 whose
  head is a real PNG signature + IHDR (6 new tests in `test/png.test.mjs`);
  `netpages.js` renders the data URL only when it matches the same charset
  shape, escaped, in attribute context.
- **#2 closed.** The policy string is now enforced in three agreeing places:
  baked as `<meta>` into `dist/index.html` by `postbuild.mjs` (parsed from the
  same `vercel.json` rule `csp.mjs` audits, so they cannot drift), served as a
  header for `/cursors/*` from the GIELINOR `vercel.json`, and audited by
  `csp.mjs`. Browser harness run: 0 violations, 0 blocked requests, live wss
  connected, attacker frame refused. `csp.mjs` also gained the `/arcade/web/*`
  static route it was missing (its module graph 404'd and died before any CSP
  assertion — pre-existing, would have failed on clean HEAD too).
- **#3 closed.** `deploy` messages throttled to one per 500 ms per connection
  (client auto-deploy ticks at 1800 ms — honest play unaffected).
- **#4 mitigated.** Paint now downscales to ≤384 px before publishing (the
  wall never displayed more than that), gallery fetch rate-limit 5 s → 10 s.
  Legacy fat rows age out via the existing 24-row trim; a prod DB wipe clears
  them immediately.
- **#5 closed.** `uncaughtException`/`unhandledRejection` flush player stats
  best-effort and exit 1 — systemd restart + boot replay/sweep is the
  designed recovery path.
- **#6 status.** Root theft vector (XSS) is closed and the origin now has a
  CSP, which drops the residual risk to shared-machine/local-attack level.
  Keypair-bound guest identity remains a design option, not a launch blocker.

Deploy surface for these fixes: `server/` to the box (DEPLOY.md flow), then
re-vendor the web build into GIELINOR (`node tools/vendor-world.mjs cursors
apps/web/dist`) and push GIELINOR so the header + vendored build ship together.

