---
name: best-practices
description: >-
  Use when implementing, modifying, reviewing, or fixing application code that
  involves React, React Native, Next.js, NestJS, translated content, i18n,
  linting, formatting, static analysis, or type checking. Loads only the
  relevant technology-specific engineering references.
---

# Best practices

Determine which technologies and concerns the task affects, then read every matching reference before acting. Do not load unrelated references.

| When the task involves                                                                                               | Read                   |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| React, React Native, Next.js, components, hooks, pages, routes, screens, client API wrappers, or related TypeScript  | `references/react.md`  |
| NestJS controllers, services, modules, DTOs, entities, guards, interceptors, providers, tests, or backend TypeScript | `references/nestjs.md` |
| Translated user-facing text, translation keys, localization logic, ICU messages, locale files, or parameterized copy | `references/i18n.md`   |
| Linting, formatting, static analysis, or type-checking errors                                                        | `references/lint.md`   |

Multiple references may apply to one task. Resolve their paths relative to this skill directory and load them with the read tool.

## Required workflow

The references are mandatory constraints, not suggestions.

Before implementation:

1. Read every applicable reference.
2. Treat every `must` and `do not` rule as an acceptance criterion.

After implementation, before reporting completion:

1. Re-read every applicable reference.
2. Review the complete diff against every rule.
3. Fix every violation before finishing.
4. Do not treat passing tests, type checks, linting, or formatting as proof that the implementation follows the references.

"Local," "private," "small," "single-use," "temporary," and "close to its usage" are not exceptions unless a reference explicitly says otherwise.

Follow explicit user direction and project instructions when they conflict with a reference. Otherwise, apply the relevant reference while matching established local patterns.
