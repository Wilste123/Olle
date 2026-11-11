#!/usr/bin/env node
import { loadOlleEnv } from "./env.js";
loadOlleEnv();

import { appendWilliamMessage } from "./conversation/messages.js";
import { executeGrantedPermission } from "./act/executor.js";
import { grantCoins, grantItem } from "./survival/inventory.js";
import { loadState, resolvePermission, saveState } from "./world/store.js";
import { runMindTick } from "./mind-tick.js";

const [, , cmd, sub, arg] = process.argv;

async function main(): Promise<void> {
  if (cmd === "tick") {
    const r = await runMindTick();
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  if (cmd === "permit" && sub === "approve" && arg) {
    const state = await loadState();
    const p = resolvePermission(state, arg, "granted");
    if (!p) {
      console.error(`No pending request: ${arg}`);
      process.exit(1);
    }
    executeGrantedPermission(state, arg);
    await saveState(state);
    console.log(`Approved ${arg}`);
    return;
  }

  if (cmd === "permit" && sub === "deny" && arg) {
    const state = await loadState();
    const p = resolvePermission(state, arg, "denied");
    if (!p) {
      console.error(`No pending request: ${arg}`);
      process.exit(1);
    }
    await saveState(state);
    console.log(`Denied ${arg}`);
    return;
  }

  if (cmd === "say") {
    const text = process.argv.slice(3).join(" ").trim() || (sub ?? "").trim();
    if (!text) {
      console.error("Usage: olle say <message>");
      process.exit(1);
    }
    const state = await loadState();
    const msg = appendWilliamMessage(state, text, "cli");
    await saveState(state);
    console.log(`Queued for Olle: ${msg.id}`);
    return;
  }

  if (cmd === "grant" && sub === "item" && arg) {
    const state = await loadState();
    const item = grantItem(state, arg, { kind: "food", source: "william_grant" });
    await saveState(state);
    console.log(`Granted ${item.label} (${item.id}) qty ${item.qty}`);
    return;
  }

  if (cmd === "grant" && sub === "coins" && arg) {
    const n = Number(arg);
    if (!Number.isFinite(n) || n < 0) {
      console.error("Usage: olle grant coins <n>");
      process.exit(1);
    }
    const state = await loadState();
    const total = grantCoins(state, n);
    await saveState(state);
    console.log(`Coins now: ${total}`);
    return;
  }

  if (cmd === "status") {
    const state = await loadState();
    console.log(
      JSON.stringify(
        {
          placement: state.placement,
          tickCount: state.tickCount,
          feelings: state.feelings,
          pendingPermissions: state.permissions.filter((p) => p.status === "pending"),
          sharedDiaryQueue: state.sharedDiaryQueue,
          feedTail: state.feed.slice(-8),
          conversationTail: (state.conversation ?? []).slice(-6),
          unreadFromWilliam: (state.conversation ?? []).filter(
            (m) => m.from === "william" && !m.read_by_olle,
          ).length,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Olle mind CLI (Phase 1)

Usage:
  olle tick
  olle say <message>
  olle permit approve <request-id>
  olle permit deny <request-id>
  olle grant item <label>
  olle grant coins <n>
  olle status

Live Olle: npm start (from repo root)
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
