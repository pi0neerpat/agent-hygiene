import type { Check, ScanContext, CheckResult } from "../types.js";
import { getModelTokens, getTotalTokens } from "../../tracking/agentsview.js";
import { checkSessionDataAvailable } from "./helpers.js";

/**
 * Detects high percentage of tokens spent on Opus models
 * when Sonnet/Haiku would likely suffice for most tasks.
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

    // Threshold: >40% on Opus suggests overuse
    if (opusPct > 40) {
      return {
        passed: false,
        message: `${opusPct.toFixed(0)}% of tokens spent on Opus models`,
        details: `${formatTokens(opusTokens)} of ${formatTokens(total)} total tokens went to Opus. Most coding tasks work well with Sonnet — reserve Opus for complex architecture and planning.`,
      };
    }

    if (opusPct > 20) {
      return {
        passed: false,
        message: `${opusPct.toFixed(0)}% of tokens on Opus (moderate)`,
        details: "Consider whether all Opus sessions truly needed the premium model.",
        confidence: 0.6,
      };
    }

    return {
      passed: true,
      message: `Opus usage is ${opusPct.toFixed(0)}% of total tokens — good balance`,
    };
  },
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
