import { clamp, compareCursor, firstNonBlank, lineLength } from "./buffer.ts";
import type { CursorPosition, TextRange } from "./types.ts";

type DelimiterPair = { open: string; close: string };

const PAIRS: Record<string, DelimiterPair> = {
	"(": { open: "(", close: ")" },
	")": { open: "(", close: ")" },
	b: { open: "(", close: ")" },
	"[": { open: "[", close: "]" },
	"]": { open: "[", close: "]" },
	"{": { open: "{", close: "}" },
	"}": { open: "{", close: "}" },
	B: { open: "{", close: "}" },
};

function isKeyword(char: string | undefined): boolean {
	return char !== undefined && /[A-Za-z0-9_]/.test(char);
}

function isWhitespace(char: string | undefined): boolean {
	return char === undefined || /\s/.test(char);
}

function offsetFromPosition(lines: string[], position: CursorPosition): number {
	let offset = 0;
	for (let line = 0; line < position.line; line++) offset += (lines[line]?.length ?? 0) + 1;
	return offset + position.col;
}

function positionFromOffset(text: string, offset: number): CursorPosition {
	const before = text.slice(0, Math.max(0, offset));
	const parts = before.split("\n");
	return { line: parts.length - 1, col: parts[parts.length - 1]?.length ?? 0 };
}

export function resolveWordObject(
	lines: string[],
	cursor: CursorPosition,
	around: boolean,
	wordClass: "word" | "WORD",
	count = 1,
): TextRange | undefined {
	const line = lines[cursor.line] ?? "";
	if (!line) return undefined;
	let start = clamp(cursor.col, 0, Math.max(0, line.length - 1));
	if (isWhitespace(line[start])) {
		while (start < line.length && isWhitespace(line[start])) start++;
		if (start >= line.length) return undefined;
	}

	const belongs = wordClass === "WORD"
		? (char: string | undefined) => !isWhitespace(char)
		: isKeyword;

	if (!belongs(line[start])) return undefined;
	let end = start;
	while (start > 0 && belongs(line[start - 1])) start--;
	while (end < line.length && belongs(line[end])) end++;

	for (let index = 1; index < count; index++) {
		let next = end;
		while (next < line.length && isWhitespace(line[next])) next++;
		if (next >= line.length || !belongs(line[next])) break;
		while (next < line.length && belongs(line[next])) next++;
		end = next;
	}

	if (around) {
		if (end < line.length) {
			while (end < line.length && isWhitespace(line[end])) end++;
		} else {
			while (start > 0 && isWhitespace(line[start - 1])) start--;
		}
	}

	return { start: { line: cursor.line, col: start }, end: { line: cursor.line, col: end } };
}

export function resolveQuoteObject(
	lines: string[],
	cursor: CursorPosition,
	quote: string,
	around: boolean,
): TextRange | undefined {
	const line = lines[cursor.line] ?? "";
	const col = clamp(cursor.col, 0, line.length);
	let open = -1;
	for (let index = col; index >= 0; index--) {
		if (line[index] === quote && line[index - 1] !== "\\") {
			open = index;
			break;
		}
	}
	if (open === -1) return undefined;
	let close = -1;
	for (let index = open + 1; index < line.length; index++) {
		if (line[index] === quote && line[index - 1] !== "\\") {
			close = index;
			break;
		}
	}
	if (close === -1 || col > close) return undefined;
	return around
		? { start: { line: cursor.line, col: open }, end: { line: cursor.line, col: close + 1 } }
		: { start: { line: cursor.line, col: open + 1 }, end: { line: cursor.line, col: close } };
}

export function resolveDelimitedObject(
	lines: string[],
	cursor: CursorPosition,
	key: string,
	around: boolean,
): TextRange | undefined {
	const pair = PAIRS[key];
	if (!pair) return undefined;
	const text = lines.join("\n");
	const cursorOffset = offsetFromPosition(lines, cursor);
	let depth = 0;
	let openOffset = -1;
	for (let index = cursorOffset; index >= 0; index--) {
		const char = text[index];
		if (char === pair.close) depth++;
		else if (char === pair.open) {
			if (depth === 0) {
				openOffset = index;
				break;
			}
			depth--;
		}
	}
	if (openOffset === -1) return undefined;
	depth = 0;
	let closeOffset = -1;
	for (let index = openOffset + 1; index < text.length; index++) {
		const char = text[index];
		if (char === pair.open) depth++;
		else if (char === pair.close) {
			if (depth === 0) {
				closeOffset = index;
				break;
			}
			depth--;
		}
	}
	if (closeOffset === -1 || cursorOffset > closeOffset) return undefined;
	return around
		? { start: positionFromOffset(text, openOffset), end: positionFromOffset(text, closeOffset + 1) }
		: { start: positionFromOffset(text, openOffset + 1), end: positionFromOffset(text, closeOffset) };
}

export function resolveLineTextObject(lines: string[], cursor: CursorPosition): TextRange {
	return {
		start: { line: cursor.line, col: firstNonBlank(lines[cursor.line] ?? "") },
		end: { line: cursor.line, col: lineLength(lines, cursor.line) },
	};
}

export function rangeIsEmpty(range: TextRange): boolean {
	return compareCursor(range.start, range.end) === 0;
}
