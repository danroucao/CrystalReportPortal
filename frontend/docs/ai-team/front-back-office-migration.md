# 前後台分流與五種權限實作紀錄

日期：2026-09-10。範圍：Angular Frontend／Development Mock。

依使用者確認：D1 選 B、沿用單一登入頁、同時只有一種 Session、多 Role 採 OR／Allow-Wins；使用者另明確授權開始實作，並補充權限顯示名稱改為「預覽」。決策來源為本次對話，非另行召開的會議。

## 交付狀態

| Version / Milestone | Feature | Status | 驗收 |
|---|---|---|---|
| Frontend Mock V1 / M1 | 身分分離及單一登入狀態 | Done | 後台沒有 User／Role，登入切換／失敗／登出清除報表選取 |
| Frontend Mock V1 / M2 | 五種權限及角色 Modal | Done | 兩種全域權限與三種分類權限可編輯、保存、重開；多角色 OR |
| Frontend Mock V1 / M3 | Sidebar／Route／Guard | Done | 後台兩頁；前台固定三頁加兩個授權入口；舊 URL 轉址仍受 Guard 保護 |
| Frontend Mock V1 / M4 | 移除 ADMIN 業務規則 | Done | 不含 ADMIN 帳號／角色／篩選／唯讀最高權限／最少人數／角色變更核准流程 |
| Frontend Mock V1 / M5 | Regression／文件 | Done | 測試結果及瀏覽器驗收見下文 |
| 正式串接 | 身分驗證、Session、授權 API、報表與列印 | Deferred | BACKEND REQUIRED；不包含於本次前端實作 |

## 權限原則

- AuthIdentity 為 `FrontUser | BackOffice | null`，前台角色從目前有效使用者資料讀取，不保存過期的角色快照。
- `User → Role.ManagementPermissions` 以 OR 合併 `DatabaseConnection`／`RptManagement`。
- `User → Role → CategoryId` 分別 OR 合併 `CanExecute`／`CanExport`／`CanPrint`，不跨分類授權。
- `CanExecute` 的 UI 名稱為「預覽」，涵蓋報表選取、產生及預覽；保留既有內部 key 及相依規則，避免顯示用語變更誤改授權範圍。
- 未知角色、未知／保留分類、停用報表、停用使用者不授權；`CanExecute = false` 會清除並停用該角色分類的匯出與列印。
- 管理頁權限與報表操作權限各自檢查。報表管理權限允許維護所有報表 Metadata，但不自動允許執行、匯出或列印。
- 搜尋、分類選項、收藏、選取、直接進入預覽、產生、匯出與兩種列印共用有效分類權限；方法層再檢查權限，避免僅隱藏按鈕。
- 後台帳號沒有一般 User CRUD、Role、收藏或報表權限。已開啟的管理頁遇到權限撤銷會隱藏並轉回可用入口。

## Route 對照

| Route | 範圍／必要條件 |
|---|---|
| `/login` | Public；同一頁依認證結果區分身分 |
| `/reports/parameters` | FrontUser；所有預覽且啟用的報表 |
| `/reports` | FrontUser；目前帳號仍預覽的收藏 |
| `/reports/preview` | FrontUser；已選取且仍預覽的報表 |
| `/account/settings` | FrontUser；自己的名稱與密碼 |
| `/report-management` | FrontUser + RptManagement |
| `/database-connections` | FrontUser + DatabaseConnection |
| `/admin/users` | BackOffice；含角色與五種權限 Modal |
| `/admin/operation-logs` | BackOffice；既有 Mock placeholder |
| `/admin/reports` | 轉址 `/report-management`，目標 Guard 生效 |
| `/admin/database-connections` | 轉址 `/database-connections`，目標 Guard 生效 |
| 其他舊角色／權限／參數設定路由 | 無獨立頁面；由既有 wildcard 回登入 |

未登入的保護路由回 `/login`；已登入但權限不足回該身分首頁並提示。前台沒有任何可進入後台的 Role。

## 保留與限制

保留多角色、RoleKey、CategoryId、保留分類搬移、新分類預設拒絕、報表 CRUD／RPT Upload／釘選／啟停、資料庫密碼安全 Read Model、日期校正、收藏及帳號設定。頭像仍採 `ngx-boring-avatar` 的 beam，以帳號為 seed，無點擊或上傳功能。

建立使用者時，建立視窗不再輸入初始密碼；正式後端須產生安全隨機初始密碼並在建立結果中只回傳一次，前端顯示後由管理者安全傳送給使用者。Development Mock 僅以瀏覽器安全亂數模擬這份一次性結果，不能視為正式 credential storage 或傳遞機制。

Session 目前為單一 App instance 的記憶體狀態；不是正式 Cookie／Token，也不實作跨分頁／裝置的伺服器 Session 失效。Mock Store 可由開發者工具存取，不能作為安全邊界。正式 API 的身分判定、密碼保存、授權強制、Session 撤銷、Audit、資料持久化與報表輸出由後端負責；匯出格式及固定印表機的正式支援仍需後端確認。

## 驗證證據

- TypeScript：`tsc --project tsconfig.spec.json --noEmit` 通過。
- Karma／Chrome Headless：89 項測試全部通過；涵蓋路由越權、身分切換、帳號停用、OR 權限、分類搬移、角色編輯、撤銷後操作、搜尋／排序／分頁與安全 DB Read Model。
- 目前安裝樹沒有頂層 webpack；以 `NODE_PATH=node_modules/@angular-devkit/build-angular/node_modules` 使用既有 nested webpack，未安裝或更新依賴。Chrome Headless 需在可啟動瀏覽器的執行權限下測試。
- Production build 通過；初始套件約 545 KB 超出 500 KB 警告門檻，login 5.41 KB／portal 5.96 KB 樣式超出 4 KB 警告門檻，皆未超過 error budget。
- Chrome 實際 UI：後台登入 → 角色勾選兩種全域權限 → 儲存 → 登出 → 前台登入 → 顯示五個入口並可進入兩個管理頁；未授權前台只有三個基本入口，後台固定兩個入口。沒有未捕捉的 runtime error。
- 已檢視 1920px 後台使用者、角色權限視窗、授權前台與 390px 窄版截圖；三個位置的 beam 頭像、角色卡片與權限欄位正常呈現。

## 文件追溯

目前行為以 Project-Decisions.md 的 PD-027～PD-030 及本文件為準；README 已同步。

| 文件 | 處理 |
|---|---|
| `../docs/requirements/Project-Decisions.md` | 新增 APPROVED 決策，保留舊決策歷史並標註覆蓋範圍 |
| `../docs/analysis/Frontend-ERD-Impact-Report.md` | DocumentationUpdateRequired：後續 ERD／API 串接須更新獨立後台身分、Role 全域權限及 Category 匯出名稱 |
| `docs/ai-team/report-category-management-plan.md` | 保留歷史；管理者改為有 RptManagement 的前台使用者，分類規則仍有效 |
| Frontend Cards／既有 ai-team 驗收文件 | 保留歷史；ADMIN、舊 Route、PDF-only 及核准流程描述已由新決策取代 |

## 實作經驗

原因分類：Implementation／Testing。舊搜尋流程繞過既有分類權限，而測試也期待全量清單；因此只改 Sidebar 不足以完成分流。本次同步檢查清單、分類、收藏、選取、Guard 與操作方法，並用未授權報表及即時撤銷情境驗證。下次權限改版應先建立允許／拒絕矩陣，再保留與新需求相容的排序、分頁及表單回歸測試。
