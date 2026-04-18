import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

const PLAN_HINTS = [
  /\/plan\b/,
  /\bplan\s+mode\b/i,
  /\bplan\s+before\s+(?:implement|writ|cod)/i,
  /\bdesign\s+before\s+implement/i,
];

function mentionsPlanMode(content: string): boolean {
  return PLAN_HINTS.some((p) => p.test(content));
}

export const opusplanModeCheck: Check = {
  id: "opusplan-mode",
  name: "Use plan mode for complex features",
  technique: 8,
  tier: "advisory",
  category: "habits",
  agents: ["claude-code", "codex"],
  estimatedSavings: "Plan before implementing to avoid expensive rework",
  weight: 3,
  impact: "low",
  fixPrompt: `I ran agent-hygiene and it flagged that there's no plan-mode guidance in my rules files. Using plan mode prevents expensive rework cycles where the agent implements, discovers issues, then re-implements.\n\nBefore you make changes, please ask me:\n1. Should this guidance live in CLAUDE.md, AGENTS.md, or both?\n2. What do I consider "complex" — 3+ files? Shared-interface changes? Architectural decisions?\n\nOnce I've answered, please add a short rule to the chosen file(s). Example wording:\n"For complex multi-file features (3+ files or changes to shared interfaces), use \`/plan\` (Claude Code) or the equivalent planning flow in my agent before writing code."`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const files = [
      join(ctx.projectDir, "CLAUDE.md"),
      join(ctx.projectDir, "AGENTS.md"),
      join(ctx.homeDir, ".claude", "CLAUDE.md"),
    ];

    for (const path of files) {
      const content = await ctx.readFile(path);
      if (content && mentionsPlanMode(content)) {
        return {
          passed: true,
          message: `Plan-mode guidance found in ${path}`,
        };
      }
    }

    return {
      passed: false,
      message: "No plan-mode guidance found in CLAUDE.md or AGENTS.md",
      details:
        "For complex features, enter plan mode first to design the approach before writing code. This prevents expensive rework cycles.",
    };
  },
};
