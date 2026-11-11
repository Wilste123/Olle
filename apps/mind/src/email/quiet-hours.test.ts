import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isInQuietHours, parseQuietHours } from "./quiet-hours.js";

describe("parseQuietHours", () => {
  it("parses 22:00-08:00", () => {
    const w = parseQuietHours("22:00-08:00");
    expect(w).not.toBeNull();
    expect(w!.startMin).toBe(22 * 60);
    expect(w!.endMin).toBe(8 * 60);
    expect(w!.crossesMidnight).toBe(true);
  });

  it("returns null for empty", () => {
    expect(parseQuietHours("")).toBeNull();
  });
});

describe("isInQuietHours", () => {
  const prev = process.env.OLLE_QUIET_HOURS;
  const prevTz = process.env.OLLE_QUIET_TZ;

  beforeEach(() => {
    process.env.OLLE_QUIET_HOURS = "22:00-08:00";
    process.env.OLLE_QUIET_TZ = "UTC";
  });

  afterEach(() => {
    process.env.OLLE_QUIET_HOURS = prev;
    process.env.OLLE_QUIET_TZ = prevTz;
  });

  it("is quiet at 23:00 UTC", () => {
    const at = new Date("2026-11-11T23:00:00.000Z");
    expect(isInQuietHours(at)).toBe(true);
  });

  it("is not quiet at 12:00 UTC", () => {
    const at = new Date("2026-11-11T12:00:00.000Z");
    expect(isInQuietHours(at)).toBe(false);
  });
});
