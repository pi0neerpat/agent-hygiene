# Technique: .claudeignore for build artifacts

## What It Does
Excludes directories like `node_modules/`, `.next/`, `dist/`, `build/`, and `coverage/` from Claude's context window using a `.claudeignore` file at the project root.

## Estimated Savings
30-40% context reduction (`.next/` alone accounts for most of this in Next.js projects).

## Bad Example
No `.claudeignore` file exists. Claude indexes minified bundles, build output, and `node_modules/` — none of which it needs to reason about.

## Good Example
```
# .claudeignore
node_modules/
.next/
dist/
build/
coverage/
*.min.js
*.map
```

## How to Implement
1. Create a `.claudeignore` file in the project root.
2. Add all generated/vendored directories.
3. Pattern syntax matches `.gitignore`.

## Gotchas & Caveats
- This is the single highest-ROI change for zero effort.
- Review periodically — new build tools may introduce new output dirs.
- Does not affect git; purely a Claude Code directive.
