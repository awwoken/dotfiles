import { getLanguageFromPath, highlightCode } from "@earendil-works/pi-coding-agent";
import { sanitizeAnsiForThemedOutput } from "../utils/render.ts";
import type { CodeLineHighlighter, DiffLineEntry, DiffSide } from "./types.ts";

const MAX_FULL_FILE_HIGHLIGHT_LINES = 5_000;

function normalizeCodeWhitespace(text: string): string {
	return text.replace(/\t/g, "    ");
}

export function resolveLanguageFromPath(rawPath: string | undefined): string | undefined {
	if (!rawPath || !rawPath.trim()) {
		return undefined;
	}
	const normalizedPath = rawPath.replace(/^@/, "").trim();
	if (!normalizedPath) {
		return undefined;
	}
	try {
		return getLanguageFromPath(normalizedPath);
	} catch {
		return undefined;
	}
}

function splitHighlightContentLines(content: string): string[] {
	const normalized = normalizeCodeWhitespace(content.replace(/\r/g, ""));
	const lines = normalized.split("\n");
	if (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop();
	}
	return lines;
}

function highlightFullContent(content: string | undefined, language: string | undefined): string[] | undefined {
	if (!language || typeof content !== "string") {
		return undefined;
	}

	const lines = splitHighlightContentLines(content);
	if (lines.length > MAX_FULL_FILE_HIGHLIGHT_LINES) {
		return undefined;
	}

	try {
		return highlightCode(lines.join("\n"), language).map((line) => sanitizeAnsiForThemedOutput(line));
	} catch {
		return undefined;
	}
}

function resolveContextLineNumber(entry: DiffLineEntry, usePreviousContent: boolean, side?: DiffSide): number | null {
	if (usePreviousContent) {
		return entry.oldLineNumber ?? (entry.lineKind === "context" || side === "left" ? entry.newLineNumber : null);
	}
	return entry.newLineNumber ?? (entry.lineKind === "context" || side === "right" ? entry.oldLineNumber : null);
}

function getContextHighlightedLine(
	entry: DiffLineEntry,
	side: DiffSide | undefined,
	previousHighlightedLines: string[] | undefined,
	nextHighlightedLines: string[] | undefined,
): string | undefined {
	const preferPrevious = entry.lineKind === "remove" || side === "left";
	const preferredLines = preferPrevious ? previousHighlightedLines : nextHighlightedLines;
	const fallbackLines = preferPrevious ? nextHighlightedLines : previousHighlightedLines;
	const preferredLineNumber = resolveContextLineNumber(entry, preferPrevious, side);
	const fallbackLineNumber = resolveContextLineNumber(entry, !preferPrevious, side);

	if (preferredLines && preferredLineNumber && preferredLineNumber > 0) {
		const highlighted = preferredLines[preferredLineNumber - 1];
		if (highlighted !== undefined) {
			return highlighted;
		}
	}

	if (fallbackLines && fallbackLineNumber && fallbackLineNumber > 0) {
		const highlighted = fallbackLines[fallbackLineNumber - 1];
		if (highlighted !== undefined) {
			return highlighted;
		}
	}

	return undefined;
}

export function createCodeLineHighlighter(
	language: string | undefined,
	context: { previousContent?: string; nextContent?: string } = {},
): CodeLineHighlighter {
	const previousHighlightedLines = highlightFullContent(context.previousContent, language);
	const nextHighlightedLines = highlightFullContent(context.nextContent, language);

	const cache = new Map<string, string>();
	const highlightSingleLine = (line: string): string => {
		if (!line) {
			return line;
		}
		const cached = cache.get(line);
		if (cached !== undefined) {
			return cached;
		}

		if (!language) {
			const sanitized = sanitizeAnsiForThemedOutput(line);
			cache.set(line, sanitized);
			return sanitized;
		}

		try {
			const highlighted = highlightCode(line, language)[0] ?? line;
			const sanitized = sanitizeAnsiForThemedOutput(highlighted);
			cache.set(line, sanitized);
			return sanitized;
		} catch {
			const sanitizedFallback = sanitizeAnsiForThemedOutput(line);
			cache.set(line, sanitizedFallback);
			return sanitizedFallback;
		}
	};

	return (line, entry, side) => {
		if (entry) {
			const highlighted = getContextHighlightedLine(entry, side, previousHighlightedLines, nextHighlightedLines);
			if (highlighted !== undefined) {
				return highlighted;
			}
		}
		return highlightSingleLine(line);
	};
}
