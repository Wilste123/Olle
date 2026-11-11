import type { DecideOutput, SenseSnapshot } from "@olle/protocol";
import { createLlmProvider } from "../llm/factory.js";
import { buildDecideContext, runDecide, shouldDecideBeSalient } from "../llm/run.js";

/** @deprecated Prefer createLlmProvider + runDecide from mind-tick. */
export async function decide(
  sense: SenseSnapshot,
  opts?: { lastActivity?: string; tickCount?: number; memorySnippets?: string[] },
): Promise<DecideOutput> {
  const provider = createLlmProvider();
  const ctx = buildDecideContext(sense, opts?.memorySnippets ?? []);
  const salient = shouldDecideBeSalient(
    sense,
    opts?.lastActivity ?? "idle",
    opts?.tickCount ?? 0,
  );
  const result = await runDecide(provider, ctx, { salient });
  return result.output;
}
