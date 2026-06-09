export type VimPromptMode = "insert" | "normal" | "visual" | "visualLine";

export type CursorPosition = {
	line: number;
	col: number;
};

export type TextRange = {
	start: CursorPosition;
	end: CursorPosition;
};

export type Register = {
	text: string;
	linewise: boolean;
};

export type EditorSnapshot = {
	lines: string[];
	cursor: CursorPosition;
};
