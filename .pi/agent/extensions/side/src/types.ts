import type {
	AssistantMessage,
	ModelThinkingLevel,
	Usage,
} from "@earendil-works/pi-ai";

export type SideStatus = "success" | "error" | "aborted";

export interface SideModelMetadata {
	provider: string;
	id: string;
	api?: string;
}

export interface SideBranchMetadata {
	leafIdAtSnapshot?: string | null;
}

export interface SideErrorDetails {
	name?: string;
	message: string;
}

export interface SideTurnEntry {
	schemaVersion: 1;
	kind: "turn";
	chatId: string;
	turnIndex: number;
	status: SideStatus;
	userText: string;
	requestedAt: string;
	startedAt: string;
	completedAt: string;
	cwd: string;
	branch: SideBranchMetadata;
	model: SideModelMetadata | null;
	thinkingLevel: ModelThinkingLevel;
	answerText: string;
	assistantMessage?: AssistantMessage;
	stopReason?: string;
	usage?: Usage;
	error?: SideErrorDetails;
}

export interface SideActiveEntry {
	schemaVersion: 1;
	kind: "active";
	activeChatId: string | null;
	changedAt: string;
	cwd: string;
	branch: SideBranchMetadata;
}

export type SideEntry = SideTurnEntry | SideActiveEntry;

export interface SideStoredEvent {
	entryId: string;
	parentId?: string | null;
	timestamp: string;
	data: SideEntry;
}

export interface SideAttemptResult {
	status: SideStatus;
	completedAt: string;
	answerText: string;
	assistantMessage?: AssistantMessage;
	stopReason?: string;
	usage?: Usage;
	error?: SideErrorDetails;
}

export interface SideChat {
	chatId: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	model: SideModelMetadata | null;
	thinkingLevel: ModelThinkingLevel;
	turns: SideTurnEntry[];
	transient?: boolean;
}

export interface SideRunningTurn {
	chatId: string;
	turnIndex: number;
	userText: string;
	requestedAt: string;
	startedAt: string;
	model: SideModelMetadata | null;
	thinkingLevel: ModelThinkingLevel;
	answerText: string;
	status: "running";
}
