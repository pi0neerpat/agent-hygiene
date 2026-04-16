import type { Check, CheckResult, ScanContext } from "./types.js";

// Auto checks (Tier 1)
import { claudeignoreCheck } from "./auto/claudeignore.js";
import { autocompactCheck, subagentModelCheck } from "./auto/env-vars.js";
import { claudemdSizeCheck } from "./auto/claudemd-size.js";
import { rulesStructureCheck } from "./auto/rules-structure.js";
import { skillsUsageCheck } from "./auto/skills-usage.js";
import { mcpToolSearchCheck } from "./auto/mcp-tool-search.js";
import { mergeTinyRulesCheck } from "./auto/merge-tiny-rules.js";

/**
 * All registered checks, in order of execution.
 */
export const ALL_CHECKS: Check[] = [
  // Tier 1: Auto-detectable
  claudeignoreCheck,
  autocompactCheck,
  subagentModelCheck,
  claudemdSizeCheck,
  rulesStructureCheck,
  skillsUsageCheck,
  mcpToolSearchCheck,
  mergeTinyRulesCheck,
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
