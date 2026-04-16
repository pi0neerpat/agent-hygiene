# Technique: CLAUDE_CODE_SUBAGENT_MODEL=haiku

## What It Does
Routes exploration subagents (file search, simple lookups, codebase navigation) through the cheaper Haiku model instead of the default.

## Estimated Savings
~60% on exploration/subagent tasks.

## Bad Example
All subagent calls use the same expensive model as the main session, even for trivial file lookups.

## Good Example
In `~/.claude/settings.json`:
```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-haiku-4-5-20251001"
  }
}
```
Exploration and lookup tasks use Haiku; complex reasoning stays on the main model.

## How to Implement
1. Add to your `~/.claude/settings.json` under the `"env"` key (recommended — scoped to Claude Code only).
2. Or for project-level override, add to `.claude/settings.json` in the project root.

## Gotchas & Caveats
- Haiku is ideal for "subagent exploration, file search, simple lookups."
- Don't use Haiku for complex multi-file reasoning — it will produce lower quality results.
- The main session model is unaffected; this only changes the subagent model.
- Monitor whether subagent quality drops for your specific use case.
