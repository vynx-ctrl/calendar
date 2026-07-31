import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { z } from "zod";
import { calendarService } from "./calendar-service.js";
import { tasksService } from "./tasks-service.js";
import { store } from "./store.js";
import { config } from "./config.js";
import { mcpText, slimEvent, slimTask } from "./mcp-compact.js";

function requireConnected() {
  if (!store.isConnected()) {
    throw new Error("Google not connected. Open UI → Connect Google.");
  }
}

function ok(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: mcpText(data, config.mcp.pretty),
      },
    ],
  };
}

function registerConsolidatedTools(server: McpServer) {
  server.tool(
    "cal",
    "Calendar CRUD. action=list|get|create|update|delete|status",
    {
      action: z.enum(["list", "get", "create", "update", "delete", "status"]),
      id: z.string().optional(),
      title: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      timeMin: z.string().optional(),
      timeMax: z.string().optional(),
      q: z.string().optional(),
      limit: z.number().int().positive().max(50).optional(),
      timeZone: z.string().optional(),
    },
    async (args) => {
      if (args.action === "status") {
        const tokens = store.getTokens();
        return ok({
          connected: store.isConnected(),
          email: tokens?.email ?? null,
        });
      }
      requireConnected();
      switch (args.action) {
        case "list": {
          const events = await calendarService.listEvents({
            timeMin: args.timeMin,
            timeMax: args.timeMax,
            query: args.q,
            maxResults: args.limit ?? 20,
          });
          return ok({
            n: events.length,
            events: events.map(slimEvent),
          });
        }
        case "get": {
          if (!args.id) throw new Error("id required");
          return ok(slimEvent(await calendarService.getEvent(args.id)));
        }
        case "create": {
          if (!args.title || !args.start || !args.end) {
            throw new Error("title,start,end required");
          }
          return ok(
            slimEvent(
              await calendarService.createEvent({
                title: args.title,
                start: args.start,
                end: args.end,
                description: args.description,
                location: args.location,
                timeZone: args.timeZone,
              }),
            ),
          );
        }
        case "update": {
          if (!args.id) throw new Error("id required");
          return ok(
            slimEvent(
              await calendarService.updateEvent(args.id, {
                title: args.title,
                start: args.start,
                end: args.end,
                description: args.description,
                location: args.location,
                timeZone: args.timeZone,
              }),
            ),
          );
        }
        case "delete": {
          if (!args.id) throw new Error("id required");
          return ok(await calendarService.deleteEvent(args.id));
        }
      }
    },
  );

  server.tool(
    "todo",
    "Google Tasks CRUD. action=list|get|create|update|complete|delete|lists",
    {
      action: z.enum([
        "list",
        "get",
        "create",
        "update",
        "complete",
        "delete",
        "lists",
      ]),
      id: z.string().optional(),
      title: z.string().optional(),
      notes: z.string().optional(),
      due: z.string().optional(),
      taskListId: z.string().optional(),
      showCompleted: z.boolean().optional(),
      limit: z.number().int().positive().max(50).optional(),
    },
    async (args) => {
      requireConnected();
      switch (args.action) {
        case "lists":
          return ok({ lists: await tasksService.listTaskLists() });
        case "list": {
          const result = await tasksService.listTasks({
            taskListId: args.taskListId,
            showCompleted: args.showCompleted ?? false,
            maxResults: args.limit ?? 30,
          });
          return ok({
            n: result.tasks.length,
            tasks: result.tasks.map(slimTask),
          });
        }
        case "get": {
          if (!args.id) throw new Error("id required");
          return ok(
            slimTask(await tasksService.getTask(args.id, args.taskListId)),
          );
        }
        case "create": {
          if (!args.title) throw new Error("title required");
          return ok(
            slimTask(
              await tasksService.createTask({
                title: args.title,
                notes: args.notes,
                due: args.due,
                taskListId: args.taskListId,
              }),
            ),
          );
        }
        case "update": {
          if (!args.id) throw new Error("id required");
          return ok(
            slimTask(
              await tasksService.updateTask(args.id, {
                title: args.title,
                notes: args.notes,
                due: args.due,
                taskListId: args.taskListId,
              }),
            ),
          );
        }
        case "complete": {
          if (!args.id) throw new Error("id required");
          return ok(
            slimTask(
              await tasksService.completeTask(args.id, args.taskListId),
            ),
          );
        }
        case "delete": {
          if (!args.id) throw new Error("id required");
          return ok(await tasksService.deleteTask(args.id, args.taskListId));
        }
      }
    },
  );
}

