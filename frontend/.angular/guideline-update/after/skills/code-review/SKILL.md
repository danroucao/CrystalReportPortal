---
name: code-review
description: "Review existing code or a proposed diff for correctness, regressions, architecture, maintainability, error handling, security, performance, and test coverage. Use when the user asks for a review, PR review, change assessment, or analysis of AI-generated code. Default to findings and evidence without modifying files. Do not use to implement a requested feature or fix, select and run a general validation plan, redesign a UI, or make a Git commit."
---

# Code Review

## Workflow

1. Read repository instructions and the relevant diff or files. Establish intended behavior and affected boundaries before judging implementation.
2. Prioritize concrete defects: incorrect behavior, regression, data loss, unsafe authorization/input handling, broken error paths, race or resource issues, and missing coverage for changed behavior.
3. Check architecture and maintainability only where they create a material future or present risk. Do not demand broad refactors for style preference.
4. For every finding, give severity, precise location, failure scenario, and why it matters. Do not report speculative concerns without supporting evidence.
5. Summarize residual risks and test gaps. Modify code only if the user separately asks to address findings.

## Reactive UI review focus

When the diff affects rendered lists, forms, or dialogs, inspect whether list identity and tracking preserve stateful controls, and whether initialization, effects, or subscriptions can repeatedly schedule another update. Trace the producer and update path before reporting a loop; fresh objects or a missing key alone are not sufficient evidence of a hang. Check key uniqueness, render-time side effects, and cleanup where relevant.

Review forced refreshes, arbitrary delays, retries, and removed interaction/access guards against their stated causal justification. Check that tests exercise the resulting rendered workflow and asynchronous settling rather than only spying on handlers or manually refreshing away a scheduling problem. Keep findings concrete and within the changed surface.

## Boundaries

- Treat a request to repair a known failure as `debug`.
- Treat end-to-end implementation as `feature-development`.
- Treat test execution or release readiness as `test-and-verify`; use test results as review evidence when supplied.
- Treat passing validation as evidence, not proof that the implementation has no logic, security, architecture, or maintainability findings.
- Do not run destructive commands, expose secrets, or assume third-party tools are available.

## Trigger examples

Use for:

- "Review this PR for regressions and security issues."
- "Audit this AI-generated Spring service before I merge it."
- "Read this diff and list only actionable problems."

Do not use for:

- "Fix the null-pointer exception in production." (debug)
- "Implement the review comments." (feature-development)
- "Test the change across the project." (test-and-verify)
