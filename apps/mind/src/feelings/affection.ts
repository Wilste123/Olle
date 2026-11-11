import type { OlleWorldState } from "../world/store.js";

export function bumpAffectionTowardWilliam(state: OlleWorldState, delta = 0.03): void {
  state.feelings.affection = Math.min(1, Math.max(0, state.feelings.affection + delta));
}
