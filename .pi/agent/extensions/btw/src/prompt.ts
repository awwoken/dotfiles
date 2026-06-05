import { buildSessionContext, convertToLlm, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { Context, Message } from "@earendil-works/pi-ai";

import { SIDE_CHANNEL_SYSTEM_INSTRUCTION } from "./constants.ts";
import type { BtwTurnEntry } from "./types.ts";

function transcriptBlock(turns: readonly BtwTurnEntry[]): string {
	if (turns.length === 0) {
		return "<active-btw-transcript>\nNo prior successful btw turns.\n</active-btw-transcript>";
	}

	const lines = ["<active-btw-transcript>"];
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
	lines.push("</active-btw-transcript>");
	return lines.join("\n");
}

export function buildWrappedInstruction(instruction: string, priorTurns: readonly BtwTurnEntry[] = []): string {
	return [
		SIDE_CHANNEL_SYSTEM_INSTRUCTION,
		"",
		transcriptBlock(priorTurns),
		"",
		"<btw-instruction>",
		instruction,
		"</btw-instruction>",
	].join("\n");
}

export function buildBtwPayload(ctx: ExtensionCommandContext, instruction: string, priorTurns: readonly BtwTurnEntry[] = []): Context {
	const leafId = ctx.sessionManager.getLeafId();
	const sessionContext = buildSessionContext(ctx.sessionManager.getEntries(), leafId);
	const messages = convertToLlm(sessionContext.messages);
	const finalMessage: Message = {
		role: "user",
		content: [{ type: "text", text: buildWrappedInstruction(instruction, priorTurns) }],
		timestamp: Date.now(),
	};

	return {
		systemPrompt: ctx.getSystemPrompt(),
		messages: [...messages, finalMessage],
	};
}
