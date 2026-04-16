import chalk from "chalk";
import type { OverallScore, CategoryScore } from "../scoring/index.js";
import type { Check, DiscoveredAgent } from "../checks/types.js";
import type { SnapshotComparison, Snapshot } from "../tracking/snapshots.js";
import type { TrendAnalysis } from "../tracking/trends.js";

// ── Visual helpers ─────────────────────────────────────────────────

/** Strip ANSI escape codes to measure visible string width */
function visLen(s: string): number {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/** Right-pad a string to `width` visible characters (ANSI-aware) */
function padVis(s: string, width: number): string {
  const diff = width - visLen(s);
  return diff > 0 ? s + " ".repeat(diff) : s;
}

function padRight(str: string, len: number): string {
  return str + " ".repeat(Math.max(0, len - str.length));
}

function scoreColor(score: number): typeof chalk.green {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  return chalk.red;
}

function renderBar(score: number, width: number): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = scoreColor(score);
  return color("█".repeat(filled)) + chalk.dim("░".repeat(empty));
}

// ── Box drawing (for header card) ──────────────────────────────────

const BOX_W = 56; // inner content width

function boxTop(): string {
  return `  ┌${"─".repeat(BOX_W + 2)}┐`;
}

function boxBot(): string {
  return `  └${"─".repeat(BOX_W + 2)}┘`;
}

function boxLine(content: string): string {
  return `  │ ${padVis(content, BOX_W)} │`;
}

function boxEmpty(): string {
  return `  │ ${" ".repeat(BOX_W)} │`;
}

// ── Main report ────────────────────────────────────────────────────

/**
 * Render the full scan report to the terminal.
 */
export function renderReport(
  score: OverallScore,
  agents: Map<string, DiscoveredAgent>,
  opts?: {
    agentsViewAvailable?: boolean;
    trends?: TrendAnalysis | null;
    checks?: Check[];
  },
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(renderHeader(score, agents));
  lines.push("");

  // Category breakdown
  for (const cat of score.categories) {
    if (cat.total === 0) continue;
    lines.push(renderCategory(cat));
    lines.push("");
  }

  // Insights: cost/usage narratives derived from AgentsView trend analysis.
  // Always rendered (with an empty-state placeholder) so the section doesn't
  // silently disappear when data is missing — keeps the report shape stable.
  lines.push(
    renderInsights(opts?.trends ?? null, opts?.agentsViewAvailable ?? false),
  );
  lines.push("");

  // Quick wins (behavioral: reduce friction to first action)
  const quickWins = collectQuickWins(score);
  if (quickWins.length > 0) {
    lines.push(renderQuickWins(quickWins));
    lines.push("");
  }

  // Unsupported agents CTA
  if (opts?.checks) {
    const cta = renderUnsupportedAgentsCta(agents, opts.checks);
    if (cta) {
      lines.push(cta);
      lines.push("");
    }
  }

  // AgentsView status
  lines.push(renderAgentsViewStatus(opts?.agentsViewAvailable ?? false));

  // Footer
  lines.push(
    chalk.dim(
      "  Run with --fix to apply fixes or get guided prompts for your agent.",
    ),
  );
  lines.push("");

  return lines.join("\n");
}

// ── Header card ────────────────────────────────────────────────────

function renderHeader(
  score: OverallScore,
  agents: Map<string, DiscoveredAgent>,
): string {
  const color = scoreColor(score.score);

  // Agent chips
  const chips: string[] = [];
  for (const [, agent] of agents) {
    if (agent.status === "not-found") continue;
    const dot =
      agent.status === "configured"
        ? chalk.green("●")
        : chalk.yellow("○");
    chips.push(`${dot} ${agent.name}`);
  }

  // Count failing / fixable checks (loss-framing)
  const failCount = score.categories.reduce(
    (n, cat) => n + cat.checks.filter((c) => !c.result.passed).length,
    0,
  );
  const fixableCount = score.categories.reduce(
    (n, cat) =>
      n +
      cat.checks.filter(
        (c) => !c.result.passed && (c.check.fix || c.check.fixPrompt),
      ).length,
    0,
  );
  const autoFixCount = score.categories.reduce(
    (n, cat) =>
      n +
      cat.checks.filter((c) => !c.result.passed && c.check.fix).length,
    0,
  );

  const bar = renderBar(score.score, 38);
  const scoreNum = color(chalk.bold(String(score.score)));
  const scoreStr = `${scoreNum} ${chalk.dim("/ 100")}  ${chalk.dim(`(${score.grade})`)}`;

  const headerLines = [
    boxTop(),
    boxEmpty(),
    boxLine(
      `${chalk.bold("Agent Hygiene Score")}          ${scoreStr}`,
    ),
    boxLine(bar),
    boxEmpty(),
    boxLine(chips.join("   ")),
  ];

  // Issue summary line — triggers loss aversion
  if (failCount > 0) {
    const issueWord = failCount === 1 ? "issue" : "issues";
    let summary = `${failCount} ${issueWord} found`;
    if (autoFixCount > 0) {
      summary += chalk.dim(" · ") + chalk.cyan(`${autoFixCount} auto-fixable`);
    }
    if (fixableCount > autoFixCount) {
      const promptCount = fixableCount - autoFixCount;
      summary +=
        chalk.dim(" · ") +
        chalk.magenta(`${promptCount} with fix prompts`);
    }
    headerLines.push(boxLine(chalk.dim(summary)));
  } else {
    headerLines.push(boxLine(chalk.green("No issues found — clean setup!")));
  }

  headerLines.push(boxEmpty());
  headerLines.push(boxBot());

  return headerLines.join("\n");
}

