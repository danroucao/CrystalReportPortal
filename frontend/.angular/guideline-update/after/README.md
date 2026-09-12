# 個人 Codex AI 開發團隊

這個 Repository 是個人 Codex Skills、Custom Agents、References 與維護規則的唯一來源（Single Source of Truth）。主要使用環境是 Windows；所有可維護內容都放在 `D:\mySkills`，全域 Codex 目錄只保留可由安裝腳本重新產生的 Runtime 副本。

第三方原始資料放在 `inbox\`，不會自動安裝。Ahyao 的完整歷史行為契約保留於 `inbox\啊堯\ahyao_DevTeam_Deploy.md`，新系統保留它的團隊精神與 Quality Gates，但採用目前 Codex 官方的 Skill、Custom Agent 與 User Scope 結構。`inbox` 其餘來源的整合判斷見 [docs/inbox-integration-report.md](docs/inbox-integration-report.md)：只萃取可攜 routing 原則，不複製原始 prompt、資產或未知授權內容。

## 1. AI Dev Team 架構

```text
使用者需求
  ↓
$team Orchestrator
  ↓
Mode / Profile / Risk / Depth / Change Surface
  ↓
按需啟動 Roles / Custom Agents
  ↓
路由至專責 Workflow Skills
  ↓
使用可用的 Built-in Tools / Plugins / MCP
  ↓
