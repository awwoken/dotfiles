import type {
	DiffLineKind,
	DiffMetaEntry,
	DiffStats,
	ParsedDiff,
	ParsedDiffEntry,
} from "./types.ts";

const CANONICAL_LINE_PATTERN = /^([+\- ])(\s*\d+)\|(.*)$/;
const HASHLINE_ANCHOR_LINE_PATTERN = /^([+\- ])(\s*\d+)#([A-Za-z0-9]+| {2}):(.*)$/;
const LEGACY_LINE_PATTERN = /^([+\- ])(\s*\d+)\s(.*)$/;
const HUNK_HEADER_PATTERN = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/;

function toParsedDiffLine(
	prefix: string,
	lineNumber: string,
	content: string,
): {
	lineKind: DiffLineKind;
	lineNumber: string;
	content: string;
} {
	const normalizedLineNumber = lineNumber.trim();
	if (prefix === "+") {
		return { lineKind: "add", lineNumber: normalizedLineNumber, content };
	}
	if (prefix === "-") {
		return { lineKind: "remove", lineNumber: normalizedLineNumber, content };
	}
	return { lineKind: "context", lineNumber: normalizedLineNumber, content };
}

function parseCanonicalDiffLine(line: string): {
	lineKind: DiffLineKind;
	lineNumber: string;
	content: string;
	hashlineAnchorContent?: string;
} | null {
	const hashlineAnchorMatch = line.match(HASHLINE_ANCHOR_LINE_PATTERN);
	if (hashlineAnchorMatch) {
		const lineNumber = hashlineAnchorMatch[2] ?? "";
		const hash = hashlineAnchorMatch[3] ?? "";
		const content = hashlineAnchorMatch[4] ?? "";
		const parsed = toParsedDiffLine(
			hashlineAnchorMatch[1] ?? " ",
			lineNumber,
			content,
		);
		return {
			...parsed,
			hashlineAnchorContent: `${lineNumber.trim()}#${hash}:${content}`,
		};
	}

	const canonicalMatch = line.match(CANONICAL_LINE_PATTERN);
	const legacyMatch = canonicalMatch ? null : line.match(LEGACY_LINE_PATTERN);
	const matched = canonicalMatch ?? legacyMatch;
	if (!matched) {
		return null;
	}

	return toParsedDiffLine(
		matched[1] ?? " ",
		matched[2] ?? "",
		matched[3] ?? "",
	);
}

