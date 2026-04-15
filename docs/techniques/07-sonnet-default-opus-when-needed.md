# Technique: Sonnet default, Opus only when needed

## What It Does
Uses Sonnet as the default model for everyday tasks and reserves Opus for complex architecture, multi-file refactors, and hard debugging.

## Estimated Savings
~60% vs running all-Opus.

## Bad Example
Running Opus for every task including simple file edits, renaming, formatting, and boilerplate generation.

## Good Example
- Sonnet: routine coding, single-file changes, test writing, documentation
- Opus: complex architecture decisions, multi-file refactors, subtle debugging

Switch with `/model` command as needed.

## How to Implement
1. Set Sonnet as your default model.
2. Use `/model opus` only for complex tasks.
3. Switch back to Sonnet when the hard part is done.

## Gotchas & Caveats
- "Sonnet handles 80% of coding tasks effectively."
- This requires discipline — it's easy to default to the most capable model.
- Not an architectural choice; it's a usage habit.
- Track which tasks actually benefit from Opus to refine your switching criteria.
