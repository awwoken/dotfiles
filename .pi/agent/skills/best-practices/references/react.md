# React

## File Order

React component files must be:

1. Imports
2. Props type only
3. Component
4. React Native styles object only, when applicable

Do not put utility functions, constants, shared types, render helpers, or table/mapper logic above the component. A React Native component may keep one component-specific styles object after the component, normally created with `StyleSheet.create(...)`.

## File Boundaries

- For new files, keep one entity per file: one component, hook, page, API wrapper, or store.
- Component files may contain imports, the component's props type, and the component. A React Native component may also contain one component-specific styles object after the component. Do not add any other local types, interfaces, constants, utility functions, render helpers, mappers, option arrays, schemas, or secondary components to the component file just because the change is small.
- The React Native styles exception applies only to static styles used exclusively by that component. Shared styles, theme tokens, dynamic styling helpers, and non-style constants belong in the appropriate support file.
- When a change needs a helper, mapper, derived-data function, option/config object, constant, shared type, local type, schema, or secondary component, put it in an appropriately named sibling file or existing local `utils/`, `constants/`, `types`, `schemas/`, `mappers/`, `hooks/`, or feature-specific support location.
- Do not inline ad-hoc type aliases or interfaces in component, hook, route, page, screen, API wrapper, or store files, except for the component's own props type in a component file.
- Existing violations may remain if unrelated, but do not add to them. If the touched change needs new support code, create the correct file boundary instead of expanding the existing mixed file.

## File Paths and Names

A file's full path must make its responsibility clear without requiring someone to open it.

- Put support files in an established responsibility directory such as `constants/`, `utils/`, `types/`, `schemas/`, `mappers/`, `hooks/`, or `components/`.
- Responsibility suffixes do not permit mixing different responsibilities in one folder. A flat module using explicit established suffixes such as `.constants.ts`, `.mapper.ts`, or `.schema.ts` is acceptable only when the module is very small and contains at most one file for each responsibility.
- When a module has multiple files for one responsibility, organize them under the corresponding responsibility directory.
- Do not place an ambiguously named support file directly under a feature or module directory when its role is not evident from the path.
- Name the file for its domain content and use its directory or suffix to identify its responsibility.

## No Small-Change Exemption

These file-boundary rules apply regardless of size. A one-line helper, tiny option list, single conditional mapper, one-off render helper, or single-use type is still support code and must not be added inline to a component/hook/page/route/screen/API-wrapper/store file.

Calling support code local, private, small, single-use, or close to its usage does not permit keeping it in the implementation file.

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

Component-local state, effects, and callbacks are appropriate only when they directly implement private rendering or interaction behavior with no outside meaning, like a local menu, focused control, transient dialog mode, measurement, or animation affordance. This exception does not permit separate top-level utility functions, constants, types, helpers, mappers, option arrays, schemas, render functions, or secondary components in the component file.

Before introducing a new local pattern, inspect the nearest existing pattern for the same responsibility. If you still add one, state why the existing owner is insufficient.

## Implementation Bias

- Match existing project patterns before inventing new structure.

## Finishing

- Prefer focused TypeScript no-emit compilation checks over full app builds to avoid breaking user's local processes.
- Run focused lint auto-fix and formatting scripts against changed files using project's formatter (e.g., Prettier or Oxfmt).
