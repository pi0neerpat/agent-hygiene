# Technique: Compact JSON in API calls

## What It Does
Removes whitespace formatting from JSON payloads sent to the API. Indented JSON is for human readability; Claude doesn't need it.

## Estimated Savings
30-40% per JSON payload.

## Bad Example
```python
# 1,220 tokens
json.dumps(data, indent=2)
```

## Good Example
```python
# ~581 tokens (52% fewer)
json.dumps(data, separators=(",", ":"))
```

## How to Implement
1. Find all `json.dumps()` calls that feed into API requests.
2. Replace `indent=2` with `separators=(",", ":")`.
3. Keep pretty-printing only for human-facing logs/output.

## Gotchas & Caveats
- Only matters for JSON sent TO the model, not JSON the model generates.
- Large nested objects see the biggest savings.
- Don't strip formatting from debug logs — humans still need to read those.
- The separators trick removes spaces after colons and commas, which is the minimum-size JSON.
