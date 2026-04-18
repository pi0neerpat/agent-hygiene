import type { Check, ScanContext, CheckResult } from "../types.js";
import { isEnvVarSet } from "../../utils/env.js";
import { join } from "path";
import { safeReadFile } from "../../utils/fs.js";

export const mcpToolSearchCheck: Check = {
  id: "mcp-tool-search",
  name: "MCP tool search deferral",
  technique: 6,
  tier: "auto",
  category: "context",
  agents: ["claude-code"],
  estimatedSavings: "Reduces initial tool schema loading by deferring unused MCP tools",
  weight: 5,
  impact: "med",
  fixPrompt: `I ran agent-hygiene and it flagged that MCP tool search deferral isn't enabled. Deferring MCP tool schemas avoids loading all definitions upfront, which reduces initial context overhead.\n\nCould you enable this by adding \`"toolSearch": true\` to ~/.claude/settings.json? Please stick to the settings.json edit — don't write to ~/.zshrc or other shell profiles on my behalf. If settings.json won't work for some reason, tell me the exact line to add to my shell rc and I'll paste it in myself.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    // Check if user has custom MCP servers configured
    const settingsPath = join(ctx.homeDir, ".claude", "settings.json");
    const projectSettingsPath = join(
      ctx.projectDir,
      ".claude",
      "settings.json",
    );

    const [globalSettings, projectSettings] = await Promise.all([
      safeReadFile(settingsPath),
      safeReadFile(projectSettingsPath),
    ]);

    const hasMcpServers =
      (globalSettings && globalSettings.includes('"mcpServers"')) ||
      (projectSettings && projectSettings.includes('"mcpServers"'));

    if (!hasMcpServers) {
      return {
        passed: true,
        message: "No custom MCP servers configured (not applicable)",
      };
    }

    // Check for ENABLE_TOOL_SEARCH or tool search configuration
    if (
      isEnvVarSet(
        "CLAUDE_CODE_ENABLE_TOOL_SEARCH",
        ctx.env,
        ctx.shellProfileContents,
      )
    ) {
      return {
        passed: true,
        message: "Tool search deferral is enabled",
      };
    }

    // Also check settings.json for the tool search config
    const allSettings = (globalSettings || "") + (projectSettings || "");
    if (allSettings.includes("toolSearch") || allSettings.includes("deferredToolLoading")) {
      return {
        passed: true,
        message: "Tool search deferral configured in settings",
      };
    }

    return {
      passed: false,
      message: "MCP servers found but tool search deferral not enabled",
      details:
        "When using custom MCP servers, enable tool search to defer loading tool schemas until needed, reducing context overhead.",
    };
  },
};
