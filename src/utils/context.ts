import { getHomeDir } from "../discovery/platform.js";
import { discoverAgents } from "../discovery/index.js";
import { readShellProfiles } from "./env.js";
import { safeReadFile, pathExists, safeListDir, globFiles, resolvePath } from "./fs.js";
import { collectAgentsViewData, type AgentsViewData } from "../tracking/agentsview.js";
import type { ScanContext } from "../checks/types.js";

export interface BuildScanContextOptions {
  /** Skip AgentsView data collection (faster scan) */
  skipAgentsView?: boolean;
  /** Override the --since date for AgentsView queries */
  agentsViewSince?: string;
}

/**
 * Build a ScanContext for running checks.
 */
export async function buildScanContext(
  projectDir: string,
  opts?: BuildScanContextOptions,
): Promise<ScanContext> {
  const homeDir = getHomeDir();

  const promises: [
    ReturnType<typeof discoverAgents>,
    ReturnType<typeof readShellProfiles>,
    Promise<AgentsViewData | null>,
  ] = [
    discoverAgents(projectDir),
    readShellProfiles(homeDir),
    opts?.skipAgentsView
      ? Promise.resolve(null)
      : collectAgentsViewData(opts?.agentsViewSince).catch(() => null),
  ];

  const [agents, shellProfileContents, agentsViewData] =
    await Promise.all(promises);

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
    agentsViewData,
  };
}
