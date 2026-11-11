import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { OlleWorldState } from "../world/store.js";
import {
  canSendProactiveEmail,
  getEmailBudgetRemaining,
  PROACTIVE_SOFT_24H,
  recordEmailSend,
} from "./rate-limits.js";

function emptyState(): OlleWorldState {
  return {
    version: 1,
    placement: { status: "unplaced" },
    olleDay: 0,
    feelings: {
      mood: 0,
      energy: 0.8,
      needs: { rest: 0.2, curiosity: 0.3, social: 0.3, expression: 0.3, quiet: 0.2 },
      asleep: false,
    },
    privateDiary: [],
    sharedDiaryQueue: [],
    feed: [],
    permissions: [],
    outbox: [],
    audit: [],
    inboundQueue: [],
    memories: [],
    emailSends: [],
    conversation: [],
    lastActivity: "idle",
    tickCount: 0,
  };
}

describe("rate limits", () => {
  const prevQuiet = process.env.OLLE_QUIET_HOURS;

  beforeEach(() => {
    process.env.OLLE_QUIET_HOURS = "";
  });

  afterEach(() => {
    process.env.OLLE_QUIET_HOURS = prevQuiet;
  });

  it("reduces email budget after proactive sends", () => {
    const state = emptyState();
    expect(getEmailBudgetRemaining(state)).toBe(PROACTIVE_SOFT_24H);
    recordEmailSend(state, "proactive");
    recordEmailSend(state, "proactive");
    expect(getEmailBudgetRemaining(state)).toBe(0);
  });

  it("blocks proactive at soft cap", () => {
    const state = emptyState();
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
