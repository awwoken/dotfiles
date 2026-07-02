import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { PRIORITY_MODEL_LABEL, STATUS_KEY } from "./constants.ts";
import { currentModelName, supportsPriorityServiceTier } from "./priority.ts";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function updateFastModeStatus(
  ctx: Pick<ExtensionContext, "hasUI" | "ui" | "model">,
  enabled: boolean,
): void {
  if (!ctx.hasUI) return;
  if (!enabled) {
    ctx.ui.setStatus(STATUS_KEY, undefined);
    return;
  }

  const label = supportsPriorityServiceTier(ctx) ? "Fast" : "Fast (inactive)";
  ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("accent", label));
}

export function clearFastModeStatus(
  ctx: Pick<ExtensionContext, "hasUI" | "ui">,
): void {
  if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, undefined);
}

export function notifyFastModeState(
  ctx: Pick<ExtensionContext, "hasUI" | "ui" | "model">,
  enabled: boolean,
): void {
  if (!ctx.hasUI) return;
  if (!enabled) {
    ctx.ui.notify(
      "Fast mode disabled. Requests will use the default service tier.",
      "info",
    );
    return;
  }

  if (supportsPriorityServiceTier(ctx)) {
    ctx.ui.notify(
      `Fast mode enabled. ${PRIORITY_MODEL_LABEL} requests will send service_tier=priority.`,
      "info",
    );
    return;
  }

  const modelLabel = currentModelName(ctx) ?? "no active model";
  ctx.ui.notify(
    `Fast mode enabled, but inactive for ${modelLabel}. Switch to ${PRIORITY_MODEL_LABEL} to use it.`,
    "info",
  );
}

export function notifySettingsLoadFailure(
  ctx: Pick<ExtensionContext, "hasUI" | "ui">,
  error: unknown,
): void {
  if (!ctx.hasUI) return;
  ctx.ui.notify(
    `pi-codex-fast: failed to load settings: ${errorMessage(error)}`,
    "warning",
  );
}

export function notifySettingsWriteFailure(
  ctx: Pick<ExtensionContext, "hasUI" | "ui">,
  error: unknown,
): void {
  if (!ctx.hasUI) return;
  ctx.ui.notify(
    `pi-codex-fast: failed to write settings: ${errorMessage(error)}`,
    "warning",
  );
}
