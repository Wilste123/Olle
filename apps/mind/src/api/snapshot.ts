import type { HobbyThread } from "@olle/protocol";
import type { OlleWorldState } from "../world/store.js";
import { inventorySummary } from "../survival/inventory.js";
import { loudestHobbies } from "../hobbies/engine.js";
import { getEmailBudgetRemaining } from "../email/rate-limits.js";
import { countUnreadFromWilliam } from "../conversation/messages.js";
import { countUnprocessedInbound } from "../inbound/offering.js";

export interface NowSnapshot {
  at: string;
  placement: OlleWorldState["placement"];
  tickCount: number;
  feelings: OlleWorldState["feelings"];
  lastActivity: string;
  emailBudgetRemaining: number;
  pendingPermissions: OlleWorldState["permissions"];
  sharedDiaryQueue: OlleWorldState["sharedDiaryQueue"];
  inboundPending: number;
  memories: OlleWorldState["memories"];
  outboxTail: OlleWorldState["outbox"];
  unreadFromWilliam: number;
  conversationTail: OlleWorldState["conversation"];
  doing: string;
  hobbies: HobbyThread[];
  survival: OlleWorldState["survival"];
  purse: OlleWorldState["purse"];
  inventorySummary: string;
}

export function buildNowSnapshot(state: OlleWorldState): NowSnapshot {
  return {
    at: new Date().toISOString(),
    placement: state.placement,
    tickCount: state.tickCount,
    feelings: state.feelings,
    lastActivity: state.lastActivity,
    emailBudgetRemaining: getEmailBudgetRemaining(state),
    pendingPermissions: state.permissions.filter((p) => p.status === "pending"),
    sharedDiaryQueue: state.sharedDiaryQueue,
    inboundPending: countUnprocessedInbound(state),
    memories: state.memories.slice(-12),
    outboxTail: state.outbox.slice(-5),
    unreadFromWilliam: countUnreadFromWilliam(state),
    conversationTail: (state.conversation ?? []).slice(-8),
    doing: state.lastActivity,
    hobbies: loudestHobbies(state, 8),
    survival: state.survival,
    purse: state.purse,
    inventorySummary: inventorySummary(state),
  };
}

export function buildFeedSnapshot(state: OlleWorldState, limit = 40) {
  return state.feed.slice(-limit);
}

export function buildAuditSnapshot(state: OlleWorldState, limit = 80) {
  const permKinds = new Set([
    "permission_requested",
    "granted",
    "denied",
    "permission_expired",
    "executed",
    "execution_failed",
    "email_suppressed",
    "inbound_offering",
  ]);
  return state.audit.filter((a) => permKinds.has(a.kind)).slice(-limit);
}
