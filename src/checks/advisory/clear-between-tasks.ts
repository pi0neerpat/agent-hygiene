import type { Check, ScanContext, CheckResult } from "../types.js";

export const clearBetweenTasksCheck: Check = {
  id: "clear-between-tasks",
  name: "Use /clear between tasks",
  technique: 12,
  tier: "advisory",
  category: "habits",
  agents: ["claude-code"],
  estimatedSavings: "Prevents stale context from inflating token costs",
  weight: 4,

  async run(_ctx: ScanContext): Promise<CheckResult> {
    return {
      passed: false,
      message: "Remember to use /clear between unrelated tasks",
      details:
        "Starting a new task with leftover context from the previous one wastes tokens and can confuse the model. Use /clear or start a new session when switching tasks.",
    };
  },
};
