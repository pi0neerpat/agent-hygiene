# Technique: SQL data pre-filtering

## What It Does
Filters and truncates data at the database query level before sending results to Claude, rather than sending large result sets and asking Claude to filter.

## Estimated Savings
Up to 90% on heavy data queries.

## Bad Example
```sql
SELECT * FROM logs;
-- Returns 10,000 rows, sends all to Claude
-- "Find the errors in this data"
```

## Good Example
```sql
SELECT timestamp, message, severity
FROM logs
WHERE severity = 'ERROR'
ORDER BY timestamp DESC
LIMIT 50;
-- Send only 50 relevant rows to Claude
```

## How to Implement
1. Identify API calls that send query results to Claude.
2. Move filtering logic (WHERE, HAVING) into the SQL query.
3. Add LIMIT clauses appropriate to the task.
4. Select only needed columns, not `SELECT *`.

## Gotchas & Caveats
- Push as much filtering as possible to the database — it's faster AND cheaper.
- Don't over-filter to the point where Claude lacks context to reason.
- Works for any data source, not just SQL (API responses, file contents, etc.).
- The principle is universal: minimize input tokens by being selective about what you send.
