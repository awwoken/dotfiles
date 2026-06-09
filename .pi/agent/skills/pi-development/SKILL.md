---
name: pi-development
description: >-
  Use when the user asks about Pi itself, Pi docs, skills, extensions, themes, SDK integrations,
  TUI APIs, keybindings, prompt templates, custom providers, models, packages, or how to design
  Pi workflows.
---

## Pi Documentation

Pi documentation is installed locally.

Reference locations:

- Main documentation:
  `~/.config/nvm/versions/node/v22.19.0/lib/node_modules/@earendil-works/pi-coding-agent/README.md`
- Additional docs:
  `~/.config/nvm/versions/node/v22.19.0/lib/node_modules/@earendil-works/pi-coding-agent/docs/`
- Examples:
  `~/.config/nvm/versions/node/v22.19.0/lib/node_modules/@earendil-works/pi-coding-agent/examples/`

When working on a Pi topic, read the smallest relevant documentation first.

Common doc map:

- Extensions: `docs/extensions.md`, `examples/extensions/`
- Themes: `docs/themes.md`
- Skills: `docs/skills.md`
- Prompt templates: `docs/prompt-templates.md`
- TUI components: `docs/tui.md`
- Keybindings: `docs/keybindings.md`
- SDK integrations: `docs/sdk.md`
- Custom providers: `docs/custom-provider.md`
- Models: `docs/models.md`
- Packages: `docs/packages.md`

Resolve `docs/...` paths relative to the Additional docs directory and `examples/...` paths relative to the Examples directory, not the current working directory.

## Operating Mode

Before implementing Pi changes:

1. Clarify whether the user wants explanation, design, or code changes.
2. State assumptions and tradeoffs when requirements are ambiguous.
3. Read the relevant Pi docs before editing.
4. Keep changes surgical and aligned with existing Pi conventions.

Do not modify Pi configuration, extensions, skills, or package files unless the user explicitly asks for implementation.

## Extension Design

Prefer modular, maintainable extensions.

Keep `index.ts` boring: it should compose and register pieces, not contain most logic.

Separate responsibilities into focused files when useful:

- rendering
- types
- constants
- schemas
- tools
- utility functions
- command handlers
- state management

Avoid coupling extensions directly to each other. Extensions should remain generic and reusable.

When multiple extensions need to participate in one workflow, describe or encode that workflow in a skill instead of hardwiring the extensions together.

## Skill Design

Skills should be small, reusable, and triggerable.

A good skill:

- gives clear "when to use" guidance
- has a specific `description`
- captures non-obvious workflow rules
- avoids generic instructions the agent already knows
- starts small and grows only when repeated use proves the need

Avoid writing huge skills full of generic best practices. Prefer concise instructions that change agent behavior in a concrete way.

## Composition Principle

Use extensions for reusable capabilities.

Use skills for task-specific workflows, conventions, and orchestration.

If behavior depends on project intent, user preference, or multi-step coordination, it probably belongs in a skill rather than inside an extension.

## Pi-Native Recommendations

When suggesting changes to Pi behavior, describe them using Pi concepts rather than generic agent instructions.

Prefer:

- "add an extension" for reusable capabilities, tools, commands, UI, or integrations
- "change a skill" for task-specific workflow guidance, conventions, or orchestration
- "update a prompt template" for reusable prompt structure changes
- "add or change keybindings" for keyboard workflow changes
- "configure a model/provider" for model or provider behavior

Avoid vague phrasing like:

- "tell the agent to..."
- "make the assistant..."
- "instruct the AI to..."

Instead, name the Pi artifact that should carry the behavior and briefly explain why that artifact is the right layer.

## Finishing Changes

After modifying Pi-related code or markdown, including README files, format the changed code and markdown before finishing when a formatter is available.

After modifying Pi extension TypeScript code, run the relevant type-check command when available before finishing. If type-checking is unavailable or skipped, state why.
