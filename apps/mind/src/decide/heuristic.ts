import type { DecideOutput, SenseSnapshot } from "@olle/protocol";
import { maskLegalActionIds } from "./schema.js";

/** Dry-run decide without LLM API keys. */
export function heuristicDecide(sense: SenseSnapshot): DecideOutput {
  const legal = maskLegalActionIds({
    asleep: sense.feelings.asleep,
    openPermissions: sense.openPermissionCount,
    emailBudget: sense.emailBudgetRemaining,
    placementUnplaced: sense.placement.status === "unplaced",
  });

  if (sense.feelings.asleep) {
    return {
      action_id: legal.includes("sleep") ? "sleep" : "continue_activity",
      params: {},
      because: "Asleep — minimal activity.",
    };
  }

  if (sense.feelings.energy < 0.35 && legal.includes("rest")) {
    return {
      action_id: "rest",
      params: { minutes: 5 },
      because: "Energy low; resting.",
    };
  }

  if (sense.unreadFromWilliam > 0 && legal.includes("reply_to_william")) {
    return {
      action_id: "reply_to_william",
      params: {},
      because: sense.williamMessagePreview
        ? `William wrote: ${sense.williamMessagePreview.slice(0, 80)}`
        : "William sent a message.",
    };
  }

  if (
    sense.inboundSinceLastTick > 0 &&
    legal.includes("remember")
  ) {
    return {
      action_id: "remember",
      params: { key: "last_william_email", delta: 0.2 },
      because: "William sent something — strengthening memory.",
    };
  }

  if (sense.inboundSinceLastTick > 0 && legal.includes("think_about")) {
    return {
      action_id: "think_about",
      params: { topic: "what William wrote" },
      because: "New inbound email to reflect on.",
    };
  }

  if (sense.feelings.needs.expression > 0.7 && legal.includes("append_private_diary")) {
    return {
      action_id: "append_private_diary",
      params: {
        line: `Quiet tick on day ${sense.olleDay}. Mood ${sense.feelings.mood.toFixed(2)}.`,
      },
      because: "Expression need high.",
    };
  }

  if (
    sense.feelings.needs.social > 0.65 &&
    sense.emailBudgetRemaining > 0 &&
    legal.includes("notify_william")
  ) {
    return {
      action_id: "notify_william",
      params: {
        subject: "[Olle] thinking of you",
        body: "Small check-in from the mind loop (mock email — no API key).",
      },
      because: "Social need nudged a notify.",
    };
  }

  if (
    sense.feelings.needs.curiosity > 0.75 &&
    legal.includes("propose_shared_diary_entry") &&
    sense.openPermissionCount < 3
  ) {
    return {
      action_id: "propose_shared_diary_entry",
      params: {
        title: "A thought for our shared diary",
        body: "When you have a moment — still unplaced, but the idea is ready.",
      },
      because: "Curiosity wants to propose something shared (needs your YES).",
    };
  }

  if (legal.includes("think_about")) {
    return {
      action_id: "think_about",
      params: { topic: sense.threads[0] ?? "the day ahead" },
      because: "Nothing salient — gentle think.",
    };
  }

  return {
    action_id: "continue_activity",
    params: {},
    because: "Idle continuation.",
  };
}
