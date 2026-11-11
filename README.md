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
| **Decide** | Structured action pick (Claude Haiku or heuristic); validated against manifest |
| **Act** | Typed executor; Class C creates 72h permission requests |
| **Speak** | Second LLM pass (Claude Sonnet or templates) after action is locked |

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

## AI architecture

Olle uses **decide-then-speak** (two calls, never one blob):

1. **Decide** (`HeuristicProvider` or `AnthropicProvider`) — inputs: feelings, legal actions from the manifest, memory snippets, feed tail. Output must be JSON `{ action_id, params, because }`, validated before **Act** runs. Claude uses the Messages API with a `pick_action` tool.
2. **Speak** — runs **after** the action is fixed. Generates Olle’s outward voice (diary line or email body). Templates when `OLLE_LLM_PROVIDER=heuristic` or no API key.

**Cost control:** If nothing is salient (calm idle continuation), the decide LLM is **skipped** and Olle picks `continue_activity` without calling Claude. Token usage is appended to the state feed when LLM runs.

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | — | Enables Claude |
| `OLLE_LLM_PROVIDER` | `anthropic` if key set, else `heuristic` | `anthropic` \| `heuristic` \| `openai` (stub) |
| `OLLE_DECIDE_MODEL` | `claude-haiku-4-5-20251001` | Fast structured decide |
| `OLLE_SPEAK_MODEL` | `claude-sonnet-4-5-20250929` | Character speak |

**Rough cost (personal use):** With idle skip, expect on the order of tens of decide calls per day → well under a dollar/day on Haiku decide + occasional Sonnet speak. Continuous 30s ticks without salience mostly cost **zero** LLM tokens.

No `ANTHROPIC_API_KEY` → full **heuristic** path (no network, deterministic).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OLLE_STATE_PATH` | Path to JSON state (default: `./.olle-state.json`) |
| `OLLE_TICK_MS` | Loop interval when running `tick-loop.ts` |
| `OLLE_VERBOSE` | `1` logs mock email subjects |
| `RESEND_API_KEY` | Real outbound email via Resend |
| `OLLE_EMAIL_FROM` | From address (e.g. `olle@yourdomain.com`) |
| `WILLIAM_EMAIL` | Recipient allow-list default |

See **AI architecture** above for LLM env vars. Without keys, Olle runs in **dry/mock mode** (heuristic decide + mock email).

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
