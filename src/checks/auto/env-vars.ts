import type { Check, ScanContext, CheckResult, FixResult } from "../types.js";
import { isEnvVarSet, getEnvVarValue } from "../../utils/env.js";
import { appendFile } from "fs/promises";
import { join } from "path";

/**
 * Check: AUTOCOMPACT threshold should be set (default is 100%, meaning
 * context must be completely full before compacting).
 */
export const autocompactCheck: Check = {
  id: "autocompact-threshold",
  name: "Autocompact threshold",
  technique: 4,
  tier: "auto",
  category: "cost",
  agents: ["claude-code"],
  estimatedSavings: "Prevents context overflow and re-reads",
  weight: 7,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const varName = "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE";
    if (!isEnvVarSet(varName, ctx.env, ctx.shellProfileContents)) {
      return {
        passed: false,
        message: `${varName} not set (defaults to 100%)`,
        details:
          "Set to 50-70 to compact context earlier, preventing expensive context overflow and file re-reads.",
      };
    }

    const value = getEnvVarValue(varName, ctx.env, ctx.shellProfileContents);
    const num = value ? parseInt(value, 10) : 100;
    if (num > 80) {
      return {
        passed: false,
        message: `${varName} is ${num}% (too high, recommend 50-70%)`,
        details:
          "A threshold above 80% means context will be nearly full before compacting.",
      };
    }

    return {
      passed: true,
      message: `Autocompact threshold set to ${num}%`,
    };
  },

  async fix(ctx: ScanContext): Promise<FixResult> {
    const line = '\nexport CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=60\n';
    const profilePath = join(ctx.homeDir, ".zshrc");
    await appendFile(profilePath, line, "utf-8");
    return {
      applied: true,
      message: "Added CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=60 to ~/.zshrc",
      filesModified: [profilePath],
    };
  },
};

/**
 * Check: SUBAGENT_MODEL should be set to a cheaper model for exploration tasks.
 */
export const subagentModelCheck: Check = {
  id: "subagent-model",
  name: "Subagent model override",
  technique: 5,
  tier: "auto",
  category: "cost",
  agents: ["claude-code"],
  estimatedSavings: "~60% cost reduction on exploration tasks",
  weight: 8,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const varName = "CLAUDE_CODE_SUBAGENT_MODEL";
    if (!isEnvVarSet(varName, ctx.env, ctx.shellProfileContents)) {
      return {
        passed: false,
        message: `${varName} not set`,
        details:
          "Subagents for file search and exploration don't need Opus. Set to claude-sonnet-4-6 to save ~60%.",
      };
    }

    const value = getEnvVarValue(varName, ctx.env, ctx.shellProfileContents);
    if (value && value.includes("opus")) {
      return {
        passed: false,
        message: `${varName} is set to ${value} (Opus is expensive for exploration)`,
        details: "Use claude-sonnet-4-6 or claude-haiku-4-5 for subagents.",
      };
    }

    return {
      passed: true,
      message: `Subagent model set to ${value}`,
    };
  },

  async fix(ctx: ScanContext): Promise<FixResult> {
    const line = '\nexport CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-4-6\n';
    const profilePath = join(ctx.homeDir, ".zshrc");
    await appendFile(profilePath, line, "utf-8");
    return {
      applied: true,
      message:
        "Added CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-4-6 to ~/.zshrc",
      filesModified: [profilePath],
    };
  },
};
