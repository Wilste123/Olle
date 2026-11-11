import { describe, expect, it, vi, beforeEach } from "vitest";
import * as webFetch from "./web-fetch.js";

describe("isPrivateIp", () => {
  it("blocks loopback", () => {
    expect(webFetch.isPrivateIp("127.0.0.1")).toBe(true);
    expect(webFetch.isPrivateIp("10.0.0.1")).toBe(true);
  });
});

describe("assertPublicHost", () => {
  it("blocks localhost", async () => {
    const r = await webFetch.assertPublicHost("localhost");
    expect(r.ok).toBe(false);
  });
});

describe("htmlToText", () => {
  it("strips tags", () => {
    expect(webFetch.htmlToText("<p>Hei <b>Olle</b></p>")).toBe("Hei Olle");
  });
});

describe("fetchHttpsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks http scheme", async () => {
    const r = await webFetch.fetchHttpsPage("http://example.com/");
    expect(r.ok).toBe(false);
  });

  it("blocks 127.0.0.1", async () => {
    const r = await webFetch.fetchHttpsPage("https://127.0.0.1/");
    expect(r.ok).toBe(false);
  });

  it("htmlToText caps length on huge html", () => {
    const huge = "<p>" + "word ".repeat(20_000) + "</p>";
    expect(webFetch.htmlToText(huge).length).toBeLessThanOrEqual(12_000);
  });
});
