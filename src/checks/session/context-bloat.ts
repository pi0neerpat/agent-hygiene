import type { Check, ScanContext, CheckResult } from "../types.js";
import { checkSessionDataAvailable } from "./helpers.js";

/**
 * Detects sessions with high total token counts, suggesting
 * context bloat from not using /clear or compaction.
 *
 * Heuristic: if average daily total tokens exceeds 500K, the user
 * is likely carrying too much context across tasks.
 */
export const contextBloatCheck: Check = {
  id: "context-bloat",
  name: "Context window bloat",
  technique: 12,
  tier: "session",
  category: "context",
  agents: ["claude-code"],
  estimatedSavings: "Reducing context bloat can cut token usage 20-40%",
  weight: 7,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const early = checkSessionDataAvailable(ctx);
    if (early) return early;
    const data = ctx.agentsViewData!;

    // Calculate daily token totals
    const dailyTotals = data.dailyUsage.map((day) => ({
      date: day.date,
      tokens: day.modelBreakdowns.reduce((s, m) => s + m.totalTokens, 0),
    }));

    const avgDaily =
      dailyTotals.reduce((s, d) => s + d.tokens, 0) / dailyTotals.length;

    // Check for upward trend (compare first half vs second half)
    const mid = Math.floor(dailyTotals.length / 2);
    const firstHalf = dailyTotals.slice(0, mid);
    const secondHalf = dailyTotals.slice(mid);

    const firstAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((s, d) => s + d.tokens, 0) / firstHalf.length
        : 0;
    const secondAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((s, d) => s + d.tokens, 0) / secondHalf.length
        : 0;

    const trending = secondAvg > firstAvg * 1.2;

    // High daily burn threshold: 500K tokens/day
    if (avgDaily > 500_000) {
      return {
        passed: false,
        message: `Average daily token usage: ${formatTokens(avgDaily)}${trending ? " (trending up)" : ""}`,
        details:
          "High daily token usage suggests context is accumulating across tasks. Use /clear between unrelated tasks and set CLAUDE_AUTOCOMPACT_PCT_OVERRIDE to trigger earlier compaction.",
      };
    }

    if (trending && avgDaily > 200_000) {
      return {
        passed: false,
        message: `Daily token usage trending upward (${formatTokens(firstAvg)} → ${formatTokens(secondAvg)})`,
        details:
          "Token usage is increasing over time. This often indicates growing context windows. Review your /clear habits.",
        confidence: 0.5,
      };
    }

    return {
      passed: true,
      message: `Average daily token usage: ${formatTokens(avgDaily)} — healthy`,
    };
  },
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
