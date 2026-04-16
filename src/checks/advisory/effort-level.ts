import type { Check, ScanContext, CheckResult } from "../types.js";
import { isEnvVarSet, getEnvVarValue } from "../../utils/env.js";

export const effortLevelCheck: Check = {
  id: "effort-level",
  name: "Default effort level",
  technique: 14,
  tier: "advisory",
  category: "habits",
  agents: ["claude-code"],
  estimatedSavings: "Lower effort = fewer reasoning tokens on simple tasks",
  weight: 4,
  impact: "low",
  fixPrompt: `Lower effort levels consume fewer reasoning tokens on straightforward tasks. Add "export CLAUDE_CODE_EFFORT=medium" to the shell profile (~/.zshrc or ~/.bashrc), or set it in ~/.claude/settings.json. Use "medium" for most tasks — reserve "high" for complex architectural decisions or difficult debugging sessions.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    // Check if effort level is configured via env var
    if (
      isEnvVarSet(
        "CLAUDE_CODE_EFFORT",
        ctx.env,
        ctx.shellProfileContents,
      )
    ) {
      const value = getEnvVarValue(
        "CLAUDE_CODE_EFFORT",
        ctx.env,
        ctx.shellProfileContents,
      );
      if (value === "low" || value === "medium") {
        return {
          passed: true,
          message: `Effort level set to ${value}`,
        };
      }
    }

    return {
      passed: false,
      message: "Consider setting a default effort level",
      details:
        "Set effort to 'medium' for most tasks. Use 'high' only for complex problems. Lower effort means fewer reasoning tokens are consumed on straightforward requests.",
    };
  },
};
