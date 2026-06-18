import { Text, truncateToWidth, visibleWidth, wrapTextWithAnsi, type Component } from "@earendil-works/pi-tui";
import type { EditToolDetails } from "@earendil-works/pi-coding-agent";
import { ANSI_SGR_PATTERN, STYLE_RESET_PARAMS, toSgrParams } from "../utils/ansi.ts";
import {
	buildCollapsedDiffHintText,
	clampRenderedLineToWidth,
	clampRenderedLinesToWidth,
} from "./line-width-safety.ts";
import {
	normalizeDiffRenderWidth,
	resolveDiffPresentationMode,
	type DiffPresentationMode,
} from "./presentation.ts";
import { sanitizeAnsiForThemedOutput } from "../utils/render.ts";
import { createCodeLineHighlighter, resolveLanguageFromPath } from "./highlight.ts";
import { parseDiff } from "./parse.ts";
import {
	getLineEmphasisBackground,
	getLineRowBackground,
	resolveContainerBackgroundAnsi,
	resolveDiffPalette,
} from "./palette.ts";
import {
	buildWriteEntries,
	buildWriteOverwriteEntries,
	buildWriteOverwriteGuardText,
	resolveWriteOverwriteGuard,
	splitWriteContentLines,
	type WriteOverwriteGuard,
} from "./write-model.ts";
import type { SyntaxHighlightConfig } from "../shared/types.ts";
import type {
	CodeLineHighlighter,
	DiffLineEntry,
	DiffLineKind,
	DiffMetaEntry,
	DiffPalette,
	DiffRenderOptions,
	DiffSpan,
	DiffStats,
	DiffTheme,
	ParsedDiff,
	ParsedDiffEntry,
	RenderedRow,
	SplitDiffRow,
} from "./types.ts";

const SPLIT_SEPARATOR = "   ";
const MIN_LINE_NUMBER_WIDTH = 2;
const MIN_SPLIT_COLUMN_WIDTH = 24;
const MAX_INLINE_DIFF_LINE_LENGTH = 700;
const ANSI_BG_RESET = "\x1b[49m";
const DIFF_WIDTH_OPS = {
	measure: visibleWidth,
	truncate: (text: string, maxWidth: number): string => truncateToWidth(text, maxWidth, ""),
};

function clampDiffLineToWidth(text: string, width: number): string {
	return stabilizeBackgroundResets(clampRenderedLineToWidth(text, width, DIFF_WIDTH_OPS));
}

function clampDiffLinesToWidth(lines: string[], width: number): string[] {
	return clampRenderedLinesToWidth(lines, width, DIFF_WIDTH_OPS).map((line) => stabilizeBackgroundResets(line));
}

function normalizeCodeWhitespace(text: string): string {
	return text.replace(/\t/g, "    ");
}

