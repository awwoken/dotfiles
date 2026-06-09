# Local MCP extension

Minimal Pi extension that converts configured MCP tools into normal Pi tools.

## Install dependency

This dotfiles repo's Pi launcher may install local extension dependencies automatically. To install manually:

```bash
cd ~/.pi/agent/extensions/mcp
npm install
```

If you are working from the dotfiles checkout before stowing:

```bash
cd .pi/agent/extensions/mcp
npm install
```

## Extension settings

Extension-level settings live in `.pi/agent/settings.json` under the top-level `mcp` key:

```json
{
  "mcp": {
    "prefixTools": true,
    "configPath": "mcp.json"
  }
}
```

- `prefixTools`: when true, Pi tool names include the MCP server name.
- `configPath`: path to the MCP server config. Relative paths resolve from `settings.json`.

`PI_MCP_CONFIG=/path/to/mcp.json` can override `configPath` for local experiments.

## MCP server config

MCP server definitions live in `.pi/agent/mcp.json`.

Remote HTTP MCP server example:

```json
{
  "mcpServers": {
    "grep": {
      "url": "https://mcp.grep.app"
    }
  }
}
```

Stdio MCP server example:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "includeTools": ["resolve-library-id", "query-docs"]
    }
  }
}
```

With `prefixTools: true`, MCP tool `query-docs` from server `context7` becomes Pi tool `context7_query_docs`.

## Commands

- `/mcp` — show configured servers and registered tool count.
- `/mcp tools` — list registered Pi tool names and source MCP tools.
- `/mcp reconnect [server]` — reconnect all servers, or one named server, and discover/register any new tools.

## Limitations

This extension intentionally implements only the smallest MCP-to-Pi-tool bridge:

- It exposes MCP tools only; MCP resources and prompts are ignored.
- It supports unauthenticated stdio and remote HTTP MCP servers only.
- Remote HTTP servers use Streamable HTTP first, with SSE only as a legacy fallback.
- OAuth and other interactive authentication flows are not implemented.
- MCP AppBridge/custom UI metadata is not rendered or hosted.
- Tool metadata is discovered on startup and is not cached between sessions.
