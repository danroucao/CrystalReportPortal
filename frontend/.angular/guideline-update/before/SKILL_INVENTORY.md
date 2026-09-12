# Skill Inventory

## Reviewed local library

Library review date: 2026-08-24.

| Skill | Primary responsibility | Key boundary |
|---|---|---|
| `team` | Adaptive AI Dev Team classification and routing across modes, profiles, risk, depth, roles, focused Skills, and delivery gates | Thin orchestrator; activates only necessary roles and never expands user authorization |
| `project-proposal-review` | Project intake, scope and ownership, feasibility, versions, milestones, estimates, critical path, acceptance criteria, and readiness | Planning and decision only; no implementation |
| `grill-with-docs` | Explicit one-question-at-a-time clarification grounded in repository docs, with glossary and rare ADR capture | Not a complete project plan or readiness review |
| `feature-development` | Approved new or materially changed feature delivery | Not existing defects, validation-only work, independent review, or commits |
| `frontend-design` | UI presentation, interaction, responsive behavior, and accessibility | Not cross-layer feature delivery or broken behavior diagnosis |
| `debug` | Evidence-led diagnosis and minimal repair of existing unintended behavior | Not new capabilities or general validation |
| `test-and-verify` | Repository-appropriate checks and acceptance evidence | Not implementation, diagnosis, review, or commits |
| `code-review` | Findings-first review of code and diffs | Does not modify by default; passing tests do not replace review |
| `git-commit` | Explicit, focused staging and commit creation | No implementation, testing, review, or push |

## Third-party source audit

Audit date: 2026-08-24. All assessed items remain unchanged in `inbox/`. `UNKNOWN` means redistribution rights were not established from the material present; it is not permission to publish. The maintained routing decisions and integration targets are in [docs/inbox-integration-report.md](docs/inbox-integration-report.md).

| Skill / Source | Original author | Purpose / class | Trigger | Dependencies / portability | Overlap | License | Recommendation |
|---|---|---|---|---|---|---|---|---|
| `sama_project-task_SKILL.md` | Sama | Skill: end-to-end feature workflow | Full feature request | TodoWrite, Explore agent, several named Skills, Playwright; medium portability | Feature development, test, review | UNKNOWN | ADAPT — strong lifecycle, but remove mandatory unavailable tools and confirmation gate |
| `sama_production-engineer_SKILL.md` | Sama | Prompt/workflow | Implement/refactor/fix | Hard-codes Go/npm commands and subjective confidence gate; medium | Feature development, debug | UNKNOWN | ADAPT — retain focused implementation and evidence, not tool assumptions |
| `sama_frontend-design_SKILL.md` | Sama | Skill | UI create/change/remove | Names unavailable tools; medium | Frontend design | UNKNOWN | ADAPT — preserve existing design system before visual novelty |
| `persona-forge/` plus prompts/references/README | YTB 孔老師 | Skill with prompt/reference bundle | Persona/voice imitation | Host-specific Read/Write/Edit/Bash, Unix commands; medium | None of the six | MIT | KEEP — isolated, licensed third-party Skill; do not install in this phase |
| `youtube-thumbnail-beautifier/` | YTB 孔老師 | Skill | Improve an existing YouTube thumbnail | Requires image editing capability and source image; medium | Frontend design only at visual principles | UNKNOWN | ARCHIVE — valid narrow use case, but outside current engineering library and license unknown |
| `frontend-design-skill/` | YTB 孔老師 | Skill | Design web UI | Framework-neutral; high | Frontend design | Apache-2.0 | ADAPT — use ideas, keep self-authored implementation and respect notice if copying |
| `smart-search/` | YTB 孔老師 | Skill | Broad web research/search | Assumes `web_search`; medium | Built-in research behavior | UNKNOWN | ARCHIVE — excessively broad trigger and tool-specific |
| `grill-with-docs/` | Matt Pocock | Orchestrator/router source | Interview a design or plan | Upstream requires unavailable `grilling` and `domain-modeling` Skills; low portability | Local `grill-with-docs`, project proposal review | UNKNOWN | ADAPT — retain source unchanged; use the independently written local Skill without external Skill dependencies |
| `caveman.skill` | YTB 孔老師 | Packaged Skill | Terse/caveman response mode | None, but persistent response-style instruction; high | Global communication rules | UNKNOWN | ARCHIVE — not an engineering workflow and could conflict with teaching mode |
| `deep-research-explainer.skill` | YTB 孔老師 | Packaged Skill | Long research explainer | Requires web for current facts; writes to unavailable `/mnt/user-data/outputs`; medium | None of the six | UNKNOWN | ARCHIVE — host-path dependency and outside current scope |
| `error-screenshot-helper.skill` | YTB 孔老師 | Packaged Skill | Explain screenshot/error to non-technical user | Screenshot reading and live official links; medium | Debug, but audience differs | UNKNOWN | ARCHIVE — useful separate support Skill, not merge with engineer-facing debug |
| `find-skills.skill` | YTB 孔老師 | Packaged Skill | Discover/install Skills | Requires `npx skills`, network, third-party trust metrics; medium | Skill installation support | UNKNOWN | ARCHIVE — external-tool and marketplace assumptions; do not auto-install |
| `infographic-builder.skill` | YTB 孔老師 | Packaged Skill + assets/references | Produce offline HTML infographic | Bundled HTML assets, optional fonts; high | None of the six | UNKNOWN | ARCHIVE — unrelated output specialty; license absent |
| `ahyao_DevTeam_Deploy.md` | 啊堯 | Historical orchestrator/runbook | `/team` multi-role delivery | Many named Skills/agents, host paths, model/config claims; low | Feature lifecycle, review, test, new `team` Skill | UNKNOWN | ADAPTED — keep unchanged as historical contract; current `$team` implementation preserves intent with official Codex structures |
| `*.zip`, `drive-download-*.zip` | YTB 孔老師 | Archive/duplicate payloads | N/A | Duplicates of extracted sources; contains macOS metadata; high as archives only | N/A | Match contained item / UNKNOWN | ARCHIVE — retain as original evidence only, never install directly |
| `__MACOSX/`, `.DS_Store` | Archive metadata | Other | N/A | macOS archive artifacts; high | N/A | N/A | REJECT — no reusable instruction content |

