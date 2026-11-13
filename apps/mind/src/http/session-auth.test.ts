import { describe, expect, it, beforeEach, afterEach } from "vitest";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createInboundServer } from "../inbound-server.js";

describe("session auth gate", () => {
  const prev: Record<string, string | undefined> = {};
  let stateDir: string;

  beforeEach(async () => {
    for (const k of [
      "FLY_APP_NAME",
      "OLLE_PUBLIC",
      "OLLE_AUTH_PASSWORD",
      "OLLE_SESSION_SECRET",
      "OLLE_STATE_PATH",
    ]) {
      prev[k] = process.env[k];
    }
    stateDir = await mkdtemp(join(tmpdir(), "olle-auth-"));
    process.env.FLY_APP_NAME = "olle-test";
    process.env.OLLE_AUTH_PASSWORD = "william-only";
    process.env.OLLE_SESSION_SECRET = "test-session-secret-for-hmac";
    process.env.OLLE_STATE_PATH = join(stateDir, "state.json");
  });

  afterEach(async () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(stateDir, { recursive: true, force: true });
  });

  function request(
    server: http.Server,
    method: string,
    path: string,
    opts?: { headers?: Record<string, string>; body?: string },
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("no address"));
        return;
      }
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: opts?.headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c as Buffer));
          res.on("end", () => {
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            });
          });
        },
      );
      req.on("error", reject);
      if (opts?.body) req.write(opts.body);
      req.end();
    });
  }

  it("allows /health without a session", async () => {
    const server = createInboundServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    try {
      const res = await request(server, "GET", "/health");
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).ok).toBe(true);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it("blocks /api/now without a session", async () => {
    const server = createInboundServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    try {
      const res = await request(server, "GET", "/api/now");
      expect(res.status).toBe(401);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it("redirects /dashboard to /login", async () => {
    const server = createInboundServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    try {
      const res = await request(server, "GET", "/dashboard");
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/login/);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it("redirects /kiosk to /login when auth is on", async () => {
    const server = createInboundServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    try {
      const res = await request(server, "GET", "/kiosk");
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/login/);
      expect(decodeURIComponent(res.headers.location ?? "")).toContain("kiosk");
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it("issues session cookie on POST /login and allows dashboard and kiosk", async () => {
    const server = createInboundServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    try {
      const login = await request(server, "POST", "/login", {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "password=william-only&next=%2Fdashboard",
      });
      expect(login.status).toBe(302);
      expect(login.headers.location).toBe("/dashboard");
      const setCookie = login.headers["set-cookie"];
      const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie ?? "");
      expect(cookieHeader).toContain("olle_session=");

      const dash = await request(server, "GET", "/dashboard", {
        headers: { Cookie: cookieHeader.split(";")[0] ?? "" },
      });
      expect(dash.status).toBe(200);
      expect(dash.body).toContain("Olle");

      const kiosk = await request(server, "GET", "/kiosk", {
        headers: { Cookie: cookieHeader.split(";")[0] ?? "" },
      });
      expect(kiosk.status).toBe(200);
      expect(kiosk.body).toContain("/api/now");
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it("allows webhook path without session", async () => {
    const server = createInboundServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    try {
      const res = await request(server, "POST", "/webhooks/email/inbound", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "x@y.com", text: "hi" }),
      });
      expect(res.status).not.toBe(401);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});
