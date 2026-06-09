import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { McpExtensionConfig, McpExtensionSettings, McpServerConfig } from "./types.ts";

const EXTENSION_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGENT_DIR = resolve(EXTENSION_DIR, "../..");
const DEFAULT_SETTINGS_PATH = resolve(AGENT_DIR, "settings.json");
const DEFAULT_MCP_CONFIG_PATH = resolve(AGENT_DIR, "mcp.json");

export function getSettingsPath(): string {
	return process.env.PI_SETTINGS_PATH ? resolveHome(process.env.PI_SETTINGS_PATH) : DEFAULT_SETTINGS_PATH;
}

export function getMcpConfigPath(settings: McpExtensionSettings = loadExtensionSettings()): string {
	if (process.env.PI_MCP_CONFIG) return resolveHome(process.env.PI_MCP_CONFIG);
	if (settings.configPath) return resolvePathRelativeTo(settings.configPath, dirname(getSettingsPath()));
	return DEFAULT_MCP_CONFIG_PATH;
}

export function loadConfig(): McpExtensionConfig {
	const settings = loadExtensionSettings();
	const configPath = getMcpConfigPath(settings);

	if (!existsSync(configPath)) {
		return { settings, servers: {} };
	}

	const parsed = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
	return { settings, servers: parseMcpServers(parsed, configPath) };
}

function loadExtensionSettings(): McpExtensionSettings {
	const settingsPath = getSettingsPath();
	if (!existsSync(settingsPath)) {
		return defaultExtensionSettings();
	}

	const parsed = JSON.parse(readFileSync(settingsPath, "utf8")) as unknown;
	if (!isRecord(parsed)) {
		throw new Error(`Pi settings must be an object: ${settingsPath}`);
	}

	return parseExtensionSettings(parsed.mcp, settingsPath);
}

function parseExtensionSettings(value: unknown, settingsPath: string): McpExtensionSettings {
	if (value === undefined) return defaultExtensionSettings();
	if (!isRecord(value)) {
		throw new Error(`Pi settings "mcp" must be an object: ${settingsPath}`);
	}

	return {
		prefixTools: value.prefixTools !== false,
		configPath: typeof value.configPath === "string" && value.configPath.trim() !== "" ? value.configPath : "mcp.json",
	};
}

function defaultExtensionSettings(): McpExtensionSettings {
	return { prefixTools: true, configPath: "mcp.json" };
}

function parseMcpServers(value: unknown, configPath: string): Record<string, McpServerConfig> {
	if (!isRecord(value)) {
		throw new Error(`MCP config must be an object: ${configPath}`);
	}

	const serversValue = value.mcpServers;
	if (serversValue === undefined) return {};
	if (!isRecord(serversValue)) {
		throw new Error(`MCP config "mcpServers" must be an object: ${configPath}`);
	}

	const servers: Record<string, McpServerConfig> = {};
	for (const [serverName, rawServer] of Object.entries(serversValue)) {
		servers[serverName] = parseServerConfig(serverName, rawServer, configPath);
	}

	return servers;
}

function parseServerConfig(serverName: string, value: unknown, configPath: string): McpServerConfig {
	if (!isRecord(value)) {
		throw new Error(`MCP server "${serverName}" must be an object: ${configPath}`);
	}
	const command = typeof value.command === "string" && value.command.trim() !== "" ? value.command : undefined;
	const url = typeof value.url === "string" && value.url.trim() !== "" ? value.url : undefined;
	if (!command && !url) {
		throw new Error(`MCP server "${serverName}" must define either command or url: ${configPath}`);
	}
	if (command && url) {
		throw new Error(`MCP server "${serverName}" must define only one of command or url: ${configPath}`);
	}

	return {
		command,
		url,
		args: parseStringArray(value.args, `${serverName}.args`),
		cwd: typeof value.cwd === "string" ? resolvePathRelativeTo(expandEnv(value.cwd), dirname(configPath)) : undefined,
		env: parseStringRecord(value.env, `${serverName}.env`),
		headers: parseStringRecord(value.headers, `${serverName}.headers`),
		includeTools: parseStringArray(value.includeTools, `${serverName}.includeTools`),
		excludeTools: parseStringArray(value.excludeTools, `${serverName}.excludeTools`),
	};
}

function parseStringRecord(value: unknown, path: string): Record<string, string> | undefined {
	if (value === undefined) return undefined;
	if (!isRecord(value)) {
		throw new Error(`MCP config ${path} must be an object`);
	}

	const record: Record<string, string> = {};
	for (const [key, rawValue] of Object.entries(value)) {
		if (typeof rawValue !== "string") {
			throw new Error(`MCP config ${path}.${key} must be a string`);
		}
		record[key] = expandEnv(rawValue);
	}
	return record;
}

function parseStringArray(value: unknown, path: string): string[] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		throw new Error(`MCP config ${path} must be an array of strings`);
	}
	return value;
}

export function resolveServerEnv(env: Record<string, string> | undefined): Record<string, string> {
	const resolved: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined) resolved[key] = value;
	}
	return env ? { ...resolved, ...env } : resolved;
}

function expandEnv(value: string): string {
	return value.replace(/\$\{([A-Z0-9_]+)\}|\$([A-Z0-9_]+)/gi, (_match, braced: string | undefined, bare: string | undefined) => {
		const key = braced ?? bare;
		return key ? process.env[key] ?? "" : "";
	});
}

function resolvePathRelativeTo(value: string, baseDir: string): string {
	const expanded = resolveHome(value);
	return expanded.startsWith("/") ? expanded : resolve(baseDir, expanded);
}

function resolveHome(value: string): string {
	if (value === "~") return process.env.HOME ?? value;
	if (value.startsWith("~/")) return resolve(process.env.HOME ?? "", value.slice(2));
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
