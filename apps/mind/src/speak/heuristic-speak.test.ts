import { describe, expect, it } from "vitest";
import { HeuristicProvider } from "../llm/heuristic-provider.js";
import { normalizeFeelings } from "../feelings/normalize.js";
import { speakAfterDecide } from "./templates.js";

const feelings = normalizeFeelings({ mood: 0.1, energy: 0.8 });

describe("heuristic reply_to_william", () => {
  it("does not echo William wrote or quote the message", async () => {
    const provider = new HeuristicProvider();
    const text = await provider.speak({
      lockedDecision: {
        action_id: "reply_to_william",
        params: {},
        because: "Unread from William: hei",
      },
      feelings,
      memorySnippets: [],
      worldOk: true,
      williamMessageText: "hei",
    });
    expect(text.text).not.toMatch(/William wrote/i);
    expect(text.text).not.toMatch(/Hei William —/);
    expect(text.text).toMatch(/hei|Hyggelig|her/i);
  });

  it("speakAfterDecide uses Norwegian templates", () => {
    const line = speakAfterDecide(
      { action_id: "reply_to_william", params: {}, because: "x" },
      feelings,
      { williamMessageText: "hei" },
    );
    expect(line).not.toContain("William wrote");
    expect(line).toContain("Hyggelig");
  });
});

describe("heuristic activity speak", () => {
  it("play_solo lines are varied prose, not because+mood", () => {
    const line = speakAfterDecide(
      { action_id: "play_solo", params: { mood: "silly" }, because: "play" },
      feelings,
    );
    expect(line).not.toMatch(/\(mood:/);
    expect(line.length).toBeGreaterThan(10);
  });
});
