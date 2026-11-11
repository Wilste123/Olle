import { describe, expect, it } from "vitest";
import { extractHttpsUrl, latestResearchUrlFromWilliam } from "./research-url.js";

describe("extractHttpsUrl", () => {
  it("pulls first https link", () => {
    expect(extractHttpsUrl("kijk https://example.com/page og ha det")).toBe("https://example.com/page");
  });

  it("strips trailing period", () => {
    expect(extractHttpsUrl("https://example.com/.")).toBe("https://example.com/");
  });
});

describe("latestResearchUrlFromWilliam", () => {
  it("reads unread william message", () => {
    const url = latestResearchUrlFromWilliam({
      conversation: [
        { from: "william", text: "les dette https://protocol.pinos.world/", read_by_olle: false },
      ],
    });
    expect(url).toBe("https://protocol.pinos.world/");
  });
});
