import {
	buildSessionContext,
	convertToLlm,
	type ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type { Context, Message } from "@earendil-works/pi-ai";

import { SIDE_CHANNEL_SYSTEM_INSTRUCTION } from "./constants.ts";
import type { SideTurnEntry } from "./types.ts";

function transcriptBlock(turns: readonly SideTurnEntry[]): string {
	if (turns.length === 0) {
		return "<active-side-transcript>\nNo prior successful side turns.\n</active-side-transcript>";
	}

	const lines = ["<active-side-transcript>"];
	for (const turn of turns) {
		lines.push("<turn>");
		lines.push("<user>");
		lines.push(turn.userText);
		lines.push("</user>");
		lines.push("<assistant>");
		lines.push(turn.answerText);
		lines.push("</assistant>");
		lines.push("</turn>");
	}
	lines.push("</active-side-transcript>");
	return lines.join("\n");
}

export function buildWrappedInstruction(
	instruction: string,
	priorTurns: readonly SideTurnEntry[] = [],
): string {
	return [
		SIDE_CHANNEL_SYSTEM_INSTRUCTION,
		"",
		transcriptBlock(priorTurns),
		"",
		"<side-instruction>",
		instruction,
		"</side-instruction>",
	].join("\n");
}

export function buildSidePayload(
	ctx: ExtensionCommandContext,
	instruction: string,
	priorTurns: readonly SideTurnEntry[] = [],
): Context {
	const leafId = ctx.sessionManager.getLeafId();
	const sessionContext = buildSessionContext(
		ctx.sessionManager.getEntries(),
		leafId,
	);
	const messages = convertToLlm(sessionContext.messages);
	const finalMessage: Message = {
		role: "user",
		content: [
			{ type: "text", text: buildWrappedInstruction(instruction, priorTurns) },
		],
		timestamp: Date.now(),
	};

	return {
		systemPrompt: ctx.getSystemPrompt(),
		messages: [...messages, finalMessage],
	};
}
