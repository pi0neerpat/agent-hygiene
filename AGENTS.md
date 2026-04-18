# AGENTS.md

Conventions for AI coding agents working in this repository.

## Workflow

- Delegate codebase exploration, pattern searches, and research questions to subagents (Agent tool / Task tool). Keep the main session focused on synthesis and implementation.
  - Exception: skip delegation for small/simple edits where the overhead outweighs the context savings.
- For complex work, use `/plan` (Claude Code) or the equivalent planning flow in your agent before writing code. "Complex" means any of:
  - 3+ files touched
  - Changes to shared interfaces (types, base classes, public APIs)
  - Architectural decisions (new abstractions, module boundaries, multiple viable paths)
  - New features (not bug fixes)
