import type { Check, ScanContext, CheckResult } from "../types.js";
import { getModelTokens, getTotalTokens } from "../../tracking/agentsview.js";
import { checkSessionDataAvailable } from "./helpers.js";

/**
 * Detects subagent cost inefficiency from token distribution alone.
 *
 * Pure Tier 2 (Sprint 3.5): this check used to cross-reference env vars
 * and shell profile contents. That duplicated the Tier 1 `subagent-model`
 * check and blurred the tier boundary. It now observes only the signal
 * available in AgentsView data:
 *
 *   Heavy Opus share + negligible Haiku share ⇒ subagent tasks (which
 *   are typically exploration / lookup / research) are running on the
 *   premium model. Routing them to Haiku would save 60-80% of that spend.
 */
export const subagentCostCheck: Check = {
  id: "subagent-cost",
  name: "Subagent cost efficiency",
  technique: 10,
  tier: "session",
  category: "cost",
  agents: ["claude-code"],
  estimatedSavings:
    "Routing subagents to Haiku/Sonnet can save 60-80% on exploration tasks",
  weight: 7,
  impact: "high",
  fixPrompt: `Configure subagent routing to use cheaper models. Set CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001 in ~/.claude/settings.json or your shell profile. This routes exploration, research, and lookup tasks to Haiku instead of the premium model, saving 60-80% on subagent costs. Also add guidance to CLAUDE.md to delegate exploration and codebase searches to subagents rather than doing them in the main context.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const early = checkSessionDataAvailable(ctx);
    if (early) return early;
    const data = ctx.agentsViewData!;

    const total = getTotalTokens(data);
    if (total === 0) {
      return { passed: true, message: "No token usage recorded" };
    }

    const opusTokens = getModelTokens(data, /opus/i);
    const sonnetTokens = getModelTokens(data, /sonnet/i);
    const haikuTokens = getModelTokens(data, /haiku/i);

    const opusPct = (opusTokens / total) * 100;
    const haikuPct = (haikuTokens / total) * 100;
    const cheapPct = ((haikuTokens + sonnetTokens) / total) * 100;

    // Strong signal: dominant Opus with negligible Haiku.
    // Subagent work is almost certainly running on Opus.
    if (opusPct > 80 && haikuPct < 2) {
      return {
        passed: false,
        message: `${opusPct.toFixed(0)}% Opus and ${haikuPct.toFixed(0)}% Haiku — subagents likely on premium model`,
        details:
          "Near-zero Haiku usage with dominant Opus suggests exploration and research tasks are running on the premium model. Set CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001 (see the `subagent-model` check) so subagents route to Haiku.",
      };
    }

    // Moderate signal: heavy Opus with very little Haiku.
    if (opusPct > 60 && haikuPct < 5) {
      return {
        passed: false,
        message: `${opusPct.toFixed(0)}% Opus with only ${haikuPct.toFixed(0)}% Haiku — subagent routing looks off`,
        details:
          "Low Haiku share suggests subagents aren't being routed to cheaper models. Confirm CLAUDE_CODE_SUBAGENT_MODEL is set and that you're delegating exploration to subagents.",
        confidence: 0.6,
      };
    }

    if (cheapPct >= 30) {
      return {
        passed: true,
        message: `${cheapPct.toFixed(0)}% of tokens on Sonnet/Haiku — good cost distribution`,
      };
    }

    return {
      passed: true,
      message: `Model mix: ${opusPct.toFixed(0)}% Opus · ${sonnetShare(sonnetTokens, total)} Sonnet · ${haikuPct.toFixed(0)}% Haiku`,
    };
  },
};

function sonnetShare(sonnetTokens: number, total: number): string {
  return `${((sonnetTokens / total) * 100).toFixed(0)}%`;
}
