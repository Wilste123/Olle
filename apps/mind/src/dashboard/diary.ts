import type { DiarySnapshot } from "../api/snapshot.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderDiaryPage(diary: DiarySnapshot): string {
  const privateItems = diary.private
    .map((line, i) => `<li id="private-${i}">${esc(line)}</li>`)
    .join("");
  const sharedItems = diary.shared
    .map(
      (e) =>
        `<li><strong>${esc(e.title)}</strong> <span class="pill">${esc(e.status)}</span><br />${esc(e.body.slice(0, 400))}</li>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Olle — dagbok</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 52rem; margin: 1.5rem auto; padding: 0 1rem; line-height: 1.45; }
    .pill { display: inline-block; background: #eef; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.85rem; }
    ul { padding-left: 1.2rem; }
    li { margin: 0.6rem 0; }
    .note { color: #555; font-size: 0.95rem; }
    a { color: #0366d6; }
  </style>
</head>
<body>
  <p><a href="/dashboard">← Dashboard</a> · <a href="/chat">Prat</a> · <a href="/api/diary">/api/diary</a></p>
  <h1>Dagbok</h1>
  <p class="note">Olles <em>private</em> tanker — han velger å dele dem med deg her. Nyeste først.</p>

  <section id="private">
    <h2>Private linjer</h2>
    <ul>${privateItems || "<li>(tomt ennå)</li>"}</ul>
  </section>

  <section id="shared">
    <h2>Delt dagbok (kø)</h2>
    <ul>${sharedItems || "<li>(ingen foreslåtte poster)</li>"}</ul>
  </section>
</body>
</html>`;
}
