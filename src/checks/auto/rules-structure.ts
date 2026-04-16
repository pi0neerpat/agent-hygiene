import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

export const rulesStructureCheck: Check = {
  id: "rules-structure",
  name: "Path-scoped rules",
  technique: 10,
  tier: "auto",
  category: "structure",
  agents: ["claude-code"],
  estimatedSavings: "Only loads relevant rules per file, reducing context",
  weight: 6,
  impact: "med",
  fixPrompt: `Create a .claude/rules/ directory and add path-scoped rule files. Each file should be named with a glob pattern like "src/**/*.ts.md" or "tests/**/*.test.ts.md" so the rules only load when editing matching files. Move any file-type-specific conventions from CLAUDE.md into these scoped rules. For example, create .claude/rules/src__components.md for React component guidelines that only load when working in src/components/.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const rulesDir = join(ctx.projectDir, ".claude", "rules");
    const rulesExist = await ctx.exists(rulesDir);

    if (!rulesExist) {
      // Check if there's a .claude/ dir at all
      const claudeDir = await ctx.exists(
        join(ctx.projectDir, ".claude"),
      );
      if (!claudeDir) {
        return {
          passed: false,
          message: "No .claude/ directory found",
          details:
            "Create .claude/rules/ with path-scoped rules (e.g., src/**/*.ts.md) to inject context only when editing matching files.",
        };
      }

      return {
        passed: false,
        message: "No .claude/rules/ directory found",
        details:
          "Path-scoped rules let you inject context only when working on matching files, keeping the context window lean.",
      };
    }

    const ruleFiles = await ctx.listDir(rulesDir);
    const mdFiles = ruleFiles.filter((f) => f.endsWith(".md"));

    if (mdFiles.length === 0) {
      return {
        passed: false,
        message: ".claude/rules/ exists but contains no rule files",
        details: "Add .md files with glob-based names for path-scoped rules.",
      };
    }

    return {
      passed: true,
      message: `Path-scoped rules configured (${mdFiles.length} rule files)`,
    };
  },
};
