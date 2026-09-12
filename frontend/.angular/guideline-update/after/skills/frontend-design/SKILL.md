---
name: frontend-design
description: "Design or refine the visual and interaction layer of a web frontend, including pages, components, layout, styling, responsive behavior, and accessibility states. Use when UI/UX presentation is the primary requested outcome. In an existing project, preserve its design system first; in a new project without one, establish a deliberate design direction. Do not use for backend-only work, a full cross-layer feature, diagnosis of a defect, generic code review, or creating a Git commit."
---

# Frontend Design

## Workflow

1. Inspect the existing component patterns, tokens, typography, layout conventions, and relevant user flows. Reuse them for existing projects unless the user explicitly requests a redesign.
2. For a new project without a design system, choose and state one clear direction based on audience, purpose, and constraints before building. Keep implementation proportionate to the goal.
3. Implement semantic, maintainable UI code that preserves functional behavior and project conventions.
4. Review responsive layout, keyboard access, focus visibility, contrast, typography, spacing, interaction states, loading, empty, error, and browser behavior where relevant.
5. Verify the actual rendered result using available project-supported methods. Report visual decisions, changed files, validation, and remaining limitations.

## Interaction stability

When changing lists, selectable cards, or modal forms, inspect the data producer and preserve control identity using a stable entity key where objects are rebuilt or entities can move. Avoid unnecessary remounts that reset focus, selection, or animation; do not prescribe memoization for every derived list.

Use native label/control semantics for checkbox, text, and container click targets. Keep one state-change path, preserve keyboard activation, and check that nested controls do not inadvertently trigger a row action or toggle twice.

Verify the real rendered transition after the design change: open, interact, close, and reopen where relevant, checking focus and state. If rendering repeats, controls reset, or the page cannot settle, route the unintended behavior to `debug` instead of masking it with delays or forced refreshes. A screenshot or successful build alone does not verify interaction stability.

## Boundaries

- Do not replace an established design system with a fashionable new style without an explicit redesign request.
- Treat a broken existing UI behavior as `debug`; treat a feature spanning API/data/business logic as `feature-development`.
- Avoid redesigning unrelated components during a focused visual change.
- Do not assume a browser, image generator, design tool, CSS framework, or frontend framework is installed.

## Trigger examples

Use for:

- "Make the existing Angular settings page responsive and accessible."
- "Design a new empty state for this dashboard using its current design system."
- "Create a landing page visual direction for a new product."

Do not use for:

- "Add an order approval API and page." (feature-development)
- "The current modal cannot be closed." (debug)
- "Review this TypeScript service." (code-review)
