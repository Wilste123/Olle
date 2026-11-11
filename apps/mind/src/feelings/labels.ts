import type { FeelingsState } from "@olle/protocol";

/** Pino-style 2–3 mood labels from thresholds (deterministic, no LLM). */
export function deriveFeelingWords(f: FeelingsState): string[] {
  const words: string[] = [];
  if (f.mood > 0.45) words.push("glad");
  else if (f.mood < -0.35) words.push("tung");
  else words.push("rolig");

  if (f.energy < 0.35) words.push("sliten");
  else if (f.energy > 0.75) words.push("våken");

  const n = f.needs;
  if (n.joy > 0.65) words.push("lekende");
  else if (n.wonder > 0.7) words.push("nysgjerrig");
  else if (n.comfort < 0.35) words.push("ubehagelig");
  else if (n.sustenance > 0.65) words.push("sulten");

  return [...new Set(words)].slice(0, 3);
}
