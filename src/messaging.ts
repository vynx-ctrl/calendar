import { Router, type Request, type Response } from "express";
import { calendarService } from "./calendar-service.js";
import { tasksService } from "./tasks-service.js";
import {
  HELP_TEXT,
  parseMessageCommand,
} from "./message-parser.js";
import { config } from "./config.js";
import { store } from "./store.js";

function unauthorized(res: Response) {
  return res.status(401).json({ error: "Unauthorized" });
}

function checkSecret(req: Request): boolean {
  const header = req.header("x-webhook-secret");
  const bodySecret =
    typeof req.body?.secret === "string" ? req.body.secret : undefined;
  const query =
    typeof req.query.secret === "string" ? req.query.secret : undefined;
  const provided = header || bodySecret || query;
  return Boolean(provided && provided === config.webhookSecret);
}

async function runCommand(text: string) {
  const cmd = parseMessageCommand(text);
  const now = new Date();

  switch (cmd.action) {
    case "help":
      return HELP_TEXT;
    case "list": {
      let timeMin: Date;
      let timeMax: Date;
      if (cmd.range === "today") {
        timeMin = new Date(now);
        timeMin.setHours(0, 0, 0, 0);
        timeMax = new Date(timeMin);
        timeMax.setHours(23, 59, 59, 999);
      } else if (cmd.range === "tomorrow") {
        timeMin = new Date(now);
        timeMin.setDate(timeMin.getDate() + 1);
        timeMin.setHours(0, 0, 0, 0);
        timeMax = new Date(timeMin);
        timeMax.setHours(23, 59, 59, 999);
      } else {
        timeMin = now;
        timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      const events = await calendarService.listEvents({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      });
      if (!events.length) return `No events (${cmd.range}).`;
      return events
        .map(
          (e) =>
            `• ${e.start} → ${e.end}\n  ${e.title}\n  id: ${e.id}`,
        )
        .join("\n\n");
    }
    case "create": {
      const event = await calendarService.createEvent({
        title: cmd.title,
        start: cmd.start.toISOString(),
        end: cmd.end.toISOString(),
      });
      return `Created: ${event.title}\n${event.start} → ${event.end}\nid: ${event.id}`;
    }
    case "update": {
      const event = await calendarService.updateEvent(cmd.id, {
        title: cmd.title,
        start: cmd.start?.toISOString(),
        end: cmd.end?.toISOString(),
      });
      return `Updated: ${event.title}\n${event.start} → ${event.end}\nid: ${event.id}`;
    }
    case "delete": {
      await calendarService.deleteEvent(cmd.id);
      return `Deleted event ${cmd.id}`;
    }
    case "todo_list": {
      const { tasks } = await tasksService.listTasks();
      if (!tasks.length) return "No open tasks.";
      return tasks
        .map((t) => `• ${t.title}${t.due ? ` (due ${t.due})` : ""}\n  id: ${t.id}`)
        .join("\n\n");
    }
    case "todo_add": {
      const task = await tasksService.createTask({ title: cmd.title });
      return `Task created: ${task.title}\nid: ${task.id}`;
    }
    case "todo_done": {
      const task = await tasksService.completeTask(cmd.id);
      return `Completed: ${task.title}`;
    }
    case "todo_delete": {
      await tasksService.deleteTask(cmd.id);
      return `Deleted task ${cmd.id}`;
    }
  }
}

export const messagingRouter = Router();

messagingRouter.post("/message", async (req, res) => {
  try {
    if (!checkSecret(req)) return unauthorized(res);
    if (!store.isConnected()) {
      return res.status(400).json({
        error: "Google not connected. Open /auth/google first.",
      });
    }
    const text =
      (typeof req.body?.text === "string" && req.body.text) ||
      (typeof req.body?.message === "string" && req.body.message) ||
      "";
    if (!text.trim()) {
      return res.status(400).json({ error: "Missing text", help: HELP_TEXT });
    }
    const reply = await runCommand(text);
    return res.json({ ok: true, reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

messagingRouter.post("/slack", async (req, res) => {
  try {
    if (req.body?.type === "url_verification") {
      return res.json({ challenge: req.body.challenge });
    }

    const token = req.body?.token || req.body?.secret;
    const headerOk = checkSecret(req);
    const formOk = token === config.webhookSecret;
    if (!headerOk && !formOk) return unauthorized(res);

    if (!store.isConnected()) {
      return res.json({
        response_type: "ephemeral",
        text: "Google not connected. Open the app /auth/google first.",
      });
    }

    const text = String(req.body?.text ?? req.body?.event?.text ?? "").trim();
    const reply = await runCommand(text || "help");
    return res.json({
      response_type: "ephemeral",
      text: reply,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.json({
      response_type: "ephemeral",
      text: `Error: ${message}`,
    });
  }
});
