import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { PRIORITY_MODELS } from "./constants.ts";

function isProviderPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function currentModelName(
  ctx: Pick<ExtensionContext, "model">,
): string | undefined {
  return ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;
}

export function supportsPriorityServiceTier(
  ctx: Pick<ExtensionContext, "model">,
): boolean {
  const modelName = currentModelName(ctx);
  return (
    modelName !== undefined &&
    PRIORITY_MODELS.includes(modelName as (typeof PRIORITY_MODELS)[number])
  );
}

export function applyPriorityServiceTier(
  payload: unknown,
  ctx: Pick<ExtensionContext, "model">,
): Record<string, unknown> | undefined {
  if (!supportsPriorityServiceTier(ctx) || !isProviderPayload(payload)) {
    return undefined;
  }

  return {
    ...payload,
    service_tier: "priority",
  };
}
