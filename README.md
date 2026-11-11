# Olle

Private autonomous companion — Phase 0: runnable mind loop, permission gate, optional email (mock without API keys).

## Architecture (one page)

```
apps/mind/     Tick loop: sense → feel → decide → act → speak
packages/protocol/   Action manifest, types, permission TTL
```

| Step | What |
|------|------|
| **Sense** | JSON snapshot: time, placement, feelings, threads, budgets |
| **Feel** | Deterministic mood/energy/needs (`feelings/simulator.ts`) |
| **Decide** | Schema-validated action pick — LLM if `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, else heuristic |
| **Act** | Typed executor; Class C creates 72h permission requests |
| **Speak** | Templates after action is fixed |

**Placement:** Olle defaults to `{ status: "unplaced" }`. Mind ticks run fully while unplaced (private diary, rest, email stubs). Class C in Phase 0 is **shared diary proposals only** — no map pins or physical-world UI.

**World state:** JSON file (default `.olle-state.json` in cwd) — private diary, feed, permission queue, shared diary entries (pending until approved).

**Class D** actions (e.g. `add_map_pin`) exist in the manifest but are **blocked in code**.

## Quick start

```bash
npm install
npm run build
npm test
npm run tick          # one mind tick
npm run olle -- tick  # same via CLI wrapper
```

Continuous loop (30s default):

```bash
OLLE_TICK_MS=15000 npx tsx apps/mind/src/tick-loop.ts
```

Permissions:

```bash
npm run olle -- status
npm run olle -- permit approve <request-id>
npm run olle -- permit deny <request-id>
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OLLE_STATE_PATH` | Path to JSON state (default: `./.olle-state.json`) |
| `OLLE_TICK_MS` | Loop interval when running `tick-loop.ts` |
| `OLLE_VERBOSE` | `1` logs mock email subjects |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Optional structured decide |
| `ANTHROPIC_API_KEY` | Optional (decide tries OpenAI first today) |
| `RESEND_API_KEY` | Real outbound email via Resend |
| `OLLE_EMAIL_FROM` | From address (e.g. `olle@yourdomain.com`) |
| `WILLIAM_EMAIL` | Recipient allow-list default |

Without LLM or Resend keys, Olle runs in **dry/mock mode** (heuristic decide + mock email adapter).

## Actions (Phase 0)

- **Class A:** `continue_activity`, `feel_and_note`, `rest`, `think_about`, `remember`, `read_world`, `draft_email`, `sleep`
- **Class B:** `append_private_diary`, `notify_william`
- **Class C:** `propose_shared_diary_entry` (permission-gated)
- **Class D:** `add_map_pin` — blocked

## Resend (not wired in Phase 0 beyond adapter)

To send real email, set `RESEND_API_KEY` and `OLLE_EMAIL_FROM`. Inbound webhooks and YES/NO parsing from email are **not** hooked to HTTP yet; use CLI `olle permit` or call `parsePermissionReply()` from inbound text in a future webhook.

## Repo layout

```text
apps/mind/
packages/protocol/
```

See Project store `docs/olle-companion-plan.md` for full product spec.
