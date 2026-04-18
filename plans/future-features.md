# Future Features

Backlog of ideas not yet scoped for a concrete implementation plan.

## Task-switching detection (live `/clear` suggestion)

**Problem:** `clear-between-tasks` is currently a static advisory hint. We
can't measure whether the user actually clears between unrelated tasks, so
the check always fires. That makes it noise rather than signal.

**Idea:** Detect task-switching *within* a session and surface a live
suggestion to `/clear`.

**Possible signals:**
- File-diversity shift: a sudden jump in the set of files being edited
  (e.g. auth → billing → docs in one session)
- Subject shift in user prompts (simple keyword clustering across turns)
- Time gap between turns exceeding a threshold (session resumed hours later)
- Tool-call pattern change (e.g. pure reads → bulk edits → pure reads)

**Delivery options:**
- Post-session: analyze AgentsView session logs and retrospectively score
  task-switching behavior, feeding the existing `clear-between-tasks`
  advisory a real detection signal
- Live: ship as a Claude Code hook (PreToolUse or per-turn) that nudges the
  user when task-switching is detected

**Why not now:** Requires a working hook scaffold and some labeled data to
tune thresholds. Out of scope for the 2026-04-17 fix-mode revisions.

---

## `--sdk` mode for API direct-usage techniques

Scanner mode that inspects application source (not agent config) for SDK
patterns: prompt caching breakpoints, batch API usage, max_tokens sizing,
etc. Home for the techniques currently parked in
`docs/api-direct-usage-techniques/`.

## Verbosity detection beyond CLAUDE.md / AGENTS.md

Apply the `rules-verbosity` scoring to path-scoped rule files
(`.claude/rules/*.md`) and skill definitions. Same signals, same threshold.