## Detailed audit notes

### Sama: project-task, production-engineer, frontend-design

- **Inputs:** feature/fix request plus repository context. **Outputs:** implementation, tests, review summary, or UI changes. `project-task` has the strongest workflow: understand → specification → plan → implement → verify → review → fix → final verification.
- **Constraints/security:** `project-task` requires TodoWrite, Explore, named Skills, and optionally Playwright; `production-engineer` writes fixed tool commands and a subjective confidence gate; frontend guidance references unavailable `view_file`/`grep_search` and promotes unrelated cleanup. All are adapted conceptually, not copied.
- **Language/framework:** mostly generic, but production verification is Go/npm-specific. **License:** no license file or notice found, so all are `UNKNOWN`.

### YTB 孔老師: persona-forge, thumbnails, frontend, smart-search

- **persona-forge:** Inputs are person/source material; outputs a new persona bundle. Its references/templates support evidence-based voice analysis. It uses host-specific tool names and Unix backup/package commands. Its MIT file permits reuse subject to retaining the notice, but it is not needed by the six engineering Skills.
- **thumbnail:** Input is a base image and video intent; output is an edited 16:9 image. It depends on an image editor, creates a risk of misleading claims or identity/text errors, and has no visible license.
- **frontend-design:** Input is UI requirements; output is working UI. It is Apache-2.0, framework-neutral, and overlaps the chosen frontend Skill. The new Skill reverses its "always bold" bias for existing systems and adds accessibility/state checks.
- **smart-search:** Input is a research question; output is five sources. It assumes an unavailable `web_search` tool, its trigger is broad enough to catch ordinary questions, and it has no visible license.

### Packaged `.skill` files

- These are ZIP containers, inspected read-only. `caveman`, `deep-research-explainer`, `error-screenshot-helper`, and `find-skills` contain only `SKILL.md`; `infographic-builder` additionally contains references and HTML assets.
- Their inputs/outputs are respectively: terse response mode; 3,000–5,000-word Markdown explainer; plain-language screenshot diagnosis; marketplace search/install advice; and single-file HTML infographic. No bundled license was found.
- Risks include persistent style conflict (`caveman`), hard-coded unavailable output path (`deep-research-explainer`), potentially speculative diagnosis (`error-screenshot-helper`), external `npx` and network use (`find-skills`), and unverified third-party asset/source provenance (`infographic-builder`).

