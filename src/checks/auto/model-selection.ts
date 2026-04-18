import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";
import { safeReadFile } from "../../utils/fs.js";

/**
 * Unified model-selection check.
 *
 * Two failure modes, both at impact: "high":
 *   1. An explicit Opus default is set (most expensive misconfig)
 *   2. No default is configured anywhere (routine tasks may fall back
 *      to a pricier model depending on the harness)
 */
export const modelSelectionCheck: Check = {
  id: "model-selection",
  name: "Default model selection",
  technique: 7,
  tier: "auto",
  category: "cost",
  agents: ["claude-code", "codex", "cursor"],
  estimatedSavings: "Sonnet is ~5x cheaper than Opus per token",
  weight: 7,
  impact: "high",
  fixPrompt: (_ctx, result) =>
    `I ran agent-hygiene and it flagged: ${result.message}.\n\n` +
    `Before you make changes, please ask me:\n` +
    `1. Which agents should we configure — Claude Code, Codex, Cursor, or several?\n` +
    `2. Would you like a Sonnet default with manual Opus opt-in, or a different preferred model?\n\n` +
    `Once I've answered, please write the chosen default to the appropriate settings file(s):\n` +
    `- Claude Code: set "model": "claude-sonnet-4-6" in ~/.claude/settings.json.\n` +
    `- Codex: set model = "<model-id>" in ~/.codex/config.toml. Codex has no env var override — the CLI flag \`--model\` is the only runtime override.\n` +
    `- Cursor: update defaultModel in ~/.cursor/settings.json.\n\n` +
    `Please don't set shell env vars for this — I'd rather keep it in the settings files.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const settingsPaths = [
      join(ctx.homeDir, ".claude", "settings.json"),
      join(ctx.projectDir, ".claude", "settings.json"),
    ];

    let anyDefaultConfigured = false;

    // 1. Hard-fail: Claude Code settings.json with Opus
    for (const settingsPath of settingsPaths) {
      const content = await safeReadFile(settingsPath);
      if (!content) continue;

      try {
        const settings = JSON.parse(content) as {
          model?: unknown;
          defaultModel?: unknown;
        };
        const value = String(settings.model ?? settings.defaultModel ?? "");
        if (value) {
          anyDefaultConfigured = true;
          if (/opus/i.test(value)) {
            return {
              passed: false,
              message: `Default model set to Opus in ${settingsPath}`,
              details:
                "Use Sonnet as your default model and switch to Opus only for complex tasks. Sonnet handles 90%+ of coding tasks at ~5x lower cost.",
            };
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    }

    // 2. Hard-fail: Cursor settings with premium default
    const cursorSettings = await safeReadFile(
      join(ctx.homeDir, ".cursor", "settings.json"),
    );
    if (cursorSettings) {
      try {
        const settings = JSON.parse(cursorSettings) as {
          defaultModel?: unknown;
        };
        const value = String(settings.defaultModel ?? "");
        if (value) {
          anyDefaultConfigured = true;
          if (/opus|gpt-4o?(?!-mini)/i.test(value)) {
            return {
              passed: false,
              message: "Cursor default model appears to be a premium model",
              details:
                "Consider using a more cost-effective default model for routine tasks.",
            };
          }
        }
      } catch {
        // Invalid JSON
      }
    }

    // 3. Hard-fail: env vars with Opus
    const modelEnvVars = ["CLAUDE_MODEL", "ANTHROPIC_MODEL"];
    for (const varName of modelEnvVars) {
      const val = ctx.env[varName];
      if (val) {
        anyDefaultConfigured = true;
        if (/opus/i.test(val)) {
          return {
            passed: false,
            message: `${varName}=${val} (Opus as default is expensive)`,
            details:
              "Use Sonnet as default and invoke Opus selectively for complex tasks.",
          };
        }
      }
    }

    // 4. Codex config check (best-effort — exact field name TBD per research)
    const codexConfig = await safeReadFile(
      join(ctx.homeDir, ".codex", "config.toml"),
    );
    if (codexConfig) {
      // TOML parse is overkill; line-grep for "model =" or "default_model ="
      const match = codexConfig.match(
        /^\s*(?:default_)?model\s*=\s*["']([^"']+)["']/m,
      );
      if (match) {
        anyDefaultConfigured = true;
      }
    }

    // 5. Soft-fail: no default configured anywhere
    if (!anyDefaultConfigured) {
      return {
        passed: false,
        message: "No explicit default model configured",
        details:
          'Set `"model": "claude-sonnet-4-6"` in ~/.claude/settings.json (or the equivalent for Codex/Cursor) so routine tasks use Sonnet by default. Invoke Opus selectively for complex work.',
      };
    }

    return {
      passed: true,
      message: "Default model configured (no Opus default detected)",
    };
  },
};
