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
- Component files may contain imports, the component's props type, and the component. Do not add any other local types, interfaces, constants, utility functions, render helpers, mappers, option arrays, schemas, or secondary components to the component file just because the change is small.
- When a change needs a helper, mapper, derived-data function, option/config object, constant, shared type, local type, schema, or secondary component, put it in an appropriately named sibling file or existing local `utils/`, `constants/`, `types`, `schemas/`, `mappers/`, `hooks/`, or feature-specific support location.
- Do not inline ad-hoc type aliases or interfaces in component, hook, route, page, screen, API wrapper, or store files, except for the component's own props type in a component file.
- Existing violations may remain if unrelated, but do not add to them. If the touched change needs new support code, create the correct file boundary instead of expanding the existing mixed file.

## No Small-Change Exemption

These file-boundary rules apply regardless of size. A one-line helper, tiny option list, single conditional mapper, one-off render helper, or single-use type is still support code and must not be added inline to a component/hook/page/route/screen/API-wrapper/store file.

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
