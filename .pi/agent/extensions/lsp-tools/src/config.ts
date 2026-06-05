import { access, readFile } from "node:fs/promises"
import { constants as fsConstants } from "node:fs"
import { fileURLToPath } from "node:url"
import os from "node:os"
import path from "node:path"

import type { LspServerConfig, LspToolsConfig, ResolvedLspServer } from "./types.ts"
import { isPathInside, realpathInsideCwd } from "./uri.ts"

const EXTENSION_DIR = path.dirname(fileURLToPath(import.meta.url))

const DEFAULT_SERVERS: Record<string, LspServerConfig> = {
  typescript: {
    command: "tsgo",
    args: ["--lsp", "--stdio"],
    fileTypes: [".ts", ".tsx", ".js", ".jsx"],
    rootMarkers: ["package.json", "tsconfig.json", "jsconfig.json"],
    languageIds: {
      ".ts": "typescript",
      ".tsx": "typescriptreact",
      ".js": "javascript",
      ".jsx": "javascriptreact",
    },
    initializationOptions: {},
  },
  rust: {
    command: "rust-analyzer",
    args: [],
    fileTypes: [".rs"],
    rootMarkers: ["Cargo.toml", "rust-project.json"],
    languageId: "rust",
    initializationOptions: {},
  },
}

export async function resolveServerForFile(cwd: string, inputFile: string): Promise<ResolvedLspServer> {
  const { cwd: resolvedCwd, path: targetFilePath } = await realpathInsideCwd(cwd, inputFile)
  const servers = await loadServerConfigs(resolvedCwd)
  const extension = path.extname(targetFilePath)

  for (const [serverName, config] of Object.entries(servers)) {
    if (config.disabled) continue
    if (!config.fileTypes.includes(extension)) continue

    const workspaceRoot = await findWorkspaceRoot(targetFilePath, resolvedCwd, config.rootMarkers)
    if (!workspaceRoot) {
      throw new Error(
        `No workspace root found for ${path.relative(resolvedCwd, targetFilePath)}. Expected one of: ${config.rootMarkers.join(", ")}`,
      )
    }

    const command = await resolveCommand(config.command, workspaceRoot)
    if (!command) {
      throw new Error(
        `Language server binary not found for ${serverName}: ${config.command}. Expected it in project node_modules/.bin, extension node_modules/.bin, or PATH.`,
      )
    }

    return {
      serverName,
      config,
      command,
      args: config.args ?? [],
      cwd: resolvedCwd,
      workspaceRoot,
      targetFilePath,
    }
  }

  throw new Error(`No configured language server for file type "${extension || "<none>"}"`)
}

async function loadServerConfigs(cwd: string): Promise<Record<string, LspServerConfig>> {
  const servers = cloneDefaultServers()
  const configPaths = [path.join(os.homedir(), ".pi", "agent", "lsp-tools.json"), path.join(cwd, "lsp-tools.json"), path.join(cwd, ".pi", "lsp-tools.json")]

  for (const configPath of configPaths) {
    const config = await readJsonConfig(configPath)
    if (!config?.servers) continue

    for (const [serverName, override] of Object.entries(config.servers)) {
      const existing = servers[serverName]
      if (!existing) {
        if (isCompleteServerConfig(override)) {
          servers[serverName] = normalizeServerConfig(override)
        }
        continue
      }

      servers[serverName] = normalizeServerConfig({ ...existing, ...override })
    }
  }

  return servers
}

async function readJsonConfig(configPath: string): Promise<LspToolsConfig | undefined> {
  try {
    const content = await readFile(configPath, "utf8")
    return JSON.parse(content) as LspToolsConfig
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOENT") return undefined
    throw new Error(`Failed to read LSP tools config at ${configPath}: ${(error as Error).message}`)
  }
}

function cloneDefaultServers(): Record<string, LspServerConfig> {
  return Object.fromEntries(Object.entries(DEFAULT_SERVERS).map(([name, config]) => [name, normalizeServerConfig(config)]))
}

function normalizeServerConfig(config: LspServerConfig): LspServerConfig {
  return {
    command: config.command,
    args: config.args ?? [],
    fileTypes: config.fileTypes,
    rootMarkers: config.rootMarkers,
    languageId: config.languageId,
    languageIds: config.languageIds,
    initializationOptions: config.initializationOptions ?? {},
    disabled: config.disabled ?? false,
  }
}

function isCompleteServerConfig(config: Partial<LspServerConfig>): config is LspServerConfig {
  return Boolean(config.command && config.fileTypes?.length && config.rootMarkers?.length)
}

async function findWorkspaceRoot(filePath: string, cwd: string, rootMarkers: string[]): Promise<string | undefined> {
  let current = path.dirname(filePath)

  while (isPathInside(cwd, current)) {
    if (await containsAnyMarker(current, rootMarkers)) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  return undefined
}

async function containsAnyMarker(directory: string, markers: string[]): Promise<boolean> {
  for (const marker of markers) {
    try {
      await access(path.join(directory, marker), fsConstants.F_OK)
      return true
    } catch {
      // Try the next marker.
    }
  }
  return false
}

async function resolveCommand(command: string, workspaceRoot: string): Promise<string | undefined> {
  if (path.isAbsolute(command)) {
    return (await isExecutable(command)) ? command : undefined
  }

  if (command.includes(path.sep)) {
    const workspaceRelative = path.resolve(workspaceRoot, command)
    if (await isExecutable(workspaceRelative)) return workspaceRelative

    const extensionRelative = path.resolve(EXTENSION_DIR, command)
    if (await isExecutable(extensionRelative)) return extensionRelative

    return undefined
  }

  const searchDirs = [
    path.join(workspaceRoot, "node_modules", ".bin"),
    path.join(EXTENSION_DIR, "node_modules", ".bin"),
    ...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean),
  ]

  for (const directory of unique(searchDirs)) {
    const candidate = path.join(directory, command)
    if (await isExecutable(candidate)) return candidate
  }

  return undefined
}

async function isExecutable(candidate: string): Promise<boolean> {
  try {
    await access(candidate, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
