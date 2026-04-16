import chalk from "chalk";
import type { OverallScore, CategoryScore } from "../scoring/index.js";
import type { DiscoveredAgent } from "../checks/types.js";

/**
 * Render the full scan report to the terminal.
 */
export function renderReport(
  score: OverallScore,
  agents: Map<string, DiscoveredAgent>,
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(renderHeader(score));
  lines.push("");

  // Discovered agents
  lines.push(chalk.bold("  Detected Agents"));
  for (const [, agent] of agents) {
    if (agent.status === "not-found") continue;
    const icon =
      agent.status === "configured"
        ? chalk.green("●")
        : chalk.yellow("○");
    lines.push(`  ${icon} ${agent.name}`);
  }
  lines.push("");

  // Category breakdown
  for (const cat of score.categories) {
    if (cat.total === 0) continue;
    lines.push(renderCategory(cat));
    lines.push("");
  }

  // Footer
  lines.push(
    chalk.dim(
      "  Run with --fix to apply recommended changes.",
    ),
  );
  lines.push("");

  return lines.join("\n");
}

function renderHeader(score: OverallScore): string {
  const color = scoreColor(score.score);
  const bar = renderBar(score.score, 20);
  return [
    chalk.bold(`  Agent Hygiene Score: ${color(`${score.score}/100`)} ${chalk.dim(`(${score.grade})`)}`),
    `  ${bar}`,
  ].join("\n");
}

function renderCategory(cat: CategoryScore): string {
  const lines: string[] = [];
  const color = scoreColor(cat.score);
  const bar = renderBar(cat.score, 10);

  lines.push(
    `  ${chalk.bold(padRight(cat.category.name, 20))} ${bar} ${color(cat.grade)} ${chalk.dim(`(${cat.score}/100)`)}`,
  );

  for (const { check, result } of cat.checks) {
    const icon = result.passed
      ? chalk.green("✓")
      : chalk.red("✗");
    const msg = result.passed
      ? chalk.dim(result.message)
      : result.message;
    lines.push(`    ${icon} ${msg}`);

    if (!result.passed && result.details) {
      lines.push(chalk.dim(`      → ${result.details}`));
    }

    if (!result.passed && check.estimatedSavings) {
      lines.push(
        chalk.dim(
          `      💡 ${check.estimatedSavings}`,
        ),
      );
    }
  }

  return lines.join("\n");
}

function renderBar(score: number, width: number): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = scoreColor(score);
  return color("█".repeat(filled)) + chalk.dim("░".repeat(empty));
}

function scoreColor(score: number): chalk.ChalkInstance {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  return chalk.red;
}

function padRight(str: string, len: number): string {
  return str + " ".repeat(Math.max(0, len - str.length));
}

/**
 * Render a summary of discovered agents.
 */
export function renderAgentDiscovery(
  agents: Map<string, DiscoveredAgent>,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold("\n  Agent Discovery\n"));

  const found: DiscoveredAgent[] = [];
  const notFound: DiscoveredAgent[] = [];

  for (const [, agent] of agents) {
    if (agent.status === "not-found") {
      notFound.push(agent);
    } else {
      found.push(agent);
    }
  }

  for (const agent of found) {
    const icon =
      agent.status === "configured"
        ? chalk.green("●")
        : chalk.yellow("○");
    const status =
      agent.status === "configured"
        ? chalk.green("configured")
        : chalk.yellow("installed");
    lines.push(
      `  ${icon} ${padRight(agent.name, 18)} ${status} ${chalk.dim(`(${agent.foundPaths.length} paths)`)}`,
    );
  }

  if (notFound.length > 0) {
    lines.push(
      chalk.dim(
        `\n  ${notFound.length} agents not found: ${notFound.map((a) => a.name).join(", ")}`,
      ),
    );
  }

  return lines.join("\n");
}
