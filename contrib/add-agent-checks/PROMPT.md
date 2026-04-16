# Add Agent Checks — Contribution Prompt

> Paste this entire file into your AI coding agent (Cursor, Copilot, Aider, etc.)
> to have it scaffold hygiene checks for your agent.

---

## Your Task

You are contributing hygiene checks to **agent-hygiene**, a CLI tool that scores AI coding agent setups for token efficiency and cost optimization. The tool already supports checks for Claude Code and OpenAI Codex. You need to add checks for **[YOUR AGENT NAME]**.

## Step 1: Understand the Architecture

The codebase is TypeScript. Checks live in `src/checks/` organized by tier:

```
src/checks/
  auto/          # Tier 1: Auto-detectable from config files
  session/       # Tier 2: Requires AgentsView telemetry
  advisory/      # Tier 3: Habit-based recommendations
  types.ts       # Check interface
  index.ts       # Check registry
```

Every check implements this interface (from `src/checks/types.ts`):

```typescript
export interface Check {
  id: string;            // Unique kebab-case ID, e.g. "cursor-rules-size"
  name: string;          // Human-readable name
  technique: number;     // Reference technique number (use 15 for context, 10 for structure)
  tier: "auto" | "session" | "advisory";
  category: "context" | "cost" | "habits" | "structure";
  agents: string[];      // Agent IDs this check applies to
  estimatedSavings: string;
  weight: number;        // 1-10, higher = more impactful
  run(ctx: ScanContext): Promise<CheckResult>;
  fix?(ctx: ScanContext): Promise<FixResult>;  // Optional auto-fix
}
```

The `ScanContext` gives you access to:

```typescript
export interface ScanContext {
  agents: Map<string, DiscoveredAgent>;   // Detected agents
  homeDir: string;                        // User's home directory
  projectDir: string;                     // Current project root
  env: Record<string, string | undefined>;
  shellProfileContents: string;
  readFile(path: string): Promise<string | null>;   // Returns null if missing
  exists(path: string): Promise<boolean>;
  listDir(path: string): Promise<string[]>;
  glob(pattern: string): Promise<string[]>;
  agentsViewData: AgentsViewData | null;
}
```

## Step 2: Find Your Agent in the Registry

Open `src/discovery/agents.ts`. Your agent should already be in the `AGENT_REGISTRY`. Find your agent's `id` — you'll use this in the `agents` array of your checks.

Current agent IDs: `claude-code`, `cursor`, `github-copilot`, `gemini-cli`, `codex`, `windsurf`, `aider`, `cline`, `roo-code`, `amp`, `continue`, `tabnine`, `sourcegraph-cody`, `void`, `goose`, `zed-assistant`.

## Step 3: Create Your Checks

Create new files in `src/checks/auto/` for Tier 1 checks. Start with these two patterns:

### Pattern A: Instruction File Size Check

Every agent has an instruction/rules file (CLAUDE.md, AGENTS.md, .cursorrules, etc.). Check that it's concise.

**Example** — `src/checks/auto/agentsmd-size.ts` (for Codex):

```typescript
import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

export const agentsMdSizeCheck: Check = {
  id: "agentsmd-size",
  name: "AGENTS.md size",
  technique: 15,
  tier: "auto",
  category: "context",
  agents: ["codex"],
  estimatedSavings: "Reduces per-message context overhead",
  weight: 7,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const content = await ctx.readFile(join(ctx.projectDir, "AGENTS.md"));

    if (!content) {
      return { passed: true, message: "No AGENTS.md found (not applicable)" };
    }

    const lines = content.split("\n").length;
    if (lines > 80) {
      return {
        passed: false,
        message: `AGENTS.md is ${lines} lines (target: <80)`,
        details: "Large instruction files consume tokens on every message. Keep them concise.",
      };
    }

    return { passed: true, message: `AGENTS.md size OK (${lines} lines)` };
  },
};
```

### Pattern B: Configuration Setup Check

Check that the agent is properly configured (config directory exists, key settings are present).

**Example** — `src/checks/auto/codex-setup.ts`:

```typescript
import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

export const codexSetupCheck: Check = {
  id: "codex-setup",
  name: "Codex configuration",
  technique: 10,
  tier: "auto",
  category: "structure",
  agents: ["codex"],
  estimatedSavings: "Proper setup enables sandbox and cost controls",
  weight: 5,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const issues: string[] = [];

    const globalExists = await ctx.exists(join(ctx.homeDir, ".codex"));
    if (!globalExists) issues.push("No ~/.codex/ config directory found");

    const agentsMd = await ctx.readFile(join(ctx.projectDir, "AGENTS.md"));
    if (!agentsMd) issues.push("No AGENTS.md found in project root");

    if (issues.length > 0) {
      return {
        passed: false,
        message: issues.join("; "),
        details: "Ensure your agent is fully configured for this project.",
      };
    }

    return { passed: true, message: "Codex configuration present" };
  },
};
```

### Adapt for Your Agent

Replace paths, file names, and thresholds to match your agent. For example:

| Agent | Instruction file | Config dir | Ignore file |
|-------|-----------------|------------|-------------|
| Cursor | `.cursorrules`, `.cursor/rules/` | `~/.cursor/` | — |
| GitHub Copilot | `.github/copilot-instructions.md` | `~/.config/github-copilot/` | — |
| Windsurf | `.windsurfrules` | `~/.codeium/` | — |
| Aider | `.aider.conf.yml` | `~/.aider.conf.yml` | `.aiderignore` |
| Cline | `.clinerules` | — | `.clineignore` |
| Gemini CLI | `GEMINI.md` | `~/.gemini/` | — |

## Step 4: Register Your Checks

Edit `src/checks/index.ts`:

1. Add imports at the top with the other auto check imports:
   ```typescript
   import { yourCheck } from "./auto/your-check.js";
   ```

2. Add your checks to the `ALL_CHECKS` array in the Tier 1 section.

## Step 5: Build and Test

```bash
yarn build
node dist/cli.js scan          # Full scan
node dist/cli.js discover      # Verify your agent is detected
```

Verify your checks appear in the output when your agent's config files are present.

## Step 6: Submit a PR

Create a PR with:
- Title: `feat: add [Agent Name] hygiene checks`
- Body: List of checks added, what each checks for, and thresholds used

Target the `main` branch.

---

## Tips

- **Start with 2-3 auto-tier checks.** Instruction file size + config setup + ignore file are the most universal patterns.
- **Use `weight: 5-7`** for new checks. The highest-weight checks (8-9) are reserved for high-impact items like ignore files.
- **The `fix()` method is optional** but appreciated. It lets users run `--fix` to auto-apply your recommendation.
- **Check the agent registry** in `src/discovery/agents.ts` to see which paths are probed for your agent. Your checks should be consistent with those paths.
- **Don't modify existing checks.** Only add new check files and register them.
