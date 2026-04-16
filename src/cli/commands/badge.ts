import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { writeFile } from "fs/promises";
import { resolve } from "path";
import { buildScanContext } from "../../utils/context.js";
import { runChecks } from "../../checks/index.js";
import { calculateScore } from "../../scoring/index.js";
import { badgeMarkdownSnippet, generateBadgeSvg } from "../../output/badge.js";

interface BadgeOptions {
  dir: string;
  output?: string;
}

export function registerBadgeCommand(program: Command): void {
  program
    .command("badge")
    .description("Generate an SVG badge for your hygiene score")
    .option("-d, --dir <path>", "Project directory to scan", ".")
    .option("-o, --output <path>", "Write SVG to file instead of stdout")
    .action(async (opts: BadgeOptions) => {
      const projectDir = resolve(opts.dir);
      // Only show spinner when writing to a file (SVG to stdout must be clean).
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
}
