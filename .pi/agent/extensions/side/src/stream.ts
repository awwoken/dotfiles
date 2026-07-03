import { streamSimple } from "@earendil-works/pi-ai";
import type {
	AssistantMessage,
	Context,
	Model,
	ThinkingLevel,
} from "@earendil-works/pi-ai";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import type { SideAttemptResult, SideErrorDetails } from "./types.ts";

interface RunSideStreamOptions {
	ctx: ExtensionCommandContext;
	model: Model<any>;
	payload: Context;
	thinkingLevel?: ThinkingLevel;
	signal: AbortSignal;
	onAnswerText: (answerText: string) => void;
}

export function getErrorDetails(error: unknown): SideErrorDetails {
	if (error instanceof Error) {
		return { name: error.name, message: error.message };
	}
	return { message: String(error) };
}

export function extractAssistantText(
	message: AssistantMessage | undefined,
): string {
	if (!message) return "";
	return message.content
		.filter(
			(content): content is { type: "text"; text: string } =>
				content.type === "text",
		)
		.map((content) => content.text)
		.join("\n");
}

function recomputeAnswerText(textByIndex: Map<number, string>): string {
	return [...textByIndex.entries()]
		.sort(([a], [b]) => a - b)
		.map(([, text]) => text)
		.filter((text) => text.length > 0)
		.join("\n");
}

function resultFromAssistantMessage(
	message: AssistantMessage,
	fallbackAnswerText: string,
	status: "success" | "error" | "aborted",
	error?: SideErrorDetails,
): SideAttemptResult {
	const answerText = extractAssistantText(message) || fallbackAnswerText;
	return {
		status,
		completedAt: new Date().toISOString(),
		answerText,
		assistantMessage: message,
		stopReason: message.stopReason,
		usage: message.usage,
		error,
	};
}

export async function runSideStream(
	options: RunSideStreamOptions,
): Promise<SideAttemptResult> {
	const { ctx, model, payload, thinkingLevel, signal, onAnswerText } = options;
	const textByIndex = new Map<number, string>();
	let answerText = "";

	try {
		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok) {
			return {
				status: "error",
				completedAt: new Date().toISOString(),
				answerText: "",
				error: { message: auth.error },
			};
		}

		const eventStream = streamSimple(model, payload, {
			apiKey: auth.apiKey,
			headers: auth.headers,
			reasoning: thinkingLevel,
			signal,
		});

		for await (const event of eventStream) {
			if (event.type === "text_start") {
				textByIndex.set(event.contentIndex, "");
			} else if (event.type === "text_delta") {
				textByIndex.set(
					event.contentIndex,
					(textByIndex.get(event.contentIndex) ?? "") + event.delta,
				);
				answerText = recomputeAnswerText(textByIndex);
				onAnswerText(answerText);
			} else if (event.type === "text_end") {
				textByIndex.set(event.contentIndex, event.content);
				answerText = recomputeAnswerText(textByIndex);
				onAnswerText(answerText);
			} else if (event.type === "done") {
				return resultFromAssistantMessage(event.message, answerText, "success");
			} else if (event.type === "error") {
				return resultFromAssistantMessage(
					event.error,
					answerText,
					event.reason === "aborted" ? "aborted" : "error",
					{
						message:
							event.error.errorMessage ??
							(event.reason === "aborted" ? "Aborted" : "Model request failed"),
					},
				);
			}
		}

		return {
			status: signal.aborted ? "aborted" : "error",
			completedAt: new Date().toISOString(),
			answerText,
			error: {
				message: signal.aborted
					? "Aborted"
					: "Model stream ended without a final message",
			},
		};
	} catch (error) {
		const details = getErrorDetails(error);
		return {
			status: signal.aborted ? "aborted" : "error",
			completedAt: new Date().toISOString(),
			answerText,
			error:
				signal.aborted && !details.message ? { message: "Aborted" } : details,
		};
	}
}
