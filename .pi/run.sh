#!/usr/bin/env bash
set -euo pipefail

PI_NPM_PACKAGE="${PI_NPM_PACKAGE:-@earendil-works/pi-coding-agent}"
PI_BOOTSTRAP_NODE_VERSION="${PI_BOOTSTRAP_NODE_VERSION:-22.19.0}"
NVM_DIR="${NVM_DIR:-$HOME/.config/nvm}"

log() {
  printf '%s\n' "$*" >&2
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

load_nvm() {
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    return
  fi

  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    return
  fi

  fail "nvm is required but was not found at \$NVM_DIR/nvm.sh or \$HOME/.nvm/nvm.sh"
}

semver_from_range() {
  printf '%s\n' "$1" | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true
}

find_existing_pi_package_json() {
  if [ -n "${PI_PACKAGE_JSON:-}" ] && [ -f "$PI_PACKAGE_JSON" ]; then
    printf '%s\n' "$PI_PACKAGE_JSON"
    return
  fi

  if [ -d "$NVM_DIR/versions/node" ]; then
    find "$NVM_DIR/versions/node" \
      -path "*/lib/node_modules/@earendil-works/pi-coding-agent/package.json" \
      -type f 2>/dev/null | sort | tail -n 1
  fi
}

read_node_engine_from_package_json() {
  local package_json="$1"
  sed -nE 's/.*"node"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$package_json" | head -n 1
}

initial_node_version() {
  local package_json engine version
  package_json="$(find_existing_pi_package_json || true)"

  if [ -n "$package_json" ] && [ -f "$package_json" ]; then
    engine="$(read_node_engine_from_package_json "$package_json" || true)"
    version="$(semver_from_range "$engine")"
    if [ -n "$version" ]; then
      printf '%s\n' "$version"
      return
    fi
  fi

  printf '%s\n' "$PI_BOOTSTRAP_NODE_VERSION"
}

ensure_node() {
  local version="$1"
  local node_bin

  node_bin="$(nvm which "$version" 2>/dev/null || true)"
  if [ "$node_bin" = "N/A" ] || [ ! -x "$node_bin" ]; then
    log "installing Node $version"
    nvm install "$version" >/dev/null
    node_bin="$(nvm which "$version")"
  fi

  [ -x "$node_bin" ] || fail "could not find Node $version after install"
  printf '%s\n' "$node_bin"
}

npm_for_node() {
  local node_bin="$1"
  local npm_bin
  npm_bin="$(dirname "$node_bin")/npm"
  [ -x "$npm_bin" ] || fail "npm not found next to $node_bin"
  printf '%s\n' "$npm_bin"
}

package_dir_for_npm() {
  local npm_bin="$1"
  local npm_root
  npm_root="$("$npm_bin" root -g)"
  printf '%s/%s\n' "$npm_root" "$PI_NPM_PACKAGE"
}

ensure_pi_installed() {
  local npm_bin="$1"
  local package_dir
  package_dir="$(package_dir_for_npm "$npm_bin")"

  if [ ! -f "$package_dir/package.json" ]; then
    log "installing $PI_NPM_PACKAGE"
    "$npm_bin" install -g --no-audit --no-fund --min-release-age=0 "$PI_NPM_PACKAGE"
  fi

  [ -f "$package_dir/package.json" ] || fail "Pi package was not installed at $package_dir"
  printf '%s\n' "$package_dir"
}

read_installed_required_node_version() {
  local node_bin="$1"
  local package_json="$2"
  local engine version

  engine="$($node_bin -e 'const fs=require("node:fs"); const pkg=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(pkg.engines?.node ?? "");' "$package_json")"
  version="$(semver_from_range "$engine")"
  [ -n "$version" ] || version="$PI_BOOTSTRAP_NODE_VERSION"
  printf '%s\n' "$version"
}

install_extension_deps_in_dir() {
  local extension_dir="$1"
  local npm_bin="$2"
  local package_json="$extension_dir/package.json"
  local marker="$extension_dir/node_modules/.pi-install-marker"
  local lock_dir="$extension_dir/.pi-install.lock"
  local waited=0

  [ -f "$package_json" ] || return 0

  if [ "${PI_FORCE_EXTENSION_INSTALL:-0}" != "1" ] && \
     [ -d "$extension_dir/node_modules" ] && \
     [ -f "$marker" ] && \
     [ ! "$package_json" -nt "$marker" ]; then
    return 0
  fi

  while ! mkdir "$lock_dir" 2>/dev/null; do
    waited=$((waited + 1))
    if [ "$waited" -gt 60 ]; then
      fail "timed out waiting for extension install lock: $lock_dir"
    fi
    sleep 1
  done

  (
    trap 'rmdir "$lock_dir" 2>/dev/null || true' EXIT

    if [ "${PI_FORCE_EXTENSION_INSTALL:-0}" != "1" ] && \
       [ -d "$extension_dir/node_modules" ] && \
       [ -f "$marker" ] && \
       [ ! "$package_json" -nt "$marker" ]; then
      exit 0
    fi

    log "installing local extension dependencies in $extension_dir"
    "$npm_bin" install --package-lock=false --no-audit --no-fund --prefix "$extension_dir"
    mkdir -p "$extension_dir/node_modules"
    touch "$marker"
  )
}

install_local_extension_deps() {
  local npm_bin="$1"
  local root package_json extension_dir

  [ "${PI_SKIP_EXTENSION_INSTALL:-0}" = "1" ] && return 0

  for root in "$HOME/.pi/agent/extensions" "$PWD/.pi/extensions"; do
    [ -d "$root" ] || continue

    for package_json in "$root"/*/package.json; do
      [ -f "$package_json" ] || continue
      extension_dir="$(dirname "$package_json")"
      install_extension_deps_in_dir "$extension_dir" "$npm_bin"
    done
  done
}

pi_cli_for_package_dir() {
  local node_bin="$1"
  local package_dir="$2"
  local bin_path

  bin_path="$($node_bin -e 'const fs=require("node:fs"); const path=require("node:path"); const pkg=JSON.parse(fs.readFileSync(path.join(process.argv[1], "package.json"), "utf8")); const bin=typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.pi; if (!bin) process.exit(1); process.stdout.write(path.join(process.argv[1], bin));' "$package_dir")"
  [ -f "$bin_path" ] || fail "Pi CLI not found at $bin_path"
  printf '%s\n' "$bin_path"
}

main() {
  local required_version node_bin npm_bin package_dir installed_required_version pi_cli

  load_nvm

  required_version="$(initial_node_version)"
  node_bin="$(ensure_node "$required_version")"
  npm_bin="$(npm_for_node "$node_bin")"
  package_dir="$(ensure_pi_installed "$npm_bin")"

  installed_required_version="$(read_installed_required_node_version "$node_bin" "$package_dir/package.json")"
  if [ "$installed_required_version" != "$required_version" ]; then
    required_version="$installed_required_version"
    node_bin="$(ensure_node "$required_version")"
    npm_bin="$(npm_for_node "$node_bin")"
    package_dir="$(ensure_pi_installed "$npm_bin")"
  fi

  install_local_extension_deps "$npm_bin"

  pi_cli="$(pi_cli_for_package_dir "$node_bin" "$package_dir")"
  exec "$node_bin" "$pi_cli" "$@"
}

main "$@"
