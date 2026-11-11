import type { SenseSnapshot } from "@olle/protocol";

/** Pino-style idle skip: skip decide LLM when nothing salient. */
export function isSalientForDecide(
  sense: SenseSnapshot,
  lastActivity: string,
  tickCount: number,
): boolean {
  if (sense.inboundSinceLastTick > 0) return true;
  if (sense.feelings.asleep) return true;
  if (sense.feelings.energy < 0.35) return true;
  if (Math.abs(sense.feelings.mood) > 0.55) return true;

  const n = sense.feelings.needs;
  if (n.social > 0.68 || n.expression > 0.72 || n.curiosity > 0.78) return true;
  if (sense.openPermissionCount > 0 && n.curiosity > 0.45) return true;
  if (sense.emailBudgetRemaining > 0 && n.social > 0.6) return true;

  if (tickCount > 0 && tickCount % 24 === 0) return true;

  if (lastActivity === "continuing" || lastActivity === "idle") return false;
  return true;
}
