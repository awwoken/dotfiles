import type { AssistantMessage, ModelThinkingLevel, Usage } from "@earendil-works/pi-ai";

export type BtwStatus = "success" | "error" | "aborted";

export interface BtwModelMetadata {
	provider: string;
	id: string;
	api?: string;
}

export interface BtwBranchMetadata {
	leafIdAtSnapshot?: string | null;
}

export interface BtwErrorDetails {
	name?: string;
	message: string;
}

export interface BtwTurnEntry {
	schemaVersion: 1;
	kind: "turn";
	chatId: string;
	turnIndex: number;
	status: BtwStatus;
	userText: string;
	requestedAt: string;
	startedAt: string;
	completedAt: string;
	cwd: string;
	branch: BtwBranchMetadata;
	model: BtwModelMetadata | null;
	thinkingLevel: ModelThinkingLevel;
	answerText: string;
	assistantMessage?: AssistantMessage;
	stopReason?: string;
	usage?: Usage;
	error?: BtwErrorDetails;
}

export interface BtwActiveEntry {
	schemaVersion: 1;
	kind: "active";
	activeChatId: string | null;
	changedAt: string;
	cwd: string;
	branch: BtwBranchMetadata;
}

export type BtwEntry = BtwTurnEntry | BtwActiveEntry;

export interface BtwStoredEvent {
	entryId: string;
	parentId?: string | null;
	timestamp: string;
	data: BtwEntry;
}

export interface BtwAttemptResult {
	status: BtwStatus;
	completedAt: string;
	answerText: string;
	assistantMessage?: AssistantMessage;
	stopReason?: string;
	usage?: Usage;
	error?: BtwErrorDetails;
}

export interface BtwChat {
	chatId: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	model: BtwModelMetadata | null;
	thinkingLevel: ModelThinkingLevel;
	turns: BtwTurnEntry[];
	transient?: boolean;
}

export interface BtwRunningTurn {
	chatId: string;
	turnIndex: number;
	userText: string;
	requestedAt: string;
	startedAt: string;
	model: BtwModelMetadata | null;
	thinkingLevel: ModelThinkingLevel;
	answerText: string;
	status: "running";
}
