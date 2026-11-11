import type { SenseSnapshot } from "@olle/protocol";
import { SEED_HOBBY_LABELS } from "./engine.js";
import type { LlmProvider } from "../llm/types.js";

/** Pick a low-stakes new hobby label (LLM when OpenAI + key path, else seeded list). */
export async function pickSpawnHobbyLabel(
  provider: LlmProvider,
  sense: SenseSnapshot,
  salient: boolean,
): Promise<string> {
  if (provider.name === "openai" && salient && process.env.OPENAI_API_KEY) {
    const fromLlm = await nameHobbyWithOpenAi(sense);
    if (fromLlm) return fromLlm;
  }
  const pool = SEED_HOBBY_LABELS.filter(
    (l) => !sense.hobbies.some((h) => h.label.toLowerCase() === l.toLowerCase()),
  );
  const choices = pool.length ? pool : [...SEED_HOBBY_LABELS];
  return choices[Math.floor(Math.random() * choices.length)]!;
}

async function nameHobbyWithOpenAi(sense: SenseSnapshot): Promise<string | null> {
  try {
    const { OpenAiProvider } = await import("../llm/openai-provider.js");
    const provider = new OpenAiProvider();
    return await provider.nameHobby({
      placement: sense.placement,
      feelings: sense.feelings,
      existing: sense.hobbies.map((h) => h.label),
    });
  } catch {
    return null;
  }
}
