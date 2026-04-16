import { execSync } from "child_process";
import chalk from "chalk";
import select, { Separator } from "@inquirer/select";
import type { CheckRunResult } from "../checks/index.js";
import type { ScanContext, FixResult, Impact } from "../checks/types.js";

const IMPACT_ORDER: Record<Impact, number> = { high: 0, med: 1, low: 2 };

function impactLabel(impact: Impact): string {
  switch (impact) {
    case "high":
      return chalk.red.bold("HIGH");
    case "med":
      return chalk.yellow(" MED");
    case "low":
      return chalk.dim(" LOW");
  }
}

/** Attempt to copy text to clipboard. Returns true on success. */
function copyToClipboard(text: string): boolean {
  try {
    // macOS
    execSync("which pbcopy", { stdio: "ignore" });
    execSync("pbcopy", { input: text, stdio: ["pipe", "ignore", "ignore"] });
    return true;
  } catch {
    /* not macOS */
  }
  try {
    // Linux (X11)
    execSync("which xclip", { stdio: "ignore" });
    execSync("xclip -selection clipboard", {
      input: text,
      stdio: ["pipe", "ignore", "ignore"],
    });
    return true;
  } catch {
    /* no xclip */
  }
  try {
    // Linux (Wayland)
    execSync("which wl-copy", { stdio: "ignore" });
    execSync("wl-copy", { input: text, stdio: ["pipe", "ignore", "ignore"] });
    return true;
  } catch {
    /* no wl-copy */
  }
  return false;
}

/**
 * Display a fix prompt with clean formatting (no left/right borders)
 * and copy it to the clipboard.
 */
function showFixPrompt(checkName: string, prompt: string): void {
  const divider = chalk.dim("─".repeat(56));

  console.log("");
  console.log(`  ${divider}`);
  console.log(
    `  ${chalk.cyan.bold("Copy this prompt into your agent")}`,
  );
  console.log(`  ${divider}`);
  console.log("");

  // Print the prompt with NO left/right decoration for clean highlighting
  for (const line of prompt.split("\n")) {
    console.log(`${line}`);
  }

  console.log("");

  const copied = copyToClipboard(prompt);
  if (copied) {
    console.log(
      `  ${chalk.green("✓")} ${chalk.dim("Copied to clipboard")}`,
    );
  } else {
    console.log(
      `  ${chalk.dim("Select and copy the prompt above")}`,
    );
  }
  console.log(`  ${divider}`);
  console.log("");
}

/** Render the result of an autofix. */
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

/**
 * Run the unified fix mode: interactive menu with autofix + prompt items,
 * sorted by impact (weight descending), with loop-back after each action.
 */
export async function runFixMode(
  results: CheckRunResult[],
  ctx: ScanContext,
): Promise<void> {
  // Collect all actionable failing checks
  const actionable = results.filter(
    (r) => !r.result.passed && (r.check.fix || r.check.fixPrompt),
  );

  if (actionable.length === 0) {
    console.log(chalk.green("\n  No fixable issues found!\n"));
    return;
  }

  // Sort: auto-fix first, then prompts; within each group sort by impact tier then weight
  actionable.sort((a, b) => {
    const aIsAutoFix = a.check.fix ? 0 : 1;
    const bIsAutoFix = b.check.fix ? 0 : 1;
    if (aIsAutoFix !== bIsAutoFix) return aIsAutoFix - bIsAutoFix;
    const impactDiff =
      IMPACT_ORDER[a.check.impact] - IMPACT_ORDER[b.check.impact];
    if (impactDiff !== 0) return impactDiff;
    return b.check.weight - a.check.weight;
  });

  // Track which items have been resolved this session
  const resolved = new Set<string>();

  console.log(
    chalk.bold(
      `\n  Found ${actionable.length} issue${actionable.length > 1 ? "s" : ""} to address:\n`,
    ),
  );

  // Loop until user exits or all items resolved
  while (true) {
    const remaining = actionable.filter(
      (r) => !resolved.has(r.check.id),
    );

    if (remaining.length === 0) {
      console.log(
        chalk.green("\n  All issues addressed! Run a new scan to verify.\n"),
      );
      break;
    }

    // Build choices with group separators
    const autoFixes = remaining.filter((r) => r.check.fix);
    const prompts = remaining.filter((r) => !r.check.fix && r.check.fixPrompt);

    const choices: Array<
      | { name: string; value: string; description: string }
      | Separator
    > = [];

    if (autoFixes.length > 0) {
      choices.push(
        new Separator(chalk.green(`  AUTO-FIX ${"─".repeat(40)}`)),
      );
      for (const r of autoFixes) {
        choices.push({
          name: `${impactLabel(r.check.impact)} ${chalk.dim("──")} ${chalk.green.bold("[AUTO-FIX]")} ${r.check.name}`,
          value: r.check.id,
          description: r.result.message,
        });
      }
    }

    if (prompts.length > 0) {
      choices.push(
        new Separator(chalk.cyan(`  PROMPTS ${"─".repeat(41)}`)),
      );
      for (const r of prompts) {
        choices.push({
          name: `${impactLabel(r.check.impact)} ${chalk.dim("──")} ${chalk.cyan.bold("[PROMPT]")}   ${r.check.name}`,
          value: r.check.id,
          description: r.result.message,
        });
      }
    }

    choices.push(new Separator(chalk.dim("─".repeat(52))));
    choices.push({
      name: chalk.dim("Exit fix mode"),
      value: "__exit__",
      description: "",
    });

    let chosen: string;
    try {
      chosen = await select({
        message: `Select an issue to fix (${remaining.length} remaining)`,
        choices,
        pageSize: 15,
      });
    } catch {
      // User pressed Ctrl+C or Esc
      console.log(chalk.dim("\n  Exited fix mode.\n"));
      break;
    }

    if (chosen === "__exit__") {
      console.log(chalk.dim("\n  Exited fix mode.\n"));
      break;
    }

    const item = remaining.find((r) => r.check.id === chosen);
    if (!item) continue;

    if (item.check.fix) {
      // Auto-fix path
      console.log(chalk.bold(`\n  Applying fix: ${item.check.name}\n`));
      try {
        const fixResult = await item.check.fix(ctx);
        renderFixResult(fixResult);
        if (fixResult.applied) {
          resolved.add(item.check.id);
        }
      } catch (err) {
        console.log(
          chalk.red(
            `    Error: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
      console.log("");
    } else if (item.check.fixPrompt) {
      // Prompt path
      showFixPrompt(item.check.name, item.check.fixPrompt);
      resolved.add(item.check.id);
    }
  }
}
