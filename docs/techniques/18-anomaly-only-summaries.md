# Technique: Anomaly-only summaries

## What It Does
Sends only exceptions and anomalies to Claude instead of full status dumps. Normal states are summarized in aggregate.

## Estimated Savings
50-80% on data context.

## Bad Example
```
Module A: running
Module B: running
Module C: running
...
Module Q: paused
Module R: running
Module S: error - timeout
```
(19 lines, mostly redundant)

## Good Example
```
19 modules: 17 running. Paused: Q. Error: S (timeout).
```
(1 line, all actionable information preserved)

## How to Implement
1. Pre-process monitoring/status data before sending to Claude.
2. Aggregate normal states into a count.
3. List only items that deviate from the expected state.
4. Include the deviation details (error type, duration, etc.).

## Gotchas & Caveats
- Primarily relevant for API/pipeline usage where you control the input.
- Requires a pre-processing step — add a summarization function before the API call.
- Be careful not to over-filter; include enough context for Claude to reason about the anomalies.
- Works for logs, monitoring data, test results, and any repetitive status reporting.
