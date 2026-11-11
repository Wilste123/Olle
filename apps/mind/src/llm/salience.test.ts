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
    hobbies: [],
    ticksSinceLastPrivateDiary: 99,
    emailBudgetRemaining: 2,
    survival: { hunger: 0.2 },
    purse: { coins: 3, lifetime_earned: 3 },
    inventory: [],
    inventorySummary: "(empty)",
    webFetchesRemaining: 12,
    openPermissionCount: 0,
    recentFeedTail: [],
    inboundSinceLastTick: 0,
    unreadFromWilliam: 0,
  };
}

describe("william unread", () => {
  it("is salient when unread messages", () => {
    const s = sense();
    s.unreadFromWilliam = 1;
    expect(isSalientForDecide(s, "idle", 1)).toBe(true);
  });
});

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
