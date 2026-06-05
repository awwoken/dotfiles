import { realpath } from "node:fs/promises"
import path from "node:path"

import { URI } from "vscode-uri"

export function pathToFileUri(filePath: string): string {
  return URI.file(path.resolve(filePath)).toString()
}

export function fileUriToPath(uri: string): string {
  const parsed = URI.parse(uri)
  if (parsed.scheme !== "file") {
    throw new Error(`Unsupported LSP URI scheme "${parsed.scheme}"; only file:// URIs are supported`)
  }
  return parsed.fsPath
}

export function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(parentPath, candidatePath)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

export async function resolveExistingPathInsideCwd(cwd: string, inputPath: string): Promise<string> {
  const absoluteCwd = await realpath(path.resolve(cwd))
  const absoluteInput = path.resolve(absoluteCwd, inputPath)
  const resolvedInput = await realpath(absoluteInput)

  if (!isPathInside(absoluteCwd, resolvedInput)) {
    throw new Error(`File is outside the current workspace: ${inputPath}`)
  }

  return resolvedInput
}

export async function realpathInsideCwd(cwd: string, inputPath: string): Promise<{ cwd: string; path: string }> {
  const resolvedCwd = await realpath(path.resolve(cwd))
  const resolvedPath = await realpath(path.resolve(resolvedCwd, inputPath))

  if (!isPathInside(resolvedCwd, resolvedPath)) {
    throw new Error(`Path is outside the current workspace: ${inputPath}`)
  }

  return { cwd: resolvedCwd, path: resolvedPath }
}
