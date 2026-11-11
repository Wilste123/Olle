import { describe, expect, it } from "vitest";
import { initFeelings, tickFeelings } from "./simulator.js";

describe("feelings simulator", () => {
  it("setbacks move mood more than wins", () => {
    const base = initFeelings();
    const win = tickFeelings(base, { events: [1], deltaSec: 1, wasResting: false });
    const loss = tickFeelings(base, { events: [-1], deltaSec: 1, wasResting: false });
    expect(Math.abs(loss.mood - base.mood)).toBeGreaterThan(Math.abs(win.mood - base.mood));
  });

  it("resting recovers energy", () => {
    const tired = { ...initFeelings(), energy: 0.3 };
    const after = tickFeelings(tired, { events: [], deltaSec: 60, wasResting: true });
    expect(after.energy).toBeGreaterThan(tired.energy);
  });
});
