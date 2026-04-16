import type { Check, ScanContext, CheckResult, FixResult } from "../types.js";
import { safeReadFile } from "../../utils/fs.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

const SCHEMA_URL = "https://json.schemastore.org/claude-code-settings.json";

/**
 * Check: settings.json should include $schema for editor autocomplete and validation.
 */
export const settingsSchemaCheck: Check = {
  id: "settings-schema",
  name: "Settings JSON schema",
  technique: 10, // structure-related
  tier: "auto",
  category: "structure",
  agents: ["claude-code"],
  estimatedSavings: "Enables autocomplete and validation in your editor",
  weight: 3,
  impact: "low",

  async run(ctx: ScanContext): Promise<CheckResult> {
    const paths = [
      join(ctx.homeDir, ".claude", "settings.json"),
      join(ctx.projectDir, ".claude", "settings.json"),
    ];

    const missing: string[] = [];

    for (const settingsPath of paths) {
      const raw = await safeReadFile(settingsPath);
      if (!raw) continue; // file doesn't exist — not an issue

      try {
        const settings = JSON.parse(raw);
        if (!settings.$schema) {
          missing.push(settingsPath);
        }
      } catch {
        // Invalid JSON — not our problem to flag here
      }
    }

    if (missing.length > 0) {
      return {
        passed: false,
        message: `settings.json missing $schema (${missing.length} file${missing.length > 1 ? "s" : ""})`,
        details: `Add "$schema": "${SCHEMA_URL}" to: ${missing.join(", ")}`,
      };
    }

    // Check if at least one settings.json exists with schema
    const anyExists = await Promise.all(
      paths.map((p) => safeReadFile(p)),
    );
    if (anyExists.every((c) => c === null)) {
      return {
        passed: true,
        message: "No settings.json files found (not applicable)",
      };
    }

    return {
      passed: true,
      message: "$schema present in settings.json",
    };
  },

  async fix(ctx: ScanContext): Promise<FixResult> {
    const paths = [
      join(ctx.homeDir, ".claude", "settings.json"),
      join(ctx.projectDir, ".claude", "settings.json"),
    ];

    const modified: string[] = [];

    for (const settingsPath of paths) {
      const raw = await safeReadFile(settingsPath);
      if (!raw) continue;

      let settings: Record<string, unknown>;
      try {
        settings = JSON.parse(raw);
      } catch {
        continue;
      }

      if (settings.$schema) continue;

      // Inject $schema at the top
      settings = { $schema: SCHEMA_URL, ...settings };
      await mkdir(dirname(settingsPath), { recursive: true });
      await writeFile(
        settingsPath,
        JSON.stringify(settings, null, 2) + "\n",
        "utf-8",
      );
      modified.push(settingsPath);
    }

    if (modified.length === 0) {
      return { applied: false, message: "No settings.json files needed updating" };
    }

    return {
      applied: true,
      message: `Added $schema to ${modified.length} settings.json file${modified.length > 1 ? "s" : ""}`,
      filesModified: modified,
    };
  },
};
