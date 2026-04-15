# Technique: CLAUDE_CODE_SUBAGENT_MODEL=haiku

## What It Does
Routes exploration subagents (file search, simple lookups, codebase navigation) through the cheaper Haiku model instead of the default.

## Estimated Savings
~60% on exploration/subagent tasks.

## Bad Example
All subagent calls use the same expensive model as the main session, even for trivial file lookups.

## Good Example
```bash
export CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001
```
Exploration and lookup tasks use Haiku; complex reasoning stays on the main model.

## How to Implement
1. Add `export CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001` to your shell profile.
2. Or configure in `.claude/settings.json`.

## Gotchas & Caveats
- Haiku is ideal for "subagent exploration, file search, simple lookups."
- Don't use Haiku for complex multi-file reasoning — it will produce lower quality results.
- The main session model is unaffected; this only changes the subagent model.
- Monitor whether subagent quality drops for your specific use case.
