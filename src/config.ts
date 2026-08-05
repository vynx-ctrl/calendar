import "dotenv/config";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  port: Number(process.env.PORT ?? 3847),
  baseUrl: (process.env.BASE_URL ?? "http://localhost:3847").replace(/\/$/, ""),
  sessionSecret: required("SESSION_SECRET", "dev-only-change-me"),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary",
  },
  webhookSecret: process.env.WEBHOOK_SECRET ?? "dev-webhook-secret",
  dataDir: process.env.DATA_DIR ?? join(rootDir, "data"),
  mcp: {
    /** consolidated = 2 tools (cal, todo). classic = many tools. */
    mode: (process.env.MCP_MODE ?? "consolidated").toLowerCase() === "classic"
      ? ("classic" as const)
      : ("consolidated" as const),
    /** Pretty JSON wastes tokens; default compact one-line. */
    pretty: process.env.MCP_PRETTY === "1" || process.env.MCP_PRETTY === "true",
    /** Comma list for classic mode only. Empty = all classic tools. */
    enabledTools: parseEnabledTools(process.env.ENABLED_TOOLS),
  },
};

function parseEnabledTools(raw?: string): Set<string> | null {
  if (!raw?.trim()) return null;
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function googleConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}
