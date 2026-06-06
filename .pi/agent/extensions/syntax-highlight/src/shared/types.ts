export const DIFF_VIEW_MODES = ["auto", "split", "unified"] as const;

export type DiffViewMode = (typeof DIFF_VIEW_MODES)[number];

export const OWNED_TOOL_NAMES = ["bash", "edit", "write"] as const;
export type OwnedToolName = (typeof OWNED_TOOL_NAMES)[number];

export type ToolOverrideOwnership = Record<OwnedToolName, boolean>;

export interface SyntaxHighlightConfig {
	registerToolOverrides: ToolOverrideOwnership;
	diffViewMode: DiffViewMode;
	diffCollapsedLines: number;
	diffWordWrap: boolean;
}

export const DEFAULT_SYNTAX_HIGHLIGHT_CONFIG: SyntaxHighlightConfig = {
	registerToolOverrides: {
		bash: true,
		edit: true,
		write: true,
	},
	diffViewMode: "auto",
	diffCollapsedLines: 24,
	diffWordWrap: true,
};

export interface ConfigLoadResult {
	config: SyntaxHighlightConfig;
	error?: string;
}

export interface ConfigSaveResult {
	success: boolean;
	error?: string;
}