function isFiniteSgrParam(value: number | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function readSgrColorSequence(params: number[], index: number): number[] | undefined {
	const param = params[index];
	if (param !== 38 && param !== 48) {
		return undefined;
	}

	const colorMode = params[index + 1];
	if (colorMode === 5) {
		const colorValue = params[index + 2];
		return isFiniteSgrParam(colorValue) ? [param, colorMode, colorValue] : undefined;
	}

	if (colorMode === 2) {
		const red = params[index + 2];
		const green = params[index + 3];
		const blue = params[index + 4];
		return isFiniteSgrParam(red) && isFiniteSgrParam(green) && isFiniteSgrParam(blue)
			? [param, colorMode, red, green, blue]
			: undefined;
	}

	return undefined;
}

function sequenceResetsBackground(params: number[]): boolean {
	for (let index = 0; index < params.length; index++) {
		const param = params[index] ?? 0;
		if (param === 0 || param === 49) {
			return true;
		}

		const colorSequence = readSgrColorSequence(params, index);
		if (colorSequence) {
			index += colorSequence.length - 1;
		}
	}

	return false;
}

function stripBackgroundResetParams(params: number[]): number[] {
	const sanitized: number[] = [];

	for (let index = 0; index < params.length; index++) {
		const param = params[index] ?? 0;

		if (param === 0) {
			sanitized.push(...STYLE_RESET_PARAMS);
			continue;
		}

		if (param === 49) {
			continue;
		}

		const colorSequence = readSgrColorSequence(params, index);
		if (colorSequence) {
			sanitized.push(...colorSequence);
			index += colorSequence.length - 1;
			continue;
		}

		sanitized.push(param);
	}

	return sanitized;
}

function stabilizeBackgroundResets(text: string): string {
	if (!text || !text.includes("\x1b[")) {
		return text;
	}

	return text.replace(ANSI_SGR_PATTERN, (_sequence, rawParams: string) => {
		const parsed = toSgrParams(rawParams);
		if (parsed.length === 0) {
			return "";
		}
		const sanitized = stripBackgroundResetParams(parsed);
		if (sanitized.length === 0) {
			return "";
		}
		return `\x1b[${sanitized.join(";")}m`;
	});
}

function fitToWidth(text: string, width: number): string {
	const trimmed = truncateToWidth(text, width, "");
	const gap = Math.max(0, width - visibleWidth(trimmed));
	return gap > 0 ? `${trimmed}${" ".repeat(gap)}` : trimmed;
}

function applyBackgroundToVisualRow(
	text: string,
	width: number,
	rowBgAnsi: string,
	restoreBgAnsi: string,
): string {
	if (width <= 0) {
		return "";
	}

	const fitted = fitToWidth(text, width);
	const withStableBackground = keepBackgroundAcrossResets(fitted, rowBgAnsi);
	return stabilizeBackgroundResets(`${rowBgAnsi}${withStableBackground}${restoreBgAnsi}`);
}

function applyLineBackgroundToWrappedRows(
	rows: string[],
	width: number,
	rowBgAnsi: string,
	restoreBgAnsi: string,
): string[] {
	if (rows.length === 0) {
		return [applyBackgroundToVisualRow("", width, rowBgAnsi, restoreBgAnsi)];
	}

	return rows.map((row) => applyBackgroundToVisualRow(row, width, rowBgAnsi, restoreBgAnsi));
}

function wrapToWidth(text: string, width: number, wordWrap: boolean): string[] {
	if (width <= 0) {
		return [""];
	}

	if (!wordWrap) {
		return [fitToWidth(text, width)];
	}

	const wrapped = wrapTextWithAnsi(text, width);
	if (wrapped.length === 0) {
		return [fitToWidth("", width)];
	}

	return wrapped.map((line) => fitToWidth(line, width));
}

function getHashlineAnchorLabel(entry: DiffLineEntry): string | undefined {
	if (!entry.hashlineAnchorContent) {
		return undefined;
	}
	const separatorIndex = entry.hashlineAnchorContent.indexOf(":");
	return separatorIndex >= 0
		? entry.hashlineAnchorContent.slice(0, separatorIndex)
		: entry.hashlineAnchorContent;
}

function toNumber(value: string | undefined): number | null {
	if (!value) {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

function getLineNumberWidth(entries: ParsedDiffEntry[], showHashlineAnchors = false): number {
	let maxWidth = MIN_LINE_NUMBER_WIDTH;

	for (const entry of entries) {
		if (entry.kind !== "line") {
			continue;
		}

		if (showHashlineAnchors) {
			const anchorLabel = getHashlineAnchorLabel(entry);
			if (anchorLabel) {
				maxWidth = Math.max(maxWidth, visibleWidth(anchorLabel));
				continue;
			}
		}

		const candidates = [
			entry.oldLineNumber,
			entry.newLineNumber,
			toNumber(entry.fallbackLineNumber),
		].filter((value): value is number => value !== null);

		for (const candidate of candidates) {
			const digits = `${candidate}`.length;
			if (digits > maxWidth) {
				maxWidth = digits;
			}
		}
	}

	return maxWidth;
}

function formatLineNumber(value: number | null, fallback: string, width: number): string {
	if (value !== null) {
		return `${value}`.padStart(width, " ");
	}
	if (fallback.trim()) {
		return fallback.trim().slice(-width).padStart(width, " ");
	}
	return " ".repeat(width);
}

function formatLineNumberLabel(
	entry: DiffLineEntry,
	value: number | null,
	fallback: string,
	width: number,
	showHashlineAnchors: boolean,
): string {
	const anchorLabel = showHashlineAnchors ? getHashlineAnchorLabel(entry) : undefined;
	if (anchorLabel) {
		return fitToWidth(anchorLabel, width);
	}
	return formatLineNumber(value, fallback, width);
}

function formatMetaEntryRows(entry: DiffMetaEntry, width: number, theme: DiffTheme, wordWrap: boolean): RenderedRow[] {
	const normalized = sanitizeAnsiForThemedOutput(normalizeCodeWhitespace(entry.raw));
	const lines = wordWrap
		? wrapToWidth(normalized, width, true)
		: [truncateToWidth(normalized, width)];

	const mapColor = (line: string): string => {
		if (entry.kind === "hunk") {
			return stabilizeBackgroundResets(theme.fg("accent", line));
		}
		if (entry.kind === "file") {
			return stabilizeBackgroundResets(theme.fg("muted", line));
		}
		return stabilizeBackgroundResets(theme.fg("toolDiffContext", line));
	};

	return lines.map((line) => ({
		text: mapColor(line),
		hunkIndex: entry.kind === "file" ? null : entry.hunkIndex || null,
	}));
}

function buildSplitRows(entries: ParsedDiffEntry[]): SplitDiffRow[] {
	const rows: SplitDiffRow[] = [];
	let index = 0;

	while (index < entries.length) {
		const entry = entries[index];
		if (!entry) {
			break;
		}

		if (entry.kind !== "line") {
			rows.push({ meta: entry, hunkIndex: entry.hunkIndex || null });
			index++;
			continue;
		}

		if (entry.lineKind === "remove") {
			const removed: DiffLineEntry[] = [];
			while (index < entries.length) {
				const candidate = entries[index];
				if (!candidate || candidate.kind !== "line" || candidate.lineKind !== "remove") {
					break;
				}
				removed.push(candidate);
				index++;
			}

			const added: DiffLineEntry[] = [];
			while (index < entries.length) {
				const candidate = entries[index];
				if (!candidate || candidate.kind !== "line" || candidate.lineKind !== "add") {
					break;
				}
				added.push(candidate);
				index++;
			}

			const pairCount = Math.max(removed.length, added.length);
			for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
				const left = removed[pairIndex];
				const right = added[pairIndex];
				rows.push({
					left,
					right,
					hunkIndex: left?.hunkIndex ?? right?.hunkIndex ?? null,
				});
			}
			continue;
		}

		if (entry.lineKind === "add") {
			rows.push({ right: entry, hunkIndex: entry.hunkIndex || null });
			index++;
			continue;
		}

		rows.push({ left: entry, right: entry, hunkIndex: entry.hunkIndex || null });
		index++;
	}

	return rows;
}

function getCellLineNumber(line: DiffLineEntry, side: "left" | "right"): number | null {
	if (side === "left") {
		return line.oldLineNumber ?? (line.lineKind === "context" ? line.newLineNumber : null);
	}
	return line.newLineNumber ?? (line.lineKind === "context" ? line.oldLineNumber : null);
}

function tokenizeInlineDiff(input: string): Array<{ value: string; start: number; end: number }> {
	if (!input) {
		return [];
	}

	const tokens: Array<{ value: string; start: number; end: number }> = [];
	const pattern = /(\s+|[A-Za-z0-9_]+|[^A-Za-z0-9_\s])/g;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(input)) !== null) {
		const value = match[0] ?? "";
		if (!value) {
			continue;
		}
		tokens.push({
			value,
			start: match.index,
			end: match.index + value.length,
		});
	}

	if (tokens.length === 0 && input.length > 0) {
		tokens.push({ value: input, start: 0, end: input.length });
	}

	return tokens;
}

