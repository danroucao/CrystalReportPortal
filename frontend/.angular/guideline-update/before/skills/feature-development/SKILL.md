---
name: feature-development
description: "Deliver a new or materially changed product feature end to end: inspect the repository, turn requirements into an implementation plan, implement focused changes, validate, review the diff, and report evidence. Use for requested user-facing capabilities, workflows, APIs, or cross-layer changes. Do not use for diagnosing an existing failure, validation-only work, review-only work, visual-only frontend refinement, or creating a Git commit."
---

# Feature Development

## Workflow

1. Understand the requested outcome, acceptance criteria, constraints, and non-goals. Inspect repository instructions, adjacent code, data flow, tests, and established patterns before editing.
2. Resolve only material ambiguity. State assumptions and a concise plan before implementation; obtain confirmation when a choice changes product behavior, scope, or risk.
3. Implement the smallest coherent change. Preserve project conventions and compatibility; update tests where behavior changes.
4. Discover appropriate verification from repository evidence. Run the relevant checks, inspect the final diff, and fix findings caused by this change.
5. Report changed behavior, rationale, evidence from validation, residual risks, and learning notes: principle involved, before/after difference, and common mistakes.

## Boundaries

- Treat an existing unexpected failure as `debug`, even when its fix includes code.
- Return a project-scale request to `project-proposal-review` when scope, responsibility, acceptance criteria, or delivery readiness remains materially unresolved. Do not invent a complete project plan while writing the first feature.
- Treat a request to run or choose checks as `test-and-verify`; use its method internally only as part of a feature delivery.
- Keep a focused self-review; use `code-review` when the user asks for an independent review.
- Delegate interface look-and-feel decisions to `frontend-design` when visual design is the primary task.
- Do not create a commit unless explicitly asked; then use `git-commit`.
- Use only tools and commands actually available in the repository environment. Do not assume agents, MCP servers, browsers, package managers, or other Skills exist.

## Completion evidence

Complete only when acceptance criteria have evidence, applicable validation has passed or is explicitly blocked with reason, the diff contains no unintended changes or secrets, and remaining risk is stated.

## Trigger examples

Use for:

- "Add account suspension with an admin API, UI, and tests."
- "Implement CSV export for completed orders."
- "Extend checkout to support a new shipping option."

Do not use for:

- "Why does the existing checkout return 500?" (debug)
- "Which tests should I run before merging?" (test-and-verify)
- "Review this pull request without changing it." (code-review)
