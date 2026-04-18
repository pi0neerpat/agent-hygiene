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
  fixPrompt: `I ran agent-hygiene and it flagged that path-scoped rules aren't set up yet. Path-scoped rules load only when editing matching files, which keeps per-message context lean.\n\nBefore you make changes, please ask me:\n1. Which directories or file-types in this repo have their own conventions (e.g. src/components, api/, tests/)?\n2. Do any rules currently in CLAUDE.md (or AGENTS.md) only apply to a subset of files?\n3. Should the rules live under .claude/rules/ (Claude Code) or a different location for my toolchain?\n\nOnce I've answered, please create .claude/rules/ with glob-named rule files (e.g. "src__components.md" for src/components/ guidelines), and move the path-scoped sections we identify out of CLAUDE.md so they only load when matching files are edited.`,

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
