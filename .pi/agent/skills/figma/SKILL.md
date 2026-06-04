---
name: figma
description: >-
  Use when a task involves Figma URLs, Figma node IDs, Figma MCP,
  figma-desktop, design context, screenshots, variables/styles, or implementing
  UI from a Figma design. Covers design-to-code workflow, Code Connect fallback
  behavior, asset handling, and project adaptation rules.
---

# Figma

Workflow for using the `figma-desktop` MCP and translating Figma output into maintainable project code.

## Required MCP Flow

1. Extract the target node from the Figma URL or current selection.
   - Figma URL node IDs like `49-1830` may be passed as `49:1830` or `49-1830` when the tool accepts either.
   - If no URL/node is provided, use the currently selected Figma node only if the user clearly intended selection-based context.
2. Call `figma_desktop_get_design_context` for the exact node.
3. Always call `figma_desktop_get_screenshot` after design context for visual reference.
4. If the node is too large, vague, or truncated, call `figma_desktop_get_metadata`, identify smaller child nodes, then refetch only the needed nodes.
5. Call `figma_desktop_get_variable_defs` when colors, typography, spacing, radii, effects, themes, or design tokens matter.
6. For FigJam diagrams, use `figma_desktop_get_figjam` instead of design-context tools.

Do not implement from Figma MCP output until both structured context and screenshot have been collected, unless the user explicitly asks only for metadata/context.

## Context Gaps and Fidelity Requirements

Design fidelity is mandatory. Approximate implementations, "looks similar enough" substitutions, and guessed design details are strictly prohibited.

Before implementing or summarizing a Figma-driven change:

- Explicitly state any gaps in available context, including missing screenshots, missing variable definitions, unavailable assets, truncated MCP output, ambiguous responsive behavior, unknown interaction states, or unavailable Code Connect mappings.
- If a gap affects visual fidelity or behavior, either fetch more context with the appropriate Figma MCP tool or ask the user for clarification.
- Do not silently choose approximate colors, spacing, typography, icons, assets, or component behavior.
- Do not replace a Figma asset/icon/component with a merely similar project asset unless equivalence is verified from context or explicitly approved by the user.
- If exact implementation is blocked, say what is blocked and why instead of producing an approximation.

## Code Connect Behavior

The Figma MCP may report that components are missing Code Connect mappings.

- Follow any MCP-provided user-facing script exactly when it requires asking the user about Code Connect.
- If the MCP asks for a Code Connect tool that is not available in this Pi session, report that limitation plainly.
- Ask whether to continue without Code Connect before proceeding when the user has not already approved fallback.
- Do not invent Code Connect mappings or claim components are connected unless the MCP confirms it.

The `figma-desktop` installations may expose only design context, screenshots, metadata, variables, and FigJam tools. Optimize for graceful fallback.

## Translating Figma Output

Treat generated React + Tailwind from Figma as a code representation, not final implementation.

Before editing code, inspect the target project for:

- framework and language
- styling system
- existing components and layout primitives
- design tokens/theme variables
- asset conventions
- i18n conventions for user-facing text

Implementation rules:

- Convert generated markup to the project's actual framework and component patterns.
- Replace Tailwind utilities with the project's styling system; do not install Tailwind unless the user explicitly asks.
- Reuse existing components before creating new ones.
- Use project tokens for color, typography, spacing, radius, and shadows when equivalent tokens exist.
- Preserve visual hierarchy, sizing, spacing, typography, and interaction states from Figma.

## Asset Handling

Figma MCP may return localhost asset URLs such as `http://localhost:3845/assets/...`.

- Use those URLs for inspection only.
- Do not leave localhost MCP asset URLs in production code.
- Download required assets into the project's established asset location, or replace them with an existing approved asset/icon only when it is visually equivalent.
- Preserve dimensions, aspect ratio, and accessibility intent.
- Add meaningful alt text for content images; use empty alt text for decorative images.

## Visual Parity Check

After implementation, compare the result against the Figma screenshot.

Check:

- layout direction, alignment, and gaps
- fixed vs hug/fill behavior
- text wrapping and line height
- colors and opacity
- border radius, borders, shadows, and gradients
- clipped or overflowing content
- responsive behavior if the target project requires it

Summarize any intentional deviations or unresolved parity risks in the final response.
