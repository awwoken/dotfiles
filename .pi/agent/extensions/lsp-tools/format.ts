import { readFileSync } from "node:fs"
import path from "node:path"

import type { DocumentSymbol, Location, LocationLink, SymbolInformation } from "vscode-languageserver-protocol"

import { fileUriToPath, isPathInside } from "./uri.ts"

const REFERENCE_LIMIT = 80
const DEFINITION_LIMIT = 20
const SYMBOL_LIMIT = 200

const SYMBOL_KINDS: Record<number, string> = {
  1: "File",
  2: "Module",
  3: "Namespace",
  4: "Package",
  5: "Class",
  6: "Method",
  7: "Property",
  8: "Field",
  9: "Constructor",
  10: "Enum",
  11: "Interface",
  12: "Function",
  13: "Variable",
  14: "Constant",
  15: "String",
  16: "Number",
  17: "Boolean",
  18: "Array",
  19: "Object",
  20: "Key",
  21: "Null",
  22: "EnumMember",
  23: "Struct",
  24: "Event",
  25: "Operator",
  26: "TypeParameter",
}

export function formatReferences(locations: Location[] | null | undefined, cwd: string): string {
  return formatLocations("References", locations ?? [], cwd, REFERENCE_LIMIT, false)
}

export async function formatDefinitions(result: Location | Location[] | LocationLink[] | null | undefined, cwd: string): Promise<string> {
  const locations = normalizeDefinitionResult(result)
  return formatLocations("Definitions", locations, cwd, DEFINITION_LIMIT, true)
}

export function formatDocumentSymbols(result: DocumentSymbol[] | SymbolInformation[] | null | undefined, cwd: string, query?: string): string {
  const symbols = result ?? []
  if (symbols.length === 0) return "No document symbols returned by the language server."

  const queryLower = query?.toLowerCase()
  const lines = isDocumentSymbolArray(symbols) ? flattenDocumentSymbols(symbols, cwd) : flattenSymbolInformation(symbols, cwd)
  const filtered = queryLower ? lines.filter((line) => line.toLowerCase().includes(queryLower)) : lines

  if (filtered.length === 0) {
    return `No document symbols matched query "${query}".`
  }

  const shown = filtered.slice(0, SYMBOL_LIMIT)
  const suffix = filtered.length > shown.length ? `\n... truncated ${filtered.length - shown.length} additional symbol(s)` : ""
  return `Document symbols (${shown.length}${filtered.length > shown.length ? ` of ${filtered.length}` : ""}):\n${shown.join("\n")}${suffix}`
}

function formatLocations(title: string, locations: Location[], cwd: string, limit: number, includePreview: boolean): string {
  if (locations.length === 0) return `${title}: no locations returned by the language server.`

  const shown = locations.slice(0, limit)
  const lines = shown.map((location) => formatLocation(location, cwd, includePreview))
  const suffix = locations.length > shown.length ? `\n... truncated ${locations.length - shown.length} additional location(s)` : ""
  return `${title} (${shown.length}${locations.length > shown.length ? ` of ${locations.length}` : ""}):\n${lines.join("\n")}${suffix}`
}

function formatLocation(location: Location, cwd: string, includePreview: boolean): string {
  const filePath = fileUriToPath(location.uri)
  const displayPath = displayPathFor(cwd, filePath)
  const line = location.range.start.line + 1
  const column = location.range.start.character + 1
  const prefix = `- ${displayPath}:${line}:${column}`

  if (!includePreview) return prefix

  return `${prefix}${formatInlinePreview(filePath, line)}`
}

function formatInlinePreview(filePath: string, line: number): string {
  try {
    const content = readFileSyncUtf8(filePath)
    const sourceLine = content.split(/\n/u)[line - 1]?.replace(/\r$/u, "")?.trim()
    return sourceLine ? ` — ${sourceLine}` : ""
  } catch {
    return ""
  }
}

function normalizeDefinitionResult(result: Location | Location[] | LocationLink[] | null | undefined): Location[] {
  if (!result) return []
  if (!Array.isArray(result)) return [result]

  return result.map((item) => {
    if (isLocationLink(item)) {
      return {
        uri: item.targetUri,
        range: item.targetSelectionRange ?? item.targetRange,
      }
    }
    return item
  })
}

function isLocationLink(value: Location | LocationLink): value is LocationLink {
  return "targetUri" in value
}

function isDocumentSymbolArray(symbols: DocumentSymbol[] | SymbolInformation[]): symbols is DocumentSymbol[] {
  return symbols[0] !== undefined && "selectionRange" in symbols[0]
}

function flattenDocumentSymbols(symbols: DocumentSymbol[], cwd: string, depth = 0): string[] {
  const lines: string[] = []
  for (const symbol of symbols) {
    const indent = "  ".repeat(depth)
    const line = symbol.selectionRange.start.line + 1
    const column = symbol.selectionRange.start.character + 1
    lines.push(`${indent}- ${symbol.name} (${kindName(symbol.kind)}) @ ${line}:${column}`)
    if (symbol.children?.length) {
      lines.push(...flattenDocumentSymbols(symbol.children, cwd, depth + 1))
    }
  }
  return lines
}

function flattenSymbolInformation(symbols: SymbolInformation[], cwd: string): string[] {
  return symbols.map((symbol) => {
    const filePath = fileUriToPath(symbol.location.uri)
    const displayPath = displayPathFor(cwd, filePath)
    const line = symbol.location.range.start.line + 1
    const column = symbol.location.range.start.character + 1
    const container = symbol.containerName ? ` in ${symbol.containerName}` : ""
    return `- ${symbol.name} (${kindName(symbol.kind)})${container} @ ${displayPath}:${line}:${column}`
  })
}

function kindName(kind: number): string {
  return SYMBOL_KINDS[kind] ?? `Kind${kind}`
}

function displayPathFor(cwd: string, filePath: string): string {
  return isPathInside(cwd, filePath) ? path.relative(cwd, filePath) || "." : filePath
}

function readFileSyncUtf8(filePath: string): string {
  // Keep definition formatting synchronous so render order stays stable and errors are local to a single preview.
  return readFileSync(filePath, "utf8")
}
