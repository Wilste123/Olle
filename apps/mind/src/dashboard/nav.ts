import { isProductionAuthEnabled } from "../http/session-auth.js";

export type WorldNavActive = "dashboard" | "chat" | "diary";

function link(href: string, label: string, active: boolean): string {
  return active ? `<strong>${label}</strong>` : `<a href="${href}">${label}</a>`;
}

/** Unified header nav for dashboard, chat, and diary. */
export function renderWorldNav(active: WorldNavActive): string {
  const logout = isProductionAuthEnabled()
    ? ` · <a href="/logout">Logg ut</a>`
    : "";
  return `<nav class="world-nav" style="margin-bottom:1rem;font-size:0.95rem;">
    <strong>Olles verden</strong> —
    ${link("/dashboard", "Dashboard", active === "dashboard")}
    |
    ${link("/chat", "Prat", active === "chat")}
    |
    ${link("/diary", "Dagbok", active === "diary")}
    ${logout}
  </nav>`;
}
