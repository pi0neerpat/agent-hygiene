import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { renderTrends } from "../../output/terminal.js";
import { collectAgentsViewData } from "../../tracking/agentsview.js";
import { analyzeTrends } from "../../tracking/trends.js";
import { exitWithCliError, validateDateOption } from "../validation.js";

interface TrackOptions {
  since?: string;
  json?: boolean;
}

export function registerTrackCommand(program: Command): void {
  program
    .command("track")
    .description("Show cost and usage trends from AgentsView data")
    .option("--since <date>", "Start date (YYYY-MM-DD, default: 30 days ago)")
    .option("--json", "Output as JSON")
    .action(async (opts: TrackOptions) => {
      try {
        validateDateOption(opts.since, "--since");
      } catch (err) {
        exitWithCliError(err);
      }

      const spinner = ora({
        text: "Collecting AgentsView data...",
        color: "cyan",
      }).start();

      try {
        const data = await collectAgentsViewData(opts.since);

        if (!data.available) {
          spinner.warn("AgentsView binary not found.");
          console.log(
            chalk.dim(
              "\n  Install agentsview to enable usage tracking and trend analysis.\n" +
                "  Set $AGENTSVIEW_BIN or install to ~/.local/bin/agentsview\n",
            ),
          );
          return;
        }

        if (data.dailyUsage.length === 0) {
          spinner.warn("No usage data found for the specified period.");
          return;
        }

        spinner.stop();
        const trends = analyzeTrends(data);

        if (opts.json) {
          console.log(JSON.stringify(trends, null, 2));
          return;
        }

        console.log(renderTrends(trends));
      } catch (err) {
        spinner.fail(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });
}
