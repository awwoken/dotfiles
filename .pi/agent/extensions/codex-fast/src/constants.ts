export const STATUS_KEY = "fast-priority";
export const SETTINGS_KEY = "pi-codex-fast";
export const PRIORITY_MODELS = [
  "openai-codex/gpt-5.4",
  "openai-codex/gpt-5.5",
] as const;
export const PRIORITY_MODEL_LABEL = PRIORITY_MODELS.join(" or ");
