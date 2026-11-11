import { maskLegalActionIds } from "../decide/schema.js";
import { heuristicDecide } from "../decide/heuristic.js";
import { HeuristicProvider, idleContinuation } from "./heuristic-provider.js";
import { isSalientForDecide } from "./salience.js";
import type { DecideContext, DecideResult, LlmProvider, SpeakContext, SpeakResult } from "./types.js";
import type { SenseSnapshot } from "@olle/protocol";

export function buildDecideContext(
  sense: SenseSnapshot,
  memorySnippets: string[],
): DecideContext {
  const legalActionIds = maskLegalActionIds({
    asleep: sense.feelings.asleep,
    openPermissions: sense.openPermissionCount,
    emailBudget: sense.emailBudgetRemaining,
    placementUnplaced: sense.placement.status === "unplaced",
  });
  return { sense, legalActionIds, memorySnippets };
}

export function buildSpeakContext(
  decision: DecideResult["output"],
  feelings: SenseSnapshot["feelings"],
  memorySnippets: string[],
): SpeakContext {
  return { decision, feelings, memorySnippets };
}

export async function runDecide(
  provider: LlmProvider,
  ctx: DecideContext,
  opts: { salient: boolean },
): Promise<DecideResult> {
  if (provider.name === "heuristic") {
    return provider.decide(ctx);
  }

  if (!opts.salient) {
    return {
      output: idleContinuation(),
      skippedLlm: true,
    };
  }

  try {
    const result = await provider.decide(ctx);
    if (result.fellBack) return result;
    return result;
  } catch {
    return {
      output: heuristicDecide(ctx.sense),
      fellBack: true,
    };
  }
}

export async function runSpeak(
  provider: LlmProvider,
  ctx: SpeakContext,
  opts?: { useLlm: boolean },
): Promise<SpeakResult> {
  const useLlm = opts?.useLlm ?? provider.name !== "heuristic";
  if (!useLlm) {
    return new HeuristicProvider().speak(ctx);
  }
  try {
    return await provider.speak(ctx);
  } catch {
    const fallback = await new HeuristicProvider().speak(ctx);
    return { ...fallback, fellBack: true };
  }
}

export function shouldDecideBeSalient(
  sense: SenseSnapshot,
  lastActivity: string,
  tickCount: number,
): boolean {
  return isSalientForDecide(sense, lastActivity, tickCount);
}