### Ahyao and Matt Pocock

- **Ahyao:** a long AI-team orchestrator and deployment runbook, not itself an installable Skill. It defines roles, planning artifacts, and quality gates, but hard-codes another environment's paths, model configuration, and unverified Skills. The self-authored `team` Skill now adapts its behavior intent while the original remains unchanged.
- **Matt Pocock:** the upstream `grill-with-docs` entrypoint is a minimal router that depends on `grilling` and `domain-modeling`. The local version is an independently written, self-contained adaptation of the public behavior: one-question-at-a-time plan grilling, codebase/doc grounding, glossary capture in `CONTEXT.md`, and rare ADRs under `docs/adr/`.

## Trigger validation matrix

| Prompt | Expected Skill | Result from descriptions |
|---|---|---|
| "$team 修改登入按鈕 padding" | team | PASS — explicit invocation; quick UI routing and CEO skip |
| "$team 新增會員管理 CRUD" | team | PASS — explicit multi-role feature routing |
| "$team 新增 OAuth 登入" | team | PASS — explicit routing with automatic high/deep security floor |
| "$team mode=debug 修正 build error" | team | PASS — explicit debug routing; CEO excluded |
| "$team 規劃商業化 SaaS" | team | PASS — CEO/business trigger and full relevant planning council |
| "$team mode=ship 檢查正式交付" | team | PASS — QA/Release/Writer routing without implied deployment |
| "Add a shipping method to checkout, API to UI, with tests." | feature-development | PASS — explicit cross-layer capability |
| "The existing shipping endpoint returns 500." | debug | PASS — unexpected existing behavior |
| "Which checks prove this checkout change is ready?" | test-and-verify | PASS — validation selection only |
| "Review this AI-generated checkout diff; do not edit." | code-review | PASS — findings-only default |
| "Make the existing checkout form usable on mobile." | frontend-design | PASS — visual/interactions primary |
| "Create separate commits for API and UI edits." | git-commit | PASS — explicit staging/commit job |
| "Fix the failed test." | not feature-development; debug | PASS — feature boundary excludes existing failure |
| "Run CI checks." | not code-review; test-and-verify | PASS — review boundary excludes general validation |
| "Make the cards prettier." | not debug; frontend-design | PASS — debug requires unintended failure |
| "Push to GitHub." | not git-commit | PASS — push explicitly excluded |
| "Create a new dashboard with API and page." | not frontend-design alone; feature-development | PASS — cross-layer boundary |
| "Delete unused code throughout the repo." | none by default | PASS — avoids unnecessary broad modification |
| "Plan a new Angular, backend, and database project for a three-week deadline; do not implement." | project-proposal-review | PASS — intake, ownership, version, timeline, and planning-only gate |
| "Ask me one question at a time to resolve this checkout design, and update the glossary." | grill-with-docs | PASS — explicit conversational clarification mode |
| "Implement the approved V1 checkout milestone." | feature-development | PASS — approved feature delivery begins after planning |
| "Build this entire system" with unresolved scope and ownership. | not feature-development yet; project-proposal-review | PASS — material readiness gaps block implementation |
| "The milestone is complete; capture lessons and decide whether a Skill should change." | repository/project workflow | PASS — retrospective does not require a new catch-all Skill |

Each Skill contains positive and negative trigger examples. Completion gates are objective: acceptance criteria and relevant checks, reviewed diff, and stated blockers/risks rather than confidence scores. `scripts/check-skills.ps1` also verifies that every reviewed Skill is represented in this inventory and the README, that the seven Custom Agents have required fields, and that the architecture documents exist.

## Team replacement record

On 2026-08-24, the previous `team` source was preserved in a local, Git-ignored recovery snapshot under `archive/deprecated/team-pre-ahyao-rebuild-20260824-193000` and replaced by a new single `skills/team` implementation based on the portable parts of the Ahyao contract. The active global User Scope contains exactly one `team` directory. The archive is never installed; the corresponding global backup is retained outside this repository.
