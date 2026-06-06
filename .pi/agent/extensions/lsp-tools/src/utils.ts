import type { Diagnostic, DocumentDiagnosticReport } from "vscode-languageserver-protocol"

const DEFAULT_TIMEOUT_MS = 30_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 120_000

export function diagnosticsFromDocumentReport(report: DocumentDiagnosticReport | null | undefined): Diagnostic[] | undefined {
  if (!report) return undefined
  if ("items" in report) return report.items
  return undefined
}

export function assertCapability(value: unknown, method: string): void {
  if (!value) {
    throw new Error(`LSP method unsupported by server: ${method}`)
  }
}

export function normalizeTimeout(value: number | undefined): number {
  if (value === undefined) return DEFAULT_TIMEOUT_MS
  if (!Number.isFinite(value) || value < MIN_TIMEOUT_MS) {
    throw new Error(`Timeout must be at least ${MIN_TIMEOUT_MS}ms`)
  }
  return Math.min(Math.floor(value), MAX_TIMEOUT_MS)
}
