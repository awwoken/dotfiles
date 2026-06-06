export function toRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return value as Record<string, unknown>;
}

export function getStringField(value: unknown, field: string): string | undefined {
	const raw = toRecord(value)[field];
	return typeof raw === "string" ? raw : undefined;
}
