import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { collectCurrentBranchBtwEvents } from "./entries.ts";
import type { BtwChat, BtwModelMetadata, BtwRunningTurn, BtwTurnEntry } from "./types.ts";
import type { ModelThinkingLevel } from "@earendil-works/pi-ai";

function titleFromText(text: string): string {
	const normalized = text.replace(/\s+/g, " ").trim();
	return normalized || "Untitled btw";
}

function addTurn(chats: Map<string, BtwChat>, turn: BtwTurnEntry): void {
	let chat = chats.get(turn.chatId);
	if (!chat) {
		chat = {
			chatId: turn.chatId,
			title: titleFromText(turn.userText),
			createdAt: turn.requestedAt,
			updatedAt: turn.completedAt,
			model: turn.model,
			thinkingLevel: turn.thinkingLevel,
			turns: [],
		};
		chats.set(turn.chatId, chat);
	}

	chat.turns.push(turn);
	chat.turns.sort((a, b) => a.turnIndex - b.turnIndex || a.startedAt.localeCompare(b.startedAt));
	chat.updatedAt = turn.completedAt;
}

export class BtwState {
	private chats = new Map<string, BtwChat>();
	private activeChatId: string | null = null;
	private runningTurn: BtwRunningTurn | null = null;
	private expanded = false;

	rebuild(ctx: ExtensionContext): BtwChat[] {
		const events = collectCurrentBranchBtwEvents(ctx);
		const chats = new Map<string, BtwChat>();
		let activeChatId: string | null = null;

		for (const event of events) {
			if (event.data.kind === "turn") {
				addTurn(chats, event.data);
			} else {
				activeChatId = event.data.activeChatId;
			}
		}

		if (activeChatId && !chats.has(activeChatId)) {
			activeChatId = null;
		}

		this.chats = chats;
		this.activeChatId = activeChatId;
		this.runningTurn = null;
		return this.getChats();
	}

	getChats(): BtwChat[] {
		return [...this.chats.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	}

	getChat(chatId: string): BtwChat | null {
		return this.chats.get(chatId) ?? null;
	}

	getActiveChatId(): string | null {
		return this.activeChatId;
	}

	getActiveChat(): BtwChat | null {
		return this.activeChatId ? this.getChat(this.activeChatId) : null;
	}

	activateChat(chatId: string): void {
		this.activeChatId = chatId;
	}

	deactivate(): void {
		this.activeChatId = null;
		this.runningTurn = null;
	}

	createTransientChat(options: {
		chatId: string;
		userText: string;
		createdAt: string;
		model: BtwModelMetadata | null;
		thinkingLevel: ModelThinkingLevel;
	}): BtwChat {
		const chat: BtwChat = {
			chatId: options.chatId,
			title: titleFromText(options.userText),
			createdAt: options.createdAt,
			updatedAt: options.createdAt,
			model: options.model,
			thinkingLevel: options.thinkingLevel,
			turns: [],
			transient: true,
		};
		this.chats.set(options.chatId, chat);
		this.activeChatId = options.chatId;
		return chat;
	}

	nextTurnIndex(chatId: string): number {
		return this.getChat(chatId)?.turns.length ?? 0;
	}

	setRunningTurn(turn: BtwRunningTurn | null): void {
		this.runningTurn = turn;
	}

	updateRunningAnswer(answerText: string): void {
		if (!this.runningTurn) return;
		this.runningTurn.answerText = answerText;
	}

	getRunningTurn(): BtwRunningTurn | null {
		return this.runningTurn;
	}

	isRunning(): boolean {
		return !!this.runningTurn;
	}

	getLatestTurnForDisplay(): BtwRunningTurn | BtwTurnEntry | null {
		if (this.runningTurn && this.runningTurn.chatId === this.activeChatId) {
			return this.runningTurn;
		}

		const chat = this.getActiveChat();
		if (!chat || chat.turns.length === 0) return null;
		return chat.turns[chat.turns.length - 1] ?? null;
	}

	getSuccessfulTurns(chatId: string): BtwTurnEntry[] {
		return (this.getChat(chatId)?.turns ?? []).filter((turn) => turn.status === "success");
	}

	isExpanded(): boolean {
		return this.expanded;
	}

	toggleExpanded(): boolean {
		this.expanded = !this.expanded;
		return this.expanded;
	}
}
