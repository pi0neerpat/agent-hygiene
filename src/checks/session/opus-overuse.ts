import type { Check, ScanContext, CheckResult } from "../types.js";
import {
  getModelTokens,
  getTotalTokens,
  getOutputInputRatio,
  getTotalSessionCount,
} from "../../tracking/agentsview.js";
import { checkSessionDataAvailable } from "./helpers.js";

/**
 * Detects high percentage of tokens spent on Opus models when Sonnet/Haiku
 * would likely suffice. Layered heuristic (Sprint 3.5):
 *
 *   Signal A — raw Opus token share (baseline, always available)
 *   Signal B — Opus output/input ratio; low (<0.3) suggests lookup/read
 *              tasks that Sonnet handles well at a fraction of the cost
 *   Signal C — avg tokens per Opus session; small sessions (<50K) suggest
 *              many quick tasks that didn't need the premium model
 *
 * Signals combine into a confidence-weighted verdict. Signal A alone is
 * sufficient to fail the check at >40%; B and C strengthen (or soften)
 * the confidence when available.
 */
export const opusOveruseCheck: Check = {
  id: "opus-overuse",
  name: "Opus model overuse",
  technique: 7,
  tier: "session",
  category: "cost",
  agents: ["claude-code"],
  estimatedSavings: "Sonnet is ~5x cheaper per token than Opus",
  weight: 8,
  impact: "high",
  fixPrompt: (_ctx, result) =>
    `${result.message}. Default to Sonnet for routine tasks: file edits, simple refactors, test writing, and boilerplate generation. ` +
    `Reserve Opus for architecture decisions, complex debugging, and novel problem-solving. ` +
    `Check settings and CLAUDE.md for model preferences that should be updated.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const early = checkSessionDataAvailable(ctx);
    if (early) return early;
    const data = ctx.agentsViewData!;

    const total = getTotalTokens(data);
    if (total === 0) {
      return { passed: true, message: "No token usage recorded" };
    }

    const opusTokens = getModelTokens(data, /opus/i);
    const opusPct = (opusTokens / total) * 100;

    // Signal B — output/input ratio on Opus specifically.
    const opusRatio = getOutputInputRatio(data, /opus/i);

    // Signal C — avg tokens per Opus session, if session counts available.
    const totalSessions = getTotalSessionCount(data);
    const avgOpusPerSession =
      totalSessions && totalSessions > 0
        ? opusTokens / totalSessions
        : undefined;

    // ── Verdict ────────────────────────────────────────────────────
    // High share: hard fail. Ratio/session signals tune the message.
    if (opusPct > 40) {
      return {
        passed: false,
        message: `${opusPct.toFixed(0)}% of tokens spent on Opus models`,
        details: buildDetails(
          `${formatTokens(opusTokens)} of ${formatTokens(total)} total tokens went to Opus.`,
          opusRatio,
          avgOpusPerSession,
        ),
      };
    }

    // Moderate share: confidence depends on corroborating signals.
    if (opusPct > 20) {
      // Strong corroboration: low output/input ratio → likely lookup work
      if (opusRatio !== undefined && opusRatio < 0.3) {
        return {
          passed: false,
          message: `${opusPct.toFixed(0)}% of tokens on Opus with low output ratio (${opusRatio.toFixed(2)})`,
          details:
            "Low output/input ratio suggests lookup or read-heavy tasks. These are typically handled well by Sonnet at a fraction of the cost.",
          confidence: 0.8,
        };
      }

      // Weak corroboration: high output ratio suggests genuine generation
      if (opusRatio !== undefined && opusRatio > 0.8) {
        return {
          passed: true,
          message: `${opusPct.toFixed(0)}% Opus usage with high output ratio (${opusRatio.toFixed(2)}) — likely generative work`,
        };
      }

      // Default moderate flag
      return {
        passed: false,
        message: `${opusPct.toFixed(0)}% of tokens on Opus (moderate)`,
        details: buildDetails(
          "Consider whether all Opus sessions truly needed the premium model.",
          opusRatio,
          avgOpusPerSession,
        ),
        confidence: 0.6,
      };
    }

    return {
      passed: true,
      message: `Opus usage is ${opusPct.toFixed(0)}% of total tokens — good balance`,
    };
  },
};

function buildDetails(
  base: string,
  opusRatio: number | undefined,
  avgOpusPerSession: number | undefined,
): string {
  const parts: string[] = [base];

  if (opusRatio !== undefined) {
    if (opusRatio < 0.3) {
      parts.push(
        `Opus output/input ratio is ${opusRatio.toFixed(2)} — low ratios suggest lookup tasks that Sonnet handles well.`,
      );
    } else if (opusRatio > 0.8) {
      parts.push(
        `Opus output/input ratio is ${opusRatio.toFixed(2)} — high ratio suggests genuine generative work where Opus may be justified.`,
      );
    }
  }

  if (avgOpusPerSession !== undefined && avgOpusPerSession < 50_000) {
    parts.push(
      `Average Opus tokens per session is ${formatTokens(avgOpusPerSession)} — small sessions rarely need Opus-level reasoning.`,
    );
  }

  parts.push(
    "Most coding tasks work well with Sonnet — reserve Opus for complex architecture and planning.",
  );
  return parts.join(" ");
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}
