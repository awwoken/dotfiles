import { readFile } from "node:fs/promises"

import type { Position } from "vscode-languageserver-types"

import type { PositionEncoding } from "./types.ts"

const SYMBOL_SUFFIX_PATTERN = /^(.*)#([1-9][0-9]*)$/u
const IDENTIFIER_PART = /[\p{L}\p{N}_$]/u

export async function resolveSymbolPosition(filePath: string, line: number, symbolWithSuffix: string, positionEncoding: PositionEncoding): Promise<Position> {
  if (positionEncoding !== "utf-16") {
    throw new Error(`Unsupported position encoding "${positionEncoding}"; v1 supports utf-16 only`)
  }

  if (!Number.isInteger(line) || line < 1) {
    throw new Error(`Line must be a positive 1-indexed integer; received ${line}`)
  }

  const { symbol, occurrence } = parseSymbolSuffix(symbolWithSuffix)
  if (!symbol) {
    throw new Error("Symbol must not be empty")
  }

  const content = await readFile(filePath, "utf8")
  const lines = content.split(/\n/u)
  if (line > lines.length) {
    throw new Error(`Line ${line} is out of range; file has ${lines.length} line(s)`)
  }

  const textLine = lines[line - 1]?.replace(/\r$/u, "") ?? ""
  const character = findStandaloneOccurrence(textLine, symbol, occurrence)

  if (character === undefined) {
    const suffix = occurrence > 1 ? ` occurrence #${occurrence}` : ""
    throw new Error(`Symbol "${symbol}"${suffix} was not found as a standalone occurrence on line ${line}`)
  }

  return { line: line - 1, character }
}

function parseSymbolSuffix(symbolWithSuffix: string): { symbol: string; occurrence: number } {
  const match = symbolWithSuffix.match(SYMBOL_SUFFIX_PATTERN)
  if (!match) {
    return { symbol: symbolWithSuffix, occurrence: 1 }
  }

  return {
    symbol: match[1] ?? "",
    occurrence: Number(match[2]),
  }
}

function findStandaloneOccurrence(textLine: string, symbol: string, occurrence: number): number | undefined {
  let index = -1
  let count = 0

  while (true) {
    index = textLine.indexOf(symbol, index + 1)
    if (index === -1) return undefined
    if (!isStandalone(textLine, index, symbol.length)) continue

    count += 1
    if (count === occurrence) return index
  }
}

function isStandalone(textLine: string, index: number, length: number): boolean {
  const before = index > 0 ? textLine[index - 1] : undefined
  const after = index + length < textLine.length ? textLine[index + length] : undefined

  return !isIdentifierPart(before) && !isIdentifierPart(after)
}

function isIdentifierPart(value: string | undefined): boolean {
  return value !== undefined && IDENTIFIER_PART.test(value)
}
