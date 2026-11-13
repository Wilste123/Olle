import { describe, expect, it } from "vitest";
import { emptyWorldState } from "../test/world-fixture.js";
import { opinionLinesForMemory, topOpinionsByConfidence, upsertOpinion } from "./opinions.js";
import type { SenseSnapshot } from "@olle/protocol";

function buildSenseSlice(state: ReturnType<typeof emptyWorldState>): Pick<SenseSnapshot, "topOpinions"> {
  return {
    topOpinions: topOpinionsByConfidence(state, 5).map((o) => ({
      topic: o.topic,
      stance: o.stance,
      confidence: o.confidence,
    })),
  };
}

describe("sense opinions", () => {
  it("includes top opinions by confidence", () => {
    const state = emptyWorldState();
    upsertOpinion(state, {
      topic: "a",
      stance: "lav",
      confidence: 0.3,
      because: "t",
      sources: [],
      at: new Date().toISOString(),
    });
    upsertOpinion(state, {
      topic: "b",
      stance: "høy",
      confidence: 0.9,
      because: "t",
      sources: [],
      at: new Date().toISOString(),
    });
    const sense = buildSenseSlice(state);
    expect(sense.topOpinions[0]!.topic).toBe("b");
    expect(opinionLinesForMemory(state, 2)).toHaveLength(2);
  });
});
