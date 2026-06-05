import { Text } from "@earendil-works/pi-tui";

import { ASK_QUESTION_FREE_FORM_LABEL } from "./constants.ts";
import type { AskQuestionDetails, AskQuestionParamsInput, OptionWithDesc } from "./types.ts";

interface ThemeLike {
	fg(name: string, text: string): string;
	bold(text: string): string;
}

interface ToolResultLike {
	content: Array<{ type: string; text?: string }>;
	details?: unknown;
}

interface RenderAskQuestionCallArgs {
	args: AskQuestionParamsInput;
	theme: ThemeLike;
}

interface RenderAskQuestionResultArgs {
	result: ToolResultLike;
	theme: ThemeLike;
}

export function renderAskQuestionCall({ args, theme }: RenderAskQuestionCallArgs) {
	let text = theme.fg("toolTitle", theme.bold("ask-question ")) + theme.fg("muted", args.question);
	const opts = Array.isArray(args.options) ? args.options : [];
	if (opts.length) {
		const labels = opts.map((o: OptionWithDesc) =>
			o.isRecommended ? `${o.label} (recommended)` : o.label,
		);
		const numbered = [...labels, ASK_QUESTION_FREE_FORM_LABEL].map((o, i) => `${i + 1}. ${o}`);
		text += `\n${theme.fg("dim", `  Options: ${numbered.join(", ")}`)}`;
	}
	return new Text(text, 0, 0);
}

export function renderAskQuestionResult({ result, theme }: RenderAskQuestionResultArgs) {
	const details = result.details as AskQuestionDetails | undefined;
	if (!details) {
		const text = result.content[0];
		return new Text(text?.type === "text" ? (text.text ?? "") : "", 0, 0);
	}

	if (details.answer === null) {
		return new Text(theme.fg("warning", "Cancelled"), 0, 0);
	}

	if (details.wasCustom) {
		return new Text(
			theme.fg("success", "✓ ") + theme.fg("muted", "(wrote) ") + theme.fg("accent", details.answer),
			0,
			0,
		);
	}
	const idx = details.options.indexOf(details.answer) + 1;
	const display = idx > 0 ? `${idx}. ${details.answer}` : details.answer;
	return new Text(theme.fg("success", "✓ ") + theme.fg("accent", display), 0, 0);
}
