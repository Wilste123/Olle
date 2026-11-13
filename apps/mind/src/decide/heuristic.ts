import { getPlace, type DecideOutput, type SenseSnapshot } from "@olle/protocol";
import { PRIVATE_DIARY_MIN_TICK_GAP } from "../hobbies/engine.js";
import { extractHttpsUrl } from "../tools/research-url.js";
import { maskLegalActionIds } from "./schema.js";

function hottestHobby(sense: SenseSnapshot) {
  return [...sense.hobbies].sort((a, b) => b.heat - a.heat)[0];
}

function diaryAllowed(sense: SenseSnapshot): boolean {
  return sense.ticksSinceLastPrivateDiary >= PRIVATE_DIARY_MIN_TICK_GAP;
}

function pickExhibition(sense: SenseSnapshot): { id: string; title: string } | undefined {
  const exs = sense.activeExhibitions ?? [];
  if (!exs.length) return undefined;
  const other = exs.filter((e) => e.id !== sense.lastVisitedExhibitionId);
  const pool = other.length ? other : exs;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickMovementTarget(sense: SenseSnapshot): string | undefined {
  const reach = sense.reachablePlaceIds ?? [];
  if (!reach.length) return undefined;
  const galleries = reach.filter((id) => id.startsWith("gallery_"));
  const bench = reach.includes("quiet_bench") ? "quiet_bench" : undefined;
  const h = hottestHobby(sense);
  if (h && sense.feelings.needs.curiosity > sense.feelings.needs.wonder + 0.05 && galleries.length) {
    const match = galleries.find((g) => h.label.toLowerCase().includes("kart") && g === "gallery_b");
    return match ?? galleries[Math.floor(Math.random() * galleries.length)];
  }
  if (sense.feelings.needs.wonder > 0.58 && galleries.length) {
    return galleries[Math.floor(Math.random() * galleries.length)];
  }
  if (sense.feelings.needs.curiosity > 0.52 && bench) return bench;
  if (galleries.length && Math.random() < 0.5) return galleries[0];
  return reach[Math.floor(Math.random() * reach.length)];
}

function wonderGoToPlaceBranch(
  sense: SenseSnapshot,
  legal: ReturnType<typeof maskLegalActionIds>,
): DecideOutput | null {
  if (sense.placement.status !== "placed") return null;
  if (!legal.includes("go_to_place")) return null;
  const wonder = sense.feelings.needs.wonder > 0.52;
  const curious = sense.feelings.needs.curiosity > 0.48;
  if (!wonder && !curious) return null;
  const at = sense.placeId ?? "";
  if (
    wonder &&
    legal.includes("visit_exhibition") &&
    (sense.activeExhibitions?.length ?? 0) > 0 &&
    sense.feelings.needs.wonder > 0.58
  ) {
    return null;
  }
  if (at === "gallery_a" || at === "gallery_b") return null;
  const target = pickMovementTarget(sense);
  if (!target) return null;
  const label = getPlace(target)?.label ?? target;
  const h = hottestHobby(sense);
  return {
    action_id: "go_to_place",
    params: { place_id: target },
    because: h
      ? `Curiosity tugging at «${h.label}» — walking toward ${label}.`
      : wonder
        ? `Wonder pulls toward ${label}.`
        : `Strolling toward ${label}.`,
  };
}

function wonderOrCuriosityVisitBranch(
  sense: SenseSnapshot,
  legal: ReturnType<typeof maskLegalActionIds>,
): DecideOutput | null {
  const wonderHigh = sense.feelings.needs.wonder > 0.62;
  const curiousWonder =
    sense.feelings.needs.curiosity > 0.55 && sense.feelings.needs.wonder > 0.48;
  if (!wonderHigh && !curiousWonder) return null;

  const canVisit = legal.includes("visit_exhibition") && (sense.activeExhibitions?.length ?? 0) > 0;
  const canWander = legal.includes("wander_curiosity");
  if (!canVisit && !canWander) return null;

  const preferVisit =
    canVisit && (!canWander || Math.random() < 0.5 || (wonderHigh && Math.random() < 0.55));

  if (preferVisit && canVisit) {
    const ex = pickExhibition(sense);
    if (ex) {
      return {
        action_id: "visit_exhibition",
        params: { exhibition_id: ex.id },
        because: wonderHigh
          ? `Wonder is loud — drifting into «${ex.title}».`
          : `Curiosity and wonder — visiting «${ex.title}».`,
      };
    }
  }

  if (canWander) {
    const h = hottestHobby(sense);
    return {
      action_id: "wander_curiosity",
      params: h ? { hobby_id: h.id } : {},
      because: wonderHigh ? "Wonder is loud — wander a thread." : "Curiosity wander (exhibition or thread).",
    };
  }

  return null;
}

/** Dry-run decide without LLM API keys. */
export function heuristicDecide(sense: SenseSnapshot): DecideOutput {
  const legal = maskLegalActionIds({
    asleep: sense.feelings.asleep,
    openPermissions: sense.openPermissionCount,
    emailBudget: sense.emailBudgetRemaining,
    placementUnplaced: sense.placement.status === "unplaced",
    webFetchesRemaining: sense.webFetchesRemaining,
  });

  if (sense.feelings.asleep) {
    return {
      action_id: legal.includes("sleep") ? "sleep" : "continue_activity",
      params: {},
      because: "Asleep — minimal activity.",
    };
  }

  if (sense.feelings.needs.comfort < 0.32 && legal.includes("rest")) {
    return {
      action_id: "rest",
      params: { minutes: 4 },
      because: "Comfort low — resting.",
    };
  }

  if (sense.feelings.energy < 0.35 && legal.includes("rest")) {
    return {
      action_id: "rest",
      params: { minutes: 5 },
      because: "Energy low; resting.",
    };
  }

  const hunger = sense.survival?.hunger ?? 0;
  const foodItem = sense.inventory.find((i) => i.kind === "food" && i.qty > 0);

  if (hunger > 0.68 && foodItem && legal.includes("eat")) {
    return {
      action_id: "eat",
      params: { item_id: foodItem.id },
      because: `Hungry (${hunger.toFixed(2)}) — eating what's on hand.`,
    };
  }

  if (hunger > 0.78 && !foodItem && legal.includes("ask_william_for")) {
    return {
      action_id: "ask_william_for",
      params: { need: "food", note: "empty belly" },
      because: "Very hungry and no food — asking William (not begging, just honest).",
    };
  }

  if (hunger > 0.62 && !foodItem && sense.purse.coins >= 2 && legal.includes("buy_from_supply")) {
    const supply = sense.purse.coins >= 4 ? "cheese_bit" : sense.purse.coins >= 3 ? "apple" : "crispbread";
    return {
      action_id: "buy_from_supply",
      params: { supply_id: supply },
      because: "Hungry — buying from the little supply list.",
    };
  }

  if (hunger > 0.55 && !foodItem && legal.includes("forage")) {
    return {
      action_id: "forage",
      params: {},
      because: "Mild hunger — try foraging before the diary kicks in.",
    };
  }

  const williamUrl =
    extractHttpsUrl(sense.williamMessageText) ?? extractHttpsUrl(sense.williamMessagePreview);

  if (
    williamUrl &&
    sense.webFetchesRemaining > 0 &&
    legal.includes("research_topic")
  ) {
    return {
      action_id: "research_topic",
      params: { url: williamUrl },
      because: `William shared a link — reading ${williamUrl.slice(0, 60)}`,
    };
  }

  if (sense.unreadFromWilliam > 0 && legal.includes("reply_to_william")) {
    return {
      action_id: "reply_to_william",
      params: {},
      because: sense.williamMessagePreview
        ? `William wrote: ${sense.williamMessagePreview.slice(0, 80)}`
        : "William sent a message.",
    };
  }

  if (
    sense.inboundSinceLastTick > 0 &&
    legal.includes("remember")
  ) {
    return {
      action_id: "remember",
      params: { key: "last_william_email", delta: 0.2 },
      because: "William sent something — strengthening memory.",
    };
  }

  if (sense.inboundSinceLastTick > 0 && legal.includes("think_about")) {
    return {
      action_id: "think_about",
      params: { topic: "what William wrote" },
      because: "New inbound email to reflect on.",
    };
  }

  if (
    sense.feelings.needs.expression > 0.55 &&
    legal.includes("play_solo") &&
    sense.feelings.needs.expression > 0.45
  ) {
    return {
      action_id: "play_solo",
      params: { mood: sense.feelings.mood > 0.2 ? "silly" : "quiet" },
      because: "Expression wants play, not another diary line.",
    };
  }

  {
    const walk = wonderGoToPlaceBranch(sense, legal);
    if (walk && Math.random() < 0.38) return walk;
    const branch = wonderOrCuriosityVisitBranch(sense, legal);
    if (branch) return branch;
  }

  if (
    sense.feelings.needs.wonder > 0.55 &&
    sense.feelings.needs.joy < 0.35 &&
    legal.includes("play_solo")
  ) {
    return {
      action_id: "play_solo",
      params: { mood: "cheer" },
      because: "Low joy — play solo first.",
    };
  }

  if (
    sense.feelings.needs.wonder > 0.58 &&
    sense.webFetchesRemaining > 0 &&
    legal.includes("research_topic") &&
    williamUrl
  ) {
    return {
      action_id: "research_topic",
      params: { url: williamUrl },
      because: "Wonder + a link — reading the web.",
    };
  }

  if (
    sense.feelings.needs.curiosity > 0.72 &&
    sense.webFetchesRemaining > 0 &&
    legal.includes("research_topic")
  ) {
    const fromParams = String(sense.williamMessagePreview ?? "");
    const idleUrl = extractHttpsUrl(fromParams);
    if (idleUrl) {
      return {
        action_id: "research_topic",
        params: { url: idleUrl },
        because: "Curiosity — revisiting a link William mentioned.",
      };
    }
    const h = hottestHobby(sense);
    const hasSearch = Boolean(process.env.BRAVE_SEARCH_API_KEY || process.env.TAVILY_API_KEY);
    if (hasSearch) {
      return {
        action_id: "research_topic",
        params: { query: h?.label ?? "small autonomous companions" },
        because: "Curiosity wants to read the internet (search).",
      };
    }
  }

  if (
    sense.feelings.needs.curiosity > 0.55 &&
    legal.includes("nurse_hobby") &&
    sense.hobbies.length > 0
  ) {
    const h = hottestHobby(sense);
    if (h) {
      return {
        action_id: "nurse_hobby",
        params: { hobby_id: h.id },
        because: `Curiosity pulling at «${h.label}».`,
      };
    }
  }

  if (sense.feelings.needs.curiosity > 0.48) {
    const mildWonder =
      sense.feelings.needs.wonder > 0.42 &&
      legal.includes("visit_exhibition") &&
      (sense.activeExhibitions?.length ?? 0) > 0 &&
      Math.random() < 0.28;
    if (mildWonder) {
      const ex = pickExhibition(sense);
      if (ex) {
        return {
          action_id: "visit_exhibition",
          params: { exhibition_id: ex.id },
          because: `Soft pull toward «${ex.title}».`,
        };
      }
    }
    if (legal.includes("wander_curiosity")) {
      const h = hottestHobby(sense);
      if (h && h.heat < 0.85 && Math.random() > 0.35) {
        return {
          action_id: "wander_curiosity",
          params: { hobby_id: h.id },
          because: `Wandering with the thread «${h.label}».`,
        };
      }
      return {
        action_id: "wander_curiosity",
        params: {},
        because: "Low-stakes curiosity wander (maybe a new hobby).",
      };
    }
  }

  if (
    sense.feelings.needs.expression > 0.72 &&
    legal.includes("append_private_diary") &&
    diaryAllowed(sense)
  ) {
    return {
      action_id: "append_private_diary",
      params: {
        line: `Quiet tick on day ${sense.olleDay}. Mood ${sense.feelings.mood.toFixed(2)}.`,
      },
      because: "Expression need high (diary gap ok).",
    };
  }

  if (
    sense.feelings.needs.social > 0.65 &&
    sense.emailBudgetRemaining > 0 &&
    legal.includes("notify_william")
  ) {
    return {
      action_id: "notify_william",
      params: {
        subject: "[Olle] thinking of you",
        body: "Small check-in from the mind loop (mock email — no API key).",
      },
      because: "Social need nudged a notify.",
    };
  }

  if (
    sense.feelings.needs.curiosity > 0.75 &&
    legal.includes("propose_shared_diary_entry") &&
    sense.openPermissionCount < 3
  ) {
    return {
      action_id: "propose_shared_diary_entry",
      params: {
        title: "A thought for our shared diary",
        body: "When you have a moment — a small idea for our shared diary.",
      },
      because: "Curiosity wants to propose something shared (needs your YES).",
    };
  }

  if (legal.includes("think_about")) {
    return {
      action_id: "think_about",
      params: { topic: sense.threads[0] ?? "the day ahead" },
      because: "Nothing salient — gentle think.",
    };
  }

  return {
    action_id: "continue_activity",
    params: {},
    because: "Idle continuation.",
  };
}
