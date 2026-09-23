# Portal bundle and component-boundary refactor

## Routing brief

- **Project boundary:** `frontend/` only; do not alter backend, mock-data contracts, authentication semantics, or untracked sibling files.
- **Mode / profile / risk:** Build / web / medium / standard depth.
- **Active roles:** PM (scope and traceability), Lead Developer (routing and bundle boundary), UI/UX (preserve existing interaction and visual contracts), QA (guard, dialog, and bundle validation). CEO, Release Engineer, and Technical Writer are not applicable.
- **Primary route:** `team` orchestration with `refactor-and-simplify`; validation uses `test-and-verify` principles and an independent diff review before delivery.

## Scope and non-goals

The requested result is to reduce the production initial JavaScript below 500 kB where practical while retaining all existing portal behavior and appearance, and to keep repeated UI in the existing shared-component conventions.

The first milestone changed route loading: the login and portal features are loaded through standalone route `loadComponent` functions. Every existing path, title, guard, `data` value, redirect, and `canDeactivate` guard remains unchanged. The existing reusable `PortalTabs`, `PortalPagination`, `PortalTwoTabSegmentedControl`, `UnsavedChangesDialog`, and report-editor form remain the component boundaries for their repeated UI.

The second milestone removes four tracked files with no application, test, or documentation references; extracts the database-connection page into its own standalone component; and removes three whole-parent SCSS imports from child pages in favor of their relevant rules. The child retains the same permission checks, mock service actions, password-empty edit state, modal controls, and parent leave-guard delegation.

Non-goals: redesigning screens, altering API/auth/session behavior, deleting unreferenced future API integration work, extracting unrelated modal markup, or refactoring page-specific business workflows.

## Evidence, assumptions, and decision

- Baseline `npm run build` (2026-09-23): `main` 700.36 kB; initial total 826.68 kB. The configured initial warning budget is 500 kB.
- Cause: every portal route eagerly referenced `DemoPortalComponent`, which statically imports all portal pages. Conditional rendering does not create a bundle boundary.
- Assumption: a small additional request on first navigation is acceptable; Angular route lazy loading preserves the rendered UI and functionality after that route resolves.
- Decision: use one named loader per component family so repeated route configuration uses a consistent, auditable lazy boundary. Do not split the portal shell into multiple route components in this run because it owns cross-page dialogs, `ViewChild` calls, and unsaved-change checks.

## Acceptance criteria and traceability

| Criterion | Implementation | Validation |
| --- | --- | --- |
| Existing URLs, guard decisions, data, titles, and leave protection stay intact | `app.routes.ts` retains all route metadata and guards; only `component` becomes `loadComponent` | Guard suite and source/diff inspection |
| Bootstrap `main` is below 500 kB | Lazy `loadComponent` boundaries for login and portal | Production build emitted chunk sizes |
| Existing repeated controls stay componentized and interactions remain stable | Keep current shared tabs, pagination, segmented tabs, dialog, and report form | Existing component/workflow tests |
| No auth or credential regression | Do not change auth provider replacement, interceptor, or mock data | Relevant test suite and diff inspection |

## Planned evidence and Definition of Done

1. Production build reports emitted initial chunks and `main` is at or below 500 kB.
2. Jasmine suite passes, including direct route/permission, dirty-form, dialog/focus, tab, and pagination coverage.
3. Inspect the diff for unintended changes and secrets. Browser side-by-side visual and network checks are recorded as not tested if no interactive runtime is exercised.

## Delivery evidence

| Check | Status | Evidence |
| --- | --- | --- |
| Production build and initial size | PASS | `npm run build`: initial total 393.30 kB; generated `main` 4.20 kB. The prior initial total was 826.68 kB and `main` 700.36 kB. |
| Route compilation | PASS | Production Angular build completed with the lazy loaders and templates compiled. |
| Manual local journey | PASS | Local demo login resolved the lazy portal and rendered `/reports/parameters`; a direct protected `/database-connections` request redirected to login when no session was present. |
| Jasmine/Karma suite | BLOCKED | `npm test -- --watch=false --browsers=ChromeHeadless` cannot start because installed dependencies are missing `webpack` (`webpack-subresource-integrity` require failure). No dependencies were installed. |
| Spec TypeScript compilation | FAIL (pre-existing) | `npx tsc --project tsconfig.spec.json --noEmit` reports existing missing symbols/methods in operation-log, audit-log, and segmented-control specs; no errors name the changed route files. |
| Diff and secret inspection | PASS | `git diff --check` is clean. The focused diff only changes route loading plus its guard-test fixture; no credential or interceptor change. |

Residual risk after the first milestone: the portal remained a single 377.06 kB lazy chunk after navigation. Further splitting requires preserving shell-owned notification, upload, focus, `ViewChild`, and unsaved-change contracts.

## Second-milestone evidence (2026-09-23)

| Check | Status | Evidence |
| --- | --- | --- |
| Production build and initial size | PASS | `npm run build`: initial total remains 393.30 kB (initial JavaScript 300.69 kB); portal lazy chunk 377.06 → 333.17 kB. Component-style budget warnings 4 → 0. |
| Repository cleanup | PASS | Removed unreferenced `frontend_changes.txt` and three tracked `work/*.html` previews: 1,127,341 bytes combined, recoverable from Git history. Production inputs and API integration stubs remain. |
| Component boundary | PASS (build and source review) | Database connection page moved out of `DemoPortalComponent`; parent HTML shrank by 229 lines and parent TS by roughly 120 lines. The parent still asks the child whether it has unsaved changes before navigation. |
| Source-wide byte reduction | PASS | Non-spec application source changed from 541,506 to 538,661 bytes after repeated form, table, muted-text, and status-switch Sass rules were consolidated into `_portal-shared.scss`. |
| Unit suite | BLOCKED | `node_modules` lacks `webpack`, so Karma cannot start. No dependency installation was authorized. |
| Spec compilation | FAIL (pre-existing errors) | `npx tsc --project tsconfig.spec.json --noEmit` still reports 13 errors in unrelated operation-log, audit-log, and segmented-control specs; none names the changed files. |
| Demo login browser journey | PASS | Local Demo login rendered `/reports/parameters` from the new build. |
| Database browser journey | NOT TESTED | Browser automation did not complete database-page navigation, so database dialog, visual parity and repeated open/close remain unverified. |
| Diff | PASS | `git diff --check` clean. No credentials, token logic, route-guard configuration, or mock auth production replacement were changed in the second milestone. |
| Independent QA diff review | PASS | No concrete behavior, authorization, or style regression found in the changed diff. Rendered database interactions still need runtime verification. |

The database page, its new stylesheet, and the focused portal-workflow spec are the traceability path for the extracted editor, status switch, and unsaved-changes behavior. The removed preview files were standalone design experiments, not Angular inputs. Parent-scoped operation-log CSS that could not reach its already extracted child was removed; the active global operation-log styling remains in `_styles-01.scss`.
