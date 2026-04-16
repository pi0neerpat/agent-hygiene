# Technique: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=60

## What It Does
Lowers the context window percentage at which Claude Code triggers automatic compaction. Default behavior waits too long; by the time context is 80-90% full, generation quality has already degraded.

## Estimated Savings
Prevents quality degradation (indirect cost savings by avoiding wasted tokens on poor outputs that need retries).

## Bad Example
Using defaults. Context fills to 80%+, Claude's responses degrade silently, you re-prompt and burn tokens on corrections.

## Good Example
In `~/.claude/settings.json`:
```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "60"
  }
}
```
Claude compacts at 60% context usage, maintaining high-quality output throughout long sessions.

## How to Implement
1. Add to your `~/.claude/settings.json` under the `"env"` key (recommended — scoped to Claude Code only).
2. Or for project-level override, add to `.claude/settings.json` in the project root.

## Gotchas & Caveats
- Quality degradation starts at 20-40% context fullness, not 80-90% as most assume.
- This is about preventing silent degradation — you may not notice the quality drop without this.
- Too aggressive a threshold (e.g., 30%) may cause excessive compaction and loss of useful context.
- The author discovered this empirically: "watching generation quality silently degrade mid-pipeline."
