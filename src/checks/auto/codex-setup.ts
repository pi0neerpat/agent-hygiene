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
  fixPrompt: `Set up Codex for this project. Create an AGENTS.md file in the project root with concise instructions — project conventions, key architecture decisions, and testing requirements. Keep it under 80 lines. If ~/.codex/ doesn't exist, run "codex" once to initialize the global config directory which stores sandbox settings and preferences.`,

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
