import type { NowSnapshot } from "../api/snapshot.js";
import type { FeedEntry } from "../world/store.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderDashboard(
  now: NowSnapshot,
  feed: FeedEntry[],
  audit: { at: string; kind: string; detail: Record<string, unknown> }[],
): string {
  const mood = now.feelings.mood.toFixed(2);
  const energy = now.feelings.energy.toFixed(2);
  const asleep = now.feelings.asleep ? "asleep" : "awake";

  const permRows = now.pendingPermissions
    .map(
      (p) =>
        `<tr><td>${esc(p.id)}</td><td>${esc(p.action_id)}</td><td>${esc(p.status)}</td><td>${esc(p.expires_at)}</td></tr>`,
    )
    .join("");

  const diaryRows = now.sharedDiaryQueue
    .map(
      (d) =>
        `<tr><td>${esc(d.title)}</td><td>${esc(d.status)}</td><td>${esc(d.body.slice(0, 120))}</td></tr>`,
    )
    .join("");

  const feedItems = feed
    .map(
      (f) =>
        `<li><time>${esc(f.at)}</time> <strong>${esc(f.kind)}</strong> ${esc(f.text)}${
          f.why ? ` <em>(${esc(f.why)})</em>` : ""
        }</li>`,
    )
    .join("");

  const auditItems = audit
    .map((a) => `<li><time>${esc(a.at)}</time> ${esc(a.kind)} — ${esc(JSON.stringify(a.detail))}</li>`)
    .join("");

  const memItems = now.memories.map((m) => `<li>${esc(m.text)} <small>(${m.strength.toFixed(2)})</small></li>`).join("");

  const hunger = now.survival.hunger.toFixed(2);
  const hobbyItems = now.hobbies
    .map((h) => `<li>${esc(h.label)} <small>heat ${h.heat.toFixed(2)}</small></li>`)
    .join("");

  const opinionItems = now.topOpinions
    .map(
      (o) =>
        `<li><strong>${esc(o.topic)}</strong> — ${esc(o.stance)} <small>konfidens ${(o.confidence * 100).toFixed(0)}%</small></li>`,
    )
    .join("");

  const privateDiaryItems = now.privateDiaryTail
    .map((line) => `<li>${esc(line)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Olle — dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 52rem; margin: 1.5rem auto; padding: 0 1rem; line-height: 1.45; }
    h1 { font-size: 1.5rem; }
    section { margin: 1.5rem 0; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { border-bottom: 1px solid #ddd; text-align: left; padding: 0.35rem 0.5rem; }
    ul { padding-left: 1.2rem; }
    li { margin: 0.25rem 0; }
    time { color: #666; font-size: 0.85rem; }
    .pill { display: inline-block; background: #eef; padding: 0.2rem 0.5rem; border-radius: 4px; margin-right: 0.35rem; }
    a { color: #0366d6; }
  </style>
</head>
<body>
  <h1>Olle</h1>
  <p>
    <span class="pill">${esc(now.placement.status)}</span>
    <span class="pill">${esc(asleep)}</span>
    <span class="pill">mood ${mood}</span>
    <span class="pill">energy ${energy}</span>
    <span class="pill">email budget ${now.emailBudgetRemaining}</span>
    <span class="pill">ticks ${now.tickCount}</span>
    <span class="pill">hunger ${hunger}</span>
    <span class="pill">coins ${now.purse.coins}</span>
    <span class="pill">affection ${now.feelings.affection.toFixed(2)}</span>
    <span class="pill">${now.feelings.feelingWords.map(esc).join(" · ") || "—"}</span>
  </p>
  <p class="needs">
    ${["rest", "curiosity", "social", "expression", "quiet", "wonder", "joy", "comfort", "sustenance"]
      .map((k) => {
        const v = now.feelings.needs[k as keyof typeof now.feelings.needs];
        return `<span class="pill" title="need ${k}">${k} ${Number(v).toFixed(2)}</span>`;
      })
      .join(" ")}
  </p>
  <p>Doing: ${esc(now.doing)} · <a href="/chat">Prat</a> · <a href="/diary">Dagbok</a> · <a href="#diary">Dagbok ↓</a> · <a href="/api/now">/api/now</a> · <a href="/api/diary">/api/diary</a> · <a href="/api/feed">/api/feed</a> · <a href="/api/audit">/api/audit</a></p>
  <p>Inventory: ${esc(now.inventorySummary)}</p>

  <section>
    <h2>Hobbies / threads</h2>
    <ul>${hobbyItems || "<li>(warming up)</li>"}</ul>
  </section>

  <section>
    <h2>Meninger</h2>
    <p class="note" style="color:#555;font-size:0.95rem;">Olles egne ståsted — private men synlige for deg her (topp 5 etter konfidens).</p>
    <ul>${opinionItems || "<li>(ingen ennå — forskning og tanker bygger dem)</li>"}</ul>
  </section>

  <section>
    <h2>Pending permissions</h2>
    <table>
      <thead><tr><th>Id</th><th>Action</th><th>Status</th><th>Expires</th></tr></thead>
      <tbody>${permRows || "<tr><td colspan=4>(none)</td></tr>"}</tbody>
    </table>
  </section>

  <section id="diary">
    <h2>Olles private diary</h2>
    <p class="note" style="color:#555;font-size:0.95rem;">Usually private thoughts Olle shares with you (not the public shared diary). <a href="/diary">Open full dagbok</a> · newest first, last ${now.privateDiaryTail.length} lines.</p>
    <ul>${privateDiaryItems || "<li>(empty — ticks will add lines)</li>"}</ul>
  </section>

  <section>
    <h2>Shared diary</h2>
    <table>
      <thead><tr><th>Title</th><th>Status</th><th>Preview</th></tr></thead>
      <tbody>${diaryRows || "<tr><td colspan=3>(empty)</td></tr>"}</tbody>
    </table>
  </section>

  <section>
    <h2>Memories (from email)</h2>
    <ul>${memItems || "<li>(none yet)</li>"}</ul>
  </section>

  <section>
    <h2>Feed</h2>
    <ul>${feedItems || "<li>(empty)</li>"}</ul>
  </section>

  <section>
    <h2>Audit</h2>
    <ul>${auditItems || "<li>(empty)</li>"}</ul>
  </section>
</body>
</html>`;
}