function toNumber(value: string | undefined): number | null {
	if (!value) {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

function anchorCanonicalLineCursors(
	kind: DiffLineKind,
	parsedNumber: number | null,
	oldLineCursor: number | null,
	newLineCursor: number | null,
	lineNumberDelta: number,
): { oldLineCursor: number | null; newLineCursor: number | null } {
	if (parsedNumber === null) {
		return { oldLineCursor, newLineCursor };
	}

	if (kind === "add") {
		return {
			oldLineCursor,
			newLineCursor: newLineCursor ?? parsedNumber,
		};
	}

	return {
		oldLineCursor: parsedNumber,
		newLineCursor: parsedNumber + lineNumberDelta,
	};
}

function classifyMetaLine(raw: string): DiffMetaEntry["kind"] {
	if (raw.startsWith("@@")) {
		return "hunk";
	}
	if (
		raw.startsWith("diff --git")
		|| raw.startsWith("index ")
		|| raw.startsWith("--- ")
		|| raw.startsWith("+++ ")
		|| raw.startsWith("rename from ")
		|| raw.startsWith("rename to ")
		|| raw.startsWith("new file mode ")
		|| raw.startsWith("deleted file mode ")
	) {
		return "file";
	}
	return "meta";
}

function createMetaEntry(raw: string, hunkIndex: number): DiffMetaEntry {
	return {
		kind: classifyMetaLine(raw),
		raw,
		hunkIndex,
	};
}

function ensureImplicitHunk(currentHunk: number): number {
	return currentHunk > 0 ? currentHunk : 1;
}

export function parseDiff(diffText: string): ParsedDiff {
	const stats: DiffStats = {
		added: 0,
		removed: 0,
		context: 0,
		hunks: 0,
		files: 0,
		lines: 0,
	};
	const entries: ParsedDiffEntry[] = [];

	if (!diffText.trim()) {
		return { entries, stats };
	}

	let hunkIndex = 0;
	let oldLineCursor: number | null = null;
	let newLineCursor: number | null = null;
	let lineNumberDelta = 0;

	for (const rawLine of diffText.replace(/\r/g, "").split("\n")) {
		stats.lines++;

		const hunkMatch = rawLine.match(HUNK_HEADER_PATTERN);
		if (hunkMatch) {
			hunkIndex++;
			stats.hunks = Math.max(stats.hunks, hunkIndex);
			oldLineCursor = toNumber(hunkMatch[1]);
			newLineCursor = toNumber(hunkMatch[3]);
			lineNumberDelta = (newLineCursor ?? 0) - (oldLineCursor ?? 0);
			entries.push({ kind: "hunk", raw: rawLine, hunkIndex });
			continue;
		}

		if (rawLine.startsWith("diff --git ")) {
			stats.files++;
			oldLineCursor = null;
			newLineCursor = null;
			lineNumberDelta = 0;
			entries.push({ kind: "file", raw: rawLine, hunkIndex });
			continue;
		}

		if (rawLine.startsWith("--- ") || rawLine.startsWith("+++ ")) {
			oldLineCursor = null;
			newLineCursor = null;
			lineNumberDelta = 0;
		}

		const canonical = parseCanonicalDiffLine(rawLine);
		if (canonical) {
			hunkIndex = ensureImplicitHunk(hunkIndex);
			stats.hunks = Math.max(stats.hunks, hunkIndex);

			const parsedNumber = toNumber(canonical.lineNumber);
			const anchoredCursors = anchorCanonicalLineCursors(
				canonical.lineKind,
				parsedNumber,
				oldLineCursor,
				newLineCursor,
				lineNumberDelta,
			);
			oldLineCursor = anchoredCursors.oldLineCursor;
			newLineCursor = anchoredCursors.newLineCursor;

			const oldLineNumber = canonical.lineKind === "add" ? null : oldLineCursor;
			const newLineNumber = canonical.lineKind === "remove" ? null : newLineCursor;

			if (canonical.lineKind === "add") {
				stats.added++;
				if (newLineCursor !== null) {
					newLineCursor++;
				}
				lineNumberDelta++;
			} else if (canonical.lineKind === "remove") {
				stats.removed++;
				if (oldLineCursor !== null) {
					oldLineCursor++;
				}
				lineNumberDelta--;
			} else {
				stats.context++;
				if (oldLineCursor !== null) {
					oldLineCursor++;
				}
				if (newLineCursor !== null) {
					newLineCursor++;
				}
			}

			entries.push({
				kind: "line",
				lineKind: canonical.lineKind,
				oldLineNumber,
				newLineNumber,
				fallbackLineNumber: canonical.lineNumber,
				content: canonical.content,
				hashlineAnchorContent: canonical.hashlineAnchorContent,
				raw: rawLine,
				hunkIndex,
			});
			continue;
		}

		if (rawLine.startsWith("-") && !rawLine.startsWith("---")) {
			hunkIndex = ensureImplicitHunk(hunkIndex);
			stats.hunks = Math.max(stats.hunks, hunkIndex);
			stats.removed++;
			const oldLineNumber = oldLineCursor;
			if (oldLineCursor !== null) {
				oldLineCursor++;
			}
			lineNumberDelta--;
			entries.push({
				kind: "line",
				lineKind: "remove",
				oldLineNumber,
				newLineNumber: null,
				fallbackLineNumber: oldLineNumber !== null ? `${oldLineNumber}` : "",
				content: rawLine.slice(1),
				raw: rawLine,
				hunkIndex,
			});
			continue;
		}

		if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
			hunkIndex = ensureImplicitHunk(hunkIndex);
			stats.hunks = Math.max(stats.hunks, hunkIndex);
			stats.added++;
			const newLineNumber = newLineCursor;
			if (newLineCursor !== null) {
				newLineCursor++;
			}
			lineNumberDelta++;
			entries.push({
				kind: "line",
				lineKind: "add",
				oldLineNumber: null,
				newLineNumber,
				fallbackLineNumber: newLineNumber !== null ? `${newLineNumber}` : "",
				content: rawLine.slice(1),
				raw: rawLine,
				hunkIndex,
			});
			continue;
		}

		if (rawLine.startsWith(" ")) {
			hunkIndex = ensureImplicitHunk(hunkIndex);
			stats.hunks = Math.max(stats.hunks, hunkIndex);
			stats.context++;
			const oldLineNumber = oldLineCursor;
			const newLineNumber = newLineCursor;
			if (oldLineCursor !== null) {
				oldLineCursor++;
			}
			if (newLineCursor !== null) {
				newLineCursor++;
			}
			entries.push({
				kind: "line",
				lineKind: "context",
				oldLineNumber,
				newLineNumber,
				fallbackLineNumber: oldLineNumber !== null ? `${oldLineNumber}` : newLineNumber !== null ? `${newLineNumber}` : "",
				content: rawLine.slice(1),
				raw: rawLine,
				hunkIndex,
			});
			continue;
		}

		entries.push(createMetaEntry(rawLine, hunkIndex));
	}

	if (stats.hunks === 0 && (stats.added > 0 || stats.removed > 0 || stats.context > 0)) {
		stats.hunks = 1;
	}
	if (stats.files === 0) {
		const patchStyleFileHeaders = entries.filter(
			(entry) => entry.kind === "file" && entry.raw.startsWith("+++ "),
		).length;
		if (patchStyleFileHeaders > 0) {
			stats.files = patchStyleFileHeaders;
		} else if (stats.hunks > 0) {
			stats.files = 1;
		}
	}

	return { entries, stats };
}
