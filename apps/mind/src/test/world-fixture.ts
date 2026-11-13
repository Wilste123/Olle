import type { OlleWorldState } from "../world/store.js";
import { cozyDefaultExhibitions } from "../world/exhibitions.js";
import { normalizeFeelings } from "../feelings/normalize.js";

export function emptyWorldState(over: Partial<OlleWorldState> = {}): OlleWorldState {
  return {
    version: 5,
    opinions: [],
    placement: { status: "placed", place_id: "home_nook", since: new Date().toISOString() },
    olleDay: 0,
    feelings: normalizeFeelings({ mood: 0, energy: 0.8 }),
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
    exhibitions: cozyDefaultExhibitions(),
    webOfferings: [],
    ...over,
  };
}
