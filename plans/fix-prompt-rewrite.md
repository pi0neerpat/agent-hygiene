# Fix Prompt Rewrite: User Instructions → Agent Instructions

## Problem
The 21 `fixPrompt` strings across checks read like user-facing documentation or self-help advice ("Review my CLAUDE.md...", "Add a tip to CLAUDE.md about..."). These prompts are copied into an AI agent, so they should be direct agent instructions.

## Design Decisions
1. **Voice**: Direct imperative agent instructions — no "my", no self-talk
2. **Context**: Brief rationale (one sentence why), then action
3. **Dynamic**: Convert `fixPrompt` type to also accept `(ctx, result) => string` for checks with useful runtime data
4. **Scope**: All 21 checks with fixPrompts

## Changes

### 1. Type change (`src/checks/types.ts`)
```
fixPrompt?: string → fixPrompt?: string | ((ctx: ScanContext, result: CheckResult) => string)
```

### 2. Fixer resolution (`src/fixers/index.ts`)
- Resolve function-based fixPrompts before passing to `showFixPrompt`
- Pass `ctx` and `item.result` to the function

### 3. Dynamic prompts (10 checks) — use `(ctx, result) => string`
These checks compute meaningful data in `run()` that makes the prompt more actionable:
- `claudemd-size` — actual line count
- `agentsmd-size` — actual line count
- `merge-tiny-rules` — tiny file count
- `model-selection` — which setting has Opus
- `codex-setup` — which piece is missing
- `context-bloat` — peak session size / daily volume
- `cache-miss-rate` — cache hit percentage
- `opus-overuse` — Opus token percentage
- `session-length` — peak day info
- `subagent-cost` — model distribution

### 4. Static prompts (11 checks) — rewrite voice only
- `rules-structure`, `skills-usage`, `mcp-tool-search`
- All 8 advisory checks

## Prompt Pattern
```
[Dynamic: result.message sentence]. Brief rationale. Action instructions with specific settings/paths.
```
