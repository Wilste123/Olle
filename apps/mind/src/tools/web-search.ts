/** Optional search providers → HTTPS URLs only (no page POST). */

export interface SearchHit {
  url: string;
  title?: string;
}

export async function searchWeb(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SearchHit | null> {
  const q = query.trim();
  if (!q) return null;

  if (process.env.BRAVE_SEARCH_API_KEY) {
    const hit = await braveSearch(q, fetchImpl);
    if (hit) return hit;
  }
  if (process.env.TAVILY_API_KEY) {
    const hit = await tavilySearch(q, fetchImpl);
    if (hit) return hit;
  }
  return null;
}

async function braveSearch(query: string, fetchImpl: typeof fetch): Promise<SearchHit | null> {
  const key = process.env.BRAVE_SEARCH_API_KEY!;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`;
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      web?: { results?: { url?: string; title?: string }[] };
    };
    const first = data.web?.results?.find((r) => r.url?.startsWith("https://"));
    if (!first?.url) return null;
    return { url: first.url, title: first.title };
  } catch {
    return null;
  }
}

/** POST is limited to Tavily's search API — not arbitrary sites. */
async function tavilySearch(query: string, fetchImpl: typeof fetch): Promise<SearchHit | null> {
  const key = process.env.TAVILY_API_KEY!;
  try {
    const res = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        max_results: 3,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: { url?: string; title?: string }[];
    };
    const first = data.results?.find((r) => r.url?.startsWith("https://"));
    if (!first?.url) return null;
    return { url: first.url, title: first.title };
  } catch {
    return null;
  }
}
