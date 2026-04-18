# Fix Mode Revisions — 2026-04-17

Revisions to existing `--fix` checks plus one new check, based on real-world use
of the fix menu. Scoped to `src/checks/**` (and the docs reorg). No fixer
behavior changes in `src/fixers/`.

---

## Context

`--fix` currently shows ~20 items. Several of them are (a) not actually fixable
with a prompt, (b) have detection bugs, (c) duplicate each other, or (d) produce
prompts the user routinely ignores. This plan trims, fixes, merges, and
extends.

One new concept appears in several of these edits: the fix prompt should
instruct the agent to use **UserQuestionPrompt** (interview the user before
acting). This replaces "just do it" with a short conversation that catches
user-specific preferences.

---

## Changes by Check

### 1. `agentsmd-size` (AGENTS.md size)
**File:** `src/checks/auto/agentsmd-size.ts`
**Change:** Update `fixPrompt` so instead of just saying "move to separate files",
the agent is instructed to create `./docs/INDEX.md` as a router — a manifest of
the documentation files with a short "read this when…" for each one.

Prompt draft:
```
AGENTS.md is {lines} lines (target <80). Create ./docs/INDEX.md listing each
documentation file with a one-line "read this when…" hint so future agents
can pull files on demand. Then reduce AGENTS.md to a high-level pointer that
references INDEX.md for deeper context. Keep core conventions inline;
everything else moves to referenced files.
```

No detection change.

---

### 2. `rules-structure` (Path-scoped rules)
**File:** `src/checks/auto/rules-structure.ts`
**Change:** Make the prompt interview-first. This check is ordered BEFORE the
CLAUDE.md/AGENTS.md shrink prompts (already true: `rules-structure` is weight 6,
`agentsmd-size` is weight 7 but rules-structure should precede agentsmd/claudemd
reductions — these already run per their weights; the *user* should see them
in that order). Note in the plan: verify sort order in `src/fixers/index.ts`
once this lands, but no reordering change needed today.

Prompt draft:
```
Before acting, use UserQuestionPrompt to interview me:
1. Which directories/file-types have their own conventions?
2. Do any rules currently in CLAUDE.md/AGENTS.md only apply to a subset
   of files?
3. Should rules live under .claude/rules/ (Claude) or a different location?

Then create .claude/rules/ with glob-named rule files that load only when
matching files are edited. Move path-scoped sections out of CLAUDE.md.
```

---

### 3. `prompt-caching` (advisory)
**Action:** REMOVE from check registry. Not relevant to this tool.
**Files:**
- Delete `src/checks/advisory/prompt-caching.ts`
- Remove import + registration in `src/checks/index.ts`
- Move `docs/techniques/03-prompt-caching.md` → `docs/api-direct-usage-techniques/03-prompt-caching.md`
- Remove from README.md "Cost Optimization" table
- Create `docs/api-direct-usage-techniques/README.md` marking this as a
  potential future category (see "New docs category" below)

---

### 4. `batch-api` (advisory)
**Action:** REMOVE from check registry. Same pattern as prompt-caching.
**Files:**
- Delete `src/checks/advisory/batch-api.ts`
- Remove import + registration in `src/checks/index.ts`
- Move `docs/techniques/02-batch-api.md` → `docs/api-direct-usage-techniques/02-batch-api.md`
- Remove from README.md "Cost Optimization" table

---

