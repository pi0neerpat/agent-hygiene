import type { Check, ScanContext, CheckResult } from "../types.js";

export const subagentsResearchCheck: Check = {
  id: "subagents-research",
  name: "Delegate research to subagents",
  technique: 11,
  tier: "advisory",
  category: "habits",
  agents: ["claude-code"],
  estimatedSavings: "Subagents use separate context, saving main window tokens",
  weight: 4,

  async run(_ctx: ScanContext): Promise<CheckResult> {
    return {
      passed: false,
      message: "Use subagents for exploration and research tasks",
      details:
        "When exploring a codebase or researching a question, use the Agent tool or ask Claude to delegate. Subagents operate in separate context windows (with cheaper models if SUBAGENT_MODEL is set), keeping your main session focused.",
    };
  },
};
