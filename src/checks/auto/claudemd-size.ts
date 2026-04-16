import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

export const claudemdSizeCheck: Check = {
  id: "claudemd-size",
  name: "CLAUDE.md size",
  technique: 15,
  tier: "auto",
  category: "context",
  agents: ["claude-code"],
  estimatedSavings: "Reduces per-message context overhead",
  weight: 7,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const projectClaudeMd = await ctx.readFile(
      join(ctx.projectDir, "CLAUDE.md"),
    );
    const globalClaudeMd = await ctx.readFile(
      join(ctx.homeDir, ".claude", "CLAUDE.md"),
    );

    const issues: string[] = [];

    if (projectClaudeMd) {
      const lines = projectClaudeMd.split("\n").length;
      if (lines > 80) {
        issues.push(
          `Project CLAUDE.md is ${lines} lines (target: <80)`,
        );
      }
    }

    if (globalClaudeMd) {
      const lines = globalClaudeMd.split("\n").length;
      if (lines > 15) {
        issues.push(
          `Global CLAUDE.md is ${lines} lines (target: <15)`,
        );
      }
    }

    if (!projectClaudeMd && !globalClaudeMd) {
      return {
        passed: true,
        message: "No CLAUDE.md files found (not applicable)",
      };
    }

    if (issues.length > 0) {
      return {
        passed: false,
        message: issues.join("; "),
        details:
          "Large CLAUDE.md files are injected into every message, consuming tokens. Move domain-specific knowledge to skills or path-scoped rules.",
      };
    }

    const projectLines = projectClaudeMd
      ? projectClaudeMd.split("\n").length
      : 0;
    const globalLines = globalClaudeMd
      ? globalClaudeMd.split("\n").length
      : 0;

    return {
      passed: true,
      message: `CLAUDE.md sizes OK (project: ${projectLines} lines, global: ${globalLines} lines)`,
    };
  },
};
