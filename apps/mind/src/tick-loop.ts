import { loadOlleEnv } from "./env.js";
import { runMindTick } from "./mind-tick.js";

loadOlleEnv();

const intervalMs = Number(process.env.OLLE_TICK_MS ?? 30_000);

export async function startTickLoop(): Promise<void> {
  console.log(`[olle-mind] tick loop every ${intervalMs}ms`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const r = await runMindTick();
      console.log(
        JSON.stringify(
          {
            asleep: r.asleep ?? false,
            action: r.decision?.action_id,
            because: r.decision?.because,
            spoke: r.spoke,
            permissionId: r.permissionId,
          },
          null,
          2,
        ),
      );
    } catch (e) {
      console.error("tick error", e);
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
}

const isMain =
  process.argv[1]?.endsWith("tick-loop.ts") || process.argv[1]?.endsWith("tick-loop.js");

if (isMain) {
  startTickLoop();
}
