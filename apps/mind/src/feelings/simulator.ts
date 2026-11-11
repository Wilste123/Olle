import type { FeelingsState } from "@olle/protocol";
import { deriveFeelingWords } from "./labels.js";

export interface FeelingsTickInput {
  /** Events since last tick: positive = win, negative = setback */
  events: number[];
  /** Seconds elapsed (or 1 per tick) */
  deltaSec: number;
  wasResting: boolean;
}

const SETBACK_WEIGHT = 7.5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Deterministic feelings update — no LLM. */
export function initFeelings(): FeelingsState {
  return {
    mood: 0.1,
    energy: 0.75,
    needs: {
      rest: 0.3,
      curiosity: 0.5,
      social: 0.4,
      expression: 0.35,
      quiet: 0.2,
      wonder: 0.45,
      joy: 0.4,
      comfort: 0.55,
      sustenance: 0.35,
    },
    asleep: false,
    feelingWords: ["rolig", "våken"],
    affection: 0.45,
  };
}

export function tickFeelings(prev: FeelingsState, input: FeelingsTickInput): FeelingsState {
  if (prev.asleep) {
    const needs = {
      ...prev.needs,
      rest: clamp(prev.needs.rest - 0.01 * input.deltaSec, 0, 1),
    };
    return {
      ...prev,
      energy: clamp(prev.energy + 0.02 * input.deltaSec, 0, 1),
      needs,
      feelingWords: deriveFeelingWords({ ...prev, needs, asleep: true }),
    };
  }

  let mood = prev.mood;
  for (const e of input.events) {
    const w = e < 0 ? SETBACK_WEIGHT : 1;
    mood += e * 0.05 * w;
  }
  mood = clamp(mood, -1, 1);

  const drain = input.wasResting ? 0.001 : 0.008;
  let energy = clamp(prev.energy - drain * input.deltaSec, 0, 1);
  if (input.wasResting) {
    energy = clamp(energy + 0.015 * input.deltaSec, 0, 1);
  }

  const needs = { ...prev.needs };
  needs.curiosity = clamp(needs.curiosity + 0.004 * input.deltaSec, 0, 1);
  needs.social = clamp(needs.social + 0.003 * input.deltaSec, 0, 1);
  needs.expression = clamp(needs.expression + 0.002 * input.deltaSec, 0, 1);
  needs.wonder = clamp(needs.wonder + 0.0035 * input.deltaSec, 0, 1);
  needs.joy = clamp(needs.joy - 0.0015 * input.deltaSec, 0, 1);
  if (input.wasResting) {
    needs.rest = clamp(needs.rest - 0.02 * input.deltaSec, 0, 1);
    needs.quiet = clamp(needs.quiet - 0.01 * input.deltaSec, 0, 1);
    needs.comfort = clamp(needs.comfort + 0.012 * input.deltaSec, 0, 1);
  } else {
    needs.rest = clamp(needs.rest + 0.006 * input.deltaSec, 0, 1);
    needs.comfort = clamp(needs.comfort - 0.002 * input.deltaSec, 0, 1);
  }
  if (mood > prev.mood) {
    needs.joy = clamp(needs.joy + 0.02, 0, 1);
  } else if (mood < prev.mood - 0.05) {
    needs.comfort = clamp(needs.comfort - 0.04, 0, 1);
  }

  const feelingWords = deriveFeelingWords({ ...prev, mood, energy, needs, asleep: false });
  return { mood, energy, needs, asleep: false, affection: prev.affection, feelingWords };
}

export function enterSleep(f: FeelingsState): FeelingsState {
  return { ...f, asleep: true, feelingWords: deriveFeelingWords({ ...f, asleep: true }) };
}

export function wake(f: FeelingsState): FeelingsState {
  const next = { ...f, asleep: false, energy: clamp(f.energy + 0.2, 0, 1) };
  next.feelingWords = deriveFeelingWords(next);
  return next;
}

export function applyNeedDelta(feelings: FeelingsState, delta: Partial<FeelingsState["needs"]>): void {
  for (const [k, v] of Object.entries(delta)) {
    if (typeof v !== "number") continue;
    const key = k as keyof FeelingsState["needs"];
    feelings.needs[key] = clamp(feelings.needs[key] + v, 0, 1);
  }
  feelings.feelingWords = deriveFeelingWords(feelings);
}
