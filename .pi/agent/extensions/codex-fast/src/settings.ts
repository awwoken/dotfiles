import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

import { SETTINGS_KEY } from "./constants.ts";

function isSettingsObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function globalSettingsPath(): string {
  return join(
    process.env.PI_CODING_AGENT_DIR ?? getAgentDir(),
    "settings.json",
  );
}

function projectSettingsPath(cwd: string): string {
  return join(cwd, ".pi", "settings.json");
}

async function readSettings(path: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path, "utf8");
    const settings = JSON.parse(content) as unknown;
    return isSettingsObject(settings) ? settings : {};
  } catch (error) {
    if (isSettingsObject(error) && error.code === "ENOENT") return {};
    throw error;
  }
}

function mergeSettings(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, overrideValue] of Object.entries(overrides)) {
    const baseValue = merged[key];
    if (isSettingsObject(baseValue) && isSettingsObject(overrideValue)) {
      merged[key] = mergeSettings(baseValue, overrideValue);
      continue;
    }
    merged[key] = overrideValue;
  }
  return merged;
}

export async function loadPersistedFastMode(
  cwd: string,
): Promise<boolean | undefined> {
  const settings = mergeSettings(
    await readSettings(globalSettingsPath()),
    await readSettings(projectSettingsPath(cwd)),
  );
  const extensionSettings = settings[SETTINGS_KEY];
  return isSettingsObject(extensionSettings) &&
    typeof extensionSettings.enabled === "boolean"
    ? extensionSettings.enabled
    : undefined;
}

export async function persistFastMode(enabled: boolean): Promise<void> {
  const path = globalSettingsPath();
  const globalSettings = await readSettings(path);
  const extensionSettings = globalSettings[SETTINGS_KEY];
  globalSettings[SETTINGS_KEY] = {
    ...(isSettingsObject(extensionSettings) ? extensionSettings : {}),
    enabled,
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(globalSettings, null, 2)}\n`);
}
