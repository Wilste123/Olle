import { describe, expect, it } from "vitest";
import type { OlleWorldState } from "../world/store.js";
import {
  enqueueInboundOffering,
  processInboundForTick,
  stripInboundReplyBody,
} from "./offering.js";

function emptyState(): OlleWorldState {
  return {
    version: 1,
    placement: { status: "unplaced" },
    olleDay: 0,
    feelings: {
      mood: 0,
      energy: 0.8,
      needs: { rest: 0.2, curiosity: 0.3, social: 0.3, expression: 0.3, quiet: 0.2 },
      asleep: false,
    },
    privateDiary: [],
    sharedDiaryQueue: [],
    feed: [],
    permissions: [],
    outbox: [],
    audit: [],
    inboundQueue: [],
    memories: [],
    emailSends: [],
    lastActivity: "idle",
    tickCount: 0,
  };
}

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
    const state = emptyState();
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
