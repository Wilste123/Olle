import { describe, expect, it } from "vitest";
import { emptyWorldState } from "../test/world-fixture.js";
import { loadState } from "./store.js";
import { migratePlacement, validateGoToPlace, applyGoToPlace } from "./places.js";
import { validateAct, applyAct } from "./runtime.js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DecideOutput } from "@olle/protocol";
import { createEmailAdapter } from "../email/adapter.js";

describe("places migration", () => {
  it("migrates unplaced saves to home_nook", () => {
    const state = emptyWorldState({ placement: { status: "unplaced" }, version: 3 });
    migratePlacement(state);
    expect(state.placement).toMatchObject({ status: "placed", place_id: "home_nook" });
    expect((state.placement as { since?: string }).since).toBeTruthy();
  });

  it("loads legacy unplaced json from disk", async () => {
    const dir = join(tmpdir(), `olle-place-mig-${Date.now()}`);
    const path = join(dir, ".olle-state.json");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path,
      JSON.stringify({
        version: 4,
        placement: { status: "unplaced" },
        feelings: { mood: 0, energy: 0.5, needs: {}, asleep: false, feelingWords: [], affection: 0.5 },
      }),
    );
  const state = await loadState(path);
    expect(state.placement.status).toBe("placed");
    expect(state.version).toBe(5);
    await rm(dir, { recursive: true, force: true });
  });
});

describe("go_to_place validation", () => {
  const email = createEmailAdapter();

  it("allows adjacent step and rejects skip", async () => {
    const state = emptyWorldState({
      placement: { status: "placed", place_id: "home_nook", since: new Date().toISOString() },
    });
    expect(validateGoToPlace(state, "hallway").ok).toBe(true);
    expect(validateGoToPlace(state, "gallery_a").ok).toBe(false);

    const decision: DecideOutput = {
      action_id: "go_to_place",
      params: { place_id: "hallway" },
      because: "test walk",
    };
    expect(validateAct(state, decision).ok).toBe(true);
    const result = await applyAct(state, decision, { ok: true }, email);
    expect(result.ok).toBe(true);
    expect(state.placement).toMatchObject({ place_id: "hallway" });
    expect(state.feed.some((f) => f.about === "moved")).toBe(true);
  });

  it("rejects unknown neighbor via applyGoToPlace", () => {
    const state = emptyWorldState({
      placement: { status: "placed", place_id: "home_nook", since: new Date().toISOString() },
    });
    expect(applyGoToPlace(state, "gallery_b").ok).toBe(false);
    expect(state.placement.status === "placed" && state.placement.place_id).toBe("home_nook");
  });
});
