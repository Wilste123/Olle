# Olle on Fly.io (primary host)

Fly runs Olle **24/7**: mind loop, dashboard, session login, and Resend inbound on HTTPS with state on a Fly volume.

Full deploy assets (`Dockerfile`, `fly.toml`, `npm start` → `dist/start.js`) are on **PR #7** (`cursor/fly-hosting-auth-e462`). Merge #7 (or rebase this branch onto it) before first deploy. The steps below match that PR.

## Prerequisites

- [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) (`fly auth login`)
- Resend (optional at first)
- Strong `OLLE_AUTH_PASSWORD` and random `OLLE_SESSION_SECRET` (32+ chars)

## 1. Create the app

```bash
fly apps create olle-william
```

Set `app = "olle-william"` in `fly.toml`.

## 2. Secrets

```bash
fly secrets set \
  OLLE_AUTH_PASSWORD='your-long-password' \
  OLLE_SESSION_SECRET='openssl-rand-hex-32-output' \
  WILLIAM_EMAIL='you@yourdomain.com' \
  OLLE_INBOUND_ALLOWLIST='you@yourdomain.com'
```

Optional: `OPENAI_API_KEY`, `RESEND_API_KEY`, `OLLE_EMAIL_FROM`.

## 3. Volume

```bash
fly volumes create olle_data --region arn --size 1
```

State path on machine: `/data/.olle-state.json` (`OLLE_STATE_PATH` in `fly.toml`).

## 4. Deploy

```bash
fly deploy
curl -sS https://olle-william.fly.dev/health
```

Open `https://<app>.fly.dev/login`, then `/dashboard` or `/kiosk`.

## 5. Resend inbound

```text
https://<app>.fly.dev/webhooks/email/inbound
```

Webhook POSTs are not behind session auth; allow-list still applies in app code.

## Kiosk (second home)

Upper-house PC: [olle-kiosk-display.md](olle-kiosk-display.md) — `https://<app>.fly.dev/kiosk` after one login.

## Self-host alternative

[olle-raspberry-pi.md](olle-raspberry-pi.md) — optional LAN Pi instead of Fly.

**Index:** [olle-deployment.md](olle-deployment.md)
