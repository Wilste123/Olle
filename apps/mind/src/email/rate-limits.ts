import type { OlleWorldState } from "../world/store.js";
import { isInQuietHours } from "./quiet-hours.js";

export const PROACTIVE_SOFT_24H = 2;
export const PROACTIVE_HARD_24H = 4;
export const PERMISSION_CAP_24H = 3;
export const MIN_PROACTIVE_GAP_MS = 4 * 60 * 60 * 1000;

export type EmailSendKind = "proactive" | "permission";

const MS_24H = 24 * 60 * 60 * 1000;

function sendsInWindow(state: OlleWorldState, kind: EmailSendKind, sinceMs: number): number {
  const cutoff = Date.now() - sinceMs;
  return (state.emailSends ?? []).filter((s) => s.kind === kind && new Date(s.at).getTime() >= cutoff).length;
}

function lastProactiveSendAt(state: OlleWorldState): number | null {
  const proactive = (state.emailSends ?? [])
    .filter((s) => s.kind === "proactive")
    .map((s) => new Date(s.at).getTime());
  if (!proactive.length) return null;
  return Math.max(...proactive);
}

export function recordEmailSend(state: OlleWorldState, kind: EmailSendKind): void {
  if (!state.emailSends) state.emailSends = [];
  state.emailSends.push({ at: new Date().toISOString(), kind });
  if (state.emailSends.length > 500) state.emailSends = state.emailSends.slice(-500);
}

/** Soft budget for decide masking (plan: 2 proactive / 24h soft). */
export function getEmailBudgetRemaining(state: OlleWorldState): number {
  const sent = sendsInWindow(state, "proactive", MS_24H);
  return Math.max(0, PROACTIVE_SOFT_24H - sent);
}

export interface SendPolicyResult {
  allowed: boolean;
  reason?: string;
}

export function canSendProactiveEmail(state: OlleWorldState, at = new Date()): SendPolicyResult {
  if (isInQuietHours(at)) {
    return { allowed: false, reason: "quiet_hours" };
  }
  const sent24 = sendsInWindow(state, "proactive", MS_24H);
  if (sent24 >= PROACTIVE_HARD_24H) {
    return { allowed: false, reason: "proactive_hard_cap" };
  }
  const last = lastProactiveSendAt(state);
  if (last !== null && at.getTime() - last < MIN_PROACTIVE_GAP_MS) {
    return { allowed: false, reason: "min_gap" };
  }
  if (sent24 >= PROACTIVE_SOFT_24H) {
    return { allowed: false, reason: "proactive_soft_cap" };
  }
  return { allowed: true };
}

/** Permission emails may go out during quiet hours (permission-critical). */
export function canSendPermissionEmail(state: OlleWorldState): SendPolicyResult {
  const sent24 = sendsInWindow(state, "permission", MS_24H);
  if (sent24 >= PERMISSION_CAP_24H) {
    return { allowed: false, reason: "permission_cap" };
  }
  return { allowed: true };
}