function mergeSpans(spans: DiffSpan[]): DiffSpan[] {
	if (spans.length <= 1) {
		return spans;
	}

	const sorted = [...spans].sort((a, b) => a.start - b.start);
	const merged: DiffSpan[] = [sorted[0]];

	for (let index = 1; index < sorted.length; index++) {
		const current = sorted[index];
		const previous = merged[merged.length - 1];
		if (!current || !previous) {
			continue;
		}

		if (current.start <= previous.end) {
			previous.end = Math.max(previous.end, current.end);
			continue;
		}

		merged.push({ ...current });
	}

	return merged;
}

function tokensToDiffSpans(
	text: string,
	tokens: Array<{ value: string; start: number; end: number }>,
	changedIndexes: Set<number>,
): DiffSpan[] {
	if (tokens.length === 0 || changedIndexes.size === 0) {
		return [];
	}

	const spans: DiffSpan[] = [];
	let start: number | null = null;
	let end = -1;

	for (let index = 0; index < tokens.length; index++) {
		if (!changedIndexes.has(index)) {
			if (start !== null && end > start) {
				spans.push({ start, end });
				start = null;
				end = -1;
			}
			continue;
		}

		const token = tokens[index];
		if (!token) {
			continue;
		}

		if (start === null) {
			start = token.start;
			end = token.end;
		} else {
			end = token.end;
		}
	}

	if (start !== null && end > start) {
		spans.push({ start, end });
	}

	const trimmed: DiffSpan[] = [];
	for (const span of spans) {
		let spanStart = span.start;
		let spanEnd = span.end;

		while (spanStart < spanEnd && /\s/.test(text[spanStart] ?? "")) {
			spanStart++;
		}
		while (spanEnd > spanStart && /\s/.test(text[spanEnd - 1] ?? "")) {
			spanEnd--;
		}
		if (spanEnd > spanStart) {
			trimmed.push({ start: spanStart, end: spanEnd });
		}
	}

	return mergeSpans(trimmed);
}

function computeInlineDiffSpans(leftLine: string, rightLine: string): { left: DiffSpan[]; right: DiffSpan[] } {
	if (leftLine === rightLine) {
		return { left: [], right: [] };
	}
	if (leftLine.length > MAX_INLINE_DIFF_LINE_LENGTH || rightLine.length > MAX_INLINE_DIFF_LINE_LENGTH) {
		return { left: [], right: [] };
	}

	const leftTokens = tokenizeInlineDiff(leftLine);
	const rightTokens = tokenizeInlineDiff(rightLine);
	const leftCount = leftTokens.length;
	const rightCount = rightTokens.length;

	if (leftCount === 0 || rightCount === 0) {
		return {
			left: leftLine.trim().length > 0 ? [{ start: 0, end: leftLine.length }] : [],
			right: rightLine.trim().length > 0 ? [{ start: 0, end: rightLine.length }] : [],
		};
	}

	const table: number[][] = Array.from({ length: leftCount + 1 }, () => Array<number>(rightCount + 1).fill(0));

	for (let leftIndex = 1; leftIndex <= leftCount; leftIndex++) {
		const leftToken = leftTokens[leftIndex - 1];
		for (let rightIndex = 1; rightIndex <= rightCount; rightIndex++) {
			const rightToken = rightTokens[rightIndex - 1];
			if (leftToken?.value === rightToken?.value) {
				table[leftIndex][rightIndex] = (table[leftIndex - 1]?.[rightIndex - 1] ?? 0) + 1;
			} else {
				const top = table[leftIndex - 1]?.[rightIndex] ?? 0;
				const side = table[leftIndex]?.[rightIndex - 1] ?? 0;
				table[leftIndex][rightIndex] = Math.max(top, side);
			}
		}
	}

	const changedLeft = new Set<number>();
	const changedRight = new Set<number>();
	let leftCursor = leftCount;
	let rightCursor = rightCount;

	while (leftCursor > 0 && rightCursor > 0) {
		const leftToken = leftTokens[leftCursor - 1];
		const rightToken = rightTokens[rightCursor - 1];
		if (leftToken?.value === rightToken?.value) {
			leftCursor--;
			rightCursor--;
			continue;
		}

		const top = table[leftCursor - 1]?.[rightCursor] ?? 0;
		const side = table[leftCursor]?.[rightCursor - 1] ?? 0;
		if (top >= side) {
			changedLeft.add(leftCursor - 1);
			leftCursor--;
		} else {
			changedRight.add(rightCursor - 1);
			rightCursor--;
		}
	}

	while (leftCursor > 0) {
		changedLeft.add(leftCursor - 1);
		leftCursor--;
	}
	while (rightCursor > 0) {
		changedRight.add(rightCursor - 1);
		rightCursor--;
	}

	return {
		left: tokensToDiffSpans(leftLine, leftTokens, changedLeft),
		right: tokensToDiffSpans(rightLine, rightTokens, changedRight),
	};
}

function splitRowsContainReplacement(rows: SplitDiffRow[]): boolean {
	return rows.some((row) => row.left?.lineKind === "remove" && row.right?.lineKind === "add");
}

function parsedEntriesContainChange(entries: ParsedDiffEntry[]): boolean {
	return entries.some(
		(entry) => entry.kind === "line" && (entry.lineKind === "add" || entry.lineKind === "remove"),
	);
}

