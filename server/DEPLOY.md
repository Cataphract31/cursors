# CURSORS.EXE beta server — deployment

**Live at:** `wss://cursors.34-70-75-204.sslip.io` · health: `https://cursors.34-70-75-204.sslip.io/health`

Runs on the same GCP always-free VM as the THIN ICE beta (`thinice-beta`, project
`symmetric-index-504915-s4`, us-central1-a, Debian 12, Node 22, Caddy). The two
services are fully separate: THIN ICE owns `:8787` + `34.70.75.204.sslip.io`,
CURSORS owns `:8788` + `cursors.34-70-75-204.sslip.io`. Caddy terminates TLS for
both (auto Let's Encrypt via sslip.io). **Never touch the thinice service.**

| | |
|---|---|
| Code | `/opt/cursors` (owner `cursors`, a system user) |
| DB | `/var/lib/cursors/cursors.db` (node:sqlite, play money, wipe-at-will) |
| Service | `cursors.service` — `PORT=8788`, `CORPSES=900` (≈36 min epochs; raise for longer rounds), `MemoryMax=220M`, Restart=always |
| TLS | site block appended to `/etc/caddy/Caddyfile` (backups: `Caddyfile.bak-*`) |

## Manage (raw OpenSSH — not `gcloud compute ssh`, it hangs under the harness)

```bash
ssh -i ~/.ssh/google_compute_engine Attrition@34.70.75.204 "sudo systemctl restart cursors"
ssh -i ~/.ssh/google_compute_engine Attrition@34.70.75.204 "sudo journalctl -u cursors -n 50 --no-pager"
```

## Redeploy code

```bash
cd server && tar czf /tmp/cursors-server.tgz --exclude=node_modules --exclude='*.db*' .
scp -i ~/.ssh/google_compute_engine /tmp/cursors-server.tgz Attrition@34.70.75.204:/tmp/
ssh -i ~/.ssh/google_compute_engine Attrition@34.70.75.204 \
  "sudo tar xzf /tmp/cursors-server.tgz -C /opt/cursors && cd /opt/cursors && \
   sudo npm install --omit=dev && sudo chown -R cursors:cursors /opt/cursors && \
   sudo systemctl restart cursors"
```

## Wipe the beta DB (fresh balances for everyone)

```bash
ssh -i ~/.ssh/google_compute_engine Attrition@34.70.75.204 \
  "sudo systemctl stop cursors && sudo rm /var/lib/cursors/cursors.db* && sudo systemctl start cursors"
```

**Tuning round length** is one number — deaths to fill the disk:

```bash
ssh -i ~/.ssh/google_compute_engine Attrition@34.70.75.204   "sudo sed -i 's/^Environment=CORPSES=.*/Environment=CORPSES=1500/' /etc/systemd/system/cursors.service &&    sudo systemctl daemon-reload && sudo systemctl restart cursors"
```

At the observed ~25 deaths/min (bots only, more players = faster): 900 ≈ 36 min,
1500 ≈ 60 min, 450 ≈ 18 min.

## Local dev

```bash
cd server && npm install
FAST=1 node server.js          # 8-corpse epochs, crashes every minute or two
# client: open the dev site with #desktop-mp (connects to ws://localhost:8788)
```
