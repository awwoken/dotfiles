# lsp-tools

Pi extension that exposes focused semantic code-navigation tools backed by local Language Server Protocol servers.

## Tools

- `lsp_document_symbols` — list semantic symbols in a file.
- `lsp_go_to_definition` — find the definition of a symbol at a specific line.
- `lsp_find_references` — find semantic references for a symbol at a specific line.
- `lsp_hover` — show type, signature, or documentation details for a symbol.
- `lsp_workspace_symbols` — search semantic symbols across a workspace.
- `lsp_type_definition` — find the type definition behind a symbol.
- `lsp_implementation` — find concrete implementations of a symbol.

The tools are read-only. Rename/workspace edits are intentionally not included yet.

## Setup

This dotfiles repo's `.pi/run.sh` Pi launcher installs dependencies for local extensions with `package.json` before starting Pi.

If you start Pi without that launcher and dependencies are missing, run the fallback manually from this directory:

```sh
npm install --package-lock=false
```

The TypeScript native preview language server is bundled as an extension dependency, so TypeScript/JavaScript projects do not need to install a TypeScript LSP server themselves.

## Built-in servers

### TypeScript / JavaScript

Uses the first available `tsgo` native preview language server in this order:

1. target project `node_modules/.bin`
2. this extension's `node_modules/.bin`
3. `PATH`

Defaults:

```json
{
  "command": "tsgo",
  "args": ["--lsp", "--stdio"],
  "fileTypes": [".ts", ".tsx", ".js", ".jsx"],
  "rootMarkers": ["package.json", "tsconfig.json", "jsconfig.json"],
  "languageIds": {
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".js": "javascript",
    ".jsx": "javascriptreact"
  }
}
```

### Rust

Uses `rust-analyzer` from `PATH`.

Defaults:

```json
{
  "command": "rust-analyzer",
  "args": [],
  "fileTypes": [".rs"],
  "rootMarkers": ["Cargo.toml", "rust-project.json"],
  "languageId": "rust"
}
```

## Workspace roots

For each target file, the extension walks upward from the file's directory toward Pi's current working directory and chooses the nearest directory containing one of the configured `rootMarkers`.

That resolved root is used as the LSP workspace root and client cache key. This keeps monorepo packages isolated from one another.

## Configuration

Optional config files, highest priority last:

1. `~/.pi/agent/lsp-tools.json`
2. `<cwd>/lsp-tools.json`
3. `<cwd>/.pi/lsp-tools.json`

Example adding Go:

```json
{
  "servers": {
    "go": {
      "command": "gopls",
      "args": ["serve"],
      "fileTypes": [".go"],
      "rootMarkers": ["go.mod", "go.work"],
      "languageId": "go"
    }
  }
}
```

Example overriding TypeScript:

```json
{
  "servers": {
    "typescript": {
      "command": "tsgo",
      "args": ["--lsp", "--stdio"],
      "fileTypes": [".ts", ".tsx", ".js", ".jsx"],
      "rootMarkers": ["package.json", "tsconfig.json", "jsconfig.json"],
      "languageIds": {
        ".ts": "typescript",
        ".tsx": "typescriptreact",
        ".js": "javascript",
        ".jsx": "javascriptreact"
      }
    }
  }
}
```

Set `disabled: true` on a server to disable it.

## Usage examples

```text
Use lsp_document_symbols on src/index.ts
```

```text
Use lsp_go_to_definition on src/index.ts line 12 symbol createClient
```

```text
Use lsp_find_references on src/index.ts line 12 symbol createClient
```

```text
Use lsp_hover on src/index.ts line 12 symbol createClient
```

```text
Use lsp_workspace_symbols from src/index.ts query createClient
```

```text
Use lsp_type_definition on src/index.ts line 12 symbol createClient
```

```text
Use lsp_implementation on src/index.ts line 12 symbol createClient
```

If a line contains the same symbol more than once, use a suffix:

```text
Use lsp_go_to_definition on src/index.ts line 20 symbol foo#2
```

## Notes

- Position handling is UTF-16 only, matching the LSP default.
- Non-`file://` URIs are rejected.
- Files outside Pi's current workspace are rejected.
- Large result sets are truncated in formatted output.
