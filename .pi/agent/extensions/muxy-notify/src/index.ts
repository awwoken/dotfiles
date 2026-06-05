import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DEFAULT_ATTENTION_TITLE, DEFAULT_COMPLETION_TITLE } from "./constants";
import { loadMuxyConfig, sendMuxyNotification } from "./muxy";
import { getCompletionBody, isUserAttentionEvent } from "./pi-events";

export default function muxyNotify(pi: ExtensionAPI): void {
  const config = loadMuxyConfig(process.env);
  if (!config) return;

  pi.events.on("user_attention_needed", (event) => {
    if (!isUserAttentionEvent(event)) return;

    void sendMuxyNotification(config, {
      title: event.title ?? DEFAULT_ATTENTION_TITLE,
      body: event.body,
    });
  });

  pi.on("agent_end", async (event) => {
    await sendMuxyNotification(config, {
      title: DEFAULT_COMPLETION_TITLE,
      body: getCompletionBody(event),
    });
  });
}
