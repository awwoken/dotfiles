export const SIDE_COMMAND = "side";
export const ALSO_COMMAND = "also";
export const UNSIDE_COMMAND = "unside";
export const ABOUT_COMMAND = "about";

export const SIDE_CUSTOM_TYPE = "side";
export const SIDE_SCHEMA_VERSION = 1;

export const SIDE_WIDGET_ID = "side-active-chat";
export const DEFAULT_SIDE_TOGGLE_SHORTCUT = "ctrl+shift+b";

export const SIDE_TITLE = "💭 side";

export const SIDE_CHANNEL_SYSTEM_INSTRUCTION = [
	"This is an answer-only side-channel request.",
	"Use the main conversation context and the active side chat transcript to answer the user's instruction.",
	"Do not claim to have changed files, tools, session state, or the main agent's work.",
	"Do not continue or take over the main agent task.",
	"Keep the answer concise unless the user explicitly asks for detail.",
].join("\n");
