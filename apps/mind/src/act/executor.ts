import { isClassDBlocked, type DecideOutput } from "@olle/protocol";
import type { EmailAdapter } from "../email/adapter.js";
import {
  appendFeed,
  createPermissionRequest,
  type OlleWorldState,
  type SharedDiaryEntry,
} from "../world/store.js";
import { enterSleep, tickFeelings, wake } from "../feelings/simulator.js";

export interface ActResult {
  spoke: string;
  permissionId?: string;
}

export async function executeAction(
  state: OlleWorldState,
  decision: DecideOutput,
  email: EmailAdapter,
): Promise<ActResult> {
  if (isClassDBlocked(decision.action_id)) {
    appendFeed(state, "blocked", `Class D blocked: ${decision.action_id}`);
    return { spoke: "That action is not allowed." };
  }

  const { action_id, params } = decision;

  switch (action_id) {
    case "continue_activity":
      state.lastActivity = "continuing";
      break;
    case "feel_and_note":
      state.privateDiary.push(String(params.line ?? ""));
      appendFeed(state, "feel_note", String(params.line ?? ""));
      break;
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
      appendFeed(state, "think", `Thinking about ${String(params.topic ?? "")}`);
      break;
    case "remember":
      appendFeed(state, "remember", `${params.key}: delta ${params.delta}`);
      break;
    case "read_world":
      appendFeed(state, "read_world", "Observed world (read-only).");
      break;
    case "append_private_diary": {
      const line = String(params.line ?? "");
      state.privateDiary.push(line);
      appendFeed(state, "private_diary", line);
      break;
    }
    case "notify_william": {
      const subject = String(params.subject ?? "");
      const body = String(params.body ?? "");
      state.outbox.push({ subject, body, at: new Date().toISOString() });
      await email.send({ to: process.env.WILLIAM_EMAIL ?? "william@example.com", subject, body });
      appendFeed(state, "notify", subject);
      break;
    }
    case "draft_email": {
      state.outbox.push({
        subject: String(params.subject ?? ""),
        body: String(params.body ?? ""),
        at: new Date().toISOString(),
      });
      break;
    }
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
      return {
        spoke: `Permission requested (${req.id}) for shared diary entry.`,
        permissionId: req.id,
      };
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
      appendFeed(state, "unknown", `No executor for ${action_id}`);
  }

  return { spoke: "" };
}

export function executeGrantedPermission(state: OlleWorldState, requestId: string): boolean {
  const p = state.permissions.find((x) => x.id === requestId);
  if (!p || p.status !== "granted") return false;

  if (p.action_id === "propose_shared_diary_entry") {
    const entry = state.sharedDiaryQueue.find((e) => e.request_id === requestId);
    if (entry) entry.status = "published";
    appendFeed(state, "shared_diary", `Published: ${entry?.title ?? requestId}`);
    return true;
  }
  return false;
}
