import { loadOlleEnv } from "./env.js";
loadOlleEnv();

import type { DecideOutput } from "@olle/protocol";
import type { SenseSnapshot } from "@olle/protocol";
import { tickFeelings } from "./feelings/simulator.js";
import { syncSustenanceNeed } from "./feelings/normalize.js";
import { deriveFeelingWords } from "./feelings/labels.js";
import { createLlmProvider } from "./llm/factory.js";
import {
  buildDecideContext,
  buildSpeakContext,
  runDecide,
  runSpeak,
  shouldDecideBeSalient,
  shouldUseLlmSpeak,
} from "./llm/run.js";
import {
  decayHobbyHeat,
  ensureHobbies,
  hobbyLabelsForSense,
  ticksSinceLastPrivateDiary,
} from "./hobbies/engine.js";
import { tickHunger } from "./survival/hunger.js";
import { ensureSurvivalState, inventorySummary } from "./survival/inventory.js";
import { webFetchesRemaining } from "./tools/web-rate.js";
import { runSleepConsolidation } from "./mind/sleep.js";
import {
  expireStalePermissions,
  getOpenPermissionCount,
  loadState,
  saveState,
  appendPinoFeed,
} from "./world/store.js";
import { applyAct, finalizeAct, validateAct } from "./world/runtime.js";
import { createEmailAdapter } from "./email/adapter.js";
import { getEmailBudgetRemaining } from "./email/rate-limits.js";
import {
  countUnreadFromWilliam,
  latestUnreadWilliamPreview,
  latestUnreadWilliamText,
  williamUnreadSinceLastTick,
} from "./conversation/messages.js";
import { processInboundForTick } from "./inbound/offering.js";
import { processWebOfferingsForTick } from "./inbound/web-offering.js";
import { activeExhibitionsForSense, ensureExhibitions } from "./world/exhibitions.js";
import { ensurePlacement, placementLabel, reachableFromState, currentPlaceId } from "./world/places.js";

export interface TickResult {
  decision?: DecideOutput;
  spoke?: string;
  permissionId?: string;
  asleep?: boolean;
  llm?: { skippedDecide?: boolean; usages?: { step: string; model: string; in: number; out: number }[] };
}

/**
 * Pino-ordered tick: feel (no LLM) → sense → decide → world validate → act → speak.
 */
