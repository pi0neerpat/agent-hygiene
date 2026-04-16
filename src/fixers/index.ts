import { createInterface } from "readline";
import chalk from "chalk";
import type { CheckRunResult } from "../checks/index.js";
import type { ScanContext, FixResult } from "../checks/types.js";

/**
 * Run interactive fix mode for all failing checks that have fixers.
 */
export async function runFixMode(
  results: CheckRunResult[],
  ctx: ScanContext,
): Promise<void> {
  const fixable = results.filter(
    (r) => !r.result.passed && r.check.fix,
  );

  if (fixable.length === 0) {
    console.log(chalk.green("\n  No fixable issues found!\n"));
    return;
  }

  console.log(
    chalk.bold(
      `\n  Found ${fixable.length} fixable issue${fixable.length > 1 ? "s" : ""}:\n`,
    ),
  );

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve));

  for (const { check, result } of fixable) {
    console.log(chalk.red(`  ✗ ${check.name}`));
    console.log(chalk.dim(`    ${result.message}`));
    if (check.estimatedSavings) {
      console.log(
        chalk.dim(`    💡 ${check.estimatedSavings}`),
      );
    }

    const answer = await ask(
      chalk.yellow(`    → Apply fix? [y/N/details] `),
    );

    if (answer.toLowerCase() === "d" || answer.toLowerCase() === "details") {
      console.log(
        chalk.dim(`    ${result.details || "No additional details."}`),
      );
      const confirm = await ask(
        chalk.yellow(`    → Apply fix? [y/N] `),
      );
      if (confirm.toLowerCase() !== "y") {
        console.log(chalk.dim("    Skipped.\n"));
        continue;
      }
    } else if (answer.toLowerCase() !== "y") {
      console.log(chalk.dim("    Skipped.\n"));
      continue;
    }

    try {
      const fixResult = await check.fix!(ctx);
      renderFixResult(fixResult);
    } catch (err) {
      console.log(
        chalk.red(
          `    Error: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
    console.log("");
  }

  rl.close();
}

function renderFixResult(result: FixResult): void {
  if (result.applied) {
    console.log(chalk.green(`    ✓ ${result.message}`));
    if (result.filesModified) {
      for (const f of result.filesModified) {
        console.log(chalk.dim(`      Modified: ${f}`));
      }
    }
    if (result.backedUpFiles) {
      for (const f of result.backedUpFiles) {
        console.log(chalk.dim(`      Backup: ${f}`));
      }
    }
  } else {
    console.log(chalk.yellow(`    ⚠ ${result.message}`));
  }
}
