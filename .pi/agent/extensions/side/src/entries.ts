import type {
	ExtensionAPI,
	ExtensionContext,
	SessionEntry,
} from "@earendil-works/pi-coding-agent";

import { SIDE_CUSTOM_TYPE, SIDE_SCHEMA_VERSION } from "./constants.ts";
import type {
	SideActiveEntry,
	SideEntry,
	SideStoredEvent,
	SideTurnEntry,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object";
}

function isSideTurnEntry(value: unknown): value is SideTurnEntry {
	return (
		isRecord(value) &&
		value.schemaVersion === SIDE_SCHEMA_VERSION &&
		value.kind === "turn" &&
		typeof value.chatId === "string"
	);
}

function isSideActiveEntry(value: unknown): value is SideActiveEntry {
	return (
		isRecord(value) &&
		value.schemaVersion === SIDE_SCHEMA_VERSION &&
		value.kind === "active"
	);
}

export function isSideEntry(value: unknown): value is SideEntry {
	return isSideTurnEntry(value) || isSideActiveEntry(value);
}

export function collectSideEvents(
	entries: readonly SessionEntry[],
): SideStoredEvent[] {
	const records: SideStoredEvent[] = [];

	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== SIDE_CUSTOM_TYPE) {
			continue;
		}

		if (!isSideEntry(entry.data)) {
			continue;
		}

		records.push({
			entryId: entry.id,
			parentId: entry.parentId,
			timestamp: entry.timestamp,
			data: entry.data,
		});
	}

	return records;
}

export function collectCurrentBranchSideEvents(
	ctx: ExtensionContext,
): SideStoredEvent[] {
	return collectSideEvents(ctx.sessionManager.getBranch());
}

export function appendSideEntry(pi: ExtensionAPI, data: SideEntry): void {
	pi.appendEntry(SIDE_CUSTOM_TYPE, data);
}