Validation Gates 與交付
```

詳細設計請見 [docs/architecture.md](docs/architecture.md)。

## 2. Team Orchestrator

主要入口是：

```text
$team 我要完成的需求
```

也可以用自然語言：

```text
請用 AI 開發團隊模式完成會員管理功能。
```

`$team` 是目前 Codex 正式支援的 Skill mention。Ahyao 文件中的 `/team` 保留為歷史概念，但不是本系統依賴的自訂 slash command。

Orchestrator 只負責分類、選角、選 Skill、套用 Gate 與彙整，不會把所有工作流程重新塞進一個巨大 `SKILL.md`。

## 3. Custom Agents

| Agent | 主要責任 | 何時啟動 |
|---|---|---|
| PM | Scope、Requirements、User Story、AC、Readiness | 新專案、規劃、跨層功能、需求不清 |
| CEO | 商業模式、Pricing、MVP、定位、市場、平台、ROI | 只有商業或重大產品方向；預設 Dormant |
| Lead Developer | 架構、Feature、API/Data、Debug、Integration | 程式或技術工作 |
| UI/UX Designer | Flow、Design System、Responsive、Accessibility | UI、使用流程、設計決策 |
| QA/Security | Traceability、Tests、Regression、Security | Build、Debug、Review、Ship、高風險資料/安全 |
| Release Engineer | Build、Package、Version、Migration、Rollback、Smoke | Ship、部署、CI/CD、Infra、Migration |
| Technical Writer | README、API Docs、Guide、Migration、Release Notes | Doc、Ship、Public API、對外行為變更 |

角色啟動不代表一定 spawn 一個 Subagent。Quick 任務通常由主 Agent 依角色觀點完成；只有能獨立平行且確實改善速度或品質時才 spawn。完整矩陣請見 [docs/role-matrix.md](docs/role-matrix.md)。

## 4. Skills

| Skill | 使用時機 | 不適用情況 |
|---|---|---|
| `team` | 明確使用 `$team`、要求 AI 開發團隊模式或多角色 routing | 單一明確工作且未要求團隊 |
| `project-proposal-review` | PRD、Scope、可行性、版本、時程、Readiness | 已核准功能的實作 |
| `grill-with-docs` | 明確要求一次一題釐清模糊計畫 | 一般 intake、實作或 review |
| `feature-development` | 新增或大幅修改功能、API、跨層流程 | 既有錯誤、review-only、commit |
| `frontend-design` | UI 視覺、互動、Responsive、Accessibility | 跨層功能或既有 broken behavior |
| `debug` | 既有 Bug、Regression、Build/Test error | 新能力 |
| `test-and-verify` | 選擇並執行 lint、typecheck、tests、build、E2E、readiness | 實作或一般 code review |
| `code-review` | PR/diff correctness、安全、架構與測試缺口 | 實作、修 Bug、純驗證 |
| `git-commit` | 明確要求 stage、split 或 commit | 實作、測試、push |

完整盤點請見 [docs/skill-inventory.md](docs/skill-inventory.md) 與精簡權威清單 [SKILL_INVENTORY.md](SKILL_INVENTORY.md)。

互動穩定性的共用原則維護在 `global/AGENTS.md`；`feature-development`、`frontend-design`、`debug`、`test-and-verify` 與 `code-review` 各自涵蓋實作預防、互動設計、因果診斷、執行驗證與審查。發生重複渲染、表單重建或視窗無回應時，`debug` 會載入 [reactive-ui-failures.md](skills/debug/references/reactive-ui-failures.md)，其中的 Angular 範例只適用於相關專案。

## 5. References

`skills\team\SKILL.md` 只保留必要 routing。大量細節拆在 `skills\team\references\`：Ahyao 可攜行為契約、Routing 與 risk floor、Role accountability、Planning/traceability artifacts、Project profiles，以及 Validation/Delivery gate。

Codex 只在相關情境讀取需要的 reference，避免每次都載入完整團隊手冊。

## 6. Tool、Skill、Agent、Plugin、MCP 的差異

- Tool：Shell、Git、檔案、瀏覽器等可執行能力。
- Skill：一項可重複、邊界清楚的工作流程。
- Agent：一個角色的責任、工具面、阻擋權與升級關係。
- Plugin：可安裝套件，可包含 Skills、MCP 與 UI。
- MCP / Connector：連接外部工具、帳號或資料來源。
- Reference：只有特定情境需要的規則或知識。

`runtime_executor`、`local_file_sandbox`、`code_linter_compiler`、`ui_component_compiler` 不是本系統需要建立的 Skills；它們屬於 Built-in Tool、安全機制、專案命令或既有 Workflow Skill。

## 7. Modes

| Mode | 用途 |
|---|---|
| `discover` | 探索陌生專案、問題與未知項目 |
| `spike` | 限時可行性實驗 |
| `plan` | 規劃與 Readiness，不自動實作 |
| `build` | 實作已核准功能 |
| `review` | Review code、plan、design 或 release |
| `doc` | 建立或同步文件 |
| `ui` | UI/UX 設計或實作 |
| `debug` | 診斷並最小修復既有 failure |
| `ship` | 正式交付前 readiness 檢查，不代表自動部署 |

## 8. Profiles

支援 `web`、`mobile`、`desktop`、`api`、`ai`、`data`、`automation`、`infra`、`library`、`docs`、`custom`。Orchestrator 會自動判斷 primary 與 secondary profiles；明確指定 profile 不會隱藏安全相關的次要範圍。

## 9. Risk

- `low`：局部 CSS、文字、文件、無 contract/persistence 的小改動。
- `medium`：一般 Feature、API、CRUD、Dependency/Build 設定。
- `high`：Auth、OAuth、Authorization、Payment、PII、Secrets、Migration、Infra、Production、破壞性或不可逆 external write。
- `critical`：正在發生的資安事件、Production data-loss、受管制資料外洩、無 rollback 的大量操作。

使用者指定的 risk 是最低值，不能用 `risk=low` 壓低自動偵測到的安全風險。

## 10. Depth

- `quick`：只啟動必要角色，短 routing brief，加上最小充分驗證。
- `standard`：明確 Scope、AC、Dependencies、Traceability 與完整相關 checks。
- `deep`：加入 Threat/Failure model、negative paths、獨立 review、rollback、release 與 documentation gates。

Deep 技術任務不會自動啟動 CEO；CEO 只看商業 Trigger。

## 11. Routing

決策順序是：使用者限制與授權 → Mode → Change surfaces → Profiles → Risk floor → Depth floor → Roles → Skills/Tools → Gates。完整表格請見 [docs/routing-matrix.md](docs/routing-matrix.md)。

## 12. 我要做 XXX，該下什麼指令？

| 情境 | 推薦指令 | Mode / Depth | 通常啟動 |
|---|---|---|---|
| 新專案 | `$team mode=discover 規劃這個新專案：...` | discover；通常 standard | PM、Lead；商業需求才 CEO |
| 陌生專案 | `$team mode=discover 先理解這個 Repository` | discover/quick | PM-light、Lead、必要 specialist |
| 需求分析 | `$team mode=plan 分析這份需求並補齊 AC` | plan/standard | PM、Lead、QA |
| 只做規劃 | `$team mode=plan ...，不要實作` | plan | PM + relevant roles |
| UI 設計 | `$team mode=ui 設計會員管理頁面` | ui/standard | PM、UI/UX、Lead、QA |
| Frontend | `$team profile=web 新增搜尋與分頁` | build/standard | PM、UI/UX、Lead、QA |
| Backend | `$team profile=api 新增訂單查詢 API` | build/standard | PM、Lead、QA |
| Database | `$team profile=data 規劃訂單 schema migration` | plan/deep | PM、Lead、QA、Release |
| 一般 Feature | `$team 新增 CSV 匯出功能` | build/standard | PM、Lead、QA |
| Bug | `$team mode=debug 修正既有登入錯誤` | debug；自動判斷 | Lead、QA；Auth 時 security-depth |
| Build Error | `$team mode=debug 修正目前 build error` | debug/quick 或 standard | Lead、QA |
| Code Review | `$team mode=review 審查目前 diff` | review/standard | QA/Security、Lead reviewer |
| Security Review | `$team mode=review risk=high 審查 OAuth 安全性` | review/deep | QA/Security、Lead |
| 文件 | `$team mode=doc 更新 README 與 API 文件` | doc/quick 或 standard | Writer、Lead/PM support |
| Demo | `$team mode=ship 檢查 Demo 是否可展示` | ship/standard | QA、Release、Writer |
| Release | `$team mode=ship 檢查是否可正式交付` | ship/deep | QA、Release、Writer |
| Production | `$team mode=ship risk=high 檢查 production rollout` | ship/deep | QA、Release、Lead、Writer |
| 商業產品 | `$team mode=plan 規劃 SaaS 化與收費方案` | plan/deep | CEO、PM、Research、UI/UX、Lead、QA、Release、Writer |
| 市場研究 | `$team mode=discover 研究目標市場與競品` | discover/deep | CEO、PM、Research capability |
| 大型架構修改 | `$team mode=plan risk=high 規劃架構遷移` | plan/deep | PM、Lead、QA；Release/Writer conditional |

一般情況不需要手動指定角色；只有想直接測試某個 Custom Agent 時才指定。

## 13. 安裝到全域

先預覽：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-global.ps1 -DryRun
```