function shouldRenderAutoEditDiffAsUnified(
	entries: ParsedDiffEntry[],
	rows: SplitDiffRow[],
	config: Pick<SyntaxHighlightConfig, "diffViewMode">,
): boolean {
	return config.diffViewMode === "auto"
		&& parsedEntriesContainChange(entries)
		&& !splitRowsContainReplacement(rows);
}

function buildInlineHighlightMap(rows: SplitDiffRow[]): WeakMap<DiffLineEntry, DiffSpan[]> {
	const highlights = new WeakMap<DiffLineEntry, DiffSpan[]>();

	for (const row of rows) {
		if (!row.left || !row.right) {
			continue;
		}
		if (row.left.lineKind !== "remove" || row.right.lineKind !== "add") {
			continue;
		}

		const leftText = normalizeCodeWhitespace(row.left.content);
		const rightText = normalizeCodeWhitespace(row.right.content);
		const inline = computeInlineDiffSpans(leftText, rightText);
		if (inline.left.length > 0) {
			highlights.set(row.left, inline.left);
		}
		if (inline.right.length > 0) {
			highlights.set(row.right, inline.right);
		}
	}

	return highlights;
}

function applyBackgroundToVisibleRange(
	ansiText: string,
	start: number,
	end: number,
	backgroundAnsi: string,
	restoreBackgroundAnsi: string,
): string {
	if (!ansiText || start >= end || end <= 0) {
		return ansiText;
	}

	const rangeStart = Math.max(0, start);
	const rangeEnd = Math.max(rangeStart, end);
	let output = "";
	let visibleIndex = 0;
	let index = 0;
	let inRange = false;

	while (index < ansiText.length) {
		if (ansiText[index] === "\x1b") {
			const sequenceEnd = ansiText.indexOf("m", index);
			if (sequenceEnd !== -1) {
				output += ansiText.slice(index, sequenceEnd + 1);
				index = sequenceEnd + 1;
				continue;
			}
		}

		if (visibleIndex === rangeStart && !inRange) {
			output += backgroundAnsi;
			inRange = true;
		}
		if (visibleIndex === rangeEnd && inRange) {
			output += restoreBackgroundAnsi;
			inRange = false;
		}

		output += ansiText[index] ?? "";
		visibleIndex++;
		index++;
	}

	if (inRange) {
		output += restoreBackgroundAnsi;
	}

	return output;
}

function applyInlineSpanHighlight(
	plainText: string,
	renderedText: string,
	spans: DiffSpan[],
	emphasisBgAnsi: string | undefined,
	rowBgAnsi: string | undefined,
	fallbackBgAnsi: string | undefined,
): string {
	if (!renderedText || !plainText || spans.length === 0 || !emphasisBgAnsi) {
		return renderedText;
	}

	const sorted = mergeSpans(
		spans
			.map((span) => ({
				start: Math.max(0, Math.min(plainText.length, span.start)),
				end: Math.max(0, Math.min(plainText.length, span.end)),
			}))
			.filter((span) => span.end > span.start),
	);
	if (sorted.length === 0) {
		return renderedText;
	}

	const restoreBackgroundAnsi = rowBgAnsi ?? fallbackBgAnsi ?? ANSI_BG_RESET;
	let highlighted = renderedText;
	for (let index = sorted.length - 1; index >= 0; index--) {
		const span = sorted[index];
		if (!span) {
			continue;
		}
		highlighted = applyBackgroundToVisibleRange(
			highlighted,
			span.start,
			span.end,
			emphasisBgAnsi,
			restoreBackgroundAnsi,
		);
	}

	return highlighted;
}

function colorizeSegment(
	theme: DiffTheme,
	color: "dim" | "toolDiffAdded" | "toolDiffRemoved",
	text: string,
	rowBg: string | undefined,
): string {
	let themedText: string;
	try {
		themedText = theme.fg(color, text);
	} catch {
		themedText = text;
	}

	if (!rowBg) {
		return themedText;
	}

	const stableText = keepBackgroundAcrossResets(themedText, rowBg);
	return `${rowBg}${stableText}${rowBg}`;
}

function keepBackgroundAcrossResets(text: string, rowBg: string): string {
	if (!text) {
		return text;
	}

	return text.replace(ANSI_SGR_PATTERN, (sequence, rawParams: string) => {
		const params = toSgrParams(rawParams);
		if (params.length === 0 || !sequenceResetsBackground(params)) {
			return sequence;
		}
		return `${sequence}${rowBg}`;
	});
}

function usesHashlineGutter(showHashlineAnchors: boolean): boolean {
	return showHashlineAnchors;
}

function getLineDividerPlainWidth(): number {
	return 1;
}

function renderCodeDivider(rowBg: string | undefined): string {
	return rowBg ? `${rowBg} ` : " ";
}

function getLineNumberColor(kind: DiffLineKind): "dim" | "toolDiffAdded" | "toolDiffRemoved" {
	if (kind === "add") {
		return "toolDiffAdded";
	}
	if (kind === "remove") {
		return "toolDiffRemoved";
	}
	return "dim";
}

function renderLineNumberSegment(
	kind: DiffLineKind,
	lineNumber: string,
	theme: DiffTheme,
	rowBg: string | undefined,
): string {
	return colorizeSegment(theme, getLineNumberColor(kind), lineNumber, rowBg);
}

function getLinePrefixPlainWidth(lineNumberWidth: number, hashlineGutter = false): number {
	if (hashlineGutter) {
		return lineNumberWidth;
	}
	return visibleWidth(`${" ".repeat(lineNumberWidth)} `);
}

