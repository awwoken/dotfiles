# Environment Variables & PATH Configuration
export EDITOR="nvim"

# Homebrew
export PATH=$(brew --prefix)/bin:$(brew --prefix)/sbin:$PATH
export HOMEBREW_NO_ENV_HINTS=1

# Local bin
export PATH="$HOME/.local/bin:$PATH"

# Bun
# export PATH="/Users/andromeda/.bun/bin:$PATH"

# LazyGit (git TUI)
export XDG_CONFIG_HOME="$HOME/.config"

# # NVM (Node Version Manager)
export NVM_DIR="$HOME/.config/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

autoload -U add-zsh-hook

load-nvmrc() {
  local node_version=$(nvm version)
  local nvmrc_path="$(nvm_find_nvmrc)"

  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version=$(cat "$nvmrc_path")

    if [ "$nvmrc_node_version" != "$node_version" ]; then
      nvm use --silent "$nvmrc_node_version"
    fi
  fi
}

add-zsh-hook chpwd load-nvmrc
load-nvmrc

# Pi coding agent. Installs/runs Pi using the Node version required by the Pi npm package.
pi() {
  local pi_package="@earendil-works/pi-coding-agent"
  local pi_cmd="pi"

  if [[ ! $(type nvm 2>/dev/null) ]]; then
    echo "nvm is required to install/run Pi's required Node runtime" >&2
    return 127
  fi

  local node_engine node_version node_bin npm_bin node_prefix pi_shim pi_cli

  node_engine="$(npm view "$pi_package" engines.node --silent 2>/dev/null)" || {
    echo "Could not read Pi's required Node version from npm" >&2
    return 1
  }

  node_version="$(printf '%s\n' "$node_engine" | sed -nE 's/.*>= ?v?([0-9]+(\.[0-9]+){0,2}).*/\1/p')"

  if [[ -z "$node_version" ]]; then
    echo "Could not parse Pi's required Node version: $node_engine" >&2
    return 1
  fi

  node_bin="$(nvm which "$node_version" 2>/dev/null)"

  if [[ "$node_bin" == "N/A" || ! -x "$node_bin" ]]; then
    (
      nvm install "$node_version"
    ) || return
  
    node_bin="$(nvm which "$node_version" 2>/dev/null)" || return
  fi

  npm_bin="${node_bin:h}/npm"
  node_prefix="$("$npm_bin" prefix -g 2>/dev/null)" || return
  pi_shim="$node_prefix/bin/$pi_cmd"

  if [[ ! -x "$pi_shim" ]]; then
    "$npm_bin" install -g \
      --ignore-scripts \
      --min-release-age=0 \
      --no-fund \
      --no-audit \
      "$pi_package" || return
  fi

  pi_cli="$pi_shim"

  if [[ -L "$pi_cli" ]]; then
    local target
    target="$(readlink "$pi_cli")"
    [[ "$target" == /* ]] && pi_cli="$target" || pi_cli="${pi_cli:h}/$target"
  fi

  local pi_cli_dir
  pi_cli_dir="${pi_cli:h:A}" || return
  pi_cli="$pi_cli_dir/${pi_cli:t}"

  if [[ ! -f "$pi_cli" ]]; then
    echo "pi CLI not found at $pi_cli" >&2
    return 127
  fi

  "$node_bin" "$pi_cli" "$@"
}

# Zoxide (smart directory navigation)
if command -v zoxide &>/dev/null; then
  eval "$(zoxide init zsh)"
  alias cd="z"
fi

# Starship prompt (no new line after clear)
export STARSHIP_CONFIG="$HOME/.config/starship/starship.toml"

if command -v starship &>/dev/null; then
  PROMPT_NEEDS_NEWLINE=false

  function precmd() {
    if [[ "$PROMPT_NEEDS_NEWLINE" == true ]]; then
      echo
    fi
    PROMPT_NEEDS_NEWLINE=true
  }

  function clear() {
    PROMPT_NEEDS_NEWLINE=false
    command clear
  }

  eval "$(starship init zsh)"
fi

# Ripgrep
export RIPGREP_CONFIG_PATH=~/.config/ripgrep/.ripgreprc

# Brew (managed by tap)
export HOMEBREW_NO_AUTO_UPDATE=1

# Eza (enhanced directory listing)
alias l="eza -A --oneline --long --group-directories-first --classify=auto --color=never --ignore-glob=\"node_modules\" --ignore-glob=\".git\""

# Git Basic Aliases
alias gs="git status --short"
alias gi="git init"
alias gcb="git checkout -b"

# Git Advanced Aliases
alias gl="git log --graph --pretty=format:\"%C(magenta)%h %C(white) %an  %ar%C(blue)  %D%n%s%n\""
alias gpo="git push origin \$(git rev-parse --abbrev-ref HEAD)"
alias gpfo="git push origin \$(git rev-parse --abbrev-ref HEAD) --force-with-lease"

# Git Functions
git_add() {
  if [ $# -eq 0 ]; then
    git add .
  else
    git add "$@"
  fi
}
alias ga="git_add"

git_commit_message() {
  git commit --message "$*"
}
alias gcm="noglob git_commit_message"

git_soft_reset_copy() {
  msg="$(git log -1 --pretty=%B | sed '$d')"
  echo -n "$msg" | pbcopy
  git reset --soft HEAD~1
}
alias grs="git_soft_reset_copy"

git_checkout_hard() {
  local branch="$1"
  if [ -z "$branch" ]; then
    echo "Usage: gch <branch-name>"
    return 1
  fi
  git reset --hard
  git checkout "$branch"
  git pull origin "$branch"
}
alias gch="git_checkout_hard"

# Shortcuts
alias lg="lazygit"
alias c="clear"
alias n="nvim"

# Yazi
function y() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	yazi "$@" --cwd-file="$tmp"
	IFS= read -r -d '' cwd < "$tmp"
	[ -n "$cwd" ] && [ "$cwd" != "$PWD" ] && builtin cd -- "$cwd"
	rm -f -- "$tmp"
}

# Handle brackets
for cmd in sed cat rg bat; do
  eval "$cmd() { noglob command $cmd \"\$@\" }"
done

# Android Studio
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export JAVA_HOME="$(brew --prefix)/opt/openjdk@17"

# # OpenClaw Completion
# source "/Users/andromeda/.openclaw/completions/openclaw.zsh"

export DOCKER_CLI_HINTS=false


[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
