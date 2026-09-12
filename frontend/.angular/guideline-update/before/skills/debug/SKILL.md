---
name: debug
description: "Diagnose and safely fix an existing, unintended technical failure or incorrect behavior, including exceptions, build or test failures, API errors, regressions, and UI bugs. Use when expected behavior already exists and evidence points to something broken. Do not use for adding a new capability, choosing a general validation plan, reviewing a change, styling an interface, or committing changes."
---

# Debug

## Workflow

1. Establish the expected and actual behavior. Reproduce or verify the symptom using the smallest safe case; record the exact error, conditions, and relevant version or environment facts. When the initial evidence is a screenshot, transcribe the visible message and identify the triggering action before inferring a cause.
2. Trace from symptom to cause through logs, tests, request/data flow, recent changes, and source. Separate observations from hypotheses.
3. Identify a root cause supported by evidence. Do not label a workaround as the root cause.
4. Apply the minimal safe fix that addresses that cause. Avoid opportunistic refactors and unrelated cleanup.
5. Run focused checks, then verify the original reproduction no longer fails. Inspect the diff for regressions, unintended edits, and secrets.
6. Explain the symptom, root cause, fix rationale, before/after behavior, relevant principle, and common recurrence traps.

## Boundaries

- Reclassify a request for new behavior as `feature-development`, even if the user calls it a bug.
- Do not guess from an error message alone when repository evidence can be gathered.
- Do not weaken or remove tests merely to make them pass.
- Do not assume a debugger, browser, external service, credential, or package manager is available.

## Completion evidence

Complete only when the original symptom is verified fixed (or a clear external blocker is documented), focused validation results are reported, and the root-cause claim is linked to concrete evidence.

## Trigger examples

Use for:

- "This Spring endpoint now returns 500; find and fix the cause."
- "The Angular dialog opens but never saves."
- "Our build began failing after the dependency update."

Do not use for:

- "Add a new bulk-save endpoint." (feature-development)
- "Run the full CI-equivalent checks." (test-and-verify)
- "Make the dashboard cards look more polished." (frontend-design)
