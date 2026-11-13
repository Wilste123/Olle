import { describe, expect, it } from "vitest";
import { PRIVATE_DIARY_MIN_TICK_GAP } from "../hobbies/engine.js";
import { emptyWorldState } from "../test/world-fixture.js";
import { applyAct, finalizeAct, validateAct } from "./runtime.js";
import { createEmailAdapter } from "../email/adapter.js";
import { dedupeConsecutiveDiaryLines } from "./store.js";
import { HeuristicProvider } from "../llm/heuristic-provider.js";
import { normalizeFeelings } from "../feelings/normalize.js";

describe("append_private_diary tick gap", () => {
  it("rejects when within PRIVATE_DIARY_MIN_TICK_GAP", () => {
    const state = emptyWorldState({
      tickCount: 10,
      lastPrivateDiaryTick: 10,
    });
    const decision = {
      action_id: "append_private_diary" as const,
      params: { line: "test" },
      because: "diary",
    };
    const v = validateAct(state, decision);
    expect(v.ok).toBe(false);
    expect(v.rejectReason).toContain(String(PRIVATE_DIARY_MIN_TICK_GAP));
  });
});

describe("play_solo does not append private diary", () => {
  it("activity_voice finalize writes feed only", async () => {
    const state = emptyWorldState({
      tickCount: 1,
      feelings: normalizeFeelings({ needs: { expression: 0.8 } as never }),
      hobbies: [{ id: "h1", label: "trains", heat: 0.5, last_touched: "", notes: [] }],
    });
    const decision = {
      action_id: "play_solo" as const,
      params: { mood: "silly" },
      because: "play",
    };
    const v = validateAct(state, decision);
    const act = await applyAct(state, decision, v, createEmailAdapter());
    expect(act.pendingSpeakKind).toBe("activity_voice");

    const spoke = await new HeuristicProvider().speak({
      lockedDecision: decision,
      feelings: state.feelings,
      memorySnippets: [],
      worldOk: true,
    });
    await finalizeAct(state, decision, act, spoke.text, createEmailAdapter());
    expect(state.privateDiary).toHaveLength(0);
    expect(state.feed.some((f) => f.change === "activity")).toBe(true);
  });
});

describe("dedupeConsecutiveDiaryLines", () => {
  it("collapses runs of identical lines", () => {
    expect(
      dedupeConsecutiveDiaryLines([
        "a",
        "a",
        "b",
        "b",
        "b",
        "c",
      ]),
    ).toEqual(["a", "b", "c"]);
  });
});
