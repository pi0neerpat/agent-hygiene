import type { Check, ScanContext, CheckResult } from "../types.js";
import { getModelTokens, getTotalTokens } from "../../tracking/agentsview.js";
import { checkSessionDataAvailable } from "./helpers.js";

/**
 * Analyzes subagent spend ratio vs main session cost.
 *
 * Heuristic: if Haiku tokens are very low compared to total,
 * subagents aren't being delegated to cheaper models. Conversely,
 * if Opus tokens dominate even though SUBAGENT_MODEL is set,
 * subagents might not be picking up the override.
 */
export const subagentCostCheck: Check = {
  id: "subagent-cost",
  name: "Subagent cost efficiency",
  technique: 10,
  tier: "session",
  category: "cost",
  agents: ["claude-code"],
  estimatedSavings: "Routing subagents to Haiku/Sonnet can save 60-80% on exploration tasks",
  weight: 7,

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

    // If there's meaningful usage but zero haiku tokens, subagents
    // are probably running on expensive models
    const cheapTokens = haikuTokens + sonnetTokens;
    const cheapPct = (cheapTokens / total) * 100;
    const opusPct = (opusTokens / total) * 100;

    // Check if SUBAGENT_MODEL is set
    const subagentModelSet =
      !!ctx.env.CLAUDE_CODE_SUBAGENT_MODEL ||
      ctx.shellProfileContents.includes("CLAUDE_CODE_SUBAGENT_MODEL");

    if (opusPct > 80 && !subagentModelSet) {
      return {
        passed: false,
        message: `${opusPct.toFixed(0)}% of tokens on Opus with no subagent model override`,
        details:
          "Nearly all tokens are going to Opus, including subagent tasks. Set CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001 to route exploration and research tasks to a cheaper model.",
      };
    }

    if (subagentModelSet && opusPct > 60) {
      return {
        passed: false,
        message: `Despite SUBAGENT_MODEL being set, ${opusPct.toFixed(0)}% of tokens still on Opus`,
        details:
          "The subagent model override is set but Opus still dominates. Check if subagents are actually being used for research/exploration tasks.",
        confidence: 0.5,
      };
    }

    if (cheapPct > 30) {
      return {
        passed: true,
        message: `${cheapPct.toFixed(0)}% of tokens on Sonnet/Haiku — good cost distribution`,
      };
    }

    return {
      passed: true,
      message: `Model mix: ${opusPct.toFixed(0)}% Opus, ${(100 - opusPct).toFixed(0)}% other`,
    };
  },
};
