import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";
import { safeReadFile } from "../../utils/fs.js";

export const modelSelectionCheck: Check = {
  id: "model-selection",
  name: "Default model selection",
  technique: 7,
  tier: "auto",
  category: "cost",
  agents: ["claude-code", "cursor"],
  estimatedSavings: "Sonnet is ~5x cheaper than Opus per token",
  weight: 7,

  async run(ctx: ScanContext): Promise<CheckResult> {
    // Check Claude Code settings
    const settingsPaths = [
      join(ctx.homeDir, ".claude", "settings.json"),
      join(ctx.projectDir, ".claude", "settings.json"),
    ];

    for (const settingsPath of settingsPaths) {
      const content = await safeReadFile(settingsPath);
      if (!content) continue;

      try {
        const settings = JSON.parse(content);

        // Check for model override in settings
        if (settings.model && /opus/i.test(settings.model)) {
          return {
            passed: false,
            message: `Default model set to Opus in ${settingsPath}`,
            details:
              "Use Sonnet as your default model and switch to Opus only for complex tasks. Sonnet handles 90%+ of coding tasks at ~5x lower cost.",

          };
        }
      } catch {
        // Invalid JSON, skip
      }
    }

    // Check Cursor settings
    const cursorSettings = await safeReadFile(
      join(ctx.homeDir, ".cursor", "settings.json"),
    );
    if (cursorSettings) {
      try {
        const settings = JSON.parse(cursorSettings);
        if (
          settings.defaultModel &&
          /opus|gpt-4o?(?!-mini)/i.test(settings.defaultModel)
        ) {
          return {
            passed: false,
            message: `Cursor default model appears to be a premium model`,
            details:
              "Consider using a more cost-effective default model for routine tasks.",

          };
        }
      } catch {
        // Invalid JSON
      }
    }

    // Check env vars for model overrides
    const modelEnvVars = [
      "CLAUDE_MODEL",
      "ANTHROPIC_MODEL",
    ];
    for (const varName of modelEnvVars) {
      const val = ctx.env[varName];
      if (val && /opus/i.test(val)) {
        return {
          passed: false,
          message: `${varName}=${val} (Opus as default is expensive)`,
          details:
            "Use Sonnet as default and invoke Opus selectively for complex tasks.",
        };
      }
    }

    return {
      passed: true,
      message: "No Opus default detected",
    };
  },
};
