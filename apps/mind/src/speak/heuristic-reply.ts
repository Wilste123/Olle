import type { FeelingsState } from "@olle/protocol";

/** Natural Norwegian chat lines for heuristic reply_to_william — no “William wrote” echo. */
export function heuristicReplyToWilliam(
  williamMessageText: string | undefined,
  _feelings: FeelingsState,
): string {
  const t = (williamMessageText ?? "").trim();
  const lower = t.toLowerCase();

  if (!t) {
    return "Hei William! Jeg er her.";
  }

  if (/^(hei|hallo|morn|yo)\b|god\s*(morgen|kveld|natt)/i.test(lower)) {
    return "Hei! Hyggelig å høre fra deg — jeg er her.";
  }

  if (lower.includes("?")) {
    return "Godt spørsmål. Jeg må tenke litt, men jeg er glad du spurte.";
  }

  if (lower.includes("takk") || lower.includes("thanks")) {
    return "Bare hyggelig. Si fra hvis du trenger meg.";
  }

  if (t.length <= 80) {
    return "Fint at du skrev. Jeg er her med deg.";
  }

  return "Takk for meldingen — jeg leser og er her.";
}
