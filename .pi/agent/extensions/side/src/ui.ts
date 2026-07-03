import {
	DynamicBorder,
	getMarkdownTheme,
	type ExtensionCommandContext,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	Container,
	Markdown,
	matchesKey,
	SelectList,
	Text,
	truncateToWidth,
} from "@earendil-works/pi-tui";

import { SIDE_TITLE, SIDE_WIDGET_ID } from "./constants.ts";
import type { SideChat, SideRunningTurn, SideTurnEntry } from "./types.ts";

const WAITING_FRAMES = [".", "..", "..."];
let waitingFrameIndex = 0;
let waitingTimer: ReturnType<typeof setInterval> | null = null;
let requestWidgetRender: (() => void) | null = null;

function currentWaitingFrame(): string {
	return WAITING_FRAMES[waitingFrameIndex] ?? "...";
}

function startWaitingAnimation(): void {
	if (waitingTimer) return;
	waitingTimer = setInterval(() => {
		waitingFrameIndex = (waitingFrameIndex + 1) % WAITING_FRAMES.length;
		requestWidgetRender?.();
	}, 350);
	waitingTimer.unref?.();
}

function stopWaitingAnimation(): void {
	if (waitingTimer) {
		clearInterval(waitingTimer);
		waitingTimer = null;
	}
	waitingFrameIndex = 0;
}

