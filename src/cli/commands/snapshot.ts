import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolve } from "path";
import { buildScanContext } from "../../utils/context.js";
import { runChecks } from "../../checks/index.js";
import { calculateScore } from "../../scoring/index.js";
import {
  renderSnapshotComparison,
  renderSnapshotSaved,
} from "../../output/terminal.js";
import {
  compareSnapshots,
  listSnapshots,
  loadSnapshot,
  saveSnapshot,
} from "../../tracking/snapshots.js";
import { exitWithCliError, validateDateOption } from "../validation.js";

interface SnapshotSaveOptions {
  dir: string;
  since?: string;
}

export function registerSnapshotCommand(program: Command): void {
  const snapshotCmd = program
    .command("snapshot")
    .description("Save and compare hygiene score snapshots");

  snapshotCmd
    .command("save <name>")
    .description("Save a snapshot of the current score and cost baseline")
    .option("-d, --dir <path>", "Project directory to scan", ".")
    .option("--since <date>", "AgentsView data start date (YYYY-MM-DD)")
    .action(async (name: string, opts: SnapshotSaveOptions) => {
      try {
        validateDateOption(opts.since, "--since");
      } catch (err) {
        exitWithCliError(err);
      }

      const projectDir = resolve(opts.dir);
      const spinner = ora({ text: "Scanning...", color: "cyan" }).start();

      try {
        const ctx = await buildScanContext(projectDir, {
          agentsViewSince: opts.since,
        });
        const results = await runChecks(ctx);
        const score = calculateScore(results);
        const filepath = await saveSnapshot(name, score, ctx.agentsViewData);

        spinner.stop();
        console.log(renderSnapshotSaved(name, filepath, score.score));
      } catch (err) {
        spinner.fail(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });

  snapshotCmd
    .command("compare <before> <after>")
    .description("Compare two saved snapshots")
    .action(async (beforeName: string, afterName: string) => {
      const before = await requireSnapshot(beforeName);
      const after = await requireSnapshot(afterName);
      const comparison = compareSnapshots(before, after);
      console.log(renderSnapshotComparison(comparison));
    });

  snapshotCmd
    .command("list")
    .description("List saved snapshots")
    .action(async () => {
      const snapshots = await listSnapshots();
      if (snapshots.length === 0) {
        console.log(
          chalk.dim(
            "\n  No snapshots saved yet. Run: agent-hygiene snapshot save <name>\n",
          ),
        );
        return;
      }

      console.log(chalk.bold("\n  Saved Snapshots\n"));
      for (const name of snapshots) {
        const snap = await loadSnapshot(name);
        if (snap) {
          console.log(
            `  ${chalk.cyan(name)} — ${snap.score}/100 (${snap.grade}) ${chalk.dim(snap.timestamp.split("T")[0])}`,
          );
        }
      }
      console.log("");
    });
}

async function requireSnapshot(
  name: string,
): Promise<NonNullable<Awaited<ReturnType<typeof loadSnapshot>>>> {
  const snapshot = await loadSnapshot(name);
  if (!snapshot) {
    await renderMissingSnapshot(name);
  }
  return snapshot as NonNullable<Awaited<ReturnType<typeof loadSnapshot>>>;
}

async function renderMissingSnapshot(name: string): Promise<never> {
  console.error(chalk.red(`Snapshot "${name}" not found.`));
  const existing = await listSnapshots();
  if (existing.length > 0) {
    console.log(chalk.dim(`  Available: ${existing.join(", ")}`));
  }
  process.exit(1);
}
