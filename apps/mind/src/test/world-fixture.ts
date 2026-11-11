import type { OlleWorldState } from "../world/store.js";

export function emptyWorldState(over: Partial<OlleWorldState> = {}): OlleWorldState {
  return {
    version: 2,
    placement: { status: "unplaced" },
    olleDay: 0,
    feelings: {
      mood: 0,
      energy: 0.8,
      needs: { rest: 0.2, curiosity: 0.3, social: 0.3, expression: 0.3, quiet: 0.2 },
      asleep: false,
    },
    privateDiary: [],
    sharedDiaryQueue: [],
    feed: [],
    permissions: [],
    outbox: [],
    audit: [],
    inboundQueue: [],
    memories: [],
    emailSends: [],
    conversation: [],
    lastActivity: "idle",
    tickCount: 0,
    hobbies: [],
    survival: { hunger: 0.35 },
    purse: { coins: 3, lifetime_earned: 3 },
    inventory: [],
    ...over,
  };
}
