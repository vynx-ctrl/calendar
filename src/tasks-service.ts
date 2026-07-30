import { google, type tasks_v1 } from "googleapis";
import { getAuthedClient } from "./google-auth.js";
import {
  buildOrchestrationPlaybook,
  parseOrchestrationNotes,
} from "./orchestration.js";

export type TaskInput = {
  title: string;
  notes?: string;
  due?: string;
  status?: "needsAction" | "completed";
  taskListId?: string;
};

async function tasksClient() {
  const auth = await getAuthedClient();
  return google.tasks({ version: "v1", auth });
}

function serializeTask(task: tasks_v1.Schema$Task, taskListId: string) {
  const id = task.id ?? "";
  const title = task.title ?? "(no title)";
  const notes = task.notes ?? "";
  return {
    id,
    title,
    notes,
    status: task.status ?? "needsAction",
    due: task.due ?? "",
    completed: task.completed ?? "",
    updated: task.updated ?? "",
    taskListId,
    parent: task.parent ?? "",
    position: task.position ?? "",
    orchestration: parseOrchestrationNotes(id, title, notes),
  };
}

export const tasksService = {
  async listTaskLists() {
    const tasks = await tasksClient();
    const res = await tasks.tasklists.list({ maxResults: 100 });
    return (res.data.items ?? []).map((list) => ({
      id: list.id,
      title: list.title ?? "Untitled list",
      updated: list.updated ?? "",
    }));
  },

  async resolveTaskListId(taskListId?: string) {
    if (taskListId) return taskListId;
    const lists = await this.listTaskLists();
    if (!lists.length) {
      throw new Error("No Google Task lists found on this account.");
    }
    const def = lists.find((l) => l.title?.toLowerCase() === "my tasks");
    return def?.id ?? lists[0].id!;
  },

  async listTasks(opts: {
    taskListId?: string;
    showCompleted?: boolean;
    maxResults?: number;
  } = {}) {
    const tasks = await tasksClient();
    const taskListId = await this.resolveTaskListId(opts.taskListId);
    const res = await tasks.tasks.list({
      tasklist: taskListId,
      showCompleted: opts.showCompleted ?? false,
      showHidden: false,
      maxResults: opts.maxResults ?? 100,
    });
    return {
      taskListId,
      tasks: (res.data.items ?? [])
        .filter((t) => t.id && t.title !== null)
        .map((t) => serializeTask(t, taskListId)),
    };
  },

  async getTask(taskId: string, taskListId?: string) {
    const tasks = await tasksClient();
    const listId = await this.resolveTaskListId(taskListId);
    const res = await tasks.tasks.get({
      tasklist: listId,
      task: taskId,
    });
    return serializeTask(res.data, listId);
  },

  async createTask(input: TaskInput) {
    const tasks = await tasksClient();
    const taskListId = await this.resolveTaskListId(input.taskListId);
    const res = await tasks.tasks.insert({
      tasklist: taskListId,
      requestBody: {
        title: input.title,
        notes: input.notes,
        due: input.due,
        status: input.status ?? "needsAction",
      },
    });
    return serializeTask(res.data, taskListId);
  },

  async updateTask(
    taskId: string,
    input: Partial<TaskInput> & { taskListId?: string },
  ) {
    const tasks = await tasksClient();
    const taskListId = await this.resolveTaskListId(input.taskListId);
    const res = await tasks.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      requestBody: {
        title: input.title,
        notes: input.notes,
        due: input.due,
        status: input.status,
      },
    });
    return serializeTask(res.data, taskListId);
  },

  async completeTask(taskId: string, taskListId?: string) {
    return this.updateTask(taskId, {
      taskListId,
      status: "completed",
    });
  },

  async deleteTask(taskId: string, taskListId?: string) {
    const tasks = await tasksClient();
    const listId = await this.resolveTaskListId(taskListId);
    await tasks.tasks.delete({
      tasklist: listId,
      task: taskId,
    });
    return { deleted: true, id: taskId, taskListId: listId };
  },

  async orchestrateFromTasks(opts: {
    taskListId?: string;
    showCompleted?: boolean;
  } = {}) {
    const { taskListId, tasks } = await this.listTasks({
      taskListId: opts.taskListId,
      showCompleted: opts.showCompleted ?? false,
    });
    const plans = tasks.map((t) =>
      parseOrchestrationNotes(t.id ?? "", t.title, t.notes ?? ""),
    );
    return {
      taskListId,
      ...buildOrchestrationPlaybook(plans),
    };
  },
};
