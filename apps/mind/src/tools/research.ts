import { bumpHobby, loudestHobbies } from "../hobbies/engine.js";
import type { OlleWorldState } from "../world/store.js";
import { searchWeb } from "./web-search.js";
import { fetchHttpsPage } from "./web-fetch.js";
import { recordWebFetch, webFetchesRemaining } from "./web-rate.js";
import { latestResearchUrlFromWilliam } from "./research-url.js";

export interface ResearchBundle {
  query?: string;
  url: string;
  title?: string;
  excerpt: string;
  truncated?: boolean;
}

export async function runResearchTopic(
  state: OlleWorldState,
  params: { query?: string; url?: string },
): Promise<{ ok: boolean; reason?: string; bundle?: ResearchBundle }> {
  if (webFetchesRemaining(state) <= 0) {
    return { ok: false, reason: "Daily web fetch limit reached" };
  }

  const query = String(params.query ?? "").trim();
  const directUrl = String(params.url ?? "").trim();

  let targetUrl = directUrl || latestResearchUrlFromWilliam(state);
  let title: string | undefined;

  if (!targetUrl && query) {
    const hit = await searchWeb(query);
    if (hit) {
      targetUrl = hit.url;
      title = hit.title;
    }
  }

  if (!targetUrl) {
    if (query && !process.env.BRAVE_SEARCH_API_KEY && !process.env.TAVILY_API_KEY) {
      return { ok: false, reason: "No URL — paste an https link in chat or set a search API (optional)" };
    }
    return { ok: false, reason: "Need https url (params or William's message) or searchable query" };
  }

  const page = await fetchHttpsPage(targetUrl);
  recordWebFetch(state, targetUrl);

  if (!page.ok || !page.text) {
    return { ok: false, reason: page.error ?? "Fetch failed" };
  }

  const excerpt = page.text.slice(0, 4000);
  state.lastResearch = {
    query: query || undefined,
    url: page.url,
    title,
    excerpt,
    truncated: page.truncated,
    at: new Date().toISOString(),
  };

  const hot = loudestHobbies(state, 1)[0];
  if (hot) {
    bumpHobby(state, hot.id, 0.1, `research: ${query || page.url}`);
  }

  state.feelings.needs.curiosity = Math.max(0, state.feelings.needs.curiosity - 0.12);

  return {
    ok: true,
    bundle: {
      query: query || undefined,
      url: page.url,
      title,
      excerpt,
      truncated: page.truncated,
    },
  };
}
