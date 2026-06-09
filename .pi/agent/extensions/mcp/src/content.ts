import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type PiContentBlock =
	| { type: "text"; text: string }
	| { type: "image"; data: string; mimeType: string };

interface McpContentBlock {
	type?: string;
	text?: string;
	data?: string;
	mimeType?: string;
	uri?: string;
	name?: string;
	resource?: {
		uri?: string;
		text?: string;
		blob?: string;
		mimeType?: string;
	};
}

export function transformMcpResult(result: CallToolResult): PiContentBlock[] {
	const content = Array.isArray(result.content) ? result.content : [];
	const transformed = content.map((block) => transformMcpContentBlock(block as McpContentBlock));
	return transformed.length > 0 ? transformed : [{ type: "text", text: "(empty result)" }];
}

function transformMcpContentBlock(block: McpContentBlock): PiContentBlock {
	if (block.type === "text") {
		return { type: "text", text: block.text ?? "" };
	}

	if (block.type === "image") {
		return {
			type: "image",
			data: block.data ?? "",
			mimeType: block.mimeType ?? "image/png",
		};
	}

	if (block.type === "resource") {
		const resourceUri = block.resource?.uri ?? "(no URI)";
		const resourceContent = block.resource?.text ?? (block.resource ? JSON.stringify(block.resource) : "(no content)");
		return { type: "text", text: `[Resource: ${resourceUri}]\n${resourceContent}` };
	}

	if (block.type === "resource_link") {
		const linkName = block.name ?? block.uri ?? "unknown";
		const linkUri = block.uri ?? "(no URI)";
		return { type: "text", text: `[Resource Link: ${linkName}]\nURI: ${linkUri}` };
	}

	if (block.type === "audio") {
		return { type: "text", text: `[Audio content: ${block.mimeType ?? "audio/*"}]` };
	}

	return { type: "text", text: JSON.stringify(block) };
}
