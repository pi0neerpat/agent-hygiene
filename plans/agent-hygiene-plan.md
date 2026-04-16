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
│   │   ├── semi-auto/            # Tier 2: detectable with heuristics
│   │   │   ├── model-selection.ts    # Check settings for default model
│   │   │   ├── max-tokens.ts         # Scan API call patterns in code
│   │   │   ├── compact-json.ts       # Scan for json.dumps(indent=)
│   │   │   ├── sql-prefiltering.ts   # Scan for SELECT * patterns
│   │   │   └── anomaly-summaries.ts  # Scan for data formatting patterns
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
│   │   ├── agentsview.ts         # Read AgentsView SQLite DB
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

### 1.4 — Tier 1 Checks (Auto-Detectable) — 8 checks
These can be fully determined by reading files and env vars:

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

### 1.5 — Tier 2 Checks (Semi-Auto) — 5 checks
Require heuristic scanning of project code:

| # | Check | What It Detects |
|---|-------|-----------------|
| 9 | `model-selection` | Default model set to Opus in settings |
| 10 | `max-tokens` | API calls without `max_tokens` or excessively high values |
| 11 | `compact-json` | `json.dumps(indent=` patterns in API-calling code |
| 12 | `sql-prefiltering` | `SELECT *` without LIMIT in code that feeds Claude |
| 13 | `anomaly-summaries` | Full data dumps being sent to Claude instead of summaries |

### 1.6 — Tier 3 Checks (Advisory) — 7 checks
Cannot be auto-detected; shown as recommendations:

| # | Check | Recommendation |
|---|-------|---------------|
| 14 | `clear-between-tasks` | Remind to use `/clear` between unrelated tasks |
| 15 | `btw-usage` | Remind to use `/btw` for side questions |
| 16 | `effort-level` | Suggest setting default effort level to medium |
| 17 | `subagents-research` | Recommend delegating research to subagents |
| 18 | `batch-api` | Flag if async workloads could use Batch API |
| 19 | `prompt-caching` | Verify SDK is being used for auto-caching |
| 20 | `opusplan-mode` | Recommend opusplan for complex features |

### 1.7 — Scoring Engine
- [ ] Define 4 categories with weights:
  - **Context Efficiency** (35%): claudeignore, CLAUDE.md size, rules, skills, MCP tool search, merge rules
  - **Cost Optimization** (30%): model selection, subagent model, batch API, max_tokens, compact JSON, prompt caching
  - **Structure** (20%): rules, skills, claudeignore completeness, SQL/data patterns
  - **Habits** (15%): /clear usage, /btw, effort level, opusplan, subagent delegation
- [ ] Calculate per-category scores (letter grade: A-F)
- [ ] Calculate overall score (0-100)
- [ ] Score formula: `Σ(check.weight × check.passed) / Σ(check.weight) × 100`
  - Auto checks: full weight when passing
  - Semi-auto checks: full weight when passing, partial when heuristic uncertain
  - Advisory checks: reduced weight (advisory acknowledgment = partial credit)

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

### 2.1 — AgentsView Data Reader
- [ ] Locate AgentsView SQLite database (auto-discover path)
- [ ] Read schema and understand tables:
  - Sessions, token usage, costs, model breakdown
- [ ] Build typed query layer over the SQLite DB

### 2.2 — Before/After Snapshots
- [ ] `agent-hygiene snapshot save [name]` — save current score + AgentsView cost baseline
- [ ] `agent-hygiene snapshot compare [before] [after]` — diff scores and costs
- [ ] Track: score delta, cost delta, tokens/day trend, sessions analyzed

### 2.3 — Trend Analysis
- [ ] `agent-hygiene track` — show cost trends over time
- [ ] Correlate config changes (from git history of .claude/) with cost changes
- [ ] Per-model token breakdown: Opus vs Sonnet vs Haiku usage ratio
- [ ] Cache hit rates (if available from AgentsView)
- [ ] Highlight: "Since enabling SUBAGENT_MODEL=haiku on [date], exploration costs dropped X%"

### 2.4 — Recommendations from Data
- [ ] Use actual usage data to prioritize recommendations:
  - "You spent $X on Opus for subagent tasks last week — setting SUBAGENT_MODEL=haiku would save ~$Y"
  - "Your average session context hits 85% — lowering autocompact threshold would help"
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
| SQLite reader | better-sqlite3 | Synchronous reads, fast, reliable. For AgentsView DB in Phase 2 |
| Build tool | tsup | Fast, zero-config, ESM+CJS output |
| Testing | vitest | Fast, TypeScript-native, great DX |
| Distribution | npm (npx agent-hygiene) | Standard, zero-install for users |

---

## Implementation Order

### Sprint 1 (Phase 1 MVP)
1. Project scaffolding + CLI skeleton
2. Agent auto-discovery (Claude Code first, then expand)
3. Check framework + 8 Tier 1 auto-checks
4. Scoring engine with 4 categories
5. Terminal output (styled report)
6. `--fix` mode for auto-detectable issues
7. npm publish as `agent-hygiene`

### Sprint 2 (Phase 1 Complete)
8. Tier 2 semi-auto checks (code scanning)
9. Tier 3 advisory checks
10. JSON and Markdown output formats
11. Full multi-agent discovery (all 16 agents)

### Sprint 3 (Phase 2)
12. AgentsView SQLite integration
13. Snapshot save/compare
14. Trend analysis + data-driven recommendations

### Sprint 4 (Phase 3)
15. Persistent score history
16. Local profile + badges
17. CI/CD integration + GitHub Action
18. Export format for future leaderboard

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Agent config paths vary across OS versions | Build platform abstraction early; test on macOS + Linux + WSL |
| AgentsView DB schema may change | Version-check the DB; degrade gracefully if schema mismatch |
| Some checks produce false positives | Tier system + confidence scores; never auto-fix uncertain findings |
| Scope creep across 16 agents | Claude Code is the priority; other agents are bonus. Ship Claude Code first |
| Env var detection varies by shell | Check .zshrc, .bashrc, .profile, .zshenv, and settings.json |
