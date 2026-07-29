# calendar

Google Calendar CRUD via **Cursor MCP** (no custom calendar app required).

## What you get

Once MCP is connected, ask Cursor things like:

- What’s on my calendar tomorrow?
- Create a meeting with Alex at 3 PM.
- Move my dentist appointment to Friday.
- Delete the standup on Monday.

Tools exposed by the open-source server include: list / create / update / delete events, search, free/busy, and invite responses.

## Option A — Self-hosted (recommended for local control)

Uses [`@cocal/google-calendar-mcp`](https://github.com/nspady/google-calendar-mcp) (nspady). Credentials stay on your machine.

### 1. Google Cloud

1. Open [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)
4. **Credentials** → Create credentials → **OAuth client ID** → type **Desktop app**
5. Download the JSON and save it somewhere **outside** this repo, e.g. `~/secrets/gcp-oauth.keys.json`
6. OAuth consent screen → add your Google email as a **test user**

### 2. Cursor MCP config

**Cursor → Settings → MCP → Add new global MCP server**, or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "npx",
      "args": ["-y", "@cocal/google-calendar-mcp"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/ABSOLUTE/PATH/TO/gcp-oauth.keys.json"
      }
    }
  }
}
```

Or copy the project example:

```bash
cp .cursor/mcp.json.example ~/.cursor/mcp.json
# then edit the GOOGLE_OAUTH_CREDENTIALS path
```

### 3. Authenticate

Reload Cursor (`Developer: Reload Window`). In Agent chat:

```text
Authenticate with Google Calendar
```

Complete the browser OAuth flow. Then try a CRUD prompt.

**Manual re-auth** (if tokens expire in test mode ~7 days):

```bash
export GOOGLE_OAUTH_CREDENTIALS="/ABSOLUTE/PATH/TO/gcp-oauth.keys.json"
npx -y @cocal/google-calendar-mcp auth
```

To avoid weekly expiry: OAuth consent screen → **Publish app** (unverified apps still work for your own account).

## Option B — Hosted CalendarMCP (fastest)

1. Get an API key at [calendarmcp.ai/app](https://calendarmcp.ai/app) and connect Google
2. Add to `~/.cursor/mcp.json` (see `.cursor/mcp.hosted.example.json`):

```json
{
  "mcpServers": {
    "calendar": {
      "url": "https://calendarmcp.ai/api/mcp",
      "headers": {
        "Authorization": "Bearer cmcp_YOUR_API_KEY"
      }
    }
  }
}
```

3. Reload Cursor and test with the same prompts as above

## Project-scoped config

To limit the server to this repo only, copy an example into `.cursor/mcp.json` (do **not** commit real keys or absolute home paths with secrets):

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
```

## Cloud Agents note

This GitHub Cloud Agent environment does not have Google Calendar MCP attached by default. Configure MCP in **Cursor Desktop** (or your cloud environment’s MCP settings), authorize Google, then calendar CRUD works in Agent chat.

## Security

- Never commit `gcp-oauth.keys.json`, API keys, or tokens (see `.gitignore`)
- Prefer absolute paths outside the repo for OAuth files
