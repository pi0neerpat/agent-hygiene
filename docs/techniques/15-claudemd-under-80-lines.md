# Technique: CLAUDE.md under 80 lines

## What It Does
Keeps the main CLAUDE.md file concise (under 80 lines) to avoid saturating startup context with low-value instructions.

## Estimated Savings
Avoids context saturation (every line has a token cost on every session).

## Bad Example
A 300-line CLAUDE.md with philosophy, explanations, redundant examples, and instructions Claude already follows by default.

## Good Example
- Project CLAUDE.md: under 80 lines of actionable rules
- Global `~/.claude/CLAUDE.md`: under 15 lines
- Each line passes the test: "Would Claude make mistakes without this line?"

## How to Implement
1. Audit your CLAUDE.md. For each line, ask: "If I remove this, will Claude make errors?"
2. Delete philosophy, explanations, and anything Claude does correctly by default.
3. Move domain knowledge to skills (technique #9).
4. Move path-specific conventions to rules (technique #10).
5. Keep only cross-cutting rules that prevent actual mistakes.

## Gotchas & Caveats
- "Every line has a cost" — it loads into every session.
- Philosophy and explanations are for humans, not Claude. Remove them.
- This is a discipline exercise; revisit monthly.
- Global config (`~/.claude/CLAUDE.md`) should be especially minimal — under 15 lines.
