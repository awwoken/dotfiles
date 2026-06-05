import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

import { ASK_QUESTION_FREE_FORM_LABEL } from "./constants.ts";
import type { AskQuestionParamsInput, AskQuestionResult, DisplayOption } from "./types.ts";

interface ShowAskQuestionDialogArgs {
	params: AskQuestionParamsInput;
	ctx: ExtensionContext;
}

export async function showAskQuestionDialog({ params, ctx }: ShowAskQuestionDialogArgs) {
	const allOptions: DisplayOption[] = [...params.options, { label: ASK_QUESTION_FREE_FORM_LABEL, isOther: true }];

	return ctx.ui.custom<AskQuestionResult | null>((...args) => {
		const [tui, theme, , done] = args;
		let optionIndex = 0;
		let editMode = false;
		let cachedLines: string[] | undefined;

		const editorTheme: EditorTheme = {
			borderColor: (s) => theme.fg("accent", s),
			selectList: {
				selectedPrefix: (t) => theme.fg("accent", t),
				selectedText: (t) => theme.fg("accent", t),
				description: (t) => theme.fg("muted", t),
				scrollInfo: (t) => theme.fg("dim", t),
				noMatch: (t) => theme.fg("warning", t),
			},
		};
		const editor = new Editor(tui, editorTheme);

		editor.onSubmit = (value) => {
			const trimmed = value.trim();
			if (trimmed) {
				done({ answer: trimmed, wasCustom: true });
			} else {
				editMode = false;
				editor.setText("");
				refresh();
			}
		};

		function refresh() {
			cachedLines = undefined;
			tui.requestRender();
		}

		function handleInput(data: string) {
			if (editMode) {
				if (matchesKey(data, Key.escape)) {
					editMode = false;
					editor.setText("");
					refresh();
					return;
				}
				editor.handleInput(data);
				refresh();
				return;
			}

			if (matchesKey(data, Key.up) || data === "k") {
				optionIndex = Math.max(0, optionIndex - 1);
				refresh();
				return;
			}
			if (matchesKey(data, Key.down) || data === "j") {
				optionIndex = Math.min(allOptions.length - 1, optionIndex + 1);
				refresh();
				return;
			}

			if (matchesKey(data, Key.enter)) {
				const selected = allOptions[optionIndex];
				if (selected.isOther) {
					editMode = true;
					refresh();
				} else {
					done({ answer: selected.label, wasCustom: false, index: optionIndex + 1 });
				}
				return;
			}

			if (matchesKey(data, Key.escape)) {
				done(null);
			}
		}

		function render(width: number): string[] {
			if (cachedLines) return cachedLines;

			const lines: string[] = [];
			const wrapWidth = Math.max(1, width);
			const add = (s: string) => lines.push(...wrapTextWithAnsi(s, wrapWidth));
			const addIndented = (prefix: string, text: string, continuationPrefix = prefix) => {
				const contentWidth = Math.max(
					1,
					width - Math.max(visibleWidth(prefix), visibleWidth(continuationPrefix)),
				);
				const wrapped = wrapTextWithAnsi(text, contentWidth);
				for (let i = 0; i < wrapped.length; i++) {
					lines.push((i === 0 ? prefix : continuationPrefix) + wrapped[i]);
				}
			};

			add(theme.fg("accent", "─".repeat(width)));
			addIndented(" ", theme.fg("text", params.question));
			lines.push("");

			for (let i = 0; i < allOptions.length; i++) {
				const opt = allOptions[i];
				const selected = i === optionIndex;
				const isOther = opt.isOther === true;
				const prefix = selected ? theme.fg("accent", "> ") : "  ";
				const continuationPrefix = "  ";
				const label = `${i + 1}. ${opt.label}`;
				const recommendationBadge = opt.isRecommended
					? ` ${theme.fg("success", "(recommended)")}`
					: "";

				if (isOther && editMode) {
					addIndented(prefix, theme.fg("accent", `${label} ✎`), continuationPrefix);
				} else if (selected) {
					addIndented(prefix, theme.fg("accent", label) + recommendationBadge, continuationPrefix);
				} else {
					addIndented(prefix, theme.fg("text", label) + recommendationBadge);
				}

				if (opt.description) {
					addIndented("     ", theme.fg("muted", opt.description));
				}

				if (i < allOptions.length - 1) {
					lines.push("");
				}
			}

			if (editMode) {
				lines.push("");
				add(theme.fg("muted", " Your answer:"));
				for (const line of editor.render(width - 2)) {
					add(` ${line}`);
				}
			}

			lines.push("");
			if (editMode) {
				add(theme.fg("dim", " Enter to submit • Esc to go back"));
			} else {
				add(theme.fg("dim", " ↑↓/jk navigate • Enter to select • Esc to cancel"));
			}
			add(theme.fg("accent", "─".repeat(width)));

			cachedLines = lines;
			return lines;
		}

		return {
			render,
			invalidate: () => {
				cachedLines = undefined;
			},
			handleInput,
		};
	});
}
