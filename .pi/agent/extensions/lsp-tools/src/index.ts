import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { DefinitionRequest, DocumentDiagnosticRequest, DocumentSymbolRequest, HoverRequest, ImplementationRequest, ReferencesRequest, TypeDefinitionRequest, WorkspaceSymbolRequest } from "vscode-languageserver-protocol"
import type { Diagnostic, DocumentDiagnosticReport, DocumentSymbol, Hover, Location, LocationLink, SymbolInformation, WorkspaceSymbol } from "vscode-languageserver-protocol"

import { LspClientManager } from "./client.ts"
import { formatDefinitions, formatDiagnostics, formatDocumentSymbols, formatHover, formatImplementations, formatReferences, formatTypeDefinitions, formatWorkspaceSymbols } from "./format.ts"
import { resolveSymbolPosition } from "./position.ts"
import {
  DefinitionParams,
  DiagnosticsParams,
  DocumentSymbolsParams,
  HoverParams,
  ImplementationParams,
  ReferencesParams,
  TypeDefinitionParams,
  WorkspaceSymbolsParams,
} from "./schemas.ts"
import { assertCapability, diagnosticsFromDocumentReport, normalizeTimeout } from "./utils.ts"

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
    name: "lsp_diagnostics",
    label: "LSP Diagnostics",
    description: "Use when you need semantic errors or warnings for a source file. Returns diagnostics from the local language server.",
    promptSnippet: "Show language-server diagnostics for a source file.",
    promptGuidelines: ["Use lsp_diagnostics to inspect type errors, syntax errors, and warnings before or after code edits."],
    parameters: DiagnosticsParams,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const timeout = normalizeTimeout(params.timeout)
      const { client, resolution } = await manager.getClientForFile(ctx.cwd, params.file)

      await client.ensureStarted(signal, timeout)
      await client.ensureFileOpen(resolution.targetFilePath)

      let diagnostics: Diagnostic[] | undefined
      if (client.capabilities?.diagnosticProvider) {
        const result = await client.sendRequest<DocumentDiagnosticReport>(
          DocumentDiagnosticRequest.type,
          {
            textDocument: { uri: client.documentUri(resolution.targetFilePath) },
          },
          signal,
          timeout,
        )
        diagnostics = diagnosticsFromDocumentReport(result) ?? client.getPublishedDiagnostics(resolution.targetFilePath)
      } else {
        diagnostics = await client.waitForPublishedDiagnostics(resolution.targetFilePath, Math.min(timeout, 1_000))
      }

      if (!diagnostics) {
        throw new Error("LSP diagnostics unsupported by server: expected textDocument/diagnostic support or textDocument/publishDiagnostics notifications")
      }

      const text = formatDiagnostics(diagnostics, resolution.cwd, resolution.targetFilePath)
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

