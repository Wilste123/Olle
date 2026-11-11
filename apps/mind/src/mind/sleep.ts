import type { OlleWorldState } from "../world/store.js";
import { appendPinoFeed } from "../world/store.js";

/** Batch consolidate while asleep — no decide/speak LLM (Pino sleep job stub). */
export function runSleepConsolidation(state: OlleWorldState): void {
  if (!state.feelings.asleep) return;
  const trimmed = state.privateDiary.slice(-24);
  if (trimmed.length < state.privateDiary.length) {
    state.privateDiary = trimmed;
  }
  appendPinoFeed(state, "felt", "Sleep consolidation batch (no LLM)", {
    ok: true,
    change: "memory_trim",
  });
}
