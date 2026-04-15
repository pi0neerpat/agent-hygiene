# Technique: Effort level tuning

## What It Does
Adjusts Claude's "thinking" effort per task. Lower effort = less extended thinking = fewer tokens spent on reasoning.

## Estimated Savings
Reduces thinking/reasoning token cost (significant for simple tasks).

## Bad Example
Using default (high) effort for renaming a variable or fixing a typo — Claude spends tokens reasoning deeply about a trivial change.

## Good Example
```bash
# Simple tasks
/effort low

# Default for most work
export CLAUDE_CODE_EFFORT_LEVEL=medium

# Complex architecture
/effort high
```

## How to Implement
1. Set default to medium: `export CLAUDE_CODE_EFFORT_LEVEL=medium` in shell profile.
2. Use `/effort low` for trivial changes (renames, formatting, simple fixes).
3. Use `/effort high` for sustained, complex work.

## Gotchas & Caveats
- Low effort can miss edge cases on non-trivial tasks.
- Medium is a good default for most development work.
- High effort is worth it for architecture, debugging, and multi-file refactors.
- Switching effort mid-session is fine and encouraged.
