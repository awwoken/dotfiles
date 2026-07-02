import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { PRIORITY_MODEL_LABEL } from "./constants.ts";
import { applyPriorityServiceTier } from "./priority.ts";
import { CodexFastState } from "./state.ts";

export default function codexFastExtension(pi: ExtensionAPI): void {
  const state = new CodexFastState();

  pi.registerFlag("fast", {
    description: `Start with fast mode enabled (adds service_tier=priority to ${PRIORITY_MODEL_LABEL} requests)`,
    type: "boolean",
    default: false,
  });

  pi.registerCommand("codex-fast", {
    description: `Toggle ${PRIORITY_MODEL_LABEL} priority service tier`,
    handler: async (_args, ctx) => {
      state.toggle(ctx);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    await state.reload(ctx, { startupFastMode: pi.getFlag("fast") === true });
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    state.clear(ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    state.refreshStatus(ctx);
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (!state.isEnabled()) return undefined;
    return applyPriorityServiceTier(event.payload, ctx);
  });
}
