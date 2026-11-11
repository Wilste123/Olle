import { ACTION_MANIFEST, getAction, isClassDBlocked, type ActionId, type DecideOutput } from "@olle/protocol";

export function validateDecideOutput(raw: unknown): DecideOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.action_id !== "string" || typeof o.because !== "string") return null;
  if (isClassDBlocked(o.action_id)) return null;
  const def = getAction(o.action_id);
  if (!def) return null;
  const params = (o.params && typeof o.params === "object" ? o.params : {}) as Record<string, unknown>;
  for (const [key, typ] of Object.entries(def.paramsSchema)) {
    if (typ === "optional_string") continue;
    const v = params[key];
    if (typ === "string" && typeof v !== "string") return null;
    if (typ === "number" && typeof v !== "number") return null;
    if (typ === "boolean" && typeof v !== "boolean") return null;
  }
  return {
    action_id: o.action_id as ActionId,
    params,
    because: o.because,
  };
}

export function maskLegalActionIds(options: {
  asleep: boolean;
  openPermissions: number;
  emailBudget: number;
  placementUnplaced: boolean;
}): ActionId[] {
  const blocked = new Set<string>();
  if (options.asleep) {
    for (const a of ACTION_MANIFEST) {
      if (a.id !== "sleep" && a.class !== "A") blocked.add(a.id);
    }
  }
  if (options.openPermissions >= 3) {
    blocked.add("propose_shared_diary_entry");
  }
  if (options.emailBudget <= 0) {
    blocked.add("notify_william");
    blocked.add("email_william");
  }
  // Class C shared diary works while unplaced — only map etc. deferred
  for (const a of ACTION_MANIFEST) {
    if (a.class === "D") blocked.add(a.id);
  }
  return ACTION_MANIFEST.map((a) => a.id).filter((id) => !blocked.has(id)) as ActionId[];
}
