import { describe, expect, it } from "vitest";
import {
  appendOlleReply,
  appendWilliamMessage,
  countUnreadFromWilliam,
  markWilliamMessagesRead,
} from "./messages.js";
import { emptyWorldState } from "../test/world-fixture.js";

describe("conversation messages", () => {
  it("queues william text and marks read after olle reply flow", () => {
    const state = emptyWorldState();
    appendWilliamMessage(state, "hei olle", "cli");
    expect(countUnreadFromWilliam(state)).toBe(1);
    appendOlleReply(state, "Hei William!", "wm-x");
    markWilliamMessagesRead(state);
    expect(countUnreadFromWilliam(state)).toBe(0);
    expect(state.conversation?.length).toBe(2);
  });
});
