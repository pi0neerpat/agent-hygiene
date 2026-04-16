import type { OverallScore } from "../scoring/index.js";
import type { DiscoveredAgent } from "../checks/types.js";

/**
 * Render the scan results as a JSON object for CI/CD integration.
 */
export function renderJson(
  score: OverallScore,
  agents: Map<string, DiscoveredAgent>,
): string {
  const output = {
    score: score.score,
    grade: score.grade,
    agents: Object.fromEntries(
      [...agents.entries()]
        .filter(([, a]) => a.status !== "not-found")
        .map(([id, a]) => [
          id,
          { name: a.name, status: a.status, paths: a.foundPaths },
        ]),
    ),
    categories: score.categories
      .filter((c) => c.total > 0)
      .map((c) => ({
        name: c.category.name,
        id: c.category.id,
        score: c.score,
        grade: c.grade,
        passed: c.passed,
        total: c.total,
        checks: c.checks.map((cr) => ({
          id: cr.check.id,
          name: cr.check.name,
          passed: cr.result.passed,
          message: cr.result.message,
          tier: cr.check.tier,
          technique: cr.check.technique,
          estimatedSavings: cr.check.estimatedSavings,
        })),
      })),
  };

  return JSON.stringify(output, null, 2);
}
