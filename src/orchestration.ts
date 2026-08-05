export type OrchestrationPlan = {
  taskId: string;
  title: string;
  goal?: string;
  mcps: string[];
  next: string[];
  batch: boolean;
  rawNotes: string;
};

/**
 * Parse optional orchestration block from Google Task notes.
 *
 * Example notes:
 * Progress: 90%
 *
 * ## orchestration
 * goal: finish finval normalisation/validation
 * mcps: calendar, cursor-cloud, github
 * batch: true
 * next:
 * - validate remaining 10%
 * - mark task complete
 * - calendar: block 2h ship window
 */
export function parseOrchestrationNotes(
  taskId: string,
  title: string,
  notes: string,
): OrchestrationPlan {
  const rawNotes = notes ?? "";
  const lower = rawNotes.toLowerCase();
  const marker = lower.indexOf("## orchestration");
  if (marker === -1) {
    return {
      taskId,
      title,
      mcps: [],
      next: [],
      batch: true,
      rawNotes,
      goal: undefined,
    };
  }

  const block = rawNotes.slice(marker).split(/\n##\s+/)[0] ?? rawNotes.slice(marker);
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let goal: string | undefined;
  let mcps: string[] = [];
  let batch = true;
  const next: string[] = [];
  let inNext = false;

  for (const line of lines) {
    if (/^##\s*orchestration/i.test(line)) continue;
    if (/^next\s*:/i.test(line)) {
      inNext = true;
      const inline = line.replace(/^next\s*:/i, "").trim();
      if (inline) next.push(inline);
      continue;
    }
    if (inNext) {
      if (/^[a-z_]+\s*:/i.test(line) && !line.startsWith("-")) {
        inNext = false;
      } else {
        next.push(line.replace(/^[-*]\s*/, "").trim());
        continue;
      }
    }
    const goalMatch = /^goal\s*:\s*(.+)$/i.exec(line);
    if (goalMatch) {
      goal = goalMatch[1].trim();
      continue;
    }
    const mcpMatch = /^mcps?\s*:\s*(.+)$/i.exec(line);
    if (mcpMatch) {
      mcps = mcpMatch[1]
        .split(/[, ]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    const batchMatch = /^batch\s*:\s*(.+)$/i.exec(line);
    if (batchMatch) {
      batch = !/^(false|0|no)$/i.test(batchMatch[1].trim());
    }
  }

  return { taskId, title, goal, mcps, next, batch, rawNotes };
}

export function buildOrchestrationPlaybook(
  plans: OrchestrationPlan[],
): {
  summary: string;
  instructions: string[];
  tasks: OrchestrationPlan[];
} {
  const active = plans.filter((p) => p.title);
  const instructions = [
    "Start from Google Tasks (list_tasks / orchestrate_from_tasks) before other MCPs.",
    "Batch related MCP calls in one agent turn when batch:true.",
    "Update or complete the task after meaningful progress — avoid status spam.",
    "Prefer calendar MCP for deadlines/focus blocks; use other MCPs only as listed in mcps:.",
    "If a task has no ## orchestration block, infer next steps from the title/notes once, then write them back into notes.",
  ];

  if (!active.length) {
    return {
      summary: "No open tasks to orchestrate.",
      instructions,
      tasks: [],
    };
  }

  const withPlan = active.filter((p) => p.mcps.length || p.next.length || p.goal);
  const summary = withPlan.length
    ? `Orchestrating ${withPlan.length}/${active.length} open task(s) with explicit MCP plans.`
    : `${active.length} open task(s); none have ## orchestration yet — invent a minimal plan and persist it in notes.`;

  return { summary, instructions, tasks: active };
}

export function formatOrchestrationNotes(input: {
  progress?: string;
  goal: string;
  mcps: string[];
  next: string[];
  batch?: boolean;
}): string {
  const lines = [
    input.progress ?? "",
    "",
    "## orchestration",
    `goal: ${input.goal}`,
    `mcps: ${input.mcps.join(", ")}`,
    `batch: ${input.batch === false ? "false" : "true"}`,
    "next:",
    ...input.next.map((n) => `- ${n}`),
  ];
  return lines.filter((l, i) => !(l === "" && i === 0)).join("\n").trim() + "\n";
}
