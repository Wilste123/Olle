import type { ActionId, DecideOutput, FeelingsState, SenseSnapshot } from "@olle/protocol";

export interface DecideContext {
  sense: SenseSnapshot;
  legalActionIds: ActionId[];
  memorySnippets: string[];
}

export interface SpeakContext {
  /** Locked decision — speak must not choose a different action. */
  lockedDecision: DecideOutput;
  feelings: FeelingsState;
  memorySnippets: string[];
  worldOk: boolean;
  worldRejectReason?: string;
  /** Full latest William message when replying (speak step). */
  williamMessageText?: string;
  placement?: SenseSnapshot["placement"];
  /** Trimmed page text for research_topic speak — summarize only. */
  researchExcerpt?: string;
  researchUrl?: string;
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
