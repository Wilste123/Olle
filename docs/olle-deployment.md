# Olle deployment

Where to run Olle 24/7.

## Recommended: Fly.io

- **Mind + state + HTTPS** on Fly with a persistent volume
- William session login (`/login`, `OLLE_AUTH_PASSWORD`)
- Resend inbound → `https://<app>.fly.dev/webhooks/email/inbound`

**Guide:** [olle-fly.md](olle-fly.md)

**Upper-house kiosk:** fullscreen Chromium → `https://<app>.fly.dev/kiosk` — [olle-kiosk-display.md](olle-kiosk-display.md)

Dockerfile, `fly.toml`, and production `npm start` entry ship with the Fly hosting PR (#7); this repo’s session auth and `/kiosk` work on Fly once deployed.

## Local development

`npm run build && npm start` on your laptop — default bind `127.0.0.1`, no session auth unless `OLLE_PUBLIC=1`.

See [olle-ready.md](olle-ready.md).

## Optional: self-host on Raspberry Pi

Same app on a Pi on your LAN (`systemd`, `OLLE_BIND_HOST=0.0.0.0`, session auth). Use only if you want home hardware instead of Fly — not the default layout.

**Guide:** [olle-raspberry-pi.md](olle-raspberry-pi.md)

If both exist, pick **one** canonical host for Resend webhooks and state.

## Security checklist

| Exposure | Requirement |
|----------|-------------|
| Fly / public HTTPS | `OLLE_AUTH_PASSWORD` + `OLLE_SESSION_SECRET` (Fly sets `OLLE_PUBLIC=1`) |
| LAN Pi (`0.0.0.0:8787`) | Same session vars with `OLLE_PUBLIC=1` |
| Webhooks | `/webhooks/*` stay open at HTTP layer; allow-list senders |