安全 Copy 安裝：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-global.ps1
```

安裝位置由 `$HOME` 解析，不寫死使用者名稱：

- Skills：`$HOME\.agents\skills`
- Custom Agents：`$HOME\.codex\agents`
- Optional global rules：`$HOME\.codex\AGENTS.md`

官方支援 symlink，但 Windows 需要相容的權限/Developer Mode。只有在目的地沒有既有資料夾時才使用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-global.ps1 -Mode SymbolicLink
```

## 14. 更新與跨電腦同步

每台電腦開始工作前：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\session-sync.ps1 -Phase Start -Install
```

完成 Skill/Agent 改善後：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\session-sync.ps1 -Phase Finish
```

確認 diff 後才 Commit/Push，且必須列出明確路徑：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\session-sync.ps1 -Phase Finish -Commit -Push -Paths README.md,SKILL_INVENTORY.md,skills/team,agents,docs,scripts -Message "Build global AI development team"
```

## 15. Debug

- Skill 沒出現：先執行 `validate-global.ps1`，再重新啟動 Codex。
- `$team` 沒被選中：確認 `$HOME\.agents\skills\team\SKILL.md` 存在，並用明確 `$team` invocation。
- Agent 沒出現：確認 `$HOME\.codex\agents\*.toml` 存在且含 `name`、`description`、`developer_instructions`。
- 安裝遇到 collision：安裝器不會覆寫未知同名內容；先比較、改名或明確遷移。
- 全域 `AGENTS.md` 已有內容：安裝器會保留，不會自動合併；請人工檢視 `global\AGENTS.md`。

## 16. Validation

Source 靜態檢查：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-skills.ps1
```

