import { describe, expect, it } from "vitest";
import { applyAct, validateAct } from "./runtime.js";
import { createEmailAdapter } from "../email/adapter.js";
import type { OlleWorldState } from "./store.js";

const base = (): OlleWorldState =>
  ({
    version: 2,
    placement: { status: "unplaced" },
    olleDay: 0,
    feelings: {
      mood: 0,
      energy: 0.8,
      needs: { rest: 0.2, curiosity: 0.3, social: 0.3, expression: 0.8, quiet: 0.2 },
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
    tickCount: 1,
    hobbies: [{ id: "h1", label: "trains", heat: 0.5, last_touched: "", notes: [] }],
    survival: { hunger: 0.2 },
    purse: { coins: 3, lifetime_earned: 3 },
    inventory: [],
  }) as OlleWorldState;

describe("play_solo", () => {
  it("lowers expression need", async () => {
    const s = base();
    const d = { action_id: "play_solo" as const, params: { mood: "silly" }, because: "play" };
    const v = validateAct(s, d);
    const r = await applyAct(s, d, v, createEmailAdapter());
    expect(r.pendingSpeakKind).toBe("private_diary");
    expect(s.feelings.needs.expression).toBeLessThan(0.8);
  });
});
