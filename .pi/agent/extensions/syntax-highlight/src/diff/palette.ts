import { ANSI_SGR_PATTERN, toSgrParams } from "../utils/ansi.ts";
import type { DiffLineKind, DiffPalette, DiffTheme, RgbColor } from "./types.ts";

const ADD_ROW_BACKGROUND_MIX_RATIO = 0.12;
const REMOVE_ROW_BACKGROUND_MIX_RATIO = 0.12;
const ADD_INLINE_EMPHASIS_MIX_RATIO = 0.26;
const REMOVE_INLINE_EMPHASIS_MIX_RATIO = 0.26;
const ADDITION_TINT_TARGET: RgbColor = { r: 84, g: 190, b: 118 };
const DELETION_TINT_TARGET: RgbColor = { r: 232, g: 95, b: 122 };

function isFiniteSgrParam(value: number | undefined): value is number {
	return value !== undefined && Number.isFinite(value);
}

function readSgrColorSequence(params: readonly number[], startIndex: number): number[] | undefined {
	const param = params[startIndex];
	if (param !== 38 && param !== 48) {
		return undefined;
	}
	const colorMode = params[startIndex + 1];
	if (colorMode === 5) {
		const colorValue = params[startIndex + 2];
		return isFiniteSgrParam(colorValue) ? [param, colorMode, colorValue] : undefined;
	}
	if (colorMode === 2) {
		const red = params[startIndex + 2];
		const green = params[startIndex + 3];
		const blue = params[startIndex + 4];
		return isFiniteSgrParam(red) && isFiniteSgrParam(green) && isFiniteSgrParam(blue)
			? [param, colorMode, red, green, blue]
			: undefined;
	}
	return undefined;
}

function ansi256ToRgb(code: number): RgbColor {
	if (code < 0) {
		return { r: 0, g: 0, b: 0 };
	}
	if (code <= 15) {
		const base16: RgbColor[] = [
			{ r: 0, g: 0, b: 0 },
			{ r: 128, g: 0, b: 0 },
			{ r: 0, g: 128, b: 0 },
			{ r: 128, g: 128, b: 0 },
			{ r: 0, g: 0, b: 128 },
			{ r: 128, g: 0, b: 128 },
			{ r: 0, g: 128, b: 128 },
			{ r: 192, g: 192, b: 192 },
			{ r: 128, g: 128, b: 128 },
			{ r: 255, g: 0, b: 0 },
			{ r: 0, g: 255, b: 0 },
			{ r: 255, g: 255, b: 0 },
			{ r: 0, g: 0, b: 255 },
			{ r: 255, g: 0, b: 255 },
			{ r: 0, g: 255, b: 255 },
			{ r: 255, g: 255, b: 255 },
		];
		return base16[code] ?? { r: 255, g: 255, b: 255 };
	}
	if (code >= 232) {
		const value = Math.max(0, Math.min(255, 8 + (code - 232) * 10));
		return { r: value, g: value, b: value };
	}

	const cube = code - 16;
	const levels = [0, 95, 135, 175, 215, 255];
	const blue = cube % 6;
	const green = Math.floor(cube / 6) % 6;
	const red = Math.floor(cube / 36) % 6;
	return {
		r: levels[red] ?? 0,
		g: levels[green] ?? 0,
		b: levels[blue] ?? 0,
	};
}

function parseAnsiColorCode(ansi: string | undefined): RgbColor | null {
	if (!ansi) {
		return null;
	}
	const rgbMatch = /\x1b\[(?:3|4)8;2;(\d{1,3});(\d{1,3});(\d{1,3})m/.exec(ansi);
	if (rgbMatch) {
		const r = Number.parseInt(rgbMatch[1] ?? "0", 10);
		const g = Number.parseInt(rgbMatch[2] ?? "0", 10);
		const b = Number.parseInt(rgbMatch[3] ?? "0", 10);
		if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
			return {
				r: Math.max(0, Math.min(255, r)),
				g: Math.max(0, Math.min(255, g)),
				b: Math.max(0, Math.min(255, b)),
			};
		}
	}

	const bitMatch = /\x1b\[(?:3|4)8;5;(\d{1,3})m/.exec(ansi);
	if (bitMatch) {
		const code = Number.parseInt(bitMatch[1] ?? "0", 10);
		if (Number.isFinite(code)) {
			return ansi256ToRgb(code);
		}
	}

	return null;
}

function rgbToBgAnsi(color: RgbColor): string {
	const r = Math.max(0, Math.min(255, Math.round(color.r)));
	const g = Math.max(0, Math.min(255, Math.round(color.g)));
	const b = Math.max(0, Math.min(255, Math.round(color.b)));
	return `\x1b[48;2;${r};${g};${b}m`;
}

function mixRgb(base: RgbColor, tint: RgbColor, ratio: number): RgbColor {
	const clamped = Math.max(0, Math.min(1, ratio));
	return {
		r: base.r * (1 - clamped) + tint.r * clamped,
		g: base.g * (1 - clamped) + tint.g * clamped,
		b: base.b * (1 - clamped) + tint.b * clamped,
	};
}

function extractThemeBackgroundAnsi(text: string): string | undefined {
	if (!text || !text.includes("\x1b[")) {
		return undefined;
	}

	ANSI_SGR_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = ANSI_SGR_PATTERN.exec(text)) !== null) {
		const parsed = toSgrParams(match[1] ?? "");
		for (let index = 0; index < parsed.length; index += 1) {
			const param = parsed[index] ?? 0;
			if ((param >= 40 && param <= 47) || (param >= 100 && param <= 107)) {
				return `\x1b[${param}m`;
			}

			const colorSequence = readSgrColorSequence(parsed, index);
			if (colorSequence?.[0] === 48) {
				return `\x1b[${colorSequence.join(";")}m`;
			}
			if (colorSequence) {
				index += colorSequence.length - 1;
			}
		}
	}

	return undefined;
}

