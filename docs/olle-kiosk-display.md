# Olle kiosk display (upper house)

Old PC + monitor in the **upper house** runs Chromium in kiosk mode. Olle’s **brain stays on Fly**; the screen only needs HTTPS to your app.

## URL

```text
https://<your-fly-app>.fly.dev/kiosk
```

Optional map embed after World v1: `?view=world`.

## Setup once

1. On the kiosk machine, open `https://<your-fly-app>.fly.dev/login`
2. Enter `OLLE_AUTH_PASSWORD` — Chromium keeps the session cookie
3. Switch to kiosk URL (bookmark or autostart below)

No passwords in URLs or fragments.

## Chromium autostart (Linux)

`~/.config/autostart/olle-kiosk.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=Olle Kiosk
Exec=chromium --kiosk --noerrdialogs https://YOUR-APP.fly.dev/kiosk
X-GNOME-Autostart-enabled=true
```

**macOS:** Login Items → Chrome `--kiosk --app=https://YOUR-APP.fly.dev/kiosk` (after login once).

## Placement

Monitor **over the door** — large type on `/kiosk`, glance at placement, feelings, and what Olle is doing. Wi‑Fi extender between houses is fine; only outbound HTTPS to Fly is required.

**Deploy brain:** [olle-fly.md](olle-fly.md) · [olle-deployment.md](olle-deployment.md)
