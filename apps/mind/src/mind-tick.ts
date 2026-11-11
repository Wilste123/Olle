import type { SenseSnapshot } from "@olle/protocol";
import { tickFeelings } from "./feelings/simulator.js";
import { executeAction } from "./act/executor.js";
import { createLlmProvider } from "./llm/factory.js";
import {
  buildDecideContext,
  buildSpeakContext,
  runDecide,
  runSpeak,
  shouldDecideBeSalient,
} from "./llm/run.js";
import {
  expireStalePermissions,
  getOpenPermissionCount,
  loadState,
  saveState,
  appendFeed,
} from "./world/store.js";
import { createEmailAdapter } from "./email/adapter.js";
import type { DecideOutput } from "@olle/protocol";

export interface TickResult {
  decision: DecideOutput;
  spoke: string;
  permissionId?: string;
  llm?: { skippedDecide?: boolean; usages?: { step: string; model: string; in: number; out: number }[] };
}

export async function runMindTick(): Promise<TickResult> {
  const state = await loadState();
  const email = createEmailAdapter();
  const provider = createLlmProvider();

  expireStalePermissions(state);

  state.feelings = tickFeelings(state.feelings, {
    events: [],
    deltaSec: 30,
    wasResting: state.lastActivity === "resting",
  });

  const memorySnippets = state.privateDiary.slice(-5);

  const sense: SenseSnapshot = {
    at: new Date().toISOString(),
    olleDay: state.olleDay,
    placement: state.placement,
    feelings: state.feelings,
    threads: ["William", "today"],
    emailBudgetRemaining: 2,
    openPermissionCount: getOpenPermissionCount(state),
    recentFeedTail: state.feed.slice(-5).map((f) => f.text),
    inboundSinceLastTick: 0,
  };

  const salient = shouldDecideBeSalient(sense, state.lastActivity, state.tickCount);
  const decideCtx = buildDecideContext(sense, memorySnippets);
  const decideResult = await runDecide(provider, decideCtx, { salient });

  const act = await executeAction(state, decideResult.output, email);

  const usages: TickResult["llm"] = { usages: [] };
  if (decideResult.usage) {
    usages.usages!.push({
      step: decideResult.usage.step,
      model: decideResult.usage.model,
      in: decideResult.usage.input_tokens,
      out: decideResult.usage.output_tokens,
    });
  }
  if (decideResult.skippedLlm) usages.skippedDecide = true;

  let spoke = act.spoke;
  if (!spoke) {
    const speakCtx = buildSpeakContext(decideResult.output, state.feelings, memorySnippets);
    const speakResult = await runSpeak(provider, speakCtx, {
      useLlm: provider.name !== "heuristic",
    });
    spoke = speakResult.text;
    if (speakResult.usage) {
      usages.usages!.push({
        step: speakResult.usage.step,
        model: speakResult.usage.model,
        in: speakResult.usage.input_tokens,
        out: speakResult.usage.output_tokens,
      });
    }
  }

  if (usages.usages!.length > 0) {
    appendFeed(state, "llm_usage", `tokens: ${JSON.stringify(usages.usages)}`);
  }
  if (decideResult.skippedLlm) {
    appendFeed(state, "llm_skip", "Decide LLM skipped (idle, not salient).");
  }

  appendFeed(state, "tick", `${decideResult.output.action_id}: ${decideResult.output.because}`, {
    action_id: decideResult.output.action_id,
    provider: provider.name,
  });

  state.tickCount += 1;
  await saveState(state);

  return {
    decision: decideResult.output,
    spoke,
    permissionId: act.permissionId,
    llm: usages.usages!.length || usages.skippedDecide ? usages : undefined,
  };
}
