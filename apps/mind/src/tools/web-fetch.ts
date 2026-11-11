import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const OLLE_USER_AGENT = "OlleMind/0.3";
export const WEB_FETCH_MAX_BYTES = 512_000;
export const WEB_FETCH_TIMEOUT_MS = 15_000;

export interface FetchPageResult {
  ok: boolean;
  url: string;
  status?: number;
  text?: string;
  error?: string;
  truncated?: boolean;
}

/** Allowed for outbound research: HTTPS GET to public hosts only. */
export async function fetchHttpsPage(
  rawUrl: string,
  opts?: { fetchImpl?: typeof fetch; maxBytes?: number; timeoutMs?: number },
): Promise<FetchPageResult> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const maxBytes = opts?.maxBytes ?? WEB_FETCH_MAX_BYTES;
  const timeoutMs = opts?.timeoutMs ?? WEB_FETCH_TIMEOUT_MS;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, url: rawUrl, error: "Invalid URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, url: rawUrl, error: "Only https:// URLs allowed" };
  }

  const hostCheck = await assertPublicHost(parsed.hostname);
  if (!hostCheck.ok) {
    return { ok: false, url: rawUrl, error: hostCheck.reason };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "User-Agent": OLLE_USER_AGENT,
      },
    });

    const status = res.status;
    if (!res.ok) {
      return { ok: false, url: parsed.toString(), status, error: `HTTP ${status}` };
    }

    const buf = await res.arrayBuffer();
    const { text, truncated } = truncateBuffer(buf, maxBytes);
    return {
      ok: true,
      url: parsed.toString(),
      status,
      text: htmlToText(text),
      truncated,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { ok: false, url: rawUrl, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export function htmlToText(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, 12_000);
}

function truncateBuffer(buf: ArrayBuffer, maxBytes: number): { text: string; truncated: boolean } {
  const truncated = buf.byteLength > maxBytes;
  const slice = buf.slice(0, maxBytes);
  return { text: Buffer.from(slice).toString("utf8"), truncated };
}

export async function assertPublicHost(hostname: string): Promise<{ ok: boolean; reason?: string }> {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) {
    return { ok: false, reason: "Blocked host (localhost)" };
  }
  if (isIP(h)) {
    return isPrivateIp(h) ? { ok: false, reason: "Blocked private IP" } : { ok: true };
  }

  try {
    const records = await lookup(h, { all: true });
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        return { ok: false, reason: "Blocked private IP (DNS)" };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "DNS lookup failed" };
  }
}

export function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "127.0.0.1") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  if (ip.startsWith("0.")) return true;
  const v4 = ip.includes(".") ? ip : null;
  if (v4?.startsWith("172.")) {
    const second = Number(v4.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  return false;
}
