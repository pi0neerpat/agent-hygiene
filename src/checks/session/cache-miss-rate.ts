import type { Check, ScanContext, CheckResult } from "../types.js";
import { getCacheReadRatio } from "../../tracking/agentsview.js";
import { checkSessionDataAvailable } from "./helpers.js";

/**
 * Detects low prompt cache hit rates across sessions.
 *
 * A healthy setup using the latest SDK should achieve >30% cache reads
 * relative to total input tokens. Low ratios suggest the SDK isn't
 * leveraging prompt caching or system prompts are changing too frequently.
 */
export const cacheMissRateCheck: Check = {
  id: "cache-miss-rate",
  name: "Prompt cache efficiency",
  technique: 20,
  tier: "session",
  category: "cost",
  agents: ["claude-code"],
  estimatedSavings: "Prompt caching can reduce input costs by up to 90%",
  weight: 6,
  impact: "med",
  fixPrompt: (_ctx, result) =>
    `I ran agent-hygiene and it flagged: ${result.message}. Cached input tokens cost 90% less than uncached ones.\n\n` +
    `Could you help improve my cache efficiency? I'd like you to:\n` +
    `1. Look at the \`@anthropic-ai/sdk\` version pinned in my package.json — recent versions support automatic prompt caching. Don't upgrade anything yourself; if you need to check what's current on npm, tell me to run \`! npm view @anthropic-ai/sdk version\` and I'll paste the result back.\n` +
    `2. Review CLAUDE.md and my system prompts for anything that might be changing frequently across turns, since that would invalidate the cache.\n` +
    `3. If I'm using the API directly, suggest where to add cache_control breakpoints to reused system messages.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const early = checkSessionDataAvailable(ctx);
    if (early) return early;
    const data = ctx.agentsViewData!;

    const cacheRatio = getCacheReadRatio(data);
    const pct = (cacheRatio * 100).toFixed(0);

    // Good: >30% cache reads
    if (cacheRatio >= 0.3) {
      return {
        passed: true,
        message: `Cache hit rate: ${pct}% — good efficiency`,
      };
    }

    // Moderate: 15-30%
    if (cacheRatio >= 0.15) {
      return {
        passed: false,
        message: `Cache hit rate: ${pct}% (could be better)`,
        details:
          "Your prompt cache hit rate is moderate. Ensure you're using the latest SDK version for automatic prompt caching. Avoid frequently changing system prompts.",
        confidence: 0.5,
      };
    }

    // Low: <15%
    return {
      passed: false,
      message: `Cache hit rate: ${pct}% — low efficiency`,
      details:
        "Very low cache hit rate. This means you're paying full price for repeated input tokens. Update to the latest Anthropic SDK for auto-caching, and keep CLAUDE.md and system prompts stable across turns.",
    };
  },
};