function registerClassicTools(server: McpServer) {
  const enabled = config.mcp.enabledTools;

  const allow = (name: string) => !enabled || enabled.has(name);

  if (allow("calendar_status")) {
    server.tool("calendar_status", "Connection status", {}, async () => {
      const tokens = store.getTokens();
      return ok({
        connected: store.isConnected(),
        email: tokens?.email ?? null,
      });
    });
  }

  if (allow("list_events")) {
    server.tool(
      "list_events",
      "List events",
      {
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
        query: z.string().optional(),
        maxResults: z.number().int().positive().max(50).optional(),
      },
      async (args) => {
        requireConnected();
        const events = await calendarService.listEvents({
          ...args,
          maxResults: args.maxResults ?? 20,
        });
        return ok({ n: events.length, events: events.map(slimEvent) });
      },
    );
  }

  if (allow("get_event")) {
    server.tool("get_event", "Get event", { eventId: z.string() }, async ({ eventId }) => {
      requireConnected();
      return ok(slimEvent(await calendarService.getEvent(eventId)));
    });
  }

  if (allow("create_event")) {
    server.tool(
      "create_event",
      "Create event",
      {
        title: z.string(),
        start: z.string(),
        end: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
        timeZone: z.string().optional(),
      },
      async (args) => {
        requireConnected();
        return ok(slimEvent(await calendarService.createEvent(args)));
      },
    );
  }

  if (allow("update_event")) {
    server.tool(
      "update_event",
      "Update event",
      {
        eventId: z.string(),
        title: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        timeZone: z.string().optional(),
      },
      async ({ eventId, ...patch }) => {
        requireConnected();
        return ok(slimEvent(await calendarService.updateEvent(eventId, patch)));
      },
    );
  }

  if (allow("delete_event")) {
    server.tool("delete_event", "Delete event", { eventId: z.string() }, async ({ eventId }) => {
      requireConnected();
      return ok(await calendarService.deleteEvent(eventId));
    });
  }

  if (allow("list_tasks")) {
    server.tool(
      "list_tasks",
      "List tasks",
      {
        taskListId: z.string().optional(),
        showCompleted: z.boolean().optional(),
        maxResults: z.number().int().positive().max(50).optional(),
      },
      async (args) => {
        requireConnected();
        const result = await tasksService.listTasks({
          ...args,
          maxResults: args.maxResults ?? 30,
        });
        return ok({ n: result.tasks.length, tasks: result.tasks.map(slimTask) });
      },
    );
  }

  if (allow("create_task")) {
    server.tool(
      "create_task",
      "Create task",
      {
        title: z.string(),
        notes: z.string().optional(),
        due: z.string().optional(),
        taskListId: z.string().optional(),
      },
      async (args) => {
        requireConnected();
        return ok(slimTask(await tasksService.createTask(args)));
      },
    );
  }

  if (allow("complete_task")) {
    server.tool(
      "complete_task",
      "Complete task",
      { taskId: z.string(), taskListId: z.string().optional() },
      async ({ taskId, taskListId }) => {
        requireConnected();
        return ok(slimTask(await tasksService.completeTask(taskId, taskListId)));
      },
    );
  }

  if (allow("update_task")) {
    server.tool(
      "update_task",
      "Update task",
      {
        taskId: z.string(),
        title: z.string().optional(),
        notes: z.string().optional(),
        due: z.string().optional(),
        taskListId: z.string().optional(),
      },
      async ({ taskId, ...patch }) => {
        requireConnected();
        return ok(slimTask(await tasksService.updateTask(taskId, patch)));
      },
    );
  }

  if (allow("delete_task")) {
    server.tool(
      "delete_task",
      "Delete task",
      { taskId: z.string(), taskListId: z.string().optional() },
      async ({ taskId, taskListId }) => {
        requireConnected();
        return ok(await tasksService.deleteTask(taskId, taskListId));
      },
    );
  }

  if (allow("get_task")) {
    server.tool(
      "get_task",
      "Get task",
      { taskId: z.string(), taskListId: z.string().optional() },
      async ({ taskId, taskListId }) => {
        requireConnected();
        return ok(slimTask(await tasksService.getTask(taskId, taskListId)));
      },
    );
  }

  if (allow("list_tasklists")) {
    server.tool("list_tasklists", "List task lists", {}, async () => {
      requireConnected();
      return ok({ lists: await tasksService.listTaskLists() });
    });
  }
}

export function createMcpServer() {
  const server = new McpServer({
    name: "self-hosted-calendar",
    version: "1.3.0",
  });

  if (config.mcp.mode === "classic") {
    registerClassicTools(server);
  } else {
    registerConsolidatedTools(server);
  }

  return server;
}

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
    error: "POST Streamable HTTP MCP only",
  });
}
