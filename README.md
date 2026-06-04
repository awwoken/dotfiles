# Dotfiles

My development environment configuration, managed as a dotfiles repository and intended to be installed into `$HOME` with GNU Stow or equivalent symlinking.

## What is included

```text
.
├── .zshrc                  # Zsh shell configuration
├── .vimrc                  # Vim configuration
├── .config/
│   ├── aerospace/          # AeroSpace window manager
│   ├── fd/                 # fd defaults
│   ├── ghostty/            # Ghostty terminal
│   ├── kitty/              # Kitty terminal
│   ├── lazygit/            # Lazygit configuration
│   ├── nvim/               # Neovim configuration
│   ├── ripgrep/            # ripgrep defaults
│   ├── rtk/                # RTK memory/tooling config
│   ├── starship/           # Starship prompt
│   └── zed/                # Zed editor preferences
├── .pi/
│   ├── agent/              # Pi agent settings, prompts, skills, themes, and extensions
│   └── mcp.json            # Pi MCP server configuration
├── .gitignore_global       # Global Git ignore rules
├── .hushlogin              # Suppress macOS login message
└── README.md
```

## Install

Clone the repository and stow the files into your home directory:

```sh
git clone <repo-url> ~/dotfiles
cd ~/dotfiles
stow .
```

If a target file already exists in `$HOME`, move it aside or merge it into the tracked version in this repository before running Stow.

## Prerequisites

At minimum, install:

1. Zsh
2. NVM
3. Homebrew
4. GNU Stow

Additional tools are configured here, but can be installed incrementally as needed.

## macOS preferences

Reduce Dock auto-hide delay:

```sh
defaults write com.apple.dock autohide-delay -float 0
killall Dock
```

Speed up keyboard repeat:

```sh
defaults write -g InitialKeyRepeat -float 10.0 # normal minimum is 15 (225 ms)
defaults write -g KeyRepeat -float 1.0        # normal minimum is 2 (30 ms)
```

Disable press-and-hold character suggestions:

```sh
defaults write -g ApplePressAndHoldEnabled -bool false
```

## Working on these dotfiles

Edit files in this repository rather than changing generated symlinks directly in `$HOME`. For example, update `.zshrc` here instead of `~/.zshrc`, and update Pi agent files under `.pi/agent/` here instead of `~/.pi/agent/`.

## License

MIT
