import { getHomeDir } from "../discovery/platform.js";
import { discoverAgents } from "../discovery/index.js";
import { readShellProfiles } from "./env.js";
import { safeReadFile, pathExists, safeListDir, globFiles, resolvePath } from "./fs.js";
import type { ScanContext } from "../checks/types.js";

/**
 * Build a ScanContext for running checks.
 */
export async function buildScanContext(
  projectDir: string,
): Promise<ScanContext> {
  const homeDir = getHomeDir();

  const [agents, shellProfileContents] = await Promise.all([
    discoverAgents(projectDir),
    readShellProfiles(homeDir),
  ]);

  return {
    agents,
    homeDir,
    projectDir,
    env: process.env as Record<string, string | undefined>,
    shellProfileContents,
    readFile: async (path: string) =>
      safeReadFile(resolvePath(projectDir, path)),
    exists: async (path: string) =>
      pathExists(resolvePath(projectDir, path)),
    listDir: async (path: string) =>
      safeListDir(resolvePath(projectDir, path)),
    glob: async (pattern: string) => globFiles(pattern, projectDir),
  };
}
