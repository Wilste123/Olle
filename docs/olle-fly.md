# Olle on Fly.io (William’s home)

Fly is the primary always-on host for Olle: mind loop, dashboard, kiosk, and Resend inbound on one machine with persistent state on a volume.

## Prerequisites

- [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) logged in (`fly auth login`)
- Resend domain + API key (optional at first — outbound mocks without keys)
- A strong `OLLE_AUTH_PASSWORD` and random `OLLE_SESSION_SECRET` (32+ characters)

## 1. Create the app

Pick a unique name (replace `olle` in `fly.toml` if needed):

```bash
fly apps create olle-william
```

Edit `fly.toml`: set `app = "olle-william"` to match.

## 2. Secrets and env

William-only session login is required on Fly (`FLY_APP_NAME` is set automatically; `OLLE_PUBLIC=1` is in `fly.toml`).

```bash
fly secrets set \
  OLLE_AUTH_PASSWORD='your-long-password' \
  OLLE_SESSION_SECRET='openssl-rand-hex-32-output' \
  WILLIAM_EMAIL='you@yourdomain.com' \
  OLLE_INBOUND_ALLOWLIST='you@yourdomain.com'

# Optional LLM + email
fly secrets set OPENAI_API_KEY='sk-...' RESEND_API_KEY='re_...' OLLE_EMAIL_FROM='olle@yourdomain.com'
```

Never commit secrets. Fly injects `FLY_APP_NAME`; do not set it manually.

## 3. Persistent volume

State file path on the machine: `/data/.olle-state.json` (`OLLE_STATE_PATH` in `fly.toml`).

```bash
fly volumes create olle_data --region arn --size 1
```

The volume name must match `[[mounts]]` `source = "olle_data"` in `fly.toml`. Use the same region as `primary_region`.

## 4. Deploy

From the repo root (Dockerfile builds Node 20 image, `npm ci`, `npm run build`, `CMD npm start`):

```bash
fly deploy
```

Check health (no login required):

```bash
curl -sS https://olle-william.fly.dev/health
```

Open `https://<your-app>.fly.dev/login`, sign in, then **Dashboard** at `/dashboard` or fullscreen **Kiosk** at `/kiosk` (optional `?view=world`).

## 5. Resend inbound webhook

Point Resend’s inbound route to:

```text
https://<your-app>.fly.dev/webhooks/email/inbound
```

(`OLLE_INBOUND_PATH` default — must match Resend configuration.)

Webhook POSTs are **not** behind session auth; sender allow-list still applies in app code.

## Kiosk (second home)

Upper-house display: [olle-kiosk-display.md](olle-kiosk-display.md) — Chromium pointed at `https://<app>.fly.dev/kiosk` after one login.

## Operations

| Task | Command |
|------|---------|
| Logs | `fly logs` |
| SSH console | `fly ssh console` |
| Scale memory | edit `[[vm]]` in `fly.toml`, redeploy |
| Backup state | `fly ssh sftp get /data/.olle-state.json` |

## Local vs Fly

| | Local `npm run dev` | Fly |
|--|-------------------|-----|
| Auth | Off (unless `OLLE_PUBLIC=1`) | On — password + cookie |
| State | `.olle-state.json` in cwd | Volume at `/data` |
| Bind | `0.0.0.0:8787` default | Same via `OLLE_BIND_HOST` |

After code changes: `npm run build && npm test` locally, then `fly deploy`.

## Pi / second home (optional)

You can still run a copy on a Raspberry Pi with the same image or `npm start`; Fly remains the canonical URL for Resend and daily login unless you change DNS/webhooks. See [olle-raspberry-pi.md](olle-raspberry-pi.md).

**Index:** [olle-deployment.md](olle-deployment.md)
