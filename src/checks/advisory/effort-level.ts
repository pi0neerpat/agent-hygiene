import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";
import { isEnvVarSet, getEnvVarValue } from "../../utils/env.js";

const VALID_LEVELS = new Set(["low", "medium", "high", "xhigh"]);

async function readSettingsEffortLevel(
  ctx: ScanContext,
  path: string,
): Promise<string | null> {
  const content = await ctx.readFile(path);
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as { effortLevel?: unknown };
    if (typeof parsed.effortLevel === "string") {
      return parsed.effortLevel;
    }
  } catch {
    // Invalid JSON, ignore
  }
  return null;
}

export const effortLevelCheck: Check = {
  id: "effort-level",
  name: "Default effort level",
  technique: 14,
  tier: "advisory",
  category: "habits",
  agents: ["claude-code", "codex"],
  estimatedSavings: "Lower effort = fewer reasoning tokens on simple tasks",
  weight: 4,
  impact: "low",
  fixPrompt: `I ran agent-hygiene and it flagged that no default effort level is configured.\n\nNote: lowering effort can make responses feel less thorough — I'd suggest leaving it at "high" or "xhigh" and only proceeding if I'm specifically trying to reduce reasoning cost.\n\nBefore you make changes, please ask me:\n1. Which default effort level do I want — "low", "medium", "high", or "xhigh"?\n2. Am I configuring Claude Code, Codex, or both?\n\nOnce I've answered, please:\n- Claude Code: set "effortLevel": "<value>" in ~/.claude/settings.json.\n- Codex: set model_reasoning_effort = "<value>" in ~/.codex/config.toml. Valid values: "none", "minimal", "low", "medium", "high", "xhigh".\n\nPlease don't write this to ~/.zshrc or shell profiles — I'd rather keep it in the settings files.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    // 1. Check ~/.claude/settings.json and project .claude/settings.json for effortLevel
    const settingsPaths = [
      join(ctx.homeDir, ".claude", "settings.json"),
      join(ctx.projectDir, ".claude", "settings.json"),
    ];

    for (const path of settingsPaths) {
      const value = await readSettingsEffortLevel(ctx, path);
      if (value && VALID_LEVELS.has(value.toLowerCase())) {
        return {
          passed: true,
          message: `Effort level set to "${value}" in ${path}`,
        };
      }
    }

    // 2. Fallback: check env var (historical behavior)
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
      if (value && VALID_LEVELS.has(value.toLowerCase())) {
        return {
          passed: true,
          message: `CLAUDE_CODE_EFFORT=${value}`,
        };
      }
    }

    return {
      passed: false,
      message: "No default effort level configured",
      details:
        'Set "effortLevel" in ~/.claude/settings.json. Lower effort means fewer reasoning tokens on routine tasks. Reserve "high"/"xhigh" for complex work.',
    };
  },
};
