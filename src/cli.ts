import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolve } from "path";
import { buildScanContext } from "./utils/context.js";
import { runChecks, ALL_CHECKS } from "./checks/index.js";
import { calculateScore } from "./scoring/index.js";
import {
  renderReport,
  renderAgentDiscovery,
  renderSnapshotComparison,
  renderSnapshotSaved,
  renderTrends,
} from "./output/terminal.js";
import { renderJson } from "./output/json.js";
import { renderMarkdown } from "./output/markdown.js";
import { runFixMode } from "./fixers/index.js";
import {
  saveSnapshot,
  loadSnapshot,
  listSnapshots,
  compareSnapshots,
} from "./tracking/snapshots.js";
import { collectAgentsViewData } from "./tracking/agentsview.js";
import { analyzeTrends } from "./tracking/trends.js";

const program = new Command();

program
  .name("agent-hygiene")
  .description(
    "Scan your AI coding agent setup, score it against 20 proven techniques, and optionally apply fixes.",
  )
  .version("0.1.0");

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
  .action(async (opts) => {
    const projectDir = resolve(opts.dir);

    const useSpinner = !opts.json && !opts.markdown;
    const spinner = useSpinner
      ? ora({ text: "Discovering agents...", color: "cyan" }).start()
      : null;

    try {
      // Build scan context
      const ctx = await buildScanContext(projectDir, {
        skipAgentsView: opts.session === false,
        agentsViewSince: opts.since,
      });

      if (opts.agentsOnly) {
        spinner?.stop();
        console.log(renderAgentDiscovery(ctx.agents));
        return;
      }

      // Check how many agents were found
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

      if (spinner) spinner.text = `Running checks (${ALL_CHECKS.length} checks)...`;

      // Run checks
      const results = await runChecks(ctx);

      // Calculate score
      const score = calculateScore(results);

      spinner?.stop();

      if (opts.json) {
        console.log(renderJson(score, ctx.agents));
        return;
      }

      if (opts.markdown) {
        console.log(renderMarkdown(score, ctx.agents));
        return;
      }

      // Render terminal report
      console.log(
        renderReport(score, ctx.agents, {
          agentsViewAvailable: ctx.agentsViewData?.available ?? false,
        }),
      );

      // Fix mode
      if (opts.fix) {
        await runFixMode(results, ctx);
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

program
  .command("discover")
  .description("Show which AI coding agents are detected")
  .option("-d, --dir <path>", "Project directory to scan", ".")
  .action(async (opts) => {
    const projectDir = resolve(opts.dir);
    const ctx = await buildScanContext(projectDir, { skipAgentsView: true });
    console.log(renderAgentDiscovery(ctx.agents));
  });

// ── Snapshot commands ──────────────────────────────────────────────

const snapshotCmd = program
  .command("snapshot")
  .description("Save and compare hygiene score snapshots");

snapshotCmd
  .command("save <name>")
  .description("Save a snapshot of the current score and cost baseline")
  .option("-d, --dir <path>", "Project directory to scan", ".")
  .option("--since <date>", "AgentsView data start date (YYYY-MM-DD)")
  .action(async (name: string, opts: { dir: string; since?: string }) => {
    const projectDir = resolve(opts.dir);
    const spinner = ora({ text: "Scanning...", color: "cyan" }).start();

    try {
      const ctx = await buildScanContext(projectDir, {
        agentsViewSince: opts.since,
      });
      const results = await runChecks(ctx);
      const score = calculateScore(results);

      const filepath = await saveSnapshot(
        name,
        score,
        ctx.agentsViewData,
      );
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
    const before = await loadSnapshot(beforeName);
    if (!before) {
      console.error(chalk.red(`Snapshot "${beforeName}" not found.`));
      const existing = await listSnapshots();
      if (existing.length > 0) {
        console.log(chalk.dim(`  Available: ${existing.join(", ")}`));
      }
      process.exit(1);
    }

    const after = await loadSnapshot(afterName);
    if (!after) {
      console.error(chalk.red(`Snapshot "${afterName}" not found.`));
      const existing = await listSnapshots();
      if (existing.length > 0) {
        console.log(chalk.dim(`  Available: ${existing.join(", ")}`));
      }
      process.exit(1);
    }

    const comparison = compareSnapshots(before, after);
    console.log(renderSnapshotComparison(comparison));
  });

snapshotCmd
  .command("list")
  .description("List saved snapshots")
  .action(async () => {
    const snapshots = await listSnapshots();
    if (snapshots.length === 0) {
      console.log(chalk.dim("\n  No snapshots saved yet. Run: agent-hygiene snapshot save <name>\n"));
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

// ── Track command ──────────────────────────────────────────────────

program
  .command("track")
  .description("Show cost and usage trends from AgentsView data")
  .option("--since <date>", "Start date (YYYY-MM-DD, default: 30 days ago)")
  .option("--json", "Output as JSON")
  .action(async (opts: { since?: string; json?: boolean }) => {
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

program.parse();