export async function runMindTick(): Promise<TickResult> {
  const state = await loadState();
  const email = createEmailAdapter();
  const provider = createLlmProvider();

  expireStalePermissions(state);

  const prevFeelings = state.feelings;
  state.feelings = tickFeelings(state.feelings, {
    events: [],
    deltaSec: 30,
    wasResting: state.lastActivity === "resting",
  });

  if (prevFeelings.mood !== state.feelings.mood) {
    appendPinoFeed(state, "felt", `mood ${state.feelings.mood.toFixed(2)}`, {
      ok: true,
      change: "mood",
    });
  }

  if (state.feelings.asleep) {
    if (state.tickCount % 48 === 0) runSleepConsolidation(state);
    state.tickCount += 1;
    await saveState(state);
    return { asleep: true };
  }

  ensureHobbies(state);
  ensureSurvivalState(state);
  decayHobbyHeat(state, 1);
  tickHunger(state, 1);
  syncSustenanceNeed(state.feelings, state.survival.hunger);
  state.feelings.feelingWords = deriveFeelingWords(state.feelings);

  ensureExhibitions(state);
  ensurePlacement(state);
  const inboundProcessed = processInboundForTick(state);
  const webOfferingsProcessed = processWebOfferingsForTick(state);
  const memorySnippets = [
    ...state.memories.slice(-5).map((m) => m.text),
    ...state.privateDiary.slice(-5),
  ].slice(-8);

  const sense: SenseSnapshot = {
    at: new Date().toISOString(),
    olleDay: state.olleDay,
    placement: state.placement,
    feelings: state.feelings,
    threads: ["William", ...hobbyLabelsForSense(state)],
    hobbies: state.hobbies,
    ticksSinceLastPrivateDiary: ticksSinceLastPrivateDiary(state),
    emailBudgetRemaining: getEmailBudgetRemaining(state),
    openPermissionCount: getOpenPermissionCount(state),
    recentFeedTail: state.feed.slice(-5).map((f) => f.text),
    inboundSinceLastTick:
      inboundProcessed.newCount + webOfferingsProcessed.newCount + williamUnreadSinceLastTick(state),
    unreadFromWilliam: countUnreadFromWilliam(state),
    williamMessagePreview: latestUnreadWilliamPreview(state),
    williamMessageText: latestUnreadWilliamText(state),
    survival: state.survival,
    purse: state.purse,
    inventory: state.inventory,
    inventorySummary: inventorySummary(state),
    webFetchesRemaining: webFetchesRemaining(state),
    activeExhibitions: activeExhibitionsForSense(state),
    lastVisitedExhibitionId: state.lastVisitedExhibitionId,
    webOfferingsSinceLastTick: webOfferingsProcessed.newCount,
    placeId: currentPlaceId(state),
    placeLabel: placementLabel(state),
    reachablePlaceIds: reachableFromState(state),
  };

  const salient = shouldDecideBeSalient(
    sense,
    state.lastActivity,
    state.tickCount,
    state.lastDecisionActionId,
  );
  const decideCtx = buildDecideContext(sense, memorySnippets);
  const decideResult = await runDecide(provider, decideCtx, { salient });

  state.lastDecisionActionId = decideResult.output.action_id;

  appendPinoFeed(state, "mind", decideResult.output.because, {
    why: decideResult.output.because,
    action_id: decideResult.output.action_id,
    ok: true,
  });

  const validation = validateAct(state, decideResult.output);
  const actResult = await applyAct(state, decideResult.output, validation, email);

  appendPinoFeed(
    state,
    "did",
    actResult.ok
      ? decideResult.output.action_id
      : `rejected: ${actResult.rejectReason ?? validation.rejectReason}`,
    {
      why: decideResult.output.because,
      ok: actResult.ok,
      action_id: decideResult.output.action_id,
      about: actResult.permissionId ? "permission" : undefined,
      change: actResult.ok ? decideResult.output.action_id : "rejected",
    },
  );

  const usages: NonNullable<TickResult["llm"]> = { usages: [] };
  if (decideResult.usage) {
    usages.usages!.push({
      step: decideResult.usage.step,
      model: decideResult.usage.model,
      in: decideResult.usage.input_tokens,
      out: decideResult.usage.output_tokens,
    });
  }
  if (decideResult.skippedLlm) usages.skippedDecide = true;

  const speakCtx = {
    ...buildSpeakContext(
      decideResult.output,
      state.feelings,
      memorySnippets,
      actResult.ok,
      actResult.rejectReason ?? validation.rejectReason,
    ),
    williamMessageText: sense.williamMessageText,
    placement: state.placement,
    researchExcerpt: state.lastResearch?.excerpt,
    researchUrl: state.lastResearch?.url,
  };
  const speakResult = await runSpeak(provider, speakCtx, {
    useLlm: shouldUseLlmSpeak(provider, decideResult.output.action_id),
  });

  if (speakResult.usage) {
    usages.usages!.push({
      step: speakResult.usage.step,
      model: speakResult.usage.model,
      in: speakResult.usage.input_tokens,
      out: speakResult.usage.output_tokens,
    });
  }

  await finalizeAct(state, decideResult.output, actResult, speakResult.text, email);

  if (usages.usages!.length) {
    appendPinoFeed(state, "noticed", `llm tokens ${JSON.stringify(usages.usages)}`, { ok: true });
  }
  if (decideResult.skippedLlm) {
    appendPinoFeed(state, "noticed", "Decide LLM skipped (idle continuation)", { ok: true });
  }

  state.tickCount += 1;
  state.lastTickAt = new Date().toISOString();
  await saveState(state);

  return {
    decision: decideResult.output,
    spoke: speakResult.text,
    permissionId: actResult.permissionId,
    llm: usages.usages!.length || usages.skippedDecide ? usages : undefined,
  };
}
