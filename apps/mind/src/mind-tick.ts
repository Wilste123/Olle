import type { SenseSnapshot } from "@olle/protocol";
import { tickFeelings } from "./feelings/simulator.js";
import { decide } from "./decide/llm.js";
import { executeAction } from "./act/executor.js";
import { speakAfterDecide } from "./speak/templates.js";
import {
  expireStalePermissions,
  getOpenPermissionCount,
  loadState,
  saveState,
  appendFeed,
} from "./world/store.js";
import { createEmailAdapter } from "./email/adapter.js";

export interface TickResult {
  decision: Awaited<ReturnType<typeof decide>>;
  spoke: string;
  permissionId?: string;
}

export async function runMindTick(): Promise<TickResult> {
  const state = await loadState();
  const email = createEmailAdapter();

  expireStalePermissions(state);

  state.feelings = tickFeelings(state.feelings, {
    events: [],
    deltaSec: 30,
    wasResting: state.lastActivity === "resting",
  });

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

  const decision = await decide(sense);
  const act = await executeAction(state, decision, email);
  const spoke = act.spoke || speakAfterDecide(decision, state.feelings);

  appendFeed(state, "tick", `${decision.action_id}: ${decision.because}`, {
    action_id: decision.action_id,
  });

  state.tickCount += 1;
  await saveState(state);

  return { decision, spoke, permissionId: act.permissionId };
}
