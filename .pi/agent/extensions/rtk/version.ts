import { MIN_SUPPORTED_RTK_VERSION } from "./constants.ts"
import type { RtkVersionCheck, Semver } from "./types.ts"

const MIN_SUPPORTED_RTK_SEMVER: Semver = parseSemver(MIN_SUPPORTED_RTK_VERSION) ?? [0, 23, 0]

export function parseSemver(raw: string): Semver | null {
  const match = raw.trim().match(/(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null

  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  ]
}

function compareSemver(left: Semver, right: Semver): number {
  if (left[0] !== right[0]) return left[0] - right[0]
  if (left[1] !== right[1]) return left[1] - right[1]
  return left[2] - right[2]
}

export function checkRtkVersion(versionOutput: string): RtkVersionCheck {
  const parsed = parseSemver(versionOutput.replace(/^rtk\s+/, ""))
  if (!parsed) return { supported: true }

  if (compareSemver(parsed, MIN_SUPPORTED_RTK_SEMVER) < 0) {
    return {
      supported: false,
      reason: `${versionOutput.trim()} is too old (need >= ${MIN_SUPPORTED_RTK_VERSION})`,
    }
  }

  return { supported: true }
}
