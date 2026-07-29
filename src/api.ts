import { Router } from "express";
import { z } from "zod";
import { calendarService } from "./calendar-service.js";
import { store } from "./store.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    connected: store.isConnected(),
    email: store.getTokens()?.email ?? null,
  });
});

apiRouter.get("/status", (_req, res) => {
  const tokens = store.getTokens();
  res.json({
    connected: store.isConnected(),
    email: tokens?.email ?? null,
  });
});

apiRouter.get("/events", async (req, res) => {
  try {
    const events = await calendarService.listEvents({
      timeMin: typeof req.query.timeMin === "string" ? req.query.timeMin : undefined,
      timeMax: typeof req.query.timeMax === "string" ? req.query.timeMax : undefined,
      query: typeof req.query.q === "string" ? req.query.q : undefined,
      maxResults: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ events });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.get("/events/:id", async (req, res) => {
  try {
    const event = await calendarService.getEvent(req.params.id);
    res.json({ event });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const eventSchema = z.object({
  title: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
  timeZone: z.string().optional(),
});

apiRouter.post("/events", async (req, res) => {
  try {
    const input = eventSchema.parse(req.body);
    const event = await calendarService.createEvent(input);
    res.status(201).json({ event });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.patch("/events/:id", async (req, res) => {
  try {
    const input = eventSchema.partial().parse(req.body);
    const event = await calendarService.updateEvent(req.params.id, input);
    res.json({ event });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.delete("/events/:id", async (req, res) => {
  try {
    const result = await calendarService.deleteEvent(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
