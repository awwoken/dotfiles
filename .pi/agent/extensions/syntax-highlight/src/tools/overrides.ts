import type {
	EditToolDetails,
	ExtensionAPI,
	ToolDefinition,
	ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import {
	createBashTool,
	createEditTool,
	createWriteTool,
	formatSize,
} from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { renderWriteDiffResult, renderEditDiffResult } from "../diff/renderer.ts";
import {
	buildPendingEditPreviewData,
	buildPendingWritePreviewData,
	readWorkspaceUtf8File,
	type PendingDiffPreviewData,
} from "../diff/pending-preview.ts";
import {
	countWriteContentLines,
	getWriteContentSizeBytes,
	shouldRenderWriteCallSummary,
} from "../diff/write-utils.ts";
import type { OwnedToolName, SyntaxHighlightConfig } from "../shared/types.ts";
import { extractTextOutput, pluralize, shortenPath } from "../utils/render.ts";
import { getStringField, toRecord } from "../utils/object.ts";
import { renderBashCall } from "./bash-display.ts";

interface BuiltInTools {
	bash: ReturnType<typeof createBashTool>;
	edit: ReturnType<typeof createEditTool>;
	write: ReturnType<typeof createWriteTool>;
}

type ConfigGetter = () => SyntaxHighlightConfig;
type RuntimeToolDefinition = Record<string, unknown>;
type ToolUpdateCallback = (...args: unknown[]) => void;
type BuiltInRenderResult = (
	result: RenderResultLike,
	options: ToolRenderResultOptions,
	theme: RenderTheme,
	context?: ToolRenderContextLike,
) => unknown;

interface RenderTheme {
	fg(color: string, text: string): string;
	bold(text: string): string;
}

interface ToolRenderContextLike {
	args?: unknown;
	toolCallId?: string;
	state?: unknown;
	cwd?: string;
	argsComplete?: boolean;
	isError?: boolean;
	isPartial?: boolean;
	expanded?: boolean;
	invalidate?: () => void;
}

interface ToolExecutionContextLike {
	cwd: string;
}

interface RenderResultLike {
	content?: unknown;
	details?: unknown;
	isError?: boolean;
}

interface PromptMetadata {
	promptSnippet?: string;
	promptGuidelines?: string[];
}

interface EditExecutionMeta {
	previousContent?: string;
	nextContent?: string;
	fileExistedBeforeEdit: boolean;
}

interface WriteExecutionMeta {
	previousContent?: string;
	fileExistedBeforeWrite: boolean;
}

interface PendingDiffPreviewState {
	key?: string;
	data?: PendingDiffPreviewData;
}

const builtInToolCache = new Map<string, BuiltInTools>();
const EXECUTION_META_LIMIT = 100;
const EDIT_EXECUTION_META_STATE_KEY = "__syntaxHighlightEditExecutionMeta";
const WRITE_EXECUTION_META_STATE_KEY = "__syntaxHighlightWriteExecutionMeta";
const EDIT_PENDING_PREVIEW_STATE_KEY = "__syntaxHighlightEditPendingPreview";
const WRITE_PENDING_PREVIEW_STATE_KEY = "__syntaxHighlightWritePendingPreview";

function registerRuntimeTool(pi: ExtensionAPI, tool: RuntimeToolDefinition): void {
	pi.registerTool(tool as unknown as ToolDefinition);
}

function getBuiltInTools(cwd: string): BuiltInTools {
	let tools = builtInToolCache.get(cwd);
	if (!tools) {
		const cache = new Map<keyof BuiltInTools, unknown>();
		const get = <K extends keyof BuiltInTools>(name: K, factory: () => BuiltInTools[K]): BuiltInTools[K] => {
			if (!cache.has(name)) {
				cache.set(name, factory());
			}
			return cache.get(name) as BuiltInTools[K];
		};
		tools = {
			get bash() { return get("bash", () => createBashTool(cwd)); },
			get edit() { return get("edit", () => createEditTool(cwd)); },
			get write() { return get("write", () => createWriteTool(cwd)); },
		} as BuiltInTools;
		builtInToolCache.set(cwd, tools);
	}
	return tools;
}

function getToolPrepareArguments(tool: unknown): unknown {
	const prepareArguments = toRecord(tool).prepareArguments;
	return typeof prepareArguments === "function" ? prepareArguments : undefined;
}

function cloneToolParameters<T>(parameters: T, seen = new WeakMap<object, unknown>()): T {
	if (parameters === null || typeof parameters !== "object") {
		return parameters;
	}
	if (seen.has(parameters)) {
		return seen.get(parameters) as T;
	}

	const clone = Array.isArray(parameters)
		? []
		: Object.create(Object.getPrototypeOf(parameters));
	seen.set(parameters, clone);

	for (const key of Reflect.ownKeys(parameters)) {
		const descriptor = Object.getOwnPropertyDescriptor(parameters, key);
		if (!descriptor) {
			continue;
		}
		if ("value" in descriptor) {
			descriptor.value = cloneToolParameters(descriptor.value, seen);
		}
		Object.defineProperty(clone, key, descriptor);
	}

	return clone as T;
}

function extractPromptMetadata(tool: unknown): PromptMetadata {
	const source = toRecord(tool);
	const promptSnippet = typeof source.promptSnippet === "string" && source.promptSnippet.trim().length > 0
		? source.promptSnippet
		: undefined;
	const promptGuidelines = Array.isArray(source.promptGuidelines)
		? source.promptGuidelines.filter((guideline): guideline is string => typeof guideline === "string" && guideline.trim().length > 0)
		: undefined;
	return {
		promptSnippet,
		promptGuidelines: promptGuidelines && promptGuidelines.length > 0 ? [...promptGuidelines] : undefined,
	};
}

function getToolPathArg(value: unknown): string | undefined {
	return getStringField(value, "file_path") ?? getStringField(value, "path");
}

function getToolContentArg(value: unknown): string | undefined {
	return getStringField(value, "content");
}

function countTextLines(value: unknown): number {
	return typeof value === "string" ? value.replace(/\r/g, "").split("\n").length : 0;
}

function getEditPayloadLineCount(value: unknown): number {
	const record = toRecord(value);
	const lines = record.lines;
	if (Array.isArray(lines)) {
		return lines.filter((line): line is string => typeof line === "string").length;
	}
	if (typeof lines === "string") {
		return countTextLines(lines);
	}
	return countTextLines(record.newText);
}

function getEditLineCount(value: unknown): number {
	const record = toRecord(value);
	const edits = Array.isArray(record.edits) ? record.edits : [];
	return edits.length > 0
		? edits.reduce((total, edit) => total + getEditPayloadLineCount(edit), 0)
		: getEditPayloadLineCount(record);
}

function isToolError(result: unknown, context?: ToolRenderContextLike): boolean {
	return context?.isError === true || toRecord(result).isError === true;
}

function toStateCarrier(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	return value as Record<string, unknown>;
}

function rememberMeta<T>(pendingMetaByToolCallId: Map<string, T>, toolCallId: string, meta: T): void {
	pendingMetaByToolCallId.delete(toolCallId);
	pendingMetaByToolCallId.set(toolCallId, meta);
	while (pendingMetaByToolCallId.size > EXECUTION_META_LIMIT) {
		const oldestToolCallId = pendingMetaByToolCallId.keys().next().value;
		if (oldestToolCallId === undefined) {
			return;
		}
		pendingMetaByToolCallId.delete(oldestToolCallId);
	}
}

function takeMeta<T>(
	context: ToolRenderContextLike | undefined,
	pendingMetaByToolCallId: Map<string, T>,
	stateKey: string,
): T | undefined {
	if (!context) {
		return undefined;
	}
	const carrier = toStateCarrier(context.state);
	const existing = carrier ? toRecord(carrier[stateKey]) : undefined;
	if (existing && Object.keys(existing).length > 0) {
		return existing as unknown as T;
	}
	if (!context.toolCallId) {
		return undefined;
	}
	const pending = pendingMetaByToolCallId.get(context.toolCallId);
	if (!pending) {
		return undefined;
	}
	if (carrier) {
		carrier[stateKey] = { ...pending };
		pendingMetaByToolCallId.delete(context.toolCallId);
	}
	return pending;
}

function getPendingDiffPreviewState(
	context: ToolRenderContextLike | undefined,
	stateKey: string,
): PendingDiffPreviewState | undefined {
	const carrier = toStateCarrier(context?.state);
	if (!carrier) {
		return undefined;
	}
	const current = carrier[stateKey];
	if (current && typeof current === "object" && !Array.isArray(current)) {
		return current as PendingDiffPreviewState;
	}
	const next: PendingDiffPreviewState = {};
	carrier[stateKey] = next;
	return next;
}

function resolvePendingDiffPreview(
	context: ToolRenderContextLike | undefined,
	stateKey: string,
	previewKey: string | undefined,
	compute: () => PendingDiffPreviewData | undefined,
): PendingDiffPreviewData | undefined {
	const previewState = getPendingDiffPreviewState(context, stateKey);
	if (!previewState) {
		return compute();
	}
	if (previewState.key !== previewKey) {
		previewState.key = previewKey;
		previewState.data = previewKey ? compute() : undefined;
	}
	return previewState.data;
}

function buildPendingDiffCallComponent(
	summaryText: string,
	previewData: PendingDiffPreviewData | undefined,
	context: ToolRenderContextLike | undefined,
	config: SyntaxHighlightConfig,
	theme: RenderTheme,
): Text | Container {
	if (!context?.isPartial || !previewData) {
		return new Text(summaryText, 0, 0);
	}

	const container = new Container();
	container.addChild(new Text(summaryText, 0, 0));
	container.addChild(new Spacer(1));

	if (previewData.notice || typeof previewData.nextContent !== "string") {
		container.addChild(new Text(theme.fg("warning", previewData.notice || "Preview unavailable."), 0, 0));
		return container;
	}

	container.addChild(
		renderWriteDiffResult(
			previewData.nextContent,
			{
				expanded: context.expanded === true,
				filePath: previewData.filePath,
				previousContent: previewData.previousContent,
				fileExistedBeforeWrite: previewData.fileExistedBeforeWrite,
				headerLabel: previewData.headerLabel,
			},
			config,
			theme,
			"",
		),
	);
	return container;
}

function captureExistingWriteContent(cwd: string, rawPath: unknown): { existed: boolean; content?: string } {
	if (typeof rawPath !== "string" || !rawPath.trim()) {
		return { existed: false };
	}
	const existing = readWorkspaceUtf8File(cwd, rawPath);
	return {
		existed: existing.exists,
		content: existing.content,
	};
}

function formatLineCountSuffix(lineCount: number, theme: RenderTheme): string {
	return theme.fg("muted", ` (${lineCount} ${pluralize(lineCount, "line")})`);
}

function formatWriteCallSuffix(lineCount: number, sizeBytes: number, theme: RenderTheme): string {
	return theme.fg("muted", ` (${lineCount} ${pluralize(lineCount, "line")} • ${formatSize(sizeBytes)})`);
}

function formatInProgressLineCount(action: string, lineCount: number, theme: RenderTheme): string {
	return lineCount > 0
		? theme.fg("warning", `${action} ${lineCount} ${pluralize(lineCount, "line")}...`)
		: theme.fg("warning", `${action}...`);
}

function shouldRegisterTool(pi: ExtensionAPI, toolName: OwnedToolName, config: SyntaxHighlightConfig): boolean {
	if (!config.registerToolOverrides[toolName]) {
		return false;
	}
	try {
		const currentOwner = pi.getAllTools().find((tool) => getStringField(tool, "name") === toolName);
		const sourceInfo = toRecord(toRecord(currentOwner).sourceInfo);
		const source = getStringField(sourceInfo, "source");
		return !currentOwner || !source || source === "builtin";
	} catch {
		return true;
	}
}

export function registerSyntaxHighlightToolOverrides(
	pi: ExtensionAPI,
	getConfig: ConfigGetter,
): void {
	builtInToolCache.clear();
	const bootstrapTools = getBuiltInTools(process.cwd());
	const editExecutionMetaByToolCallId = new Map<string, EditExecutionMeta>();
	const writeExecutionMetaByToolCallId = new Map<string, WriteExecutionMeta>();
	const registeredToolOverrides = new Set<OwnedToolName>();

	function registerIfOwned(toolName: OwnedToolName, register: () => void): void {
		if (registeredToolOverrides.has(toolName) || !shouldRegisterTool(pi, toolName, getConfig())) {
			return;
		}
		register();
		registeredToolOverrides.add(toolName);
	}

	registerIfOwned("edit", () => {
		registerRuntimeTool(pi, {
			name: "edit",
			label: "edit",
			description: bootstrapTools.edit.description,
			...extractPromptMetadata(bootstrapTools.edit),
			parameters: cloneToolParameters(bootstrapTools.edit.parameters),
			renderShell: "default",
			prepareArguments: getToolPrepareArguments(bootstrapTools.edit),
			async execute(toolCallId: string, params: any, signal: AbortSignal, onUpdate: ToolUpdateCallback, ctx: ToolExecutionContextLike) {
				const path = getToolPathArg(params);
				const previous = captureExistingWriteContent(ctx.cwd, path);
				const result = await getBuiltInTools(ctx.cwd).edit.execute(toolCallId, params, signal, onUpdate);
				const next = captureExistingWriteContent(ctx.cwd, path);
				rememberMeta(editExecutionMetaByToolCallId, toolCallId, {
					fileExistedBeforeEdit: previous.existed,
					previousContent: previous.content,
					nextContent: next.content,
				});
				return result;
			},
			renderCall(args: unknown, theme: RenderTheme, context: ToolRenderContextLike) {
				const path = shortenPath(getToolPathArg(args));
				const lineCount = getEditLineCount(args);
				const summaryText = `${theme.fg("toolTitle", theme.bold("edit"))} ${theme.fg("accent", path || "...")}${formatLineCountSuffix(lineCount, theme)}`;
				if (!context.argsComplete || !context.isPartial) {
					return new Text(summaryText, 0, 0);
				}

				const argsRecord = toRecord(args);
				const previewKey = JSON.stringify({
					path: getToolPathArg(args) ?? null,
					edits: argsRecord.edits ?? null,
					oldText: getStringField(args, "oldText") ?? null,
					newText: getStringField(args, "newText") ?? null,
				});
				const previewData = resolvePendingDiffPreview(
					context,
					EDIT_PENDING_PREVIEW_STATE_KEY,
					previewKey,
					() => buildPendingEditPreviewData(args, context.cwd ?? process.cwd()),
				);
				return buildPendingDiffCallComponent(summaryText, previewData, context, getConfig(), theme);
			},
			renderResult(result: RenderResultLike, options: ToolRenderResultOptions, theme: RenderTheme, context?: ToolRenderContextLike) {
				const lineCount = getEditLineCount(context?.args);
				if (options.isPartial) {
					return new Text(formatInProgressLineCount("editing", lineCount, theme), 0, 0);
				}

				const fallbackText = extractTextOutput(result);
				if (isToolError(result, context)) {
					return new Text(theme.fg("error", fallbackText || "Edit failed."), 0, 0);
				}

				const executionMeta = takeMeta(
					context,
					editExecutionMetaByToolCallId,
					EDIT_EXECUTION_META_STATE_KEY,
				) as EditExecutionMeta | undefined;
				return renderEditDiffResult(
					result.details as EditToolDetails | undefined,
					{
						expanded: options.expanded,
						filePath: getToolPathArg(context?.args),
						previousContent: executionMeta?.previousContent,
						nextContent: executionMeta?.nextContent,
					},
					getConfig(),
					theme,
					fallbackText,
				);
			},
		});
	});

	registerIfOwned("write", () => {
		registerRuntimeTool(pi, {
			name: "write",
			label: "write",
			description: bootstrapTools.write.description,
			...extractPromptMetadata(bootstrapTools.write),
			parameters: cloneToolParameters(bootstrapTools.write.parameters),
			prepareArguments: getToolPrepareArguments(bootstrapTools.write),
			async execute(toolCallId: string, params: any, signal: AbortSignal, onUpdate: ToolUpdateCallback, ctx: ToolExecutionContextLike) {
				const previous = captureExistingWriteContent(ctx.cwd, getToolPathArg(params));
				rememberMeta(writeExecutionMetaByToolCallId, toolCallId, {
					fileExistedBeforeWrite: previous.existed,
					previousContent: previous.content,
				});
				return getBuiltInTools(ctx.cwd).write.execute(toolCallId, params, signal, onUpdate);
			},
			renderCall(args: unknown, theme: RenderTheme, context: ToolRenderContextLike) {
				const content = getToolContentArg(args);
				const lineCount = countWriteContentLines(content);
				const sizeBytes = getWriteContentSizeBytes(content);
				const path = shortenPath(getToolPathArg(args));
				const suffix = shouldRenderWriteCallSummary({ hasContent: content !== undefined, hasDetailedResultHeader: false })
					? formatWriteCallSuffix(lineCount, sizeBytes, theme)
					: "";
				const summaryText = `${theme.fg("toolTitle", theme.bold("write"))} ${theme.fg("accent", path || "...")}${suffix}`;
				if (!context.argsComplete || !context.isPartial) {
					return new Text(summaryText, 0, 0);
				}

				const previewKey = JSON.stringify({ path: getToolPathArg(args) ?? null, content: content ?? null });
				const previewData = resolvePendingDiffPreview(
					context,
					WRITE_PENDING_PREVIEW_STATE_KEY,
					previewKey,
					() => buildPendingWritePreviewData(args, context.cwd ?? process.cwd()),
				);
				return buildPendingDiffCallComponent(summaryText, previewData, context, getConfig(), theme);
			},
			renderResult(result: RenderResultLike, options: ToolRenderResultOptions, theme: RenderTheme, context?: ToolRenderContextLike) {
				const content = getToolContentArg(context?.args);
				const lineCount = countWriteContentLines(content);
				if (options.isPartial) {
					return new Text(formatInProgressLineCount("writing", lineCount, theme), 0, 0);
				}

				const fallbackText = extractTextOutput(result);
				if (isToolError(result, context)) {
					return new Text(theme.fg("error", fallbackText || "Write failed."), 0, 0);
				}

				const executionMeta = takeMeta(
					context,
					writeExecutionMetaByToolCallId,
					WRITE_EXECUTION_META_STATE_KEY,
				) as WriteExecutionMeta | undefined;
				return renderWriteDiffResult(
					content,
					{
						expanded: options.expanded,
						filePath: getToolPathArg(context?.args),
						previousContent: executionMeta?.previousContent,
						fileExistedBeforeWrite: executionMeta?.fileExistedBeforeWrite ?? false,
					},
					getConfig(),
					theme,
					fallbackText,
				);
			},
		});
	});

	registerIfOwned("bash", () => {
		registerRuntimeTool(pi, {
			name: "bash",
			label: "bash",
			description: bootstrapTools.bash.description,
			...extractPromptMetadata(bootstrapTools.bash),
			parameters: cloneToolParameters(bootstrapTools.bash.parameters),
			prepareArguments: getToolPrepareArguments(bootstrapTools.bash),
			async execute(toolCallId: string, params: any, signal: AbortSignal, onUpdate: ToolUpdateCallback, ctx: ToolExecutionContextLike) {
				return getBuiltInTools(ctx.cwd).bash.execute(toolCallId, params, signal, onUpdate);
			},
			renderCall(
				args: Parameters<typeof renderBashCall>[0],
				theme: Parameters<typeof renderBashCall>[1],
				context: Parameters<typeof renderBashCall>[2],
			) {
				return renderBashCall(args, theme, context);
			},
			renderResult(result: RenderResultLike, options: ToolRenderResultOptions, theme: RenderTheme, context?: ToolRenderContextLike) {
				const builtInRenderResult = toRecord(bootstrapTools.bash).renderResult;
				return typeof builtInRenderResult === "function"
					? (builtInRenderResult as BuiltInRenderResult)(result, options, theme, context)
					: new Text(extractTextOutput(result), 0, 0);
			},
		});
	});

	pi.on("session_start", async () => {
		editExecutionMetaByToolCallId.clear();
		writeExecutionMetaByToolCallId.clear();
	});
	pi.on("before_agent_start", async () => {
		editExecutionMetaByToolCallId.clear();
		writeExecutionMetaByToolCallId.clear();
	});
}
