import { describe, expect, it } from "vitest";
import { validateAct, applyAct } from "../world/runtime.js";
import { tickHunger, HUNGER_RISE_PER_TICK } from "./hunger.js";
import { buyFromSupply, grantItem, ensureSurvivalState } from "./inventory.js";
import type { OlleWorldState } from "../world/store.js";
import { createEmailAdapter } from "../email/adapter.js";

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
    tickCount: 4,
    hobbies: [],
    survival: { hunger: 0.5 },
    purse: { coins: 5, lifetime_earned: 5 },
    inventory: [],
  };
}

describe("hunger decay", () => {
  it("rises deterministically each tick", () => {
    const s = base();
    const h0 = s.survival.hunger;
    tickHunger(s, 1);
    expect(s.survival.hunger).toBeCloseTo(h0 + HUNGER_RISE_PER_TICK, 5);
  });
});

describe("eat validation", () => {
  it("rejects missing food", () => {
    const s = base();
    const v = validateAct(s, {
      action_id: "eat",
      params: { item_id: "nope" },
      because: "test",
    });
    expect(v.ok).toBe(false);
  });

  it("eats and lowers hunger", async () => {
    const s = base();
    const food = grantItem(s, "test apple", { hunger_delta: -0.3 });
    s.survival.hunger = 0.7;
    const decision = {
      action_id: "eat" as const,
      params: { item_id: food.id },
      because: "hungry",
    };
    const v = validateAct(s, decision);
    expect(v.ok).toBe(true);
    await applyAct(s, decision, v, createEmailAdapter());
    expect(s.survival.hunger).toBeLessThan(0.7);
  });
});

describe("buy_from_supply", () => {
  it("spends coins and adds food", () => {
    const s = base();
    ensureSurvivalState(s);
    const coinsBefore = s.purse.coins;
    const r = buyFromSupply(s, "apple");
    expect(r.ok).toBe(true);
    expect(s.purse.coins).toBe(coinsBefore - 3);
    expect(s.inventory.some((i) => i.label === "Apple")).toBe(true);
  });
});
