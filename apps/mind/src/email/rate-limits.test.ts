import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  canSendProactiveEmail,
  getEmailBudgetRemaining,
  PROACTIVE_SOFT_24H,
  recordEmailSend,
} from "./rate-limits.js";
import { emptyWorldState } from "../test/world-fixture.js";

describe("rate limits", () => {
  const prevQuiet = process.env.OLLE_QUIET_HOURS;

  beforeEach(() => {
    process.env.OLLE_QUIET_HOURS = "";
  });

  afterEach(() => {
    process.env.OLLE_QUIET_HOURS = prevQuiet;
  });

  it("reduces email budget after proactive sends", () => {
    const state = emptyWorldState();
    expect(getEmailBudgetRemaining(state)).toBe(PROACTIVE_SOFT_24H);
    recordEmailSend(state, "proactive");
    recordEmailSend(state, "proactive");
    expect(getEmailBudgetRemaining(state)).toBe(0);
  });

  it("blocks proactive at soft cap", () => {
    const state = emptyWorldState();
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    state.emailSends = [
      { at: fiveHoursAgo, kind: "proactive" },
      { at: fiveHoursAgo, kind: "proactive" },
    ];
    const r = canSendProactiveEmail(state);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("proactive_soft_cap");
  });
});
