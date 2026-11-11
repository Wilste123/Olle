import { describe, expect, it } from "vitest";
import {
  decayHobbyHeat,
  bumpHobby,
  ensureHobbies,
  PRIVATE_DIARY_MIN_TICK_GAP,
  recordPrivateDiaryTick,
  ticksSinceLastPrivateDiary,
} from "./engine.js";
import { emptyWorldState } from "../test/world-fixture.js";

function base() {
  return emptyWorldState({ tickCount: 10 });
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