全域副本比對：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-global.ps1
```

驗證結果與十二個案例請見 [docs/validation-report.md](docs/validation-report.md)。

## 17. 如何新增 Skill

1. 先確認它不是 Role、Tool、Plugin、MCP、既有 Skill 或單一專案規則。
2. 只有可重複、責任獨立且有清楚 Trigger/Boundary 時才新增。
3. 建立 `skills\<name>\SKILL.md`，大量細節放 `references\`。
4. 加入正向與負向 Trigger examples。
5. 更新 README、`SKILL_INVENTORY.md` 與 `docs\skill-inventory.md`。
6. 執行 Source/Global validation。

## 18. 如何新增 Agent

1. 確認責任、Activation、Inputs、Outputs、Blocking 與 Escalation 都獨立。
2. 在 `agents\` 新增單一 TOML，至少包含 `name`、`description`、`developer_instructions`。
3. 優先繼承父模型，不綁死可能過期的模型；只在必要時限制 sandbox。
4. 更新 Role/Architecture/Inventory 文件後重新安裝。

## 19. 如何停用 Skill

依官方方式在 `$HOME\.codex\config.toml` 加入 `[[skills.config]]` 並指向該 `SKILL.md`、設定 `enabled = false`，再重新啟動 Codex。修改前先備份，保留既有 config，不要覆蓋其他 sections。

## 20. 備份

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-global.ps1
```

備份預設位於 `$HOME\.codex\backups\mySkills\<timestamp>`，不進 Git，避免 config 或其他全域資料進入 Repository。

## 21. 還原

先預覽最新備份：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-global.ps1
```

確認後 overlay restore：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-global.ps1 -Apply
```

還原腳本會先再備份現況，且不刪除未知檔案或備份後新增的項目。

## 22. 如何更新 Ahyao 行為契約

- 原始檔永遠保留在 `inbox\啊堯\`，不要直接修改或安裝。
- 新版本先放 `inbox\` 並記錄來源、日期、授權與差異。
- 只有可攜、可重複、符合現行官方架構的行為意圖才提煉到 `skills\team\references\`。
- 在 [docs/migration-report.md](docs/migration-report.md) 記錄舊假設、目前官方行為與 Migration decision。

## 23. Pending Installations

外部 Skill、Plugin、MCP、工具或 Dependency 一律先研究並記錄到 [docs/pending-installations.md](docs/pending-installations.md)。沒有使用者明確同意，不得下載或安裝。

目前列為 P1 候選的是 Codex Security、GitHub 與 Figma；它們都不是本次 `$team` 正常運作的必要條件，也都尚未安裝。

## 24. 安全與授權邊界

- Team/Role 決策不會取代使用者授權。
- Ship 不代表自動 Commit、Push、Deploy 或 Publish。
- 不自動下載 Skill、Plugin、MCP 或套件。
- 不加入 API Key、Token、Password、Secret 或付費服務。
- 不覆寫未知 global config、Skill 或 Agent。
- 高風險工作強制提高 Risk/Depth 與驗證，不會因使用者填 `low/quick` 而降低。

## 25. 文件索引

- [Architecture](docs/architecture.md)
- [Skill Inventory](docs/skill-inventory.md)
- [Capability Matrix](docs/capability-matrix.md)
- [Role Matrix](docs/role-matrix.md)
- [Routing Matrix](docs/routing-matrix.md)
- [Missing Capabilities](docs/missing-capabilities.md)
- [Pending Installations](docs/pending-installations.md)
- [Migration Report](docs/migration-report.md)
- [Validation Report](docs/validation-report.md)
- [Roadmap](docs/roadmap.md)

## 26. 核心原則

> 保留完整能力、明確分工、按需啟動、避免重複。

小任務走 Quick，一般功能走 Standard，高風險走 Deep。CEO 等較少使用的角色完整保留，但只在真正符合 Trigger 時啟動。
