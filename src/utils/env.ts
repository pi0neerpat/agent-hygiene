import { join } from "path";
import { safeReadFile } from "./fs.js";

/**
 * Shell profile files to scan for environment variables.
 */
const SHELL_PROFILES = [
  ".zshrc",
  ".bashrc",
  ".bash_profile",
  ".profile",
  ".zshenv",
  ".zprofile",
];

/**
 * Read all shell profile files and combine their contents.
 */
export async function readShellProfiles(homeDir: string): Promise<string> {
  const contents = await Promise.all(
    SHELL_PROFILES.map(async (file) => {
      const content = await safeReadFile(join(homeDir, file));
      return content || "";
    }),
  );
  return contents.join("\n");
}

/**
 * Check if an env var is set in the current environment or shell profiles.
 */
export function isEnvVarSet(
  name: string,
  env: Record<string, string | undefined>,
  shellContents: string,
): boolean {
  if (env[name]) return true;
  // Check for export NAME= or NAME= patterns in shell profiles
  const pattern = new RegExp(`(?:export\\s+)?${escapeRegExp(name)}\\s*=`, "m");
  return pattern.test(shellContents);
}

/**
 * Get an env var value from current env or shell profiles.
 */
export function getEnvVarValue(
  name: string,
  env: Record<string, string | undefined>,
  shellContents: string,
): string | undefined {
  if (env[name]) return env[name];
  // Try to extract from shell profiles
  const pattern = new RegExp(
    `(?:export\\s+)?${escapeRegExp(name)}\\s*=\\s*["']?([^"'\\n]+)["']?`,
    "m",
  );
  const match = shellContents.match(pattern);
  return match?.[1]?.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
