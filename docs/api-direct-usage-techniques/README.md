# API Direct-Usage Techniques

These techniques apply when you call the Anthropic (or equivalent) API directly
in application code — NOT when using an agent CLI like Claude Code or Codex.
agent-hygiene does not check for them today; they live here as a potential
future category.

Future work: add a separate scanner mode (e.g. `agent-hygiene scan --sdk`) that
inspects source files for SDK usage patterns and surfaces these techniques
against them.

## Contents

- [02-batch-api.md](./02-batch-api.md) — Batch API for async workloads (50% cheaper)
- [03-prompt-caching.md](./03-prompt-caching.md) — Prompt caching for repeated system prompts (90% cheaper on cached reads)