function normalizePreview(value: string, maxLength = 120): string {
	const normalized = value.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, maxLength - 1)}…`;
}

function formatDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString();
}

function statusLabel(
	status: SideRunningTurn["status"] | SideTurnEntry["status"],
): string {
	switch (status) {
		case "running":
			return "running";
		case "success":
			return "success";
		case "aborted":
			return "aborted";
		case "error":
			return "error";
	}
}

function modelLabel(chat: SideChat): string {
	return chat.model ? `${chat.model.provider}/${chat.model.id}` : "no model";
}

function indentContent(value: string): string[] {
	const lines = value.trimEnd().split("\n");
	if (lines.length === 0 || (lines.length === 1 && lines[0] === ""))
		return ["  _empty_"];
	return lines.map((line) => `  ${line}`);
}

function statusColor(
	status: SideRunningTurn["status"] | SideTurnEntry["status"] | "active",
): string {
	switch (status) {
		case "success":
			return "success";
		case "error":
			return "error";
		case "aborted":
			return "warning";
		case "running":
		case "active":
			return "accent";
	}
}

function renderTopBorder(
	theme: any,
	status: SideRunningTurn["status"] | SideTurnEntry["status"] | "active",
	meta: string,
	width: number,
): string {
	const statusText = status === "active" ? "active" : statusLabel(status);
	const label = ` ${SIDE_TITLE} · ${statusText}`;
	const details = ` · ${meta} `;
	const visibleLength = 2 + label.length + details.length;
	const ruleWidth = Math.max(0, width - visibleLength);
	return truncateToWidth(
		theme.fg("borderMuted", "─".repeat(2)) +
			theme.fg(statusColor(status), label) +
			theme.fg("dim", details) +
			theme.fg("borderMuted", "─".repeat(ruleWidth)),
		width,
	);
}

function colorLines(
	theme: any,
	color: string,
	lines: string[],
	width: number,
): string[] {
	return lines.map((line) => truncateToWidth(theme.fg(color, line), width));
}

function wrapPreviewLines(
	value: string,
	maxLines: number,
	maxLineLength: number,
): string[] {
	const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
	if (words.length === 0) return ["  _empty_"];

	const lines: string[] = [];
	let current = "";
	let wordIndex = 0;

	for (; wordIndex < words.length; wordIndex++) {
		const word = words[wordIndex]!;
		const next = current ? `${current} ${word}` : word;
		if (next.length > maxLineLength && current) {
			lines.push(`  ${current}`);
			current = word;
			if (lines.length >= maxLines) break;
		} else {
			current = next;
		}
	}

	if (lines.length < maxLines && current) {
		lines.push(`  ${current}`);
	}

	if (wordIndex < words.length && lines.length > 0) {
		const last = lines[lines.length - 1]!;
		lines[lines.length - 1] = last.endsWith("…") ? last : `${last}…`;
	}

	return lines;
}

function wrapFullLines(value: string, maxLineLength: number): string[] {
	const rawLines = value.trimEnd().split("\n");
	if (rawLines.length === 0 || (rawLines.length === 1 && rawLines[0] === ""))
		return ["  _empty_"];

	const wrapped: string[] = [];
	for (const rawLine of rawLines) {
		if (!rawLine.trim()) {
			wrapped.push("  ");
			continue;
		}

		const words = rawLine.trim().split(/\s+/).filter(Boolean);
		let current = "";
		for (const word of words) {
			if (word.length > maxLineLength) {
				if (current) {
					wrapped.push(`  ${current}`);
					current = "";
				}
				for (let index = 0; index < word.length; index += maxLineLength) {
					wrapped.push(`  ${word.slice(index, index + maxLineLength)}`);
				}
				continue;
			}

			const next = current ? `${current} ${word}` : word;
			if (next.length > maxLineLength && current) {
				wrapped.push(`  ${current}`);
				current = word;
			} else {
				current = next;
			}
		}

		if (current) {
			wrapped.push(`  ${current}`);
		}
	}

	return wrapped;
}

export function renderSideWidgetLines(options: {
	chat: SideChat | null;
	latestTurn: SideRunningTurn | SideTurnEntry | null;
	expanded: boolean;
	toggleShortcut: string;
	theme?: any;
	width?: number;
	waitingFrame?: string;
}): string[] | undefined {
	const { chat, latestTurn, expanded, theme, toggleShortcut } = options;
	if (!chat) return undefined;

	const width = options.width ?? 100;
	const status = latestTurn ? latestTurn.status : "active";
	const statusText = latestTurn ? statusLabel(latestTurn.status) : "active";
	const title = normalizePreview(chat.title, expanded ? 90 : 64);
	const meta = `${modelLabel(chat)} • thinking:${chat.thinkingLevel} • ${toggleShortcut} ${expanded ? "collapse" : "expand"} • /unside stop`;

	if (!theme) {
		if (!latestTurn)
			return [
				`${SIDE_TITLE} ${statusText} — ${title}`,
				meta,
				"  waiting for first question",
				"  waiting for answer",
			];
		const waitingText = `waiting for model output${options.waitingFrame ?? "..."}`;
		const answer =
			latestTurn.answerText ||
			("error" in latestTurn && latestTurn.error
				? latestTurn.error.message
				: waitingText);
		return expanded
			? [
					`${SIDE_TITLE} ${statusText} — ${title}`,
					meta,
					"",
					...wrapFullLines(latestTurn.userText, 88),
					"",
					...wrapFullLines(answer, 88),
				]
			: [
					`${SIDE_TITLE} ${statusText} — ${title}`,
					meta,
					`  ${normalizePreview(latestTurn.userText, 120)}`,
					...wrapPreviewLines(answer, 3, 88),
				];
	}

	const lines: string[] = [renderTopBorder(theme, status, meta, width)];

	if (!latestTurn) {
		lines.push(
			...colorLines(
				theme,
				"dim",
				["  waiting for first question", "  waiting for answer"],
				width,
			),
		);
		return lines;
	}

	const waitingText = `waiting for model output${options.waitingFrame ?? "..."}`;
	const answer =
		latestTurn.answerText ||
		("error" in latestTurn && latestTurn.error
			? latestTurn.error.message
			: waitingText);

	if (!expanded) {
		lines.push(
			truncateToWidth(
				theme.fg("dim", `  ${normalizePreview(latestTurn.userText, 120)}`),
				width,
			),
		);
		const answerWidth = Math.max(40, Math.min(100, width - 4));
		lines.push(
			...colorLines(
				theme,
				"muted",
				wrapPreviewLines(answer, 3, answerWidth),
				width,
			),
		);
		return lines;
	}

	const expandedWidth = Math.max(40, width - 4);
	lines.push("");
	lines.push(
		...colorLines(
			theme,
			"dim",
			wrapFullLines(latestTurn.userText, expandedWidth),
			width,
		),
	);
	lines.push("");
	lines.push(
		...colorLines(theme, "muted", wrapFullLines(answer, expandedWidth), width),
	);
	return lines;
}

export function updateSideWidget(
	ctx: ExtensionContext,
	options: {
		chat: SideChat | null;
		latestTurn: SideRunningTurn | SideTurnEntry | null;
		expanded: boolean;
		toggleShortcut: string;
	},
): void {
	if (!ctx.hasUI) return;
	const waiting =
		options.latestTurn?.status === "running" && !options.latestTurn.answerText;
	if (waiting) {
		startWaitingAnimation();
	} else {
		stopWaitingAnimation();
	}

	if (!options.chat) {
		requestWidgetRender = null;
		ctx.ui.setWidget(SIDE_WIDGET_ID, undefined);
		return;
	}
	ctx.ui.setWidget(SIDE_WIDGET_ID, (tui, theme) => ({
		render: (width: number) => {
			requestWidgetRender = () => tui.requestRender();
			return (
				renderSideWidgetLines({
					...options,
					theme,
					width,
					waitingFrame: waiting ? currentWaitingFrame() : undefined,
				}) ?? []
			);
		},
		invalidate() {},
	}));
}

function chatMarkdown(chat: SideChat): string {
	const lines = [
		`# ${SIDE_TITLE}`,
		"",
		`- Chat: ${chat.chatId}`,
		`- Title: ${chat.title}`,
		`- Model: ${modelLabel(chat)}`,
		`- Thinking: ${chat.thinkingLevel}`,
		`- Created: ${formatDate(chat.createdAt)}`,
		`- Updated: ${formatDate(chat.updatedAt)}`,
		"",
	];

	if (chat.turns.length === 0) {
		lines.push("_No persisted turns._", "");
		return lines.join("\n");
	}

	chat.turns.forEach((turn, index) => {
		lines.push(
			`## Turn ${index + 1} — ${turn.status}`,
			"",
			`- Started: ${formatDate(turn.startedAt)}`,
			`- Completed: ${formatDate(turn.completedAt)}`,
			"",
			"### Question",
			"",
			turn.userText,
			"",
		);

		if (turn.answerText) {
			lines.push("### Answer", "", turn.answerText, "");
		}

		if (turn.error) {
			lines.push("### Error", "", turn.error.message, "");
		}
	});

	return lines.join("\n");
}

