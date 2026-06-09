import { clamp, clampCursor, firstNonBlank, lineLength } from "./buffer.ts";
import type { CursorPosition } from "./types.ts";

function charAt(lines: string[], cursor: CursorPosition): string | undefined {
	return lines[cursor.line]?.[cursor.col];
}

function isWhitespace(char: string | undefined): boolean {
	return char === undefined || /\s/.test(char);
}

function isKeyword(char: string | undefined): boolean {
	return char !== undefined && /[A-Za-z0-9_]/.test(char);
}

function charClass(char: string | undefined): "space" | "keyword" | "punct" {
	if (isWhitespace(char)) return "space";
	return isKeyword(char) ? "keyword" : "punct";
}

function nextPosition(lines: string[], cursor: CursorPosition): CursorPosition | undefined {
	const line = lines[cursor.line] ?? "";
	if (cursor.col < line.length) return { line: cursor.line, col: cursor.col + 1 };
	if (cursor.line < lines.length - 1) return { line: cursor.line + 1, col: 0 };
	return undefined;
}

function previousPosition(lines: string[], cursor: CursorPosition): CursorPosition | undefined {
	if (cursor.col > 0) return { line: cursor.line, col: cursor.col - 1 };
	if (cursor.line > 0) return { line: cursor.line - 1, col: lineLength(lines, cursor.line - 1) };
	return undefined;
}

export function moveLeft(lines: string[], cursor: CursorPosition, count: number): CursorPosition {
	let next = clampCursor(lines, cursor);
	for (let index = 0; index < count; index++) {
		const previous = previousPosition(lines, next);
		if (!previous) break;
		next = previous;
	}
	return clampCursor(lines, next);
}

export function moveRight(lines: string[], cursor: CursorPosition, count: number): CursorPosition {
	let next = clampCursor(lines, cursor);
	for (let index = 0; index < count; index++) {
		const after = nextPosition(lines, next);
		if (!after) break;
		next = after;
	}
	return clampCursor(lines, next);
}

export function moveLineDelta(lines: string[], cursor: CursorPosition, delta: number): CursorPosition {
	const line = clamp(cursor.line + delta, 0, lines.length - 1);
	return { line, col: clamp(cursor.col, 0, lineLength(lines, line)) };
}

export function moveLineStart(cursor: CursorPosition): CursorPosition {
	return { line: cursor.line, col: 0 };
}

export function moveLineEnd(lines: string[], cursor: CursorPosition): CursorPosition {
	return { line: cursor.line, col: lineLength(lines, cursor.line) };
}

export function moveFirstNonBlank(lines: string[], cursor: CursorPosition): CursorPosition {
	return { line: cursor.line, col: firstNonBlank(lines[cursor.line] ?? "") };
}

export function moveBufferStart(): CursorPosition {
	return { line: 0, col: 0 };
}

export function moveBufferEnd(lines: string[]): CursorPosition {
	const line = Math.max(0, lines.length - 1);
	return { line, col: lineLength(lines, line) };
}

export function moveToLine(lines: string[], lineNumberOneBased: number): CursorPosition {
	const line = clamp(lineNumberOneBased - 1, 0, lines.length - 1);
	return { line, col: firstNonBlank(lines[line] ?? "") };
}

export function moveWordForward(lines: string[], cursor: CursorPosition, count: number): CursorPosition {
	let current = clampCursor(lines, cursor);
	for (let step = 0; step < count; step++) {
		let next = nextPosition(lines, current);
		if (!next) return current;

		while (next && charClass(charAt(lines, next)) === "space") {
			next = nextPosition(lines, next);
		}
		if (!next) return moveBufferEnd(lines);

		const targetClass = charClass(charAt(lines, next));
		while (next) {
			const previous = previousPosition(lines, next);
			if (!previous || charClass(charAt(lines, previous)) !== targetClass) break;
			next = nextPosition(lines, next);
			if (!next) return moveBufferEnd(lines);
		}
		current = next;
	}
	return clampCursor(lines, current);
}

export function moveWordBackward(lines: string[], cursor: CursorPosition, count: number): CursorPosition {
	let current = clampCursor(lines, cursor);
	for (let step = 0; step < count; step++) {
		let next = previousPosition(lines, current);
		if (!next) return current;

		while (next && charClass(charAt(lines, next)) === "space") {
			next = previousPosition(lines, next);
		}
		if (!next) return moveBufferStart();

		const targetClass = charClass(charAt(lines, next));
		while (true) {
			const previous = previousPosition(lines, next);
			if (!previous || charClass(charAt(lines, previous)) !== targetClass) break;
			next = previous;
		}
		current = next;
	}
	return clampCursor(lines, current);
}

export function moveWordEnd(lines: string[], cursor: CursorPosition, count: number): CursorPosition {
	let current = clampCursor(lines, cursor);
	for (let step = 0; step < count; step++) {
		let next = nextPosition(lines, current);
		if (!next) return current;

		while (next && charClass(charAt(lines, next)) === "space") {
			next = nextPosition(lines, next);
		}
		if (!next) return moveBufferEnd(lines);

		const targetClass = charClass(charAt(lines, next));
		let candidate = next;
		while (next && charClass(charAt(lines, next)) === targetClass) {
			candidate = next;
			next = nextPosition(lines, next);
		}
		current = candidate;
	}
	return clampCursor(lines, current);
}
