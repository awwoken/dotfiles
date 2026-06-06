import { readFile } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import type { ChildProcessWithoutNullStreams } from "node:child_process"

import { CancellationTokenSource, createMessageConnection, StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node"
import type { MessageConnection } from "vscode-jsonrpc/node"
import {
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  ExitNotification,
  InitializedNotification,
  InitializeRequest,
  PublishDiagnosticsNotification,
  ShutdownRequest,
} from "vscode-languageserver-protocol"
import type { Diagnostic, InitializeResult, ServerCapabilities } from "vscode-languageserver-protocol"

import { resolveServerForFile } from "./config.ts"
import type { OpenDocumentState, PositionEncoding, ResolvedLspServer } from "./types.ts"
import { pathToFileUri } from "./uri.ts"

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_STDERR_CHARS = 4_000

export class LspClientManager {
  private clients = new Map<string, LspClient>()

  async getClientForFile(cwd: string, file: string): Promise<{ client: LspClient; resolution: ResolvedLspServer }> {
    const resolution = await resolveServerForFile(cwd, file)
    const key = `${resolution.serverName}:${resolution.workspaceRoot}`
    const existing = this.clients.get(key)

    if (existing) {
      return { client: existing, resolution }
    }

    const client = new LspClient(resolution, () => this.clients.delete(key))
    this.clients.set(key, client)
    return { client, resolution }
  }

  async stopAll(): Promise<void> {
    const clients = [...this.clients.values()]
    this.clients.clear()
    await Promise.allSettled(clients.map((client) => client.stop()))
  }
}

export class LspClient {
  private process?: ChildProcessWithoutNullStreams
  private connection?: MessageConnection
  private startPromise?: Promise<void>
  private stopped = false
  private stderr = ""
  private documents = new Map<string, OpenDocumentState>()
  private publishedDiagnostics = new Map<string, Diagnostic[]>()
  private serverCapabilities?: ServerCapabilities
  private negotiatedPositionEncoding: PositionEncoding = "utf-16"

  constructor(
    private readonly resolution: ResolvedLspServer,
    private readonly onExit: () => void,
  ) {}

  get capabilities(): ServerCapabilities | undefined {
    return this.serverCapabilities
  }

  get positionEncoding(): PositionEncoding {
    return this.negotiatedPositionEncoding
  }

  async ensureStarted(signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
    if (this.connection && this.serverCapabilities) return
    if (this.startPromise) return this.startPromise

    this.startPromise = this.start(signal, timeoutMs).finally(() => {
      this.startPromise = undefined
    })

    return this.startPromise
  }

  async ensureFileOpen(filePath: string): Promise<void> {
    await this.ensureStarted()

    const absolutePath = path.resolve(filePath)
    const text = await readFile(absolutePath, "utf8")
    const uri = pathToFileUri(absolutePath)
    const existing = this.documents.get(absolutePath)

    if (!existing) {
      const document: OpenDocumentState = {
        uri,
        languageId: languageIdForPath(absolutePath, this.resolution.config),
        version: 1,
        text,
      }
      this.documents.set(absolutePath, document)
      this.sendNotification(DidOpenTextDocumentNotification.type, {
        textDocument: document,
      })
      return
    }

    if (existing.text !== text) {
      existing.version += 1
      existing.text = text
      this.sendNotification(DidChangeTextDocumentNotification.type, {
        textDocument: { uri: existing.uri, version: existing.version },
        contentChanges: [{ text }],
      })
    }
  }

  async refreshFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath)
    if (!this.documents.has(absolutePath)) return
    await this.ensureFileOpen(absolutePath)
  }

  documentUri(filePath: string): string {
    return pathToFileUri(filePath)
  }

  getPublishedDiagnostics(filePath: string): Diagnostic[] | undefined {
    return this.publishedDiagnostics.get(pathToFileUri(path.resolve(filePath)))
  }

  async waitForPublishedDiagnostics(filePath: string, timeoutMs = 1_000): Promise<Diagnostic[] | undefined> {
    const uri = pathToFileUri(path.resolve(filePath))
    const existing = this.publishedDiagnostics.get(uri)
    if (existing) return existing

    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      const diagnostics = this.publishedDiagnostics.get(uri)
      if (diagnostics) return diagnostics
    }

    return undefined
  }

  async sendRequest<R>(type: { method: string }, params: unknown, signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<R> {
    await this.ensureStarted(signal, timeoutMs)
    return this.request<R>(type, params, signal, timeoutMs)
  }

  sendNotification<P>(type: { method: string }, params: P): void {
    if (!this.connection || this.stopped) {
      throw new Error("Language server is not running")
    }
    this.connection.sendNotification(type.method, params)
  }

  async stop(): Promise<void> {
    this.stopped = true
    const connection = this.connection
    const child = this.process

    this.connection = undefined
    this.process = undefined
    this.serverCapabilities = undefined
    this.documents.clear()
    this.publishedDiagnostics.clear()

    if (!connection || !child || child.exitCode !== null) {
      connection?.dispose()
      return
    }

    try {
      await this.requestWithConnection(connection, ShutdownRequest.type, undefined, undefined, 3_000)
      connection.sendNotification(ExitNotification.type.method)
    } catch {
      child.kill()
    } finally {
      connection.dispose()
      if (child.exitCode === null) {
        setTimeout(() => {
          if (child.exitCode === null) child.kill()
        }, 1_000).unref()
      }
    }
  }

  private async start(signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
    if (this.stopped) {
      throw new Error("Language server client has been stopped")
    }

    const child = spawn(this.resolution.command, this.resolution.args, {
      cwd: this.resolution.workspaceRoot,
      env: process.env,
      stdio: "pipe",
    })

    this.process = child
    this.stderr = ""

    child.stderr.on("data", (chunk: Buffer) => {
      this.stderr = trimStderr(this.stderr + chunk.toString("utf8"))
    })

    child.on("exit", () => {
      this.connection?.dispose()
      this.connection = undefined
      this.serverCapabilities = undefined
      this.documents.clear()
      this.publishedDiagnostics.clear()
      this.onExit()
    })

    child.on("error", (error) => {
      this.stderr = trimStderr(`${this.stderr}\n${error.message}`)
    })

    const connection = createMessageConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin))
    this.connection = connection
    this.registerClientRequestHandlers(connection)
    connection.onNotification(PublishDiagnosticsNotification.type, (params) => {
      this.publishedDiagnostics.set(params.uri, params.diagnostics)
    })
    connection.listen()

    const initializeResult = await this.requestWithConnection(
      connection,
      InitializeRequest.type,
      {
        processId: process.pid,
        clientInfo: { name: "pi-lsp-tools" },
        rootUri: pathToFileUri(this.resolution.workspaceRoot),
        workspaceFolders: [
          {
            uri: pathToFileUri(this.resolution.workspaceRoot),
            name: path.basename(this.resolution.workspaceRoot),
          },
        ],
        capabilities: {
          general: {
            positionEncodings: ["utf-16"],
          },
          textDocument: {
            definition: {
              linkSupport: true,
            },
            documentSymbol: {
              hierarchicalDocumentSymbolSupport: true,
            },
            diagnostic: {
              relatedDocumentSupport: false,
            },
            publishDiagnostics: {
              relatedInformation: true,
            },
            references: {},
          },
        },
        initializationOptions: this.resolution.config.initializationOptions ?? {},
      },
      signal,
      timeoutMs,
    )

    const capabilities = (initializeResult as InitializeResult).capabilities
    const positionEncoding = capabilities.positionEncoding ?? "utf-16"
    if (positionEncoding !== "utf-16") {
      throw new Error(`Server uses unsupported position encoding "${positionEncoding}"; v1 supports utf-16 only`)
    }

    this.serverCapabilities = capabilities
    this.negotiatedPositionEncoding = "utf-16"
    connection.sendNotification(InitializedNotification.type.method, {})
  }

  private registerClientRequestHandlers(connection: MessageConnection): void {
    connection.onRequest("client/registerCapability", () => null)
    connection.onRequest("client/unregisterCapability", () => null)
    connection.onRequest("window/workDoneProgress/create", () => null)
    connection.onRequest("window/showMessageRequest", () => null)
    connection.onRequest("workspace/configuration", (params: { items?: unknown[] }) => params.items?.map(() => null) ?? [])
    connection.onRequest("workspace/workspaceFolders", () => [
      {
        uri: pathToFileUri(this.resolution.workspaceRoot),
        name: path.basename(this.resolution.workspaceRoot),
      },
    ])
  }

  private async request<R>(type: { method: string }, params: unknown, signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<R> {
    if (!this.connection || this.stopped) {
      throw new Error("Language server is not running")
    }
    return this.requestWithConnection<R>(this.connection, type, params, signal, timeoutMs)
  }

  private async requestWithConnection<R>(connection: MessageConnection, type: { method: string }, params: unknown, signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<R> {
    const cancellation = new CancellationTokenSource()
    const abort = () => cancellation.cancel()
    signal?.addEventListener("abort", abort, { once: true })

    let timeout: NodeJS.Timeout | undefined
    try {
      const request = connection.sendRequest(type.method, params, cancellation.token) as Promise<R>
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          cancellation.cancel()
          reject(new Error(`LSP request timed out after ${timeoutMs}ms${this.stderr ? `\nServer stderr:\n${this.stderr}` : ""}`))
        }, timeoutMs)
      })

      return await Promise.race([request, timeoutPromise])
    } catch (error) {
      if (this.stderr && error instanceof Error && !error.message.includes("Server stderr")) {
        throw new Error(`${error.message}\nServer stderr:\n${this.stderr}`)
      }
      throw error
    } finally {
      if (timeout) clearTimeout(timeout)
      signal?.removeEventListener("abort", abort)
      cancellation.dispose()
    }
  }
}

function languageIdForPath(filePath: string, config: ResolvedLspServer["config"]): string {
  const extension = path.extname(filePath)
  return config.languageIds?.[extension] ?? config.languageId ?? "plaintext"
}

function trimStderr(text: string): string {
  if (text.length <= MAX_STDERR_CHARS) return text.trim()
  return `...${text.slice(-MAX_STDERR_CHARS)}`.trim()
}
