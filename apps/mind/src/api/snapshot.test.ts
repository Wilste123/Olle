import { describe, expect, it } from "vitest";
import { buildDiarySnapshot, buildNowSnapshot, privateDiaryTailNewestFirst } from "./snapshot.js";
import { emptyWorldState } from "../test/world-fixture.js";

describe("privateDiary in snapshots", () => {
  it("includes newest-first tail on /now", () => {
    const state = emptyWorldState({
      privateDiary: ["first", "second", "third"],
    });
    const now = buildNowSnapshot(state);
    expect(now.privateDiaryTail).toEqual(["third", "second", "first"]);
  });

  it("buildDiarySnapshot exposes private and shared", () => {
    const state = emptyWorldState({
      privateDiary: ["a", "b"],
      sharedDiaryQueue: [
        {
          id: "s1",
          title: "T",
          body: "body",
          status: "pending",
          created_at: new Date().toISOString(),
        },
      ],
    });
    const d = buildDiarySnapshot(state);
    expect(d.private).toEqual(["b", "a"]);
    expect(d.shared).toHaveLength(1);
  });

  it("exposes llmProvider on /now", () => {
    const now = buildNowSnapshot(emptyWorldState());
    expect(["heuristic", "openai", "anthropic"]).toContain(now.llmProvider);
    if (now.llmProvider === "heuristic") {
      expect(now.llmProviderHint).toMatch(/OPENAI_API_KEY/);
    }
  });

  it("caps at 50 entries", () => {
    const state = emptyWorldState({
      privateDiary: Array.from({ length: 60 }, (_, i) => `line-${i}`),
    });
    const tail = privateDiaryTailNewestFirst(state);
    expect(tail).toHaveLength(50);
    expect(tail[0]).toBe("line-59");
  });
});
