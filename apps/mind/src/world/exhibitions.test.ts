import { describe, expect, it } from "vitest";
import { loadState } from "./store.js";
import { cozyDefaultExhibitions } from "./exhibitions.js";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("exhibition seed", () => {
  it("seeds cozy defaults on fresh state file", async () => {
    const dir = join(tmpdir(), `olle-exh-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "state.json");
    const prev = process.env.OLLE_STATE_PATH;
    process.env.OLLE_STATE_PATH = path;
    try {
      const state = await loadState();
      expect(state.exhibitions?.length).toBe(2);
      expect(state.exhibitions?.[0].title).toBe(cozyDefaultExhibitions()[0].title);
    } finally {
      process.env.OLLE_STATE_PATH = prev;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