function renderLinePrefix(
	kind: DiffLineKind,
	lineNumber: string,
	theme: DiffTheme,
	rowBg: string | undefined,
	hashlineGutter = false,
): string {
	const number = renderLineNumberSegment(kind, lineNumber, theme, rowBg);
	if (hashlineGutter) {
		return number;
	}
	const spacer = rowBg ? `${rowBg} ` : " ";
	return `${number}${spacer}`;
}

function renderLineContinuationPrefix(
	kind: DiffLineKind,
	lineNumberWidth: number,
	rowBg: string | undefined,
	theme: DiffTheme,
	hashlineGutter = false,
): string {
	const blankLineNumber = " ".repeat(lineNumberWidth);
	return renderLinePrefix(kind, blankLineNumber, theme, rowBg, hashlineGutter);
}

function renderLineCell(
	kind: DiffLineKind,
	lineNumber: string,
	code: string,
	width: number,
	rowBg: string | undefined,
	restoreBgAnsi: string | undefined,
	theme: DiffTheme,
	wordWrap: boolean,
	hashlineGutter = false,
): string[] {
	if (width <= 0) {
		return [""];
	}

	const prefixPlainWidth = getLinePrefixPlainWidth(lineNumber.length, hashlineGutter);
	const dividerPlainWidth = getLineDividerPlainWidth();
	const codeWidth = Math.max(0, width - prefixPlainWidth - dividerPlainWidth);
	const prefix = renderLinePrefix(kind, lineNumber, theme, undefined, hashlineGutter);
	const continuationPrefix = renderLineContinuationPrefix(kind, lineNumber.length, undefined, theme, hashlineGutter);
	const divider = renderCodeDivider(undefined);
	const wrappedCodeLines = wrapToWidth(code, codeWidth, wordWrap);

	if (!rowBg) {
		return wrappedCodeLines.map((wrappedCodeLine, index) =>
			stabilizeBackgroundResets(`${index === 0 ? prefix : continuationPrefix}${divider}${wrappedCodeLine}`)
		);
	}

	const safeRestoreBgAnsi = restoreBgAnsi ?? rowBg ?? ANSI_BG_RESET;
	const visualRows = wrappedCodeLines.map((wrappedCodeLine, index) => {
		const linePrefix = index === 0 ? prefix : continuationPrefix;
		return `${linePrefix}${divider}${wrappedCodeLine}`;
	});
	return applyLineBackgroundToWrappedRows(visualRows, width, rowBg, safeRestoreBgAnsi);
}

function renderUnified(
	entries: ParsedDiffEntry[],
	width: number,
	theme: DiffTheme,
	lineNumberWidth: number,
	inlineHighlights: WeakMap<DiffLineEntry, DiffSpan[]>,
	palette: DiffPalette,
	highlightLine: CodeLineHighlighter,
	containerBgAnsi: string | undefined,
	wordWrap: boolean,
	showHashlineAnchors: boolean,
): RenderedRow[] {
	const rows: RenderedRow[] = [];

	for (const entry of entries) {
		if (entry.kind !== "line") {
			rows.push(...formatMetaEntryRows(entry, width, theme, wordWrap));
			continue;
		}

		const lineNumber = entry.lineKind === "add"
			? formatLineNumberLabel(entry, entry.newLineNumber, entry.fallbackLineNumber, lineNumberWidth, showHashlineAnchors)
			: formatLineNumberLabel(entry, entry.oldLineNumber, entry.fallbackLineNumber, lineNumberWidth, showHashlineAnchors);
		const codeText = normalizeCodeWhitespace(entry.content);
		const syntaxHighlighted = highlightLine(codeText, entry);
		const rowBg = getLineRowBackground(entry.lineKind, palette);
		const emphasisBg = getLineEmphasisBackground(entry.lineKind, palette);
		const inlineSpans = inlineHighlights.get(entry) ?? [];
		const highlighted = applyInlineSpanHighlight(codeText, syntaxHighlighted, inlineSpans, emphasisBg, rowBg, containerBgAnsi);
		const lines = renderLineCell(
			entry.lineKind,
			lineNumber,
			highlighted,
			width,
			rowBg,
			containerBgAnsi,
			theme,
			wordWrap,
			usesHashlineGutter(showHashlineAnchors),
		);

		rows.push(
			...lines.map((text) => ({
				text,
				hunkIndex: entry.hunkIndex || null,
			})),
		);
	}

	return rows;
}

function toUnifiedFallbackRows(
	rows: SplitDiffRow[],
	width: number,
	theme: DiffTheme,
	lineNumberWidth: number,
	inlineHighlights: WeakMap<DiffLineEntry, DiffSpan[]>,
	palette: DiffPalette,
	highlightLine: CodeLineHighlighter,
	containerBgAnsi: string | undefined,
	wordWrap: boolean,
	showHashlineAnchors: boolean,
): RenderedRow[] {
	const flattened: ParsedDiffEntry[] = [];
	for (const row of rows) {
		if (row.meta) {
			flattened.push(row.meta);
			continue;
		}
		if (row.left) {
			flattened.push(row.left);
		}
		if (row.right && row.right !== row.left) {
			flattened.push(row.right);
		}
	}
	return renderUnified(
		flattened,
		width,
		theme,
		lineNumberWidth,
		inlineHighlights,
		palette,
		highlightLine,
		containerBgAnsi,
		wordWrap,
		showHashlineAnchors,
	);
}

function renderSplitBlankCell(
	columnWidth: number,
	lineNumberWidth: number,
	theme: DiffTheme,
	hashlineGutter = false,
): string {
	const prefixPlainWidth = getLinePrefixPlainWidth(lineNumberWidth, hashlineGutter);
	const dividerPlainWidth = getLineDividerPlainWidth();
	const codeWidth = Math.max(0, columnWidth - prefixPlainWidth - dividerPlainWidth);
	const prefix = renderLinePrefix("context", " ".repeat(lineNumberWidth), theme, undefined, hashlineGutter);
	const divider = renderCodeDivider(undefined);
	return stabilizeBackgroundResets(`${prefix}${divider}${" ".repeat(codeWidth)}`);
}

