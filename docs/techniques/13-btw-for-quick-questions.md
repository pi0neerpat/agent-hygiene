# Technique: /btw for quick questions

## What It Does
Asks a quick side question without growing the main conversation context. The question and answer exist in a separate context.

## Estimated Savings
Zero context growth for side questions.

## Bad Example
Asking "what's the syntax for a TypeScript mapped type?" in your main session. The question and answer consume context tokens that have nothing to do with your current task.

## Good Example
```
/btw what's the syntax for a TypeScript mapped type?
```
Answer appears without touching the main context.

## How to Implement
1. Prefix quick, unrelated questions with `/btw`.
2. Use for syntax lookups, quick references, and tangential questions.

## Gotchas & Caveats
- Only useful for questions unrelated to the current task.
- If the question IS relevant to your task, ask it normally so Claude has that context.
- Simple habit change with zero downside.
