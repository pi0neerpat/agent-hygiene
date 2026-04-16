import type { CheckResult, ScanContext } from "../types.js";

/**
 * Check if session data is available and return an early result if not.
 * Returns null if data is available and checks should proceed.
 */
export function checkSessionDataAvailable(
  ctx: ScanContext,
): CheckResult | null {
  const data = ctx.agentsViewData;

  if (!data?.available) {
    return {
      passed: true,
      message: "AgentsView not installed (install for session analysis)",
      confidence: 0,
    };
  }

  if (data.dailyUsage.length === 0) {
    return {
      passed: true,
      message: "No usage data for this period",
      confidence: 0,
    };
  }

  return null;
}
