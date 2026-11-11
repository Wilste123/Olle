import { describe, expect, it } from "vitest";
import {
  decayHobbyHeat,
  bumpHobby,
  ensureHobbies,
  PRIVATE_DIARY_MIN_TICK_GAP,
  recordPrivateDiaryTick,
  ticksSinceLastPrivateDiary,
} from "./engine.js";
import type { OlleWorldState } from "../world/store.js";

function base(): OlleWorldState {
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
    tickCount: 10,
    hobbies: [],
    survival: { hunger: 0.3 },
    purse: { coins: 3, lifetime_earned: 3 },
    inventory: [],
  };
}

describe("hobby heat", () => {
  it("decays heat each tick batch", () => {
    const s = base();
    ensureHobbies(s);
    const id = s.hobbies[0]!.id;
    bumpHobby(s, id, 0.5);
    const before = s.hobbies.find((h) => h.id === id)!.heat;
    decayHobbyHeat(s, 1);
    const after = s.hobbies.find((h) => h.id === id)!.heat;
    expect(after).toBeLessThan(before);
  });
});

describe("diary gap", () => {
  it("tracks ticks since private diary", () => {
    const s = base();
    expect(ticksSinceLastPrivateDiary(s)).toBeGreaterThan(PRIVATE_DIARY_MIN_TICK_GAP - 1);
    recordPrivateDiaryTick(s);
    expect(ticksSinceLastPrivateDiary(s)).toBe(0);
  });
});
