import { describe, expect, it } from "vitest";
import { AnthropicProvider, type AnthropicClient } from "./anthropic-provider.js";
import type { DecideContext } from "./types.js";
import type { SenseSnapshot } from "@olle/protocol";

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
  unreadFromWilliam: 0,
};

function mockClient(toolInput: Record<string, unknown>, speakText?: string): AnthropicClient {
  return {
    messages: {
      create: async (params: { model: string; tools?: unknown[] }) => {
        if (params.tools?.length) {
          return {
            id: "msg_1",
            type: "message",
            role: "assistant",
            model: params.model,
            content: [
              {
                type: "tool_use",
                id: "tu_1",
                name: "pick_action",
                input: toolInput,
              },
            ],
            stop_reason: "tool_use",
            stop_sequence: null,
            usage: { input_tokens: 120, output_tokens: 40 },
          };
        }
        return {
          id: "msg_2",
          type: "message",
          role: "assistant",
          model: params.model,
          content: [{ type: "text", text: speakText ?? "Hey — quiet moment, thinking of you." }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 80, output_tokens: 22 },
        };
      },
    },
  } as unknown as AnthropicClient;
}

describe("AnthropicProvider", () => {
  const ctx: DecideContext = {
    sense: baseSense,
    legalActionIds: ["think_about", "continue_activity"],
    memorySnippets: ["remembered rain"],
  };

  it("decide uses tool_use and validates manifest", async () => {
    const provider = new AnthropicProvider({
      client: mockClient({
        action_id: "think_about",
        params: { topic: "rain" },
        because: "Memory snippet salient.",
      }),
    });
    const result = await provider.decide(ctx);
    expect(result.output.action_id).toBe("think_about");
    expect(result.usage?.input_tokens).toBe(120);
  });

  it("speak returns trimmed text", async () => {
    const provider = new AnthropicProvider({
      client: mockClient({}, "Diary line for William."),
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
