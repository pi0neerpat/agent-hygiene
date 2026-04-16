import type { Check, CheckResult, ScanContext } from "./types.js";

// Auto checks (Tier 1)
import { claudeignoreCheck } from "./auto/claudeignore.js";
import { autocompactCheck, subagentModelCheck } from "./auto/env-vars.js";
import { claudemdSizeCheck } from "./auto/claudemd-size.js";
import { rulesStructureCheck } from "./auto/rules-structure.js";
import { skillsUsageCheck } from "./auto/skills-usage.js";
import { mcpToolSearchCheck } from "./auto/mcp-tool-search.js";
import { mergeTinyRulesCheck } from "./auto/merge-tiny-rules.js";
import { modelSelectionCheck } from "./auto/model-selection.js";
import { settingsSchemaCheck } from "./auto/settings-schema.js";

// Session checks (Tier 2) — requires AgentsView
import { opusOveruseCheck } from "./session/opus-overuse.js";
import { contextBloatCheck } from "./session/context-bloat.js";
import { cacheMissRateCheck } from "./session/cache-miss-rate.js";
import { sessionLengthCheck } from "./session/session-length.js";
import { subagentCostCheck } from "./session/subagent-cost.js";

// Advisory checks (Tier 3)
import { clearBetweenTasksCheck } from "./advisory/clear-between-tasks.js";
import { btwUsageCheck } from "./advisory/btw-usage.js";
import { effortLevelCheck } from "./advisory/effort-level.js";
import { subagentsResearchCheck } from "./advisory/subagents-research.js";
import { batchApiCheck } from "./advisory/batch-api.js";
import { promptCachingCheck } from "./advisory/prompt-caching.js";
import { opusplanModeCheck } from "./advisory/opusplan-mode.js";
import { sonnetDefaultCheck } from "./advisory/sonnet-default.js";

/**
 * All registered checks, in order of execution.
 */
export const ALL_CHECKS: Check[] = [
  // Tier 1: Auto-detectable (config files + env vars)
  claudeignoreCheck,
  autocompactCheck,
  subagentModelCheck,
  claudemdSizeCheck,
  rulesStructureCheck,
  skillsUsageCheck,
  mcpToolSearchCheck,
  mergeTinyRulesCheck,
  modelSelectionCheck,
  settingsSchemaCheck,

  // Tier 2: Session data (AgentsView)
  opusOveruseCheck,
  contextBloatCheck,
  cacheMissRateCheck,
  sessionLengthCheck,
  subagentCostCheck,

  // Tier 3: Advisory (habit-based recommendations)
  clearBetweenTasksCheck,
  btwUsageCheck,
  effortLevelCheck,
  subagentsResearchCheck,
  batchApiCheck,
  promptCachingCheck,
  opusplanModeCheck,
  sonnetDefaultCheck,
];

export interface CheckRunResult {
  check: Check;
  result: CheckResult;
}

/**
 * Run all checks against a scan context.
 */
export async function runChecks(
  ctx: ScanContext,
  checks: Check[] = ALL_CHECKS,
): Promise<CheckRunResult[]> {
  const results: CheckRunResult[] = [];

  for (const check of checks) {
    // Skip session checks when AgentsView has no usable data
    if (
      check.tier === "session" &&
      (!ctx.agentsViewData?.available ||
        ctx.agentsViewData.dailyUsage.length === 0)
    ) {
      continue;
    }

    // Only run checks that apply to at least one discovered agent
    const applicable = check.agents.some((agentId) => {
      const agent = ctx.agents.get(agentId);
      return agent && agent.status !== "not-found";
    });

    if (!applicable) continue;

    try {
      const result = await check.run(ctx);
      results.push({ check, result });
    } catch (err) {
      results.push({
        check,
        result: {
          passed: false,
          message: `Check error: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    }
  }

  return results;
}
