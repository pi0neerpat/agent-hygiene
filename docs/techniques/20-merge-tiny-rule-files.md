# Technique: Merge tiny rule files

## What It Does
Consolidates small rule files (under ~30 lines each) into larger related groups to reduce file-load overhead.

## Estimated Savings
Reduces file load overhead (file count, not line count, determines load cost).

## Bad Example
```
.claude/rules/
  naming.md          (12 lines)
  imports.md         (8 lines)
  error-handling.md  (15 lines)
  logging.md         (10 lines)
```
4 file loads, each with overhead, for 45 total lines of content.

## Good Example
```
.claude/rules/
  code-standards.md  (45 lines - all four topics merged)
```
1 file load for the same 45 lines of content.

## How to Implement
1. List all files in `.claude/rules/` and check line counts.
2. Group files under 30 lines by related topic.
3. Merge into combined files with clear section headers.
4. Keep files that are large enough (30+ lines) or have distinct path scoping.

## Gotchas & Caveats
- File count matters more than line count for load cost.
- Don't merge files with different path scopes — that defeats path-scoped loading.
- A 26-line file takes a full file load slot with overhead.
- Balance between organization and efficiency; don't create one mega-file.
