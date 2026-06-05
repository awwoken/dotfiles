import { DEFAULT_COMPLETION_BODY } from "./constants";
import type { AgentEndEvent, AssistantMessage, TextContentPart, UserAttentionEvent } from "./types";

export function isUserAttentionEvent(value: unknown): value is UserAttentionEvent {
  if (!value || typeof value !== "object") return false;

  const event = value as Partial<UserAttentionEvent>;
  return typeof event.kind === "string" && typeof event.body === "string";
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter((part: TextContentPart) => part.type === "text")
    .map((part: TextContentPart) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

function getLastAssistantText(messages: unknown): string | undefined {
  if (!Array.isArray(messages)) return undefined;

  const lastAssistant = [...messages]
    .reverse()
    .find((message: AssistantMessage) => message.role === "assistant");

  if (!lastAssistant) return undefined;

  const text = messageContentToText(lastAssistant.content).trim();
  return text || undefined;
}

export function getCompletionBody(event: AgentEndEvent): string {
  return getLastAssistantText(event.messages) ?? DEFAULT_COMPLETION_BODY;
}
