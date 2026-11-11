import http from "node:http";
import { loadOlleEnv } from "./env.js";
import { handleInboundEmail } from "./inbound/handler.js";
import {
  buildAuditSnapshot,
  buildFeedSnapshot,
  buildNowSnapshot,
} from "./api/snapshot.js";
import { renderDashboard } from "./dashboard/html.js";
import { loadState } from "./world/store.js";

loadOlleEnv();

const PORT = Number(process.env.OLLE_INBOUND_PORT ?? 8787);
const PATH = process.env.OLLE_INBOUND_PATH ?? "/webhooks/email/inbound";

interface SimpleInbound {
  from: string;
  text?: string;
  body?: string;
  subject?: string;
}

function extractResendPayload(body: unknown): { from: string; text: string; subject: string } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (o.type === "email.received" && o.data && typeof o.data === "object") {
    const d = o.data as Record<string, unknown>;
    const from = String(d.from ?? "");
    const text = String(d.text ?? d.html ?? "");
    const subject = String(d.subject ?? "");
    if (from && text) return { from, text, subject };
  }
  if (typeof o.from === "string") {
    const text = String(o.text ?? o.body ?? "");
    if (text) {
      return { from: o.from, text, subject: String(o.subject ?? "") };
    }
  }
  return null;
}

function json(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function createInboundServer(): http.Server {
  return http.createServer(async (req, res) => {
    const urlPath = req.url?.split("?")[0] ?? "";

    if (req.method === "GET" && urlPath === "/health") {
      json(res, 200, { ok: true, service: "olle-inbound" });
      return;
    }

    if (req.method === "GET" && (urlPath === "/" || urlPath === "/dashboard")) {
      const state = await loadState();
      const html = renderDashboard(
        buildNowSnapshot(state),
        buildFeedSnapshot(state, 30),
        buildAuditSnapshot(state, 40),
      );
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && urlPath === "/api/now") {
      const state = await loadState();
      json(res, 200, buildNowSnapshot(state));
      return;
    }

    if (req.method === "GET" && urlPath === "/api/feed") {
      const state = await loadState();
      json(res, 200, { feed: buildFeedSnapshot(state) });
      return;
    }

    if (req.method === "GET" && urlPath === "/api/audit") {
      const state = await loadState();
      json(res, 200, { audit: buildAuditSnapshot(state) });
      return;
    }

    if (req.method !== "POST" || urlPath !== PATH) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString("utf8");

    let parsed: SimpleInbound | null = null;
    try {
      const jsonBody = JSON.parse(raw) as unknown;
      const extracted = extractResendPayload(jsonBody);
      if (extracted) {
        parsed = { from: extracted.from, text: extracted.text, subject: extracted.subject };
      } else if (jsonBody && typeof jsonBody === "object") {
        const j = jsonBody as SimpleInbound;
        if (j.from) parsed = j;
      }
    } catch {
      parsed = { from: process.env.WILLIAM_EMAIL ?? "dev@local", text: raw };
    }

    if (!parsed?.from) {
      json(res, 400, { ok: false, error: "Missing from" });
      return;
    }

    const text = parsed.text ?? parsed.body ?? "";
    const result = await handleInboundEmail({
      from: parsed.from,
      text,
      subject: parsed.subject,
    });
    json(res, result.ok ? 200 : 400, result);
  });
}

export function startInboundServer(): http.Server {
  const server = createInboundServer();
  server.listen(PORT, () => {
    console.log(`[olle-inbound] listening on http://127.0.0.1:${PORT}`);
    console.log(`[olle-inbound] dashboard: http://127.0.0.1:${PORT}/dashboard`);
    console.log(`[olle-inbound] webhook POST ${PATH}`);
    console.log(`[olle-inbound] health: http://127.0.0.1:${PORT}/health`);
  });
  return server;
}

if (process.argv[1]?.includes("inbound-server")) {
  startInboundServer();
}
