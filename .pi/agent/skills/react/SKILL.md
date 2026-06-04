---
name: react
description: >-
  Use when implementing or modifying React, React Native, or Next.js UI,
  components, hooks, pages, routes, screens, client API wrappers, tests, or
  TypeScript support files. Covers component structure, state and effects,
  styling integration, and validation.
---

## File Order

React component files must be:

1. Imports
2. Props type only
3. Component

Do not put utility functions, constants, shared types, render helpers, or table/mapper logic above the component.

## File Boundaries

- For new files, keep one entity per file: one component, hook, page, API wrapper, or store.

- When adding reusable utilities, constants, or shared types, put them in existing local `utils/`, `constants/`, or `types` locations.
- Do not refactor existing files just to satisfy this guidance unless the touched change would otherwise make the file worse.

## Responsibility Placement

Before adding state, effects, callbacks, helpers, conditionals, derived values, or prop plumbing, identify the smallest existing owner for that responsibility.

Logic usually does not belong as one-off component-local code when it:

- Reads or updates data owned outside the component.
- Affects persistence, validation, submission, reset, discard, routing, permissions, cache behavior, or parent/sibling-visible behavior.
- Must stay consistent across route, selected item, query, or context changes.
- Duplicates an existing hook, store, reducer, context, mapper, utility, constants file, schema, or declarative model.
- Hardcodes a case where nearby code already uses keyed, mapped, or model-based patterns.

Use the existing owner when one matches:

- Interaction/domain state -> hook, store, reducer, or context.
- Server/cache behavior -> query or data-access layer.
- Routing behavior -> route params, search params, or router layer.
- Pure calculation -> utility.
- Stable options/configuration -> constants or declarative model.
- Shared shapes -> types or schema.

Component-local code is appropriate only for private rendering or interaction details with no outside meaning, like a local menu, focused control, transient dialog mode, measurement, or animation affordance.

Before introducing a new local pattern, inspect the nearest existing pattern for the same responsibility. If you still add one, state why the existing owner is insufficient.

## Implementation Bias

- Match existing project patterns before inventing new structure.

## Finishing

- Prefer focused TypeScript no-emit compilation checks over full app builds to avoid breaking user's local processes.
- Run focused lint auto-fix and formatting scripts against changed files using project's formatter (e.g., Prettier or Oxfmt).
