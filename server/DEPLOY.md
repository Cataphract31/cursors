# CURSORS.EXE beta server — deployment

**Live at:** `wss://cursors.34-60-159-134.sslip.io` · health: `https://cursors.34-60-159-134.sslip.io/health`

Runs on the same GCP always-free VM as the THIN ICE beta (`arcade`, formerly
`thinice-beta`; project
`symmetric-index-504915-s4`, us-central1-a, Debian 12, Node 22, Caddy). The two
services are fully separate: THIN ICE owns `:8787` + `34.60.159.134.sslip.io`,
CURSORS owns `:8788` + `cursors.34-60-159-134.sslip.io`. Caddy terminates TLS for
both (auto Let's Encrypt via sslip.io). **Never touch the thinice service.**

> **The IP is now a reserved static address, and that retired this failure mode.**
> It was ephemeral until 2026-08-20 and moved twice (`34.70.75.204` →
> `34.60.159.134`); it is now held as `arcade-ip` in us-central1
> (`gcloud compute addresses list`), so a VM stop/start no longer changes it.
>
> Written down in case the reservation is ever released: because every name is
> `<x-y-z-w>.sslip.io`, a new address stops the old names resolving to this box and
> breaks, all at once, the four Caddy site blocks, this client's default `wss://` URL
> in `apps/web/src/main.js`, the `connect-src` in `vercel.json`, and the signer that
> dials in over the public name. Fix in this order — Caddy first (all four blocks,
> then `caddy validate` + `systemctl reload caddy`, new certs issue automatically),
> then the repo refs, then rebuild/vendor/push the client. The signature of this
> particular breakage is HTTPS dead on every host while SSH still works: Caddy has no
> certificate for a hostname it has not been told about yet.

| | |
|---|---|
| Code | `/opt/cursors` (owner `cursors`, a system user) |
| DB | `/var/lib/cursors/cursors.db` (node:sqlite, play money, wipe-at-will) |
| Service | `cursors.service` — `PORT=8788`, `CORPSES=900` (≈36 min epochs; raise for longer rounds), `MemoryMax=220M`, Restart=always |
| TLS | site block appended to `/etc/caddy/Caddyfile` (backups: `Caddyfile.bak-*`) |

## Manage (raw OpenSSH — not `gcloud compute ssh`, it hangs under the harness)

```bash
ssh -i ~/.ssh/google_compute_engine Attrition@34.60.159.134 "sudo systemctl restart cursors"
ssh -i ~/.ssh/google_compute_engine Attrition@34.60.159.134 "sudo journalctl -u cursors -n 50 --no-pager"
```

## Redeploy code

```bash
cd server && tar czf /tmp/cursors-server.tgz --exclude=node_modules --exclude='*.db*' .
scp -i ~/.ssh/google_compute_engine /tmp/cursors-server.tgz Attrition@34.60.159.134:/tmp/
ssh -i ~/.ssh/google_compute_engine Attrition@34.60.159.134 \
  "sudo tar xzf /tmp/cursors-server.tgz -C /opt/cursors && cd /opt/cursors && \
   sudo npm install --omit=dev && sudo chown -R cursors:cursors /opt/cursors && \
   sudo systemctl restart cursors"
```

## Wipe the beta DB (fresh balances for everyone)

```bash
ssh -i ~/.ssh/google_compute_engine Attrition@34.60.159.134 \
  "sudo systemctl stop cursors && sudo rm /var/lib/cursors/cursors.db* && sudo systemctl start cursors"
```

**Tuning round length** is one number — deaths to fill the disk:

```bash
ssh -i ~/.ssh/google_compute_engine Attrition@34.60.159.134   "sudo sed -i 's/^Environment=CORPSES=.*/Environment=CORPSES=1500/' /etc/systemd/system/cursors.service &&    sudo systemctl daemon-reload && sudo systemctl restart cursors"
```

At the observed ~25 deaths/min (bots only, more players = faster): 900 ≈ 36 min,
1500 ≈ 60 min, 450 ≈ 18 min.

## Local dev

```bash
cd server && npm install
FAST=1 node server.js          # 8-corpse epochs, crashes every minute or two
# client: open the dev site with #desktop-mp (connects to ws://localhost:8788)
```
