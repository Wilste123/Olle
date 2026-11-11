import { describe, expect, it } from "vitest";
import type { OlleWorldState } from "../world/store.js";
import {
  appendOlleReply,
  appendWilliamMessage,
  countUnreadFromWilliam,
  markWilliamMessagesRead,
} from "./messages.js";

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
    conversation: [],
    lastActivity: "idle",
    tickCount: 0,
  };
}

describe("conversation messages", () => {
  it("queues william text and marks read after olle reply flow", () => {
    const state = emptyState();
    appendWilliamMessage(state, "hei olle", "cli");
    expect(countUnreadFromWilliam(state)).toBe(1);
    appendOlleReply(state, "Hei William!", "wm-x");
    markWilliamMessagesRead(state);
    expect(countUnreadFromWilliam(state)).toBe(0);
    expect(state.conversation?.length).toBe(2);
  });
});
