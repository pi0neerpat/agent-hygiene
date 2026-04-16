import type { Check, ScanContext, CheckResult, FixResult } from "../types.js";
import { join } from "path";
import { writeFile, copyFile } from "fs/promises";

const DEFAULT_CLAUDEIGNORE = `# Dependencies
node_modules/
.yarn/
.pnp.*

# Build outputs
dist/
build/
out/
.next/
.nuxt/

# Large/binary files
*.png
*.jpg
*.jpeg
*.gif
*.svg
*.ico
*.woff
*.woff2
*.ttf
*.eot
*.mp4
*.mp3
*.zip
*.tar.gz
*.pdf

# Lock files
package-lock.json
yarn.lock
pnpm-lock.yaml

# Test fixtures & snapshots
**/__snapshots__/
*.snap
coverage/

# IDE & OS
.DS_Store
.vscode/
.idea/
*.swp
*.swo
`;

export const claudeignoreCheck: Check = {
  id: "claudeignore",
  name: "Missing .claudeignore",
  technique: 1,
  tier: "auto",
  category: "context",
  agents: ["claude-code"],
  estimatedSavings: "30-40% context reduction",
  weight: 9,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const content = await ctx.readFile(
      join(ctx.projectDir, ".claudeignore"),
    );

    if (!content) {
      return {
        passed: false,
        message: "No .claudeignore file found",
        details:
          "A .claudeignore prevents large/irrelevant files from consuming context window tokens.",
      };
    }

    // Check if it's substantive (more than just a few lines)
    const lines = content
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"));
    if (lines.length < 5) {
      return {
        passed: false,
        message: `.claudeignore exists but only has ${lines.length} rules`,
        details:
          "Consider adding rules for node_modules, build outputs, binary files, and lock files.",
      };
    }

    return {
      passed: true,
      message: `.claudeignore present with ${lines.length} rules`,
    };
  },

  async fix(ctx: ScanContext): Promise<FixResult> {
    const filePath = join(ctx.projectDir, ".claudeignore");
    const existing = await ctx.readFile(filePath);

    if (existing) {
      // Backup existing
      const backupPath = filePath + ".backup";
      await copyFile(filePath, backupPath);
      // Append missing patterns
      await writeFile(filePath, existing + "\n" + DEFAULT_CLAUDEIGNORE, "utf-8");
      return {
        applied: true,
        message: "Appended recommended patterns to existing .claudeignore",
        filesModified: [filePath],
        backedUpFiles: [backupPath],
      };
    }

    await writeFile(filePath, DEFAULT_CLAUDEIGNORE, "utf-8");
    return {
      applied: true,
      message: "Created .claudeignore with recommended patterns",
      filesModified: [filePath],
    };
  },
};
