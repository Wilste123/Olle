import type { DecideContext, DecideResult, LlmProvider, SpeakContext, SpeakResult } from "./types.js";

/** Placeholder — OpenAI decide/speak not implemented; use Anthropic or heuristic. */
export class OpenAiStubProvider implements LlmProvider {
  readonly name = "openai" as const;

  async decide(_ctx: DecideContext): Promise<DecideResult> {
    throw new Error("OpenAI provider is not implemented; set OLLE_LLM_PROVIDER=anthropic or heuristic");
  }

  async speak(_ctx: SpeakContext): Promise<SpeakResult> {
    throw new Error("OpenAI provider is not implemented; set OLLE_LLM_PROVIDER=anthropic or heuristic");
  }
}