// ── Category sections ──────────────────────────────────────────────

function renderCategory(cat: CategoryScore): string {
  const lines: string[] = [];
  const color = scoreColor(cat.score);

  // Section header: ── Category Name  A+ (100/100) ─────────
  const label = chalk.bold(cat.category.name);
  const gradeStr = `${color(cat.grade)} ${chalk.dim(`(${cat.score}/100)`)}`;
  const headerContent = `${label}  ${gradeStr}`;
  const ruleLen = 58 - visLen(headerContent);
  lines.push(
    `  ${chalk.dim("──")} ${headerContent} ${chalk.dim("─".repeat(Math.max(1, ruleLen)))}`,
  );

  const passed = cat.checks.filter((c) => c.result.passed);
  const failed = cat.checks.filter((c) => !c.result.passed);

  // Progressive disclosure: if ALL passing, show single collapsed line
  if (failed.length === 0) {
    lines.push(
      `     ${chalk.green("✓")} ${chalk.green(`All ${passed.length} checks passing`)}`,
    );
    return lines.join("\n");
  }

  // Show failures expanded with details
  for (const { check, result } of failed) {
    let icon: string;
    let msg: string;

    if (check.tier === "advisory") {
      icon = chalk.blue("ℹ");
      msg = chalk.blue(result.message);
    } else if (check.tier === "session" || check.tier === "semi-auto") {
      icon = chalk.yellow("⚠");
      msg = chalk.yellow(result.message);
    } else {
      icon = chalk.red("✗");
      msg = result.message;
    }

    lines.push(`     ${icon} ${msg}`);

    if (result.details) {
      lines.push(chalk.dim(`       → ${result.details}`));
    }

    if (check.estimatedSavings && check.tier !== "advisory") {
      lines.push(
        chalk.dim(
          `       💡 ${check.estimatedSavings}`,
        ),
      );
    }
  }

  // Collapsed passing summary at the end
  if (passed.length > 0) {
    const noun = passed.length === 1 ? "check" : "checks";
    lines.push(
      `     ${chalk.green("✓")} ${chalk.dim(`${passed.length} ${noun} passing`)}`,
    );
  }

  return lines.join("\n");
}

// ── Quick Wins ─────────────────────────────────────────────────────

interface QuickWin {
  message: string;
  type: "auto-fix" | "prompt" | "info";
}

function collectQuickWins(score: OverallScore): QuickWin[] {
  const wins: QuickWin[] = [];

  for (const cat of score.categories) {
    for (const { check, result } of cat.checks) {
      if (result.passed) continue;
      if (check.tier === "advisory") continue;
      if (check.fix) {
        wins.push({ message: result.message, type: "auto-fix" });
      } else if (check.fixPrompt) {
        wins.push({ message: result.message, type: "prompt" });
      }
    }
  }

  // Auto-fixes first (lowest friction), then prompts, limit to 3
  const order = { "auto-fix": 0, prompt: 1, info: 2 };
  wins.sort((a, b) => order[a.type] - order[b.type]);
  return wins.slice(0, 3);
}

function renderQuickWins(wins: QuickWin[]): string {
  const lines: string[] = [];
  const ruleWidth = 44;

  lines.push(
    `  ${chalk.cyan("⚡")} ${chalk.bold.cyan("Quick Wins")} ${chalk.dim("─".repeat(ruleWidth))}`,
  );

  for (let i = 0; i < wins.length; i++) {
    const win = wins[i];
    const num = chalk.white(`${i + 1}.`);
    lines.push(`     ${num} ${win.message}`);
    if (win.type === "auto-fix") {
      lines.push(
        chalk.dim(
          `        → run ${chalk.cyan("--fix")} to apply automatically`,
        ),
      );
    } else if (win.type === "prompt") {
      lines.push(
        chalk.dim(
          `        → run ${chalk.cyan("--fix")} to get a guided prompt`,
        ),
      );
    }
  }

  return lines.join("\n");
}

