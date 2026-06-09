import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface McpExtensionSettings {
	/** Prefix Pi tool names with the MCP server name. Defaults to true. */
	prefixTools?: boolean;
	/** Path to the MCP server config file. Relative paths resolve from settings.json. */
	configPath?: string;
}

export interface McpExtensionConfig {
	settings: McpExtensionSettings;
	servers: Record<string, McpServerConfig>;
}

export type McpTransport = StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport;

export interface McpServerConfig {
	/** Stdio command used to launch the MCP server. */
	command?: string;
	/** Remote MCP endpoint for Streamable HTTP/SSE servers. */
	url?: string;
	args?: string[];
	cwd?: string;
	env?: Record<string, string>;
	/** HTTP headers for remote MCP servers. */
	headers?: Record<string, string>;
	/** If present, only these MCP tool names are exposed as Pi tools. */
	includeTools?: string[];
	/** MCP tool names to hide. */
	excludeTools?: string[];
}

export interface McpToolInfo {
	name: string;
	title?: string;
	description?: string;
	inputSchema?: unknown;
}

export interface McpConnection {
	serverName: string;
	config: McpServerConfig;
	client: Client;
	transport: McpTransport;
	tools: McpToolInfo[];
}

export interface RegisteredMcpTool {
	serverName: string;
	mcpToolName: string;
	piToolName: string;
}
