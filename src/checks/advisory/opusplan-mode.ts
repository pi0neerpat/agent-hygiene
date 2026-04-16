import type { Check, ScanContext, CheckResult } from "../types.js";

export const opusplanModeCheck: Check = {
  id: "opusplan-mode",
  name: "Use plan mode for complex features",
  technique: 8,
  tier: "advisory",
  category: "habits",
  agents: ["claude-code"],
  estimatedSavings: "Plan before implementing to avoid expensive rework",
  weight: 3,

  async run(_ctx: ScanContext): Promise<CheckResult> {
    return {
      passed: false,
      message: "Use plan mode (/plan) for complex multi-file changes",
      details:
        "For complex features, enter plan mode first to design the approach before writing code. This prevents expensive rework cycles where the agent implements, discovers issues, then re-implements.",
    };
  },
};
