# Multi-Agent Support Plan

**Date:** 2026-04-16
**Goal:** Focus on Claude + Codex as first-class agents, add CTA for community contributions on other agents.

## Decision Summary

- **Agent scope:** Keep all 16 agents in discovery registry, but only Claude + Codex have scored checks
- **Codex depth:** Add Codex-specific checks (AGENTS.md hygiene + config setup) for parity
- **Contribution model:** `/contrib/add-agent-checks/` with AI-agent-executable prompts (not human CONTRIBUTING.md)
- **UX messaging:** Show CTA in scan output when unsupported agents are detected

## Implementation

### 1. Add Codex-specific checks

Create two new auto-tier checks mirroring existing Claude patterns:

**`src/checks/auto/agentsmd-size.ts`** (mirrors `claudemd-size.ts`)
- agents: `["codex"]`
- Check AGENTS.md exists at project root
- Fail if > 80 lines (same threshold as CLAUDE.md)
- category: "context", technique: 15, weight: 7

**`src/checks/auto/codex-setup.ts`** (mirrors `rules-structure.ts` / `settings-schema.ts`)
- agents: `["codex"]`
- Check ~/.codex/ exists (installed)
- Check for codex project config (instructions file, sandbox config)
- category: "structure", technique: 10, weight: 5

Register both in `src/checks/index.ts` under Tier 1.

### 2. Add CTA messaging for unsupported agents

**`src/output/terminal.ts`** — new `renderUnsupportedAgentsCTA()` function:
- Dynamically derive "supported" agent IDs from ALL_CHECKS (collect unique agents from check.agents arrays)
- Find agents that are detected (status !== "not-found") but not in the supported set
- Render a box: "N agents detected without checks — contribute at github.com/pi0neerpat/agent-hygiene/tree/main/contrib"
- List agent names

**`src/cli/commands/scan.ts`** — call CTA renderer after `renderReport`, passing agents + checks.

Also add to `src/output/markdown.ts` for markdown report output.

### 3. Create `/contrib/add-agent-checks/` prompt directory

**`contrib/add-agent-checks/PROMPT.md`** — AI-agent-executable prompt that:
1. Explains the Check interface and ScanContext
2. Shows annotated examples (claudemd-size, claudeignore)
3. Gives step-by-step instructions to create checks for a new agent
4. Includes the PR template format

This is designed so a Cursor/Copilot/Aider user can paste the prompt into their agent to scaffold checks for their tooling.

### 4. Wire everything together

- `src/checks/index.ts`: Import + register 2 new Codex checks
- `src/output/terminal.ts`: Add `renderUnsupportedAgentsCTA()`, call from `renderReport()`
- `src/output/markdown.ts`: Add unsupported agents section
- `src/cli/commands/scan.ts`: Pass ALL_CHECKS to render functions for dynamic CTA

## Files Modified

| File | Change |
|------|--------|
| `src/checks/auto/agentsmd-size.ts` | NEW — AGENTS.md size check |
| `src/checks/auto/codex-setup.ts` | NEW — Codex config check |
| `src/checks/index.ts` | Register 2 new checks |
| `src/output/terminal.ts` | Add unsupported agents CTA |
| `src/output/markdown.ts` | Add unsupported agents CTA |
| `src/cli/commands/scan.ts` | Pass checks to renderers |
| `contrib/add-agent-checks/PROMPT.md` | NEW — contribution prompt |
