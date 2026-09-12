---
name: test-and-verify
description: "Determine and run the repository-appropriate validation for a change or delivery: inspect project instructions and configuration, select relevant lint, typecheck, tests, build, E2E, or browser checks, and report objective evidence. Use for requests to test, validate, verify, select checks, or assess readiness. Do not use to implement a feature or bug fix, conduct a general code review, redesign a UI, or create a commit."
---

# Test and Verify

## Discover before running

Inspect in this order: repository `AGENTS.md`, `README`, package or build configuration, CI configuration, then existing scripts and tests. Infer commands from these artifacts rather than assuming Maven, Gradle, npm, Go, or any other tool.

## Workflow

1. Map the change to its affected layers and risks.
2. Select the smallest sufficient checks: lint/format, typecheck, unit tests, integration/API tests, build, E2E, and browser verification only when relevant and supported.
3. Run checks in a useful order, preserving output needed to diagnose failures. Do not install dependencies, start services, or use browser automation without repository evidence or user authorization when it changes external state.
4. Distinguish failures introduced by the change from pre-existing or environmental failures. Re-run affected checks after a fix when in scope.
5. Report each applicable result as `PASS`, `FAIL`, `BLOCKED`, or `NOT TESTED`, with the command or observation, acceptance criterion or risk covered, coverage gaps, and an objective readiness decision.

## Completion evidence

State which acceptance criteria or risks each check covered. Completion requires applicable checks to pass, or each unrun/blocked check to have a concrete reason; also inspect the relevant diff for unintended modifications.

## Trigger examples

Use for:

- "What should I run to verify this repository change?"
- "Run the relevant checks before I merge this branch."
- "Validate the API and frontend change without assuming the toolchain."

Do not use for:

- "Add validation to this form." (feature-development)
- "Find why this test is failing." (debug)
- "Review this diff for architectural problems." (code-review)
