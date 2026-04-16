export interface AgentDefinition {
  id: string;
  name: string;
  /** Config paths to check. ~ = home, <project> = project root */
  configPaths: string[];
}

/**
 * Registry of known AI coding agents and their configuration paths.
 * Sprint 1 focuses on Claude Code with basic entries for other major agents.
 */
export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    configPaths: [
      "~/.claude/",
      "~/.claude/settings.json",
      "<project>/.claude/",
      "<project>/CLAUDE.md",
      "<project>/.claudeignore",
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    configPaths: [
      "~/.cursor/",
      "<project>/.cursorrules",
      "<project>/.cursor/rules/",
    ],
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    configPaths: [
      "~/.config/github-copilot/",
      "<project>/.github/copilot-instructions.md",
    ],
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    configPaths: [
      "~/.gemini/",
      "<project>/.gemini/",
      "<project>/GEMINI.md",
    ],
  },
  {
    id: "codex",
    name: "OpenAI Codex",
    configPaths: [
      "~/.codex/",
      "<project>/AGENTS.md",
    ],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    configPaths: [
      "~/.codeium/",
      "<project>/.windsurfrules",
    ],
  },
  {
    id: "aider",
    name: "Aider",
    configPaths: [
      "~/.aider.conf.yml",
      "<project>/.aider.conf.yml",
      "<project>/.aiderignore",
    ],
  },
  {
    id: "cline",
    name: "Cline",
    configPaths: [
      "<project>/.clinerules",
      "<project>/.clineignore",
    ],
  },
  {
    id: "roo-code",
    name: "Roo Code",
    configPaths: [
      "<project>/.roo/",
      "<project>/.roorules",
    ],
  },
  {
    id: "amp",
    name: "Amp",
    configPaths: [
      "<project>/AGENTS.md",
      "~/.ampcli/",
    ],
  },
];
