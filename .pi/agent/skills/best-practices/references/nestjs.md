# NestJS

## File Order

NestJS class files must be:

1. Imports
2. Main class

Do not put functions, constants, interfaces, types, helper classes, or secondary DTO/entity classes above the main class.

## File Boundaries

- For new files, keep one entity per file: one class, DTO, entity, guard, service, or controller.
- Do not add new functions, constants, interfaces, types, helper classes, secondary DTOs, or secondary entities to a service/controller/module/provider file just because the change is small.
- When a change needs a helper, mapper, utility, constant, shared type, local type, or supporting class, put it in an appropriately named sibling file or local `utils/`, `constants/`, `types/`, `mappers/`, or feature-specific support location.
- Do not inline ad-hoc type aliases or interfaces in implementation files. DTOs, entities, request/response shapes, and reusable/internal support types belong in their own files or established local type/schema locations.
- Existing violations may remain if unrelated, but do not add to them. If the touched change needs new support code, create the correct file boundary instead of expanding the existing mixed file.

## File Paths and Names

A file's full path must make its responsibility clear without requiring someone to open it.

- Put support files in an established responsibility directory such as `constants/`, `utils/`, `types/`, `schemas/`, or `mappers/`.
- Responsibility suffixes do not permit mixing different responsibilities in one folder. A flat module using explicit established suffixes such as `.constants.ts`, `.mapper.ts`, or `.schema.ts` is acceptable only when the module is very small and contains at most one file for each responsibility.
- When a module has multiple files for one responsibility, organize them under the corresponding responsibility directory.
- Do not place an ambiguously named support file directly under a feature or module directory when its role is not evident from the path.
- Name the file for its domain content and use its directory or suffix to identify its responsibility.

## No Small-Change Exemption

These file-boundary rules apply regardless of size. A one-line helper, one-case mapper, tiny constant, or single-use type is still support code and must not be added inline to a NestJS service, controller, module, provider, DTO, or entity file.

Calling support code local, private, small, single-use, or close to its usage does not permit keeping it in the implementation file.

## Controllers and Services

Avoid creating god services or god controllers. If a class starts coordinating unrelated business rules, split the logic into smaller services with clear names and responsibilities.

- Extract distinct business logic into separate focused services when it represents a different responsibility, workflow, integration, or domain concept.
- Prefer composition over large procedural methods. A service may orchestrate other focused services when that keeps responsibilities clear.
- Do not introduce extra runtime abstraction for trivial logic, but still respect file boundaries: if trivial support code must exist, place it in the correct support file rather than inline in the class file.

## Implementation Bias

- Match existing local patterns before inventing new structure.

## Finishing

- Prefer focused TypeScript no-emit compilation checks over full app builds to avoid breaking user's local processes.
- Run focused lint auto-fix and formatting scripts against changed files using project's formatter (e.g., Prettier or Oxfmt).
