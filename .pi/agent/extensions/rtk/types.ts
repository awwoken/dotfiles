export type Semver = readonly [major: number, minor: number, patch: number]

export interface RtkVersionCheck {
  supported: boolean
  reason?: string
}
