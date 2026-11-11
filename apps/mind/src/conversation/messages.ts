import { randomBytes } from "node:crypto";
import type { ConversationMessage, MessageChannel, OlleWorldState } from "../world/store.js";
import { appendPinoFeed } from "../world/store.js";

export type { ConversationMessage, MessageChannel };

const CONVERSATION_CAP = 200;

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export function appendWilliamMessage(
  state: OlleWorldState,
  text: string,
  channel: MessageChannel,
): ConversationMessage {
  if (!state.conversation) state.conversation = [];
  const msg: ConversationMessage = {
    id: newId("wm"),
    from: "william",
    text: text.trim(),
    at: new Date().toISOString(),
    channel,
    read_by_olle: false,
  };
  state.conversation.push(msg);
  trimConversation(state);
  appendPinoFeed(state, "noticed", `William (${channel}): ${msg.text.slice(0, 80)}`, {
    ok: true,
    about: "conversation",
    meta: { message_id: msg.id },
  });
  return msg;
}

export function appendOlleReply(
  state: OlleWorldState,
  text: string,
  inReplyTo?: string,
): ConversationMessage {
  if (!state.conversation) state.conversation = [];
  const msg: ConversationMessage = {
    id: newId("om"),
    from: "olle",
    text: text.trim(),
    at: new Date().toISOString(),
    channel: "dashboard",
    in_reply_to: inReplyTo,
  };
  state.conversation.push(msg);
  trimConversation(state);
  return msg;
}

function trimConversation(state: OlleWorldState): void {
  if (state.conversation.length > CONVERSATION_CAP) {
    state.conversation = state.conversation.slice(-CONVERSATION_CAP);
  }
}

export function countUnreadFromWilliam(state: OlleWorldState): number {
  return (state.conversation ?? []).filter((m) => m.from === "william" && !m.read_by_olle).length;
}

export function williamUnreadSinceLastTick(state: OlleWorldState): number {
  const since = state.lastTickAt ? new Date(state.lastTickAt).getTime() : 0;
  return (state.conversation ?? []).filter(
    (m) => m.from === "william" && !m.read_by_olle && new Date(m.at).getTime() > since,
  ).length;
}

export function latestUnreadWilliamPreview(state: OlleWorldState): string | undefined {
  const unread = (state.conversation ?? []).filter((m) => m.from === "william" && !m.read_by_olle);
  const last = unread[unread.length - 1];
  return last?.text.slice(0, 200);
}

export function markWilliamMessagesRead(state: OlleWorldState): void {
  for (const m of state.conversation ?? []) {
    if (m.from === "william" && !m.read_by_olle) m.read_by_olle = true;
  }
}

export function conversationForApi(state: OlleWorldState, limit = 80): ConversationMessage[] {
  return (state.conversation ?? []).slice(-limit);
}
