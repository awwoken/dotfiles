import { Type } from "typebox"

const DEFAULT_TIMEOUT_MS = 30_000

export const FileParam = Type.String({ description: "Path to the target file, relative to the current workspace or absolute inside it" })
export const WorkspaceFileParam = Type.String({ description: "Path to any file in the target workspace, used to select the local language server" })
export const LineParam = Type.Number({ description: "1-indexed source line containing the symbol" })
export const SymbolParam = Type.String({ description: "Exact symbol text on the target line. Use suffix like foo#2 for repeated occurrences on one line." })
export const TimeoutParam = Type.Optional(Type.Number({ description: "Request timeout in milliseconds (default: 30000, max: 120000)", default: DEFAULT_TIMEOUT_MS }))

export const DocumentSymbolsParams = Type.Object({
  file: FileParam,
  query: Type.Optional(Type.String({ description: "Optional case-insensitive substring filter for returned symbols" })),
  timeout: TimeoutParam,
})

export const DiagnosticsParams = Type.Object({
  file: FileParam,
  timeout: TimeoutParam,
})

export const DefinitionParams = Type.Object({
  file: FileParam,
  line: LineParam,
  symbol: SymbolParam,
  timeout: TimeoutParam,
})

export const ReferencesParams = Type.Object({
  file: FileParam,
  line: LineParam,
  symbol: SymbolParam,
  includeDeclaration: Type.Optional(Type.Boolean({ description: "Include the symbol declaration in results (default: true)", default: true })),
  timeout: TimeoutParam,
})

export const HoverParams = Type.Object({
  file: FileParam,
  line: LineParam,
  symbol: SymbolParam,
  timeout: TimeoutParam,
})

export const WorkspaceSymbolsParams = Type.Object({
  file: WorkspaceFileParam,
  query: Type.String({ description: "Workspace symbol query to send to the language server" }),
  timeout: TimeoutParam,
})

export const TypeDefinitionParams = Type.Object({
  file: FileParam,
  line: LineParam,
  symbol: SymbolParam,
  timeout: TimeoutParam,
})

export const ImplementationParams = Type.Object({
  file: FileParam,
  line: LineParam,
  symbol: SymbolParam,
  timeout: TimeoutParam,
})
