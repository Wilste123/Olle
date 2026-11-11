import type { DecideOutput, SenseSnapshot } from "@olle/protocol";
import { heuristicDecide } from "./heuristic.js";
import { maskLegalActionIds, validateDecideOutput } from "./schema.js";

export async function decide(sense: SenseSnapshot): Promise<DecideOutput> {
  const openai = process.env.OPENAI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (!openai && !anthropic) {
    return heuristicDecide(sense);
  }

  const legal = maskLegalActionIds({
    asleep: sense.feelings.asleep,
    openPermissions: sense.openPermissionCount,
    emailBudget: sense.emailBudgetRemaining,
    placementUnplaced: sense.placement.status === "unplaced",
  });

  const prompt = JSON.stringify({
    task: "Pick one legal action_id with params and because.",
    legal_actions: legal,
    sense,
  });

  try {
    if (openai) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openai}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are Olle's decide step. Output JSON: { action_id, params, because }. Only use legal_actions.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        const parsed = validateDecideOutput(JSON.parse(text));
        if (parsed) return parsed;
      }
    }
  } catch {
    // fall through to heuristic
  }

  return heuristicDecide(sense);
}
