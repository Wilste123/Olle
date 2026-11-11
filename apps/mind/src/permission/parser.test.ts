import { describe, expect, it } from "vitest";
import { parsePermissionReply } from "./parser.js";

describe("permission parser", () => {
  it("parses YES", () => {
    expect(parsePermissionReply("YES req-abc-123")).toEqual({
      type: "approve",
      id: "req-abc-123",
    });
  });

  it("parses NO", () => {
    expect(parsePermissionReply("no req-xyz")).toEqual({ type: "deny", id: "req-xyz" });
  });

  it("parses EDIT", () => {
    expect(parsePermissionReply("EDIT req-1 | title=Hello | note=there")).toEqual({
      type: "edit",
      id: "req-1",
      overrides: { title: "Hello", note: "there" },
    });
  });

  it("returns null for garbage", () => {
    expect(parsePermissionReply("maybe later")).toBeNull();
  });
});
