# Dotfiles

My development environment configuration, managed as a dotfiles repository and intended to be installed into `$HOME` with GNU Stow or equivalent symlinking.

## What is included

```text
.
├── .zshrc                  # Zsh shell configuration
├── .vimrc                  # Vim configuration
├── .config/
│   ├── aerospace/          # AeroSpace window manager
│   ├── colima/             # Colima defaults for new virtual machines
│   ├── fd/                 # fd defaults
│   ├── ghostty/            # Ghostty terminal
│   ├── herdr/              # Herdr agent multiplexer
│   ├── lazygit/            # Lazygit configuration
│   ├── nvim/               # Neovim configuration
│   ├── ripgrep/            # ripgrep defaults
│   ├── starship/           # Starship prompt
│   ├── yazi/               # Yazi file manager
│   └── zed/                # Zed editor preferences
├── .pi/
│   ├── agent/              # Pi agent settings, prompts, skills, themes, MCP config, and extensions
│   └── run.sh              # Pi launcher that installs local extension dependencies
├── .gitignore              # Repository ignore rules
├── .gitignore_global       # Global Git ignore rules
├── .hushlogin              # Suppress macOS login message
├── .stow-local-ignore      # Paths excluded from Stow
├── AGENTS.md               # Repository guidance for coding agents
├── LICENSE                 # MIT license
└── README.md
```

## Install

Clone the repository and stow the files into your home directory:

```sh
git clone <repo-url> ~/dotfiles
cd ~/dotfiles
mkdir -p ~/.config/colima
stow .
```

Creating `~/.config/colima` before running Stow keeps Colima's generated virtual-machine state outside the repository while allowing Stow to link the tracked `_templates` directory.

If a target file already exists in `$HOME`, move it aside or merge it into the tracked version in this repository before running Stow.

## Prerequisites

At minimum, install:

1. Zsh
2. NVM
3. Homebrew
4. GNU Stow

## Expected installed packages

These dotfiles reference the following user/system-level tools. Install them as needed for the configs you use:

- Core shell/dev tools: `git`, `gh`, `node`, `npm`, `bun`, `nvm`, `stow`, `zsh`
- Shell quality-of-life tools: `bat`, `eza`, `fd`, `ripgrep`, `starship`, `zoxide`
- Terminal/editor apps: `aerospace`, `ghostty`, `herdr`, `lazygit`, `neovim`, `vim`, `yazi`, `zed`
- Git UI helpers: `diff-so-fancy`
- Container tooling: `colima`, `docker`, `docker-buildx`, `docker-compose`
- Pi agent: `pi` CLI; `.pi/run.sh` uses `npm` to install local extension dependencies automatically
- Zed external formatter: `stylua`
- Android/Java paths in `.zshrc`: Android SDK platform tools and `openjdk@17`
- Fonts: a Nerd Font such as `JetBrainsMonoNL Nerd Font Propo` for terminal and editor icons/glyphs

Not listed here: Neovim language servers, formatters, and linters installed by Mason (`mason-tool-installer.nvim`), and Pi extension package dependencies installed by `.pi/run.sh`.

## Working on these dotfiles

Edit files in this repository rather than changing generated symlinks directly in `$HOME`. For example, update `.zshrc` here instead of `~/.zshrc`, and update Pi agent files under `.pi/agent/` here instead of `~/.pi/agent/`.

## License

MIT
