import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { executeAskQuestion } from "./tool.ts";
import { AskQuestionParams } from "./schema.ts";
import { renderAskQuestionCall, renderAskQuestionResult } from "./render.ts";

export default function askQuestion(pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask-question",
		label: "Ask Question",
		description:
			"Ask the user a question and let them pick from suggested options or type a free-form answer. Use when you need user input to proceed.",
		promptSnippet: "Ask the user one question with suggested options; the user can always type a free-form answer.",
		promptGuidelines: [
			"Use ask-question when a real user decision, preference, or confirmation is needed before proceeding.",
			"ask-question always gives the user a free-form answer path in addition to the suggested options.",
			"Always mark exactly one suggested option with isRecommended: true, choosing the option you would recommend based on the available context.",
			"Do not use ask-question for facts that can be discovered from files, commands, local context, or documentation.",
		],
		parameters: AskQuestionParams,
		executionMode: "sequential",
		execute: (...args) => {
			const [, params, , , ctx] = args;
			if (ctx.hasUI && params.options.length > 0) {
				pi.events.emit("user_attention_needed", {
					kind: "question",
					title: "Pi asks",
					body: params.question,
				});
			}
			return executeAskQuestion({ params, ctx });
		},
		renderCall: (args, theme) => renderAskQuestionCall({ args, theme }),
		renderResult: (...args) => {
			const [result, , theme] = args;
			return renderAskQuestionResult({ result, theme });
		},
	});
}
