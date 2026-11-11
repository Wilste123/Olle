import type { DecideOutput, FeelingsState } from "@olle/protocol";
import { heuristicActivityLine } from "./heuristic-lines.js";
import { heuristicReplyToWilliam } from "./heuristic-reply.js";

export interface SpeakTemplateContext {
  williamMessageText?: string;
}

export function speakAfterDecide(
  decision: DecideOutput,
  feelings: FeelingsState,
  ctx: SpeakTemplateContext = {},
): string {
  const moodWord =
    feelings.mood > 0.3 ? "light" : feelings.mood < -0.3 ? "heavy" : "steady";
  switch (decision.action_id) {
    case "append_private_diary":
      return `*(private)* ${String(decision.params.line ?? "")} — felt ${moodWord}.`;
    case "notify_william":
    case "email_william":
      return String(decision.params.body ?? "");
    case "reply_to_william":
      return heuristicReplyToWilliam(ctx.williamMessageText, feelings);
    case "propose_shared_diary_entry":
      return `I'd like to add to our shared diary when you approve: "${String(decision.params.title ?? "")}"`;
    case "research_topic":
      return `Read something online: ${decision.because} (short notes in diary).`;
    case "play_solo":
    case "wander_curiosity":
    case "nurse_hobby":
      return heuristicActivityLine(decision);
    case "rest":
      return `Resting a few minutes. Energy was ${feelings.energy.toFixed(2)}.`;
    default:
      return `${decision.because} (mood: ${moodWord})`;
  }
}
