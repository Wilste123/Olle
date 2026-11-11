import type { SenseSnapshot } from "@olle/protocol";
import type { ActionId } from "@olle/protocol";

/** Pino-style idle skip: no decide LLM when continuing same activity and calm. */
export function isSalientForDecide(
  sense: SenseSnapshot,
  lastActivity: string,
  tickCount: number,
  lastDecisionActionId?: ActionId,
): boolean {
  if (sense.feelings.asleep) return false;
  if (sense.inboundSinceLastTick > 0) return true;
  if (sense.unreadFromWilliam > 0) return true;
  if (sense.feelings.energy < 0.35) return true;
  if (Math.abs(sense.feelings.mood) > 0.55) return true;

  const n = sense.feelings.needs;
  if (sense.survival.hunger > 0.7) return true;
  if (sense.survival.hunger > 0.55 && sense.inventory.every((i) => i.kind !== "food" || i.qty < 1)) {
    return true;
  }

  if (n.wonder > 0.62) return true;
  if (n.joy < 0.28) return true;
  if (n.comfort < 0.3) return true;
  if (sense.webFetchesRemaining > 0 && n.curiosity > 0.68) return true;
  if (n.social > 0.68 || n.expression > 0.72 || n.curiosity > 0.78) return true;

  const hotHobby = sense.hobbies.length
    ? Math.max(...sense.hobbies.map((h) => h.heat))
    : 0;
  if (hotHobby > 0.62 && n.curiosity > 0.42) return true;

  if (n.expression > 0.7 && n.curiosity > 0.45) return true;
  if (sense.openPermissionCount > 0 && n.curiosity > 0.45) return true;
  if (sense.emailBudgetRemaining > 0 && n.social > 0.6) return true;

  if (tickCount > 0 && tickCount % 24 === 0) return true;

  const continuing =
    lastActivity === "continuing" ||
    (lastDecisionActionId === "continue_activity" && lastActivity !== "idle");
  if (continuing) {
    if (n.expression > 0.78) return true;
    if (hotHobby > 0.7) return true;
    return false;
  }

  return true;
}
