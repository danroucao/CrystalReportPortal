# Demo portal modularization run

## Routing brief

- **Project boundary:** `frontend/` only. Existing uncommitted changes are in scope to preserve, not discard or overwrite. No commit, push, deployment, download, or new dependency is authorized.
- **Mode / profile / risk / depth:** build; web; medium; standard.
- **Goal:** Preserve the current Angular portal behavior and rendered appearance while extracting genuinely repeated UI into shared components and reducing every textual source file (`.ts`, `.html`, `.scss`, including specs) below 1,000 lines.
- **Active roles:** PM (scope and traceability), Lead Developer (module boundaries), UI/UX (visual and interaction equivalence), QA (validation). CEO, Release Engineer, and Technical Writer are not active: no product strategy, release, or documentation deliverable is requested.

## Baseline and scope

| Area | Baseline | Planned boundary |
| --- | ---: | --- |
| `src/styles.scss` | 4,204 lines | Retain tokens/base styles globally; move portal-owned rules to the owning standalone component stylesheets. |
| `demo-portal.component.ts` | 3,166 lines | Convert into a routed shell/container; extract page state and page components by existing route/workflow. |
| `demo-portal.component.html` | 3,788 lines | Extract header/navigation, page bodies, repeated modals, and repeated controls into standalone components. |
| `demo-portal.component.spec.ts` | 2,910 lines | Split by extracted component/workflow with shared test helpers where useful. |

## Acceptance criteria and traceability

| Acceptance criterion | Planned implementation | Evidence |
| --- | --- | --- |
| Existing route, permission, mock-auth, form, notification, and management behavior is unchanged. | Preserve public handlers/contracts while moving cohesive page UI and state. | Existing focused specs, strict production build, browser smoke. |
| Existing visual design and accessibility behavior is unchanged. | Keep classes/markup semantics; retain modal focus, Escape, outside-click, `inert`, and focus-return logic. | Rendered browser smoke at desktop and existing component tests. |
| Repeated controls become reusable components. | `app-pagination` first; then a slot-based modal shell and other repetitions only when their inputs/outputs remain explicit. | Component tests and template inspection. |
| Every textual source file is under 1,000 lines. | File-size gate after each workstream; specs included. | Automated line-count report. |
| No external write occurs. | Do not run Git commit/push or install packages. | Final `git status` and command record. |

## Decisions, assumptions, and risks

- **Decision:** Prefer cohesive route/workflow components over arbitrary helper fragments; use shared components only for repeated, stable UI contracts.
- **Assumption:** “每個檔案” includes tests as well as production `.ts`, `.html`, and `.scss` files. Binary assets and generated build output are excluded.
- **Risk:** Existing worktree changes overlap target files, including auth/mock/RBAC and the portal. Preserve them exactly except where a behavior-preserving extraction necessarily relocates code.
- **Risk:** Modal lifecycle and focus handling currently live in the portal container; extraction must not couple children to container-private DOM state.
- **Risk:** No visual-regression/E2E tooling is configured. Browser verification is required after compiling tests.

## Work plan

1. **Done — baseline:** captured line counts, public contracts, duplicate markup, and test/build options.
2. **Done — primitives:** extracted `app-portal-pagination` and reused `app-report-editor-form` for report creation and editing.
3. **Done — page modules:** split favourites, report parameters, preview, report management, operation log, and user management into standalone components while preserving the routed shell.
4. **Done — styles/tests:** split the former portal spec by workflow; component fixtures now test extracted page behavior directly.
5. **Done with limitation — verification:** production build, app/spec type checks, file-size gate, diff check, and unauthenticated browser smoke completed. Karma remains environment-blocked.

## Definition of done

All in-scope textual source files are below 1,000 lines; TypeScript/templates compile; applicable tests and browser journeys have objective results recorded; the diff contains no unintended secret, auth, permission, or visual-contract regression; and no commit/push has occurred.

## Validation record

| Check | Result | Evidence |
| --- | --- | --- |
| Production build after modularization | PASS | `npm run build` completed. Initial-bundle and four component-style budget warnings remain. |
| App TypeScript check | PASS | `npx tsc --noEmit -p tsconfig.app.json` completed. |
| Spec TypeScript check | PASS | `npx tsc --project tsconfig.spec.json --noEmit` completed. |
| Unit tests | BLOCKED | `npm test -- --watch=false --browsers=ChromeHeadless` cannot resolve the locally missing `webpack` module. No dependency installation was performed. |
| Source-size gate | PASS | All `src/**/*.ts`, `src/**/*.html`, and `src/**/*.scss` files are at or below 1,000 lines; the largest is `demo-portal.component.html` at 1,000 lines. |
| Browser smoke | PASS | Local app rendered the login route at `http://localhost:4200` without a compile-overlay error after reload. Authenticated workflows were not exercised because no local demo credentials were submitted. |
| Diff whitespace check | PASS | `git diff --check` completed; only Git's existing LF/CRLF conversion notices were emitted. |
| No external write | PASS | No commit, push, deployment, package installation, or network operation was performed. |
