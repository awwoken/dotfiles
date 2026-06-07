---
name: lint-fixing
description: >-
  Use when fixing linting, formatting, static analysis, or type-checking errors from tools such as
  TypeScript, ESLint, Oxlint, Biome, Prettier, Rust Clippy, or similar. Enforces rule-intent-first
  fixes instead of suppressions, disable comments, unsafe casts, placeholder constants, or other
  one-off workarounds that merely silence the reported issue.
---

## Core Principle

Lint, format, static-analysis, and type rules are code-owner policy. Treat every reported error as a design constraint to satisfy correctly, not as noise to bypass.

A lint fix is acceptable only when it preserves or improves the maintainability, type safety, readability, and intended architecture of the code. Code that only silences the tool is not fixed.

## Required Workflow

1. Identify the exact rule, diagnostic, and affected code.
2. Infer the rule intent from the project configuration, nearby code, existing patterns, and rule name/documentation when needed.
3. Fix the underlying design or correctness issue in the smallest appropriate scope.
4. Prefer existing project locations and conventions for constants, types, helpers, modules, and abstractions.
5. Run the narrowest relevant validation command after the change unless unavailable, too expensive for the current task, or explicitly skipped by the user. If skipped, state why.
6. If a correct fix would require risky broader refactoring, explain the risk and ask before using any temporary mitigation. Temporary mitigations are not acceptable as final lint fixes.

## Prohibited Fixes Unless Explicitly Requested

Do not use these just to pass lint/type checks:

- Disable comments such as `eslint-disable`, `ts-ignore`, `ts-expect-error`, `biome-ignore`, `oxlint-disable`, `allow`, or Clippy suppressions.
- Unsafe or fake typing such as `any`, broad `unknown`, double casts like `as unknown as T`, non-null assertions, or Rust `unsafe`.
- Placeholder constants declared immediately above the only usage to satisfy magic-number/string rules.
- Prefixing unused values with `_`, adding `void value`, or keeping dead variables solely to appease unused-variable rules.
- Splitting, renaming, or moving code mechanically without improving the responsibility boundary.

Do not add new suppressions without user approval unless the project already uses the same local suppression pattern for the same documented, unavoidable tool limitation. If used, make the reason specific, local, and tied to the tool limitation rather than convenience.

## Rule-Specific Guidance

### Max Lines, Complexity, or Function Size

Do not disable the rule or claim the logic is inherently too complex.

Refactor by responsibility:

- Extract cohesive helpers, components, hooks, services, modules, or mappers into separate files.
- Preserve behavior and public APIs unless the user requested a design change.
- Keep each extracted file meaningful; avoid arbitrary chunks whose only purpose is line count.

Exception: if the oversized file was not created or materially changed in the current branch and broad refactoring is risky, do not disable the rule silently. State the risk and either limit changes to the touched area or ask before doing a larger refactor.

### Magic Numbers, Strings, or Repeated Literals

Do not create a throwaway constant next to the usage.

Move stable values into the appropriate constants/configuration module, using existing naming and organization. Prefer a unified reusable location for the category of value. If no suitable file exists, create a focused constants file at the nearest sensible layer. Do not place the constant in the same implementation file unless the value is genuinely private to that file and the project already uses file-local constants for that category. Reuse existing constants before adding new ones.

### Type Errors

Do not erase the type system to satisfy the compiler.

Fix by making the program truthful:

- Use the correct library/exported type.
- Narrow unions with runtime checks or discriminated unions.
- Adjust generics, schemas, DTOs, parser outputs, or function signatures so producers and consumers agree.
- Handle nullable, optional, error, and async states explicitly.

Before casting, try correct library types, narrowing, schema/parser changes, DTO updates, or API signature fixes. Casts are acceptable only when they encode a proven invariant that cannot be expressed better. If a cast remains necessary, explain the invariant and keep the cast as narrow and local as possible.

### Unused Variables, Imports, or Parameters

Remove dead code instead of hiding it.

- Delete unused variables, imports, parameters, branches, and helper functions when they are no longer needed.
- Keep intentionally unused parameters only when required by an external interface, framework hook, callback signature, or override contract. Use the project’s existing convention and keep the explanation local.
- If an error is caught, either handle it meaningfully, propagate it, log it according to project conventions, or omit the binding when supported.

### Formatting Diagnostics

Use the project formatter rather than manual churn. Keep formatting-only changes separate from behavioral changes when possible.

## When In Doubt

Choose the fix that a code owner would keep after review. If the only visible benefit of a change is “the linter stopped complaining,” it is probably the wrong fix.
