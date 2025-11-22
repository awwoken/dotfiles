# =============================================================================
# ZSH Configuration File
# =============================================================================

# -----------------------------------------------------------------------------
# Environment Variables & PATH Configuration
# -----------------------------------------------------------------------------
export EDITOR="vim"

alias mini='NVIM_APPNAME="mini-nvim" nvim'
alias lazy='NVIM_APPNAME="lazy-nvim" nvim'

# -----------------------------------------------------------------------------
# Tool Configuration & Initialization
# -----------------------------------------------------------------------------

# Homebrew
export PATH=$(brew --prefix)/bin:$(brew --prefix)/sbin:$PATH
export HOMEBREW_NO_ENV_HINTS=1

# LazyGit
export XDG_CONFIG_HOME="$HOME/.config"

# NVM (Node Version Manager)
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  \. "$NVM_DIR/nvm.sh"
fi

# Zoxide (smart directory navigation)
if command -v zoxide &>/dev/null; then
  eval "$(zoxide init zsh)"
  alias cd="z"
fi

# Starship prompt (no new line after clear)
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

# -----------------------------------------------------------------------------
# Git Configuration
# -----------------------------------------------------------------------------

# Git Basic Aliases
alias gs="git status --short"
alias gi="git init"
alias gcb="git checkout -b"

# Git Advanced Aliases
alias gl="git log --graph --pretty=format:\"%C(magenta)%h %C(white) %an  %ar%C(blue)  %D%n%s%n\""
alias gd="git diff --output-indicator-new=\" \" --output-indicator-old=\" \""
alias gpo="git push origin \$(git rev-parse --abbrev-ref HEAD)"

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
alias gcm="git_commit_message"

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

# -----------------------------------------------------------------------------
# File Operations & Directory Navigation
# -----------------------------------------------------------------------------

# Enhanced directory listing with eza
if command -v eza &>/dev/null; then
  alias l="eza -A --oneline --long --group-directories-first --classify=auto --color=never --ignore-glob=\"node_modules\" --ignore-glob=\".git\""
else
  alias l="ls -la"
fi

# -----------------------------------------------------------------------------
# General Shortcuts & Utilities
# -----------------------------------------------------------------------------
alias lg="lazygit"
alias c="clear"

# =============================================================================
# End of Configuration
# =============================================================================
