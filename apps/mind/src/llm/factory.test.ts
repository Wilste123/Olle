import { afterEach, describe, expect, it } from "vitest";
import { createLlmProvider, resolveLlmProviderName } from "./factory.js";

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
});

describe("resolveLlmProviderName", () => {
  it("prefers explicit OLLE_LLM_PROVIDER", () => {
    process.env.OLLE_LLM_PROVIDER = "heuristic";
    process.env.OPENAI_API_KEY = "sk-test";
    expect(resolveLlmProviderName()).toBe("heuristic");
  });

  it("defaults to openai when OPENAI_API_KEY is set", () => {
    delete process.env.OLLE_LLM_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test";
    expect(resolveLlmProviderName()).toBe("openai");
  });

  it("defaults to anthropic when only ANTHROPIC_API_KEY is set", () => {
    delete process.env.OLLE_LLM_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(resolveLlmProviderName()).toBe("anthropic");
  });

  it("defaults to heuristic when no keys", () => {
    delete process.env.OLLE_LLM_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(resolveLlmProviderName()).toBe("heuristic");
  });
});

describe("createLlmProvider", () => {
  it("returns OpenAiProvider when provider is openai", () => {
    process.env.OLLE_LLM_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    const provider = createLlmProvider();
    expect(provider.name).toBe("openai");
  });
});
