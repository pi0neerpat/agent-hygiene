import type { Command } from "commander";
import { resolve } from "path";
import { buildScanContext } from "../../utils/context.js";
import { runChecks } from "../../checks/index.js";
import { calculateScore } from "../../scoring/index.js";

interface ExportOptions {
  dir: string;
  session: boolean;
}

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description("Generate an anonymized JSON payload for sharing/leaderboard")
    .option("-d, --dir <path>", "Project directory to scan", ".")
    .option("--no-session", "Skip AgentsView session data checks")
    .action(async (opts: ExportOptions) => {
      const projectDir = resolve(opts.dir);

      try {
        const ctx = await buildScanContext(projectDir, {
          skipAgentsView: opts.session === false,
        });
        const results = await runChecks(ctx);
        const score = calculateScore(results);

        // Anonymized payload — no paths, env values, or identifying info.
        const payload = {
          version: program.version() ?? "0.0.0",
          timestamp: new Date().toISOString(),
          score: score.score,
          grade: score.grade,
          categories: score.categories
            .filter((c) => c.total > 0)
            .map((c) => ({
              id: c.category.id,
              score: c.score,
              grade: c.grade,
              passed: c.passed,
              total: c.total,
            })),
          checks: score.categories.flatMap((c) =>
            c.checks.map((cr) => ({
              id: cr.check.id,
              passed: cr.result.passed,
              tier: cr.check.tier,
            })),
          ),
          agents: [...ctx.agents.entries()]
            .filter(([, a]) => a.status !== "not-found")
            .map(([id, a]) => ({
              id,
              status: a.status,
            })),
        };

        console.log(JSON.stringify(payload, null, 2));
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });
}
