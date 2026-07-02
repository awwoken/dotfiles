import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { loadPersistedFastMode, persistFastMode } from "./settings.ts";
import type { ReloadFastModeOptions, SetFastModeOptions } from "./types.ts";
import {
  clearFastModeStatus,
  notifyFastModeState,
  notifySettingsLoadFailure,
  notifySettingsWriteFailure,
  updateFastModeStatus,
} from "./ui.ts";

export class CodexFastState {
  private enabled = false;
  private settingsWriteQueue: Promise<void> = Promise.resolve();

  isEnabled(): boolean {
    return this.enabled;
  }

  set(
    enabled: boolean,
    ctx: ExtensionContext,
    options?: SetFastModeOptions,
  ): void {
    this.enabled = enabled;
    if (options?.persist !== false) this.persist(enabled, ctx);
    updateFastModeStatus(ctx, this.enabled);
    if (options?.notify !== false) notifyFastModeState(ctx, this.enabled);
  }

  toggle(ctx: ExtensionContext): void {
    this.set(!this.enabled, ctx);
  }

  async reload(
    ctx: ExtensionContext,
    options?: ReloadFastModeOptions,
  ): Promise<void> {
    this.enabled = false;

    try {
      const persistedEnabled = await loadPersistedFastMode(ctx.cwd);
      if (typeof persistedEnabled === "boolean") {
        this.enabled = persistedEnabled;
      }
    } catch (error) {
      notifySettingsLoadFailure(ctx, error);
    }

    if (options?.startupFastMode === true) {
      this.enabled = true;
    }

    updateFastModeStatus(ctx, this.enabled);
  }

  clear(ctx: ExtensionContext): void {
    this.enabled = false;
    clearFastModeStatus(ctx);
  }

  refreshStatus(ctx: ExtensionContext): void {
    updateFastModeStatus(ctx, this.enabled);
  }

  private persist(enabled: boolean, ctx: ExtensionContext): void {
    this.settingsWriteQueue = this.settingsWriteQueue
      .catch(() => undefined)
      .then(() => persistFastMode(enabled));

    void this.settingsWriteQueue.catch((error) => {
      notifySettingsWriteFailure(ctx, error);
    });
  }
}
