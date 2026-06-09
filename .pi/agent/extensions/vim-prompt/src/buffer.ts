import type { CursorPosition, TextRange } from "./types.ts";

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function normalizeLines(lines: string[]): string[] {
	return lines.length > 0 ? lines : [""];
}

export function cloneLines(lines: string[]): string[] {
	return normalizeLines([...lines]);
}

export function textFromLines(lines: string[]): string {
	return normalizeLines(lines).join("\n");
}

export function lineLength(lines: string[], line: number): number {
	return lines[line]?.length ?? 0;
}

export function clampCursor(lines: string[], cursor: CursorPosition): CursorPosition {
	const normalized = normalizeLines(lines);
	const line = clamp(cursor.line, 0, normalized.length - 1);
	return { line, col: clamp(cursor.col, 0, lineLength(normalized, line)) };
}

export function compareCursor(left: CursorPosition, right: CursorPosition): number {
	if (left.line !== right.line) return left.line - right.line;
	return left.col - right.col;
}

export function orderedRange(anchor: CursorPosition, cursor: CursorPosition): TextRange {
	return compareCursor(anchor, cursor) <= 0
		? { start: anchor, end: cursor }
		: { start: cursor, end: anchor };
}

export function firstNonBlank(text: string): number {
	const match = /\S/.exec(text);
	return match ? match.index : 0;
}

export function lastLineCursor(lines: string[]): CursorPosition {
	const normalized = normalizeLines(lines);
	const line = normalized.length - 1;
	return { line, col: normalized[line]?.length ?? 0 };
}

export function lineRange(anchorLine: number, cursorLine: number): { startLine: number; endLine: number } {
	return {
		startLine: Math.min(anchorLine, cursorLine),
		endLine: Math.max(anchorLine, cursorLine),
	};
}

export function selectedLineText(lines: string[], startLine: number, endLine: number): string {
	return normalizeLines(lines).slice(startLine, endLine + 1).join("\n") + "\n";
}

export function deleteLines(
	lines: string[],
	startLine: number,
	endLine: number,
	replacement: string[] = [],
): { lines: string[]; cursor: CursorPosition } {
	const next = cloneLines(lines);
	next.splice(startLine, endLine - startLine + 1, ...replacement);
	const normalized = normalizeLines(next);
	const line = clamp(startLine, 0, normalized.length - 1);
	return { lines: normalized, cursor: { line, col: 0 } };
}

export function deleteRange(lines: string[], range: TextRange): {
	lines: string[];
	cursor: CursorPosition;
	deleted: string;
} {
	const normalized = cloneLines(lines);
	const start = clampCursor(normalized, range.start);
	const end = clampCursor(normalized, range.end);

	if (compareCursor(start, end) === 0) {
		return { lines: normalized, cursor: start, deleted: "" };
	}

	if (start.line === end.line) {
		const line = normalized[start.line] ?? "";
		const deleted = line.slice(start.col, end.col);
		normalized[start.line] = line.slice(0, start.col) + line.slice(end.col);
		return { lines: normalized, cursor: start, deleted };
	}

	const first = normalized[start.line] ?? "";
	const last = normalized[end.line] ?? "";
	const deletedParts = [first.slice(start.col)];
	for (let line = start.line + 1; line < end.line; line++) {
		deletedParts.push(normalized[line] ?? "");
	}
	deletedParts.push(last.slice(0, end.col));

	const merged = first.slice(0, start.col) + last.slice(end.col);
	normalized.splice(start.line, end.line - start.line + 1, merged);
	return {
		lines: normalizeLines(normalized),
		cursor: clampCursor(normalized, start),
		deleted: deletedParts.join("\n"),
	};
}

export function inclusiveCharRange(lines: string[], start: CursorPosition, end: CursorPosition): TextRange {
	const ordered = orderedRange(start, end);
	const endLine = ordered.end.line;
	const maxCol = lineLength(lines, endLine);
	return {
		start: ordered.start,
		end: { line: endLine, col: clamp(ordered.end.col + 1, 0, maxCol) },
	};
}

export function insertText(lines: string[], cursor: CursorPosition, text: string): {
	lines: string[];
	cursor: CursorPosition;
} {
	const normalized = cloneLines(lines);
	const at = clampCursor(normalized, cursor);
	const insertLines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
	const current = normalized[at.line] ?? "";
	const before = current.slice(0, at.col);
	const after = current.slice(at.col);

	if (insertLines.length === 1) {
		normalized[at.line] = before + insertLines[0] + after;
		return { lines: normalized, cursor: { line: at.line, col: at.col + insertLines[0]!.length } };
	}

	const first = before + insertLines[0];
	const last = insertLines[insertLines.length - 1] + after;
	const middle = insertLines.slice(1, -1);
	normalized.splice(at.line, 1, first, ...middle, last);
	return {
		lines: normalized,
		cursor: {
			line: at.line + insertLines.length - 1,
			col: insertLines[insertLines.length - 1]!.length,
		},
	};
}
