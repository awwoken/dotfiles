import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"
import { DefinitionRequest, DocumentSymbolRequest, HoverRequest, ImplementationRequest, ReferencesRequest, TypeDefinitionRequest, WorkspaceSymbolRequest } from "vscode-languageserver-protocol"
import type { DocumentSymbol, Hover, Location, LocationLink, SymbolInformation, WorkspaceSymbol } from "vscode-languageserver-protocol"

import { LspClientManager } from "./client.ts"
import { formatDefinitions, formatDocumentSymbols, formatHover, formatImplementations, formatReferences, formatTypeDefinitions, formatWorkspaceSymbols } from "./format.ts"
import { resolveSymbolPosition } from "./position.ts"

const DEFAULT_TIMEOUT_MS = 30_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 120_000

const FileParam = Type.String({ description: "Path to the target file, relative to the current workspace or absolute inside it" })
const WorkspaceFileParam = Type.String({ description: "Path to any file in the target workspace, used to select the local language server" })
const LineParam = Type.Number({ description: "1-indexed source line containing the symbol" })
const SymbolParam = Type.String({ description: "Exact symbol text on the target line. Use suffix like foo#2 for repeated occurrences on one line." })
const TimeoutParam = Type.Optional(Type.Number({ description: "Request timeout in milliseconds (default: 30000, max: 120000)", default: DEFAULT_TIMEOUT_MS }))

const DocumentSymbolsParams = Type.Object({
  file: FileParam,
  query: Type.Optional(Type.String({ description: "Optional case-insensitive substring filter for returned symbols" })),
  timeout: TimeoutParam,
})

const DefinitionParams = Type.Object({
  file: FileParam,
  line: LineParam,
  symbol: SymbolParam,
  timeout: TimeoutParam,
})

const ReferencesParams = Type.Object({
  file: FileParam,
  line: LineParam,
  symbol: SymbolParam,
  includeDeclaration: Type.Optional(Type.Boolean({ description: "Include the symbol declaration in results (default: true)", default: true })),
  timeout: TimeoutParam,
})

const HoverParams = Type.Object({
  file: FileParam,
  line: LineParam,
  symbol: SymbolParam,
  timeout: TimeoutParam,
})

const WorkspaceSymbolsParams = Type.Object({
  file: WorkspaceFileParam,
  query: Type.String({ description: "Workspace symbol query to send to the language server" }),
  timeout: TimeoutParam,
})

const TypeDefinitionParams = Type.Object({
  file: FileParam,
  line: LineParam,
  symbol: SymbolParam,
  timeout: TimeoutParam,
})

const ImplementationParams = Type.Object({
  file: FileParam,
  line: LineParam,
  symbol: SymbolParam,
  timeout: TimeoutParam,
})

