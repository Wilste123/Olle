import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  FeelingsState,
  HobbyThread,
  InventoryItem,
  PermissionRequestRecord,
  Placement,
  PurseState,
  SurvivalState,
} from "@olle/protocol";
import { ensureSurvivalState } from "../survival/inventory.js";
import { normalizeFeelings } from "../feelings/normalize.js";
import { PERMISSION_TTL_MS } from "@olle/protocol";
import { cozyDefaultExhibitions, type Exhibition } from "./exhibitions.js";
import { DEFAULT_PLACE_ID, ensurePlacement } from "./places.js";
import type { WebOffering } from "../inbound/web-offering.js";

/** Pino-style feed kinds. */
export type PinoFeedKind = "did" | "noticed" | "felt" | "mind";

export interface FeedEntry {
  at: string;
  kind: PinoFeedKind | string;
  text: string;
  why?: string;
  ok?: boolean;
  about?: string;
  change?: string;
  action_id?: string;
  meta?: Record<string, unknown>;
}

export interface SharedDiaryEntry {
  id: string;
  title: string;
  body: string;
  status: "pending" | "published";
  request_id?: string;
  created_at: string;
}

export interface InboundOffering {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  text: string;
  received_at: string;
  processed_at?: string;
}

export interface MemorySlot {
  key: string;
  text: string;
  strength: number;
  updated_at: string;
  source?: string;
}

export interface EmailSendRecord {
  at: string;
  kind: "proactive" | "permission";
}

export type MessageChannel = "dashboard" | "cli" | "email";

export interface ConversationMessage {
  id: string;
  from: "william" | "olle";
  text: string;
  at: string;
  channel: MessageChannel;
  read_by_olle?: boolean;
  in_reply_to?: string;
}

export type { Exhibition };

export interface OlleWorldState {
  version: 1 | 2 | 3 | 4 | 5;
  placement: Placement;
  olleDay: number;
  feelings: FeelingsState;
  privateDiary: string[];
  sharedDiaryQueue: SharedDiaryEntry[];
  feed: FeedEntry[];
  permissions: PermissionRequestRecord[];
  outbox: { subject: string; body: string; at: string }[];
  audit: { at: string; kind: string; detail: Record<string, unknown> }[];
  inboundQueue: InboundOffering[];
  memories: MemorySlot[];
  emailSends: EmailSendRecord[];
  conversation: ConversationMessage[];
  lastTickAt?: string;
  lastActivity: string;
  lastDecisionActionId?: string;
  tickCount: number;
  hobbies: HobbyThread[];
  lastPrivateDiaryTick?: number;
  survival: SurvivalState;
  purse: PurseState;
  inventory: InventoryItem[];
  researchFetches?: { at: string; day: string; url: string }[];
  lastResearch?: {
    query?: string;
    url: string;
    title?: string;
    excerpt: string;
    truncated?: boolean;
    at: string;
  };
  exhibitions?: Exhibition[];
  webOfferings?: WebOffering[];
  lastVisitedExhibitionId?: string;
  lastVisitedExhibitionAt?: string;
}

const defaultPlaced = () => ({
  status: "placed" as const,
  place_id: DEFAULT_PLACE_ID,
  since: new Date().toISOString(),
});

const DEFAULT_STATE = (): OlleWorldState => ({
  version: 5,
  placement: defaultPlaced(),
  olleDay: 0,
  feelings: normalizeFeelings(undefined),
  privateDiary: [],
  sharedDiaryQueue: [],
  feed: [],
  permissions: [],
  outbox: [],
  audit: [],
  inboundQueue: [],
  memories: [],
  emailSends: [],
  conversation: [],
  lastActivity: "idle",
  tickCount: 0,
  hobbies: [],
  survival: { hunger: 0.35 },
  purse: { coins: 3, lifetime_earned: 3 },
  inventory: [],
  exhibitions: cozyDefaultExhibitions(),
  webOfferings: [],
});