function renderSplitCell(
	line: DiffLineEntry | undefined,
	side: "left" | "right",
	columnWidth: number,
	lineNumberWidth: number,
	theme: DiffTheme,
	inlineHighlights: WeakMap<DiffLineEntry, DiffSpan[]>,
	palette: DiffPalette,
	highlightLine: CodeLineHighlighter,
	containerBgAnsi: string | undefined,
	wordWrap: boolean,
	showHashlineAnchors: boolean,
): string[] {
	const hashlineGutter = usesHashlineGutter(showHashlineAnchors);
	if (!line) {
		return [renderSplitBlankCell(columnWidth, lineNumberWidth, theme, hashlineGutter)];
	}

	const lineNumber = formatLineNumberLabel(line, getCellLineNumber(line, side), line.fallbackLineNumber, lineNumberWidth, showHashlineAnchors);
	const rowBg = getLineRowBackground(line.lineKind, palette);
	const emphasisBg = getLineEmphasisBackground(line.lineKind, palette);
	const codeText = normalizeCodeWhitespace(line.content);
	const syntaxHighlighted = highlightLine(codeText, line, side);
	const inlineSpans = inlineHighlights.get(line) ?? [];
	const highlighted = applyInlineSpanHighlight(codeText, syntaxHighlighted, inlineSpans, emphasisBg, rowBg, containerBgAnsi);
	return renderLineCell(
		line.lineKind,
		lineNumber,
		highlighted,
		columnWidth,
		rowBg,
		containerBgAnsi,
		theme,
		wordWrap,
		hashlineGutter,
	);
}

function renderSplitDivider(
	containerBgAnsi: string | undefined,
	separatorText: string = SPLIT_SEPARATOR,
): string {
	return stabilizeBackgroundResets(containerBgAnsi ? `${containerBgAnsi}${separatorText}${containerBgAnsi}` : separatorText);
}

function canRenderSplitLayout(width: number): boolean {
	const separatorWidth = visibleWidth(SPLIT_SEPARATOR);
	const minimumSplitWidth = MIN_SPLIT_COLUMN_WIDTH * 2 + separatorWidth;
	return width >= minimumSplitWidth;
}

function renderSplit(
	rows: SplitDiffRow[],
	width: number,
	theme: DiffTheme,
	lineNumberWidth: number,
	inlineHighlights: WeakMap<DiffLineEntry, DiffSpan[]>,
	palette: DiffPalette,
	highlightLine: CodeLineHighlighter,
	containerBgAnsi: string | undefined,
	wordWrap: boolean,
	showHashlineAnchors: boolean,
): RenderedRow[] {
	if (!canRenderSplitLayout(width)) {
		return toUnifiedFallbackRows(
			rows,
			width,
			theme,
			lineNumberWidth,
			inlineHighlights,
			palette,
			highlightLine,
			containerBgAnsi,
			wordWrap,
			showHashlineAnchors,
		);
	}

	const separatorWidth = visibleWidth(SPLIT_SEPARATOR);
	const leftWidth = Math.max(MIN_SPLIT_COLUMN_WIDTH, Math.floor((width - separatorWidth) / 2));
	const rightWidth = Math.max(MIN_SPLIT_COLUMN_WIDTH, width - separatorWidth - leftWidth);
	const splitLineNumberWidth = Math.max(3, lineNumberWidth);
	const hashlineGutter = usesHashlineGutter(showHashlineAnchors);
	const separator = renderSplitDivider(containerBgAnsi);
	const output: RenderedRow[] = [];

	for (const row of rows) {
		if (row.meta) {
			output.push(...formatMetaEntryRows(row.meta, width, theme, wordWrap));
			continue;
		}

		const leftCells = renderSplitCell(
			row.left,
			"left",
			leftWidth,
			splitLineNumberWidth,
			theme,
			inlineHighlights,
			palette,
			highlightLine,
			containerBgAnsi,
			wordWrap,
			showHashlineAnchors,
		);
		const rightCells = renderSplitCell(
			row.right,
			"right",
			rightWidth,
			splitLineNumberWidth,
			theme,
			inlineHighlights,
			palette,
			highlightLine,
			containerBgAnsi,
			wordWrap,
			showHashlineAnchors,
		);

		const rowCount = Math.max(leftCells.length, rightCells.length);
		for (let index = 0; index < rowCount; index++) {
			const leftCell = leftCells[index] ?? renderSplitBlankCell(leftWidth, splitLineNumberWidth, theme, hashlineGutter);
			const rightCell = rightCells[index] ?? renderSplitBlankCell(rightWidth, splitLineNumberWidth, theme, hashlineGutter);
			output.push({ text: `${leftCell}${separator}${rightCell}`, hunkIndex: row.hunkIndex });
		}
	}

	return output;
}

function renderDiffSpacerLine(width: number): string {
	const safeWidth = Math.max(0, width);
	return safeWidth > 0 ? " ".repeat(safeWidth) : "";
}

function renderDiffStatsLine(stats: Pick<DiffStats, "added" | "removed">, width: number, theme: DiffTheme): string {
	return clampDiffLineToWidth(
		`${theme.fg("muted", "↳")} ${theme.fg("toolDiffAdded", `+${stats.added}`)} ${theme.fg("toolDiffRemoved", `-${stats.removed}`)}`,
		width,
	);
}