### 5. `clear-between-tasks` (advisory)
**Action:** KEEP in scan output, HIDE from `--fix`.
**Rationale:** Not prompt-fixable — it's a habit about *when* to type `/clear`.
But we can't measure it yet, so leave it as a hint in the scan report.
**Files:**
- `src/checks/types.ts` — add `hideFromFix?: boolean` to `Check` interface
- `src/checks/advisory/clear-between-tasks.ts` — set `hideFromFix: true`,
  remove `fixPrompt` (since it won't be used), keep the unconditional hint
- `src/fixers/index.ts` — when filtering `actionable`, exclude checks with
  `hideFromFix === true`
- Keep registration, keep README row, keep technique doc
- Add a TODO line in `plans/future-features.md` (new file): *"Detect
  task-switching within a session (file diversity, subject shift) and surface
  a live suggestion to /clear."*

---

### 6. `effort-level` (advisory) — detection bug + prompt rewrite
**File:** `src/checks/advisory/effort-level.ts`

**Detection bug:** currently only looks at env var `CLAUDE_CODE_EFFORT`.
Claude Code reads the `effortLevel` field in `~/.claude/settings.json`. Update
`run()` to also read settings.json (home + project) and treat any value
(`low`|`medium`|`high`|`xhigh`) as "configured — pass".

**Prompt rewrite:**
```
Pat's note: Warning — this may make you incredibly frustrated. Leave
as "high" or "xhigh" and just make a mental note. Proceed only if you
really want the reduced reasoning cost.

Before acting, use UserQuestionPrompt to interview me:
1. Do I want effort "low", "medium", "high", or "xhigh" by default?
2. Am I configuring Claude Code, Codex, or both?

Then set "effortLevel": "<value>" in ~/.claude/settings.json (Claude).
For Codex, set the equivalent field in ~/.codex/config.toml
(reasoning_effort). Do NOT write to ~/.zshrc — settings.json is the
right home for this.
```

Also fix the env-var spelling in `docs/techniques/14-effort-level.md` if it
drifts from what Claude Code actually reads (doc says
`CLAUDE_CODE_EFFORT_LEVEL` — confirm and reconcile).

---

### 7. `subagents-research` (advisory) — detection + prompt rewrite
**File:** `src/checks/advisory/subagents-research.ts`

**Detection:** currently returns `passed: false` unconditionally. Replace with
real detection: pass if CLAUDE.md or AGENTS.md contains guidance about
delegating research/exploration to subagents (simple keyword match:
`subagent`, `Agent tool`, `delegate.*research`, `delegate.*exploration`).

**Prompt rewrite:**
```
Before acting, use UserQuestionPrompt to interview me:
1. Which file should this guidance live in — CLAUDE.md, AGENTS.md, or both
   (if both exist)?
2. Any project-specific guardrails on when NOT to use subagents?

Then add a short rule: "Delegate codebase exploration, pattern searches,
and research to subagents (Agent tool / Task tool). Keep the main session
focused on synthesis and implementation." Place it under an existing
workflow/conventions section if one exists.
```

---

### 8. `sonnet-default` (advisory) ⟷ `model-selection` (auto) — MERGE
**Current:** Two checks cover the same idea.
- `model-selection` (auto, weight 7, impact high) — fails if Opus is default
- `sonnet-default` (advisory, weight 4, impact low) — fails if nothing is set

**Action:** Merge into `model-selection` only.

**File:** `src/checks/auto/model-selection.ts`
- Extend `run()` so it also fails when no default is set anywhere. Keep a
  single check with two failure messages, both at `impact: "high"`:
  - "Opus is the default — switch to Sonnet"
  - "No default set — explicitly pick Sonnet"
- Add Codex detection: also read `~/.codex/config.toml` for the Codex model
  field (exact key name TBD — see "Codex prompt research" below).

**Prompt rewrite:**
```
{result.message}. Before acting, use UserQuestionPrompt to interview me:
1. Which agents am I setting this for — Claude Code, Codex, or both?
2. Sonnet default with manual Opus opt-in, or a different preference?

Then write:
- Claude Code: "model": "claude-sonnet-4-6" in ~/.claude/settings.json
- Codex: model = "gpt-5-codex" (or my preferred default) in
  ~/.codex/config.toml
Do NOT set shell env vars — settings files are the right home.
```

**Delete:** `src/checks/advisory/sonnet-default.ts`, remove its import +
registration in `src/checks/index.ts`.

---

### 9. `btw-usage` (advisory)
**Action:** KEEP in scan output, HIDE from `--fix`.
**Rationale:** Habit, not prompt-fixable, but still a useful hint until we can
measure it.
**Files:**
- `src/checks/advisory/btw-usage.ts` — set `hideFromFix: true`, remove
  `fixPrompt`, keep hint
- Keep registration, keep README row, keep technique doc
- (Uses the same `hideFromFix` flag added for `clear-between-tasks`)

---

### 10. `opusplan-mode` (advisory) — detection + prompt rewrite
**File:** `src/checks/advisory/opusplan-mode.ts`

**Detection:** currently unconditional fail. Pass if CLAUDE.md or AGENTS.md
references plan mode / `/plan` / "plan before implementing" / "use plan mode".

**Prompt rewrite:**
```
Before acting, use UserQuestionPrompt to interview me:
1. Which file should this guidance live in — CLAUDE.md, AGENTS.md, or both?
2. What do I consider "complex" — 3+ files? Architectural decisions?
   Cross-cutting refactors?

Then add a short rule. Example: "For complex multi-file features
(3+ files or shared-interface changes), use /plan (Claude) or the
equivalent planning flow (Codex) before writing code."
```

---

## New Check: `rules-verbosity`

**New file:** `src/checks/auto/rules-verbosity.ts`
**Purpose:** Detect verbose/over-structured writing in CLAUDE.md / AGENTS.md.
Short concise prose beats bullet-list scaffolding.

**Size gate:** Skip the check entirely if the file is <20 lines — too short
for structure to matter, and short files with filler would generate noise.

**Signals to flag (any two = fail):**
1. Average sentence length > 22 words
2. Bullet/list density > 40% of non-blank lines (lines starting `-`, `*`, or `#`)
3. `\n\n` blank-line density > 30% (over-spaced)
4. Long sentences containing filler phrases (`in order to`, `it is important
   to note`, `please be aware`, `make sure to`)

**Technique:** 15 (same as claudemd-size — they share a technique)
**Tier:** auto
**Category:** context
**Impact:** med, **weight:** 5
**Agents:** `claude-code`, `codex`

**Prompt (dynamic):**
```
{result.message}. Before acting, use UserQuestionPrompt to interview me:
1. Should I aim for plain prose or retain structure where it's load-bearing?
2. Any sections that MUST remain as bullets (e.g. command lists)?

Then tighten CLAUDE.md/AGENTS.md:
- Replace bulleted lists with a single sentence where the bullets are a
  flat enumeration of short items
- Delete redundant structure (headers over one-line sections, separators
  between tiny blocks)
- Shorten sentences: remove filler ("in order to" → "to"), prefer active
  voice, cut qualifiers
- Keep structure only where it aids scanning of genuinely parallel items
```

Register in `src/checks/index.ts` under Tier 1 auto, after `agentsmd-size`.

---

## New Docs Category

**New directory:** `docs/api-direct-usage-techniques/`
**New file:** `docs/api-direct-usage-techniques/README.md`

```
# API Direct-Usage Techniques

These techniques apply when you call the Anthropic (or equivalent) API
directly in application code — NOT when using an agent CLI like Claude
Code or Codex. agent-hygiene does not check for them today; they live
here as a potential future category.

Future work: add a separate scanner mode (`agent-hygiene scan --sdk`)
that looks at source files for SDK usage patterns and checks these
techniques.

## Contents
- 02-batch-api.md
- 03-prompt-caching.md
```

Moves:
- `docs/techniques/02-batch-api.md` → `docs/api-direct-usage-techniques/02-batch-api.md`
- `docs/techniques/03-prompt-caching.md` → `docs/api-direct-usage-techniques/03-prompt-caching.md`

---

## Registration Summary (`src/checks/index.ts`)

Remove imports + registry entries for:
- `promptCachingCheck`
- `batchApiCheck`
- `sonnetDefaultCheck`

Keep registered but mark `hideFromFix: true`:
- `clearBetweenTasksCheck`
- `btwUsageCheck`

Add:
- `rulesVerbosityCheck` (new, Tier 1 auto)

Keep but edit:
- `agentsMdSizeCheck`, `rulesStructureCheck`, `modelSelectionCheck`,
  `effortLevelCheck`, `subagentsResearchCheck`, `opusplanModeCheck`

---

## README.md Updates

- Drop rows for Batch API, Prompt caching, Sonnet as default (merged into
  model-selection)
- Keep rows for `/clear` between tasks, `/btw` for side questions (still in
  scan, just hidden from `--fix`)
- Add row for Rules verbosity (Context Efficiency)
- Update "25 checks" header: 25 − 3 removed + 1 added = 23

---

## File Impact

| File | Action |
|---|---|
| `src/checks/types.ts` | add `hideFromFix?: boolean` to `Check` |
| `src/checks/advisory/prompt-caching.ts` | delete |
| `src/checks/advisory/batch-api.ts` | delete |
| `src/checks/advisory/clear-between-tasks.ts` | edit — set `hideFromFix: true`, drop `fixPrompt` |
| `src/checks/advisory/btw-usage.ts` | edit — set `hideFromFix: true`, drop `fixPrompt` |
| `src/checks/advisory/sonnet-default.ts` | delete (merged into model-selection) |
| `src/checks/advisory/effort-level.ts` | edit — detection + prompt |
| `src/checks/advisory/subagents-research.ts` | edit — detection + prompt |
| `src/checks/advisory/opusplan-mode.ts` | edit — detection + prompt |
| `src/checks/auto/model-selection.ts` | edit — absorb sonnet-default, add Codex |
| `src/checks/auto/agentsmd-size.ts` | edit — INDEX.md pivot in prompt |
| `src/checks/auto/rules-structure.ts` | edit — UserQuestionPrompt in prompt |
| `src/checks/auto/rules-verbosity.ts` | NEW |
| `src/checks/index.ts` | update imports + ALL_CHECKS |
| `src/fixers/index.ts` | filter out `hideFromFix === true` when building `actionable` |
| `docs/techniques/02-batch-api.md` | move → api-direct-usage-techniques/ |
| `docs/techniques/03-prompt-caching.md` | move → api-direct-usage-techniques/ |
| `docs/api-direct-usage-techniques/README.md` | NEW |
| `README.md` | trim removed rows, add verbosity row, update count |
| `plans/future-features.md` | NEW — task-switching live suggestion note |

---

## Codex Prompt Research (prerequisite)

Before finalizing Codex-facing prompts in `effort-level`, `opusplan-mode`, and
`model-selection`, verify exact field names and paths against current Codex
docs:

1. `~/.codex/config.toml` — confirm whether the model field is `model`,
   `default_model`, or something else
2. Confirm the effort-level equivalent: is it `reasoning_effort`,
   `model_reasoning_effort`, or not yet configurable?
3. Confirm whether Codex has a `/plan` equivalent. If none exists, drop
   Codex from `opusplan-mode` and keep it Claude-only.
4. Confirm the env-var names Codex reads (if any)

Bake the verified names into the three fix prompts. If a field turns out not
to exist, update the prompt to say so rather than guess.

---

## Out of Scope

- No changes to `src/fixers/index.ts` menu rendering
- No changes to session-tier checks
- No scoring weight rebalance (category totals drift slightly; accept it)
- No `--sdk` mode implementation; only the placeholder docs directory
