import { CustomEditor, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { CURSOR_MARKER, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { PromptVimEngine, type VimKey } from "./engine.ts";
import { clampCursor, textFromLines } from "./buffer.ts";
import type { CursorPosition, VimPromptMode } from "./types.ts";

type CursorShape = "block" | "bar" | "underline";

type ResetTerminalCursorStyleOptions = {
	forceVisible?: boolean;
};

type EditorInternals = {
	state?: {
		lines: string[];
		cursorLine: number;
		cursorCol: number;
	};
	scrollOffset?: number;
	preferredVisualCol?: number | null;
	snappedFromCursorCol?: number | null;
	tui?: { requestRender?: () => void };
};

type EditorPrivateActions = {
	addNewLine(): void;
	submitValue(): void;
};

function cursorShapeForMode(mode: VimPromptMode): CursorShape {
	switch (mode) {
		case "insert":
			return "bar";
		case "normal":
			return "block";
		case "visual":
		case "visualLine":
			return "underline";
	}
}

function cursorShapeSequence(shape: CursorShape): string {
	switch (shape) {
		case "block":
			return "\x1b[2 q";
		case "underline":
			return "\x1b[4 q";
		case "bar":
			return "\x1b[6 q";
	}
}

function visualSelectionStyle(text: string): string {
	return `\x1b[7m${text}\x1b[0m`;
}

function stripSoftwareCursor(line: string): string {
	const markerIndex = line.indexOf(CURSOR_MARKER);
	if (markerIndex === -1) return line;

	const cursorStart = line.indexOf("\x1b[7m", markerIndex + CURSOR_MARKER.length);
	if (cursorStart === -1) return line;

	const contentStart = cursorStart + "\x1b[7m".length;
	const resetStart = line.indexOf("\x1b[0m", contentStart);
	if (resetStart === -1) return line;

	const content = line.slice(contentStart, resetStart);
	return line.slice(0, cursorStart) + content + line.slice(resetStart + "\x1b[0m".length);
}

function isDelegatedAppKey(data: string): boolean {
	return (
		matchesKey(data, "tab") ||
		matchesKey(data, "shift+enter") ||
		matchesKey(data, "ctrl+l") ||
		matchesKey(data, "ctrl+t") ||
		matchesKey(data, "shift+tab")
	);
}

function isExplicitNewLineKey(data: string): boolean {
	return (
		matchesKey(data, "shift+enter") ||
		matchesKey(data, "shift+return") ||
		data === "\n" ||
		data === "\x1b\r" ||
		data === "\x1b[13;2~" ||
		(data.charCodeAt(0) === 10 && data.length > 1) ||
		(data.length > 1 && data.includes("\x1b") && data.includes("\r"))
	);
}

function isPlainEnterKey(data: string): boolean {
	return !isExplicitNewLineKey(data) && (matchesKey(data, "enter") || matchesKey(data, "return"));
}

function isCommandEnterKey(data: string): boolean {
	return matchesKey(data, "super+enter") || matchesKey(data, "super+return");
}

function normalizeKey(data: string): VimKey | undefined {
	if (matchesKey(data, "escape") || matchesKey(data, "ctrl+[") || data === "\x1b") return "escape";
	if (matchesKey(data, "enter") || matchesKey(data, "return")) return "enter";
	if (matchesKey(data, "backspace") || data === "\x7f") return "backspace";
	if (matchesKey(data, "ctrl+c")) return "ctrl+c";
	if (matchesKey(data, "ctrl+d")) return "ctrl+d";
	if (matchesKey(data, "ctrl+g")) return "ctrl+g";
	if (matchesKey(data, "ctrl+r")) return "ctrl+r";
	if (data.length === 1) return data;
	return undefined;
}

export class VimPromptEditor extends CustomEditor {
	private readonly engine = new PromptVimEngine();
	private readonly tuiInstance: TUI;
	private readonly previousShowHardwareCursor: boolean;
	private activeCursorShape: CursorShape | undefined;
	private cursorStyleReset = false;

	constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) {
		super(tui, theme, keybindings);
		this.tuiInstance = tui;
		this.previousShowHardwareCursor = tui.getShowHardwareCursor();
		this.syncEngineFromEditor();
		this.tuiInstance.setShowHardwareCursor(true);
		this.applyCursorStyle();
	}

	getMode(): VimPromptMode {
		return this.engine.mode;
	}

	handleInput(data: string): void {
		if (this.handlePromptEnterInput(data)) {
			return;
		}

		if (this.engine.mode === "insert") {
			this.handleInsertInput(data);
			return;
		}

		if (isDelegatedAppKey(data)) {
			super.handleInput(data);
			this.syncEngineFromEditor();
			return;
		}

		const key = normalizeKey(data);
		if (!key) {
			super.handleInput(data);
			this.syncEngineFromEditor();
			return;
		}

		this.syncEngineFromEditor();
		const result = this.engine.handleKey(key);
		if (result.delegate) {
			super.handleInput(data);
			this.syncEngineFromEditor();
		} else if (result.changed) {
			this.applyEngineState();
		}
		this.applyCursorStyle();
	}

	private handlePromptEnterInput(data: string): boolean {
		if (isCommandEnterKey(data)) {
			this.submitPrompt();
			return true;
		}

		if (
			!this.isShowingAutocomplete() &&
			this.engine.searchInput === undefined &&
			this.isMultilinePrompt() &&
			isPlainEnterKey(data)
		) {
			this.addPromptLine();
			return true;
		}

		return false;
	}

	private isMultilinePrompt(): boolean {
		return this.getLines().length > 1;
	}

	private addPromptLine(): void {
		(this as unknown as EditorPrivateActions).addNewLine();
		this.syncEngineFromEditor();
		this.applyCursorStyle();
		this.requestRender();
	}

	private submitPrompt(): void {
		(this as unknown as EditorPrivateActions).submitValue();
		this.syncEngineFromEditor();
		this.applyCursorStyle();
		this.requestRender();
	}

	private handleInsertInput(data: string): void {
		const key = normalizeKey(data);
		if (key === "escape" && !this.isShowingAutocomplete()) {
			this.syncEngineFromEditor();
			this.engine.handleInsertEscape(this.getLines(), this.getCursor());
			this.applyEngineState();
			this.applyCursorStyle();
			return;
		}

		super.handleInput(data);
		this.syncEngineFromEditor();
		this.applyCursorStyle();
	}

	private syncEngineFromEditor(): void {
		this.engine.sync(this.getLines(), this.getCursor());
	}

	private textMatchesEngine(): boolean {
		return this.getText() === textFromLines(this.engine.lines);
	}

	private applyEngineState(): void {
		if (!this.textMatchesEngine()) this.setText(textFromLines(this.engine.lines));
		this.restoreCursor(this.engine.cursor);
		this.requestRender();
	}

	private requestRender(): void {
		(this as unknown as EditorInternals).tui?.requestRender?.();
	}

	private restoreCursor(cursor: CursorPosition): void {
		const internals = this as unknown as EditorInternals;
		const lines = this.getLines();
		const next = clampCursor(lines, cursor);

		if (internals.state) {
			internals.state.cursorLine = next.line;
			internals.state.cursorCol = next.col;
			internals.preferredVisualCol = null;
			internals.snappedFromCursorCol = null;
			this.requestRender();
			return;
		}

		const lastLine = lines.length - 1;
		super.handleInput("\x01");
		for (let index = 0; index < lastLine; index++) super.handleInput("\x1b[A");
		for (let index = 0; index < next.line; index++) super.handleInput("\x1b[B");
		super.handleInput("\x01");
		for (let index = 0; index < next.col; index++) super.handleInput("\x1b[C");
	}

	private applyCursorStyle(): void {
		if (this.cursorStyleReset) return;
		const shape = cursorShapeForMode(this.engine.mode);
		if (this.activeCursorShape === shape) return;
		this.activeCursorShape = shape;
		try {
			this.tuiInstance.setShowHardwareCursor(true);
			this.tuiInstance.terminal.write(cursorShapeSequence(shape));
		} catch {
			// Cursor shape support is terminal-dependent; keep modal editing functional.
		}
	}

	resetTerminalCursorStyle(options: ResetTerminalCursorStyleOptions = {}): void {
		if (this.cursorStyleReset) return;
		this.cursorStyleReset = true;
		try {
			this.tuiInstance.terminal.write(`${options.forceVisible ? "\x1b[?25h" : ""}\x1b[0 q`);
			this.tuiInstance.setShowHardwareCursor(options.forceVisible ? true : this.previousShowHardwareCursor);
		} catch {
			// Best-effort cleanup only.
		}
	}

	render(width: number): string[] {
		const lines = this.applyVisualHighlight(super.render(width).map(stripSoftwareCursor), width);
		if (lines.length === 0) return lines;

		const label = ` ${this.engine.statusParts().join(" ")} `;
		const last = lines.length - 1;
		if (visibleWidth(lines[last]!) >= label.length) {
			lines[last] = truncateToWidth(lines[last]!, width - label.length, "") + label;
		}
		return lines;
	}

	private applyVisualHighlight(lines: string[], width: number): string[] {
		const selection = this.engine.visualSelection();
		if (!selection || lines.length < 3) return lines;

		const paddingX = Math.min(this.getPaddingX(), Math.max(0, Math.floor((width - 1) / 2)));
		const contentWidth = Math.max(1, width - paddingX * 2);
		const scrollOffset = (this as unknown as EditorInternals).scrollOffset ?? 0;
		const next = [...lines];

		for (let row = 1; row < next.length - 1; row++) {
			const logicalLine = scrollOffset + row - 1;
			if (selection.kind === "line") {
				if (logicalLine < selection.startLine || logicalLine > selection.endLine) continue;
				next[row] = this.highlightRenderedContentLine(next[row]!, paddingX, contentWidth, 0, contentWidth);
				continue;
			}

			if (logicalLine < selection.start.line || logicalLine > selection.end.line) continue;
			const lineText = this.engine.lines[logicalLine] ?? "";
			const startCol = logicalLine === selection.start.line ? selection.start.col : 0;
			const endCol = logicalLine === selection.end.line ? selection.end.col : lineText.length;
			if (endCol <= startCol) continue;
			next[row] = this.highlightRenderedContentLine(next[row]!, paddingX, contentWidth, startCol, endCol);
		}

		return next;
	}

	private highlightRenderedContentLine(
		line: string,
		paddingX: number,
		contentWidth: number,
		startCol: number,
		endCol: number,
	): string {
		const markerIndex = line.indexOf(CURSOR_MARKER);
		const markerCol = markerIndex >= 0 ? Math.max(0, markerIndex - paddingX) : undefined;
		const cleanLine = markerIndex >= 0 ? line.slice(0, markerIndex) + line.slice(markerIndex + CURSOR_MARKER.length) : line;

		const prefix = cleanLine.slice(0, paddingX);
		const content = cleanLine.slice(paddingX, paddingX + contentWidth);
		const suffix = cleanLine.slice(paddingX + contentWidth);
		const start = Math.max(0, Math.min(startCol, content.length));
		const end = Math.max(start, Math.min(endCol, content.length));
		if (end <= start) return line;

		const withMarker = (text: string, offset: number): string => {
			if (markerCol === undefined) return text;
			if (markerCol < offset || markerCol > offset + text.length) return text;
			const local = markerCol - offset;
			return text.slice(0, local) + CURSOR_MARKER + text.slice(local);
		};

		const before = withMarker(content.slice(0, start), 0);
		const selected = withMarker(content.slice(start, end), start);
		const after = withMarker(content.slice(end), end);
		const markerWasInserted = markerCol === undefined || markerCol <= content.length;
		const restoredSuffix = markerWasInserted ? suffix : CURSOR_MARKER + suffix;
		return `${prefix}${before}${visualSelectionStyle(selected)}${after}${restoredSuffix}`;
	}
}
