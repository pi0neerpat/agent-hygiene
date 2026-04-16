import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

/**
 * Check: AGENTS.md should be concise to avoid per-message token overhead.
 * Mirrors claudemd-size for Codex users.
 */
export const agentsMdSizeCheck: Check = {
  id: "agentsmd-size",
  name: "AGENTS.md size",
  technique: 15,
  tier: "auto",
  category: "context",
  agents: ["codex"],
  estimatedSavings: "Reduces per-message context overhead",
  weight: 7,
  impact: "high",
  fixPrompt: `Review AGENTS.md and reduce it to under 80 lines. AGENTS.md is injected into every Codex message, so keep it concise. Move detailed implementation guides, large code examples, and step-by-step workflows into separate referenced files. Focus AGENTS.md on high-level project conventions and key architectural decisions only.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const projectAgentsMd = await ctx.readFile(
      join(ctx.projectDir, "AGENTS.md"),
    );

    if (!projectAgentsMd) {
      return {
        passed: true,
        message: "No AGENTS.md found (not applicable)",
      };
    }

    const lines = projectAgentsMd.split("\n").length;

    if (lines > 80) {
      return {
        passed: false,
        message: `AGENTS.md is ${lines} lines (target: <80)`,
        details:
          "Large AGENTS.md files are injected into every message, consuming tokens. Keep instructions concise and move detailed context into separate files.",
      };
    }

    return {
      passed: true,
      message: `AGENTS.md size OK (${lines} lines)`,
    };
  },
};
