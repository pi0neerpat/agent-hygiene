# Technique: opusplan mode

## What It Does
Uses Opus for planning/architecture and Sonnet for code execution within the same session. Best of both worlds — Opus-quality thinking with Sonnet-priced output.

## Estimated Savings
Best cost/quality ratio for complex features (significant vs all-Opus).

## Bad Example
Running a complex feature end-to-end on Opus, paying Opus rates for both the planning and the mechanical code generation.

## Good Example
```
/model opusplan
```
Opus designs the architecture and plan; Sonnet executes the file edits and code generation.

## How to Implement
1. Use `/model opusplan` when starting complex multi-step features.
2. The mode automatically routes planning to Opus and execution to Sonnet.

## Gotchas & Caveats
- Described by the author as "my favorite combo."
- Best for complex features that need good architectural thinking but involve lots of mechanical code changes.
- For simple tasks, plain Sonnet is still cheaper and sufficient.
- The planning phase consumes Opus tokens, so trivial tasks don't benefit.
