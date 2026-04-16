import type { Command } from "commander";
import chalk from "chalk";
import { readScoreHistory } from "../../tracking/history.js";

export function registerProfileCommand(program: Command): void {
  program
    .command("profile")
    .description("Show your agent hygiene profile")
    .action(async () => {
      const records = await readScoreHistory();

      if (records.length === 0) {
        console.log(
          chalk.dim(
            "\n  No score history yet. Run a scan first: agent-hygiene scan\n",
          ),
        );
        return;
      }

      const latest = records[records.length - 1];
      const allTimeHigh = Math.max(...records.map((r) => r.score));
      const avgScore = Math.round(
        records.reduce((s, r) => s + r.score, 0) / records.length,
      );

      console.log(chalk.bold("\n  Agent Hygiene Profile\n"));

      const scoreColor =
        latest.score >= 80
          ? chalk.green
          : latest.score >= 60
            ? chalk.yellow
            : chalk.red;
      console.log(
        `  Current Score:  ${scoreColor(chalk.bold(String(latest.score)))}${chalk.dim("/100")} ${chalk.dim(`(${latest.grade})`)}`,
      );
      console.log(
        `  All-time High:  ${chalk.green(String(allTimeHigh))}${chalk.dim("/100")}`,
      );
      console.log(
        `  Average:        ${avgScore}${chalk.dim("/100")}  ${chalk.dim(`(${records.length} scans)`)}`,
      );
      console.log("");

      if (latest.categories.length > 0) {
        console.log(chalk.bold("  Category Breakdown"));
        const sorted = [...latest.categories].sort((a, b) => b.score - a.score);
        for (const cat of sorted) {
          const catColor =
            cat.score >= 80
              ? chalk.green
              : cat.score >= 60
                ? chalk.yellow
                : chalk.red;
          const label =
            cat.id === sorted[0].id
              ? chalk.dim(" ★ best")
              : cat.id === sorted[sorted.length - 1].id
                ? chalk.dim(" ← focus here")
                : "";
          console.log(
            `  ${cat.id.padEnd(12)} ${catColor(String(cat.score).padStart(3))}${chalk.dim("/100")} ${chalk.dim(`(${cat.grade})`)}${label}`,
          );
        }
        console.log("");
      }

      const checkPassCounts = new Map<string, number>();
      const checkTotalCounts = new Map<string, number>();
      for (const r of records) {
        for (const c of r.checks) {
          checkTotalCounts.set(c.id, (checkTotalCounts.get(c.id) ?? 0) + 1);
          if (c.passed) {
            checkPassCounts.set(c.id, (checkPassCounts.get(c.id) ?? 0) + 1);
          }
        }
      }

      const neverPassed = [...checkTotalCounts.entries()]
        .filter(([id]) => !checkPassCounts.has(id))
        .map(([id]) => id);

      if (neverPassed.length > 0) {
        console.log(chalk.bold("  Blind Spots") + chalk.dim(" (never passed)"));
        for (const id of neverPassed.slice(0, 5)) {
          console.log(`  ${chalk.red("✗")} ${id}`);
        }
        if (neverPassed.length > 5) {
          console.log(chalk.dim(`  ... and ${neverPassed.length - 5} more`));
        }
        console.log("");
      }

      if (records.length >= 2) {
        const first = records[0];
        const delta = latest.score - first.score;
        const arrow =
          delta > 0
            ? chalk.green(`+${delta} ↑`)
            : delta < 0
              ? chalk.red(`${delta} ↓`)
              : chalk.dim("no change");
        console.log(
          chalk.dim(`  Since first scan (${first.timestamp.split("T")[0]}): `) +
            arrow,
        );
        console.log("");
      }
    });
}
