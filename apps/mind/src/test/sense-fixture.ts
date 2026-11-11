import type { SenseSnapshot } from "@olle/protocol";

export function baseSense(over: Partial<SenseSnapshot> = {}): SenseSnapshot {
  return {
    at: new Date().toISOString(),
    olleDay: 0,
    placement: { status: "unplaced" },
    feelings: {
      mood: 0,
      energy: 0.8,
      needs: { rest: 0.2, curiosity: 0.3, social: 0.3, expression: 0.3, quiet: 0.2 },
      asleep: false,
    },
    threads: ["William"],
    hobbies: [],
    ticksSinceLastPrivateDiary: 99,
    emailBudgetRemaining: 2,
    openPermissionCount: 0,
    recentFeedTail: [],
    inboundSinceLastTick: 0,
    unreadFromWilliam: 0,
    survival: { hunger: 0.35 },
    purse: { coins: 3, lifetime_earned: 3 },
    inventory: [],
    inventorySummary: "(empty)",
    webFetchesRemaining: 12,
    ...over,
  };
}
