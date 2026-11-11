import { getAction, isClassDBlocked, type DecideOutput } from "@olle/protocol";
import { validateDecideOutput } from "../decide/schema.js";
import type { EmailAdapter } from "../email/adapter.js";
import { bumpAffectionTowardWilliam } from "../feelings/affection.js";
import { applyNeedDelta, enterSleep, tickFeelings, wake } from "../feelings/simulator.js";
import {
  canSendPermissionEmail,
  canSendProactiveEmail,
  getEmailBudgetRemaining,
  recordEmailSend,
} from "../email/rate-limits.js";
import { appendOlleReply, markWilliamMessagesRead } from "../conversation/messages.js";
import type { SenseSnapshot } from "@olle/protocol";
import { createLlmProvider } from "../llm/factory.js";
import {
  bumpHobby,
  ensureHobbies,
  hobbyLabelsForSense,
  pickRandomHobby,
  recordPrivateDiaryTick,
  spawnHobby,
  ticksSinceLastPrivateDiary,
} from "../hobbies/engine.js";
import { pickSpawnHobbyLabel } from "../hobbies/naming.js";
import { runResearchTopic } from "../tools/research.js";
import { latestResearchUrlFromWilliam } from "../tools/research-url.js";
import { webFetchesRemaining } from "../tools/web-rate.js";
import { applyMeal } from "../survival/hunger.js";
import {
  buyFromSupply,
  canBuyFromSupply,
  consumeItem,
  ensureSurvivalState,
  findInventoryItem,
  foodInInventory,
  grantItem,
  inventorySummary,
  rollForageLoot,
} from "../survival/inventory.js";
import {
  appendAudit,
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
  pendingSpeakKind?:
    | "private_diary"
    | "notify_william"
    | "email_william"
    | "reply_to_william"
    | "permission_note"
    | "ask_william";
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

  if (decision.action_id === "notify_william" || decision.action_id === "email_william") {
    if (getEmailBudgetRemaining(state) <= 0) {
      return { ok: false, rejectReason: "Email budget exhausted" };
    }
    const policy = canSendProactiveEmail(state);
    if (!policy.allowed) {
      return { ok: false, rejectReason: `Email blocked: ${policy.reason}` };
    }
  }

  if (decision.action_id === "reply_to_william") {
    const unread = (state.conversation ?? []).some((m) => m.from === "william" && !m.read_by_olle);
    if (!unread) {
      return { ok: false, rejectReason: "No unread message from William" };
    }
  }

  if (decision.action_id === "propose_shared_diary_entry") {
    if (state.permissions.filter((p) => p.status === "pending").length >= 3) {
      return { ok: false, rejectReason: "Too many open permission requests" };
    }
  }

  ensureSurvivalState(state);

  if (decision.action_id === "eat") {
    const item = findInventoryItem(state, String(decision.params.item_id ?? ""));
    if (!item || item.qty < 1) {
      return { ok: false, rejectReason: "No such item in inventory" };
    }
    if (item.kind !== "food") {
      return { ok: false, rejectReason: "That item is not food" };
    }
  }

  if (decision.action_id === "buy_from_supply") {
    const can = canBuyFromSupply(state, String(decision.params.supply_id ?? ""));
    if (!can.ok) return { ok: false, rejectReason: can.reason ?? "Cannot buy" };
  }

  if (decision.action_id === "research_topic") {
    if (webFetchesRemaining(state) <= 0) {
      return { ok: false, rejectReason: "Daily web fetch limit reached" };
    }
    const q = String(decision.params.query ?? "").trim();
    const u = String(decision.params.url ?? "").trim();
    const fromWilliam = latestResearchUrlFromWilliam(state);
    if (!q && !u && !fromWilliam) {
      return { ok: false, rejectReason: "research_topic needs https url or query" };
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
    case "nurse_hobby": {
      ensureHobbies(state);
      const hobbyId = String(params.hobby_id ?? "");
      const hobby = state.hobbies.find((h) => h.id === hobbyId) ?? loudestOrRandom(state);
      if (!hobby) {
        return { ok: false, rejectReason: "No hobby to nurse" };
      }
      bumpHobby(state, hobby.id, 0.12);
      applyNeedDelta(state.feelings, { curiosity: -0.08, wonder: -0.05 });
      state.lastActivity = `nursing: ${hobby.label}`;
      return { ok: true, pendingSpeakKind: "private_diary" };
    }
    case "wander_curiosity": {
      ensureHobbies(state);
      let hobby = state.hobbies.find((h) => h.id === String(params.hobby_id ?? ""));
      if (!hobby && params.spawn_label) {
        hobby = spawnHobby(state, String(params.spawn_label));
      }
      if (!hobby) {
        hobby = pickRandomHobby(state);
      }
      if (!hobby) {
        const sense = hobbySenseFromState(state);
        const label = await pickSpawnHobbyLabel(createLlmProvider(), sense, true);
        hobby = spawnHobby(state, label);
      }
      bumpHobby(state, hobby.id, 0.1);
      applyNeedDelta(state.feelings, { curiosity: -0.1, wonder: -0.08 });
      state.lastActivity = `wandering: ${hobby.label}`;
      return { ok: true, pendingSpeakKind: "private_diary" };
    }
    case "research_topic": {
      const research = await runResearchTopic(state, {
        query: params.query ? String(params.query) : undefined,
        url: params.url ? String(params.url) : undefined,
      });
      if (!research.ok) {
        return { ok: false, rejectReason: research.reason ?? "Research failed" };
      }
      state.lastActivity = `research: ${research.bundle?.url ?? "web"}`;
      return { ok: true, pendingSpeakKind: "private_diary" };
    }
    case "play_solo":
      applyNeedDelta(state.feelings, { expression: -0.22, joy: 0.18, wonder: -0.05 });
      state.feelings.mood = Math.min(1, state.feelings.mood + 0.05);
      state.lastActivity = `playing solo${params.mood ? `: ${String(params.mood)}` : ""}`;
      return { ok: true, pendingSpeakKind: "private_diary" };
    case "eat": {
      ensureSurvivalState(state);
      const itemId = String(params.item_id ?? foodInInventory(state)?.id ?? "");
      const eaten = consumeItem(state, itemId, 1);
      if (!eaten || eaten.kind !== "food") {
        return { ok: false, rejectReason: "Could not eat" };
      }
      const delta = eaten.hunger_delta ?? -0.25;
      applyMeal(state, delta);
      applyNeedDelta(state.feelings, { comfort: 0.15, sustenance: delta, joy: 0.05 });
      state.lastActivity = `eating: ${eaten.label}`;
      appendPinoFeed(state, "did", `Ate ${eaten.label}`, {
        ok: true,
        action_id,
        change: "ate",
      });
      break;
    }
    case "forage": {
      ensureSurvivalState(state);
      const loot = rollForageLoot(state.tickCount, state.lastActivity);
      state.lastActivity = "foraging";
      if (!loot) {
        appendPinoFeed(state, "noticed", "Foraged — nothing edible", { ok: true, action_id });
        break;
      }
      if (loot.hunger_delta < 0) {
        grantItem(state, loot.label, {
          kind: "food",
          hunger_delta: loot.hunger_delta,
          source: "forage",
        });
        appendPinoFeed(state, "did", `Found ${loot.label}`, { ok: true, action_id, change: "forage" });
      } else {
        grantItem(state, loot.label, { kind: "trinket", source: "forage" });
        appendPinoFeed(state, "noticed", `Found ${loot.label} (not food)`, { ok: true, action_id });
      }
      break;
    }
    case "buy_from_supply": {
      ensureSurvivalState(state);
      const buy = buyFromSupply(state, String(params.supply_id ?? "crispbread"));
      if (!buy.ok) return { ok: false, rejectReason: buy.reason };
      state.lastActivity = `bought: ${buy.item?.label ?? "supply"}`;
      appendPinoFeed(state, "did", `Bought ${buy.item?.label}`, {
        ok: true,
        action_id,
        change: "buy",
      });
      break;
    }
    case "craft_expression": {
      ensureSurvivalState(state);
      const title = String(params.title ?? "small making").slice(0, 80);
      grantItem(state, title, { kind: "craft", source: "craft" });
      state.feelings.needs.expression = Math.max(0, state.feelings.needs.expression - 0.15);
      ensureHobbies(state);
      const hot = loudestOrRandom(state);
      if (hot) bumpHobby(state, hot.id, 0.08, `crafted: ${title}`);
      state.lastActivity = `crafting: ${title}`;
      return { ok: true, pendingSpeakKind: "private_diary" };
    }
    case "ask_william_for":
      state.lastActivity = `asking William: ${String(params.need ?? "help")}`;
      state.feelings.needs.social = Math.max(0, state.feelings.needs.social - 0.05);
      return { ok: true, pendingSpeakKind: "ask_william" };
    case "notify_william":
      state.lastActivity = "notifying";
      return { ok: true, pendingSpeakKind: "notify_william" };
    case "reply_to_william":
      state.lastActivity = "replying";
      return { ok: true, pendingSpeakKind: "reply_to_william" };
    case "email_william":
      state.lastActivity = "emailing";
      return { ok: true, pendingSpeakKind: "email_william" };
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
      const permPolicy = canSendPermissionEmail(state);
      if (permPolicy.allowed) {
        await email.sendPermissionRequest(req);
        recordEmailSend(state, "permission");
      } else {
        appendAudit(state, "email_suppressed", {
          request_id: req.id,
          kind: "permission",
          reason: permPolicy.reason,
        });
        appendPinoFeed(state, "noticed", `Permission email suppressed: ${permPolicy.reason}`, {
          ok: false,
          about: "permission",
        });
      }
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
      recordPrivateDiaryTick(state);
      if (decision.action_id === "research_topic" && state.lastResearch) {
        const hot = loudestOrRandom(state);
        if (hot) bumpHobby(state, hot.id, 0.06, line.slice(0, 280));
      }
      appendPinoFeed(state, "did", line, {
        why: decision.because,
        ok: true,
        action_id: decision.action_id,
        change: decision.action_id === "research_topic" ? "research_diary" : "private_diary",
      });
      break;
    }
    case "notify_william": {
      const subject = String(decision.params.subject ?? "[Olle]");
      const body = spoke.trim() || String(decision.params.body ?? "");
      state.outbox.push({ subject, body, at: new Date().toISOString() });
      const policy = canSendProactiveEmail(state);
      if (!policy.allowed) {
        appendAudit(state, "email_suppressed", { kind: "proactive", reason: policy.reason, subject });
        appendPinoFeed(state, "noticed", `Proactive email suppressed: ${policy.reason}`, {
          ok: false,
          about: "william",
        });
        break;
      }
      await email.send({
        to: process.env.WILLIAM_EMAIL ?? "william@example.com",
        subject,
        body,
      });
      recordEmailSend(state, "proactive");
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
    case "reply_to_william": {
      const replyText = spoke.trim() || decision.because;
      const inReplyTo = String(decision.params.in_reply_to ?? "");
      const lastUnread = (state.conversation ?? [])
        .filter((m) => m.from === "william" && !m.read_by_olle)
        .at(-1);
      appendOlleReply(state, replyText, inReplyTo || lastUnread?.id);
      markWilliamMessagesRead(state);
      bumpAffectionTowardWilliam(state, 0.04);
      appendPinoFeed(state, "did", replyText, {
        why: decision.because,
        ok: true,
        action_id: decision.action_id,
        about: "conversation",
        change: "reply",
      });
      break;
    }
    case "ask_william": {
      const need = String(decision.params.need ?? "something");
      const text = spoke.trim() || `William — could you help with ${need}?`;
      appendOlleReply(state, text);
      appendPinoFeed(state, "did", text, {
        why: decision.because,
        ok: true,
        action_id: decision.action_id,
        about: "william",
        change: "ask",
      });
      const policy = canSendProactiveEmail(state);
      if (policy.allowed && getEmailBudgetRemaining(state) > 0) {
        await email.send({
          to: process.env.WILLIAM_EMAIL ?? "william@example.com",
          subject: `[Olle] asking about ${need}`,
          body: text,
        });
        recordEmailSend(state, "proactive");
      }
      break;
    }
    case "email_william": {
      const subject = String(decision.params.subject ?? "[Olle]");
      const body = spoke.trim() || String(decision.params.body ?? "");
      state.outbox.push({ subject, body, at: new Date().toISOString() });
      const policy = canSendProactiveEmail(state);
      if (!policy.allowed) {
        appendAudit(state, "email_suppressed", { kind: "proactive", reason: policy.reason, subject });
        appendPinoFeed(state, "noticed", `Email to William suppressed: ${policy.reason}`, {
          ok: false,
          about: "william",
        });
        break;
      }
      await email.send({
        to: process.env.WILLIAM_EMAIL ?? "william@example.com",
        subject,
        body,
      });
      recordEmailSend(state, "proactive");
      appendPinoFeed(state, "did", subject, {
        why: decision.because,
        ok: true,
        action_id: decision.action_id,
        about: "william",
        change: "email_sent",
      });
      break;
    }
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

function loudestOrRandom(state: OlleWorldState) {
  ensureHobbies(state);
  const sorted = [...state.hobbies].sort((a, b) => b.heat - a.heat);
  return sorted[0] ?? pickRandomHobby(state);
}

function hobbySenseFromState(state: OlleWorldState): SenseSnapshot {
  ensureHobbies(state);
  return {
    at: new Date().toISOString(),
    olleDay: state.olleDay,
    placement: state.placement,
    feelings: state.feelings,
    threads: hobbyLabelsForSense(state),
    hobbies: state.hobbies,
    ticksSinceLastPrivateDiary: ticksSinceLastPrivateDiary(state),
    emailBudgetRemaining: getEmailBudgetRemaining(state),
    openPermissionCount: state.permissions.filter((p) => p.status === "pending").length,
    recentFeedTail: state.feed.slice(-5).map((f) => f.text),
    inboundSinceLastTick: 0,
    unreadFromWilliam: 0,
    survival: state.survival,
    purse: state.purse,
    inventory: state.inventory,
    inventorySummary: inventorySummary(state),
    webFetchesRemaining: webFetchesRemaining(state),
  };
}
