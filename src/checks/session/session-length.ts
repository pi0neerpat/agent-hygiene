import type { Check, ScanContext, CheckResult } from "../types.js";
import { getAvgDailyTokens } from "../../tracking/agentsview.js";
import { checkSessionDataAvailable } from "./helpers.js";

/**
 * Detects average tokens per session trending high,
 * suggesting the user isn't using /clear between tasks.
 *
 * If average daily token burn is high AND context-bloat isn't already
 * catching it, this check focuses on the session-level pattern.
 */
export const sessionLengthCheck: Check = {
  id: "session-length",
  name: "Session length management",
  technique: 12,
  tier: "session",
  category: "habits",
  agents: ["claude-code"],
  estimatedSavings: "Shorter sessions avoid compounding token costs from stale context",
  weight: 5,
  impact: "med",
  fixPrompt: (_ctx, result) =>
    `${result.message}. Long sessions compound token costs from stale context. ` +
    `Add a rule to CLAUDE.md: "Use /clear between unrelated tasks." ` +
    `Break heavy usage days into separate focused sessions — start each new task with a fresh context rather than continuing a long-running session.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const early = checkSessionDataAvailable(ctx);
    if (early) return early;
    const data = ctx.agentsViewData!;

    const avgDaily = getAvgDailyTokens(data);

    // Look at peak days — if any days exceed 1M tokens, flag it
    const peakDays = data.dailyUsage
      .map((day) => ({
        date: day.date,
        tokens: day.modelBreakdowns.reduce((s, m) => s + m.totalTokens, 0),
      }))
      .filter((d) => d.tokens > 1_000_000)
      .sort((a, b) => b.tokens - a.tokens);

    if (peakDays.length > 0) {
      const peakPct = ((peakDays.length / data.dailyUsage.length) * 100).toFixed(0);
      return {
        passed: false,
        message: `${peakDays.length} days exceeded 1M tokens (${peakPct}% of days)`,
        details: `Peak day: ${peakDays[0].date} with ${formatTokens(peakDays[0].tokens)}. Heavy days suggest long sessions without /clear. Break work into focused sessions.`,
      };
    }

    if (avgDaily > 300_000) {
      return {
        passed: false,
        message: `Average daily token usage: ${formatTokens(avgDaily)}`,
        details:
          "Consider using /clear between unrelated tasks to keep sessions focused. Shorter sessions = cheaper tokens.",
        confidence: 0.6,
      };
    }

    return {
      passed: true,
      message: `Average daily token usage: ${formatTokens(avgDaily)} — reasonable session lengths`,
    };
  },
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
