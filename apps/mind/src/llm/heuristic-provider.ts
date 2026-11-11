import type { DecideOutput } from "@olle/protocol";
import { heuristicDecide } from "../decide/heuristic.js";
import { speakAfterDecide } from "../speak/templates.js";
import type { DecideContext, DecideResult, LlmProvider, SpeakContext, SpeakResult } from "./types.js";

export class HeuristicProvider implements LlmProvider {
  readonly name = "heuristic" as const;

  async decide(ctx: DecideContext): Promise<DecideResult> {
    return { output: heuristicDecide(ctx.sense) };
  }

  async speak(ctx: SpeakContext): Promise<SpeakResult> {
    return { text: speakAfterDecide(ctx.decision, ctx.feelings) };
  }
}

/** Idle continuation without re-running full heuristic rules. */
export function idleContinuation(): DecideOutput {
  return {
    action_id: "continue_activity",
    params: {},
    because: "Idle — skipped decide LLM (not salient).",
  };
}
