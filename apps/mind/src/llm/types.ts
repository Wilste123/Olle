import type { ActionId, DecideOutput, FeelingsState, SenseSnapshot } from "@olle/protocol";

export interface DecideContext {
  sense: SenseSnapshot;
  legalActionIds: ActionId[];
  memorySnippets: string[];
}

export interface SpeakContext {
  decision: DecideOutput;
  feelings: FeelingsState;
  memorySnippets: string[];
}

export interface LlmUsage {
  step: "decide" | "speak";
  model: string;
  input_tokens: number;
  output_tokens: number;
}

export interface DecideResult {
  output: DecideOutput;
  usage?: LlmUsage;
  skippedLlm?: boolean;
  fellBack?: boolean;
}

export interface SpeakResult {
  text: string;
  usage?: LlmUsage;
  fellBack?: boolean;
}

export interface LlmProvider {
  readonly name: "heuristic" | "anthropic" | "openai";
  decide(ctx: DecideContext): Promise<DecideResult>;
  speak(ctx: SpeakContext): Promise<SpeakResult>;
}
