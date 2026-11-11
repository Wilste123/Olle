import { describe, expect, it } from "vitest";
import { isSalientForDecide } from "./salience.js";
import type { SenseSnapshot } from "@olle/protocol";

function sense(needsOver: Partial<SenseSnapshot["feelings"]["needs"]> = {}): SenseSnapshot {
  return {
    at: "",
    olleDay: 0,
    placement: { status: "unplaced" },
    feelings: {
      mood: 0,
      energy: 0.8,
      needs: { rest: 0.2, curiosity: 0.3, social: 0.3, expression: 0.3, quiet: 0.2, ...needsOver },
      asleep: false,
    },
    threads: [],
    emailBudgetRemaining: 2,
    openPermissionCount: 0,
    recentFeedTail: [],
    inboundSinceLastTick: 0,
  };
}

describe("isSalientForDecide", () => {
  it("skips when continuing same activity", () => {
    expect(isSalientForDecide(sense(), "continuing", 5, "continue_activity")).toBe(false);
  });

  it("fires on high social need", () => {
    const s = sense();
    s.feelings.needs.social = 0.75;
    expect(isSalientForDecide(s, "continuing", 5)).toBe(true);
  });
});
