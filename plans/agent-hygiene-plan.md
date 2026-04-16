# Agent Hygiene CLI — Implementation Plan

## Vision
A standalone TypeScript CLI (`npx agent-hygiene`) that scans your AI coding agent setup, scores it against 20 proven token/cost-reduction techniques, and optionally applies fixes — like ESLint for your agent configuration.

## Architecture Overview

```
agent-hygiene/
├── src/
│   ├── cli.ts                    # Entry point (commander)
│   ├── commands/
│   │   ├── scan.ts               # Main scan command
│   │   ├── fix.ts                # Interactive fix mode
│   │   ├── score.ts              # Score display/export
│   │   └── track.ts              # Phase 2: AgentsView integration
│   ├── discovery/
│   │   ├── index.ts              # Auto-discovery orchestrator
│   │   ├── agents.ts             # Agent registry (16 agents, config paths)
│   │   └── platform.ts           # OS-specific path resolution
│   ├── checks/
│   │   ├── index.ts              # Check runner & registry
│   │   ├── types.ts              # Check interface, severity, tier
│   │   ├── auto/                 # Tier 1: fully auto-detectable
│   │   │   ├── claudeignore.ts
│   │   │   ├── env-vars.ts       # AUTOCOMPACT, SUBAGENT_MODEL, EFFORT, TOOL_SEARCH
│   │   │   ├── claudemd-size.ts
│   │   │   ├── rules-structure.ts
│   │   │   ├── skills-usage.ts
│   │   │   ├── mcp-tool-search.ts
│   │   │   └── merge-tiny-rules.ts
│   │   ├── session/              # Tier 2: from AgentsView session data (Sprint 3)
│   │   │   ├── opus-overuse.ts       # % of sessions using Opus when Sonnet would suffice
│   │   │   ├── context-bloat.ts      # Sessions hitting context limits / frequent compaction
│   │   │   ├── cache-miss-rate.ts    # Low prompt cache hit rates
│   │   │   ├── session-length.ts     # Avg tokens/session trending high
│   │   │   └── subagent-cost.ts      # Subagent spend ratio vs main session
│   │   └── advisory/            # Tier 3: habit-based (can't auto-detect)
│   │       ├── clear-between-tasks.ts
│   │       ├── btw-usage.ts
│   │       ├── effort-level.ts
│   │       ├── subagents-research.ts
│   │       ├── batch-api.ts
│   │       ├── prompt-caching.ts
│   │       ├── opusplan-mode.ts
│   │       └── sonnet-default.ts
│   ├── scoring/
│   │   ├── index.ts              # Score calculator
│   │   ├── weights.ts            # Per-check weights & categories
│   │   └── categories.ts         # Context, Cost, Habits, Structure
│   ├── fixers/
│   │   ├── index.ts              # Fix orchestrator
│   │   ├── claudeignore.ts       # Generate/update .claudeignore
│   │   ├── env-vars.ts           # Add env vars to shell profile
│   │   ├── claudemd.ts           # Suggest CLAUDE.md trimming
│   │   └── rules-merge.ts       # Merge tiny rule files
│   ├── tracking/                 # Phase 2
│   │   ├── agentsview.ts         # Shell out to agentsview CLI (see tkmx-client pattern)
│   │   ├── snapshots.ts          # Before/after score snapshots
│   │   └── trends.ts             # Cost trend analysis
│   ├── output/
│   │   ├── terminal.ts           # Chalk/ink styled terminal output
│   │   ├── json.ts               # Machine-readable JSON output
│   │   └── markdown.ts           # Markdown report generation
│   └── utils/
│       ├── fs.ts                 # File system helpers
│       ├── env.ts                # Environment variable detection
│       └── config.ts             # CLI config (~/.agent-hygiene/)
├── docs/
│   └── techniques/               # The 20 technique reference docs (already created)
├── plans/
│   └── agent-hygiene-plan.md     # This file
├── package.json
├── tsconfig.json
└── README.md
```

---

## Phase 1: Environment Scanner (MVP)

