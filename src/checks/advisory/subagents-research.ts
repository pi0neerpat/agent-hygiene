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
  impact: "low",
  fixPrompt: `Subagents run in separate context windows with cheaper models (when CLAUDE_CODE_SUBAGENT_MODEL is set), keeping the main session lean. Add guidance to CLAUDE.md: "Delegate codebase exploration, pattern searches, and research questions to subagents using the Agent tool." This reduces main session token costs and preserves context for the primary task.`,

  async run(_ctx: ScanContext): Promise<CheckResult> {
    return {
      passed: false,
      message: "Use subagents for exploration and research tasks",
      details:
        "When exploring a codebase or researching a question, use the Agent tool or ask Claude to delegate. Subagents operate in separate context windows (with cheaper models if SUBAGENT_MODEL is set), keeping your main session focused.",
    };
  },
};