function applyLineLimit(
	rows: RenderedRow[],
	width: number,
	expanded: boolean,
	maxCollapsedLines: number,
	totalHunks: number,
	theme: DiffTheme,
): string[] {
	if (expanded) {
		return rows.map((row) => clampDiffLineToWidth(row.text, width));
	}

	const limit = Math.max(1, maxCollapsedLines);
	if (rows.length <= limit) {
		return rows.map((row) => clampDiffLineToWidth(row.text, width));
	}

	const shown = rows.slice(0, limit);
	const remaining = rows.length - shown.length;
	const visibleHunks = new Set(
		shown
			.map((row) => row.hunkIndex)
			.filter((hunkIndex): hunkIndex is number => typeof hunkIndex === "number" && hunkIndex > 0),
	);
	const hiddenHunks = Math.max(0, totalHunks - visibleHunks.size);
	const hintText = buildCollapsedDiffHintText(
		{
			remainingLines: remaining,
			hiddenHunks,
		},
		width,
		DIFF_WIDTH_OPS,
	);

	return [
		...shown.map((row) => clampDiffLineToWidth(row.text, width)),
		renderDiffSpacerLine(width),
		clampDiffLineToWidth(theme.fg("muted", hintText), width),
	];
}

function collectDiffStats(entries: ParsedDiffEntry[], fallbackHunks = 0, fallbackFiles = 0): DiffStats {
	const stats: DiffStats = {
		added: 0,
		removed: 0,
		context: 0,
		hunks: fallbackHunks,
		files: fallbackFiles,
		lines: entries.length,
	};

	const hunkIndexes = new Set<number>();
	let explicitFileCount = 0;

	for (const entry of entries) {
		if (entry.kind === "line") {
			if (entry.lineKind === "add") {
				stats.added++;
			} else if (entry.lineKind === "remove") {
				stats.removed++;
			} else {
				stats.context++;
			}
			if (entry.hunkIndex > 0) {
				hunkIndexes.add(entry.hunkIndex);
			}
			continue;
		}

		if (entry.kind === "hunk" && entry.hunkIndex > 0) {
			hunkIndexes.add(entry.hunkIndex);
		}
		if (entry.kind === "file") {
			explicitFileCount++;
		}
	}

	if (hunkIndexes.size > 0) {
		stats.hunks = Math.max(stats.hunks, hunkIndexes.size);
	}
	if (explicitFileCount > 0) {
		stats.files = Math.max(stats.files, explicitFileCount);
	} else if (entries.length > 0) {
		stats.files = Math.max(stats.files, 1);
	}
	if (stats.hunks === 0 && entries.some((entry) => entry.kind === "line")) {
		stats.hunks = 1;
	}

	return stats;
}

function safeGetDiff(details: unknown): string {
	if (!details || typeof details !== "object") {
		return "";
	}
	const typed = details as Partial<EditToolDetails>;
	return typeof typed.diff === "string" ? typed.diff : "";
}

export function renderEditDiffResult(
	details: unknown,
	options: DiffRenderOptions,
	config: SyntaxHighlightConfig,
	theme: DiffTheme,
	fallbackText: string,
): Component {
	const diffText = safeGetDiff(details);
	if (!diffText.trim()) {
		if (!fallbackText.trim()) {
			return new Text(theme.fg("muted", "↳ edit completed (no diff payload)"), 0, 0);
		}
		return new Text(theme.fg("toolOutput", fallbackText), 0, 0);
	}

	let parsed: ParsedDiff;
	try {
		parsed = parseDiff(diffText);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return new Text(theme.fg("warning", `↳ unable to render diff: ${message}`), 0, 0);
	}

	if (parsed.entries.length === 0) {
		return new Text(theme.fg("muted", "↳ no diff data"), 0, 0);
	}

	const splitRows = buildSplitRows(parsed.entries);
	const forceUnifiedAutoMode = shouldRenderAutoEditDiffAsUnified(parsed.entries, splitRows, config);
	const showHashlineAnchors = options.expanded === true
		&& parsed.entries.some((entry) => entry.kind === "line" && !!entry.hashlineAnchorContent);
	const lineNumberWidth = getLineNumberWidth(parsed.entries, showHashlineAnchors);
	const palette = resolveDiffPalette(theme);
	const containerBgAnsi = resolveContainerBackgroundAnsi(theme);
	const language = resolveLanguageFromPath(options.filePath);
	const highlightLine = createCodeLineHighlighter(language, {
		previousContent: options.previousContent,
		nextContent: options.nextContent,
	});
	const wordWrap = config.diffWordWrap;

	let cachedWidth: number | undefined;
	let cachedExpanded: boolean | undefined;
	let cachedMode: DiffPresentationMode | undefined;
	let cachedLines: string[] | undefined;

	return {
		render(width: number): string[] {
			const safeWidth = normalizeDiffRenderWidth(width);
			const mode: DiffPresentationMode = forceUnifiedAutoMode
				? "unified"
				: resolveDiffPresentationMode(config, canRenderSplitLayout(safeWidth));
			if (
				cachedLines
				&& cachedWidth === safeWidth
				&& cachedExpanded === options.expanded
				&& cachedMode === mode
			) {
				return cachedLines;
			}

			const inlineHighlights = buildInlineHighlightMap(splitRows);
			const bodyRows = mode === "split"
				? renderSplit(
					splitRows,
					safeWidth,
					theme,
					lineNumberWidth,
					inlineHighlights,
					palette,
					highlightLine,
					containerBgAnsi,
					wordWrap,
					showHashlineAnchors,
				)
				: renderUnified(
					parsed.entries,
					safeWidth,
					theme,
					lineNumberWidth,
					inlineHighlights,
					palette,
					highlightLine,
					containerBgAnsi,
					wordWrap,
					showHashlineAnchors,
				);
			const bodyWithLimit = applyLineLimit(
				bodyRows,
				safeWidth,
				options.expanded,
				config.diffCollapsedLines,
				parsed.stats.hunks,
				theme,
			);
			cachedLines = clampDiffLinesToWidth([
				renderDiffStatsLine(parsed.stats, safeWidth, theme),
				...bodyWithLimit,
			], safeWidth);
			cachedWidth = safeWidth;
			cachedExpanded = options.expanded;
			cachedMode = mode;
			return cachedLines;
		},
		invalidate() {
			cachedWidth = undefined;
			cachedExpanded = undefined;
			cachedMode = undefined;
			cachedLines = undefined;
		},
	};
}

