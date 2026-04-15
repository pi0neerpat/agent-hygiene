# Technique: MCP Tool Search (deferred tool definitions)

## What It Does
Defers MCP tool schema definitions until they are actually needed, instead of loading all tool schemas into context at startup.

## Estimated Savings
85% MCP context reduction (e.g., ~72K tokens down to ~8.7K for a 20-tool server).

## Bad Example
A 20-tool MCP server loads all tool definitions (~72K tokens) into every session, regardless of which tools are actually used.

## Good Example
Tool Search enabled: only tool names + descriptions load at startup (~8.7K tokens). Full schemas load on demand when Claude decides to use a tool.

## How to Implement
1. Default enabled in recent Claude Code versions — no action needed.
2. If using `ANTHROPIC_BASE_URL` (custom proxy), force-enable with:
   ```bash
   export ENABLE_TOOL_SEARCH=true
   ```

## Gotchas & Caveats
- Already default-enabled in current Claude Code — check if you're already benefiting.
- Custom API proxies may disable this; use the env var override.
- Massive savings scale with number of MCP tools — the more tools, the bigger the win.
- No quality impact; Claude still discovers tools when needed.
