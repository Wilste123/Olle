import { randomBytes } from "node:crypto";
import type { InboundOffering, OlleWorldState } from "../world/store.js";
import { appendAudit, appendPinoFeed } from "../world/store.js";

export type { InboundOffering };

const MEMORY_CAP = 48;
const SNIPPET_MAX = 280;

/** Strip common reply/forward prefixes and quoted blocks (simple heuristic). */
export function stripInboundReplyBody(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^On .+ wrote:$/i.test(trimmed)) break;
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(trimmed)) break;
    if (/^From:\s*.+@/i.test(trimmed) && kept.length > 2) break;
    if (trimmed.startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

export function enqueueInboundOffering(
  state: OlleWorldState,
  input: { from: string; subject: string; text: string },
): InboundOffering {
  const body = stripInboundReplyBody(input.text);
  const snippet = body.slice(0, SNIPPET_MAX);
  const offering: InboundOffering = {
    id: `in-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`,
    from: input.from,
    subject: input.subject,
    snippet,
    text: body,
    received_at: new Date().toISOString(),
  };
  if (!state.inboundQueue) state.inboundQueue = [];
  state.inboundQueue.push(offering);
  appendAudit(state, "inbound_offering", {
    id: offering.id,
    from: offering.from,
    subject: offering.subject,
  });
  appendPinoFeed(state, "noticed", `Inbound email: ${offering.subject || "(no subject)"}`, {
    ok: true,
    about: "inbound",
    meta: { inbound_id: offering.id },
  });
  return offering;
}

/** Unprocessed offerings since last tick — memories + mark processed. */
export function processInboundForTick(state: OlleWorldState): {
  newCount: number;
  snippets: string[];
} {
  const pending = (state.inboundQueue ?? []).filter((o) => !o.processed_at);
  const snippets: string[] = [];

  for (const o of pending) {
    const memText = [o.subject, o.snippet].filter(Boolean).join(" — ").slice(0, 400);
    const key = `email:${o.id}`;
    if (!state.memories) state.memories = [];
    const existing = state.memories.find((m) => m.key === key);
    if (existing) {
      existing.text = memText;
      existing.strength = Math.min(1, existing.strength + 0.15);
      existing.updated_at = new Date().toISOString();
    } else {
      state.memories.push({
        key,
        text: memText,
        strength: 0.6,
        updated_at: new Date().toISOString(),
        source: "inbound_email",
      });
    }
    o.processed_at = new Date().toISOString();
    snippets.push(memText);
    appendPinoFeed(state, "did", `Remembered from email: ${o.subject || o.id}`, {
      ok: true,
      action_id: "remember",
      about: "memory",
      change: "remember",
    });
  }

  if (state.memories.length > MEMORY_CAP) {
    state.memories.sort((a, b) => a.strength - b.strength);
    state.memories = state.memories.slice(-MEMORY_CAP);
  }

  return { newCount: pending.length, snippets };
}

export function countUnprocessedInbound(state: OlleWorldState): number {
  return (state.inboundQueue ?? []).filter((o) => !o.processed_at).length;
}
