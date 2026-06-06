import type { SyntaxHighlightConfig } from "../shared/types.ts";

export type DiffPresentationMode = "split" | "unified";

export function normalizeDiffRenderWidth(width: number): number {
	if (!Number.isFinite(width)) {
		return 0;
	}
	return Math.max(0, Math.floor(width));
}

export function resolveDiffPresentationMode(
	config: Pick<SyntaxHighlightConfig, "diffViewMode">,
	canRenderSplitLayout: boolean,
): DiffPresentationMode {
	switch (config.diffViewMode) {
		case "split":
			return canRenderSplitLayout ? "split" : "unified";
		case "unified":
			return "unified";
		case "auto":
		default:
			return canRenderSplitLayout ? "split" : "unified";
	}
}
