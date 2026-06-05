import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { KeyId } from "@earendil-works/pi-tui";

import { DEFAULT_BTW_TOGGLE_SHORTCUT } from "./constants.ts";

interface BtwSettings {
	toggleShortcut?: unknown;
}

interface PiSettings {
	btw?: BtwSettings;
}

export interface BtwConfig {
	toggleShortcut: KeyId;
}

function readSettings(path: string): PiSettings {
	if (!existsSync(path)) return {};

	try {
		const value = JSON.parse(readFileSync(path, "utf8"));
		return value && typeof value === "object" ? (value as PiSettings) : {};
	} catch {
		return {};
	}
}

function getToggleShortcut(settings: PiSettings): KeyId | undefined {
	const value = settings.btw?.toggleShortcut;
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return (trimmed as KeyId) || undefined;
}

export function loadBtwConfig(cwd = process.cwd()): BtwConfig {
	const globalSettings = readSettings(join(homedir(), ".pi", "agent", "settings.json"));
	const projectSettings = readSettings(join(cwd, ".pi", "settings.json"));

	return {
		toggleShortcut: getToggleShortcut(projectSettings) ?? getToggleShortcut(globalSettings) ?? (DEFAULT_BTW_TOGGLE_SHORTCUT as KeyId),
	};
}
