/** Where Olle exists in the physical world (future). Unplaced = mind-only life. */
export type Placement =
  | { status: "unplaced" }
  | { status: "placed"; label: string; note?: string };

export type ActionClass = "A" | "B" | "C" | "D";

export interface ActionDefinition {
  id: string;
  class: ActionClass;
  description: string;
  paramsSchema: Record<string, "string" | "number" | "boolean" | "optional_string">;
}

/** Typed action manifest — Phase 0 (no map / Class D blocked at runtime). */
export const ACTION_MANIFEST: readonly ActionDefinition[] = [
  {
    id: "continue_activity",
    class: "A",
    description: "Keep current internal activity",
    paramsSchema: {},
  },
  {
    id: "feel_and_note",
    class: "A",
    description: "Private mood journal line",
    paramsSchema: { line: "string" },
  },
  {
    id: "rest",
    class: "A",
    description: "Lower energy drain, recover",
    paramsSchema: { minutes: "number" },
  },
  {
    id: "think_about",
    class: "A",
    description: "Advance an internal thread",
    paramsSchema: { topic: "string" },
  },
  {
    id: "remember",
    class: "A",
    description: "Strengthen or weaken a memory slot",
    paramsSchema: { key: "string", delta: "number" },
  },
  {
    id: "read_world",
    class: "A",
    description: "Refresh read-only world observers",
    paramsSchema: {},
  },
  {
    id: "append_private_diary",
    class: "B",
    description: "Append to Olle's private diary (William can read)",
    paramsSchema: { line: "string" },
  },
  {
    id: "notify_william",
    class: "B",
    description: "Queue a proactive note to William (email when configured)",
    paramsSchema: { subject: "string", body: "string" },
  },
  {
    id: "reply_to_william",
    class: "B",
    description: "Reply in the conversation thread (dashboard); speak generates text",
    paramsSchema: { in_reply_to: "optional_string" },
  },
  {
    id: "email_william",
    class: "B",
    description: "Send William an email reply (rate-limited; use after conversation reply optional)",
    paramsSchema: { subject: "string", body: "string" },
  },
  {
    id: "propose_shared_diary_entry",
    class: "C",
    description: "Propose a shared diary entry (requires permission)",
    paramsSchema: { title: "string", body: "string" },
  },
  {
    id: "draft_email",
    class: "A",
    description: "Save unsent email in outbox",
    paramsSchema: { subject: "string", body: "string" },
  },
  {
    id: "sleep",
    class: "A",
    description: "Enter sleep state for consolidation",
    paramsSchema: {},
  },
  {
    id: "add_map_pin",
    class: "D",
    description: "Blocked — map deferred",
    paramsSchema: { title: "string", lat: "number", lng: "number" },
  },
] as const;

export type ActionId = (typeof ACTION_MANIFEST)[number]["id"];

export interface DecideOutput {
  action_id: ActionId;
  params: Record<string, unknown>;
  because: string;
}

export interface FeelingsState {
  mood: number;
  energy: number;
  needs: {
    rest: number;
    curiosity: number;
    social: number;
    expression: number;
    quiet: number;
  };
  asleep: boolean;
}

export interface SenseSnapshot {
  at: string;
  olleDay: number;
  placement: Placement;
  feelings: FeelingsState;
  threads: string[];
  emailBudgetRemaining: number;
  openPermissionCount: number;
  recentFeedTail: string[];
  inboundSinceLastTick: number;
  unreadFromWilliam: number;
  williamMessagePreview?: string;
}

export interface PermissionRequestRecord {
  id: string;
  action_id: ActionId;
  params: Record<string, unknown>;
  status: "pending" | "granted" | "denied" | "expired";
  created_at: string;
  expires_at: string;
  resolved_at?: string;
}

export const PERMISSION_TTL_MS = 72 * 60 * 60 * 1000;

export function getAction(id: string): ActionDefinition | undefined {
  return ACTION_MANIFEST.find((a) => a.id === id);
}

export function actionsForClass(klass: ActionClass): ActionDefinition[] {
  return ACTION_MANIFEST.filter((a) => a.class === klass);
}

export function isClassDBlocked(id: string): boolean {
  const a = getAction(id);
  return a?.class === "D";
}