export async function showSideChatDetail(
	ctx: ExtensionCommandContext,
	chat: SideChat,
): Promise<void> {
	await ctx.ui.custom<void>((_tui, theme, _keybindings, done) => {
		const markdown = chatMarkdown(chat);
		return {
			render(width: number) {
				const container = new Container();
				const border = new DynamicBorder((text: string) =>
					theme.fg("accent", text),
				);
				container.addChild(border);
				container.addChild(new Markdown(markdown, 1, 0, getMarkdownTheme()));
				container.addChild(new Text(theme.fg("dim", "Enter/Esc close"), 1, 0));
				container.addChild(border);
				return container.render(width);
			},
			invalidate() {},
			handleInput(data: string) {
				if (matchesKey(data, "enter") || matchesKey(data, "escape")) {
					done();
				}
			},
		};
	});
}

export async function showAbout(
	ctx: ExtensionCommandContext,
	chats: SideChat[],
	activeChatId: string | null,
): Promise<string | null> {
	if (chats.length === 0) {
		ctx.ui.notify("No side chats on the current branch", "info");
		return null;
	}

	const selectedId = await ctx.ui.custom<string | null>(
		(tui, theme, _keybindings, done) => {
			const items = chats.map((chat) => {
				const latest = chat.turns[chat.turns.length - 1];
				const answerOrError =
					latest?.error?.message ?? latest?.answerText ?? "";
				const activeMarker = chat.chatId === activeChatId ? "* " : "";
				return {
					value: chat.chatId,
					label: `${activeMarker}${formatDate(chat.createdAt)} — ${normalizePreview(chat.title, 72)}`,
					description: `${modelLabel(chat)} • turns:${chat.turns.length} • ${normalizePreview(answerOrError, 100)}`,
				};
			});

			const container = new Container();
			container.addChild(
				new DynamicBorder((text: string) => theme.fg("accent", text)),
			);
			container.addChild(
				new Text(theme.fg("accent", theme.bold(`${SIDE_TITLE} chats`)), 1, 0),
			);

			const selectList = new SelectList(items, Math.min(items.length, 12), {
				selectedPrefix: (text: string) => theme.fg("accent", text),
				selectedText: (text: string) => theme.fg("accent", text),
				description: (text: string) => theme.fg("muted", text),
				scrollInfo: (text: string) => theme.fg("dim", text),
				noMatch: (text: string) => theme.fg("warning", text),
			});
			selectList.onSelect = (item) => done(item.value);
			selectList.onCancel = () => done(null);

			container.addChild(selectList);
			container.addChild(
				new Text(
					theme.fg("dim", "↑↓ navigate • enter view/activate • esc cancel"),
					1,
					0,
				),
			);
			container.addChild(
				new DynamicBorder((text: string) => theme.fg("accent", text)),
			);

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					selectList.handleInput(data);
					tui.requestRender();
				},
			};
		},
	);

	if (!selectedId) return null;
	const selected = chats.find((chat) => chat.chatId === selectedId);
	if (!selected) return null;
	await showSideChatDetail(ctx, selected);
	return selected.chatId;
}
