const BUILT_IN_TOOL_NAMES = new Set([
	"bash",
	"edit",
	"grep",
	"find",
	"ls",
	"mcp",
	"read",
	"write",
]);

export function normalizeToolNamePart(value: string): string {
	const normalized = value
		.trim()
		.replace(/[^A-Za-z0-9_]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.replace(/_{2,}/g, "_");

	return normalized || "tool";
}

export function toPiToolName(serverName: string, toolName: string, prefixTools: boolean): string {
	const normalizedTool = normalizeToolNamePart(toolName);
	const name = prefixTools
		? `${normalizeToolNamePart(serverName)}_${normalizedTool}`
		: normalizedTool;

	return BUILT_IN_TOOL_NAMES.has(name.toLowerCase()) ? `mcp_${name}` : name;
}

export function makeUniqueToolName(baseName: string, usedNames: Set<string>): string {
	if (!usedNames.has(baseName)) {
		usedNames.add(baseName);
		return baseName;
	}

	let suffix = 2;
	while (usedNames.has(`${baseName}_${suffix}`)) {
		suffix += 1;
	}

	const uniqueName = `${baseName}_${suffix}`;
	usedNames.add(uniqueName);
	return uniqueName;
}
