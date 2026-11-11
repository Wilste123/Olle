import type { FeelingsState } from "@olle/protocol";

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
    },
    asleep: false,
  };
}

export function tickFeelings(prev: FeelingsState, input: FeelingsTickInput): FeelingsState {
  if (prev.asleep) {
    return {
      ...prev,
      energy: clamp(prev.energy + 0.02 * input.deltaSec, 0, 1),
      needs: {
        ...prev.needs,
        rest: clamp(prev.needs.rest - 0.01 * input.deltaSec, 0, 1),
      },
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
  if (input.wasResting) {
    needs.rest = clamp(needs.rest - 0.02 * input.deltaSec, 0, 1);
    needs.quiet = clamp(needs.quiet - 0.01 * input.deltaSec, 0, 1);
  } else {
    needs.rest = clamp(needs.rest + 0.006 * input.deltaSec, 0, 1);
  }

  return { mood, energy, needs, asleep: false };
}

export function enterSleep(f: FeelingsState): FeelingsState {
  return { ...f, asleep: true };
}

export function wake(f: FeelingsState): FeelingsState {
  return { ...f, asleep: false, energy: clamp(f.energy + 0.2, 0, 1) };
}