// ── Insights (cost/usage narratives from AgentsView) ───────────────

/**
 * Render the cost/usage Insights section. Always returns a non-empty block:
 *   - AgentsView absent  → prompt to install
 *   - No findings        → "no anomalies" note with the observed window
 *   - With findings      → prioritized recommendation bullets
 *
 * The standalone `agent-hygiene track` command remains the way to see
 * full per-day breakdowns; this section surfaces actionable takeaways
 * inline so users don't have to know about a second command.
 */
function renderInsights(
  trends: TrendAnalysis | null,
  agentsViewAvailable: boolean,
): string {
  const lines: string[] = [];
  const ruleWidth = 44;

  lines.push(
    `  ${chalk.magenta("◆")} ${chalk.bold.magenta("Insights")} ${chalk.dim("─".repeat(ruleWidth))}`,
  );

  if (!agentsViewAvailable) {
    lines.push(
      `     ${chalk.dim("·")} ${chalk.dim("Install AgentsView to see cost insights from real usage data.")}`,
    );
    return lines.join("\n");
  }

  // AgentsView is connected but returned no daily records in the window.
  // Distinguish this from the "not installed" case so the user knows the
  // integration is working — they just haven't used agents recently.
  if (!trends) {
    lines.push(
      `     ${chalk.dim("·")} ${chalk.dim("AgentsView connected, but no usage recorded in the scan window.")}`,
    );
    return lines.join("\n");
  }

  if (trends.recommendations.length === 0) {
    lines.push(
      `     ${chalk.green("✓")} ${chalk.dim(`No cost anomalies detected over the last ${trends.period.days} day${trends.period.days === 1 ? "" : "s"}.`)}`,
    );
    return lines.join("\n");
  }

  // Separate the summary recommendation from actionable ones
  const actionRecs = trends.recommendations.filter((r) => !r.isSummary);
  const summaryRec = trends.recommendations.find((r) => r.isSummary);

  for (const rec of actionRecs) {
    const icon =
      rec.priority === "high"
        ? chalk.red("!")
        : rec.priority === "medium"
          ? chalk.yellow("→")
          : chalk.dim("·");
    lines.push(`     ${icon} ${rec.message}`);
  }

  if (summaryRec) {
    lines.push("");
    lines.push(
      `     ${chalk.green.bold("★")} ${chalk.green.bold(summaryRec.message)}`,
    );
  }

  return lines.join("\n");
}

// ── AgentsView status ──────────────────────────────────────────────

/**
 * Render an AgentsView status line for the report footer.
 */
export function renderAgentsViewStatus(available: boolean): string {
  if (available) {
    return chalk.dim(
      "  📊 AgentsView connected — session data checks active.",
    );
  }

  // Inner content width (between the `│` rails). Keep this in sync with
  // `border`. Using `padVis` to right-pad each line keeps the closing `│`
  // aligned even when the embedded strings (URL, check count) change.
  const innerWidth = 58;
  const border = "─".repeat(innerWidth);

  const yBar = chalk.yellow("│");
  const line = (content: string): string =>
    chalk.yellow("  ") + yBar + padVis(content, innerWidth) + yBar;

  return [
    "",
    chalk.yellow(`  ┌${border}┐`),
    line(
      "  " +
        chalk.bold.yellow("5 session checks skipped") +
        chalk.yellow(" — AgentsView not installed"),
    ),
    line(chalk.dim("  Unlock Tier 2: model spend, cache efficiency,")),
    line(
      chalk.dim("  context bloat, session length & subagent cost tracking."),
    ),
    line("  " + chalk.cyan("https://github.com/wesm/agentsview")),
    chalk.yellow(`  └${border}┘`),
  ].join("\n");
}

// ── Snapshot comparison ────────────────────────────────────────────

/**
 * Render a snapshot comparison to the terminal.
 */
