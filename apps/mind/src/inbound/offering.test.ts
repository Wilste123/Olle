import { describe, expect, it } from "vitest";
import {
  enqueueInboundOffering,
  processInboundForTick,
  stripInboundReplyBody,
} from "./offering.js";
import { emptyWorldState } from "../test/world-fixture.js";

describe("stripInboundReplyBody", () => {
  it("drops quoted lines and On-wrote", () => {
    const text = `Hello Olle

On Tue William wrote:
> old stuff`;
    expect(stripInboundReplyBody(text)).toBe("Hello Olle");
  });
});

describe("inbound offerings", () => {
  it("enqueues and remembers on tick", () => {
    const state = emptyWorldState();
    enqueueInboundOffering(state, {
      from: "w@example.com",
      subject: "Trip idea",
      text: "Thinking about hiking next week.",
    });
    expect(state.inboundQueue).toHaveLength(1);
    const { newCount, snippets } = processInboundForTick(state);
    expect(newCount).toBe(1);
    expect(snippets[0]).toContain("Trip idea");
    expect(state.memories.length).toBe(1);
    expect(state.inboundQueue[0].processed_at).toBeDefined();
  });
});