interface WriteDiffData {
	entries: ParsedDiffEntry[];
	splitRows: SplitDiffRow[];
	inlineHighlights: WeakMap<DiffLineEntry, DiffSpan[]>;
	lineNumberWidth: number;
	stats: DiffStats;
	hunkCount: number;
}

function buildWriteDiffData(entries: ParsedDiffEntry[]): WriteDiffData {
	const splitRows = buildSplitRows(entries);
	const inlineHighlights = buildInlineHighlightMap(splitRows);
	const lineNumberWidth = getLineNumberWidth(entries);
	const hunkCount = entries.length > 0 ? 1 : 0;
	const stats = collectDiffStats(entries, hunkCount, 1);
	return {
		entries,
		splitRows,
		inlineHighlights,
		lineNumberWidth,
		stats,
		hunkCount,
	};
}

function renderWriteOverwriteGuardRows(
	guard: WriteOverwriteGuard,
	width: number,
	theme: DiffTheme,
): string[] {
	if (width <= 0) {
		return [""];
	}
	return [
		clampDiffLineToWidth(
			stabilizeBackgroundResets(theme.fg("warning", buildWriteOverwriteGuardText(guard, width))),
			width,
		),
	];
}

export function renderWriteDiffResult(
	content: string | undefined,
	options: DiffRenderOptions,
	config: SyntaxHighlightConfig,
	theme: DiffTheme,
	fallbackText: string,
): Component {
	if (typeof content !== "string") {
		if (!fallbackText.trim()) {
			return new Text(theme.fg("muted", "↳ write completed"), 0, 0);
		}
		return new Text(theme.fg("toolOutput", fallbackText), 0, 0);
	}

	const filePath = options.filePath?.trim() || "(unknown path)";
	const lines = splitWriteContentLines(content);
	const previousLines = typeof options.previousContent === "string"
		? splitWriteContentLines(options.previousContent)
		: [];
	const hasComparablePrevious = options.fileExistedBeforeWrite === true && typeof options.previousContent === "string";
	const overwriteGuard = hasComparablePrevious
		? resolveWriteOverwriteGuard(previousLines, lines)
		: undefined;
	const palette = resolveDiffPalette(theme);
	const containerBgAnsi = resolveContainerBackgroundAnsi(theme);
	const language = resolveLanguageFromPath(filePath);
	const highlightLine = createCodeLineHighlighter(language, {
		previousContent: options.previousContent,
		nextContent: content,
	});
	const wordWrap = config.diffWordWrap;

	let detailedData: WriteDiffData | undefined;
	let cachedWidth: number | undefined;
	let cachedExpanded: boolean | undefined;
	let cachedMode: DiffPresentationMode | undefined;
	let cachedLines: string[] | undefined;

	function getDetailedData(): WriteDiffData {
		if (detailedData) {
			return detailedData;
		}
		const entries = hasComparablePrevious
			? buildWriteOverwriteEntries(previousLines, lines)
			: buildWriteEntries(lines);
		detailedData = buildWriteDiffData(entries);
		return detailedData;
	}

	return {
		render(width: number): string[] {
			const safeWidth = normalizeDiffRenderWidth(width);
			const resolvedMode = resolveDiffPresentationMode(config, canRenderSplitLayout(safeWidth));
			const mode: DiffPresentationMode = hasComparablePrevious
				? resolvedMode
				: resolvedMode === "split"
					? "unified"
					: resolvedMode;
			if (
				cachedLines
				&& cachedWidth === safeWidth
				&& cachedExpanded === options.expanded
				&& cachedMode === mode
			) {
				return cachedLines;
			}

			if (overwriteGuard) {
				cachedLines = clampDiffLinesToWidth(
					renderWriteOverwriteGuardRows(overwriteGuard, safeWidth, theme),
					safeWidth,
				);
				cachedWidth = safeWidth;
				cachedExpanded = options.expanded;
				cachedMode = mode;
				return cachedLines;
			}

			const data = getDetailedData();
			const bodyRows: RenderedRow[] = data.entries.length === 0
				? [{ text: theme.fg("muted", "(empty file)"), hunkIndex: null }]
				: mode === "split"
					? renderSplit(
						data.splitRows,
						safeWidth,
						theme,
						data.lineNumberWidth,
						data.inlineHighlights,
						palette,
						highlightLine,
						containerBgAnsi,
						wordWrap,
						false,
					)
					: renderUnified(
						data.entries,
						safeWidth,
						theme,
						data.lineNumberWidth,
						data.inlineHighlights,
						palette,
						highlightLine,
						containerBgAnsi,
						wordWrap,
						false,
					);

			const bodyWithLimit = applyLineLimit(
				bodyRows,
				safeWidth,
				options.expanded,
				config.diffCollapsedLines,
				data.hunkCount,
				theme,
			);
			cachedLines = clampDiffLinesToWidth([
				renderDiffStatsLine(data.stats, safeWidth, theme),
				...bodyWithLimit,
			], safeWidth);
			cachedWidth = safeWidth;
			cachedExpanded = options.expanded;
			cachedMode = mode;
			return cachedLines;
		},
		invalidate() {
			cachedWidth = undefined;
			cachedExpanded = undefined;
			cachedMode = undefined;
			cachedLines = undefined;
		},
	};
}
