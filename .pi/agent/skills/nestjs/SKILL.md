---
name: nestjs
description: >-
  Use when implementing or modifying NestJS controllers, services, modules,
  DTOs, entities, guards, interceptors, providers, tests, or backend TypeScript
  support code. Covers NestJS layering, dependency injection, validation,
  errors, and file structure.
---

## File Order

NestJS class files must be:

1. Imports
2. Main class

Do not put functions, constants, interfaces, types, helper classes, or secondary DTO/entity classes above the main class.

## File Boundaries

- For new files, keep one entity per file: one class, DTO, entity, guard, service, or controller.
- When adding reusable utilities, constants, or shared types, put them in local `utils/`, `constants/`, or `types/` locations.
- Do not refactor existing files just to satisfy this guidance unless the touched change would otherwise make the file worse.

## Controllers and Services

Avoid creating god services or god controllers. If a class starts coordinating unrelated business rules, split the logic into smaller services with clear names and responsibilities.

- Extract distinct business logic into separate focused services when it represents a different responsibility, workflow, integration, or domain concept.
- Prefer composition over large procedural methods. A service may orchestrate other focused services when that keeps responsibilities clear.
- Do not introduce extra abstraction for trivial logic; extract only when it improves readability, ownership, or testability.

## Implementation Bias

- Match existing local patterns before inventing new structure.

## Finishing

- Prefer focused TypeScript no-emit compilation checks over full app builds to avoid breaking user's local processes.
- Run focused lint auto-fix and formatting scripts against changed files using project's formatter (e.g., Prettier or Oxfmt).
