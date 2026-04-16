import type { Check, ScanContext, CheckResult } from "../types.js";

export const btwUsageCheck: Check = {
  id: "btw-usage",
  name: "Use /btw for side questions",
  technique: 13,
  tier: "advisory",
  category: "habits",
  agents: ["claude-code"],
  estimatedSavings: "Side questions in /btw don't pollute main context",
  weight: 3,
  impact: "low",
  fixPrompt: `Add a tip to CLAUDE.md about using the /btw command for quick side questions. Instead of asking "btw, what does this regex do?" in the main session (which adds tokens to the working context), use /btw to open a separate lightweight context. This keeps the main session focused on the current task without accumulating tangential conversation.`,

  async run(_ctx: ScanContext): Promise<CheckResult> {
    return {
      passed: false,
      message: 'Use /btw for quick side questions instead of main chat',
      details:
        'The /btw command opens a separate context for quick questions ("btw, what does this regex do?") without adding tokens to your main working session.',
    };
  },
};
