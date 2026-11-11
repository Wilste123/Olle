import type { OlleWorldState } from "../world/store.js";
import { ensureSurvivalState } from "./inventory.js";

/** Hunger rises each tick (0–1 scale; higher = hungrier). No LLM. */
export const HUNGER_RISE_PER_TICK = 0.018;

export function tickHunger(state: OlleWorldState, ticks = 1): void {
  ensureSurvivalState(state);
  const rise = HUNGER_RISE_PER_TICK * ticks;
  state.survival.hunger = clamp(state.survival.hunger + rise, 0, 1);
  if (state.survival.hunger > 0.55) {
    state.feelings.needs.rest = Math.min(1, state.feelings.needs.rest + 0.02);
  }
}

export function applyMeal(
  state: OlleWorldState,
  hungerDelta: number,
): void {
  ensureSurvivalState(state);
  state.survival.hunger = clamp(state.survival.hunger + hungerDelta, 0, 1);
  state.survival.last_meal_at = new Date().toISOString();
  state.feelings.energy = Math.min(1, state.feelings.energy + Math.min(0.15, -hungerDelta * 0.4));
  state.feelings.mood = Math.min(1, state.feelings.mood + 0.04);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
