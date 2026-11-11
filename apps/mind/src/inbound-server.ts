import http from "node:http";
import { loadOlleEnv } from "./env.js";
import { processPermissionReply } from "./permission/inbound.js";

loadOlleEnv();

const PORT = Number(process.env.OLLE_INBOUND_PORT ?? 8787);
const PATH = process.env.OLLE_INBOUND_PATH ?? "/webhooks/email/inbound";

interface SimpleInbound {
  from: string;
  text?: string;
  body?: string;
  subject?: string;
}

function extractResendText(body: unknown): { from: string; text: string } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (o.type === "email.received" && o.data && typeof o.data === "object") {
    const d = o.data as Record<string, unknown>;
    const from = String(d.from ?? "");
    const text = String(d.text ?? d.html ?? "");
    if (from && text) return { from, text };
  }
  if (typeof o.from === "string") {
    const text = String(o.text ?? o.body ?? "");
    if (text) return { from: o.from, text };
  }
  return null;
}

export function createInboundServer(): http.Server {
  return http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "olle-inbound" }));
      return;
    }

    const urlPath = req.url?.split("?")[0];
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
      const json = JSON.parse(raw) as unknown;
      const extracted = extractResendText(json);
      if (extracted) {
        parsed = { from: extracted.from, text: extracted.text };
      } else if (json && typeof json === "object") {
        const j = json as SimpleInbound;
        if (j.from) parsed = j;
      }
    } catch {
      parsed = { from: process.env.WILLIAM_EMAIL ?? "dev@local", text: raw };
    }

    if (!parsed?.from) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Missing from" }));
      return;
    }

    const text = [parsed.subject, parsed.text, parsed.body].filter(Boolean).join("\n");
    const result = await processPermissionReply(parsed.from, text);
    res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  });
}

export function startInboundServer(): http.Server {
  const server = createInboundServer();
  server.listen(PORT, () => {
    console.log(`[olle-inbound] listening on http://127.0.0.1:${PORT}${PATH}`);
    console.log(`[olle-inbound] health: http://127.0.0.1:${PORT}/health`);
  });
  return server;
}

if (process.argv[1]?.includes("inbound-server")) {
  startInboundServer();
}
