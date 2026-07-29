/**
 * Tiny natural-ish command parser for messaging webhooks.
 * Examples:
 *   create standup tomorrow 15:00 30m
 *   list today
 *   list week
 *   update <id> title New title
 *   delete <id>
 */

export type ParsedCommand =
  | { action: "list"; range: "today" | "week" | "tomorrow" }
  | {
      action: "create";
      title: string;
      start: Date;
      end: Date;
    }
  | { action: "update"; id: string; title?: string; start?: Date; end?: Date }
  | { action: "delete"; id: string }
  | { action: "help" };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function parseWhen(token: string, now = new Date()): Date | null {
  const lower = token.toLowerCase();
  if (lower === "today") return startOfDay(now);
  if (lower === "tomorrow") return startOfDay(addDays(now, 1));
  // HH:mm today/default
  const hm = /^(\d{1,2}):(\d{2})$/.exec(token);
  if (hm) {
    const d = new Date(now);
    d.setHours(Number(hm[1]), Number(hm[2]), 0, 0);
    return d;
  }
  // ISO-ish
  const parsed = Date.parse(token);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  return null;
}

function parseDuration(token: string): number | null {
  const m = /^(\d+)\s*(m|min|mins|h|hr|hrs|hour|hours)$/i.exec(token);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("h")) return n * 60;
  return n;
}

export function parseMessageCommand(text: string): ParsedCommand {
  const raw = text.trim().replace(/^\/(?:cal|calendar)\s+/i, "");
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { action: "help" };

  const verb = parts[0].toLowerCase();

  if (verb === "help" || verb === "?") return { action: "help" };

  if (verb === "list" || verb === "ls" || verb === "show") {
    const range = (parts[1] ?? "week").toLowerCase();
    if (range === "today" || range === "tomorrow" || range === "week") {
      return { action: "list", range };
    }
    return { action: "list", range: "week" };
  }

  if (verb === "delete" || verb === "remove" || verb === "cancel") {
    if (!parts[1]) return { action: "help" };
    return { action: "delete", id: parts[1] };
  }

  if (verb === "update" || verb === "edit" || verb === "move") {
    if (!parts[1]) return { action: "help" };
    const id = parts[1];
    const rest = parts.slice(2);
    const out: ParsedCommand = { action: "update", id };
    // update <id> title ...
    if (rest[0]?.toLowerCase() === "title") {
      return { action: "update", id, title: rest.slice(1).join(" ") };
    }
    // update <id> tomorrow 15:00 30m
    const when = rest[0] ? parseWhen(rest[0]) : null;
    const time = rest[1] ? parseWhen(rest[1], when ?? new Date()) : null;
    const start = time ?? when;
    const dur = rest[2] ? parseDuration(rest[2]) : 30;
    if (start) {
      const end = new Date(start.getTime() + (dur ?? 30) * 60_000);
      return { action: "update", id, start, end };
    }
    if (rest.length) return { action: "update", id, title: rest.join(" ") };
    return out;
  }

  if (verb === "create" || verb === "add" || verb === "new") {
    // create [when] [HH:mm] [duration] title...
    // create tomorrow 15:00 30m standup
    let i = 1;
    let day = new Date();
    const maybeDay = parts[i] ? parseWhen(parts[i]) : null;
    if (maybeDay && /^(today|tomorrow)$/i.test(parts[i])) {
      day = maybeDay;
      i += 1;
    }
    let start = new Date(day);
    const maybeTime = parts[i] ? parseWhen(parts[i], day) : null;
    if (maybeTime && /^\d{1,2}:\d{2}$/.test(parts[i])) {
      start = maybeTime;
      i += 1;
    } else {
      start.setHours(start.getHours() + 1, 0, 0, 0);
    }
    let minutes = 30;
    const maybeDur = parts[i] ? parseDuration(parts[i]) : null;
    if (maybeDur != null) {
      minutes = maybeDur;
      i += 1;
    }
    const title = parts.slice(i).join(" ") || "Untitled";
    const end = new Date(start.getTime() + minutes * 60_000);
    return { action: "create", title, start, end };
  }

  return { action: "help" };
}

export const HELP_TEXT = `Calendar commands:
• list today|tomorrow|week
• create tomorrow 15:00 30m standup
• update <eventId> title New title
• update <eventId> tomorrow 16:00 30m
• delete <eventId>
• help`;
