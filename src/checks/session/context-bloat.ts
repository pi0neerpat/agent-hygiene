import type { Check, ScanContext, CheckResult } from "../types.js";
import { getMaxSessionTokens } from "../../tracking/agentsview.js";
import { checkSessionDataAvailable } from "./helpers.js";

/**
 * Detects context pressure — sessions growing large enough to approach
 * the model's context window, which forces expensive auto-compaction or
 * quality degradation.
 *
 * Sprint 3.5: primary signal is `maxSessionTokens` (peak single-session
 * size) when the data source surfaces it. Fallback signal is high
 * average daily token volume with an upward trend, preserved from the
 * original implementation.
 *
 * Note: we cannot detect auto-compact events directly — that signal is
 * not in AgentsView's current output. Deferred until a reliable source
 * exists (agentsview extension or .claude/projects/*.jsonl parsing).
 */
export const contextBloatCheck: Check = {
  id: "context-bloat",
  name: "Context window pressure",
  technique: 12,
  tier: "session",
  category: "context",
  agents: ["claude-code"],
  estimatedSavings: "Cutting context pressure reduces token usage 20-40%",
  weight: 7,
  impact: "high",
  hideFromFix: true,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const early = checkSessionDataAvailable(ctx);
    if (early) return early;
    const data = ctx.agentsViewData!;

    // Primary signal: peak session size, if the data source provides it.
    const peak = getMaxSessionTokens(data);
    if (peak !== undefined) {
      // Claude models have 200K context windows. At ≥150K, auto-compact
      // is imminent and response quality often degrades. ≥100K is a yellow flag.
      if (peak >= 150_000) {
        return {
          passed: false,
          message: `Peak session size: ${formatTokens(peak)} — approaching context window limit`,
          details:
            "Large sessions force auto-compaction and degrade response quality. Use /clear between unrelated tasks, lower CLAUDE_AUTOCOMPACT_PCT_OVERRIDE, and offload exploration to subagents.",
        };
      }
      if (peak >= 100_000) {
        return {
          passed: false,
          message: `Peak session size: ${formatTokens(peak)} — sessions running long`,
          details:
            "Sessions are accumulating significant context. Consider /clear between unrelated tasks to avoid hitting the context window.",
          confidence: 0.7,
        };
      }

      return {
        passed: true,
        message: `Peak session size: ${formatTokens(peak)} — healthy`,
      };
    }

    // Fallback: daily token volume + trend (when maxSessionTokens absent).
    const dailyTotals = data.dailyUsage.map((day) =>
      day.modelBreakdowns.reduce((s, m) => s + m.totalTokens, 0),
    );
    const avgDaily =
      dailyTotals.reduce((s, t) => s + t, 0) / dailyTotals.length;

    const mid = Math.floor(dailyTotals.length / 2);
    const firstHalf = dailyTotals.slice(0, mid);
    const secondHalf = dailyTotals.slice(mid);

    const firstAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((s, t) => s + t, 0) / firstHalf.length
        : 0;
    const secondAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((s, t) => s + t, 0) / secondHalf.length
        : 0;
    const trending = secondAvg > firstAvg * 1.2;

    if (avgDaily > 500_000) {
      return {
        passed: false,
        message: `High daily token volume: ${formatTokens(avgDaily)}${trending ? " (trending up)" : ""}`,
        details:
          "Sustained high volume is often context carried across unrelated tasks. Use /clear between tasks and set CLAUDE_AUTOCOMPACT_PCT_OVERRIDE to trigger earlier compaction.",
        confidence: 0.6,
      };
    }

    if (trending && avgDaily > 200_000) {
      return {
        passed: false,
        message: `Daily token volume trending up (${formatTokens(firstAvg)} → ${formatTokens(secondAvg)})`,
        details:
          "Token usage is increasing — a common sign of growing context windows. Review your /clear habits.",
        confidence: 0.5,
      };
    }

    return {
      passed: true,
      message: `Daily token volume: ${formatTokens(avgDaily)} — healthy`,
    };
  },
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}
