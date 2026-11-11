import { AnthropicProvider } from "./anthropic-provider.js";
import { HeuristicProvider } from "./heuristic-provider.js";
import { OpenAiStubProvider } from "./openai-stub.js";
import type { LlmProvider } from "./types.js";

export function resolveLlmProviderName(): "anthropic" | "heuristic" | "openai" {
  const explicit = process.env.OLLE_LLM_PROVIDER?.toLowerCase();
  if (explicit === "heuristic" || explicit === "anthropic" || explicit === "openai") {
    return explicit;
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "heuristic";
}

export function createLlmProvider(): LlmProvider {
  const name = resolveLlmProviderName();
  switch (name) {
    case "anthropic":
      return new AnthropicProvider();
    case "openai":
      return new OpenAiStubProvider();
    default:
      return new HeuristicProvider();
  }
}
