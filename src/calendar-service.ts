import { google, type calendar_v3 } from "googleapis";
import { config } from "./config.js";
import { getAuthedClient } from "./google-auth.js";

export type EventInput = {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
  timeZone?: string;
};

function calendar() {
  return getAuthedClient().then((auth) =>
    google.calendar({ version: "v3", auth }),
  );
}

function toEventBody(input: EventInput): calendar_v3.Schema$Event {
  const timeZone = input.timeZone ?? "UTC";
  const isDateOnly = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  return {
    summary: input.title,
    description: input.description,
    location: input.location,
    start: isDateOnly(input.start)
      ? { date: input.start }
      : { dateTime: input.start, timeZone },
    end: isDateOnly(input.end)
      ? { date: input.end }
      : { dateTime: input.end, timeZone },
    attendees: input.attendees?.map((email) => ({ email })),
  };
}

export function serializeEvent(event: calendar_v3.Schema$Event) {
  return {
    id: event.id,
    title: event.summary ?? "(no title)",
    description: event.description ?? "",
    location: event.location ?? "",
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: event.end?.dateTime ?? event.end?.date ?? "",
    htmlLink: event.htmlLink ?? "",
    status: event.status ?? "",
    attendees:
      event.attendees?.map((a) => ({
        email: a.email,
        responseStatus: a.responseStatus,
      })) ?? [],
  };
}

export const calendarService = {
  async listEvents(opts: {
    timeMin?: string;
    timeMax?: string;
    query?: string;
    maxResults?: number;
  } = {}) {
    const cal = await calendar();
    const now = new Date();
    const timeMin = opts.timeMin ?? now.toISOString();
    const timeMax =
      opts.timeMax ??
      new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await cal.events.list({
      calendarId: config.google.calendarId,
      timeMin,
      timeMax,
      q: opts.query,
      maxResults: opts.maxResults ?? 50,
      singleEvents: true,
      orderBy: "startTime",
    });

    return (res.data.items ?? []).map(serializeEvent);
  },

  async getEvent(eventId: string) {
    const cal = await calendar();
    const res = await cal.events.get({
      calendarId: config.google.calendarId,
      eventId,
    });
    return serializeEvent(res.data);
  },

  async createEvent(input: EventInput) {
    const cal = await calendar();
    const res = await cal.events.insert({
      calendarId: config.google.calendarId,
      requestBody: toEventBody(input),
      sendUpdates: "all",
    });
    return serializeEvent(res.data);
  },

  async updateEvent(eventId: string, input: Partial<EventInput>) {
    const cal = await calendar();
    const existing = await cal.events.get({
      calendarId: config.google.calendarId,
      eventId,
    });

    const merged: EventInput = {
      title: input.title ?? existing.data.summary ?? "Untitled",
      start:
        input.start ??
        existing.data.start?.dateTime ??
        existing.data.start?.date ??
        new Date().toISOString(),
      end:
        input.end ??
        existing.data.end?.dateTime ??
        existing.data.end?.date ??
        new Date().toISOString(),
      description: input.description ?? existing.data.description ?? undefined,
      location: input.location ?? existing.data.location ?? undefined,
      attendees:
        input.attendees ??
        existing.data.attendees
          ?.map((a) => a.email)
          .filter((e): e is string => Boolean(e)),
      timeZone: input.timeZone,
    };

    const res = await cal.events.patch({
      calendarId: config.google.calendarId,
      eventId,
      requestBody: toEventBody(merged),
      sendUpdates: "all",
    });
    return serializeEvent(res.data);
  },

  async deleteEvent(eventId: string) {
    const cal = await calendar();
    await cal.events.delete({
      calendarId: config.google.calendarId,
      eventId,
      sendUpdates: "all",
    });
    return { deleted: true, id: eventId };
  },
};
