# Button-system team run

- **Status:** Done
- **Project boundary:** `frontend/` only; Angular client UI and its global stylesheet. No API, data, authorization, routing, package, or deployment work.
- **Mode / profile / risk / depth:** UI build / web / medium / standard.
- **Roles:** PM (scope and acceptance), Lead Developer (implementation), UI/UX (hierarchy and accessible states), QA (traceability and validation). CEO, Release Engineer, and Technical Writer are not needed.

## Scope and decisions

The application will use global CSS classes rather than a new Angular wrapper component, preserving native `<button>` behavior and avoiding a broad template API migration:

| Variant | Global class | Use |
| --- | --- | --- |
| Primary | `primary-button` | Create, save, submit, and the single dominant action in a local workflow |
| Secondary | `secondary-button` | Preview, view, search, edit, retry, and similar supporting actions |
| Tertiary | `tertiary-button` | Cancel, close, return, clear, and low-emphasis table actions |
| Ghost | `ghost-button` | Text-only contextual actions |
| Danger | `danger-button` | Destructive confirmations; retained as a separate semantic exception |

`primary-button` and `secondary-button` are existing project classes. Cancels and closes are migrated to `tertiary-button`; report previews are Secondary, while the report-management table's edit/delete icons remain Tertiary. Special controls (switches, tabs, sort controls, close icons, and navigation triggers) retain their focused component treatments rather than being misclassified as form actions.

## Acceptance criteria and traceability

| Acceptance criterion | Implementation | Evidence |
| --- | --- | --- |
| Primary buttons are `#A81C28` with white text, darken on hover, and provide pressed feedback. | Global `styles.scss` variants | stylesheet inspection; production build |
| Secondary buttons use a red outline and pale red hover. | Global `styles.scss`; existing edit/view actions retain `secondary-button` | template/class audit; production build |
| Cancel/close/return actions use gray tertiary styling and pale-gray hover. | Targeted templates use `tertiary-button`; global variants | template/class audit; production build |
| Every variant has consistent hover, active, disabled, and keyboard focus behavior. | Global `styles.scss` | stylesheet inspection; production build |
| Existing destructive actions remain visually distinct and functional. | Existing `danger-button` class remains untouched semantically | production build; existing integration selectors remain valid |

## Assumptions and non-goals

- A page may have one primary action per independently actionable panel or modal; current pages contain multiple such local workflows.
- This task does not redesign compact icon-only controls, toggles, tabs, sorting headers, or browser-native input controls.
- Existing unrelated, uncommitted work remains outside this change.

## Validation plan

1. Check template mappings for primary/secondary/tertiary role semantics.
2. Run `npm run build` to compile all Angular templates and global Sass.
3. Inspect the focused diff plus `git diff --check` for accidental edits and whitespace errors.

## Validation record

| Check | Status | Evidence |
| --- | --- | --- |
| Angular production build | PASS | `npm run build` completed successfully. Existing initial-bundle and component-style budget warnings remain. |
| Template and stylesheet mapping | PASS | Audited remaining `secondary-button` uses: they are view/edit/retry/supporting actions; cancel, return, close, reset, and low-emphasis table controls use `tertiary-button`. |
| CSS interaction contract | PASS | Source inspection confirms all global variants define hover, active, disabled, and visible keyboard-focus states. |
| Rendered primary button | PASS | Existing local `/login` page visibly renders the primary-styled confirmation action. |
| Karma unit tests | BLOCKED | `npm test -- --watch=false --browsers=ChromeHeadless` cannot initialize because `webpack-subresource-integrity` cannot resolve its `webpack` dependency in the local `node_modules` tree. No dependencies were changed or installed. |
| Secondary/tertiary browser pseudo-state inspection | NOT TESTED | The repository has no E2E or visual-regression runner; no new browser automation tooling was installed. |
| Diff whitespace check | PASS | `git diff --check` returned successfully. |
