import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleInboundEmail } from "./handler.js";

describe("handleInboundEmail", () => {
  let dir: string;
  const prevState = process.env.OLLE_STATE_PATH;
  const prevWilliam = process.env.WILLIAM_EMAIL;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "olle-inbound-"));
    process.env.OLLE_STATE_PATH = join(dir, "state.json");
    process.env.WILLIAM_EMAIL = "william@test.local";
    process.env.OLLE_INBOUND_ALLOWLIST = "william@test.local";
  });

  afterEach(async () => {
    process.env.OLLE_STATE_PATH = prevState;
    process.env.WILLIAM_EMAIL = prevWilliam;
    await rm(dir, { recursive: true, force: true });
  });

  it("queues non-permission email as offering", async () => {
    const r = await handleInboundEmail({
      from: "william@test.local",
      subject: "Hello",
      text: "Just checking in on Olle.",
    });
    expect(r.ok).toBe(true);
    expect(r.kind).toBe("offering");
  });
});
