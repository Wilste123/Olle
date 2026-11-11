import type { DecideOutput } from "@olle/protocol";
import { validateDecideOutput } from "../decide/schema.js";

/** Extract JSON object from model text (markdown fences tolerated). */
export function parseDecideJson(text: string): DecideOutput | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  try {
    return validateDecideOutput(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function parseSpeakText(text: string): string {
  return text.trim().replace(/^["']|["']$/g, "");
}
