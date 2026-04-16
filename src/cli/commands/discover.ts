import type { Command } from "commander";
import { resolve } from "path";
import { buildScanContext } from "../../utils/context.js";
import { renderAgentDiscovery } from "../../output/terminal.js";

interface DiscoverOptions {
  dir: string;
}

export function registerDiscoverCommand(program: Command): void {
  program
    .command("discover")
    .description("Show which AI coding agents are detected")
    .option("-d, --dir <path>", "Project directory to scan", ".")
    .action(async (opts: DiscoverOptions) => {
      const projectDir = resolve(opts.dir);
      const ctx = await buildScanContext(projectDir, { skipAgentsView: true });
      console.log(renderAgentDiscovery(ctx.agents));
    });
}
