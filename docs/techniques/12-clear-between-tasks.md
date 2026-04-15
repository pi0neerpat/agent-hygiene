# Technique: /clear between unrelated tasks

## What It Does
Resets the conversation context between unrelated tasks, giving each new task a fresh context window with full capacity.

## Estimated Savings
Free reset — avoids accumulated context pollution from prior tasks.

## Bad Example
Working through 5 unrelated tasks in one session. By task 4, the context is full of corrections, dead ends, and irrelevant file contents from earlier tasks.

## Good Example
```
Task 1: Fix auth bug → complete
/clear
Task 2: Add new API endpoint → fresh context, full quality
```

## How to Implement
1. After completing a task, type `/clear` before starting the next unrelated task.
2. Rule of thumb: "If you've corrected Claude on the same issue twice, `/clear` and start fresh."
3. A fresh session with a better prompt outperforms a long, correction-polluted session.

## Gotchas & Caveats
- "Counterintuitive: it feels like losing progress. You're not."
- You lose conversation history but gain full context capacity and quality.
- For related tasks that build on each other, don't clear — continuity matters.
- Combine with good initial prompts to make fresh sessions effective immediately.
