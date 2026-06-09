import type { AgentToolResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Type } from "typebox";

import { getMcpConfigPath, getSettingsPath, loadConfig, resolveServerEnv } from "./config.ts";
import { transformMcpResult } from "./content.ts";
import { makeUniqueToolName, toPiToolName } from "./names.ts";
import type { McpConnection, McpExtensionConfig, McpServerConfig, McpToolInfo, McpTransport, RegisteredMcpTool } from "./types.ts";

const EMPTY_PARAMETERS = { type: "object", properties: {}, additionalProperties: false };

export default function mcpExtension(pi: ExtensionAPI) {
	let config: McpExtensionConfig = { settings: { prefixTools: true, configPath: "mcp.json" }, servers: {} };
	const connections = new Map<string, McpConnection>();
	const registeredTools = new Map<string, RegisteredMcpTool>();
	const usedPiToolNames = new Set<string>();

	async function connectServer(serverName: string, serverConfig: McpServerConfig): Promise<McpConnection> {
		await closeServer(serverName);

		const client = new Client({ name: `pi-local-mcp-${serverName}`, version: "0.1.0" });
		const transport = await createTransport(serverConfig);

		try {
			await client.connect(transport);
			const tools = await listAllTools(client);
			const connection: McpConnection = { serverName, config: serverConfig, client, transport, tools };
			connections.set(serverName, connection);
			registerServerTools(connection);
			return connection;
		} catch (error) {
			await client.close().catch(() => undefined);
			await transport.close().catch(() => undefined);
			throw error;
		}
	}

	async function createTransport(serverConfig: McpServerConfig): Promise<McpTransport> {
		if (serverConfig.command) {
			return new StdioClientTransport({
				command: serverConfig.command,
				args: serverConfig.args ?? [],
				cwd: serverConfig.cwd,
				env: resolveServerEnv(serverConfig.env),
				stderr: "ignore",
			});
		}

		if (!serverConfig.url) {
			throw new Error("MCP server config must define command or url");
		}

		return createHttpTransport(serverConfig);
	}

	async function createHttpTransport(serverConfig: McpServerConfig): Promise<McpTransport> {
		const url = new URL(serverConfig.url!);
		const requestInit = serverConfig.headers ? { headers: serverConfig.headers } : undefined;
		const probeTransport = new StreamableHTTPClientTransport(url, { requestInit });
		const probeClient = new Client({ name: "pi-local-mcp-probe", version: "0.1.0" });

		try {
			await probeClient.connect(probeTransport);
			await probeClient.close().catch(() => undefined);
			await probeTransport.close().catch(() => undefined);
			return new StreamableHTTPClientTransport(url, { requestInit });
		} catch {
			await probeClient.close().catch(() => undefined);
			await probeTransport.close().catch(() => undefined);
			return new SSEClientTransport(url, { requestInit });
		}
	}

	async function listAllTools(client: Client): Promise<McpToolInfo[]> {
		const tools: McpToolInfo[] = [];
		let cursor: string | undefined;

		do {
			const result = await client.listTools(cursor ? { cursor } : undefined);
			tools.push(...((result.tools ?? []) as McpToolInfo[]));
			cursor = result.nextCursor;
		} while (cursor);

		return tools;
	}

	function registerServerTools(connection: McpConnection): void {
		const prefixTools = config.settings?.prefixTools !== false;
		const includeTools = connection.config.includeTools ? new Set(connection.config.includeTools) : undefined;
		const excludeTools = new Set(connection.config.excludeTools ?? []);

		for (const tool of connection.tools) {
			if (includeTools && !includeTools.has(tool.name)) continue;
			if (excludeTools.has(tool.name)) continue;

			const baseName = toPiToolName(connection.serverName, tool.name, prefixTools);
			const existing = [...registeredTools.values()].find(
				(registered) => registered.serverName === connection.serverName && registered.mcpToolName === tool.name,
			);
			const piToolName = existing?.piToolName ?? makeUniqueToolName(baseName, usedPiToolNames);
			if (existing) continue;

			registeredTools.set(piToolName, {
				serverName: connection.serverName,
				mcpToolName: tool.name,
				piToolName,
			});

			pi.registerTool({
				name: piToolName,
				label: `MCP: ${tool.title ?? tool.name}`,
				description: tool.description || `MCP tool "${tool.name}" from server "${connection.serverName}".`,
				promptSnippet: tool.description || `Call MCP tool ${tool.name} from ${connection.serverName}.`,
				parameters: Type.Unsafe((tool.inputSchema ?? EMPTY_PARAMETERS) as never),
				async execute(_toolCallId, params) {
					return callMcpTool(connection.serverName, tool.name, params as Record<string, unknown> | undefined);
				},
			});
		}
	}

	async function callMcpTool(
		serverName: string,
		toolName: string,
		params: Record<string, unknown> | undefined,
	): Promise<AgentToolResult<Record<string, unknown>>> {
		let connection = connections.get(serverName);
		if (!connection) {
			const serverConfig = config.servers?.[serverName];
			if (!serverConfig) {
				throw new Error(`MCP server "${serverName}" is not configured`);
			}
			connection = await connectServer(serverName, serverConfig);
		}

		const result = await connection.client.callTool({
			name: toolName,
			arguments: params ?? {},
		}) as CallToolResult;

		const content = transformMcpResult(result);
		if (result.isError) {
			const text = content
				.filter((block): block is { type: "text"; text: string } => block.type === "text")
				.map((block) => block.text)
				.join("\n") || "MCP tool failed";

			return {
				content: [{ type: "text", text: `Error: ${text}` }],
				details: { server: serverName, tool: toolName, error: true },
			};
		}

		return {
			content,
			details: { server: serverName, tool: toolName },
		};
	}

	async function connectConfiguredServers(): Promise<{ connected: number; failed: Array<{ server: string; message: string }> }> {
		const servers = config.servers ?? {};
		const failed: Array<{ server: string; message: string }> = [];
		let connected = 0;

		for (const [serverName, serverConfig] of Object.entries(servers)) {
			try {
				await connectServer(serverName, serverConfig);
				connected += 1;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				failed.push({ server: serverName, message });
				console.warn(`MCP: failed to connect ${serverName}: ${message}`);
			}
		}

		return { connected, failed };
	}

	async function closeServer(serverName: string): Promise<void> {
		const connection = connections.get(serverName);
		if (!connection) return;
		connections.delete(serverName);
		await connection.client.close().catch(() => undefined);
		await connection.transport.close().catch(() => undefined);
	}

	async function closeAllServers(): Promise<void> {
		await Promise.all([...connections.keys()].map((serverName) => closeServer(serverName)));
	}

	function statusText(): string {
		const configuredServers = Object.keys(config.servers ?? {});
		const lines = [`MCP local extension`, `Settings: ${getSettingsPath()}`, `MCP config: ${getMcpConfigPath(config.settings)}`, ""];
		lines.push(`Servers: ${connections.size}/${configuredServers.length} connected`);
		lines.push(`Registered Pi tools: ${registeredTools.size}`);

		if (configuredServers.length > 0) {
			lines.push("", "Configured servers:");
			for (const serverName of configuredServers) {
				const connection = connections.get(serverName);
				lines.push(`- ${serverName}: ${connection ? `connected (${connection.tools.length} MCP tools discovered)` : "not connected"}`);
			}
		}

		if (registeredTools.size > 0) {
			lines.push("", "Use `/mcp tools` to list registered direct tools.");
		}

		return lines.join("\n");
	}

	function toolsText(): string {
		if (registeredTools.size === 0) {
			return "No MCP tools registered.";
		}

		return [...registeredTools.values()]
			.sort((left, right) => left.piToolName.localeCompare(right.piToolName))
			.map((tool) => `- ${tool.piToolName} ← ${tool.serverName}/${tool.mcpToolName}`)
			.join("\n");
	}

	pi.on("session_start", async (_event, ctx) => {
		try {
			config = loadConfig();
			const { connected, failed } = await connectConfiguredServers();
			if (ctx.hasUI) {
				const failedSuffix = failed.length > 0 ? `, ${failed.length} failed` : "";
				ctx.ui.notify(`MCP: connected ${connected} server${connected === 1 ? "" : "s"}, registered ${registeredTools.size} tool${registeredTools.size === 1 ? "" : "s"}${failedSuffix}.`, failed.length > 0 ? "warning" : "info");
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`MCP: initialization failed: ${message}`);
			if (ctx.hasUI) ctx.ui.notify(`MCP initialization failed: ${message}`, "error");
		}
	});

	pi.on("session_shutdown", async () => {
		await closeAllServers();
	});

	pi.registerCommand("mcp", {
		description: "Show local MCP extension status, list tools, or reconnect servers.",
		handler: async (args, ctx) => {
			const [subcommand, serverName] = args.trim().split(/\s+/).filter(Boolean);

			if (subcommand === "tools") {
				ctx.ui.notify(toolsText(), "info");
				return;
			}

			if (subcommand === "reconnect") {
				config = loadConfig();
				if (serverName) {
					const serverConfig = config.servers?.[serverName];
					if (!serverConfig) {
						ctx.ui.notify(`MCP server not configured: ${serverName}`, "error");
						return;
					}
					await connectServer(serverName, serverConfig);
					ctx.ui.notify(`MCP: reconnected ${serverName}`, "info");
					return;
				}

				const { connected, failed } = await connectConfiguredServers();
				ctx.ui.notify(`MCP: reconnected ${connected} server${connected === 1 ? "" : "s"}${failed.length > 0 ? `, ${failed.length} failed` : ""}.`, failed.length > 0 ? "warning" : "info");
				return;
			}

			ctx.ui.notify(statusText(), "info");
		},
	});
}
