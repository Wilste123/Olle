import { describe, expect, it } from "vitest";
import { applyAct, validateAct } from "./runtime.js";
import { createEmailAdapter } from "../email/adapter.js";
import { emptyWorldState } from "../test/world-fixture.js";
import { normalizeFeelings } from "../feelings/normalize.js";

const base = () =>
  emptyWorldState({
    tickCount: 1,
    feelings: normalizeFeelings({ needs: { expression: 0.8 } as never }),
    hobbies: [{ id: "h1", label: "trains", heat: 0.5, last_touched: "", notes: [] }],
    survival: { hunger: 0.2 },
  });

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
