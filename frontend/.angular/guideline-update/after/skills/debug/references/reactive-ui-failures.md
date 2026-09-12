# Reactive UI failures

Use for hangs, repeated rendering, resetting controls, lost focus, or dialogs that stop responding after an interaction change. Apply the framework-specific examples only when that framework is present.

## Establish what actually failed

- Capture the trigger and expected visible result: before authentication, after confirmation, on opening a dialog, on selecting an option, or after closing/reopening. Do not merge distinct symptoms into one diagnosis without evidence.
- Verify an automated action took effect before using it as evidence: confirm the intended field has the test value, the target is correct, and the resulting state changed. A cleared field is ambiguous; a success toast proves only that the notification was shown. An automation timeout can originate in the control tool rather than the application.
- Distinguish event interception (overlay, disabled state, `inert`), an exception, pending I/O, repeated remounts, a synchronous loop, and microtask starvation. Use available DOM observations, error logs, bounded component tests, task counts, or profiling to distinguish them. Keep unsupported explanations labeled as hypotheses.
- Revisit the most recent changes and follow the entire path: user event -> state mutation -> list/render evaluation -> control initialization -> scheduled work -> next update. Existing click wiring does not prove the opened dialog can settle.

## Check identity and lifecycle

Read the actual list producer. A getter or selector using `map()`, object spread, or cloning may return different object identities on every evaluation even when field values match. If the renderer tracks by reference, stateful controls may be destroyed and initialized again. Check whether initialization schedules work that triggers another render; fresh objects alone do not prove an infinite loop.

For Angular, inspect `*ngFor` tracking or `@for` tracking using the installed version, and any nested form directives. One demonstrated failure pattern is:

```text
Roles getter clones objects
  -> reference-based ngFor recreates inputs
  -> NgModel initialization queues an update and marks for checking
  -> another change-detection pass reads fresh role objects
  -> inputs are recreated again
```

For this mechanism, preserve views with a stable entity key, for example:

```html
<label *ngFor="let role of roles; trackBy: trackRoleById">
  <input type="checkbox" [ngModel]="isSelected(role.id)"
    [ngModelOptions]="{ standalone: true }"
    (ngModelChange)="setSelected(role.id, $event)">
  {{ role.name }}
</label>
```

```ts
trackRoleById(_: number, role: { id: string }): string {
  return role.id;
}
```

The key must be unique among siblings and stable for the entity. Do not use a random key or an index for lists whose entities can move, be filtered, inserted, or removed. Check sibling lists with the same producer when they fall within the affected workflow. Do not remove defensive read-model cloning just to stabilize references; if caching is appropriate, account for invalidation.

In other reactive frameworks, inspect keyed reconciliation, effect dependencies, subscription ownership, and scheduled updates using that framework's conventions. Keep data derivation side-effect-free: state writes, subscriptions, requests, and timers belong in appropriate events/lifecycles with cleanup, not repeated render evaluation. Function calls or new arrays in templates are not automatically defects; identify their actual cost and lifecycle impact.

For checkbox/label/container interactions, prefer one native label association and one state-change path. Check that event bubbling does not open a parent editor, toggle twice, or cancel the input's default activation. Preserve keyboard behavior.

## Prove the repair

- Preserve valid security and modal constraints. For an `inert` hypothesis, observe the attribute before and after the relevant state transition; do not remove authentication requirements on the strength of a success notification.
- Do not treat `detectChanges()`, force-update calls, arbitrary timeouts, or retries as a general fix. Use them only with a demonstrated lifecycle need; they can mask a loop. Remove a workaround introduced during this repair if evidence disproves its purpose.
- For remount regressions, a bounded test should retain the original control reference, run several relevant update cycles, and assert the control is reused and state remains correct. This detects remounting without allowing a pre-fix loop to hang the whole test runner.
- Exercise the actual rendered trigger, not only a spy on its handler: open the dialog, select/deselect through relevant click targets, close, reopen, and confirm state. Where scheduling is implicated, include automatic framework updates and a bounded wait for stability. A test that manually calls change detection after every action can conceal a scheduling defect.
- Prefer before/after evidence from the same regression check. Report the browser/runtime, cases executed, failures, skipped coverage, and any alternative runner used. A passing compiler or service-level state test is not proof that the UI is responsive.
