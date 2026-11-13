import { randomBytes } from "node:crypto";
import type { OlleWorldState } from "../world/store.js";
import { appendAudit, appendPinoFeed } from "../world/store.js";

export interface WebOffering {
  id: string;
  text: string;
  gift_label?: string;
  received_at: string;
  processed_at?: string;
}

const MEMORY_CAP = 48;
const TEXT_MAX = 4000;

export function enqueueWebOffering(
  state: OlleWorldState,
  input: { text: string; gift_label?: string },
): WebOffering {
  const text = input.text.trim().slice(0, TEXT_MAX);
  const offering: WebOffering = {
    id: `wo-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`,
    text,
    gift_label: input.gift_label?.trim().slice(0, 80) || undefined,
    received_at: new Date().toISOString(),
  };
  if (!state.webOfferings) state.webOfferings = [];
  state.webOfferings.push(offering);
  appendAudit(state, "web_offering", {
    id: offering.id,
    gift_label: offering.gift_label,
    preview: text.slice(0, 120),
  });
  const gift = offering.gift_label ? ` (${offering.gift_label})` : "";
  appendPinoFeed(state, "noticed", `William left an offering${gift}`, {
    ok: true,
    about: "web_offering",
    meta: { web_offering_id: offering.id },
  });
  return offering;
}

export function processWebOfferingsForTick(state: OlleWorldState): {
  newCount: number;
  snippets: string[];
} {
  const pending = (state.webOfferings ?? []).filter((o) => !o.processed_at);
  const snippets: string[] = [];

  for (const o of pending) {
    const memText = [o.gift_label, o.text].filter(Boolean).join(" — ").slice(0, 400);
    const key = `web:${o.id}`;
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
        strength: 0.65,
        updated_at: new Date().toISOString(),
        source: "web_offering",
      });
    }
    o.processed_at = new Date().toISOString();
    snippets.push(memText);
    appendPinoFeed(state, "did", `Took in William's offering`, {
      ok: true,
      action_id: "remember",
      about: "memory",
      change: "remember",
      meta: { web_offering_id: o.id },
    });
  }

  if (state.memories.length > MEMORY_CAP) {
    state.memories.sort((a, b) => a.strength - b.strength);
    state.memories = state.memories.slice(-MEMORY_CAP);
  }

  return { newCount: pending.length, snippets };
}

export function countUnprocessedWebOfferings(state: OlleWorldState): number {
  return (state.webOfferings ?? []).filter((o) => !o.processed_at).length;
}

export function recentWebOfferings(state: OlleWorldState, limit = 12): WebOffering[] {
  return [...(state.webOfferings ?? [])].slice(-limit).reverse();
}
