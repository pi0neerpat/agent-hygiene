import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolve } from "path";
import { buildScanContext } from "./utils/context.js";
import { runChecks, ALL_CHECKS } from "./checks/index.js";
import { calculateScore } from "./scoring/index.js";
import { renderReport, renderAgentDiscovery } from "./output/terminal.js";
import { renderJson } from "./output/json.js";
import { runFixMode } from "./fixers/index.js";

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
  .option("--agents-only", "Only show discovered agents")
  .action(async (opts) => {
    const projectDir = resolve(opts.dir);

    const useSpinner = !opts.json;
    const spinner = useSpinner
      ? ora({ text: "Discovering agents...", color: "cyan" }).start()
      : null;

    try {
      // Build scan context
      const ctx = await buildScanContext(projectDir);

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

      // Render terminal report
      console.log(renderReport(score, ctx.agents));

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
    const ctx = await buildScanContext(projectDir);
    console.log(renderAgentDiscovery(ctx.agents));
  });

program.parse();
