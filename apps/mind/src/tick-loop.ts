import { runMindTick } from "./mind-tick.js";

const intervalMs = Number(process.env.OLLE_TICK_MS ?? 30_000);

async function loop(): Promise<void> {
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

loop();
