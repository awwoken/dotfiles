import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { normalizeDiffRenderWidth } from "./presentation.ts";
import type { ParsedDiffEntry } from "./types.ts";

export interface WriteOverwriteGuard {
	previousLineCount: number;
	nextLineCount: number;
}

type WriteDiffOperationKind = "context" | "remove" | "add";

interface WriteDiffOperation {
	kind: WriteDiffOperationKind;
	content: string;
}

const MAX_WRITE_OVERWRITE_DIFF_LINES = 4000;
const MAX_WRITE_OVERWRITE_DIFF_MATRIX_CELLS = 1_000_000;

export function splitWriteContentLines(content: string): string[] {
	if (!content) {
		return [];
	}

	const normalized = content.replace(/\r/g, "");
	const lines = normalized.split("\n");
	if (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop();
	}
	return lines;
}

function buildWriteDiffOperations(oldLines: string[], newLines: string[]): WriteDiffOperation[] {
	const oldLength = oldLines.length;
	const newLength = newLines.length;
	const table: number[][] = Array.from({ length: oldLength + 1 }, () => Array<number>(newLength + 1).fill(0));

	for (let oldIndex = 1; oldIndex <= oldLength; oldIndex++) {
		for (let newIndex = 1; newIndex <= newLength; newIndex++) {
			if ((oldLines[oldIndex - 1] ?? "") === (newLines[newIndex - 1] ?? "")) {
				table[oldIndex]![newIndex] = (table[oldIndex - 1]?.[newIndex - 1] ?? 0) + 1;
				continue;
			}
			const top = table[oldIndex - 1]?.[newIndex] ?? 0;
			const left = table[oldIndex]?.[newIndex - 1] ?? 0;
			table[oldIndex]![newIndex] = Math.max(top, left);
		}
	}

	const operations: WriteDiffOperation[] = [];
	let oldCursor = oldLength;
	let newCursor = newLength;

	while (oldCursor > 0 || newCursor > 0) {
		const oldLine = oldCursor > 0 ? (oldLines[oldCursor - 1] ?? "") : undefined;
		const newLine = newCursor > 0 ? (newLines[newCursor - 1] ?? "") : undefined;

		if (oldCursor > 0 && newCursor > 0 && oldLine === newLine) {
			operations.push({ kind: "context", content: oldLine ?? "" });
			oldCursor--;
			newCursor--;
			continue;
		}

		const top = oldCursor > 0 ? (table[oldCursor - 1]?.[newCursor] ?? 0) : -1;
		const left = newCursor > 0 ? (table[oldCursor]?.[newCursor - 1] ?? 0) : -1;

		if (newCursor > 0 && left >= top) {
			operations.push({ kind: "add", content: newLine ?? "" });
			newCursor--;
			continue;
		}

		if (oldCursor > 0) {
			operations.push({ kind: "remove", content: oldLine ?? "" });
			oldCursor--;
		}
	}

	operations.reverse();
	return operations;
}

export function buildWriteEntries(lines: string[]): ParsedDiffEntry[] {
	return lines.map((line, index) => ({
		kind: "line",
		lineKind: "add",
		oldLineNumber: null,
		newLineNumber: index + 1,
		fallbackLineNumber: `${index + 1}`,
		content: line,
		raw: `+${line}`,
		hunkIndex: 1,
	}));
}

export function buildWriteOverwriteEntries(oldLines: string[], newLines: string[]): ParsedDiffEntry[] {
	const operations = buildWriteDiffOperations(oldLines, newLines);
	const entries: ParsedDiffEntry[] = [];
	let oldLineNumber = 1;
	let newLineNumber = 1;

	for (const operation of operations) {
		if (operation.kind === "context") {
			entries.push({
				kind: "line",
				lineKind: "context",
				oldLineNumber,
				newLineNumber,
				fallbackLineNumber: `${newLineNumber}`,
				content: operation.content,
				raw: ` ${operation.content}`,
				hunkIndex: 1,
			});
			oldLineNumber++;
			newLineNumber++;
			continue;
		}

		if (operation.kind === "remove") {
			entries.push({
				kind: "line",
				lineKind: "remove",
				oldLineNumber,
				newLineNumber: null,
				fallbackLineNumber: `${oldLineNumber}`,
				content: operation.content,
				raw: `-${operation.content}`,
				hunkIndex: 1,
			});
			oldLineNumber++;
			continue;
		}

		entries.push({
			kind: "line",
			lineKind: "add",
			oldLineNumber: null,
			newLineNumber,
			fallbackLineNumber: `${newLineNumber}`,
			content: operation.content,
			raw: `+${operation.content}`,
			hunkIndex: 1,
		});
		newLineNumber++;
	}

	return entries;
}

export function resolveWriteOverwriteGuard(
	previousLines: string[],
	nextLines: string[],
): WriteOverwriteGuard | undefined {
	const previousLineCount = previousLines.length;
	const nextLineCount = nextLines.length;
	if (previousLineCount > MAX_WRITE_OVERWRITE_DIFF_LINES || nextLineCount > MAX_WRITE_OVERWRITE_DIFF_LINES) {
		return { previousLineCount, nextLineCount };
	}
	if (previousLineCount === 0 || nextLineCount === 0) {
		return undefined;
	}
	return previousLineCount * nextLineCount > MAX_WRITE_OVERWRITE_DIFF_MATRIX_CELLS
		? { previousLineCount, nextLineCount }
		: undefined;
}

export function buildWriteOverwriteGuardText(guard: WriteOverwriteGuard, width: number): string {
	const safeWidth = normalizeDiffRenderWidth(width);
	if (safeWidth === 0) {
		return "";
	}

	const candidates = [
		`↳ overwrite diff omitted (${guard.previousLineCount} → ${guard.nextLineCount} lines)`,
		`↳ overwrite diff omitted (${guard.previousLineCount}→${guard.nextLineCount})`,
		"↳ overwrite diff omitted",
		"diff omitted",
		"…",
	];
	for (const candidate of candidates) {
		if (visibleWidth(candidate) <= safeWidth) {
			return candidate;
		}
	}
	return truncateToWidth(candidates[candidates.length - 1] ?? "", safeWidth, "");
}
