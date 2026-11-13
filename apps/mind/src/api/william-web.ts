import { addExhibition } from "../world/exhibitions.js";
import { enqueueWebOffering } from "../inbound/web-offering.js";
import { appendAudit, loadState, saveState } from "../world/store.js";

export async function postWilliamOffering(input: {
  text: string;
  gift_label?: string;
}): Promise<{ ok: boolean; error?: string; offeringId?: string }> {
  const text = String(input.text ?? "").trim();
  if (!text) return { ok: false, error: "text required" };
  const state = await loadState();
  const offering = enqueueWebOffering(state, {
    text,
    gift_label: input.gift_label,
  });
  await saveState(state);
  return { ok: true, offeringId: offering.id };
}

export async function postWilliamExhibition(input: {
  title: string;
  blurb: string;
  url?: string;
}): Promise<{ ok: boolean; error?: string; exhibition?: { id: string; title: string } }> {
  const title = String(input.title ?? "").trim();
  const blurb = String(input.blurb ?? "").trim();
  if (!title || !blurb) return { ok: false, error: "title and blurb required" };
  const state = await loadState();
  const exhibition = addExhibition(state, {
    title,
    blurb,
    url: input.url ? String(input.url) : undefined,
  });
  appendAudit(state, "exhibition_added", { id: exhibition.id, title: exhibition.title });
  await saveState(state);
  return { ok: true, exhibition: { id: exhibition.id, title: exhibition.title } };
}
