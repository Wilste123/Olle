import type { FeelingsState } from "@olle/protocol";
import { initFeelings } from "./simulator.js";
import { deriveFeelingWords } from "./labels.js";

const DEFAULT_NEEDS = initFeelings().needs;

/** Fill missing v1/v2 fields when loading state. */
export function normalizeFeelings(raw: Partial<FeelingsState> | undefined): FeelingsState {
  const base = initFeelings();
  if (!raw) return base;
  const needs = { ...DEFAULT_NEEDS, ...raw.needs };
  const merged: FeelingsState = {
    mood: raw.mood ?? base.mood,
    energy: raw.energy ?? base.energy,
    needs,
    asleep: raw.asleep ?? false,
    affection: raw.affection ?? 0.45,
    feelingWords: raw.feelingWords ?? [],
  };
  merged.feelingWords = deriveFeelingWords(merged);
  return merged;
}

export function syncSustenanceNeed(feelings: FeelingsState, hunger: number): void {
  feelings.needs.sustenance = Math.min(1, Math.max(0, hunger));
}
