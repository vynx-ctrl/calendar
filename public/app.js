const statusEl = document.getElementById("status");
const connectPanel = document.getElementById("connectPanel");
const workspace = document.getElementById("workspace");
const eventsEl = document.getElementById("events");
const form = document.getElementById("createForm");
const formError = document.getElementById("formError");
const mcpUrl = document.getElementById("mcpUrl");

mcpUrl.textContent = `${location.origin}/mcp`;

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function seedFormDefaults() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 30 * 60_000);
  form.start.value = toLocalInputValue(start);
  form.end.value = toLocalInputValue(end);
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function formatWhen(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function refreshStatus() {
  const data = await api("/api/status");
  if (data.connected) {
    statusEl.textContent = data.email ? `Connected as ${data.email}` : "Connected";
    connectPanel.classList.add("hidden");
    workspace.classList.remove("hidden");
    await loadEvents();
  } else {
    statusEl.textContent = "Not connected";
    connectPanel.classList.remove("hidden");
    workspace.classList.add("hidden");
  }
}

async function loadEvents() {
  eventsEl.innerHTML = `<div class="empty">Loading…</div>`;
  try {
    const { events } = await api("/api/events");
    if (!events.length) {
      eventsEl.innerHTML = `<div class="empty">No upcoming events in the next 7 days.</div>`;
      return;
    }
    eventsEl.innerHTML = events
      .map(
        (e) => `
      <article class="event-card" data-id="${e.id}">
        <h3>${escapeHtml(e.title)}</h3>
        <p class="event-meta">${escapeHtml(formatWhen(e.start))} → ${escapeHtml(formatWhen(e.end))}</p>
        <div class="event-actions">
          <button class="btn" data-action="rename" type="button">Rename</button>
          <button class="btn danger" data-action="delete" type="button">Delete</button>
          ${e.htmlLink ? `<a class="btn" href="${e.htmlLink}" target="_blank" rel="noreferrer">Open in Google</a>` : ""}
        </div>
      </article>`,
      )
      .join("");
  } catch (err) {
    eventsEl.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  formError.hidden = true;
  const fd = new FormData(form);
  try {
    await api("/api/events", {
      method: "POST",
      body: JSON.stringify({
        title: fd.get("title"),
        start: new Date(String(fd.get("start"))).toISOString(),
        end: new Date(String(fd.get("end"))).toISOString(),
        description: fd.get("description") || undefined,
      }),
    });
    form.reset();
    seedFormDefaults();
    await loadEvents();
  } catch (err) {
    formError.hidden = false;
    formError.textContent = err.message;
  }
});

eventsEl.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-action]");
  if (!btn) return;
  const card = btn.closest(".event-card");
  const id = card?.dataset.id;
  if (!id) return;

  if (btn.dataset.action === "delete") {
    if (!confirm("Delete this event?")) return;
    await api(`/api/events/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadEvents();
  }

  if (btn.dataset.action === "rename") {
    const title = prompt("New title");
    if (!title) return;
    await api(`/api/events/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
    await loadEvents();
  }
});

document.getElementById("refreshBtn").addEventListener("click", loadEvents);
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/auth/logout", { method: "POST", body: "{}" });
  await refreshStatus();
});

seedFormDefaults();
refreshStatus().catch((err) => {
  statusEl.textContent = err.message;
});