export default function lspToolsExtension(pi: ExtensionAPI) {
  const manager = new LspClientManager()

  pi.registerTool({
    name: "lsp_document_symbols",
    label: "LSP Document Symbols",
    description: "Use when you need semantic file structure from a local language server. Returns document symbols for a source file.",
    promptSnippet: "List semantic document symbols for a source file via the local language server.",
    promptGuidelines: ["Use lsp_document_symbols to inspect file structure semantically before broad grep when a language server is available."],
    parameters: DocumentSymbolsParams,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const timeout = normalizeTimeout(params.timeout)
      const { client, resolution } = await manager.getClientForFile(ctx.cwd, params.file)

      await client.ensureStarted(signal, timeout)
      assertCapability(client.capabilities?.documentSymbolProvider, "textDocument/documentSymbol")
      await client.ensureFileOpen(resolution.targetFilePath)

      const result = await client.sendRequest<DocumentSymbol[] | SymbolInformation[] | null>(
        DocumentSymbolRequest.type,
        {
          textDocument: { uri: client.documentUri(resolution.targetFilePath) },
        },
        signal,
        timeout,
      )

      const text = formatDocumentSymbols(result, resolution.cwd, params.query)
      return {
        content: [{ type: "text" as const, text }],
        details: {
          serverName: resolution.serverName,
          workspaceRoot: resolution.workspaceRoot,
          file: resolution.targetFilePath,
        },
      }
    },
  })

  pi.registerTool({
    name: "lsp_go_to_definition",
    label: "LSP Go To Definition",
    description: "Use when you need to locate where a symbol is defined. Finds semantic definitions for a symbol at a specific file line.",
    promptSnippet: "Find semantic definitions for a symbol at a file line via the local language server.",
    promptGuidelines: ["Use lsp_go_to_definition when the user asks where a symbol is defined or when grep could confuse similarly named symbols."],
    parameters: DefinitionParams,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const timeout = normalizeTimeout(params.timeout)
      const { client, resolution } = await manager.getClientForFile(ctx.cwd, params.file)

      await client.ensureStarted(signal, timeout)
      assertCapability(client.capabilities?.definitionProvider, "textDocument/definition")
      await client.ensureFileOpen(resolution.targetFilePath)
      const position = await resolveSymbolPosition(resolution.targetFilePath, params.line, params.symbol, client.positionEncoding)

      const result = await client.sendRequest<Location | Location[] | LocationLink[] | null>(
        DefinitionRequest.type,
        {
          textDocument: { uri: client.documentUri(resolution.targetFilePath) },
          position,
        },
        signal,
        timeout,
      )

      const text = await formatDefinitions(result, resolution.cwd)
      return {
        content: [{ type: "text" as const, text }],
        details: {
          serverName: resolution.serverName,
          workspaceRoot: resolution.workspaceRoot,
          file: resolution.targetFilePath,
          line: params.line,
          symbol: params.symbol,
        },
      }
    },
  })

  pi.registerTool({
    name: "lsp_find_references",
    label: "LSP Find References",
    description: "Use when you need semantic references and grep may produce false positives. Finds references to a symbol at a specific file line.",
    promptSnippet: "Find semantic references to a symbol at a file line via the local language server.",
    promptGuidelines: ["Use lsp_find_references to find semantic references to a symbol when grep may produce false positives."],
    parameters: ReferencesParams,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const timeout = normalizeTimeout(params.timeout)
      const { client, resolution } = await manager.getClientForFile(ctx.cwd, params.file)

      await client.ensureStarted(signal, timeout)
      assertCapability(client.capabilities?.referencesProvider, "textDocument/references")
      await client.ensureFileOpen(resolution.targetFilePath)
      const position = await resolveSymbolPosition(resolution.targetFilePath, params.line, params.symbol, client.positionEncoding)

      const result = await client.sendRequest<Location[] | null>(
        ReferencesRequest.type,
        {
          textDocument: { uri: client.documentUri(resolution.targetFilePath) },
          position,
          context: { includeDeclaration: params.includeDeclaration ?? true },
        },
        signal,
        timeout,
      )

      const text = formatReferences(result, resolution.cwd)
      return {
        content: [{ type: "text" as const, text }],
        details: {
          serverName: resolution.serverName,
          workspaceRoot: resolution.workspaceRoot,
          file: resolution.targetFilePath,
          line: params.line,
          symbol: params.symbol,
          includeDeclaration: params.includeDeclaration ?? true,
        },
      }
    },
  })

  pi.registerTool({
    name: "lsp_hover",
    label: "LSP Hover",
    description: "Use when you need semantic type, signature, or documentation details for a symbol. Returns hover information at a specific file line.",
    promptSnippet: "Show hover/type documentation for a symbol at a file line via the local language server.",
    promptGuidelines: ["Use lsp_hover before editing unfamiliar symbols when type/signature information would reduce guesswork."],
    parameters: HoverParams,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const timeout = normalizeTimeout(params.timeout)
      const { client, resolution } = await manager.getClientForFile(ctx.cwd, params.file)

      await client.ensureStarted(signal, timeout)
      assertCapability(client.capabilities?.hoverProvider, "textDocument/hover")
      await client.ensureFileOpen(resolution.targetFilePath)
      const position = await resolveSymbolPosition(resolution.targetFilePath, params.line, params.symbol, client.positionEncoding)

      const result = await client.sendRequest<Hover | null>(
        HoverRequest.type,
        {
          textDocument: { uri: client.documentUri(resolution.targetFilePath) },
          position,
        },
        signal,
        timeout,
      )

      const text = formatHover(result)
      return {
        content: [{ type: "text" as const, text }],
        details: {
          serverName: resolution.serverName,
          workspaceRoot: resolution.workspaceRoot,
          file: resolution.targetFilePath,
          line: params.line,
          symbol: params.symbol,
        },
      }
    },
  })

  pi.registerTool({
    name: "lsp_workspace_symbols",
    label: "LSP Workspace Symbols",
    description: "Use when you need to find symbols across a workspace semantically. Searches workspace symbols with the local language server.",
    promptSnippet: "Search semantic workspace symbols via the local language server.",
    promptGuidelines: ["Use lsp_workspace_symbols when you know a symbol name but not its file, especially before broad text search."],
    parameters: WorkspaceSymbolsParams,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const timeout = normalizeTimeout(params.timeout)
      const { client, resolution } = await manager.getClientForFile(ctx.cwd, params.file)

      await client.ensureStarted(signal, timeout)
      assertCapability(client.capabilities?.workspaceSymbolProvider, "workspace/symbol")
      await client.ensureFileOpen(resolution.targetFilePath)

      const result = await client.sendRequest<Array<SymbolInformation | WorkspaceSymbol> | null>(
        WorkspaceSymbolRequest.type,
        {
          query: params.query,
        },
        signal,
        timeout,
      )

      const text = formatWorkspaceSymbols(result, resolution.cwd, params.query)
      return {
        content: [{ type: "text" as const, text }],
        details: {
          serverName: resolution.serverName,
          workspaceRoot: resolution.workspaceRoot,
          file: resolution.targetFilePath,
          query: params.query,
        },
      }
    },
  })

  pi.registerTool({
    name: "lsp_type_definition",
    label: "LSP Type Definition",
    description: "Use when you need to locate the type behind a symbol. Finds semantic type definitions for a symbol at a specific file line.",
    promptSnippet: "Find semantic type definitions for a symbol at a file line via the local language server.",
    promptGuidelines: ["Use lsp_type_definition to jump from a value or usage to its underlying type, interface, or declaration."],
    parameters: TypeDefinitionParams,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const timeout = normalizeTimeout(params.timeout)
      const { client, resolution } = await manager.getClientForFile(ctx.cwd, params.file)

      await client.ensureStarted(signal, timeout)
      assertCapability(client.capabilities?.typeDefinitionProvider, "textDocument/typeDefinition")
      await client.ensureFileOpen(resolution.targetFilePath)
      const position = await resolveSymbolPosition(resolution.targetFilePath, params.line, params.symbol, client.positionEncoding)

      const result = await client.sendRequest<Location | Location[] | LocationLink[] | null>(
        TypeDefinitionRequest.type,
        {
          textDocument: { uri: client.documentUri(resolution.targetFilePath) },
          position,
        },
        signal,
        timeout,
      )

      const text = await formatTypeDefinitions(result, resolution.cwd)
      return {
        content: [{ type: "text" as const, text }],
        details: {
          serverName: resolution.serverName,
          workspaceRoot: resolution.workspaceRoot,
          file: resolution.targetFilePath,
          line: params.line,
          symbol: params.symbol,
        },
      }
    },
  })

  pi.registerTool({
    name: "lsp_implementation",
    label: "LSP Implementation",
    description: "Use when you need concrete implementations of an interface, abstract member, or symbol. Finds implementations at a specific file line.",
    promptSnippet: "Find semantic implementations for a symbol at a file line via the local language server.",
    promptGuidelines: ["Use lsp_implementation to navigate from interfaces, abstract members, or declarations to concrete implementations."],
    parameters: ImplementationParams,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const timeout = normalizeTimeout(params.timeout)
      const { client, resolution } = await manager.getClientForFile(ctx.cwd, params.file)

      await client.ensureStarted(signal, timeout)
      assertCapability(client.capabilities?.implementationProvider, "textDocument/implementation")
      await client.ensureFileOpen(resolution.targetFilePath)
      const position = await resolveSymbolPosition(resolution.targetFilePath, params.line, params.symbol, client.positionEncoding)

      const result = await client.sendRequest<Location | Location[] | LocationLink[] | null>(
        ImplementationRequest.type,
        {
          textDocument: { uri: client.documentUri(resolution.targetFilePath) },
          position,
        },
        signal,
        timeout,
      )

      const text = await formatImplementations(result, resolution.cwd)
      return {
        content: [{ type: "text" as const, text }],
        details: {
          serverName: resolution.serverName,
          workspaceRoot: resolution.workspaceRoot,
          file: resolution.targetFilePath,
          line: params.line,
          symbol: params.symbol,
        },
      }
    },
  })

  pi.on("session_shutdown", async () => {
    await manager.stopAll()
  })
}

function assertCapability(value: unknown, method: string): void {
  if (!value) {
    throw new Error(`LSP method unsupported by server: ${method}`)
  }
}

function normalizeTimeout(value: number | undefined): number {
  if (value === undefined) return DEFAULT_TIMEOUT_MS
  if (!Number.isFinite(value) || value < MIN_TIMEOUT_MS) {
    throw new Error(`Timeout must be at least ${MIN_TIMEOUT_MS}ms`)
  }
  return Math.min(Math.floor(value), MAX_TIMEOUT_MS)
}
