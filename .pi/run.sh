#!/usr/bin/env bash
set -euo pipefail

pi_config_root="$(cd -- "$(dirname -- "$(realpath "${BASH_SOURCE[0]}")")" && pwd)"
export PATH="$pi_config_root/agent/bin:$PATH"

log() {
  printf '%s\n' "$*" >&2
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

install_extension_deps_in_dir() {
  local extension_dir="$1"
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
    npm install --package-lock=false --no-audit --no-fund --prefix "$extension_dir"
    mkdir -p "$extension_dir/node_modules"
    touch "$marker"
  )
}

install_local_extension_deps() {
  local root package_json extension_dir

  [ "${PI_SKIP_EXTENSION_INSTALL:-0}" = "1" ] && return 0

  command -v npm >/dev/null 2>&1 || fail "npm is required to install extension dependencies"

  for root in "$HOME/.pi/agent/extensions" "$PWD/.pi/extensions"; do
    [ -d "$root" ] || continue

    for package_json in "$root"/*/package.json; do
      [ -f "$package_json" ] || continue
      extension_dir="$(dirname "$package_json")"
      install_extension_deps_in_dir "$extension_dir"
    done
  done
}

configure_github_token() {
  local token

  if [ -n "${GH_TOKEN:-}" ] || [ -n "${GITHUB_TOKEN:-}" ]; then
    return 0
  fi

  command -v gh >/dev/null 2>&1 || return 0

  if token="$(gh auth token 2>/dev/null)" && [ -n "$token" ]; then
    export GH_TOKEN="$token"
  else
    log "warning: unable to retrieve GitHub token from gh; authenticated gh commands may fail in Pi"
  fi
}

append_git_config() {
  local key="$1"
  local value="$2"
  local index="${GIT_CONFIG_COUNT:-0}"

  export "GIT_CONFIG_KEY_$index=$key"
  export "GIT_CONFIG_VALUE_$index=$value"
  export GIT_CONFIG_COUNT="$((index + 1))"
}

configure_git_for_github() {
  append_git_config "url.https://github.com/.insteadOf" "git@github.com:"
  append_git_config "url.https://github.com/.insteadOf" "ssh://git@github.com/"
  append_git_config "credential.helper" ""
  append_git_config "credential.helper" "gh-token"
  append_git_config "commit.gpgsign" "false"
}

prepare_sandbox_runtime() {
  mkdir -p /tmp/claude
}

main() {
  command -v pi >/dev/null 2>&1 || fail "pi CLI was not found in PATH"

  install_local_extension_deps
  configure_github_token
  configure_git_for_github
  prepare_sandbox_runtime

  exec pi "$@"
}

main "$@"
