import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolvePiAgentDir } from "../utils/agent-dir.ts";
import { toRecord } from "../utils/object.ts";
import {
	DEFAULT_SYNTAX_HIGHLIGHT_CONFIG,
	DIFF_VIEW_MODES,
	OWNED_TOOL_NAMES,
	type ConfigLoadResult,
	type ConfigSaveResult,
	type SyntaxHighlightConfig,
	type ToolOverrideOwnership,
} from "../shared/types.ts";

const SETTINGS_FILE = join(resolvePiAgentDir(), "settings.json");
const SETTINGS_KEY = "syntaxHighlight";

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== "number" || Number.isNaN(value)) {
		return fallback;
	}
	const rounded = Math.floor(value);
	if (rounded < min) return min;
	if (rounded > max) return max;
	return rounded;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function toDiffViewMode(value: unknown): SyntaxHighlightConfig["diffViewMode"] {
	if (value === "stacked") {
		return "unified";
	}
	return DIFF_VIEW_MODES.includes(value as SyntaxHighlightConfig["diffViewMode"])
		? (value as SyntaxHighlightConfig["diffViewMode"])
		: DEFAULT_SYNTAX_HIGHLIGHT_CONFIG.diffViewMode;
}

function cloneDefaultConfig(): SyntaxHighlightConfig {
	return {
		...DEFAULT_SYNTAX_HIGHLIGHT_CONFIG,
		registerToolOverrides: { ...DEFAULT_SYNTAX_HIGHLIGHT_CONFIG.registerToolOverrides },
	};
}

function normalizeToolOverrideOwnership(rawOverrides: unknown): ToolOverrideOwnership {
	const source = toRecord(rawOverrides);
	const defaults = DEFAULT_SYNTAX_HIGHLIGHT_CONFIG.registerToolOverrides;
	const overrides = { ...defaults };
	for (const toolName of OWNED_TOOL_NAMES) {
		overrides[toolName] = toBoolean(source[toolName], defaults[toolName]);
	}
	return overrides;
}

export function normalizeSyntaxHighlightConfig(raw: unknown): SyntaxHighlightConfig {
	const source = toRecord(raw);
	return {
		registerToolOverrides: normalizeToolOverrideOwnership(source.registerToolOverrides),
		diffViewMode: toDiffViewMode(source.diffViewMode),
		diffCollapsedLines: clampNumber(
			source.diffCollapsedLines,
			4,
			240,
			DEFAULT_SYNTAX_HIGHLIGHT_CONFIG.diffCollapsedLines,
		),
		diffWordWrap: toBoolean(source.diffWordWrap, DEFAULT_SYNTAX_HIGHLIGHT_CONFIG.diffWordWrap),
	};
}

let cachedSettingsFile: string | undefined;
let cachedSettingsFingerprint: string | undefined;
let cachedConfigResult: ConfigLoadResult | undefined;

function cloneConfig(config: SyntaxHighlightConfig): SyntaxHighlightConfig {
	return normalizeSyntaxHighlightConfig(config);
}

function cloneLoadResult(result: ConfigLoadResult): ConfigLoadResult {
	return {
		...result,
		config: cloneConfig(result.config),
	};
}

function getSettingsFingerprint(settingsFile: string): string {
	try {
		const stats = statSync(settingsFile);
		return `${stats.mtimeMs}:${stats.size}`;
	} catch {
		return "missing";
	}
}

function readSettings(settingsFile: string): Record<string, unknown> {
	if (!existsSync(settingsFile)) {
		return {};
	}
	return toRecord(JSON.parse(readFileSync(settingsFile, "utf-8") as string));
}

export function loadSyntaxHighlightConfig(settingsFile = SETTINGS_FILE): ConfigLoadResult {
	const fingerprint = getSettingsFingerprint(settingsFile);
	if (cachedConfigResult && cachedSettingsFile === settingsFile && cachedSettingsFingerprint === fingerprint) {
		return cloneLoadResult(cachedConfigResult);
	}

	let result: ConfigLoadResult;
	try {
		const settings = readSettings(settingsFile);
		const rawConfig = settings[SETTINGS_KEY];
		result = { config: rawConfig === undefined ? cloneDefaultConfig() : normalizeSyntaxHighlightConfig(rawConfig) };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		result = {
			config: cloneDefaultConfig(),
			error: `Failed to parse ${settingsFile}: ${message}`,
		};
	}

	cachedSettingsFile = settingsFile;
	cachedSettingsFingerprint = fingerprint;
	cachedConfigResult = cloneLoadResult(result);
	return result;
}

export function saveSyntaxHighlightConfig(config: SyntaxHighlightConfig, settingsFile = SETTINGS_FILE): ConfigSaveResult {
	const normalized = normalizeSyntaxHighlightConfig(config);
	const tmpFile = `${settingsFile}.tmp`;

	try {
		const settings = readSettings(settingsFile);
		settings[SETTINGS_KEY] = normalized;
		mkdirSync(dirname(settingsFile), { recursive: true });
		writeFileSync(tmpFile, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
		renameSync(tmpFile, settingsFile);
		cachedSettingsFile = undefined;
		cachedSettingsFingerprint = undefined;
		cachedConfigResult = undefined;
		return { success: true };
	} catch (error) {
		try {
			if (existsSync(tmpFile)) {
				unlinkSync(tmpFile);
			}
		} catch {
			// Ignore cleanup errors.
		}
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			error: `Failed to save ${settingsFile}: ${message}`,
		};
	}
}

export function getSyntaxHighlightConfigPath(): string {
	return `${SETTINGS_FILE}#${SETTINGS_KEY}`;
}
