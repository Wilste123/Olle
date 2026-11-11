/** Parse `OLLE_QUIET_HOURS` e.g. `22:00-08:00` in `OLLE_QUIET_TZ` (default Europe/Oslo). */

export interface QuietWindow {
  startMin: number; // minutes from midnight
  endMin: number;
  crossesMidnight: boolean;
}

export function parseQuietHours(
  raw = process.env.OLLE_QUIET_HOURS ?? "",
): QuietWindow | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!m) return null;
  const startMin = Number(m[1]) * 60 + Number(m[2]);
  const endMin = Number(m[3]) * 60 + Number(m[4]);
  if (startMin < 0 || startMin >= 24 * 60 || endMin < 0 || endMin >= 24 * 60) return null;
  return { startMin, endMin, crossesMidnight: startMin > endMin };
}

function localParts(date: Date, timeZone: string): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

export function isInQuietHours(at: Date = new Date(), window: QuietWindow | null = parseQuietHours()): boolean {
  if (!window) return false;
  const tz = process.env.OLLE_QUIET_TZ ?? "Europe/Oslo";
  const { hour, minute } = localParts(at, tz);
  const nowMin = hour * 60 + minute;

  if (window.crossesMidnight) {
    return nowMin >= window.startMin || nowMin < window.endMin;
  }
  return nowMin >= window.startMin && nowMin < window.endMin;
}
