#!/usr/bin/env node
import { executeGrantedPermission } from "./act/executor.js";
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
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Olle mind CLI (Phase 0)

Usage:
  olle tick
  olle permit approve <request-id>
  olle permit deny <request-id>
  olle status

Run loop: npm run tick -w @olle/mind -- (once) or tsx src/tick-loop.ts
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
