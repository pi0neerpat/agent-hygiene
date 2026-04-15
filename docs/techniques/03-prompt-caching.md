# Technique: Prompt caching for repeated system prompts

## What It Does
Caches repeated system prompts across API calls so subsequent reads cost 90% less. The official Anthropic SDK enables this automatically.

## Estimated Savings
90% off cached prompt reads.

## Bad Example
Manually constructing API calls without the SDK, paying full price for the same system prompt on every request.

## Good Example
Using the official Anthropic Python/TypeScript SDK, which automatically applies cache control headers to system prompts.

## How to Implement
1. Use the official Anthropic SDK (Python: `anthropic`, Node: `@anthropic-ai/sdk`).
2. No additional configuration needed — caching is automatic.
3. For custom setups, add `cache_control: { type: "ephemeral" }` to system message blocks.

## Gotchas & Caveats
- Works automatically with the SDK — zero effort required.
- Cache has a TTL (currently 5 minutes); idle periods reset it.
- Only benefits repeated identical prefixes; dynamic system prompts defeat caching.
- First call pays full price + a small write premium; savings come on subsequent calls.
