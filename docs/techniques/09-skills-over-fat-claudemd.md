# Technique: Skills instead of fat CLAUDE.md

## What It Does
Moves domain knowledge from a monolithic CLAUDE.md into discrete skill files that only load when invoked, dramatically reducing startup context.

## Estimated Savings
~80% context reduction vs putting everything in CLAUDE.md.

## Bad Example
A 500-line CLAUDE.md that includes deployment procedures, coding standards, API reference, and testing guidelines — all loaded into every single session.

## Good Example
- CLAUDE.md: ~80 lines of core advisory rules
- Skills: domain-specific knowledge in separate SKILL.md files
  - Each skill loads ~50 tokens at startup (name + description only)
  - Full content (~500-2000 tokens) loads only when invoked

## How to Implement
1. Identify sections of CLAUDE.md that are domain-specific (deployment, testing, specific APIs).
2. Create skill files in `.claude/skills/` with clear trigger descriptions.
3. Keep CLAUDE.md for cross-cutting advisory rules only.
4. Pattern: "domain knowledge in skills, advisory stuff in CLAUDE.md, enforcement in hooks."

## Gotchas & Caveats
- Medium effort to set up initially, but pays off quickly.
- Skill descriptions must be explicit about when to trigger (e.g., "Use PROACTIVELY when...").
- Poorly described skills won't be invoked when needed.
- Review skill usage periodically to ensure they're being triggered appropriately.
