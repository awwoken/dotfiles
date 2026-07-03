import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type {
	Model,
	ModelThinkingLevel,
	ThinkingLevel,
} from "@earendil-works/pi-ai";
import { randomUUID } from "node:crypto";

import {
	ABOUT_COMMAND,
	ALSO_COMMAND,
	SIDE_COMMAND,
	UNSIDE_COMMAND,
} from "./constants.ts";
import { loadSideConfig } from "./config.ts";
import { appendSideEntry } from "./entries.ts";
import { buildSidePayload } from "./prompt.ts";
import { SideState } from "./state.ts";
import { runSideStream } from "./stream.ts";
import { showAbout, updateSideWidget } from "./ui.ts";
import type {
	SideActiveEntry,
	SideAttemptResult,
	SideModelMetadata,
	SideTurnEntry,
} from "./types.ts";

interface ActiveRun {
	chatId: string;
	turnIndex: number;
	userText: string;
	requestedAt: string;
	startedAt: string;
	cwd: string;
	leafIdAtSnapshot: string | null;
	model: SideModelMetadata | null;
	thinkingLevel: ModelThinkingLevel;
	abortController: AbortController;
	abortDisposition: "keep-active" | "deactivate";
	ensureActiveAfterPersist: boolean;
	done: Promise<void>;
}

function modelMetadata(
	model: Model<any> | undefined,
): SideModelMetadata | null {
	if (!model) return null;
	return {
		provider: model.provider,
		id: model.id,
		api: model.api,
	};
}

function streamReasoningLevel(
	thinkingLevel: ModelThinkingLevel,
): ThinkingLevel | undefined {
	return thinkingLevel === "off" ? undefined : thinkingLevel;
}

function immediateError(message: string): SideAttemptResult {
	return {
		status: "error",
		completedAt: new Date().toISOString(),
		answerText: "",
		error: { message },
	};
}

function requireInteractiveUi(
	ctx: ExtensionCommandContext,
	command: string,
): boolean {
	if (ctx.hasUI) return true;
	ctx.ui.notify(`/${command} requires interactive UI`, "error");
	return false;
}

function appendActiveEntry(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	activeChatId: string | null,
): void {
	const data: SideActiveEntry = {
		schemaVersion: 1,
		kind: "active",
		activeChatId,
		changedAt: new Date().toISOString(),
		cwd: ctx.cwd,
		branch: { leafIdAtSnapshot: ctx.sessionManager.getLeafId() },
	};
	appendSideEntry(pi, data);
}

function buildTurnEntry(
	run: ActiveRun,
	result: SideAttemptResult,
): SideTurnEntry {
	return {
		schemaVersion: 1,
		kind: "turn",
		chatId: run.chatId,
		turnIndex: run.turnIndex,
		status: result.status,
		userText: run.userText,
		requestedAt: run.requestedAt,
		startedAt: run.startedAt,
		completedAt: result.completedAt,
		cwd: run.cwd,
		branch: { leafIdAtSnapshot: run.leafIdAtSnapshot },
		model: run.model,
		thinkingLevel: run.thinkingLevel,
		answerText: result.answerText,
		assistantMessage: result.assistantMessage,
		stopReason: result.stopReason,
		usage: result.usage,
		error: result.error,
	};
}

function resolveStoredModel(
	ctx: ExtensionCommandContext,
	model: SideModelMetadata | null,
): Model<any> | undefined {
	if (!model) return undefined;
	return ctx.modelRegistry.find(model.provider, model.id);
}

