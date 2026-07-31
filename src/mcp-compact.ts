/** Strip empty values and optionally shorten keys for MCP payloads. */

export function compact<T>(value: T): T {
  return compactValue(value) as T;
}

function compactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(compactValue).filter((v) => v !== undefined);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      const cv = compactValue(v);
      if (cv === undefined) continue;
      out[k] = cv;
    }
    return out;
  }
  return value;
}

export function mcpText(data: unknown, pretty = false): string {
  const payload = compact(data);
  return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
}

/** Short event shape for list/get responses */
export function slimEvent(e: {
  id?: string | null;
  title?: string;
  start?: string;
  end?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
  status?: string;
}) {
  return compact({
    id: e.id,
    t: e.title,
    s: e.start,
    e: e.end,
    loc: e.location || undefined,
    // omit long description/htmlLink unless present and short
    d:
      e.description && e.description.length <= 160
        ? e.description
        : e.description
          ? `${e.description.slice(0, 157)}...`
          : undefined,
  });
}

export function slimTask(t: {
  id?: string | null;
  title?: string;
  notes?: string;
  status?: string;
  due?: string;
  taskListId?: string;
}) {
  return compact({
    id: t.id,
    t: t.title,
    st: t.status,
    due: t.due || undefined,
    n:
      t.notes && t.notes.length <= 160
        ? t.notes
        : t.notes
          ? `${t.notes.slice(0, 157)}...`
          : undefined,
  });
}
