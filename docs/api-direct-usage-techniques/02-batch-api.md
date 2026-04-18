# Technique: Batch API for async workloads

## What It Does
Routes non-interactive API calls through Anthropic's `/v1/messages/batches` endpoint, which charges half price on all tokens (input and output, all models).

## Estimated Savings
50% off all tokens for qualifying workloads.

## Bad Example
Running hundreds of independent code review or classification calls synchronously through the standard Messages API at full price.

## Good Example
Collecting async tasks (PR reviews, doc generation, test analysis) into batches and submitting via the Batch API. Results are polled or webhooks are used.

## How to Implement
1. Identify workloads that don't need real-time responses.
2. Use the `/v1/messages/batches` endpoint instead of `/v1/messages`.
3. Poll for results or configure webhooks.

## Gotchas & Caveats
- Only applies to async workloads — interactive Claude Code sessions can't use this.
- Results may take longer to return (up to 24 hours SLA).
- "If you have any async workloads, you're paying double if you're not using it."
- Most relevant for CI/CD pipelines, bulk analysis, and background agents.