function readThemeAnsi(theme: DiffTheme, kind: "fg" | "bg", slot: string): string | undefined {
	try {
		if (kind === "fg" && typeof theme.getFgAnsi === "function") {
			return theme.getFgAnsi(slot);
		}
		if (kind === "bg") {
			if (typeof theme.getBgAnsi === "function") {
				return theme.getBgAnsi(slot);
			}
			if (typeof theme.bg === "function") {
				return extractThemeBackgroundAnsi(theme.bg(slot, " "));
			}
		}
	} catch {
		return undefined;
	}
	return undefined;
}

export function resolveContainerBackgroundAnsi(theme: DiffTheme): string | undefined {
	return readThemeAnsi(theme, "bg", "toolSuccessBg")
		?? readThemeAnsi(theme, "bg", "toolPendingBg")
		?? readThemeAnsi(theme, "bg", "toolErrorBg")
		?? readThemeAnsi(theme, "bg", "userMessageBg");
}

export function resolveDiffPalette(theme: DiffTheme): DiffPalette {
	const baseBg = parseAnsiColorCode(readThemeAnsi(theme, "bg", "toolSuccessBg"))
		?? parseAnsiColorCode(readThemeAnsi(theme, "bg", "toolPendingBg"))
		?? parseAnsiColorCode(readThemeAnsi(theme, "bg", "userMessageBg"))
		?? { r: 32, g: 35, b: 42 };
	const addFg = parseAnsiColorCode(readThemeAnsi(theme, "fg", "toolDiffAdded")) ?? { r: 88, g: 173, b: 88 };
	const removeFg = parseAnsiColorCode(readThemeAnsi(theme, "fg", "toolDiffRemoved")) ?? { r: 196, g: 98, b: 98 };
	const addTint = mixRgb(addFg, ADDITION_TINT_TARGET, 0.35);
	const removeTint = mixRgb(removeFg, DELETION_TINT_TARGET, 0.65);

	const addRowBg = mixRgb(baseBg, addTint, ADD_ROW_BACKGROUND_MIX_RATIO);
	const removeRowBg = mixRgb(baseBg, removeTint, REMOVE_ROW_BACKGROUND_MIX_RATIO);
	const addEmphasisBg = mixRgb(baseBg, addTint, ADD_INLINE_EMPHASIS_MIX_RATIO);
	const removeEmphasisBg = mixRgb(baseBg, removeTint, REMOVE_INLINE_EMPHASIS_MIX_RATIO);

	return {
		addRowBgAnsi: rgbToBgAnsi(addRowBg),
		removeRowBgAnsi: rgbToBgAnsi(removeRowBg),
		addEmphasisBgAnsi: rgbToBgAnsi(addEmphasisBg),
		removeEmphasisBgAnsi: rgbToBgAnsi(removeEmphasisBg),
	};
}

export function getLineRowBackground(kind: DiffLineKind, palette: DiffPalette): string | undefined {
	if (kind === "add") {
		return palette.addRowBgAnsi;
	}
	if (kind === "remove") {
		return palette.removeRowBgAnsi;
	}
	return undefined;
}

export function getLineEmphasisBackground(kind: DiffLineKind, palette: DiffPalette): string | undefined {
	if (kind === "add") {
		return palette.addEmphasisBgAnsi;
	}
	if (kind === "remove") {
		return palette.removeEmphasisBgAnsi;
	}
	return undefined;
}
