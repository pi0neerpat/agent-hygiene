# Technique: Subagents for research tasks

## What It Does
Delegates research-heavy tasks (reading 20-50 files) to subagents so the main session context stays clean. The main session receives only a summary.

## Estimated Savings
Isolates file reads from main context (prevents degradation zone, avoids retries).

## Bad Example
Reading 30 files in the main session to understand a codebase area. Context fills up, quality degrades, you end up re-prompting.

## Good Example
Prompt Claude to "use a subagent to research the authentication module and summarize the key patterns." Main session gets a concise summary without ingesting all 30 files.

## How to Implement
1. In your CLAUDE.md or skill descriptions, include explicit delegation instructions:
   "Use a subagent PROACTIVELY when researching codebases, reading multiple files, or exploring unfamiliar areas."
2. Make descriptions explicit about when to delegate.
3. Let the subagent do the heavy reading; main session works from the summary.

## Gotchas & Caveats
- Subagent descriptions must be explicit — "Use PROACTIVELY when..." drives delegation behavior.
- The subagent's model can be set to Haiku for further savings (see technique #5).
- Not useful for tasks requiring cross-file reasoning in a single context.
- The key benefit is context isolation, not just cost — it keeps the main session performant.
