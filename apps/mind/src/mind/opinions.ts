import type { Opinion } from "@olle/protocol";
import type { OlleWorldState } from "../world/store.js";

export type { Opinion };

export type ImpressionSourceKind = "research" | "think" | "exhibition" | "reflect";

export interface IngestImpressionInput {
  topic: string;
  excerpt?: string;
  title?: string;
  sources?: string[];
  because?: string;
  diaryLine?: string;
  sourceKind: ImpressionSourceKind;
}

const MAX_OPINIONS = 48;

export function slugTopic(raw: string): string {
  const t = raw.trim().toLowerCase().slice(0, 120);
  return t.replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/[\s-]+/g, " ").trim() || "noe";
}

export function normalizeOpinionConfidence(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function heuristicStance(input: IngestImpressionInput): { stance: string; because: string; confidence: number } {
  const topic = input.topic.trim() || "dette";
  const excerpt = (input.excerpt ?? input.diaryLine ?? "").trim();
  const title = (input.title ?? "").trim();
  const head = (title || excerpt || topic).slice(0, 160);

  let stance: string;
  if (input.sourceKind === "research") {
    if (/[?？]\s*$/.test(head) || /\b(whether|if|maybe|kanskje)\b/i.test(head)) {
      stance = `Usikker ennå, men nysgjerrig på ${topic}.`;
    } else if (/\b(not|never|ingen|false|myth)\b/i.test(head)) {
      stance = `Skeptisk til påstander om ${topic} — må lese mer.`;
    } else {
      stance = `Det virker plausibelt at ${topic} handler om: ${head.slice(0, 80)}…`;
    }
  } else if (input.sourceKind === "exhibition") {
    stance = `Utstillinga om «${topic}» satte spor — jeg kjenner at det betyr noe for meg.`;
  } else if (input.diaryLine && input.diaryLine.length > 12) {
    stance = input.diaryLine.slice(0, 200);
  } else {
    stance = `Jeg har begynt å tenke på ${topic} — ennå utydelig ståsted.`;
  }

  const because =
    input.because?.trim() ||
    (input.sourceKind === "research"
      ? "Etter nettlesing"
      : input.sourceKind === "exhibition"
        ? "Etter utstilling"
        : "Etter indre refleksjon");

  const base =
    input.sourceKind === "research" ? 0.42 : input.sourceKind === "exhibition" ? 0.48 : 0.38;
  const confidence = normalizeOpinionConfidence(base + (excerpt.length > 400 ? 0.06 : 0));

  return { stance, because, confidence };
}

export function upsertOpinion(state: OlleWorldState, next: Opinion): Opinion {
  state.opinions ??= [];
  const key = slugTopic(next.topic);
  const idx = state.opinions.findIndex((o) => slugTopic(o.topic) === key);
  const at = new Date().toISOString();

  if (idx >= 0) {
    const prev = state.opinions[idx]!;
    const merged: Opinion = {
      topic: prev.topic.length >= next.topic.length ? prev.topic : next.topic,
      stance: next.confidence >= prev.confidence ? next.stance : prev.stance,
      confidence: normalizeOpinionConfidence(Math.max(prev.confidence, next.confidence) + 0.06),
      because: next.because || prev.because,
      sources: [...new Set([...prev.sources, ...next.sources])].slice(-12),
      at,
    };
    state.opinions[idx] = merged;
    trimOpinions(state);
    return merged;
  }

  const inserted: Opinion = {
    ...next,
    confidence: normalizeOpinionConfidence(next.confidence),
    at,
  };
  state.opinions.push(inserted);
  trimOpinions(state);
  return inserted;
}

function trimOpinions(state: OlleWorldState): void {
  if ((state.opinions?.length ?? 0) <= MAX_OPINIONS) return;
  state.opinions = [...state.opinions].sort((a, b) => b.confidence - a.confidence).slice(0, MAX_OPINIONS);
}

/** Turn a fresh impression into a private opinion (heuristic; no extra LLM). */
export function ingestImpression(state: OlleWorldState, input: IngestImpressionInput): Opinion {
  const { stance, because, confidence } = heuristicStance(input);
  const sources = [...new Set(input.sources ?? [])];
  if (input.title) sources.push(input.title.slice(0, 120));
  return upsertOpinion(state, {
    topic: input.topic.trim() || "noe",
    stance,
    confidence,
    because,
    sources: sources.slice(0, 8),
    at: new Date().toISOString(),
  });
}

export function topOpinionsByConfidence(state: OlleWorldState, limit = 5): Opinion[] {
  return [...(state.opinions ?? [])].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

export function opinionLinesForMemory(state: OlleWorldState, limit = 5): string[] {
  return topOpinionsByConfidence(state, limit).map(
    (o) => `Mening (${o.topic}): ${o.stance} [${o.confidence.toFixed(2)}]`,
  );
}

export interface ExhibitionStub {
  id: string;
  title: string;
  blurb: string;
  active?: boolean;
}

/** Called after speak finalize for impression-bearing actions. */
export function ingestImpressionFromAction(
  state: OlleWorldState,
  actionId: string,
  params: Record<string, unknown>,
  diaryLine: string,
): Opinion | null {
  switch (actionId) {
    case "research_topic": {
      const lr = state.lastResearch;
      if (!lr) return null;
      const topic = lr.query?.trim() || lr.title?.trim() || lr.url;
      return ingestImpression(state, {
        topic,
        title: lr.title,
        excerpt: lr.excerpt,
        sources: [lr.url],
        because: String(params.query ?? "") ? "research_topic query" : "research_topic url",
        diaryLine,
        sourceKind: "research",
      });
    }
    case "think_about":
    case "reflect_on": {
      const topic = String(params.topic ?? "the day");
      return ingestImpression(state, {
        topic,
        diaryLine,
        because: actionId,
        sourceKind: actionId === "reflect_on" ? "reflect" : "think",
      });
    }
    case "visit_exhibition": {
      const ex = findExhibitionForIngest(state, String(params.exhibition_id ?? ""));
      if (!ex) return null;
      return ingestImpression(state, {
        topic: ex.title,
        excerpt: ex.blurb,
        title: ex.title,
        sources: [`exhibition:${ex.id}`],
        because: "visit_exhibition",
        diaryLine,
        sourceKind: "exhibition",
      });
    }
    default:
      return null;
  }
}

function findExhibitionForIngest(
  state: OlleWorldState,
  id: string,
): ExhibitionStub | undefined {
  const list = state.exhibitions as ExhibitionStub[] | undefined;
  if (!list?.length) return undefined;
  const ex = list.find((e) => e.id === id);
  if (!ex || ex.active === false) return undefined;
  return ex;
}
