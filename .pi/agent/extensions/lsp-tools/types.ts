import type { ServerCapabilities } from "vscode-languageserver-protocol"

export type PositionEncoding = "utf-16"

export interface LspServerConfig {
  command: string
  args?: string[]
  fileTypes: string[]
  rootMarkers: string[]
  languageId?: string
  languageIds?: Record<string, string>
  initializationOptions?: unknown
  disabled?: boolean
}

export interface LspToolsConfig {
  servers?: Record<string, Partial<LspServerConfig>>
}

export interface ResolvedLspServer {
  serverName: string
  config: LspServerConfig
  command: string
  args: string[]
  cwd: string
  workspaceRoot: string
  targetFilePath: string
}

export interface OpenDocumentState {
  uri: string
  languageId: string
  version: number
  text: string
}

export interface LspClientCapabilities {
  server: ServerCapabilities
  positionEncoding: PositionEncoding
}

export interface LspLocationDetails {
  path: string
  line: number
  column: number
  preview?: string
}
