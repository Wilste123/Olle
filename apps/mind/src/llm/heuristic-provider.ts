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
    if (!ctx.worldOk) {
      return {
        text: `Couldn't do that: ${ctx.worldRejectReason ?? "world rejected the action"}.`,
      };
    }
    return { text: speakAfterDecide(ctx.lockedDecision, ctx.feelings) };
  }
}

export function idleContinuation(): DecideOutput {
  return {
    action_id: "continue_activity",
    params: {},
    because: "Idle — skipped decide LLM (not salient).",
  };
}
