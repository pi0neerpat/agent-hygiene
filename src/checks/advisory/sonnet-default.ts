import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";
import { safeReadFile } from "../../utils/fs.js";

/**
 * Advisory: recommend setting Sonnet as the default model when no
 * explicit default is configured.
 *
 * Complements the Tier 1 `model-selection` check, which hard-fails on an
 * explicit Opus default. This advisory fires when nothing is configured,
 * nudging the user to set Sonnet explicitly so routine tasks don't fall
 * back to a more expensive default.
 *
 * Pass conditions: `model` field in ~/.claude/settings.json or
 * ./.claude/settings.json matches Sonnet, OR ANTHROPIC_MODEL /
 * CLAUDE_MODEL env var matches Sonnet.
 */
export const sonnetDefaultCheck: Check = {
  id: "sonnet-default",
  name: "Sonnet as default model",
  technique: 7,
  tier: "advisory",
  category: "cost",
  agents: ["claude-code"],
  estimatedSavings:
    "Sonnet handles ~90% of coding tasks at ~5x lower cost than Opus",
  weight: 4,
  impact: "low",
  fixPrompt: `Set Sonnet as the explicit default model to avoid pricier fallbacks. Add "model": "claude-sonnet-4-6" to ~/.claude/settings.json, or set ANTHROPIC_MODEL=claude-sonnet-4-6 in your shell profile. Sonnet handles the vast majority of coding tasks — file edits, refactors, test writing, debugging — at ~5x lower cost than Opus. Use /model opus selectively for complex architecture and planning sessions.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    // 1. Check settings.json defaultModel / model field.
    const settingsPaths = [
      join(ctx.homeDir, ".claude", "settings.json"),
      join(ctx.projectDir, ".claude", "settings.json"),
    ];

    for (const path of settingsPaths) {
      const content = await safeReadFile(path);
      if (!content) continue;
      try {
        const settings = JSON.parse(content) as {
          model?: unknown;
          defaultModel?: unknown;
        };
        const value = String(settings.model ?? settings.defaultModel ?? "");
        if (/sonnet/i.test(value)) {
          return {
            passed: true,
            message: `Sonnet set as default model in ${path}`,
          };
        }
      } catch {
        // Invalid JSON; ignore and continue probing.
      }
    }

    // 2. Check env vars that Claude Code respects.
    for (const varName of ["ANTHROPIC_MODEL", "CLAUDE_MODEL"]) {
      const val = ctx.env[varName];
      if (val && /sonnet/i.test(val)) {
        return {
          passed: true,
          message: `${varName}=${val} — Sonnet set as default`,
        };
      }
    }

    // 3. No explicit Sonnet default — advise setting one.
    return {
      passed: false,
      message: "No explicit default model — set Sonnet to avoid pricier fallbacks",
      details:
        'Set `"model": "claude-sonnet-4-6"` in ~/.claude/settings.json (or ANTHROPIC_MODEL in your shell) so routine tasks use Sonnet by default. Invoke Opus selectively for complex architecture and planning.',
    };
  },
};