export function renderSnapshotComparison(
  comp: SnapshotComparison,
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold("  Snapshot Comparison"));
  lines.push(
    chalk.dim(
      `  ${comp.before.name} (${comp.before.timestamp.split("T")[0]}) → ${comp.after.name} (${comp.after.timestamp.split("T")[0]})`,
    ),
  );
  lines.push("");

  // Score delta
  const deltaColor = comp.scoreDelta >= 0 ? chalk.green : chalk.red;
  const deltaSign = comp.scoreDelta >= 0 ? "+" : "";
  lines.push(
    `  Score: ${comp.before.score}/100 → ${comp.after.score}/100 ${deltaColor(`(${deltaSign}${comp.scoreDelta})`)}`,
  );
  lines.push("");

  // Category deltas
  for (const cat of comp.categoryDeltas) {
    const cDelta = cat.delta;
    const cColor = cDelta >= 0 ? chalk.green : chalk.red;
    const cSign = cDelta >= 0 ? "+" : "";
    lines.push(
      `  ${padRight(cat.name, 20)} ${cat.before} → ${cat.after} ${cColor(`(${cSign}${cDelta})`)}`,
    );
  }

  // Cost delta
  if (comp.costDelta) {
    const cd = comp.costDelta;
    lines.push("");
    lines.push(chalk.bold("  Cost Changes"));

    const tokDelta = cd.tokensDelta;
    const tokColor = tokDelta <= 0 ? chalk.green : chalk.red;
    const tokSign = tokDelta <= 0 ? "" : "+";
    lines.push(
      `  Avg daily tokens: ${tokColor(`${tokSign}${formatTokens(cd.avgDailyDelta)}`)}`,
    );
    lines.push(
      `  Cache hit ratio:  ${cd.cacheRatioDelta >= 0 ? chalk.green(`+${(cd.cacheRatioDelta * 100).toFixed(1)}%`) : chalk.red(`${(cd.cacheRatioDelta * 100).toFixed(1)}%`)}`,
    );
    lines.push(
      `  Opus usage:       ${cd.opusPctBefore.toFixed(0)}% → ${cd.opusPctAfter.toFixed(0)}%`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Render snapshot details.
 */
export function renderSnapshotSaved(
  name: string,
  filepath: string,
  score: number,
): string {
  return [
    "",
    chalk.green(`  ✓ Snapshot "${name}" saved`),
    chalk.dim(`    Score: ${score}/100`),
    chalk.dim(`    Path: ${filepath}`),
    "",
  ].join("\n");
}

// ── Trend analysis ─────────────────────────────────────────────────

/**
 * Render trend analysis to the terminal.
 */
export function renderTrends(trends: TrendAnalysis): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold("  Usage Trends"));
  lines.push(
    chalk.dim(
      `  Period: ${trends.period.start} → ${trends.period.end} (${trends.period.days} days)`,
    ),
  );
  lines.push("");

  // Overview
  lines.push(`  Total tokens:    ${formatTokens(trends.totalTokens)}`);
  lines.push(
    `  Avg daily:       ${formatTokens(trends.avgDailyTokens)} ${trendArrow(trends.dailyTrend)}`,
  );
  lines.push(
    `  Cache hit rate:  ${(trends.cacheEfficiency.ratio * 100).toFixed(0)}% ${trendArrow(trends.cacheEfficiency.trend === "improving" ? "decreasing" : trends.cacheEfficiency.trend === "declining" ? "increasing" : "stable")}`,
  );
  lines.push("");

  // Model breakdown
  lines.push(chalk.bold("  Model Breakdown"));
  for (const m of trends.modelBreakdown) {
    const bar = renderBar(m.pct, 15);
    lines.push(
      `  ${padRight(m.model, 10)} ${bar} ${m.pct.toFixed(0)}% ${chalk.dim(`(${formatTokens(m.tokens)} tokens, ~$${m.estimatedCost.toFixed(2)})`)}`,
    );
  }
  lines.push("");

  // Recommendations
  if (trends.recommendations.length > 0) {
    lines.push(chalk.bold("  Recommendations"));
    for (const rec of trends.recommendations) {
      const icon =
        rec.priority === "high"
          ? chalk.red("!")
          : rec.priority === "medium"
            ? chalk.yellow("→")
            : chalk.dim("·");
      lines.push(`  ${icon} ${rec.message}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function trendArrow(trend: string): string {
  if (trend === "increasing") return chalk.red("↑");
  if (trend === "decreasing") return chalk.green("↓");
  return chalk.dim("→");
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

// ── Agent discovery ────────────────────────────────────────────────

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

// ── Unsupported agents CTA ──────────────────────────────────────

const CONTRIB_URL =
  "https://github.com/pi0neerpat/agent-hygiene/blob/main/contrib/add-agent-checks/PROMPT.md";

/**
 * Derive which agent IDs have at least one check, then render a CTA
 * for any detected agents that aren't covered.
 */
export function renderUnsupportedAgentsCta(
  agents: Map<string, DiscoveredAgent>,
  checks: Check[],
): string | null {
  const supportedIds = new Set(checks.flatMap((c) => c.agents));

  const unsupported = [...agents.values()].filter(
    (a) => a.status !== "not-found" && !supportedIds.has(a.id),
  );

  if (unsupported.length === 0) return null;

  const names = unsupported.map((a) => chalk.white(a.name)).join(", ");
  const noun = unsupported.length === 1 ? "agent" : "agents";

  return [
    `  ${chalk.dim("──")} ${chalk.bold("Community")} ${chalk.dim("─".repeat(46))}`,
    `     ${names} detected but no checks available yet.`,
    `     ${chalk.dim("Contribute checks for your agent:")}`,
    `     ${chalk.cyan(CONTRIB_URL)}`,
  ].join("\n");
}
