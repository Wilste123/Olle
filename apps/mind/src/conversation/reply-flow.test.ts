import { describe, expect, it } from "vitest";
import { MockEmailAdapter } from "../email/adapter.js";
import { heuristicDecide } from "../decide/heuristic.js";
import type { SenseSnapshot } from "@olle/protocol";
import { emptyWorldState } from "../test/world-fixture.js";
import { appendWilliamMessage } from "./messages.js";
import { HeuristicProvider } from "../llm/heuristic-provider.js";
import { applyAct, finalizeAct, validateAct } from "../world/runtime.js";
import type { OlleWorldState } from "../world/store.js";

function emptyState(): OlleWorldState {
  return emptyWorldState();
}

function senseFor(state: OlleWorldState): SenseSnapshot {
  return {
    at: new Date().toISOString(),
    olleDay: 0,
    placement: state.placement,
    feelings: state.feelings,
    threads: ["William"],
    hobbies: [],
    ticksSinceLastPrivateDiary: 99,
    emailBudgetRemaining: 2,
    openPermissionCount: 0,
    recentFeedTail: [],
    inboundSinceLastTick: 1,
    unreadFromWilliam: 1,
    williamMessagePreview: "hei",
    survival: state.survival,
    purse: state.purse,
    inventory: state.inventory,
    inventorySummary: "(empty)",
    webFetchesRemaining: 12,
    topOpinions: [],
    activeExhibitions: [],
    webOfferingsSinceLastTick: 0,
  };
}

describe("reply_to_william flow", () => {
  it("heuristic picks reply and finalize appends olle message", async () => {
    const state = emptyState();
    appendWilliamMessage(state, "hei olle", "cli");
    const decision = heuristicDecide(senseFor(state));
    expect(decision.action_id).toBe("reply_to_william");

    const validation = validateAct(state, decision);
    expect(validation.ok).toBe(true);
    const email = new MockEmailAdapter();
    const act = await applyAct(state, decision, validation, email);
    expect(act.pendingSpeakKind).toBe("reply_to_william");

    const spoke = await new HeuristicProvider().speak({
      lockedDecision: decision,
      feelings: state.feelings,
      memorySnippets: [],
      worldOk: true,
      williamMessageText: "hei olle",
    });
    expect(spoke.text).not.toMatch(/William wrote/i);
    await finalizeAct(state, decision, act, spoke.text, email);
    const olleMsg = state.conversation?.find((m) => m.from === "olle");
    expect(olleMsg?.text).toBe(spoke.text);
    expect(state.conversation?.every((m) => m.from !== "william" || m.read_by_olle)).toBe(true);
  });
});
