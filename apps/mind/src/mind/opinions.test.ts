import { describe, expect, it } from "vitest";
import { emptyWorldState } from "../test/world-fixture.js";
import {
  ingestImpression,
  ingestImpressionFromAction,
  opinionLinesForMemory,
  topOpinionsByConfidence,
  upsertOpinion,
} from "./opinions.js";
import { migrateState } from "../world/store.js";

describe("opinions", () => {
  it("upserts by topic slug and raises confidence", () => {
    const state = emptyWorldState();
    upsertOpinion(state, {
      topic: "Norsk vær",
      stance: "Været er uforutsigbart.",
      confidence: 0.4,
      because: "test",
      sources: [],
      at: new Date().toISOString(),
    });
    upsertOpinion(state, {
      topic: "norsk-vær",
      stance: "Jeg er sikker på at vinteren kommer.",
      confidence: 0.5,
      because: "test2",
      sources: ["diary"],
      at: new Date().toISOString(),
    });
    expect(state.opinions).toHaveLength(1);
    expect(state.opinions[0]!.confidence).toBeGreaterThan(0.5);
    expect(state.opinions[0]!.sources).toContain("diary");
  });

  it("ingests research impression stub", () => {
    const state = emptyWorldState();
    state.lastResearch = {
      url: "https://example.com/article",
      query: "kunstig intelligens",
      excerpt: "AI systems are changing how we work and learn.",
      at: new Date().toISOString(),
    };
    const o = ingestImpressionFromAction(
      state,
      "research_topic",
      { query: "kunstig intelligens" },
      "Kort notat fra lesing.",
    );
    expect(o).not.toBeNull();
    expect(o!.topic).toMatch(/kunstig intelligens/i);
    expect(state.opinions).toHaveLength(1);
  });

  it("exposes opinions in memory lines", () => {
    const state = emptyWorldState();
    ingestImpression(state, {
      topic: "musikk",
      sourceKind: "think",
      diaryLine: "Jazz føles varmt om kvelden.",
    });
    const lines = opinionLinesForMemory(state);
    expect(lines[0]).toMatch(/^Mening \(musikk\):/);
    expect(topOpinionsByConfidence(state, 5)).toHaveLength(1);
  });

  it("migrates v3 state to v5 with empty opinions", () => {
    const migrated = migrateState({
      version: 3,
      placement: { status: "unplaced" },
      olleDay: 1,
      privateDiary: [],
    } as never);
    expect(migrated.version).toBe(5);
    expect(migrated.opinions).toEqual([]);
  });
});
