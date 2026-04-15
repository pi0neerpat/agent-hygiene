# Technique: Path-scoped rules

## What It Does
Places detailed coding conventions in `.claude/rules/` files that only load when Claude touches matching file paths, instead of loading all rules at startup.

## Estimated Savings
Loads only relevant rules per file touched (reduces startup context proportionally).

## Bad Example
All coding conventions for React, Python, database access, and infrastructure are in CLAUDE.md — loaded into every session regardless of what files are being edited.

## Good Example
```
.claude/rules/
  react-components.md    # loads only when touching src/components/**
  api-endpoints.md       # loads only when touching src/api/**
  database.md            # loads only when touching src/db/**
```

## How to Implement
1. Create `.claude/rules/` directory.
2. Add rule files with path-matching front matter.
3. Use dense bullets over prose for efficiency.
4. Merge files under 30 lines into related groups.
5. Include verification commands in rules where applicable.

## Gotchas & Caveats
- Only loads when Claude accesses matching paths — if Claude doesn't touch the file, rules don't load.
- Dense bullets > prose; every token in a rule file has a cost.
- Merge tiny rule files (see technique #20) to reduce file-load overhead.
- Great complement to skills — rules enforce patterns, skills provide knowledge.
