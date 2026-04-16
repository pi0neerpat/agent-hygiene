import type { Command } from "commander";
import chalk from "chalk";
import { readScoreHistory } from "../../tracking/history.js";
import { exitWithCliError, parseIntegerOption } from "../validation.js";

interface HistoryOptions {
  json?: boolean;
  limit: string;
}

export function registerHistoryCommand(program: Command): void {
  program
    .command("history")
    .description("Show score history over time")
    .option("--json", "Output as JSON")
    .option("--limit <n>", "Number of entries to show", "20")
    .action(async (opts: HistoryOptions) => {
      let limit: number;
      try {
        limit = parseIntegerOption(opts.limit, "--limit", 1, 1000) ?? 20;
      } catch (err) {
        exitWithCliError(err);
      }

      const records = await readScoreHistory();

      if (records.length === 0) {
        console.log(
          chalk.dim(
            "\n  No score history yet. Run a scan first: agent-hygiene scan\n",
          ),
        );
        return;
      }

      const recent = records.slice(-limit);

      if (opts.json) {
        console.log(JSON.stringify(recent, null, 2));
        return;
      }

      const SPARKS = "▁▂▃▄▅▆▇█";
      const scores = recent.map((r) => r.score);
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const range = max - min || 1;
      const spark = scores
        .map(
          (s) =>
            SPARKS[Math.round(((s - min) / range) * (SPARKS.length - 1))],
        )
        .join("");

      console.log(chalk.bold("\n  Score History\n"));
      console.log(`  ${chalk.cyan(spark)}  ${chalk.dim(`(${min}–${max})`)}\n`);

      for (let i = 0; i < recent.length; i++) {
        const r = recent[i];
        const date = r.timestamp.split("T")[0];
        const prev = i > 0 ? recent[i - 1].score : null;
        let delta = "";
        if (prev !== null) {
          const d = r.score - prev;
          if (d > 0) delta = chalk.green(` +${d}`);
          else if (d < 0) delta = chalk.red(` ${d}`);
          else delta = chalk.dim("  ±0");
        }
        const scoreColor =
          r.score >= 80 ? chalk.green : r.score >= 60 ? chalk.yellow : chalk.red;
        const dir = r.projectDir
          ? chalk.dim(` ${r.projectDir.split("/").pop()}`)
          : "";
        console.log(
          `  ${chalk.dim(date)}  ${scoreColor(String(r.score).padStart(3))}${chalk.dim("/100")} ${chalk.dim(`(${r.grade})`)}${delta}${dir}`,
        );
      }
      console.log("");
    });
}
