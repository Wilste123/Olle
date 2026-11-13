import { describe, expect, it } from "vitest";
import { applyAct, finalizeAct, validateAct } from "./runtime.js";
import { createEmailAdapter } from "../email/adapter.js";
import { cozyDefaultExhibitions } from "./exhibitions.js";
import { emptyWorldState } from "../test/world-fixture.js";
import { normalizeFeelings } from "../feelings/normalize.js";

describe("visit_exhibition", () => {
  it("bumps hobby from title and records last visit", async () => {
    const ex = cozyDefaultExhibitions()[0];
    const state = emptyWorldState({
      exhibitions: cozyDefaultExhibitions(),
      feelings: normalizeFeelings({ needs: { wonder: 0.8, curiosity: 0.7 } as never }),
    });
    const decision = {
      action_id: "visit_exhibition" as const,
      params: { exhibition_id: ex.id },
      because: "Test visit",
    };
    const v = validateAct(state, decision);
    expect(v.ok).toBe(true);
    const act = await applyAct(state, decision, v, createEmailAdapter());
    expect(act.pendingSpeakKind).toBe("private_diary");
    expect(state.lastVisitedExhibitionId).toBe(ex.id);
    expect(state.lastActivity).toContain(ex.title);
    expect(state.hobbies.some((h) => h.label === ex.title)).toBe(true);
    expect(state.placement).toMatchObject({ status: "placed", place_id: ex.place_id });
    await finalizeAct(state, decision, act, "Stille lyssetting.", createEmailAdapter());
    expect(state.privateDiary.at(-1)).toContain("Stille");
  });

  it("rejects inactive exhibition", () => {
    const ex = { ...cozyDefaultExhibitions()[0], active: false };
    const state = emptyWorldState({ exhibitions: [ex] });
    const v = validateAct(state, {
      action_id: "visit_exhibition",
      params: { exhibition_id: ex.id },
      because: "nope",
    });
    expect(v.ok).toBe(false);
  });
});
