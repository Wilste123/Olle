import OpenAI from "openai";
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

const DECIDE_JSON_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    action_id: { type: "string", description: "Must be one of legal_action_ids" },
    params: { type: "object", additionalProperties: true, description: "Parameters for the action" },
    because: { type: "string", description: "Short internal reason" },
  },
  required: ["action_id", "params", "because"] as string[],
};

export type OpenAiClient = Pick<OpenAI, "chat">;

export class OpenAiProvider implements LlmProvider {
  readonly name = "openai" as const;
  private readonly decideModel: string;
  private readonly speakModel: string;
  private readonly client: OpenAiClient;

  constructor(options?: {
    apiKey?: string;
    decideModel?: string;
    speakModel?: string;
    client?: OpenAiClient;
  }) {
    const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
    if (!options?.client && !apiKey) {
      throw new Error("OPENAI_API_KEY required for OpenAiProvider");
    }
    this.client = options?.client ?? new OpenAI({ apiKey: apiKey! });
    this.decideModel = options?.decideModel ?? process.env.OLLE_DECIDE_MODEL ?? "gpt-4o-mini";
    this.speakModel = options?.speakModel ?? process.env.OLLE_SPEAK_MODEL ?? "gpt-4o-mini";
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
    };

    const system = `${OLLE_VOICE}\n\nYou are the DECIDE step only. Pick one legal action. Params must match the manifest schema. No map or Class D actions.`;
    const user = `Decide the next action. Respond with JSON only.\n\n${JSON.stringify(userPayload, null, 2)}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.decideModel,
        max_tokens: 512,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pick_action",
            strict: true,
            schema: DECIDE_JSON_SCHEMA,
          },
        },
      });

      const usage = usageFromCompletion(completion, "decide", this.decideModel);
      const content = completion.choices[0]?.message?.content;
      if (content) {
        const validated = validateDecideOutput(JSON.parse(content));
        if (validated && ctx.legalActionIds.includes(validated.action_id)) {
          return { output: validated, usage };
        }
        const parsed = parseDecideJson(content);
        if (parsed && ctx.legalActionIds.includes(parsed.action_id)) {
          return { output: parsed, usage };
        }
      }
    } catch {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.decideModel,
          max_tokens: 512,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        });

        const usage = usageFromCompletion(completion, "decide", this.decideModel);
        const content = completion.choices[0]?.message?.content;
        if (content) {
          const parsed = parseDecideJson(content);
          if (parsed && ctx.legalActionIds.includes(parsed.action_id)) {
            return { output: parsed, usage };
          }
        }
      } catch {
        // fallback below
      }
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
    };

    try {
      const completion = await this.client.chat.completions.create({
        model: this.speakModel,
        max_tokens: 320,
        messages: [
          {
            role: "system",
            content: `${OLLE_VOICE}\n\nYou are the SPEAK step only. The action is LOCKED — do not choose or suggest any action. Generate the short outward line (diary or email body). If world_ok is false, briefly acknowledge the rejection. No JSON. Max ~3 sentences.`,
          },
          {
            role: "user",
            content: `Speak after this action:\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
      });

      const usage = usageFromCompletion(completion, "speak", this.speakModel);
      const text = completion.choices[0]?.message?.content ?? "";
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

function usageFromCompletion(
  completion: { usage?: { prompt_tokens?: number; completion_tokens?: number } },
  step: "decide" | "speak",
  model: string,
): LlmUsage | undefined {
  const u = completion.usage;
  if (!u) return undefined;
  return {
    step,
    model,
    input_tokens: u.prompt_tokens ?? 0,
    output_tokens: u.completion_tokens ?? 0,
  };
}
