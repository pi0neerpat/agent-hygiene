import { access } from "fs/promises";
import { AGENT_REGISTRY, type AgentDefinition } from "./agents.js";
import { getHomeDir, resolveConfigPath } from "./platform.js";
import type { DiscoveredAgent } from "../checks/types.js";

/**
 * Discover which AI coding agents are installed/configured on this system.
 */
export async function discoverAgents(
  projectDir: string,
): Promise<Map<string, DiscoveredAgent>> {
  const homeDir = getHomeDir();
  const results = new Map<string, DiscoveredAgent>();

  await Promise.all(
    AGENT_REGISTRY.map(async (def) => {
      const agent = await probeAgent(def, homeDir, projectDir);
      results.set(agent.id, agent);
    }),
  );

  return results;
}

async function probeAgent(
  def: AgentDefinition,
  homeDir: string,
  projectDir: string,
): Promise<DiscoveredAgent> {
  const resolvedPaths = def.configPaths.map((p) =>
    resolveConfigPath(p, homeDir, projectDir),
  );

  const foundPaths: string[] = [];
  await Promise.all(
    resolvedPaths.map(async (p) => {
      try {
        await access(p);
        foundPaths.push(p);
      } catch {
        // not found
      }
    }),
  );

  let status: DiscoveredAgent["status"];
  if (foundPaths.length === 0) {
    status = "not-found";
  } else if (foundPaths.length >= 2) {
    status = "configured";
  } else {
    status = "installed";
  }

  return {
    id: def.id,
    name: def.name,
    status,
    configPaths: resolvedPaths,
    foundPaths,
  };
}
