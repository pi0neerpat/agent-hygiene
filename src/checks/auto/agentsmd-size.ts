import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

/**
 * Check: AGENTS.md should be concise to avoid per-message token overhead.
 * Mirrors claudemd-size for Codex users.
 */
export const agentsMdSizeCheck: Check = {
  id: "agentsmd-size",
  name: "AGENTS.md size",
  technique: 15,
  tier: "auto",
  category: "context",
  agents: ["codex"],
  estimatedSavings: "Reduces per-message context overhead",
  weight: 7,
  impact: "high",
  fixPrompt: (_ctx, result) =>
    `I ran agent-hygiene and it says: ${result.message}.\n\n` +
    `AGENTS.md gets injected into every Codex message, so trimming it saves tokens per turn. I'd like to split the detailed content into per-topic docs.\n\n` +
    `Before you make changes, please ask me:\n` +
    `1. Do I already have a ./docs/ directory, or should we create one?\n` +
    `2. Are there sections of AGENTS.md that MUST stay inline (non-negotiable conventions)?\n\n` +
    `Once I've answered, please:\n` +
    `1. Create ./docs/INDEX.md — a router listing each documentation file with a one-line "read this when…" hint so agents can pull files on demand.\n` +
    `2. Move detailed implementation guides, large code examples, and step-by-step workflows out of AGENTS.md into separate files referenced from INDEX.md.\n` +
    `3. Reduce AGENTS.md to a short pointer that references INDEX.md for deeper context, keeping only high-level conventions inline.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const projectAgentsMd = await ctx.readFile(
      join(ctx.projectDir, "AGENTS.md"),
    );

    if (!projectAgentsMd) {
      return {
        passed: true,
        message: "No AGENTS.md found (not applicable)",
      };
    }

    const lines = projectAgentsMd.split("\n").length;

    if (lines > 80) {
      return {
        passed: false,
        message: `AGENTS.md is ${lines} lines (target: <80)`,
        details:
          "Large AGENTS.md files are injected into every message, consuming tokens. Keep instructions concise and move detailed context into separate files.",
      };
    }

    return {
      passed: true,
      message: `AGENTS.md size OK (${lines} lines)`,
    };
  },
};
