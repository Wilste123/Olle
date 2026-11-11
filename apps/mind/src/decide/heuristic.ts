import type { DecideOutput, SenseSnapshot } from "@olle/protocol";
import { PRIVATE_DIARY_MIN_TICK_GAP } from "../hobbies/engine.js";
import { extractHttpsUrl } from "../tools/research-url.js";
import { maskLegalActionIds } from "./schema.js";

function hottestHobby(sense: SenseSnapshot) {
  return [...sense.hobbies].sort((a, b) => b.heat - a.heat)[0];
}

function diaryAllowed(sense: SenseSnapshot): boolean {
  return sense.ticksSinceLastPrivateDiary >= PRIVATE_DIARY_MIN_TICK_GAP;
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

  if (sense.feelings.needs.curiosity > 0.48 && legal.includes("wander_curiosity")) {
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
        body: "When you have a moment — still unplaced, but the idea is ready.",
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
