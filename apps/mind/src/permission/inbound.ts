import { parsePermissionReply } from "./parser.js";
import { executeGrantedPermission } from "../world/runtime.js";
import {
  appendPinoFeed,
  loadState,
  resolvePermission,
  saveState,
  type OlleWorldState,
} from "../world/store.js";

export function isAllowedInboundSender(from: string): boolean {
  const raw = process.env.OLLE_INBOUND_ALLOWLIST ?? process.env.WILLIAM_EMAIL ?? "";
  if (!raw) return false;
  const allowed = raw.split(",").map((s) => s.trim().toLowerCase());
  const email = from.replace(/^.*<([^>]+)>.*$/, "$1").trim().toLowerCase();
  return allowed.includes(email);
}

function applyEditOverrides(state: OlleWorldState, id: string, overrides: Record<string, string>): void {
  const p = state.permissions.find((x) => x.id === id);
  if (!p) return;
  p.params = { ...p.params, ...overrides };
  const entry = state.sharedDiaryQueue.find((e) => e.request_id === id);
  if (entry) {
    if (overrides.title) entry.title = overrides.title;
    if (overrides.body) entry.body = overrides.body;
  }
}

export async function processPermissionReply(
  from: string,
  text: string,
): Promise<{ ok: boolean; message: string }> {
  if (!isAllowedInboundSender(from)) {
    return { ok: false, message: `Sender not allow-listed: ${from}` };
  }

  const reply = parsePermissionReply(text);
  if (!reply) {
    return { ok: false, message: "No YES/NO/EDIT permission reply recognized in first line" };
  }

  const state = await loadState();

  if (reply.type === "edit") {
    applyEditOverrides(state, reply.id, reply.overrides);
    const p = resolvePermission(state, reply.id, "granted");
    if (!p) {
      return { ok: false, message: `No pending request: ${reply.id}` };
    }
    executeGrantedPermission(state, reply.id);
    appendPinoFeed(state, "did", `Permission edited+approved: ${reply.id}`, {
      ok: true,
      about: "permission",
      change: "granted",
    });
    await saveState(state);
    return { ok: true, message: `Edited and approved ${reply.id}` };
  }

  if (reply.type === "approve") {
    const p = resolvePermission(state, reply.id, "granted");
    if (!p) {
      return { ok: false, message: `No pending request: ${reply.id}` };
    }
    executeGrantedPermission(state, reply.id);
    appendPinoFeed(state, "did", `Permission approved via email: ${reply.id}`, {
      ok: true,
      about: "permission",
      change: "granted",
    });
    await saveState(state);
    return { ok: true, message: `Approved ${reply.id}` };
  }

  const p = resolvePermission(state, reply.id, "denied");
  if (!p) {
    return { ok: false, message: `No pending request: ${reply.id}` };
  }
  appendPinoFeed(state, "did", `Permission denied via email: ${reply.id}`, {
    ok: true,
    about: "permission",
    change: "denied",
  });
  await saveState(state);
  return { ok: true, message: `Denied ${reply.id}` };
}
