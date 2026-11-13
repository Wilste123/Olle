# Olle — ready for William (v0.2 Phase 1)

## One-time configuration

Copy `.env.example` → `.env` and set:

| Secret / value | Required? | Purpose |
|----------------|-----------|---------|
| `OPENAI_API_KEY` | Optional (preferred) | ChatGPT decide + speak via OpenAI API |
| `ANTHROPIC_API_KEY` | Optional | Claude decide + speak (alternative) |
| `OLLE_LLM_PROVIDER` | Optional | `openai` \| `anthropic` \| `heuristic` — auto-picks OpenAI when `OPENAI_API_KEY` is set |
| `OLLE_DECIDE_MODEL` | Optional | Default `gpt-4o-mini` (OpenAI) |
| `OLLE_SPEAK_MODEL` | Optional | Default `gpt-4o-mini`; use `gpt-4o` for speak only if you want richer tone |
| `WILLIAM_EMAIL` | **Yes** (email + inbound) | Outbound recipient + inbound allow-list |
| `OLLE_INBOUND_ALLOWLIST` | Recommended | Comma-separated allowed reply senders (defaults to `WILLIAM_EMAIL`) |
| `RESEND_API_KEY` + `OLLE_EMAIL_FROM` | Optional together | Real outbound mail; mock otherwise |
| `OLLE_QUIET_HOURS` | Optional | e.g. `22:00-08:00` — no proactive email in window |
| `OLLE_QUIET_TZ` | Optional | Default `Europe/Oslo` |
| Resend inbound route | Production | Point webhook to `https://<tunnel>/webhooks/email/inbound` |

## Daily commands

```bash
git clone https://github.com/Wilste123/Olle.git
cd Olle
cp .env.example .env   # edit
npm install
npm run build
npm test
npm run dev            # mind loop + inbound server + dashboard (local)
```

Open **http://127.0.0.1:8787/dashboard** (or `/api/now`, `/api/feed`, `/api/audit`). **Prat:** `/chat` eller `olle say "…"`.

## Email rate limits (Phase 1)

- Proactive: **2 / 24h** soft (decide masking), **4 / 24h** hard, **4h** min gap
- Permission emails: **3 / 24h** (still sent during quiet hours)
- Quiet hours: set `OLLE_QUIET_HOURS` — proactive sends blocked; audit logs `email_suppressed`

## Inbound offerings

Non–YES/NO messages enqueue for the next mind tick; Olle **remembers** a snippet in `memories` and Sense sees `inboundSinceLastTick`.

## Permission flow check

1. Let Olle run until a Class C `propose_shared_diary_entry` (or trigger ticks).
2. See permission in `npm run olle -- status` or mock email log.
3. Approve: `npm run olle -- permit approve <request-id>` **or**
   ```bash
   curl -s -X POST http://127.0.0.1:8787/webhooks/email/inbound \
     -H 'content-type: application/json' \
     -d '{"from":"you@example.com","text":"YES <request-id>"}'
   ```
4. Shared diary queue entry should show `published`.

## What stays manual

- DNS / Resend domain verification for production email
- Public HTTPS tunnel (ngrok, etc.) if Resend must reach your laptop
