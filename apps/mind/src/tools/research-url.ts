const HTTPS_IN_TEXT =
  /https:\/\/[^\s<>"')\]]+/gi;

/** First https URL in text (trim trailing punctuation). */
export function extractHttpsUrl(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const matches = text.match(HTTPS_IN_TEXT);
  if (!matches?.length) return undefined;
  return stripTrailingPunctuation(matches[0]!);
}

export function latestResearchUrlFromWilliam(state: {
  conversation?: { from: string; text: string; read_by_olle?: boolean }[];
}): string | undefined {
  const unread = (state.conversation ?? []).filter((m) => m.from === "william" && !m.read_by_olle);
  for (let i = unread.length - 1; i >= 0; i--) {
    const url = extractHttpsUrl(unread[i]!.text);
    if (url) return url;
  }
  const lastWilliam = (state.conversation ?? []).filter((m) => m.from === "william").at(-1);
  return extractHttpsUrl(lastWilliam?.text);
}

function stripTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)]+$/, "");
}
