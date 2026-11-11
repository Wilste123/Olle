import { describe, expect, it } from "vitest";
import type { SenseSnapshot } from "@olle/protocol";
import { OpenAiProvider, type OpenAiClient } from "./openai-provider.js";
import type { DecideContext } from "./types.js";

const baseSense: SenseSnapshot = {
  at: new Date().toISOString(),
  olleDay: 1,
  placement: { status: "unplaced" },
  feelings: {
    mood: 0.2,
    energy: 0.8,
    needs: { rest: 0.2, curiosity: 0.5, social: 0.4, expression: 0.3, quiet: 0.2 },
    asleep: false,
  },
  threads: ["William"],
  emailBudgetRemaining: 2,
  openPermissionCount: 0,
  recentFeedTail: [],
  inboundSinceLastTick: 0,
};

function mockClient(decideJson: string, speakText?: string): OpenAiClient {
  return {
    chat: {
      completions: {
        create: async (params: { response_format?: { type: string }; model: string }) => {
          const isDecide =
            params.response_format?.type === "json_schema" ||
            params.response_format?.type === "json_object";
          return {
            id: "chatcmpl_test",
            object: "chat.completion",
            created: 0,
            model: params.model,
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: isDecide
                    ? decideJson
                    : (speakText ?? "Hey — quiet moment, thinking of you."),
                },
                finish_reason: isDecide ? "stop" : "stop",
              },
            ],
            usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
          };
        },
      },
    },
  } as unknown as OpenAiClient;
}

describe("OpenAiProvider", () => {
  const ctx: DecideContext = {
    sense: baseSense,
    legalActionIds: ["think_about", "continue_activity"],
    memorySnippets: ["remembered rain"],
  };

  it("decide parses structured JSON and validates manifest", async () => {
    const provider = new OpenAiProvider({
      client: mockClient(
        JSON.stringify({
          action_id: "think_about",
          params: { topic: "rain" },
          because: "Memory snippet salient.",
        }),
      ),
    });
    const result = await provider.decide(ctx);
    expect(result.output.action_id).toBe("think_about");
    expect(result.usage?.input_tokens).toBe(120);
    expect(result.usage?.step).toBe("decide");
  });

  it("speak returns trimmed text", async () => {
    const provider = new OpenAiProvider({
      client: mockClient("", "Diary line for William."),
    });
    const result = await provider.speak({
      lockedDecision: {
        action_id: "append_private_diary",
        params: { line: "test" },
        because: "expression",
      },
      feelings: baseSense.feelings,
      memorySnippets: [],
      worldOk: true,
    });
    expect(result.text).toBe("Diary line for William.");
    expect(result.usage?.step).toBe("speak");
  });
});
