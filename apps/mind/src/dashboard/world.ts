import { PLACE_GRAPH, PLACES, getPlace, type Place } from "@olle/protocol";
import type { NowSnapshot } from "../api/snapshot.js";
import type { FeedEntry } from "../world/store.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function navLinks(): string {
  return `<a href="/dashboard">Dashboard</a> · <a href="/world">Verden</a> · <a href="/chat">Prat</a> · <a href="/diary">Dagbok</a>`;
}

function edgeLines(): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const [from, neighbors] of Object.entries(PLACE_GRAPH)) {
    const a = getPlace(from);
    if (!a) continue;
    for (const to of neighbors) {
      const key = [from, to].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const b = getPlace(to);
      if (!b) continue;
      lines.push(
        `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="edge" />`,
      );
    }
  }
  return lines.join("\n");
}

function placeNodes(currentId?: string): string {
  return PLACES.map((p: Place) => {
    const here = p.id === currentId;
    return `<g class="place${here ? " current" : ""}">
      <circle cx="${p.x}" cy="${p.y}" r="${here ? 22 : 18}" />
      <text x="${p.x}" y="${p.y + 34}" text-anchor="middle">${esc(p.label)}</text>
    </g>`;
  }).join("\n");
}

function olleDot(currentId?: string): string {
  const p = currentId ? getPlace(currentId) : undefined;
  if (!p) return "";
  return `<circle class="olle" cx="${p.x}" cy="${p.y}" r="7" />`;
}

function movementFeed(feed: FeedEntry[]): string {
  const moves = feed
    .filter(
      (f) =>
        f.about === "moved" ||
        f.action_id === "go_to_place" ||
        (f.meta && typeof f.meta.to_place_id === "string"),
    )
    .slice(-8)
    .reverse();
  return moves
    .map((f) => `<li><time>${esc(f.at)}</time> ${esc(f.text)}</li>`)
    .join("");
}

export function renderWorldPage(now: NowSnapshot, feed: FeedEntry[]): string {
  const currentId =
    now.placement.status === "placed" ? now.placement.place_id : undefined;
  const moves = movementFeed(feed);

  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Olle — verden</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 52rem; margin: 1.5rem auto; padding: 0 1rem; line-height: 1.45; background: #faf8f5; color: #222; }
    h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
  nav { margin: 0.5rem 0 1rem; font-size: 0.95rem; }
  nav a { color: #0366d6; margin-right: 0.35rem; }
    .map-wrap { background: #f0ebe3; border-radius: 12px; padding: 0.5rem; box-shadow: inset 0 0 0 1px #ddd; }
    svg { width: 100%; height: auto; display: block; }
    .edge { stroke: #bbb; stroke-width: 3; stroke-linecap: round; }
    .place circle { fill: #e8e0d4; stroke: #8a7f72; stroke-width: 2; }
    .place.current circle { fill: #d4e8ff; stroke: #0366d6; stroke-width: 2.5; }
    .place text { font-size: 11px; fill: #444; }
    .olle { fill: #ff6b4a; stroke: #fff; stroke-width: 2; }
    ul { padding-left: 1.2rem; }
    time { color: #666; font-size: 0.85rem; }
    .pill { display: inline-block; background: #eef; padding: 0.2rem 0.55rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Verden v1</h1>
  <nav>${navLinks()}</nav>
  <p>
    <span class="pill">${esc(now.placement.status)}</span>
    <span class="pill">${esc(now.placeLabel)}</span>
    ${currentId ? `<span class="pill">${esc(currentId)}</span>` : ""}
  </p>
  <div class="map-wrap">
    <svg viewBox="0 0 340 280" role="img" aria-label="Olle world map">
      ${edgeLines()}
      ${placeNodes(currentId)}
      ${olleDot(currentId)}
    </svg>
  </div>
  <section>
    <h2 style="font-size:1.05rem">Siste bevegelser</h2>
    <ul>${moves || "<li>(ingen ennå — ticks med go_to_place eller besøk)</li>"}</ul>
  </section>
</body>
</html>`;
}
