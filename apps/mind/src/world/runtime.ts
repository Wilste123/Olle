import { getAction, isClassDBlocked, type DecideOutput } from "@olle/protocol";
import { validateDecideOutput } from "../decide/schema.js";
import type { EmailAdapter } from "../email/adapter.js";
import { enterSleep, tickFeelings, wake } from "../feelings/simulator.js";
import {
  appendPinoFeed,
  createPermissionRequest,
  type OlleWorldState,
  type SharedDiaryEntry,
} from "./store.js";

export interface WorldValidation {
  ok: boolean;
  rejectReason?: string;
}

export interface WorldActResult {
  ok: boolean;
  rejectReason?: string;
  permissionId?: string;
  /** Prose-dependent effects run after speak */
  pendingSpeakKind?: "private_diary" | "notify_william" | "permission_note";
}

/** World/runtime: validate typed action before mutations (Pino FX). */
export function validateAct(state: OlleWorldState, decision: DecideOutput): WorldValidation {
  if (!validateDecideOutput(decision)) {
    return { ok: false, rejectReason: "Decision failed schema validation" };
  }
  if (isClassDBlocked(decision.action_id)) {
    return { ok: false, rejectReason: "Class D action blocked by world policy" };
  }
  const def = getAction(decision.action_id);
  if (!def) return { ok: false, rejectReason: "Unknown action_id" };

  if (state.feelings.asleep && decision.action_id !== "sleep") {
    return { ok: false, rejectReason: "Asleep — only sleep action allowed" };
  }

  if (decision.action_id === "notify_william") {
    const budget = 2; // sense mirrors this; world enforces
    if (budget <= 0) return { ok: false, rejectReason: "Email budget exhausted" };
  }

  if (decision.action_id === "propose_shared_diary_entry") {
    if (state.permissions.filter((p) => p.status === "pending").length >= 3) {
      return { ok: false, rejectReason: "Too many open permission requests" };
    }
  }

  return { ok: true };
}

/** Apply structural world effects — no speak/LLM text here. */
export async function applyAct(
  state: OlleWorldState,
  decision: DecideOutput,
  validation: WorldValidation,
  email: EmailAdapter,
): Promise<WorldActResult> {
  if (!validation.ok) {
    return { ok: false, rejectReason: validation.rejectReason };
  }

  const { action_id, params } = decision;

  switch (action_id) {
    case "continue_activity":
      state.lastActivity = "continuing";
      break;
    case "feel_and_note":
      state.lastActivity = "feeling";
      return { ok: true, pendingSpeakKind: "private_diary" };
    case "rest":
      state.feelings = tickFeelings(state.feelings, {
        events: [],
        deltaSec: Number(params.minutes ?? 1) * 60,
        wasResting: true,
      });
      state.lastActivity = "resting";
      break;
    case "think_about":
      state.lastActivity = `thinking: ${String(params.topic ?? "")}`;
      break;
    case "remember":
      state.lastActivity = "remembering";
      break;
    case "read_world":
      appendPinoFeed(state, "noticed", "Refreshed shared world observers", {
        why: decision.because,
        ok: true,
        action_id,
      });
      state.lastActivity = "observing";
      break;
    case "append_private_diary":
      state.lastActivity = "diary";
      return { ok: true, pendingSpeakKind: "private_diary" };
    case "notify_william":
      state.lastActivity = "notifying";
      return { ok: true, pendingSpeakKind: "notify_william" };
    case "draft_email":
      state.outbox.push({
        subject: String(params.subject ?? ""),
        body: "(draft — speak pending)",
        at: new Date().toISOString(),
      });
      state.lastActivity = "drafting";
      break;
    case "propose_shared_diary_entry": {
      const req = createPermissionRequest(state, action_id, params);
      const pending: SharedDiaryEntry = {
        id: `sde-${req.id}`,
        title: String(params.title ?? ""),
        body: String(params.body ?? ""),
        status: "pending",
        request_id: req.id,
        created_at: new Date().toISOString(),
      };
      state.sharedDiaryQueue.push(pending);
      await email.sendPermissionRequest(req);
      state.lastActivity = "awaiting_permission";
      return { ok: true, permissionId: req.id, pendingSpeakKind: "permission_note" };
    }
    case "sleep":
      if (state.feelings.asleep) {
        state.feelings = wake(state.feelings);
        state.lastActivity = "awake";
      } else {
        state.feelings = enterSleep(state.feelings);
        state.lastActivity = "sleeping";
      }
      break;
    default:
      return { ok: false, rejectReason: `No world handler for ${action_id}` };
  }

  return { ok: true };
}

/** Post-speak: apply prose-dependent outcomes after mind generated voice. */
export async function finalizeAct(
  state: OlleWorldState,
  decision: DecideOutput,
  act: WorldActResult,
  spoke: string,
  email: EmailAdapter,
): Promise<void> {
  if (!act.ok || !act.pendingSpeakKind) return;

  switch (act.pendingSpeakKind) {
    case "private_diary": {
      const line =
        spoke.trim() || String(decision.params.line ?? decision.because);
      state.privateDiary.push(line);
      appendPinoFeed(state, "did", line, {
        why: decision.because,
        ok: true,
        action_id: decision.action_id,
        change: "private_diary",
      });
      break;
    }
    case "notify_william": {
      const subject = String(decision.params.subject ?? "[Olle]");
      const body = spoke.trim() || String(decision.params.body ?? "");
      state.outbox.push({ subject, body, at: new Date().toISOString() });
      await email.send({
        to: process.env.WILLIAM_EMAIL ?? "william@example.com",
        subject,
        body,
      });
      appendPinoFeed(state, "did", subject, {
        why: decision.because,
        ok: true,
        action_id: decision.action_id,
        about: "william",
        change: "email_sent",
      });
      break;
    }
    case "permission_note":
      appendPinoFeed(state, "mind", spoke || `Permission requested: ${act.permissionId}`, {
        why: decision.because,
        ok: true,
        action_id: decision.action_id,
        about: "shared_diary",
      });
      break;
  }
}

export function executeGrantedPermission(state: OlleWorldState, requestId: string): boolean {
  const p = state.permissions.find((x) => x.id === requestId);
  if (!p || p.status !== "granted") return false;

  if (p.action_id === "propose_shared_diary_entry") {
    const entry = state.sharedDiaryQueue.find((e) => e.request_id === requestId);
    if (entry) entry.status = "published";
    appendPinoFeed(state, "did", `Published: ${entry?.title ?? requestId}`, {
      ok: true,
      action_id: p.action_id,
      change: "shared_diary",
    });
    return true;
  }
  return false;
}
