import { describe, expect, it } from "vitest";
import { validateAct, applyAct } from "../world/runtime.js";
import { tickHunger, HUNGER_RISE_PER_TICK } from "./hunger.js";
import { buyFromSupply, grantItem, ensureSurvivalState } from "./inventory.js";
import { createEmailAdapter } from "../email/adapter.js";
import { emptyWorldState } from "../test/world-fixture.js";

function base() {
  return emptyWorldState({
    tickCount: 4,
    survival: { hunger: 0.5 },
    purse: { coins: 5, lifetime_earned: 5 },
  });
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