### 1.1 — Project Scaffolding
- [ ] Initialize TypeScript project with Yarn PnP
- [ ] Set up commander.js for CLI entry point
- [ ] Configure tsconfig, build pipeline (tsup or tsc)
- [ ] Add chalk for terminal output
- [ ] Set up bin entry in package.json for `agent-hygiene`

### 1.2 — Agent Auto-Discovery
- [ ] Build agent registry with known config paths per OS:
  - Claude Code: `~/.claude/`, `.claude/`, `CLAUDE.md`
  - Cursor: `~/.cursor/`, `.cursorrules`, `.cursor/`
  - GitHub Copilot: `~/.config/github-copilot/`
  - Gemini CLI: `~/.gemini/`
  - Codex: `~/.codex/`
  - (+ remaining 11 from AgentsView's supported list)
- [ ] Platform-specific path resolution (macOS/Linux/Windows)
- [ ] Output discovered agents with status (installed/configured/not found)

### 1.3 — Check Framework
- [ ] Define `Check` interface:
  ```typescript
  interface Check {
    id: string;                    // e.g., "claudeignore"
    name: string;                  // Human-readable name
    technique: number;             // Reference to technique doc (1-20)
    tier: "auto" | "semi-auto" | "advisory";
    category: "context" | "cost" | "habits" | "structure";
    agents: string[];              // Which agents this applies to
    estimatedSavings: string;      // e.g., "30-40% context reduction"
    weight: number;                // Score weight (1-10)
    run(ctx: ScanContext): Promise<CheckResult>;
    fix?(ctx: ScanContext): Promise<FixResult>;  // Optional fixer
  }
  ```
- [ ] Build check runner that discovers and executes all registered checks
- [ ] Implement `ScanContext` with discovered agents, file system access, env vars

### 1.4 — Tier 1 Checks (Auto-Detectable) — 9 checks
These can be fully determined by reading config files and env vars:

| # | Check | What It Detects |
|---|-------|-----------------|
| 1 | `claudeignore` | Missing or incomplete `.claudeignore` |
| 2 | `autocompact-threshold` | `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` not set or too high |
| 3 | `subagent-model` | `CLAUDE_CODE_SUBAGENT_MODEL` not set to a cheaper model |
| 4 | `claudemd-size` | CLAUDE.md over 80 lines (project) or 15 lines (global) |
| 5 | `rules-structure` | Missing `.claude/rules/` or no path-scoped rules |
| 6 | `skills-usage` | Domain knowledge in CLAUDE.md instead of skills |
| 7 | `mcp-tool-search` | `ENABLE_TOOL_SEARCH` not set when using custom base URL |
| 8 | `merge-tiny-rules` | Rule files under 30 lines that should be merged |
| 9 | `model-selection` | Default model set to Opus in settings.json or env vars |

### 1.5 — Tier 2 Checks (Session Data) — 5 checks
**Requires AgentsView SQLite DB.** Analyzes actual agent usage patterns from session data — not project source code. Deferred to Sprint 3 when AgentsView integration is built.

| # | Check | What It Detects (from session data) |
|---|-------|-------------------------------------|
| 10 | `opus-overuse` | % of sessions using Opus when Sonnet would have sufficed (based on task complexity heuristics) |
| 11 | `context-bloat` | Sessions frequently hitting context limits or triggering compaction |
| 12 | `cache-miss-rate` | Low prompt cache hit rates across sessions |
| 13 | `session-length` | Average tokens/session trending high — suggests not using /clear |
| 14 | `subagent-cost` | Subagent spend ratio vs main session (are subagents actually saving money?) |

> **Why session data, not source code?** The original plan had Tier 2 scanning project code for patterns like `SELECT *` or `json.dumps(indent=)`. That's code linting, not agent hygiene. The real signal is how the agent is *actually being used* — visible in session transcripts, token counts, and model selection data stored by AgentsView.

### 1.6 — Tier 3 Checks (Advisory) — 7 checks
Cannot be auto-detected from files; shown as best-practice recommendations:

| # | Check | Recommendation |
|---|-------|---------------|
| 15 | `clear-between-tasks` | Remind to use `/clear` between unrelated tasks |
| 16 | `btw-usage` | Remind to use `/btw` for side questions |
| 17 | `effort-level` | Suggest setting default effort level to medium |
| 18 | `subagents-research` | Recommend delegating research to subagents |
| 19 | `batch-api` | Flag if async workloads could use Batch API |
| 20 | `prompt-caching` | Verify SDK is being used for auto-caching |
| 21 | `opusplan-mode` | Recommend opusplan for complex features |

### 1.7 — Scoring Engine
- [ ] Define 4 categories with weights:
  - **Context Efficiency** (35%): claudeignore, CLAUDE.md size, rules, skills, MCP tool search, merge rules
  - **Cost Optimization** (30%): model selection, subagent model, autocompact, batch API, prompt caching
  - **Structure** (20%): rules, skills, claudeignore completeness
  - **Habits** (15%): /clear usage, /btw, effort level, opusplan, subagent delegation
- [ ] Calculate per-category scores (letter grade: A-F)
- [ ] Calculate overall score (0-100)
- [ ] Score formula: `Σ(check.weight × check.passed) / Σ(check.weight) × 100`
  - Auto checks (Tier 1): full weight when passing
  - Session checks (Tier 2): full weight when passing, partial when data insufficient (requires AgentsView)
  - Advisory checks (Tier 3): reduced weight (advisory acknowledgment = partial credit)
- [ ] When AgentsView not installed: Tier 2 checks excluded from scoring (score based on Tier 1 + 3 only)

### 1.8 — Interactive Fix Mode (`--fix`)
- [ ] For each failing auto-detectable check, prompt user:
  ```
  ✗ Missing .claudeignore (saves 30-40% context)
    → Generate recommended .claudeignore? [y/N/details]
  ```
- [ ] Implement fixers for:
  - `.claudeignore` generation (template-based)
  - Shell profile env var injection (with backup)
  - CLAUDE.md line count warnings (no auto-edit, just guidance)
  - Rule file merging (interactive, shows preview)
- [ ] Always show preview of changes before applying
- [ ] Create backup before any file modification

### 1.9 — CLI Output
- [ ] Default: styled terminal output with colors and sections
- [ ] `--json`: machine-readable JSON for CI/CD integration
- [ ] `--markdown`: markdown report for sharing/docs
- [ ] Example output:
  ```
  Agent Hygiene Score: 72/100

  Context Efficiency ████████░░ B+ (82/100)
    ✓ .claudeignore present (30-40% context saved)
    ✗ CLAUDE.md is 142 lines (target: <80)
    ✓ Path-scoped rules configured
    ✗ 3 rule files under 30 lines (consider merging)

  Cost Optimization   ██████░░░░ C+ (65/100)
    ✗ SUBAGENT_MODEL not set (saves ~60% on exploration)
    ✓ AUTOCOMPACT threshold set to 60
    ⚠ Default model appears to be Opus

  Structure           ████████░░ B  (78/100)
    ✓ Skills directory found (4 skills)
    ✗ Domain knowledge detected in CLAUDE.md (move to skills)

  Habits              ██████░░░░ C  (58/100)
    ℹ Consider using /clear between unrelated tasks
    ℹ Set default effort level to medium
    ℹ Use /btw for quick side questions

  Run with --fix to apply recommended changes.
  ```

---

## Phase 2: Impact Tracking (AgentsView Integration)

> **Reference implementation**: [tkmx-client/reporter/agentsview.js](https://github.com/srosro/tkmx-client/blob/main/reporter/agentsview.js)
> The tkmx reporter shells out to the `agentsview` CLI binary rather than reading SQLite directly. This is the right approach — it avoids coupling to internal DB schema and benefits from agentsview's built-in sync, parsing, and multi-agent support.

### 2.1 — AgentsView CLI Integration
- [ ] Resolve `agentsview` binary (same strategy as tkmx-client):
  1. `$AGENTSVIEW_BIN` env var (explicit override)
  2. Hard-coded candidates: `~/.local/bin/agentsview`, `/opt/homebrew/bin/agentsview`, `/usr/local/bin/agentsview`
  3. `which agentsview` fallback
- [ ] Query via CLI: `agentsview usage daily --json --breakdown --agent <agent> --since <date>`
- [ ] Parse output — daily breakdowns with per-model token data:
  ```typescript
  interface ModelBreakdown {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalTokens: number;  // computed: sum of all token types
    source: string;       // "claude" | "codex" | etc.
  }
  interface DailyUsage {
    date: string;
    modelBreakdowns: ModelBreakdown[];
  }
  ```
- [ ] Multi-agent collection: query "claude" first (triggers sync for all agents), then "codex" with `--no-sync` to avoid redundant sync pass
- [ ] Graceful degradation: if binary not found, skip Tier 2 checks and show "Install agentsview for deeper analysis"

### 2.2 — Tier 2 Session Data Checks (5 checks)
These analyze actual usage data from agentsview, not project source code:

| # | Check | What It Detects (from agentsview data) |
|---|-------|----------------------------------------|
| 10 | `opus-overuse` | High % of tokens on Opus models when Sonnet/Haiku would suffice |
| 11 | `context-bloat` | High totalTokens per session trending upward |
| 12 | `cache-miss-rate` | Low ratio of `cacheReadTokens` to `inputTokens` |
| 13 | `session-length` | Average daily token burn trending high (not using /clear) |
| 14 | `subagent-cost` | Breakdown of model usage suggesting expensive subagent calls |

### 2.3 — Before/After Snapshots
- [ ] `agent-hygiene snapshot save [name]` — save current score + agentsview cost baseline
- [ ] `agent-hygiene snapshot compare [before] [after]` — diff scores and costs
- [ ] Track: score delta, cost delta, tokens/day trend, sessions analyzed

### 2.4 — Trend Analysis
- [ ] `agent-hygiene track` — show cost trends over time
- [ ] Per-model token breakdown: Opus vs Sonnet vs Haiku usage ratio (from modelBreakdowns)
- [ ] Cache efficiency: `cacheReadTokens / (inputTokens + cacheReadTokens)` ratio over time
- [ ] Highlight: "Since enabling SUBAGENT_MODEL=haiku on [date], exploration costs dropped X%"

### 2.5 — Data-Driven Recommendations
- [ ] Use actual agentsview data to prioritize recommendations:
  - "You spent $X on Opus for subagent tasks last week — setting SUBAGENT_MODEL=haiku would save ~$Y"
  - "Your cache hit rate is 12% — ensure you're on the latest SDK for auto-caching"
  - "Daily token usage averaged 850K tokens — consider using /clear between tasks"
- [ ] Data-driven scoring adjustments (weight checks by actual spend)

---

## Phase 3: Hygiene Score & Local Profile

### 3.1 — Persistent Score History
- [ ] `~/.agent-hygiene/scores.json` — historical score records
- [ ] `agent-hygiene history` — show score over time
- [ ] Track which checks improved/regressed between scans

### 3.2 — Local Profile
- [ ] `agent-hygiene profile` — show your hygiene profile
- [ ] Include: overall score, category breakdown, trend, top recommendations
- [ ] Generate shareable badge (SVG) for READMEs:
  ```
  ![Agent Hygiene Score](https://img.shields.io/badge/agent--hygiene-72%2F100-yellow)
  ```

### 3.3 — Export for Future Leaderboard
- [ ] `agent-hygiene export` — generate anonymized JSON payload
- [ ] Include: score, category breakdown, agent types, technique adoption rates
- [ ] Exclude: file paths, code content, prompts, API keys
- [ ] Design the payload format now so it's leaderboard-ready when Phase 4 adds it

### 3.4 — CI/CD Integration
- [ ] `agent-hygiene ci` — exit code 0 if score >= threshold, 1 if below
- [ ] `--min-score 70` — configurable threshold
- [ ] GitHub Action wrapper for PR checks

---

## Phase 4 (Future): Public Leaderboard
- Deferred per user decision
- Design notes: similar to tkmx approach (HN/GitHub verification, opt-in)
- Server component needed: score aggregation, profiles, verification
- Consider building on AgentsView's `pg push` for team dashboards

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | Yarn PnP already set up; matches Claude Code ecosystem; npm distribution |
| CLI framework | commander.js | Mature, well-typed, sub-commands, minimal overhead |
| Terminal UI | chalk + ora | Colors, spinners, progress bars. Ink if interactive TUI needed later |
| AgentsView data | Shell out to `agentsview` CLI | Avoids coupling to internal DB schema; same pattern as tkmx-client. Binary auto-resolved at runtime |
| Build tool | tsup | Fast, zero-config, ESM+CJS output |
| Testing | vitest | Fast, TypeScript-native, great DX |
| Distribution | npm (npx agent-hygiene) | Standard, zero-install for users |

---

## Implementation Order

### Sprint 1 (Phase 1 MVP) ✅
1. Project scaffolding + CLI skeleton
2. Agent auto-discovery (Claude Code first, then expand)
3. Check framework + 8 Tier 1 auto-checks
4. Scoring engine with 4 categories
5. Terminal output (styled report)
6. `--fix` mode for auto-detectable issues

### Sprint 2 (Phase 1 Complete) ✅
7. Tier 3 advisory checks (7 habit-based recommendations)
8. Promote `model-selection` to Tier 1 (reads settings files, not code)
9. JSON and Markdown output formats
10. Full multi-agent discovery (all 16 agents)
11. Remove broken Tier 2 code-scanning checks

### Sprint 3 (Phase 2 — AgentsView + Tier 2 Session Checks) ⚠️ completed with gaps
12. AgentsView CLI integration (resolve binary, query `usage daily --json --breakdown`)
13. Tier 2 session-data checks (5 checks: opus-overuse, context-bloat, cache-miss-rate, session-length, subagent-cost)
14. Snapshot save/compare
15. Trend analysis + data-driven recommendations

> **Known gaps addressed in Sprint 3.5 below:**
> - Data-driven recommendations (2.5) were implemented only in `track`, never surfaced in `scan` output
> - `opus-overuse` uses a raw percentage threshold with no task-complexity heuristics
> - `context-bloat` proxies via token volume — no compaction/session-count signal
> - `subagent-cost` reads Tier 1 env vars, crossing the tier boundary
> - `sonnet-default` advisory check (plan #21) was never implemented
> - Habits section appears empty when AgentsView is absent (the only habits-category session check is `session-length`)

### Sprint 3.5 (Session-Data Integration Fixes) ✅

**Goal:** Close the gaps from Sprint 3 so the scan output reflects real session data when available, adds the missing advisory check, and improves the accuracy of Tier 2 signals.

**Root-cause note (discovered during smoke test):** Sprint 3's parser in
`src/tracking/agentsview.ts` only recognized `[]` or `{ data: [...] }`
response shapes and read the model as `raw.model`. The actual
`agentsview usage daily --json --breakdown` output wraps records in
`{ daily: [...], totals: {...} }` and names the model field `modelName`.
The parser silently returned `[]`, which tripped the Tier 2 skip gate
and hid every session check — the symptom the user originally reported
as "Habits section empty". Fixed as part of 3.5.2 by accepting the
`daily` wrapper and falling back through `modelName`/`model_name`/`model`.

#### 3.5.1 — Merge Track Recommendations into Scan
- [ ] Add new `Insights` section rendered after `Habits` in `src/output/terminal.ts`
- [ ] Wire `analyzeTrends()` from `src/tracking/trends.ts` into the scan flow (`src/cli.ts` scan command)
- [ ] Render dollar-amount narratives (e.g., "You spent $X on Opus for subagent tasks last week")
- [ ] Empty state: when no findings or AgentsView absent, show placeholder text ("No cost anomalies detected" or "Install AgentsView to see cost insights") — do not hide the section
- [ ] Keep the standalone `agent-hygiene track` command for detailed trend view (per-day breakdowns, full history) — not removed
- [ ] Mirror the `Insights` section in `src/output/markdown.ts` for the `--markdown` output

#### 3.5.2 — Extend AgentsView Data Parsing (non-upstream)
- [ ] Update `src/tracking/agentsview.ts` to parse additional signals from existing `agentsview` binary output (do not modify agentsview itself)
- [ ] Add to `DailyUsage` / `AgentsViewData`:
  - `sessionCount` per day (distinct sessions if available in output)
  - `maxSessionTokens` per day (peak single-session token size)
  - `messageCount` per session (if available)
- [ ] If a signal isn't available in current agentsview output: log a debug note and leave the field undefined — checks must handle undefined gracefully
- [ ] **Defer** auto-compact event detection (no reliable source in existing output); revisit when agentsview adds it or via separate `~/.claude/projects/*.jsonl` parsing in a future sprint

#### 3.5.3 — Improve `opus-overuse` Heuristics
- [ ] Keep the raw Opus token percentage as a baseline signal
- [ ] Add output-to-input token ratio analysis: low output/input ratios on Opus spend indicate lookup/read tasks that Sonnet would handle
- [ ] Add session token-burst pattern: many short bursts on Opus suggests quick Q&A (Sonnet territory); few long sustained sessions may justify Opus
- [ ] Combine signals into a confidence-weighted result: higher confidence when multiple signals agree
- [ ] Update check description to reflect the richer heuristic

#### 3.5.4 — Fix `context-bloat` (rename + proxy)
- [ ] Keep the check semantically about "context pressure" but use the new signals from 3.5.2
- [ ] Primary signal: `maxSessionTokens` approaching context-window limit (e.g., >150K in a single session)
- [ ] Secondary signal: token-volume trend (current behavior, retained)
- [ ] Update the check's `description` and failure message to reflect what's actually measured (no compaction claim)

#### 3.5.5 — Fix `subagent-cost` Tier Boundary
- [ ] Remove reads of `ctx.env.CLAUDE_CODE_SUBAGENT_MODEL` and `ctx.shellProfileContents` from `src/checks/session/subagent-cost.ts`
- [ ] Detection must be pure Tier 2 (AgentsView data only): high Opus-token share with subagent-like patterns
- [ ] The Tier 1 `subagent-model` auto-check already covers the env-var side; no need to duplicate

#### 3.5.6 — Add Missing `sonnet-default` Advisory Check
- [ ] Create `src/checks/advisory/sonnet-default.ts` (plan check #21)
- [ ] Read `settings.json` `defaultModel` (or equivalent) field; fail if it points to an Opus variant
- [ ] Category: `cost`, tier: `advisory`
- [ ] Register in `src/checks/index.ts` `ALL_CHECKS`

#### 3.5.7 — Clarify Habits Empty-State Behavior
- [ ] Confirm `renderAgentsViewStatus()` banner in `src/output/terminal.ts` is shown prominently when AgentsView is absent (no changes needed to the banner itself — reuse existing)
- [ ] Document that the Habits section intentionally shows only advisory tips + `session-length` when data is present; other session checks appear under their own categories (`cost`, `context`) per the original design
- [ ] No scoring changes — current category distribution is correct

#### 3.5.8 — Update This Plan Document
- [ ] Mark Sprint 3 status accurately (✅ → ⚠️ completed with gaps) — **done in this edit**
- [ ] Add this Sprint 3.5 section — **done in this edit**
- [ ] When Sprint 3.5 is complete, mark it ✅

### Sprint 4 (Phase 3 — History, Profile, CI, Export) ✅

**Goal:** Make scan results persistent, shareable, and CI-friendly. Every scan
auto-logs to a rolling history file; users can view trends, generate badges,
gate PRs on a minimum score, and export anonymized data for a future leaderboard.

#### 4.0 — Config Directory Management
- [ ] Create `src/utils/config.ts` with shared helpers:
  - `getAgentHygieneDir()` → `~/.agent-hygiene/`
  - `getSnapshotsDir()` → `~/.agent-hygiene/snapshots/`
  - `getScoresPath()` → `~/.agent-hygiene/scores.json`
  - `ensureDir(path)` — `mkdir -p` equivalent
- [ ] Refactor `src/tracking/snapshots.ts` to use `getAgentHygieneDir()` instead of inline path construction

#### 4.1 — Persistent Score History
- [ ] Define `ScoreRecord` type (timestamp, score, grade, per-category scores, per-check pass/fail IDs, projectDir, toolVersion)
- [ ] On every `scan` run, auto-append a `ScoreRecord` to `~/.agent-hygiene/scores.json` (JSONL — one JSON object per line for append-friendliness)
- [ ] Cap file at 1000 entries; when exceeded, trim oldest entries on next write
- [ ] Do NOT auto-log when `--json` or `--markdown` flags are used (those are pipe-friendly; side-effects are unwanted)

#### 4.2 — `history` Command
- [ ] `agent-hygiene history` — show score over time in terminal
- [ ] Render a sparkline/mini-chart of recent scores (last 20 scans)
- [ ] Show per-scan: date, score, grade, delta from previous, project dir
- [ ] `--json` flag for machine-readable output
- [ ] `--limit <n>` flag (default 20)

#### 4.3 — `profile` Command
- [ ] `agent-hygiene profile` — show your hygiene profile
- [ ] Pulls from score history: overall trend, best/worst category, streak info
- [ ] Shows: current score, all-time high, category breakdown, top 3 improvements since first scan
- [ ] Shows which checks have never passed (persistent blind spots)

#### 4.4 — Badge Generation
- [ ] `agent-hygiene badge` — generate an SVG badge to stdout
- [ ] Hand-templated SVG string (no external dependency) — shields.io style
- [ ] Color mapped from grade: A+=brightgreen, A/B+=green, B/C+=yellow, C/D=orange, D/F=red
- [ ] `--output <path>` flag to write to file instead of stdout
- [ ] Also output a markdown snippet: `![Agent Hygiene](badge.svg)` for easy copy-paste

#### 4.5 — CI/CD Integration
- [ ] Add `--min-score <n>` flag to `scan` command
- [ ] When set: `process.exit(1)` if score < threshold, `process.exit(0)` if passing
- [ ] Print a clear PASS/FAIL line when `--min-score` is active
- [ ] `--ci` convenience flag: equivalent to `--min-score 70 --json` (sensible defaults for CI)
- [ ] Create `action.yml` in repo root for GitHub Action:
  ```yaml
  name: Agent Hygiene Check
  inputs:
    min-score: { default: "70" }
    directory: { default: "." }
  runs:
    using: node20
    main: dist/cli.js
  ```

#### 4.6 — Anonymized Export
- [ ] `agent-hygiene export` — generate anonymized JSON payload to stdout
- [ ] Include: tool version, timestamp, score, grade, category scores, per-check pass/fail (IDs only), agent types (names only, no paths)
- [ ] Exclude: file paths, code content, env var values, API keys, project directory
- [ ] `--format jsonl` option for bulk pipeline use
- [ ] Design the payload so it's leaderboard-ready when Phase 4 adds a server

#### 4.7 — Update Plan Document
- [ ] Mark Sprint 4 ✅ when complete

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Agent config paths vary across OS versions | Build platform abstraction early; test on macOS + Linux + WSL |
| AgentsView CLI output may change | Use the CLI JSON interface (not raw SQLite) per tkmx-client pattern; version-check and degrade gracefully |
| Some checks produce false positives | Tier system + confidence scores; never auto-fix uncertain findings |
| Scope creep across 16 agents | Claude Code is the priority; other agents are bonus. Ship Claude Code first |
| Env var detection varies by shell | Check .zshrc, .bashrc, .profile, .zshenv, and settings.json |
