import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolve } from "path";
import { buildScanContext } from "../../utils/context.js";
import { runChecks, ALL_CHECKS } from "../../checks/index.js";
import { calculateScore } from "../../scoring/index.js";
import { renderReport, renderAgentDiscovery } from "../../output/terminal.js";
import { renderJson } from "../../output/json.js";
import { renderMarkdown } from "../../output/markdown.js";
import { runFixMode } from "../../fixers/index.js";
import { analyzeTrends } from "../../tracking/trends.js";
import { appendScoreRecord } from "../../tracking/history.js";
import {
  exitWithCliError,
  parseIntegerOption,
  validateDateOption,
} from "../validation.js";

interface ScanOptions {
  dir: string;
  fix?: boolean;
  json?: boolean;
  markdown?: boolean;
  agentsOnly?: boolean;
  session?: boolean;
  since?: string;
  minScore?: string;
  ci?: boolean;
}

export function registerScanCommand(program: Command): void {
  program
    .command("scan", { isDefault: true })
    .description("Scan the current project for agent hygiene issues")
    .option("-d, --dir <path>", "Project directory to scan", ".")
    .option("--fix", "Interactively fix detected issues")
    .option("--json", "Output results as JSON")
    .option("--markdown", "Output results as Markdown")
    .option("--agents-only", "Only show discovered agents")
    .option("--no-session", "Skip AgentsView session data checks")
    .option("--since <date>", "AgentsView data start date (YYYY-MM-DD)")
    .option("--min-score <n>", "Exit with code 1 if score is below threshold")
    .option("--ci", "CI mode: --min-score 70 --json (sensible CI defaults)")
    .action(async (opts: ScanOptions) => {
      // --ci is shorthand for --min-score 70 --json
      if (opts.ci) {
        opts.json = opts.json ?? true;
        opts.minScore = opts.minScore ?? "70";
      }

      let minScore: number | null;
      try {
        validateDateOption(opts.since, "--since");
        minScore = parseIntegerOption(opts.minScore, "--min-score", 0, 100);
      } catch (err) {
        exitWithCliError(err);
      }

      const projectDir = resolve(opts.dir);
      const useSpinner = !opts.json && !opts.markdown;
      const spinner = useSpinner
        ? ora({ text: "Discovering agents...", color: "cyan" }).start()
        : null;

      try {
        const ctx = await buildScanContext(projectDir, {
          skipAgentsView: opts.session === false,
          agentsViewSince: opts.since,
        });

        if (opts.agentsOnly) {
          spinner?.stop();
          console.log(renderAgentDiscovery(ctx.agents));
          return;
        }

        const foundAgents = [...ctx.agents.values()].filter(
          (a) => a.status !== "not-found",
        );
        if (foundAgents.length === 0) {
          spinner?.warn("No AI coding agents detected in this environment.");
          console.log(
            chalk.dim(
              "\n  Tip: Run this from a project directory that uses Claude Code, Cursor, or another supported agent.\n",
            ),
          );
          return;
        }

        if (spinner) {
          spinner.text = `Running checks (${ALL_CHECKS.length} checks)...`;
        }

        const results = await runChecks(ctx);
        const score = calculateScore(results);
        spinner?.stop();

        const trends =
          ctx.agentsViewData?.available &&
          ctx.agentsViewData.dailyUsage.length > 0
            ? analyzeTrends(ctx.agentsViewData)
            : null;

        if (opts.json) {
          console.log(renderJson(score, ctx.agents));
          return;
        }

        if (opts.markdown) {
          console.log(
            renderMarkdown(score, ctx.agents, {
              trends,
              agentsViewAvailable: ctx.agentsViewData?.available ?? false,
              checks: ALL_CHECKS,
            }),
          );
          return;
        }

        console.log(
          renderReport(score, ctx.agents, {
            agentsViewAvailable: ctx.agentsViewData?.available ?? false,
            trends,
            checks: ALL_CHECKS,
          }),
        );

        try {
          await appendScoreRecord(
            score,
            projectDir,
            program.version() ?? "0.0.0",
          );
        } catch {
          // Non-fatal: don't break the scan if history write fails.
        }

        if (opts.fix) {
          await runFixMode(results, ctx);
        }

        if (minScore !== null) {
          if (score.score >= minScore) {
            if (!opts.json && !opts.markdown) {
              console.log(
                chalk.green(`  PASS — score ${score.score} ≥ ${minScore}`),
              );
            }
          } else {
            if (!opts.json && !opts.markdown) {
              console.log(chalk.red(`  FAIL — score ${score.score} < ${minScore}`));
            }
            process.exit(1);
          }
        }
      } catch (err) {
        const msg = `Error: ${err instanceof Error ? err.message : String(err)}`;
        if (spinner) {
          spinner.fail(msg);
        } else {
          console.error(msg);
        }
        process.exit(1);
      }
    });
}