export default function sideExtension(pi: ExtensionAPI) {
	const config = loadSideConfig();
	const state = new SideState();
	let activeRun: ActiveRun | null = null;

	function render(ctx: ExtensionCommandContext): void {
		updateSideWidget(ctx, {
			chat: state.getActiveChat(),
			latestTurn: state.getLatestTurnForDisplay(),
			expanded: state.isExpanded(),
			toggleShortcut: config.toggleShortcut,
		});
	}

	async function abortActiveRun(
		ctx: ExtensionCommandContext,
		disposition: ActiveRun["abortDisposition"],
	): Promise<void> {
		const run = activeRun;
		if (!run) return;
		run.abortDisposition = disposition;
		run.abortController.abort();
		await run.done;
		render(ctx);
	}

	function startSideTurn(options: {
		ctx: ExtensionCommandContext;
		chatId: string;
		turnIndex: number;
		userText: string;
		modelMetadata: SideModelMetadata | null;
		model: Model<any> | undefined;
		thinkingLevel: ModelThinkingLevel;
		ensureActiveAfterPersist: boolean;
	}): void {
		const {
			ctx,
			chatId,
			turnIndex,
			userText,
			model,
			thinkingLevel,
			ensureActiveAfterPersist,
		} = options;
		const requestedAt = new Date().toISOString();
		const startedAt = new Date().toISOString();
		const abortController = new AbortController();
		const priorTurns = state.getSuccessfulTurns(chatId);
		const payload = buildSidePayload(ctx, userText, priorTurns);

		state.setRunningTurn({
			chatId,
			turnIndex,
			userText,
			requestedAt,
			startedAt,
			model: options.modelMetadata,
			thinkingLevel,
			answerText: "",
			status: "running",
		});
		render(ctx);

		const run: ActiveRun = {
			chatId,
			turnIndex,
			userText,
			requestedAt,
			startedAt,
			cwd: ctx.cwd,
			leafIdAtSnapshot: ctx.sessionManager.getLeafId(),
			model: options.modelMetadata,
			thinkingLevel,
			abortController,
			abortDisposition: "keep-active",
			ensureActiveAfterPersist,
			done: Promise.resolve(),
		};

		run.done = (async () => {
			const result = model
				? await runSideStream({
						ctx,
						model,
						payload,
						thinkingLevel: streamReasoningLevel(thinkingLevel),
						signal: abortController.signal,
						onAnswerText: (answerText) => {
							if (activeRun !== run) return;
							state.updateRunningAnswer(answerText);
							render(ctx);
						},
					})
				: immediateError(
						run.model
							? `Model ${run.model.provider}/${run.model.id} is unavailable or missing an API key`
							: "No active model selected",
					);

			appendSideEntry(pi, buildTurnEntry(run, result));
			if (run.abortDisposition === "deactivate") {
				appendActiveEntry(pi, ctx, null);
			} else if (
				run.ensureActiveAfterPersist ||
				state.getActiveChatId() === run.chatId
			) {
				appendActiveEntry(pi, ctx, run.chatId);
			}

			if (activeRun === run) {
				activeRun = null;
			}
			state.rebuild(ctx);
			render(ctx);
		})().catch((error) => {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`side failed: ${message}`, "error");
			if (activeRun === run) {
				activeRun = null;
				state.setRunningTurn(null);
				render(ctx);
			}
		});

		activeRun = run;
	}

	pi.on("session_start", async (_event, ctx) => {
		state.rebuild(ctx);
		updateSideWidget(ctx, {
			chat: state.getActiveChat(),
			latestTurn: state.getLatestTurnForDisplay(),
			expanded: state.isExpanded(),
			toggleShortcut: config.toggleShortcut,
		});
	});

	pi.on("session_shutdown", async () => {
		activeRun?.abortController.abort();
		activeRun = null;
	});

	pi.registerShortcut(config.toggleShortcut, {
		description: "Toggle side widget expansion",
		handler: async (ctx) => {
			if (!ctx.hasUI) return;
			state.toggleExpanded();
			updateSideWidget(ctx, {
				chat: state.getActiveChat(),
				latestTurn: state.getLatestTurnForDisplay(),
				expanded: state.isExpanded(),
				toggleShortcut: config.toggleShortcut,
			});
		},
	});

	pi.registerCommand(SIDE_COMMAND, {
		description: "Start a new active side chat",
		handler: async (args, ctx) => {
			if (!requireInteractiveUi(ctx, SIDE_COMMAND)) return;

			const userText = args.trim();
			if (!userText) {
				ctx.ui.notify("Usage: /side <message>", "warning");
				return;
			}

			if (activeRun) {
				await abortActiveRun(ctx, "deactivate");
			} else if (state.getActiveChatId()) {
				appendActiveEntry(pi, ctx, null);
				state.rebuild(ctx);
			}

			const chatId = randomUUID();
			const model = ctx.model;
			const modelMeta = modelMetadata(model);
			const thinkingLevel = pi.getThinkingLevel();
			const createdAt = new Date().toISOString();

			state.createTransientChat({
				chatId,
				userText,
				createdAt,
				model: modelMeta,
				thinkingLevel,
			});
			startSideTurn({
				ctx,
				chatId,
				turnIndex: 0,
				userText,
				modelMetadata: modelMeta,
				model,
				thinkingLevel,
				ensureActiveAfterPersist: true,
			});
		},
	});

	pi.registerCommand(ALSO_COMMAND, {
		description: "Ask a follow-up in the active side chat",
		handler: async (args, ctx) => {
			if (!requireInteractiveUi(ctx, ALSO_COMMAND)) return;

			const userText = args.trim();
			if (!userText) {
				ctx.ui.notify("Usage: /also <message>", "warning");
				return;
			}

			if (activeRun) {
				ctx.ui.notify(
					"A side response is already running. Wait for it to finish or use /side to replace it.",
					"warning",
				);
				return;
			}

			const chat = state.getActiveChat();
			if (!chat) {
				ctx.ui.notify(
					"No active side chat. Use /side <message> to start one.",
					"warning",
				);
				return;
			}

			startSideTurn({
				ctx,
				chatId: chat.chatId,
				turnIndex: state.nextTurnIndex(chat.chatId),
				userText,
				modelMetadata: chat.model,
				model: resolveStoredModel(ctx, chat.model),
				thinkingLevel: chat.thinkingLevel,
				ensureActiveAfterPersist: false,
			});
		},
	});

	pi.registerCommand(UNSIDE_COMMAND, {
		description: "Stop the active side chat",
		handler: async (_args, ctx) => {
			if (!requireInteractiveUi(ctx, UNSIDE_COMMAND)) return;

			if (!state.getActiveChat() && !activeRun) {
				ctx.ui.notify("No active side chat to stop", "warning");
				return;
			}

			if (activeRun) {
				await abortActiveRun(ctx, "deactivate");
			} else {
				appendActiveEntry(pi, ctx, null);
				state.rebuild(ctx);
			}
			state.deactivate();
			render(ctx);
		},
	});

	pi.registerCommand(ABOUT_COMMAND, {
		description: "List and activate side chats on the current branch",
		handler: async (_args, ctx) => {
			if (!requireInteractiveUi(ctx, ABOUT_COMMAND)) return;
			if (activeRun) {
				ctx.ui.notify(
					"A side response is running. Wait for it to finish or stop it with /unside before using /about.",
					"warning",
				);
				return;
			}

			const chats = state.rebuild(ctx);
			const selectedChatId = await showAbout(
				ctx,
				chats,
				state.getActiveChatId(),
			);
			if (!selectedChatId) return;

			appendActiveEntry(pi, ctx, selectedChatId);
			state.rebuild(ctx);
			render(ctx);
		},
	});
}
