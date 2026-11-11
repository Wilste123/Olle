import { appendWilliamMessage, conversationForApi } from "./messages.js";
import { loadState, saveState } from "../world/store.js";

export async function postWilliamMessage(text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Empty message" };
  const state = await loadState();
  const msg = appendWilliamMessage(state, trimmed, "dashboard");
  await saveState(state);
  return { ok: true, id: msg.id };
}

export async function getConversationJson(limit = 80) {
  const state = await loadState();
  return { conversation: conversationForApi(state, limit) };
}
