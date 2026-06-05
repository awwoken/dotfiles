import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { REWRITE_TIMEOUT_MS, RTK_DISABLED_ENV } from "./constants.ts"

export function shouldRewriteCommand(command: unknown): command is string {
  if (typeof command !== "string" || command.trim() === "") return false
  if (command.startsWith("rtk ")) return false
  if (process.env[RTK_DISABLED_ENV] === "1") return false

  return true
}

export async function rewriteCommand(
  pi: ExtensionAPI,
  command: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const result = await pi.exec("rtk", ["rewrite", command], {
    timeout: REWRITE_TIMEOUT_MS,
    signal,
  })

  if (result.killed) return null
  if (result.code !== 0 && result.code !== 3) return null

  return result.stdout.trim() || null
}
