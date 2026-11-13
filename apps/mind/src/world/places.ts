import {
  getPlace,
  isPlaceNeighbor,
  type Placement,
  PLACE_GRAPH,
  type PlaceId,
} from "@olle/protocol";
import type { OlleWorldState } from "./store.js";
import { appendPinoFeed } from "./store.js";

export const DEFAULT_PLACE_ID: PlaceId = "home_nook";

export function currentPlaceId(state: OlleWorldState): string | undefined {
  if (state.placement.status !== "placed") return undefined;
  return state.placement.place_id;
}

export function placementLabel(state: OlleWorldState): string {
  if (state.placement.status === "unplaced") return "unplaced";
  const p = getPlace(state.placement.place_id);
  return p?.label ?? state.placement.place_id;
}

export function reachableFromState(state: OlleWorldState): string[] {
  const id = currentPlaceId(state);
  if (!id) return [];
  return [...(PLACE_GRAPH[id as PlaceId] ?? [])];
}

/** Migrate legacy unplaced / old placed shape to placed at home_nook. */
export function migratePlacement(state: OlleWorldState): void {
  const raw = state.placement as Placement & { label?: string };
  if (raw.status === "unplaced") {
    state.placement = {
      status: "placed",
      place_id: DEFAULT_PLACE_ID,
      since: new Date().toISOString(),
    };
    return;
  }
  if (raw.status === "placed") {
    const placeId = "place_id" in raw && raw.place_id ? raw.place_id : DEFAULT_PLACE_ID;
    if (!getPlace(placeId)) {
      state.placement = {
        status: "placed",
        place_id: DEFAULT_PLACE_ID,
        since: raw.since ?? new Date().toISOString(),
        note: raw.note,
      };
      return;
    }
    if (!("since" in raw) || !raw.since) {
      state.placement = {
        status: "placed",
        place_id: placeId,
        since: new Date().toISOString(),
        note: raw.note,
      };
    }
  }
}

export function ensurePlacement(state: OlleWorldState): void {
  migratePlacement(state);
}

export interface MoveValidation {
  ok: boolean;
  rejectReason?: string;
}

export function validateGoToPlace(state: OlleWorldState, targetId: string): MoveValidation {
  if (state.placement.status !== "placed") {
    return { ok: false, rejectReason: "Not placed on the map yet" };
  }
  const target = getPlace(targetId);
  if (!target) {
    return { ok: false, rejectReason: "Unknown place" };
  }
  const from = state.placement.place_id;
  if (from === targetId) {
    return { ok: false, rejectReason: "Already there" };
  }
  if (!isPlaceNeighbor(from, targetId)) {
    return { ok: false, rejectReason: "Not a neighboring place" };
  }
  return { ok: true };
}

export function setPlacementAt(
  state: OlleWorldState,
  placeId: string,
  opts?: { feed?: boolean; via?: string },
): MoveValidation {
  const place = getPlace(placeId);
  if (!place) return { ok: false, rejectReason: "Unknown place" };
  const from = currentPlaceId(state);
  state.placement = {
    status: "placed",
    place_id: placeId,
    since: new Date().toISOString(),
  };
  if (opts?.feed !== false && from && from !== placeId) {
    appendPinoFeed(state, "did", `Moved to ${place.label}`, {
      ok: true,
      about: "moved",
      action_id: opts?.via === "go_to_place" ? "go_to_place" : undefined,
      meta: { from_place_id: from, to_place_id: placeId },
    });
  }
  return { ok: true };
}

export function applyGoToPlace(state: OlleWorldState, placeId: string): MoveValidation {
  const v = validateGoToPlace(state, placeId);
  if (!v.ok) return v;
  return setPlacementAt(state, placeId, { via: "go_to_place" });
}
