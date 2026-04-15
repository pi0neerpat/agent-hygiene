# Technique: max_tokens right-sizing

## What It Does
Sets appropriate `max_tokens` limits per task type in API calls to prevent Claude from generating unnecessarily long responses.

## Estimated Savings
Up to 50% output token savings.

## Bad Example
Using `max_tokens: 4096` for a binary yes/no classification task. Claude may pad responses with explanations you don't need.

## Good Example
```python
# Binary classification
max_tokens = 150

# Structured JSON output
max_tokens = 512

# Multi-step reasoning
max_tokens = 1024

# Free-form generation
max_tokens = 2048
```

## How to Implement
1. Categorize your API call types.
2. Set `max_tokens` to match the expected output size for each category.
3. Add a small buffer (20-30%) above typical response length.
4. Monitor for truncation and adjust upward if needed.

## Gotchas & Caveats
- Primarily relevant for API usage, not interactive Claude Code sessions.
- Too-low limits cause truncated responses — worse than the savings.
- Start generous, then tighten based on observed response lengths.
- Combine with structured output (JSON mode) for more predictable lengths.
