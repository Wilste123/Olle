/** Parse YES/NO replies for permission workflow (email-ready). */
export type ParsedPermissionReply =
  | { type: "approve"; id: string }
  | { type: "deny"; id: string }
  | { type: "edit"; id: string; overrides: Record<string, string> }
  | null;

const YES = /^\s*YES\s+([a-zA-Z0-9-]+)\s*$/i;
const NO = /^\s*NO\s+([a-zA-Z0-9-]+)\s*$/i;
const EDIT = /^\s*EDIT\s+([a-zA-Z0-9-]+)\s*\|\s*(.+)$/i;

export function parsePermissionReply(text: string): ParsedPermissionReply {
  const line = text.trim().split("\n")[0]?.trim() ?? "";
  let m = line.match(YES);
  if (m) return { type: "approve", id: m[1] };
  m = line.match(NO);
  if (m) return { type: "deny", id: m[1] };
  m = line.match(EDIT);
  if (m) {
    const overrides: Record<string, string> = {};
    for (const part of m[2].split("|")) {
      const [k, ...rest] = part.trim().split("=");
      if (k && rest.length) overrides[k.trim()] = rest.join("=").trim();
    }
    return { type: "edit", id: m[1], overrides };
  }
  return null;
}
