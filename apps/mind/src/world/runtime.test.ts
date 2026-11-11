import { describe, expect, it } from "vitest";
import { validateAct } from "./runtime.js";
import type { OlleWorldState } from "./store.js";

const base = (): OlleWorldState =>
  JSON.parse(
    JSON.stringify({
      version: 1,
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
      lastActivity: "idle",
      tickCount: 0,
    }),
  ) as OlleWorldState;

describe("validateAct", () => {
  it("rejects Class D", () => {
    const v = validateAct(base(), {
      action_id: "add_map_pin",
      params: { title: "x", lat: 0, lng: 0 },
      because: "nope",
    });
    expect(v.ok).toBe(false);
  });

  it("rejects non-sleep actions while asleep", () => {
    const s = base();
    s.feelings.asleep = true;
    const v = validateAct(s, {
      action_id: "think_about",
      params: { topic: "x" },
      because: "test",
    });
    expect(v.ok).toBe(false);
  });
});
