This is a personal dotfiles repository. Files here are intended to be installed into the user’s home directory with GNU Stow or equivalent symlinking.

## Working rule

When asked to change a global/user-level config, edit the tracked file in this repository instead of editing or moving files directly under `~/...`.

Examples:

- Change Pi global agent config/extensions in `./.pi/agent/`, not `~/.pi/agent/`.
- Change shell config in `./.zshrc`, not `~/.zshrc`.
- Change Neovim config in `./.config/nvim/`, not `~/.config/nvim/`.

Avoid modifying generated dependencies, caches, or installed package contents unless explicitly requested.

## Structure overview

- `./.pi/agent/` — Pi agent prompts, skills, and extensions.
- `./.zshrc` — Zsh shell configuration.
- `./.vimrc` — Vim configuration.
- `./.gitignore_global` — Global Git ignore rules.
- `./.hushlogin` — Suppresses macOS login messages.
- `./.config/` — XDG application configuration:
  - `aerospace/` — AeroSpace window manager.
  - `ghostty/` — Ghostty terminal emulator config.
  - `nvim/` — Neovim configuration.
  - `lazygit/` — Lazygit configuration.
  - `starship/` — Starship prompt configuration.
  - `fd/`, `ripgrep/` — CLI search tool configs.
  - `zed/` — Zed editor configuration.

