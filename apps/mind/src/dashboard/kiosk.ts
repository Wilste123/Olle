/** Fullscreen wall display — polls /api/now; no navigation chrome. */

export function renderKioskPage(includeWorld: boolean): string {
  const worldBlock = includeWorld
    ? `<section id="world" class="world" hidden>
        <iframe title="Olle verden" src="/world" loading="lazy"></iframe>
      </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Olle</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; background: #0f1419; color: #e8eef4; font-family: system-ui, sans-serif; }
    main {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 4vmin 6vmin;
      gap: 2.5vmin;
    }
    h1 { font-size: clamp(2.5rem, 8vmin, 5rem); font-weight: 600; letter-spacing: -0.02em; }
    .placement { font-size: clamp(1.25rem, 3.5vmin, 2rem); color: #8ba3b8; }
    .doing { font-size: clamp(1.1rem, 2.8vmin, 1.75rem); line-height: 1.4; max-width: 42em; }
    .feelings {
      font-size: clamp(1.5rem, 4vmin, 2.5rem);
      font-weight: 500;
      color: #a8c4dc;
    }
    .meta {
      font-size: clamp(0.85rem, 2vmin, 1.1rem);
      color: #5c7389;
      margin-top: auto;
      padding-top: 3vmin;
    }
  .world {
      flex: 1;
      min-height: 0;
      margin-top: 2vmin;
    }
    .world iframe {
      width: 100%;
      height: min(45vh, 420px);
      border: 1px solid #2a3540;
      border-radius: 8px;
      background: #1a2229;
    }
    .asleep { opacity: 0.65; }
    .err { color: #f0a0a8; font-size: 1rem; }
  </style>
</head>
<body>
  <main id="root">
    <h1>Olle</h1>
    <p class="placement" id="placement">…</p>
    <p class="feelings" id="feelings">…</p>
    <p class="doing" id="doing">…</p>
    <p class="meta" id="meta"></p>
  </main>
  ${worldBlock}
  <script>
    const REFRESH_MS = 25000;
    const showWorld = ${includeWorld ? "true" : "false"};

    function placementLine(p) {
      if (!p) return "ukjent";
      if (p.status === "placed" && p.label) return p.label;
      if (p.status === "placed" && p.place_id) return p.place_id;
      return p.status === "unplaced" ? "ikke plassert ennå" : String(p.status || "—");
    }

    function feelingLine(data) {
      const f = data.feelings || {};
      const words = (f.feelingWords || []).join(" · ");
      const mood = typeof f.mood === "number" ? f.mood.toFixed(2) : "—";
      const asleep = f.asleep ? "sover" : "våken";
      return (words || "—") + "  ·  " + asleep + "  ·  mood " + mood;
    }

    async function refresh() {
      try {
        const res = await fetch("/api/now", { credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        document.getElementById("placement").textContent = placementLine(data.placement);
        document.getElementById("feelings").textContent = feelingLine(data);
        document.getElementById("doing").textContent = data.doing || data.lastActivity || "—";
        document.getElementById("meta").textContent = "oppdatert " + new Date(data.at || Date.now()).toLocaleString("nb-NO");
        document.body.classList.toggle("asleep", Boolean(data.feelings && data.feelings.asleep));
        if (showWorld) {
          const w = document.getElementById("world");
          if (w) w.hidden = false;
        }
      } catch (e) {
        document.getElementById("doing").innerHTML = '<span class="err">Kunne ikke hente status</span>';
      }
    }

    refresh();
    setInterval(refresh, REFRESH_MS);
  </script>
</body>
</html>`;
}
