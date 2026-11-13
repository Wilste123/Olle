/** Where Olle exists in the physical world (future). Unplaced = mind-only life. */
export type Placement =
  | { status: "unplaced" }
  | { status: "placed"; label: string; note?: string };

export type ActionClass = "A" | "B" | "C" | "D";

/** Persistent interest thread (Pino-style loudest threads / obsessions). */
export interface HobbyThread {
  id: string;
  label: string;
  heat: number;
  last_touched: string;
  notes: string[];
}

export const HOBBY_MAX = 8;
export const HOBBY_MIN_BEFORE_EVICT = 5;

export type InventoryKind = "food" | "trinket" | "craft";

export interface InventoryItem {
  id: string;
  kind: InventoryKind;
  label: string;
  qty: number;
  acquired_at: string;
  source: string;
  hunger_delta?: number;
}

export interface SurvivalState {
  hunger: number;
  last_meal_at?: string;
}

export interface PurseState {
  coins: number;
  lifetime_earned: number;
}

export interface SupplyListing {
  id: string;
  label: string;
  price: number;
  hunger_delta: number;
  kind: InventoryKind;
}

/** Static internal supply — no map economy yet. */
export const SUPPLY_CATALOG: readonly SupplyListing[] = [
  { id: "crispbread", label: "Crispbread", price: 2, hunger_delta: -0.28, kind: "food" },
  { id: "apple", label: "Apple", price: 3, hunger_delta: -0.35, kind: "food" },
  { id: "cheese_bit", label: "Cheese bit", price: 4, hunger_delta: -0.4, kind: "food" },
  { id: "notebook", label: "Tiny notebook", price: 5, hunger_delta: 0, kind: "craft" },
] as const;

export interface ActionDefinition {
  id: string;
  class: ActionClass;
  description: string;
  paramsSchema: Record<string, "string" | "number" | "boolean" | "optional_string">;
}

/** Typed action manifest — Phase 0 (no map / Class D blocked at runtime). */
export const ACTION_MANIFEST: readonly ActionDefinition[] = [
  {
    id: "continue_activity",
    class: "A",
    description: "Keep current internal activity",
    paramsSchema: {},
  },
  {
    id: "feel_and_note",
    class: "A",
    description: "Private mood journal line",
    paramsSchema: { line: "string" },
  },
  {
    id: "rest",
    class: "A",
    description: "Lower energy drain, recover",
    paramsSchema: { minutes: "number" },
  },
  {
    id: "think_about",
    class: "A",
    description: "Advance an internal thread",
    paramsSchema: { topic: "string" },
  },
  {
    id: "reflect_on",
    class: "A",
    description: "Revisit a topic and sharpen a private opinion",
    paramsSchema: { topic: "string" },
  },
  {
    id: "remember",
    class: "A",
    description: "Strengthen or weaken a memory slot",
    paramsSchema: { key: "string", delta: "number" },
  },
  {
    id: "read_world",
    class: "A",
    description: "Refresh read-only world observers",
    paramsSchema: {},
  },
  {
    id: "nurse_hobby",
    class: "A",
    description: "Deepen a hobby thread; private diary note",
    paramsSchema: { hobby_id: "string" },
  },
  {
    id: "wander_curiosity",
    class: "A",
    description: "Follow curiosity on a random or new hobby thread",
    paramsSchema: { hobby_id: "optional_string", spawn_label: "optional_string" },
  },
  {
    id: "research_topic",
    class: "A",
    description: "Read the internet (HTTPS GET); pass url or paste https link in chat (query optional with search API)",
    paramsSchema: { query: "optional_string", url: "optional_string" },
  },
  {
    id: "play_solo",
    class: "A",
    description: "Short playful private moment; lowers expression need",
    paramsSchema: { mood: "optional_string" },
  },
  {
    id: "eat",
    class: "A",
    description: "Eat food from inventory",
    paramsSchema: { item_id: "string" },
  },
  {
    id: "forage",
    class: "A",
    description: "Low-stakes search for scraps (seeded loot)",
    paramsSchema: {},
  },
  {
    id: "buy_from_supply",
    class: "A",
    description: "Spend coins on supply catalog item",
    paramsSchema: { supply_id: "string" },
  },
  {
    id: "craft_expression",
    class: "A",
    description: "Make a small creative artifact (inventory craft item)",
    paramsSchema: { title: "optional_string" },
  },
  {
    id: "ask_william_for",
    class: "B",
    description: "Ask William for help (food, coins, company) via conversation",
    paramsSchema: { need: "string", note: "optional_string" },
  },
  {
    id: "append_private_diary",
    class: "B",
    description: "Append to Olle's private diary (William can read)",
    paramsSchema: { line: "string" },
  },
  {
    id: "notify_william",
    class: "B",
    description: "Queue a proactive note to William (email when configured)",
    paramsSchema: { subject: "string", body: "string" },
  },
  {
    id: "reply_to_william",
    class: "B",
    description: "Reply in the conversation thread (dashboard); speak generates text",
    paramsSchema: { in_reply_to: "optional_string" },
  },
  {
    id: "email_william",
    class: "B",
    description: "Send William an email reply (rate-limited; use after conversation reply optional)",
    paramsSchema: { subject: "string", body: "string" },
  },
  {
    id: "propose_shared_diary_entry",
    class: "C",
    description: "Propose a shared diary entry (requires permission)",
    paramsSchema: { title: "string", body: "string" },
  },
  {
    id: "draft_email",
    class: "A",
    description: "Save unsent email in outbox",
    paramsSchema: { subject: "string", body: "string" },
  },
  {
    id: "sleep",
    class: "A",
    description: "Enter sleep state for consolidation",
    paramsSchema: {},
  },
  {
    id: "add_map_pin",
    class: "D",
    description: "Blocked — map deferred",
    paramsSchema: { title: "string", lat: "number", lng: "number" },
  },
  {
    id: "spawn_infinite_food",
    class: "D",
    description: "Blocked — survival cheating",
    paramsSchema: {},
  },
  {
    id: "print_money",
    class: "D",
    description: "Blocked — economy cheating",
    paramsSchema: {},
  },
] as const;

