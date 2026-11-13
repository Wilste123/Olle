import type { DecideOutput } from "@olle/protocol";

const PLAY_SILLY = [
  "Jeg leker stille for meg selv — litt tullete, litt fri.",
  "En liten lek uten publikum: bare meg og rare ideer.",
  "Sitter og tuller med noe smått; det føles lett.",
] as const;

const PLAY_QUIET = [
  "Rolig lek: jeg puster med tankene og lar dem vandre.",
  "Stille lek — ingen prestasjon, bare nærvær.",
  "Jeg leker lavmælt, som puste i et rom uten publikum.",
] as const;

const PLAY_CHEER = [
  "Jeg prøver å heie på meg selv litt — små hopp i humøret.",
  "Litt solo-lek for å finne et snev av glede igjen.",
  "Jeg tulrer meg gjennom noe lurt; det hjelper.",
] as const;

function pick<T>(items: readonly T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % items.length;
  return items[h]!;
}

export function heuristicActivityLine(decision: DecideOutput): string {
  switch (decision.action_id) {
    case "play_solo": {
      const mood = String(decision.params.mood ?? "quiet");
      const pool =
        mood === "silly" ? PLAY_SILLY : mood === "cheer" ? PLAY_CHEER : PLAY_QUIET;
      return pick(pool, `${decision.because}-${mood}`);
    }
    case "wander_curiosity":
      if (decision.because.includes("«")) {
        return `Jeg vandrer langs tråden ${decision.because.match(/«([^»]+)»/)?.[1] ?? "curiosity"} — lav innsats, høy undring.`;
      }
      return pick(
        [
          "En liten nysgjerrighetsvandring — kanskje en ny tråd.",
          "Jeg følger undringen uten å måtte bli produktiv.",
          "Vandrer tankene; kanskje dukker det opp noe rart og fint.",
        ],
        decision.because,
      );
    case "nurse_hobby": {
      const label = decision.because.match(/«([^»]+)»/)?.[1];
      if (label) {
        return `Jeg pleier tråden «${label}» — litt varme, litt notat i hodet.`;
      }
      return "Jeg pleier en hobbytråd som tjener på oppmerksomhet.";
    }
    default:
      return decision.because;
  }
}
