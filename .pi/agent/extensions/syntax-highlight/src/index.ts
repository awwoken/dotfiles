import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	loadSyntaxHighlightConfig,
	normalizeSyntaxHighlightConfig,
	saveSyntaxHighlightConfig,
} from "./config/store.ts";
import { registerSyntaxHighlightToolOverrides } from "./tools/overrides.ts";
import { disposeAll, resetDisposed } from "./utils/disposable.ts";
import {
	DEFAULT_SYNTAX_HIGHLIGHT_CONFIG,
	OWNED_TOOL_NAMES,
	type SyntaxHighlightConfig,
} from "./shared/types.ts";

function ownershipChanged(
	previous: SyntaxHighlightConfig,
	next: SyntaxHighlightConfig,
): boolean {
	return OWNED_TOOL_NAMES.some(
		(toolName) => previous.registerToolOverrides[toolName] !== next.registerToolOverrides[toolName],
	);
}

function formatConfigSummary(config: SyntaxHighlightConfig): string {
	const ownedTools = OWNED_TOOL_NAMES
		.filter((toolName) => config.registerToolOverrides[toolName])
		.join(", ") || "none";
	return [
		`syntax-highlight: ${ownedTools}`,
		`diff: ${config.diffViewMode}, wrap=${config.diffWordWrap}`,
		`collapse=${config.diffCollapsedLines}`,
	].join("\n");
}

function parseCommandArgs(args: unknown): string[] {
	if (Array.isArray(args)) {
		return args.filter((arg): arg is string => typeof arg === "string");
	}
	if (typeof args === "string") {
		return args.trim() ? args.trim().split(/\s+/) : [];
	}
	return [];
}

export default function syntaxHighlightExtension(pi: ExtensionAPI): void {
	resetDisposed();

	pi.on("session_shutdown", (event: { reason: string }) => {
		if (event.reason === "reload") {
			disposeAll();
		}
	});

	const initial = loadSyntaxHighlightConfig();
	let config: SyntaxHighlightConfig = initial.config;
	let pendingLoadError = initial.error;

	const getConfig = (): SyntaxHighlightConfig => config;
	const setConfig = (
		next: SyntaxHighlightConfig,
		ctx: ExtensionCommandContext,
	): void => {
		const normalized = normalizeSyntaxHighlightConfig(next);
		const requiresReload = ownershipChanged(config, normalized);
		config = normalized;

		const saved = saveSyntaxHighlightConfig(normalized);
		if (!saved.success && saved.error) {
			ctx.ui.notify(saved.error, "error");
		}
		if (requiresReload) {
			ctx.ui.notify("Tool ownership updates apply after /reload.", "warning");
		}
	};

	registerSyntaxHighlightToolOverrides(pi, getConfig);

	pi.registerCommand("syntax-highlight", {
		description: "Show or reset syntax-highlight configuration",
		handler: async (args, ctx) => {
			const [command] = parseCommandArgs(args);
			if (!command || command === "show") {
				ctx.ui.notify(formatConfigSummary(config), "info");
				return;
			}
			if (command === "reset") {
				setConfig(DEFAULT_SYNTAX_HIGHLIGHT_CONFIG, ctx);
				ctx.ui.notify("syntax-highlight config reset.", "info");
				return;
			}
			ctx.ui.notify("Usage: /syntax-highlight [show|reset]", "warning");
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		if (pendingLoadError) {
			ctx.ui.notify(pendingLoadError, "warning");
			pendingLoadError = undefined;
		}
	});
}
