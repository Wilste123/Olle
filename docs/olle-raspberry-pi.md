# Olle on Raspberry Pi (self-host alternative)

**Optional:** run Olle on a Pi 4/5 on your LAN instead of [Fly.io](olle-fly.md). William’s default layout is Fly as the 24/7 brain; use this guide only if you want hardware at home. State on local disk (SSD strongly preferred over SD-only).

## Hardware

| Piece | Notes |
|-------|--------|
| **Pi 4 (4GB+) or Pi 5** | Always-on, low power |
| **SSD** | USB boot or NVMe hat; store repo + `OLLE_STATE_PATH` here |
| **Ethernet** | Preferred where possible; Wi‑Fi through a **range extender** between houses is fine |
| **Power** | Official supply; UPS optional |

## Network (two houses / extender)

- Put the Pi on the network segment where Olle should “live” (often the lower house).
- Give the Pi a **stable address**:
  - **Router DHCP reservation** for the Pi’s MAC (simplest), or
  - **mDNS** — install `avahi-daemon`, set hostname `olle` → browsers may resolve `http://olle.local:8787/`
- For the **upper-house kiosk**, prefer HTTPS to Fly ([olle-kiosk-display.md](olle-kiosk-display.md)). A Pi-hosted kiosk can use `http://<pi-ip>:8787/kiosk` only if Fly is not your brain.

Do **not** expose port 8787 to the public internet without auth. On LAN, set session login (below).

## Software

```bash
# Node 20 (NodeSource or nvm)
node -v   # v20.x

git clone https://github.com/Wilste123/Olle.git
cd Olle
cp .env.example .env   # edit secrets — never commit
npm ci
npm run build
npm test
```

### `.env` highlights (Pi)

```bash
OLLE_STATE_PATH=/var/lib/olle/state.json
OLLE_INBOUND_PORT=8787
OLLE_BIND_HOST=0.0.0.0

# LAN security — same session model as Fly (PR #7)
OLLE_PUBLIC=1
OLLE_AUTH_PASSWORD=your-long-password
OLLE_SESSION_SECRET=openssl-rand-hex-32

WILLIAM_EMAIL=you@example.com
# LLM keys, Resend, etc. as in .env.example
```

`OLLE_BIND_HOST=0.0.0.0` makes the server reachable from other machines on the LAN (kiosk, phone, laptop). Default without this variable is loopback-only (`127.0.0.1`).

Create state directory:

```bash
sudo mkdir -p /var/lib/olle
sudo chown "$USER:$USER" /var/lib/olle
```

## systemd unit

`/etc/systemd/system/olle.service`:

```ini
[Unit]
Description=Olle mind + inbound
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=olle
Group=olle
WorkingDirectory=/home/olle/Olle
EnvironmentFile=/home/olle/Olle/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Adjust `User`, paths, and `ExecStart` if you use `node apps/mind/dist/start.js` directly after `npm run build`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now olle.service
sudo systemctl status olle.service
journalctl -u olle.service -f
```

## Verify

```bash
curl -sS http://127.0.0.1:8787/health
```

From another machine on LAN: open `http://<pi-ip>:8787/login`, sign in once, then `/dashboard` or `/kiosk`.

## Resend inbound

Point Resend’s inbound webhook to:

```text
http://<pi-lan-ip-or-hostname>:8787/webhooks/email/inbound
```

Webhooks stay **unauthenticated** at the HTTP layer; sender allow-list still applies in app code. For inbound from the public internet you need a tunnel or reverse proxy — Pi-first setup usually uses email provider → your home URL via Tailscale, ngrok, or similar only if required.

## Related

- **Primary host:** [Fly.io](olle-fly.md)
- [Deployment overview](olle-deployment.md)
- [Kiosk display](olle-kiosk-display.md) (Fly URL)
