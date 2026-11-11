import type { OlleWorldState } from "../world/store.js";

export const WEB_FETCH_MAX_PER_DAY = 12;

export function webFetchesRemaining(state: OlleWorldState): number {
  const today = utcDay();
  const count = (state.researchFetches ?? []).filter((f) => f.day === today).length;
  return Math.max(0, WEB_FETCH_MAX_PER_DAY - count);
}

export function recordWebFetch(state: OlleWorldState, url: string): void {
  const today = utcDay();
  if (!state.researchFetches) state.researchFetches = [];
  state.researchFetches.push({ at: new Date().toISOString(), day: today, url });
  const cutoff = Date.now() - 48 * 3600 * 1000;
  state.researchFetches = state.researchFetches.filter((f) => new Date(f.at).getTime() > cutoff);
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}
