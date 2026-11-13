import { randomBytes } from "node:crypto";
import type { OlleWorldState } from "./store.js";

export interface Exhibition {
  id: string;
  title: string;
  blurb: string;
  url?: string;
  createdAt: string;
  active: boolean;
  place_id: string;
}

export function cozyDefaultExhibitions(): Exhibition[] {
  const createdAt = new Date().toISOString();
  return [
    {
      id: "ex-cozy-light",
      title: "Lys i november",
      blurb: "Et lite rom med levende lys, ull og stille bilder — kos uten kalender.",
      createdAt,
      active: true,
      place_id: "gallery_a",
    },
    {
      id: "ex-small-maps",
      title: "Små kart og dagdrømmer",
      blurb: "Håndtegnede kart over steder som kanskje finnes; du trenger ikke reise dit.",
      createdAt,
      active: true,
      place_id: "gallery_b",
    },
  ];
}

export function ensureExhibitions(state: OlleWorldState): void {
  if (!state.exhibitions?.length) {
    state.exhibitions = cozyDefaultExhibitions();
  }
  for (const ex of state.exhibitions) {
    if (!ex.place_id) {
      ex.place_id = ex.id === "ex-small-maps" ? "gallery_b" : "gallery_a";
    }
  }
}

export function getActiveExhibitions(state: OlleWorldState): Exhibition[] {
  return (state.exhibitions ?? []).filter((e) => e.active);
}

export function findExhibition(state: OlleWorldState, id: string): Exhibition | undefined {
  return (state.exhibitions ?? []).find((e) => e.id === id);
}

export function activeExhibitionsForSense(
  state: OlleWorldState,
): { id: string; title: string }[] {
  return getActiveExhibitions(state).map((e) => ({ id: e.id, title: e.title }));
}

export function addExhibition(
  state: OlleWorldState,
  input: { title: string; blurb: string; url?: string },
): Exhibition {
  if (!state.exhibitions) state.exhibitions = [];
  const exhibition: Exhibition = {
    id: `ex-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`,
    title: input.title.trim().slice(0, 120),
    blurb: input.blurb.trim().slice(0, 600),
    url: input.url?.trim() || undefined,
    createdAt: new Date().toISOString(),
    active: true,
    place_id: "gallery_a",
  };
  state.exhibitions.push(exhibition);
  return exhibition;
}
