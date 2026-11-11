import type { InventoryItem, SupplyListing } from "@olle/protocol";
import { SUPPLY_CATALOG } from "@olle/protocol";
import type { OlleWorldState } from "../world/store.js";

export function ensureSurvivalState(state: OlleWorldState): void {
  if (!state.inventory) state.inventory = [];
  if (!state.purse) state.purse = { coins: 3, lifetime_earned: 3 };
  if (!state.survival) {
    state.survival = { hunger: 0.35, last_meal_at: undefined };
  }
}

export function grantCoins(state: OlleWorldState, amount: number): number {
  ensureSurvivalState(state);
  const n = Math.max(0, Math.floor(amount));
  state.purse.coins += n;
  state.purse.lifetime_earned += n;
  return state.purse.coins;
}

export function grantItem(
  state: OlleWorldState,
  label: string,
  opts?: { kind?: InventoryItem["kind"]; hunger_delta?: number; qty?: number; source?: string },
): InventoryItem {
  ensureSurvivalState(state);
  const qty = opts?.qty ?? 1;
  const kind = opts?.kind ?? "food";
  const existing = state.inventory.find(
    (i) => i.label.toLowerCase() === label.toLowerCase() && i.kind === kind,
  );
  if (existing) {
    existing.qty += qty;
    return existing;
  }
  const item: InventoryItem = {
    id: `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    label,
    qty,
    acquired_at: new Date().toISOString(),
    source: opts?.source ?? "grant",
    hunger_delta: opts?.hunger_delta ?? (kind === "food" ? -0.3 : undefined),
  };
  state.inventory.push(item);
  return item;
}

export function findInventoryItem(state: OlleWorldState, itemId: string): InventoryItem | undefined {
  ensureSurvivalState(state);
  return state.inventory.find((i) => i.id === itemId);
}

export function consumeItem(state: OlleWorldState, itemId: string, qty = 1): InventoryItem | null {
  const item = findInventoryItem(state, itemId);
  if (!item || item.qty < qty) return null;
  item.qty -= qty;
  if (item.qty <= 0) {
    state.inventory = state.inventory.filter((i) => i.id !== itemId);
  }
  return item;
}

export function foodInInventory(state: OlleWorldState): InventoryItem | undefined {
  ensureSurvivalState(state);
  return state.inventory.find((i) => i.kind === "food" && i.qty > 0);
}

export function getSupplyListing(supplyId: string): SupplyListing | undefined {
  return SUPPLY_CATALOG.find((s) => s.id === supplyId);
}

export function canBuyFromSupply(state: OlleWorldState, supplyId: string): { ok: boolean; reason?: string } {
  ensureSurvivalState(state);
  const listing = getSupplyListing(supplyId);
  if (!listing) return { ok: false, reason: "Unknown supply item" };
  if (state.purse.coins < listing.price) return { ok: false, reason: "Not enough coins" };
  return { ok: true };
}

export function buyFromSupply(state: OlleWorldState, supplyId: string): { ok: boolean; reason?: string; item?: InventoryItem } {
  ensureSurvivalState(state);
  const listing = getSupplyListing(supplyId);
  if (!listing) return { ok: false, reason: "Unknown supply item" };
  if (state.purse.coins < listing.price) return { ok: false, reason: "Not enough coins" };
  state.purse.coins -= listing.price;
  const item = grantItem(state, listing.label, {
    kind: listing.kind,
    hunger_delta: listing.hunger_delta,
    qty: 1,
    source: `buy:${listing.id}`,
  });
  return { ok: true, item };
}

/** Seeded loot roll — deterministic from tick + id salt. */
export function rollForageLoot(tickCount: number, salt: string): { label: string; hunger_delta: number } | null {
  const h = hashSeed(`${tickCount}:${salt}`);
  if (h % 100 > 42) return null;
  const table = [
    { label: "a dusty nut", hunger_delta: -0.12 },
    { label: "half a biscuit", hunger_delta: -0.18 },
    { label: "interesting pebble (not food)", hunger_delta: 0 },
    { label: "dried berry", hunger_delta: -0.22 },
  ];
  const pick = table[h % table.length]!;
  if (pick.hunger_delta === 0) {
    return { label: pick.label, hunger_delta: 0 };
  }
  return pick;
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function inventorySummary(state: OlleWorldState): string {
  ensureSurvivalState(state);
  if (state.inventory.length === 0) return "(empty)";
  return state.inventory.map((i) => `${i.label}×${i.qty}`).join(", ");
}
