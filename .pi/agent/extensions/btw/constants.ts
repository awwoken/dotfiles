export const BTW_COMMAND = "btw";
export const ALSO_COMMAND = "also";
export const UNBTW_COMMAND = "unbtw";
export const ABOUT_COMMAND = "about";

export const BTW_CUSTOM_TYPE = "btw";
export const BTW_SCHEMA_VERSION = 1;

export const BTW_WIDGET_ID = "btw-active-chat";
export const DEFAULT_BTW_TOGGLE_SHORTCUT = "ctrl+shift+b";

export const BTW_TITLE = "💭 btw";

export const SIDE_CHANNEL_SYSTEM_INSTRUCTION = [
	"This is an answer-only side-channel request.",
	"Use the main conversation context and the active btw side-chat transcript to answer the user's instruction.",
	"Do not claim to have changed files, tools, session state, or the main agent's work.",
	"Do not continue or take over the main agent task.",
	"Keep the answer concise unless the user explicitly asks for detail.",
].join("\n");
