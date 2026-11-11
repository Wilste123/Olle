import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createPermissionRequest,
  loadState,
  saveState,
} from "../world/store.js";
import { processPermissionReply } from "./inbound.js";
import { emptyWorldState } from "../test/world-fixture.js";

let stateDir = "";

afterEach(async () => {
  if (stateDir) await rm(stateDir, { recursive: true, force: true });
  delete process.env.OLLE_STATE_PATH;
  delete process.env.WILLIAM_EMAIL;
});

function baseState() {
  return emptyWorldState();
}

describe("processPermissionReply", () => {
  it("approves and publishes shared diary", async () => {
    stateDir = await mkdtemp(join(tmpdir(), "olle-"));
    process.env.OLLE_STATE_PATH = join(stateDir, "state.json");
    process.env.WILLIAM_EMAIL = "william@test.com";

    const state = baseState();
    const req = createPermissionRequest(state, "propose_shared_diary_entry", {
      title: "Hi",
      body: "Body",
    });
    state.sharedDiaryQueue.push({
      id: `sde-${req.id}`,
      title: "Hi",
      body: "Body",
      status: "pending",
      request_id: req.id,
      created_at: new Date().toISOString(),
    });
    await saveState(state);

    const result = await processPermissionReply("william@test.com", `YES ${req.id}`);
    expect(result.ok).toBe(true);

    const after = await loadState();
    expect(after.permissions.find((p) => p.id === req.id)?.status).toBe("granted");
    expect(after.sharedDiaryQueue.find((e) => e.request_id === req.id)?.status).toBe("published");
  });

  it("rejects unknown sender", async () => {
    process.env.WILLIAM_EMAIL = "william@test.com";
    const result = await processPermissionReply("stranger@evil.com", "YES req-x");
    expect(result.ok).toBe(false);
  });
});
