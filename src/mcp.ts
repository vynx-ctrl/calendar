import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { z } from "zod";
import { calendarService } from "./calendar-service.js";
import { store } from "./store.js";

function requireConnected() {
  if (!store.isConnected()) {
    throw new Error(
      "Google Calendar is not connected. Open the web UI and click Connect Google.",
    );
  }
}

export function createMcpServer() {
  const server = new McpServer({
    name: "self-hosted-calendar",
    version: "1.0.0",
  });

  server.tool(
    "list_events",
    "List calendar events in a time range",
    {
      timeMin: z.string().optional().describe("ISO start (default: now)"),
      timeMax: z.string().optional().describe("ISO end (default: +7 days)"),
      query: z.string().optional().describe("Optional text search"),
      maxResults: z.number().int().positive().max(100).optional(),
    },
    async (args) => {
      requireConnected();
      const events = await calendarService.listEvents(args);
      return {
        content: [{ type: "text", text: JSON.stringify({ events }, null, 2) }],
      };
    },
  );

  server.tool(
    "get_event",
    "Get a calendar event by id",
    { eventId: z.string() },
    async ({ eventId }) => {
      requireConnected();
      const event = await calendarService.getEvent(eventId);
      return {
        content: [{ type: "text", text: JSON.stringify({ event }, null, 2) }],
      };
    },
  );

  server.tool(
    "create_event",
    "Create a calendar event",
    {
      title: z.string(),
      start: z.string().describe("ISO datetime or YYYY-MM-DD"),
      end: z.string().describe("ISO datetime or YYYY-MM-DD"),
      description: z.string().optional(),
      location: z.string().optional(),
      attendees: z.array(z.string()).optional(),
      timeZone: z.string().optional(),
    },
    async (args) => {
      requireConnected();
      const event = await calendarService.createEvent(args);
      return {
        content: [{ type: "text", text: JSON.stringify({ event }, null, 2) }],
      };
    },
  );

  server.tool(
    "update_event",
    "Update an existing calendar event",
    {
      eventId: z.string(),
      title: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      attendees: z.array(z.string()).optional(),
      timeZone: z.string().optional(),
    },
    async ({ eventId, ...patch }) => {
      requireConnected();
      const event = await calendarService.updateEvent(eventId, patch);
      return {
        content: [{ type: "text", text: JSON.stringify({ event }, null, 2) }],
      };
    },
  );

  server.tool(
    "delete_event",
    "Delete a calendar event by id",
    { eventId: z.string() },
    async ({ eventId }) => {
      requireConnected();
      const result = await calendarService.deleteEvent(eventId);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    "calendar_status",
    "Show whether Google Calendar is connected",
    {},
    async () => {
      const tokens = store.getTokens();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                connected: store.isConnected(),
                email: tokens?.email ?? null,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  return server;
}

/**
 * Stateless Streamable HTTP MCP handler (one server+transport per request).
 * Compatible with Cursor Cloud Agents HTTP MCP.
 */
export async function handleMcpPost(req: Request, res: Response) {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

export async function handleMcpGet(_req: Request, res: Response) {
  res.status(405).json({
    error:
      "This MCP endpoint expects POST (Streamable HTTP). Configure Cursor with url pointing here.",
  });
}