function migrateState(parsed: Partial<OlleWorldState> & { version?: number }): OlleWorldState {
  const base = {
    ...DEFAULT_STATE(),
    ...parsed,
    inboundQueue: parsed.inboundQueue ?? [],
    memories: parsed.memories ?? [],
    emailSends: parsed.emailSends ?? [],
    conversation: parsed.conversation ?? [],
    lastTickAt: parsed.lastTickAt,
    hobbies: parsed.hobbies ?? [],
    lastPrivateDiaryTick: parsed.lastPrivateDiaryTick,
    survival: parsed.survival ?? { hunger: 0.35 },
    purse: parsed.purse ?? { coins: 3, lifetime_earned: 3 },
    inventory: parsed.inventory ?? [],
    researchFetches: parsed.researchFetches ?? [],
    lastResearch: parsed.lastResearch,
    exhibitions:
      parsed.exhibitions ??
      (parsed.version == null || (parsed.version ?? 1) < 4 ? cozyDefaultExhibitions() : []),
    webOfferings: parsed.webOfferings ?? [],
    lastVisitedExhibitionId: parsed.lastVisitedExhibitionId,
    lastVisitedExhibitionAt: parsed.lastVisitedExhibitionAt,
  } as OlleWorldState;
  base.feelings = normalizeFeelings(parsed.feelings);
  if ((parsed.version ?? 1) < 2) {
    ensureSurvivalState(base);
  }
  if ((parsed.version ?? 1) < 5) {
    ensurePlacement(base);
  }
  base.version = 5;
  ensureSurvivalState(base);
  ensurePlacement(base);
  return base;
}

export function defaultStatePath(): string {
  return process.env.OLLE_STATE_PATH ?? join(process.cwd(), ".olle-state.json");
}

export async function loadState(path = defaultStatePath()): Promise<OlleWorldState> {
  try {
    const raw = await readFile(path, "utf8");
    return migrateState(JSON.parse(raw) as OlleWorldState);
  } catch {
    return DEFAULT_STATE();
  }
}

export async function saveState(state: OlleWorldState, path = defaultStatePath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2), "utf8");
}

export function appendAudit(
  state: OlleWorldState,
  kind: string,
  detail: Record<string, unknown>,
): void {
  state.audit.push({ at: new Date().toISOString(), kind, detail });
}

export function appendPinoFeed(
  state: OlleWorldState,
  kind: PinoFeedKind,
  text: string,
  fields?: {
    why?: string;
    ok?: boolean;
    about?: string;
    change?: string;
    action_id?: string;
    meta?: Record<string, unknown>;
  },
): void {
  state.feed.push({
    at: new Date().toISOString(),
    kind,
    text,
    why: fields?.why,
    ok: fields?.ok,
    about: fields?.about,
    change: fields?.change,
    action_id: fields?.action_id,
    meta: fields?.meta,
  });
  if (state.feed.length > 200) state.feed = state.feed.slice(-200);
}

/** @deprecated Use appendPinoFeed */
export function appendFeed(
  state: OlleWorldState,
  kind: string,
  text: string,
  meta?: Record<string, unknown>,
): void {
  const pinoKind: PinoFeedKind =
    kind === "tick" || kind === "think" ? "mind" : kind === "feel_note" ? "felt" : "did";
  appendPinoFeed(state, pinoKind, text, { meta, action_id: meta?.action_id as string | undefined });
}

export function createPermissionRequest(
  state: OlleWorldState,
  action_id: string,
  params: Record<string, unknown>,
): PermissionRequestRecord {
  const id = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const req: PermissionRequestRecord = {
    id,
    action_id: action_id as PermissionRequestRecord["action_id"],
    params,
    status: "pending",
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + PERMISSION_TTL_MS).toISOString(),
  };
  state.permissions.push(req);
  appendAudit(state, "permission_requested", { request_id: id, action_id, params });
  return req;
}

export function expireStalePermissions(state: OlleWorldState): void {
  const now = Date.now();
  for (const p of state.permissions) {
    if (p.status === "pending" && new Date(p.expires_at).getTime() <= now) {
      p.status = "expired";
      p.resolved_at = new Date().toISOString();
      appendAudit(state, "permission_expired", { request_id: p.id });
    }
  }
}

export function resolvePermission(
  state: OlleWorldState,
  id: string,
  decision: "granted" | "denied",
): PermissionRequestRecord | null {
  const p = state.permissions.find((x) => x.id === id);
  if (!p || p.status !== "pending") return null;
  p.status = decision;
  p.resolved_at = new Date().toISOString();
  appendAudit(state, decision === "granted" ? "granted" : "denied", { request_id: id });
  return p;
}

export function getOpenPermissionCount(state: OlleWorldState): number {
  return state.permissions.filter((p) => p.status === "pending").length;
}
