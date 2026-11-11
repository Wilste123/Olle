import type { ConversationMessage } from "../world/store.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderChatPage(messages: ConversationMessage[]): string {
  const rows = messages
    .map((m) => {
      const who = m.from === "william" ? "William" : "Olle";
      const cls = m.from === "william" ? "william" : "olle";
      return `<div class="msg ${cls}"><span class="who">${who}</span><p>${esc(m.text)}</p><time>${esc(m.at)}</time></div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Olle — prat</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 1.5rem auto; padding: 0 1rem; }
    h1 { font-size: 1.4rem; }
    .hint { color: #555; font-size: 0.95rem; margin-bottom: 1rem; }
    #thread { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; min-height: 12rem; max-height: 24rem; overflow-y: auto; background: #fafafa; }
    .msg { margin: 0.75rem 0; padding: 0.5rem 0.75rem; border-radius: 6px; }
    .msg.william { background: #e8f0fe; }
    .msg.olle { background: #f0f0f0; }
    .who { font-weight: 600; font-size: 0.85rem; }
    time { display: block; font-size: 0.75rem; color: #666; margin-top: 0.25rem; }
    form { margin-top: 1rem; display: flex; gap: 0.5rem; }
    textarea { flex: 1; min-height: 3rem; padding: 0.5rem; font: inherit; }
    button { padding: 0.5rem 1rem; font: inherit; cursor: pointer; }
    a { color: #0366d6; }
  </style>
</head>
<body>
  <h1>Prat med Olle</h1>
  <p class="hint">Olle leser dette på sin egen rytme — ikke live chat. Svaret kommer i samtalen når neste tanke-tick kjører.</p>
  <p><a href="/dashboard">Dashboard</a> · <a href="/api/conversation">JSON</a></p>
  <div id="thread">${rows || "<p><em>Ingen meldinger ennå.</em></p>"}</div>
  <form id="say">
    <textarea name="text" placeholder="Skriv til Olle…" required></textarea>
    <button type="submit">Send</button>
  </form>
  <p id="status" class="hint"></p>
  <script>
    const thread = document.getElementById("thread");
    const form = document.getElementById("say");
    const status = document.getElementById("status");
    async function refresh() {
      const r = await fetch("/api/conversation");
      const data = await r.json();
      thread.innerHTML = (data.conversation || []).map((m) => {
        const who = m.from === "william" ? "William" : "Olle";
        const cls = m.from === "william" ? "william" : "olle";
        const t = (m.text || "").replace(/&/g,"&amp;").replace(/</g,"&lt;");
        return '<div class="msg '+cls+'"><span class="who">'+who+'</span><p>'+t+'</p><time>'+m.at+'</time></div>';
      }).join("") || "<p><em>Ingen meldinger ennå.</em></p>";
    }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = form.text.value.trim();
      if (!text) return;
      status.textContent = "Sendt — Olle leser dette snart.";
      form.text.value = "";
      await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      await refresh();
    });
    setInterval(refresh, 8000);
  </script>
</body>
</html>`;
}
