import type { AgentToolResult, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { showAskQuestionDialog } from "./ui.ts";
import type { AskQuestionDetails, AskQuestionParamsInput } from "./types.ts";

interface ExecuteAskQuestionArgs {
	params: AskQuestionParamsInput;
	ctx: ExtensionContext;
}

export async function executeAskQuestion({
	params,
	ctx,
}: ExecuteAskQuestionArgs): Promise<AgentToolResult<AskQuestionDetails>> {
	if (!ctx.hasUI) {
		return {
			content: [{ type: "text", text: "Error: UI not available (running in non-interactive mode)" }],
			details: {
				question: params.question,
				options: params.options.map((o) => o.label),
				answer: null,
			} as AskQuestionDetails,
		};
	}

	if (params.options.length === 0) {
		return {
			content: [{ type: "text", text: "Error: No options provided" }],
			details: { question: params.question, options: [], answer: null } as AskQuestionDetails,
		};
	}

	const result = await showAskQuestionDialog({ params, ctx });
	const simpleOptions = params.options.map((o) => o.label);

	if (!result) {
		return {
			content: [{ type: "text", text: "User cancelled the selection" }],
			details: { question: params.question, options: simpleOptions, answer: null } as AskQuestionDetails,
		};
	}

	if (result.wasCustom) {
		return {
			content: [{ type: "text", text: `User wrote: ${result.answer}` }],
			details: {
				question: params.question,
				options: simpleOptions,
				answer: result.answer,
				wasCustom: true,
			} as AskQuestionDetails,
		};
	}

	return {
		content: [{ type: "text", text: `User selected: ${result.index}. ${result.answer}` }],
		details: {
			question: params.question,
			options: simpleOptions,
			answer: result.answer,
			wasCustom: false,
		} as AskQuestionDetails,
	};
}
