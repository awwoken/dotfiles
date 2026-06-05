// RTK Pi extension — rewrites bash commands to use rtk for token savings.
// Requires: rtk >= 0.23.0 in PATH.
//
// This is a thin delegating extension: all rewrite logic lives in `rtk rewrite`,
// which is the single source of truth (src/discover/registry.rs).
// To add or change rewrite rules, edit the Rust registry — not this extension.
//
// Exit code contract for `rtk rewrite`:
//   0 + stdout  Rewrite found → mutate command
//   1           No RTK equivalent → pass through unchanged
//   3 + stdout  Rewrite (advisory) → mutate command

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { isToolCallEventType } from "@earendil-works/pi-coding-agent"
import { EXTENSION_NAME, REWRITE_TIMEOUT_MS } from "./constants.ts"
import { rewriteCommand, shouldRewriteCommand } from "./rewrite.ts"
import { checkRtkVersion } from "./version.ts"

export default async function rtkExtension(pi: ExtensionAPI) {
  const version = await pi.exec("rtk", ["--version"], { timeout: REWRITE_TIMEOUT_MS })
  if (version.code !== 0) {
    console.warn(`[${EXTENSION_NAME}] rtk binary not found in PATH — extension disabled`)
    return
  }

  const versionCheck = checkRtkVersion(version.stdout)
  if (!versionCheck.supported) {
    console.warn(`[${EXTENSION_NAME}] ${versionCheck.reason} — extension disabled`)
    return
  }

  pi.on("tool_call", async (event, ctx) => {
    try {
      if (!isToolCallEventType("bash", event)) return

      const command = event.input.command
      if (!shouldRewriteCommand(command)) return

      const rewritten = await rewriteCommand(pi, command, ctx.signal)
      if (rewritten && rewritten !== command) {
        event.input.command = rewritten
      }
    } catch (error) {
      console.warn(`[${EXTENSION_NAME}] unexpected error in tool_call handler; passing through command`, error)
    }
  })
}
