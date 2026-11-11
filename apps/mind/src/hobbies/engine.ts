import {
  HOBBY_MAX,
  HOBBY_MIN_BEFORE_EVICT,
  type HobbyThread,
} from "@olle/protocol";
import type { OlleWorldState } from "../world/store.js";

export const HOBBY_HEAT_DECAY_PER_TICK = 0.04;
export const SEED_HOBBY_LABELS = [
  "little patterns in the ceiling",
  "a train that might exist",
  "what William meant last time",
  "collecting quiet sounds",
  "imaginary window weather",
] as const;

export const PRIVATE_DIARY_MIN_TICK_GAP = 7;

export function ensureHobbies(state: OlleWorldState): void {
  if (!state.hobbies) state.hobbies = [];
  if (state.hobbies.length === 0) {
    const now = new Date().toISOString();
    for (const label of SEED_HOBBY_LABELS.slice(0, 3)) {
      state.hobbies.push(newHobby(label, 0.45, now));
    }
  }
}

export function newHobby(label: string, heat: number, at: string): HobbyThread {
  return {
    id: `hobby-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    heat: clampHeat(heat),
    last_touched: at,
    notes: [],
  };
}

export function decayHobbyHeat(state: OlleWorldState, ticks = 1): void {
  ensureHobbies(state);
  const factor = Math.pow(1 - HOBBY_HEAT_DECAY_PER_TICK, ticks);
  for (const h of state.hobbies) {
    h.heat = clampHeat(h.heat * factor);
  }
}

export function bumpHobby(
  state: OlleWorldState,
  hobbyId: string,
  delta: number,
  note?: string,
): HobbyThread | null {
  ensureHobbies(state);
  const h = state.hobbies.find((x) => x.id === hobbyId);
  if (!h) return null;
  const at = new Date().toISOString();
  h.heat = clampHeat(h.heat + delta);
  h.last_touched = at;
  if (note) {
    h.notes.push(note);
    if (h.notes.length > 12) h.notes = h.notes.slice(-12);
  }
  return h;
}

export function loudestHobbies(state: OlleWorldState, limit = 5): HobbyThread[] {
  ensureHobbies(state);
  return [...state.hobbies].sort((a, b) => b.heat - a.heat).slice(0, limit);
}

export function hobbyLabelsForSense(state: OlleWorldState): string[] {
  return loudestHobbies(state).map((h) => h.label);
}

export function pickRandomHobby(state: OlleWorldState): HobbyThread | undefined {
  ensureHobbies(state);
  if (state.hobbies.length === 0) return undefined;
  const idx = Math.floor(Math.random() * state.hobbies.length);
  return state.hobbies[idx];
}

export function spawnHobby(state: OlleWorldState, label: string, initialHeat = 0.55): HobbyThread {
  ensureHobbies(state);
  const at = new Date().toISOString();
  const trimmed = label.trim().slice(0, 120);
  const existing = state.hobbies.find((h) => h.label.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    bumpHobby(state, existing.id, 0.15);
    return existing;
  }
  while (state.hobbies.length >= HOBBY_MAX) {
    evictColdestHobby(state);
  }
  const h = newHobby(trimmed, initialHeat, at);
  state.hobbies.push(h);
  return h;
}

function evictColdestHobby(state: OlleWorldState): void {
  if (state.hobbies.length < HOBBY_MIN_BEFORE_EVICT) return;
  let coldest = 0;
  for (let i = 1; i < state.hobbies.length; i++) {
    if (state.hobbies[i]!.heat < state.hobbies[coldest]!.heat) coldest = i;
  }
  state.hobbies.splice(coldest, 1);
}

export function ticksSinceLastPrivateDiary(state: OlleWorldState): number {
  const last = state.lastPrivateDiaryTick ?? -999;
  return Math.max(0, state.tickCount - last);
}

export function recordPrivateDiaryTick(state: OlleWorldState): void {
  state.lastPrivateDiaryTick = state.tickCount;
}

function clampHeat(v: number): number {
  return Math.min(1, Math.max(0, v));
}
