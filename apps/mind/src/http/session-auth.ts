import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export const SESSION_COOKIE = "olle_session";
const SESSION_DAYS = 30;

/** Fly / public internet: password + signed session cookie required. */
export function isProductionAuthEnabled(): boolean {
  return process.env.OLLE_PUBLIC === "1" || Boolean(process.env.FLY_APP_NAME?.trim());
}

export function assertAuthConfig(): void {
  if (!isProductionAuthEnabled()) return;
  if (!process.env.OLLE_AUTH_PASSWORD?.trim()) {
    throw new Error("OLLE_AUTH_PASSWORD is required when OLLE_PUBLIC=1 or FLY_APP_NAME is set");
  }
  if (!process.env.OLLE_SESSION_SECRET?.trim()) {
    throw new Error("OLLE_SESSION_SECRET is required when OLLE_PUBLIC=1 or FLY_APP_NAME is set");
  }
}

function sessionSecret(): string {
  return process.env.OLLE_SESSION_SECRET?.trim() ?? "dev-insecure-secret";
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", sessionSecret()).update(payloadB64).digest("base64url");
}

function issueSessionValue(): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const payloadB64 = Buffer.from(JSON.stringify({ v: 1, exp, sub: "william" }), "utf8").toString(
    "base64url",
  );
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySessionValue(token: string): boolean {
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (sign(payloadB64) !== sig) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      exp?: number;
      sub?: string;
    };
    if (payload.sub !== "william") return false;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isAuthenticated(req: IncomingMessage): boolean {
  if (!isProductionAuthEnabled()) return true;
  const cookies = parseCookies(req.headers.cookie ?? "");
  const token = cookies[SESSION_COOKIE];
  return token ? verifySessionValue(token) : false;
}

export function isPublicRoute(method: string, urlPath: string): boolean {
  if (urlPath === "/health") return true;
  if (urlPath.startsWith("/webhooks/")) return true;
  if (urlPath === "/login" && (method === "GET" || method === "POST")) return true;
  return false;
}

export function wantsHtml(urlPath: string): boolean {
  return (
    urlPath === "/" ||
    urlPath === "/dashboard" ||
    urlPath === "/chat" ||
    urlPath === "/prat" ||
    urlPath === "/diary"
  );
}

export function sendUnauthorized(_req: IncomingMessage, res: ServerResponse, urlPath: string): void {
  if (wantsHtml(urlPath)) {
    const next = encodeURIComponent(urlPath === "/" ? "/dashboard" : urlPath);
    res.writeHead(302, { Location: `/login?next=${next}` });
    res.end();
    return;
  }
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
}

export function setSessionCookie(res: ServerResponse): void {
  const value = issueSessionValue();
  const secure = isProductionAuthEnabled() ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
  `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    SESSION_DAYS * 24 * 60 * 60
  }${secure}`,
  );
}

export function clearSessionCookie(res: ServerResponse): void {
  const secure = isProductionAuthEnabled() ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0${secure}`);
}

export function verifyLoginPassword(password: string): boolean {
  const expected = process.env.OLLE_AUTH_PASSWORD?.trim() ?? "";
  if (!expected) return false;
  const a = Buffer.from(password, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseFormUrlEncoded(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of raw.split("&")) {
    const [k, v = ""] = pair.split("=");
    if (!k) continue;
    out[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  return out;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderLoginPage(opts?: { error?: string; next?: string }): string {
  const err = opts?.error ? `<p class="err">${esc(opts.error)}</p>` : "";
  const next = esc(opts?.next ?? "/dashboard");
  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Olle — innlogging</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 22rem; margin: 4rem auto; padding: 0 1rem; }
    h1 { font-size: 1.35rem; }
    label { display: block; margin: 1rem 0 0.35rem; font-size: 0.9rem; }
    input { width: 100%; padding: 0.5rem; font: inherit; box-sizing: border-box; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; font: inherit; cursor: pointer; }
    .err { color: #b00020; }
    .hint { color: #555; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Olles verden</h1>
  <p class="hint">Kun for William.</p>
  ${err}
  <form method="post" action="/login">
    <input type="hidden" name="next" value="${next}" />
    <label for="password">Passord</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required />
    <button type="submit">Logg inn</button>
  </form>
</body>
</html>`;
}
