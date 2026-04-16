# Plan: Extended --fix with Fix Prompts

## Summary

Extend the `--fix` feature so every failing check (not just the 4 autofix ones) provides a path to resolution. Non-autofix checks get a `fixPrompt` field — a tailored prompt the user copies into their AI agent. All failing checks appear in a single interactive menu ordered by impact.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Prompt source | New `fixPrompt` field on Check interface | Colocated with check logic, explicit per-check |
| Impact ordering | Existing `weight` field, descending | Already calibrated, no new data needed |
| Selection UX | `@inquirer/select` rich menu | Arrow-key nav, search, better than raw readline |
| Autofix scope | Unified menu (autofix + prompts together) | Single flow, badges differentiate types |
| Prompt format | Display + auto-copy to clipboard | No left/right decoration on prompt body for clean highlighting |
| Loop behavior | Return to menu after each action | Multi-issue sessions without re-running |

## Implementation Steps

### Step 1: Install dependency
- `npm install @inquirer/select`

### Step 2: Update Check type
- **File:** `src/checks/types.ts`
- Add `fixPrompt?: string` to `Check` interface
- Add JSDoc explaining when to use `fix()` vs `fixPrompt`

### Step 3: Add fixPrompt to all non-autofix checks
- For each failing check in `session/` and `advisory/` tiers (and any `auto/` without `fix()`), write a specific, actionable prompt
- Prompts should be 2-6 sentences, referencing the specific files/settings to change
- **Files:** All ~21 check files without `fix()` methods

### Step 4: Rewrite fix mode with unified menu
- **File:** `src/fixers/index.ts` (rewrite)
- Filter to failed checks that have either `fix()` or `fixPrompt`
- Sort by `weight` descending
- Build `@inquirer/select` choices with:
  - `[AUTO-FIX]` badge (chalk.green) for checks with `fix()`
  - `[PROMPT]` badge (chalk.cyan) for checks with `fixPrompt`
  - Description shows `estimatedSavings` and one-line detail
- Loop: after handling a selection, remove it from the list, re-show menu
- Exit on Esc/Ctrl+C or empty list

### Step 5: Implement prompt display + clipboard
- **File:** `src/fixers/index.ts` (new function `showFixPrompt`)
- Display format:
  ```
  ── Copy this prompt into your agent ─────────────

  <prompt text with NO left/right border chars>

  ── Copied to clipboard ✓ ────────────────────────
  ```
- Clipboard: spawn `pbcopy` (macOS) or `xclip -selection clipboard` (Linux)
- Graceful fallback: if clipboard fails, show "Select and copy the prompt above" instead of "Copied"

### Step 6: Keep autofix rendering
- When user selects an `[AUTO-FIX]` item, call existing `check.fix!(ctx)` and render with existing `renderFixResult()`
- On success, mark as resolved and remove from menu

### Step 7: Update terminal output hints
- **File:** `src/output/terminal.ts`
- Update "Quick Wins" section to mention both auto-fixes AND fix prompts
- Update footer text: `Run with --fix to apply fixes or get guided prompts`

## Check → fixPrompt Mapping (Draft)

Each prompt should be specific and actionable. Example:

**`opus-overuse` check:**
```
Review my recent Claude Code sessions and identify tasks where Opus was used 
but Sonnet would have been sufficient. Update my workflow to use /model sonnet 
for routine tasks like: file edits, simple refactors, test writing, and 
boilerplate generation. Reserve Opus for architecture decisions, complex 
debugging, and novel problem-solving. Check my CLAUDE.md for any model 
preferences that should be updated.
```

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `@inquirer/select` |
| `src/checks/types.ts` | Add `fixPrompt?: string` |
| `src/checks/auto/*.ts` (7 files without fix) | Add `fixPrompt` |
| `src/checks/session/*.ts` (5 files) | Add `fixPrompt` |
| `src/checks/advisory/*.ts` (8 files) | Add `fixPrompt` |
| `src/fixers/index.ts` | Rewrite with inquirer menu + clipboard |
| `src/output/terminal.ts` | Update hints |
