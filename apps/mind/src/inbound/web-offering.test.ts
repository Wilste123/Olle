import { describe, expect, it } from "vitest";
import { enqueueWebOffering, processWebOfferingsForTick } from "./web-offering.js";
import { emptyWorldState } from "../test/world-fixture.js";

describe("web offerings", () => {
  it("enqueues and remembers on tick", () => {
    const state = emptyWorldState();
    enqueueWebOffering(state, { text: "A warm loaf for you", gift_label: "bread" });
    expect(state.webOfferings).toHaveLength(1);
    const { newCount } = processWebOfferingsForTick(state);
    expect(newCount).toBe(1);
    expect(state.memories.some((m) => m.source === "web_offering")).toBe(true);
    expect(state.webOfferings![0].processed_at).toBeDefined();
  });
});
