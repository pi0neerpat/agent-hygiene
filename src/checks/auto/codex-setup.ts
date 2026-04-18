import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

/**
 * Check: Codex project should have proper configuration for cost efficiency.
 * Checks for ~/.codex/ global config and project-level AGENTS.md.
 */
export const codexSetupCheck: Check = {
  id: "codex-setup",
  name: "Codex configuration",
  technique: 10,
  tier: "auto",
  category: "structure",
  agents: ["codex"],
  estimatedSavings: "Proper setup enables sandbox and cost controls",
  weight: 5,
  impact: "med",
  fixPrompt: (_ctx, result) =>
    `I ran agent-hygiene on my project and it flagged: ${result.message}.\n\n` +
    `Could you help me set this up? I'd like you to:\n` +
    `1. Draft an AGENTS.md for the project root (under 80 lines) covering the key conventions, architecture notes, and testing requirements you can infer from the codebase. Ask me to fill in anything that isn't obvious from the code.\n` +
    `2. If ~/.codex/ doesn't exist, don't run \`codex\` yourself — just tell me to run \`! codex\` in the prompt (the \`!\` prefix runs it in this session so I can see the output and handle any interactive prompts directly).`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const issues: string[] = [];

    // Check global Codex config directory
    const globalConfigDir = join(ctx.homeDir, ".codex");
    const globalExists = await ctx.exists(globalConfigDir);

    if (!globalExists) {
      issues.push("No ~/.codex/ config directory found");
    }

    // Check for project-level AGENTS.md (the primary instruction file)
    const agentsMd = await ctx.readFile(join(ctx.projectDir, "AGENTS.md"));
    if (!agentsMd) {
      issues.push("No AGENTS.md found in project root");
    }

    if (issues.length === 2) {
      return {
        passed: false,
        message: "Codex not configured for this project",
        details:
          "Create AGENTS.md with project instructions and ensure ~/.codex/ exists with your global config. This enables Codex to work efficiently with your codebase.",
      };
    }

    if (issues.length === 1) {
      return {
        passed: false,
        message: issues[0],
        details:
          issues[0].includes("AGENTS.md")
            ? "Create AGENTS.md in your project root with concise instructions for Codex."
            : "Run codex to initialize your global config directory.",
      };
    }

    return {
      passed: true,
      message: "Codex configuration present (global config + AGENTS.md)",
    };
  },
};
