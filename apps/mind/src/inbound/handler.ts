import { parsePermissionReply } from "../permission/parser.js";
import { processPermissionReply } from "../permission/inbound.js";
import { isAllowedInboundSender } from "../permission/inbound.js";
import { loadState, saveState } from "../world/store.js";
import { appendWilliamMessage } from "../conversation/messages.js";
import { enqueueInboundOffering } from "./offering.js";

export interface InboundPayload {
  from: string;
  text: string;
  subject?: string;
}

export async function handleInboundEmail(
  payload: InboundPayload,
): Promise<{ ok: boolean; message: string; kind?: string }> {
  if (!isAllowedInboundSender(payload.from)) {
    return { ok: false, message: `Sender not allow-listed: ${payload.from}` };
  }

  const permission = parsePermissionReply(payload.text);
  if (permission) {
    const result = await processPermissionReply(payload.from, payload.text);
    return { ...result, kind: "permission_reply" };
  }

  const state = await loadState();
  const body = payload.text;
  appendWilliamMessage(state, body, "email");
  const offering = enqueueInboundOffering(state, {
    from: payload.from,
    subject: payload.subject ?? "",
    text: body,
  });
  await saveState(state);
  return {
    ok: true,
    message: `Queued offering ${offering.id}`,
    kind: "offering",
  };
}
