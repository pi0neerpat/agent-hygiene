import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";
import { safeReadFile } from "../../utils/fs.js";

export const mergeTinyRulesCheck: Check = {
  id: "merge-tiny-rules",
  name: "Merge tiny rule files",
  technique: 20,
  tier: "auto",
  category: "structure",
  agents: ["claude-code"],
  estimatedSavings: "Reduces file overhead from many small rule files",
  weight: 4,
  impact: "low",
  fixPrompt: (_ctx, result) =>
    `I ran agent-hygiene and it flagged: ${result.message}. Each file incurs per-file loading overhead, so consolidating related rules reduces context waste.\n\n` +
    `Could you merge the small rule files in .claude/rules/ that cover related topics into fewer, larger files? ` +
    `Please group by domain — for example, merging all testing-related rules into one file and all API conventions into another.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const rulesDir = join(ctx.projectDir, ".claude", "rules");
    const rulesExist = await ctx.exists(rulesDir);

    if (!rulesExist) {
      return {
        passed: true,
        message: "No .claude/rules/ directory (not applicable)",
      };
    }

    const files = await ctx.listDir(rulesDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    if (mdFiles.length === 0) {
      return {
        passed: true,
        message: "No rule files to evaluate",
      };
    }

    const tinyFiles: { name: string; lines: number }[] = [];
    await Promise.all(
      mdFiles.map(async (f) => {
        const content = await safeReadFile(join(rulesDir, f));
        if (content) {
          const lines = content.split("\n").length;
          if (lines < 30) {
            tinyFiles.push({ name: f, lines });
          }
        }
      }),
    );

    if (tinyFiles.length >= 3) {
      const fileList = tinyFiles
        .map((f) => `${f.name} (${f.lines} lines)`)
        .join(", ");
      return {
        passed: false,
        message: `${tinyFiles.length} rule files under 30 lines (consider merging)`,
        details: `Tiny files: ${fileList}. Multiple small files add per-file overhead. Merge related rules into fewer, larger files.`,
      };
    }

    return {
      passed: true,
      message: `Rule files are appropriately sized (${mdFiles.length} files, ${tinyFiles.length} tiny)`,
    };
  },
};
