import type { Check, ScanContext, CheckResult, FixResult } from "../types.js";
import { isEnvVarSet, getEnvVarValue } from "../../utils/env.js";
import { safeReadFile } from "../../utils/fs.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

// ── settings.json helpers ──────────────────────────────────────────

const SCHEMA_URL = "https://json.schemastore.org/claude-code-settings.json";

/**
 * Read and parse a settings.json, returning null if missing/invalid.
 */
async function readSettings(
  path: string,
): Promise<Record<string, unknown> | null> {
  const raw = await safeReadFile(path);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Get an env var value from settings.json "env" block.
 */
function getSettingsEnvVar(
  settings: Record<string, unknown> | null,
  varName: string,
): string | undefined {
  if (!settings) return undefined;
  const env = settings.env as Record<string, string> | undefined;
  return env?.[varName];
}

/**
 * Write an env var into settings.json, creating the file if needed.
 * Preserves existing content and ensures $schema is present.
 */
async function setSettingsEnvVar(
  path: string,
  varName: string,
  value: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  let settings: Record<string, unknown> = {};
  try {
    const raw = await readFile(path, "utf-8");
    settings = JSON.parse(raw);
  } catch {
    // File doesn't exist or invalid JSON — start fresh
  }

  // Ensure $schema is at the top
  if (!settings.$schema) {
    settings = { $schema: SCHEMA_URL, ...settings };
  }

  // Ensure env block exists
  if (!settings.env || typeof settings.env !== "object") {
    settings.env = {};
  }

  (settings.env as Record<string, string>)[varName] = value;

  await writeFile(path, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

// ── Helpers for checking across all sources ────────────────────────

interface EnvVarLocation {
  found: boolean;
  value?: string;
  source?: "process" | "settings-global" | "settings-project" | "shell-profile";
}

async function findEnvVar(
  varName: string,
  ctx: ScanContext,
): Promise<EnvVarLocation> {
  // 1. Process environment (highest precedence at runtime)
  if (ctx.env[varName]) {
    return { found: true, value: ctx.env[varName], source: "process" };
  }

  // 2. Project settings.json
  const projectSettings = await readSettings(
    join(ctx.projectDir, ".claude", "settings.json"),
  );
  const projectVal = getSettingsEnvVar(projectSettings, varName);
  if (projectVal) {
    return { found: true, value: projectVal, source: "settings-project" };
  }

  // 3. Global settings.json
  const globalSettings = await readSettings(
    join(ctx.homeDir, ".claude", "settings.json"),
  );
  const globalVal = getSettingsEnvVar(globalSettings, varName);
  if (globalVal) {
    return { found: true, value: globalVal, source: "settings-global" };
  }

  // 4. Shell profiles (legacy fallback)
  if (isEnvVarSet(varName, ctx.env, ctx.shellProfileContents)) {
    const shellVal = getEnvVarValue(varName, ctx.env, ctx.shellProfileContents);
    return { found: true, value: shellVal, source: "shell-profile" };
  }

  return { found: false };
}

// ── Checks ─────────────────────────────────────────────────────────

/**
 * Check: AUTOCOMPACT threshold should be set (default is 100%, meaning
 * context must be completely full before compacting).
 */
export const autocompactCheck: Check = {
  id: "autocompact-threshold",
  name: "Autocompact threshold",
  technique: 4,
  tier: "auto",
  category: "cost",
  agents: ["claude-code"],
  estimatedSavings: "Prevents context overflow and re-reads",
  weight: 7,
  impact: "high",

  async run(ctx: ScanContext): Promise<CheckResult> {
    const varName = "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE";
    const loc = await findEnvVar(varName, ctx);

    if (!loc.found) {
      return {
        passed: false,
        message: `${varName} not set (defaults to 100%)`,
        details:
          'Add to ~/.claude/settings.json: "env": { "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "60" }',
      };
    }

    const num = loc.value ? Number(loc.value) : 100;
    if (!Number.isInteger(num) || num < 1 || num > 100) {
      return {
        passed: false,
        message: `${varName} is ${loc.value} (invalid, expected 1-100)`,
        details:
          'Set to an integer percentage, for example: "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "60"',
      };
    }

    if (num > 80) {
      return {
        passed: false,
        message: `${varName} is ${num}% (too high, recommend 50-70%)`,
        details:
          "A threshold above 80% means context will be nearly full before compacting.",
      };
    }

    return {
      passed: true,
      message: `Autocompact threshold set to ${num}%`,
    };
  },

  async fix(ctx: ScanContext): Promise<FixResult> {
    const settingsPath = join(ctx.homeDir, ".claude", "settings.json");
    await setSettingsEnvVar(
      settingsPath,
      "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE",
      "60",
    );
    return {
      applied: true,
      message:
        'Set CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=60 in ~/.claude/settings.json',
      filesModified: [settingsPath],
    };
  },
};

/**
 * Check: SUBAGENT_MODEL should be set to a cheaper model for exploration tasks.
 */
export const subagentModelCheck: Check = {
  id: "subagent-model",
  name: "Subagent model override",
  technique: 5,
  tier: "auto",
  category: "cost",
  agents: ["claude-code"],
  estimatedSavings: "~60% cost reduction on exploration tasks",
  weight: 8,
  impact: "high",

  async run(ctx: ScanContext): Promise<CheckResult> {
    const varName = "CLAUDE_CODE_SUBAGENT_MODEL";
    const loc = await findEnvVar(varName, ctx);

    if (!loc.found) {
      return {
        passed: false,
        message: `${varName} not set`,
        details:
          'Add to ~/.claude/settings.json: "env": { "CLAUDE_CODE_SUBAGENT_MODEL": "claude-haiku-4-5-20251001" }',
      };
    }

    if (loc.value && /opus/i.test(loc.value)) {
      return {
        passed: false,
        message: `${varName} is set to ${loc.value} (Opus is expensive for exploration)`,
        details: "Use claude-sonnet-4-6 or claude-haiku-4-5-20251001 for subagents.",
      };
    }

    return {
      passed: true,
      message: `Subagent model set to ${loc.value}`,
    };
  },

  async fix(ctx: ScanContext): Promise<FixResult> {
    const settingsPath = join(ctx.homeDir, ".claude", "settings.json");
    await setSettingsEnvVar(
      settingsPath,
      "CLAUDE_CODE_SUBAGENT_MODEL",
      "claude-haiku-4-5-20251001",
    );
    return {
      applied: true,
      message:
        'Set CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001 in ~/.claude/settings.json',
      filesModified: [settingsPath],
    };
  },
};
