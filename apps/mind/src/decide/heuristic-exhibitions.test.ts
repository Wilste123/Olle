import { describe, expect, it, vi } from "vitest";
import { heuristicDecide } from "./heuristic.js";
import { baseSense } from "../test/sense-fixture.js";
import { normalizeFeelings } from "../feelings/normalize.js";

describe("heuristic exhibitions", () => {
  it("can pick visit_exhibition when wonder is high", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const sense = baseSense({
      feelings: normalizeFeelings({
        needs: { wonder: 0.7, curiosity: 0.4, rest: 0.2, social: 0.2, expression: 0.2 } as never,
        energy: 0.8,
      }),
      activeExhibitions: [{ id: "ex-1", title: "Test hall" }],
      survival: { hunger: 0.2 },
    });
    const d = heuristicDecide(sense);
    expect(d.action_id).toBe("visit_exhibition");
    expect(d.params.exhibition_id).toBe("ex-1");
    vi.restoreAllMocks();
  });
});
