import { describe, expect, it } from "vitest";
import { parseDecideJson, parseSpeakText } from "./parse.js";

const FIXTURE_DECIDE = `{
  "action_id": "think_about",
  "params": { "topic": "coffee" },
  "because": "Curiosity about yesterday's note."
}`;

describe("parseDecideJson", () => {
  it("parses bare JSON", () => {
    const d = parseDecideJson(FIXTURE_DECIDE);
    expect(d?.action_id).toBe("think_about");
    expect(d?.params.topic).toBe("coffee");
  });

  it("parses fenced JSON", () => {
    const d = parseDecideJson("```json\n" + FIXTURE_DECIDE + "\n```");
    expect(d?.because).toContain("Curiosity");
  });

  it("rejects invalid action", () => {
    expect(parseDecideJson('{"action_id":"add_map_pin","params":{},"because":"nope"}')).toBeNull();
  });
});

describe("parseSpeakText", () => {
  it("trims quotes", () => {
    expect(parseSpeakText('"Hello William"')).toBe("Hello William");
  });
});