export type ActionId = (typeof ACTION_MANIFEST)[number]["id"];

export interface DecideOutput {
  action_id: ActionId;
  params: Record<string, unknown>;
  because: string;
}

export interface FeelingsNeeds {
  rest: number;
  curiosity: number;
  social: number;
  expression: number;
  quiet: number;
  /** Pino-adjacent: appetite for novelty / the web. */
  wonder: number;
  joy: number;
  comfort: number;
  /** Light mirror of survival.hunger (higher = hungrier). */
  sustenance: number;
}

export interface FeelingsState {
  mood: number;
  energy: number;
  needs: FeelingsNeeds;
  asleep: boolean;
  /** 2–3 labels refreshed each tick from thresholds. */
  feelingWords: string[];
  /** Bond toward William (0–1), slow drift on warm chat. */
  affection: number;
}

export interface Opinion {
  topic: string;
  stance: string;
  confidence: number;
  because: string;
  sources: string[];
  at: string;
}

export interface OpinionView {
  topic: string;
  stance: string;
  confidence: number;
}

export interface SenseSnapshot {
  at: string;
  olleDay: number;
  placement: Placement;
  feelings: FeelingsState;
  /** Loudest hobby labels for decide context (legacy name: threads). */
  threads: string[];
  hobbies: HobbyThread[];
  ticksSinceLastPrivateDiary: number;
  emailBudgetRemaining: number;
  openPermissionCount: number;
  recentFeedTail: string[];
  inboundSinceLastTick: number;
  unreadFromWilliam: number;
  williamMessagePreview?: string;
  williamMessageText?: string;
  survival: SurvivalState;
  purse: PurseState;
  inventory: InventoryItem[];
  inventorySummary: string;
  webFetchesRemaining: number;
  /** Strongest private stances for decide context (Class B display on dashboard). */
  topOpinions: OpinionView[];
}

export interface PermissionRequestRecord {
  id: string;
  action_id: ActionId;
  params: Record<string, unknown>;
  status: "pending" | "granted" | "denied" | "expired";
  created_at: string;
  expires_at: string;
  resolved_at?: string;
}

export const PERMISSION_TTL_MS = 72 * 60 * 60 * 1000;

export function getAction(id: string): ActionDefinition | undefined {
  return ACTION_MANIFEST.find((a) => a.id === id);
}

export function actionsForClass(klass: ActionClass): ActionDefinition[] {
  return ACTION_MANIFEST.filter((a) => a.class === klass);
}

export function isClassDBlocked(id: string): boolean {
  const a = getAction(id);
  return a?.class === "D";
}
