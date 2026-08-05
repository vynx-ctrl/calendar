# Self-hosted Calendar

A small **self-hosted** Google Calendar + **Google Tasks** app with:

- **Web UI** — calendar events and todo tasks
- **REST API** — `/api/events` and `/api/tasks` CRUD
- **MCP endpoint** — `/mcp` for Cursor Desktop & Cloud Agents (calendar + tasks tools)
- **Messaging webhooks** — `/hooks/message` and Slack `/hooks/slack`

Your Google tokens stay on **your** server (`./data` or Docker volume).

After pulling an update that adds Tasks, **Disconnect → Connect Google** again so the new `tasks` OAuth scope is granted. Also enable **Google Tasks API** in Cloud Console.

## Quick start (Docker)

1. Create a Google Cloud **Web** OAuth client:
   - Enable [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)
   - Credentials → OAuth client ID → **Web application**
   - Authorized redirect URI: `http://localhost:3847/auth/google/callback`  
     (or `https://your.domain/auth/google/callback` in production)
   - Add yourself as an OAuth **test user** while the app is in testing

2. Configure env:

```bash
cp .env.example .env
# edit GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, WEBHOOK_SECRET, BASE_URL
```

3. Run:

```bash
docker compose up --build
```

4. Open [http://localhost:3847](http://localhost:3847) → **Connect Google**.

### Local Node (no Docker)

```bash
cp .env.example .env
npm install
npm run dev
```

## Cursor MCP (point at your instance)

Add to Cursor MCP settings or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "self-hosted-calendar": {
      "url": "https://YOUR_PUBLIC_URL/mcp"
    }
  }
}
```

For Cloud Agents / Android ([cursor.com/agents](https://cursor.com/agents)), add the same HTTP MCP URL in the **MCP** dropdown. Your server must be reachable from the internet (Tailscale, Cloudflare Tunnel, ngrok, VPS, etc.).

Then ask:

- What’s on my calendar this week?
- Create a meeting tomorrow at 3 PM titled Design sync
- Delete event &lt;id&gt;

## MCP token efficiency

Cursor pays tokens for **tool schemas** (every exposed tool) and **tool results**.

Defaults (recommended):

```env
MCP_MODE=consolidated   # only 2 tools: cal + todo
# MCP_PRETTY unset      # compact one-line JSON, slim fields (t/s/e/id)
```

| Mode | Tools exposed | Best for |
|------|---------------|----------|
| `consolidated` (default) | `cal`, `todo` | Daily use, lowest schema tokens |
| `classic` | many named tools | Compatibility / explicit tool names |

Classic filter example:

```env
MCP_MODE=classic
ENABLED_TOOLS=list_events,create_event,list_tasks,create_task,complete_task
```

Also helps: ask for narrow ranges (`limit`), avoid “dump everything”, keep Finval MCP as a separate server so calendar tools aren’t always loaded with it.

After deploy, restart Cursor / re-enable the MCP so it picks up the new 2-tool schema.
## REST API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/status` | Connection status |
| GET | `/api/events` | List (`timeMin`, `timeMax`, `q`) |
| POST | `/api/events` | Create `{ title, start, end, ... }` |
| PATCH | `/api/events/:id` | Update |
| DELETE | `/api/events/:id` | Delete |
| GET | `/api/tasklists` | List Google Task lists |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create `{ title, notes?, due? }` |
| PATCH | `/api/tasks/:id` | Update |
| POST | `/api/tasks/:id/complete` | Mark complete |
| DELETE | `/api/tasks/:id` | Delete |

### MCP task tools

`list_tasklists`, `list_tasks`, `get_task`, `create_task`, `update_task`, `complete_task`, `delete_task`, **`orchestrate_from_tasks`** (plus existing calendar tools).

### Orchestrate other MCPs from the todo list

Put an `## orchestration` block in task notes:

```text
Progress: 90% complete

## orchestration
goal: finish finval normalisation/validation
mcps: calendar, cursor-cloud
batch: true
next:
- validate remaining 10%
- mark task complete
- calendar: block 2h ship window
```

Then ask Cursor: **Orchestrate my todo list across MCPs.**

The agent should call `orchestrate_from_tasks` first, then only the listed MCPs, in batches.

## Messaging app hooks

### Generic webhook

```bash
curl -X POST "$BASE_URL/hooks/message" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"text":"list today"}'
```

Commands:

```text
list today|tomorrow|week
create tomorrow 15:00 30m standup
update <eventId> title New title
delete <eventId>
todo list
todo add Buy milk
todo done <taskId>
todo delete <taskId>
help
```

### Slack slash command

1. Create a Slack slash command (e.g. `/cal`)
2. Request URL: `https://YOUR_PUBLIC_URL/hooks/slack`
3. Put the same value as `WEBHOOK_SECRET` in Slack’s verification token field, **or** send `secret` / header `x-webhook-secret`

Example: `/cal create tomorrow 15:00 30m standup`

## Production notes

- Set a real `BASE_URL` (https) matching your OAuth redirect URI
- Change `SESSION_SECRET` and `WEBHOOK_SECRET`
- Put the app behind HTTPS (Caddy, nginx, Cloudflare)
- Persist `/data` (Docker volume already does this)
- Do not commit `.env` or `data/store.json`

## Repo layout

```text
src/           server (API, OAuth, MCP, messaging)
public/        web UI
Dockerfile
docker-compose.yml
.env.example
```

## Cost

- **This app**: free (self-hosted; you pay for your VPS/electricity)
- **Google Calendar API**: free within normal personal quotas
- **Cursor agents** (if you use MCP from Cursor): your Cursor plan / model usage
