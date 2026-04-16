import { Command } from "commander";
import { registerBadgeCommand } from "./cli/commands/badge.js";
import { registerDiscoverCommand } from "./cli/commands/discover.js";
import { registerExportCommand } from "./cli/commands/export.js";
import { registerHistoryCommand } from "./cli/commands/history.js";
import { registerProfileCommand } from "./cli/commands/profile.js";
import { registerScanCommand } from "./cli/commands/scan.js";
import { registerSnapshotCommand } from "./cli/commands/snapshot.js";
import { registerTrackCommand } from "./cli/commands/track.js";

const program = new Command();

program
  .name("agent-hygiene")
  .description(
    "Scan your AI coding agent setup, score it against 20 proven techniques, and optionally apply fixes.",
  )
  .version("0.1.0");

registerScanCommand(program);
registerDiscoverCommand(program);
registerSnapshotCommand(program);
registerTrackCommand(program);
registerExportCommand(program);
registerBadgeCommand(program);
registerProfileCommand(program);
registerHistoryCommand(program);

program.parse();
