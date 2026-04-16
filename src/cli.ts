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
import { generateBadgeSvg, badgeMarkdownSnippet } from "./output/badge.js";
import { runFixMode } from "./fixers/index.js";
import {
  saveSnapshot,
  loadSnapshot,
  listSnapshots,
  compareSnapshots,
} from "./tracking/snapshots.js";
import { collectAgentsViewData } from "./tracking/agentsview.js";
import { analyzeTrends } from "./tracking/trends.js";
import { appendScoreRecord, readScoreHistory } from "./tracking/history.js";

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
  .option("--min-score <n>", "Exit with code 1 if score is below threshold")
  .option("--ci", "CI mode: --min-score 70 --json (sensible CI defaults)")
  .action(async (opts) => {
    // --ci is shorthand for --min-score 70 --json
    if (opts.ci) {
      opts.json = opts.json ?? true;
      opts.minScore = opts.minScore ?? "70";
    }
    const minScore = opts.minScore ? parseInt(opts.minScore, 10) : null;

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

      // Compute cost/usage insights when AgentsView data is available.
      // These are surfaced inline in the scan report alongside the check grid
      // (the standalone `track` command remains for detailed per-day drilldown).
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
          }),
        );
        return;
      }

      // Render terminal report
      console.log(
        renderReport(score, ctx.agents, {
          agentsViewAvailable: ctx.agentsViewData?.available ?? false,
          trends,
        }),
      );

      // Auto-append to score history (terminal output only — not --json/--markdown)
      try {
        await appendScoreRecord(score, projectDir, program.version() ?? "0.0.0");
      } catch {
        // Non-fatal: don't break the scan if history write fails
      }

      // Fix mode
      if (opts.fix) {
        await runFixMode(results, ctx);
      }

      // CI exit code: fail if score is below threshold
      if (minScore !== null) {
        if (score.score >= minScore) {
          if (!opts.json && !opts.markdown) {
            console.log(
              chalk.green(`  PASS — score ${score.score} ≥ ${minScore}`),
            );
          }
        } else {
          if (!opts.json && !opts.markdown) {
            console.log(
              chalk.red(`  FAIL — score ${score.score} < ${minScore}`),
            );
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

// ── Export command ────────────────────────────────────────────────

program
  .command("export")
  .description("Generate an anonymized JSON payload for sharing/leaderboard")
  .option("-d, --dir <path>", "Project directory to scan", ".")
  .option("--no-session", "Skip AgentsView session data checks")
  .action(async (opts: { dir: string; session: boolean }) => {
    const projectDir = resolve(opts.dir);

    try {
      const ctx = await buildScanContext(projectDir, {
        skipAgentsView: opts.session === false,
      });
      const results = await runChecks(ctx);
      const score = calculateScore(results);

      // Anonymized payload — no paths, env values, or identifying info
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

// ── Badge command ─────────────────────────────────────────────────

program
  .command("badge")
  .description("Generate an SVG badge for your hygiene score")
  .option("-d, --dir <path>", "Project directory to scan", ".")
  .option("-o, --output <path>", "Write SVG to file instead of stdout")
  .action(async (opts: { dir: string; output?: string }) => {
    const projectDir = resolve(opts.dir);
    // Only show spinner when writing to a file (SVG to stdout must be clean)
    const spinner = opts.output
      ? ora({ text: "Scanning...", color: "cyan" }).start()
      : null;

    try {
      const ctx = await buildScanContext(projectDir, { skipAgentsView: true });
      const results = await runChecks(ctx);
      const score = calculateScore(results);
      spinner?.stop();

      const svg = generateBadgeSvg(score.score, score.grade);

      if (opts.output) {
        const { writeFile } = await import("fs/promises");
        await writeFile(opts.output, svg, "utf-8");
        console.log(chalk.green(`  ✓ Badge saved to ${opts.output}`));
        console.log(chalk.dim(`  ${badgeMarkdownSnippet(opts.output)}`));
      } else {
        console.log(svg);
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

// ── Profile command ───────────────────────────────────────────────

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
    const allTimeLow = Math.min(...records.map((r) => r.score));
    const avgScore = Math.round(
      records.reduce((s, r) => s + r.score, 0) / records.length,
    );

    console.log(chalk.bold("\n  Agent Hygiene Profile\n"));

    // Current score
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

    // Category breakdown from latest scan
    if (latest.categories.length > 0) {
      console.log(chalk.bold("  Category Breakdown"));
      // Find best and worst
      const sorted = [...latest.categories].sort(
        (a, b) => b.score - a.score,
      );
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

    // Blind spots — checks that have never passed across all history
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

    // Trend — compare first vs latest
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
        chalk.dim(
          `  Since first scan (${first.timestamp.split("T")[0]}): `,
        ) + arrow,
      );
      console.log("");
    }
  });

// ── History command ───────────────────────────────────────────────

program
  .command("history")
  .description("Show score history over time")
  .option("--json", "Output as JSON")
  .option("--limit <n>", "Number of entries to show", "20")
  .action(async (opts: { json?: boolean; limit: string }) => {
    const records = await readScoreHistory();

    if (records.length === 0) {
      console.log(
        chalk.dim(
          "\n  No score history yet. Run a scan first: agent-hygiene scan\n",
        ),
      );
      return;
    }

    const limit = Math.max(1, parseInt(opts.limit, 10) || 20);
    const recent = records.slice(-limit);

    if (opts.json) {
      console.log(JSON.stringify(recent, null, 2));
      return;
    }

    // Sparkline
    const SPARKS = "▁▂▃▄▅▆▇█";
    const scores = recent.map((r) => r.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;
    const spark = scores
      .map((s) => SPARKS[Math.round(((s - min) / range) * (SPARKS.length - 1))])
      .join("");

    console.log(chalk.bold("\n  Score History\n"));
    console.log(`  ${chalk.cyan(spark)}  ${chalk.dim(`(${min}–${max})`)}\n`);

    // Per-scan rows
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
        r.score >= 80
          ? chalk.green
          : r.score >= 60
            ? chalk.yellow
            : chalk.red;
      const dir = r.projectDir
        ? chalk.dim(` ${r.projectDir.split("/").pop()}`)
        : "";
      console.log(
        `  ${chalk.dim(date)}  ${scoreColor(String(r.score).padStart(3))}${chalk.dim("/100")} ${chalk.dim(`(${r.grade})`)}${delta}${dir}`,
      );
    }
    console.log("");
  });

program.parse();
