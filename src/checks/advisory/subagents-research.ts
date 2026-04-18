import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

const SUBAGENT_HINTS = [
  /\bsub[-\s]?agent/i,
  /\bAgent\s+tool\b/,
  /\bTask\s+tool\b/,
  /delegat\w+\s+(?:codebase\s+)?(?:exploration|research|pattern)/i,
];

function mentionsSubagentGuidance(content: string): boolean {
  return SUBAGENT_HINTS.some((p) => p.test(content));
}

export const subagentsResearchCheck: Check = {
  id: "subagents-research",
  name: "Delegate research to subagents",
  technique: 11,
  tier: "advisory",
  category: "habits",
  agents: ["claude-code", "codex"],
  estimatedSavings: "Subagents use separate context, saving main window tokens",
  weight: 4,
  impact: "low",
  fixPrompt: `I ran agent-hygiene and it flagged that there's no subagent delegation guidance in my rules files. Subagents run in separate context windows, keeping the main session lean.\n\nBefore you make changes, please ask me:\n1. Should this guidance live in CLAUDE.md, AGENTS.md, or both (if both exist)?\n2. Are there any project-specific guardrails on when NOT to use subagents (e.g. tasks requiring full repo context)?\n\nOnce I've answered, please add a short rule to the chosen file(s), placed under an existing workflow/conventions section if one exists. Example wording:\n"Delegate codebase exploration, pattern searches, and research questions to subagents (Agent tool / Task tool). Keep the main session focused on synthesis and implementation."`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const files = [
      join(ctx.projectDir, "CLAUDE.md"),
      join(ctx.projectDir, "AGENTS.md"),
      join(ctx.homeDir, ".claude", "CLAUDE.md"),
    ];

    for (const path of files) {
      const content = await ctx.readFile(path);
      if (content && mentionsSubagentGuidance(content)) {
        return {
          passed: true,
          message: `Subagent delegation guidance found in ${path}`,
        };
      }
    }

    return {
      passed: false,
      message: "No subagent delegation guidance found in CLAUDE.md or AGENTS.md",
      details:
        "When exploring a codebase or researching a question, use the Agent/Task tool to delegate. Subagents run in separate context windows, keeping your main session focused.",
    };
  },
};
