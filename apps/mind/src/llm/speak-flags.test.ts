import { describe, expect, it } from "vitest";
import { shouldUseLlmSpeak } from "./run.js";
import { HeuristicProvider } from "./heuristic-provider.js";
import { OpenAiProvider } from "./openai-provider.js";

describe("shouldUseLlmSpeak", () => {
  it("forces LLM for reply_to_william on OpenAI", () => {
    const p = { name: "openai" } as OpenAiProvider;
    expect(shouldUseLlmSpeak(p, "reply_to_william")).toBe(true);
  });

  it("skips heuristic provider", () => {
    expect(shouldUseLlmSpeak(new HeuristicProvider(), "reply_to_william")).toBe(false);
  });

  it("forces LLM for research_topic on OpenAI", () => {
    const p = { name: "openai" } as OpenAiProvider;
    expect(shouldUseLlmSpeak(p, "research_topic")).toBe(true);
  });

  it("uses LLM for play_solo on OpenAI", () => {
    const p = { name: "openai" } as OpenAiProvider;
    expect(shouldUseLlmSpeak(p, "play_solo")).toBe(true);
  });
});
