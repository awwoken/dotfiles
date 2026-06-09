import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { VimPromptEditor } from "./vim-editor.ts";

type EditorFactory = NonNullable<ReturnType<ExtensionContext["ui"]["getEditorComponent"]>>;

function parseArgs(args: unknown): string[] {
	if (Array.isArray(args)) return args.filter((arg): arg is string => typeof arg === "string");
	if (typeof args === "string") return args.trim() ? args.trim().split(/\s+/) : [];
	return [];
}

export default function vimPromptExtension(pi: ExtensionAPI): void {
	let enabled = true;
	let previousEditorFactory: EditorFactory | undefined;
	let installedFactory: EditorFactory | undefined;
	const editors = new Set<VimPromptEditor>();

	const resetEditors = (options: { forceVisible?: boolean } = {}): void => {
		for (const editor of editors) editor.resetTerminalCursorStyle(options);
		editors.clear();
	};

	const install = (ctx: ExtensionContext): void => {
		if (!enabled) {
			ctx.ui.setStatus("vim-prompt", "vim off");
			return;
		}

		if (!installedFactory) {
			installedFactory = (tui, theme, keybindings) => {
				const editor = new VimPromptEditor(tui, theme, keybindings);
				editors.add(editor);
				return editor;
			};
		}

		if (ctx.ui.getEditorComponent() !== installedFactory) {
			previousEditorFactory = ctx.ui.getEditorComponent();
			ctx.ui.setEditorComponent(installedFactory);
		}
		ctx.ui.setStatus("vim-prompt", "vim");
	};

	const disable = (ctx: ExtensionContext): void => {
		enabled = false;
		resetEditors();
		if (installedFactory && ctx.ui.getEditorComponent() === installedFactory) {
			ctx.ui.setEditorComponent(previousEditorFactory);
		}
		ctx.ui.setStatus("vim-prompt", "vim off");
	};

	const enable = (ctx: ExtensionContext): void => {
		enabled = true;
		install(ctx);
	};

	pi.registerCommand("vim-prompt", {
		description: "Toggle the local Vim prompt editor on/off",
		handler: async (args, ctx) => {
			const [action = "toggle"] = parseArgs(args).map((arg) => arg.toLowerCase());
			if (action === "status") {
				ctx.ui.notify(`vim-prompt ${enabled ? "enabled" : "disabled"}`, "info");
				return;
			}
			if (!["toggle", "on", "off"].includes(action)) {
				ctx.ui.notify("Usage: /vim-prompt [on|off|toggle|status]", "warning");
				return;
			}

			if (action === "on" || (action === "toggle" && !enabled)) enable(ctx);
			else disable(ctx);

			ctx.ui.notify(`vim-prompt ${enabled ? "enabled" : "disabled"}`, "info");
		},
	});

	pi.on("session_start", (_event, ctx) => {
		install(ctx);
	});

	pi.on("resources_discover", (_event, ctx) => {
		install(ctx);
	});

	pi.on("agent_end", (_event, ctx) => {
		install(ctx);
	});

	pi.on("session_shutdown", (event) => {
		resetEditors({ forceVisible: event.reason === "quit" });
		previousEditorFactory = undefined;
		installedFactory = undefined;
	});
}
