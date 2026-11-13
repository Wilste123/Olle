import Anthropic from "@anthropic-ai/sdk";
import { ACTION_MANIFEST } from "@olle/protocol";
import { validateDecideOutput } from "../decide/schema.js";
import { HeuristicProvider } from "./heuristic-provider.js";
import { parseDecideJson, parseSpeakText } from "./parse.js";
import type {
  DecideContext,
  DecideResult,
  LlmProvider,
  LlmUsage,
  SpeakContext,
  SpeakResult,
} from "./types.js";

const OLLE_VOICE =
  "You are Olle, William's private autonomous companion. Warm, concise, pet-friend tone — not clinical. Never claim to be human.";

const DECIDE_TOOL = {
  name: "pick_action",
  description: "Choose exactly one legal action for this mind tick.",
  input_schema: {
    type: "object" as const,
    properties: {
      action_id: { type: "string", description: "Must be one of legal_action_ids" },
      params: { type: "object", description: "Parameters for the action" },
      because: { type: "string", description: "Short internal reason" },
    },
    required: ["action_id", "params", "because"],
  },
};

export type AnthropicClient = Pick<Anthropic, "messages">;

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  private readonly decideModel: string;
  private readonly speakModel: string;
  private readonly client: AnthropicClient;

  constructor(options?: {
    apiKey?: string;
    decideModel?: string;
    speakModel?: string;
    client?: AnthropicClient;
  }) {
    const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!options?.client && !apiKey) {
      throw new Error("ANTHROPIC_API_KEY required for AnthropicProvider");
    }
    this.client = options?.client ?? new Anthropic({ apiKey: apiKey! });
    this.decideModel = options?.decideModel ?? process.env.OLLE_DECIDE_MODEL ?? "claude-haiku-4-5-20251001";
    this.speakModel = options?.speakModel ?? process.env.OLLE_SPEAK_MODEL ?? "claude-sonnet-4-5-20250929";
  }

  async decide(ctx: DecideContext): Promise<DecideResult> {
    const manifestSlice = ACTION_MANIFEST.filter((a) => ctx.legalActionIds.includes(a.id)).map(
      (a) => ({
        id: a.id,
        class: a.class,
        description: a.description,
        paramsSchema: a.paramsSchema,
      }),
    );

    const userPayload = {
      feelings: ctx.sense.feelings,
      placement: ctx.sense.placement,
      olle_day: ctx.sense.olleDay,
      threads: ctx.sense.threads,
      legal_action_ids: ctx.legalActionIds,
      action_manifest: manifestSlice,
      memory_snippets: ctx.memorySnippets,
      recent_feed: ctx.sense.recentFeedTail,
      email_budget_remaining: ctx.sense.emailBudgetRemaining,
      open_permissions: ctx.sense.openPermissionCount,
      top_opinions: ctx.sense.topOpinions,
    };

    try {
      const message = await this.client.messages.create({
        model: this.decideModel,
        max_tokens: 512,
        system: `${OLLE_VOICE}\n\nYou are the DECIDE step only. Pick one legal action. Params must match the manifest schema. No map or Class D actions.`,
        messages: [
          {
            role: "user",
            content: `Decide the next action. Respond by calling pick_action.\n\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
        tools: [DECIDE_TOOL],
        tool_choice: { type: "tool", name: "pick_action" },
      });

      const usage = usageFromMessage(message, "decide", this.decideModel);
      const tool = message.content.find((b) => b.type === "tool_use");
      if (tool && tool.type === "tool_use") {
        const validated = validateDecideOutput(tool.input);
        if (validated && ctx.legalActionIds.includes(validated.action_id)) {
          return { output: validated, usage };
        }
      }

      const textBlock = message.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        const parsed = parseDecideJson(textBlock.text);
        if (parsed && ctx.legalActionIds.includes(parsed.action_id)) {
          return { output: parsed, usage };
        }
      }
    } catch {
      // fallback below
    }

    const fallback = await new HeuristicProvider().decide(ctx);
    return { ...fallback, fellBack: true };
  }

  async speak(ctx: SpeakContext): Promise<SpeakResult> {
    const userPayload = {
      locked_action_id: ctx.lockedDecision.action_id,
      locked_params: ctx.lockedDecision.params,
      because: ctx.lockedDecision.because,
      world_ok: ctx.worldOk,
      world_reject_reason: ctx.worldRejectReason,
      feelings: ctx.feelings,
      memory_snippets: ctx.memorySnippets,
      placement: ctx.placement,
      william_message: ctx.williamMessageText,
      research_url: ctx.researchUrl,
      research_excerpt_for_summary_only: ctx.researchExcerpt?.slice(0, 2000),
    };

    try {
      const message = await this.client.messages.create({
        model: this.speakModel,
        max_tokens: 320,
        system: `${OLLE_VOICE}\n\nYou are the SPEAK step only. The action is LOCKED — do not choose or suggest any action. Generate the short outward line (diary, chat reply, or email body). For reply_to_william, answer william_message in natural Norwegian (bokmål): warm, direct — do NOT quote their message or say "William wrote". For research_topic, summarize research_excerpt_for_summary_only briefly in the private diary voice. If world_ok is false, briefly acknowledge the rejection. No JSON. Max ~3 sentences unless summarizing research.`,
        messages: [
          {
            role: "user",
            content: `Speak after this action:\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
      });

      const usage = usageFromMessage(message, "speak", this.speakModel);
      const text = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n");
      if (text.trim()) {
        return { text: parseSpeakText(text), usage };
      }
    } catch {
      // fallback
    }

    const fallback = await new HeuristicProvider().speak(ctx);
    return { ...fallback, fellBack: true };
  }
}

function usageFromMessage(
  message: { usage: { input_tokens: number; output_tokens: number } },
  step: "decide" | "speak",
  model: string,
): LlmUsage {
  return {
    step,
    model,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
  };
}
