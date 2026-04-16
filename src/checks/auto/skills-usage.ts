import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

/**
 * Heuristics to detect domain knowledge that should be in skills.
 * Looks for patterns like code blocks, step-by-step instructions, long sections.
 */
const DOMAIN_KNOWLEDGE_PATTERNS = [
  /```[\s\S]{200,}```/m, // Large code blocks
  /step\s+\d+/i, // Step-by-step instructions
  /when\s+(?:the\s+)?user\s+(?:asks?|wants?|requests?)/i, // User interaction patterns
  /(?:always|never|must)\s+(?:use|run|execute|call)/i, // Imperative rules about tools
];

export const skillsUsageCheck: Check = {
  id: "skills-usage",
  name: "Skills vs fat CLAUDE.md",
  technique: 9,
  tier: "auto",
  category: "context",
  agents: ["claude-code"],
  estimatedSavings: "Skills only load when triggered, saving context",
  weight: 6,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const claudeMd = await ctx.readFile(
      join(ctx.projectDir, "CLAUDE.md"),
    );

    if (!claudeMd) {
      return {
        passed: true,
        message: "No project CLAUDE.md (not applicable)",
      };
    }

    // Check for skills directory
    const skillsDir = join(ctx.homeDir, ".claude", "skills");
    const hasSkills = await ctx.exists(skillsDir);

    // Look for domain knowledge patterns in CLAUDE.md
    const matches = DOMAIN_KNOWLEDGE_PATTERNS.filter((p) =>
      p.test(claudeMd),
    );

    if (matches.length >= 2) {
      return {
        passed: false,
        message: `CLAUDE.md contains domain-specific knowledge (${matches.length} patterns detected)`,
        details: hasSkills
          ? "Move domain-specific workflows from CLAUDE.md into skills. Skills only load when triggered, keeping context lean."
          : "Create ~/.claude/skills/ and move domain-specific workflows from CLAUDE.md into skills. Skills only load when triggered.",
      };
    }

    if (!hasSkills) {
      return {
        passed: true,
        message: "No domain knowledge in CLAUDE.md (skills not yet used)",
        details:
          "Consider creating skills for repetitive workflows to keep CLAUDE.md focused on project-level rules.",
      };
    }

    return {
      passed: true,
      message: "CLAUDE.md is lean; skills directory exists",
    };
  },
};
