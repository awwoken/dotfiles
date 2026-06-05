import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";

import { BTW_CUSTOM_TYPE, BTW_SCHEMA_VERSION } from "./constants.ts";
import type { BtwActiveEntry, BtwEntry, BtwStoredEvent, BtwTurnEntry } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object";
}

function isBtwTurnEntry(value: unknown): value is BtwTurnEntry {
	return isRecord(value) && value.schemaVersion === BTW_SCHEMA_VERSION && value.kind === "turn" && typeof value.chatId === "string";
}

function isBtwActiveEntry(value: unknown): value is BtwActiveEntry {
	return isRecord(value) && value.schemaVersion === BTW_SCHEMA_VERSION && value.kind === "active";
}

export function isBtwEntry(value: unknown): value is BtwEntry {
	return isBtwTurnEntry(value) || isBtwActiveEntry(value);
}

export function collectBtwEvents(entries: readonly SessionEntry[]): BtwStoredEvent[] {
	const records: BtwStoredEvent[] = [];

	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== BTW_CUSTOM_TYPE) {
			continue;
		}

		if (!isBtwEntry(entry.data)) {
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

export function collectCurrentBranchBtwEvents(ctx: ExtensionContext): BtwStoredEvent[] {
	return collectBtwEvents(ctx.sessionManager.getBranch());
}

export function appendBtwEntry(pi: ExtensionAPI, data: BtwEntry): void {
	pi.appendEntry(BTW_CUSTOM_TYPE, data);
}
