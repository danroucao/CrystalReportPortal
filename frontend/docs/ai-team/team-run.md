# Frontend team run：Card 01 登入頁

- **狀態：** Done（僅前端 client-only mock）
- **專案邊界：** `frontend/`；不修改根目錄現有需求、素材、報告或 wireframe。
- **模式／profile／風險：** build + ui／web／medium（client-only mock）。
- **範圍：** Angular 17.2.4 登入頁、表單驗證、密碼顯示切換、提交中的防重送、登入成功導頁示意、錯誤／逾時顯示狀態。
- **非範圍：** API、帳密驗證、角色權限、Session 儲存或撤銷、Token、Cookie、HTTPS、鎖定／限速與報表內容。

## Traceability

| Card 01 需求 | 實作位置 | 預計驗證 |
| --- | --- | --- |
| 登入頁、帳號、密碼 | `login.component.html` | `npm test`、手動檢視 |
| 必填驗證與錯誤 | Reactive Form 與欄位錯誤文字 | 單元測試 |
| 登入成功後導頁 | `submit()` → `/home` 前端示意 | 單元測試 |
| 登入失敗／逾時呈現 | query state 的通用訊息 | 單元測試 |
| Responsive／a11y 基礎 | SCSS media query、semantic form／labels／aria | build + 手動瀏覽 |

## Assumptions and gates

- `/home` 僅為前端成功導頁示意，絕非受保護資源。
- 不讀取、不記錄、不寫入帳密、Token、Cookie、localStorage 或 sessionStorage。
- 真正的登入、登出與 Session 驗收持續受根目錄 `專案報告書.md` 的 P0 API／資安決策阻擋。

## Validation record

| 檢查 | 結果 | 證據／說明 |
| --- | --- | --- |
| Angular 版本 | PASS | Angular 17.2.4、CLI／build 17.2.3、Node 20.19.3、TypeScript 5.3.3 |
| Production build | PASS | `npm run build` 成功產生 `dist/` |
| 規格 TypeScript 編譯 | PASS | `tsc --noEmit --project tsconfig.spec.json` |
| 本機頁面檢查 | PASS | `/login` 的 form、labels、required errors、password toggle 與 session-expired notice 均由瀏覽器 DOM 驗證 |
| Karma unit tests | BLOCKED | 環境中的 ChromeHeadless GPU／暫存檔／偵錯連接埠衝突，非斷言失敗；未終止使用者可能正在使用的 Chrome 程序 |

## Delivery note

`/home` 是固定的前端導頁示意；其存在只證明 UI 導頁，不可視為登入成功、授權、Session 或保護資源已完成。

---

# Frontend team run：Demo 測試帳號

- **狀態：** Done（僅前端 local Mock）
- **專案邊界：** `frontend/`；只修改本機 Angular 展示登入與其測試、文件。
- **模式／profile／風險／深度：** build／web／medium／standard。帳密僅為使用者明確提供的本機 Demo 資料，禁止用於正式環境。
- **範圍：** 建立集中式 `MockDemoAccount` 資料、驗證 `user@example.com`／`user123` 與 `admin@example.com`／`admin123`、登入失敗回饋、暫態角色與權限展示。
- **非範圍：** API、真實身份驗證、RBAC 強制、受保護路由、Token、Cookie、Session、localStorage／sessionStorage、後端、資料庫及正式帳密管理。

## Traceability

| 需求／驗收條件 | 實作位置 | 預計驗證 |
| --- | --- | --- |
| MEMBER Demo 帳密可登入 | `demo-accounts.ts`、`login.component.ts` | 單元測試：指定帳密導頁並帶 `DemoRole=MEMBER`。 |
| ADMIN Demo 帳密可登入 | 同上 | 單元測試：指定帳密導頁並帶 `DemoRole=ADMIN`。 |
| 非指定帳密不可登入 | `login.component.ts` | 單元測試：顯示帳密錯誤、不導頁且表單恢復可輸入。 |
| Demo 用途與角色權限可辨識 | `login.component.html`、`preview-home` | 原始碼檢查與 Angular build。 |
| 不偽裝成正式登入 | 元件文案、team-run 文件 | 搜尋確認無 Token、Cookie、localStorage 或 sessionStorage。 |

## Decision and validation plan

- **決策：** 使用集中式、明確標記為 Mock 的前端資料；以暫態 `DemoRole` query parameter 傳遞展示角色。這不提供路由保護，使用者可直接修改網址，因此不可用於正式環境。
- **角色：** PM 定義邊界與驗收；Lead Developer 負責最小前端變更；UI/UX 確保 Demo 警示可見；QA/Security 驗證帳密行為與不持久化。CEO、後端、資料庫、Release 角色不適用。
- **預計證據：** 相關單元測試、`npm run build`、變更檔案與敏感儲存關鍵字檢查。

## Validation record

| 檢查 | 結果 | 證據／說明 |
| --- | --- | --- |
| TypeScript 編譯 | PASS | `npx tsc --noEmit --project tsconfig.app.json` 完成，exit code 0。 |
| Production build | PASS | `npm run build` 成功，輸出至 `dist/crystal-report-portal-ui`。 |
| Demo 登入單元測試 | BLOCKED | `npm test -- --watch=false --browsers=ChromeHeadless` 已完成測試 bundle 編譯，但 ChromeHeadless 因 GPU 程序與 Karma 快取檔被占用而無法啟動；未出現斷言失敗。 |
| 不持久化邊界 | PASS | `rg` 檢查 `frontend/src` 未找到 Token、Cookie、localStorage、sessionStorage 或 Authorization／Bearer 關鍵字。 |

## Delivery note

- `DemoRole` 是 URL query parameter，任何人可修改；它只展示預先列出的 Demo 權限，沒有保護路由或執行真實 RBAC。
- `MockDemoAccounts` 含使用者指定的本機展示帳密，必須在串接正式 API 前移除或改由安全的開發環境設定提供。

---

# Frontend delivery：Development Mock Authentication 與角色 UI

- **狀態：** In Progress（等待本機瀏覽器互動登入驗證）
- **專案邊界：** `frontend/`；Angular 前端的 Development Mock Authentication、Mock 資料、Route Guard、Demo UI、測試與此紀錄。
- **範圍：** `AuthService`、MEMBER／ADMIN Mock User、`CanView`／`CanExecute`／`CanExportPdf`／`CanPrint`、管理權限、一般與管理 UI 導覽、登出，以及 production file replacement。
- **非範圍：** ASP.NET Core API、正式帳密、Token、Cookie、Session、真實 RBAC、資料庫、PDF 產生、瀏覽器／固定印表機服務與 Dashboard。

## Traceability

| 驗收條件 | 實作 | 證據狀態 |
| --- | --- | --- |
| 兩組帳密可在 Development Mock 登入 | `mock-users.ts`、`AuthService`、`LoginComponent` | TypeScript、development build、待互動登入。 |
| 錯誤帳密會失敗 | `AuthService.Login()` 與 `LoginComponent` 錯誤 notice | TypeScript、待單元／互動驗證。 |
| MEMBER 無管理 UI／路由 | `DemoPortalComponent` 的條件導覽、`DemoAdminGuard` | TypeScript、待互動路由驗證。 |
| ADMIN 有管理 UI／路由 | 同上 | TypeScript、待互動路由驗證。 |
| 四項報表權限可模擬 | `mock-permissions.ts`、`AuthService.ReportPermission`、`ReportPreview` UI | TypeScript、待單元／互動驗證。 |
| 登出清除 Demo State | `AuthService.Logout()`、Portal 登出動作 | TypeScript、待互動驗證。 |
| production 不依賴 Demo 帳密 | Angular file replacement 與 production Provider | `npm run build`、bundle 關鍵字檢查。 |

---

# Frontend debug：Demo Portal Mock RBAC 狀態同步

- **狀態：** Done（僅前端 local Mock）
- **專案邊界：** `frontend/`；只修正 `DemoPortalComponent`、`MockRbacService` 的本機 Mock 管理流程與其測試，不變更正式 API、驗證或資料庫。
- **模式／profile／風險／深度：** debug／web／medium／standard。此修正涉及 Demo 角色狀態，但不會持久化資料或執行外部寫入。
- **範圍：** 管理員核准自身降職時的離開管理頁流程，以及目前登入帳號在清單與編輯表單中的自我停用防護。
- **非範圍：** 真實身份驗證、Session／Token、後端 RBAC 強制、正式資料與其他使用者的啟用／停用流程。

## Traceability

| 驗收條件 | 實作位置 | 預計驗證 |
| --- | --- | --- |
| 管理員核准自身降職後不可留在管理頁 | `demo-portal.component.ts`、`demo-portal.component.html` | 元件測試、Angular 模板編譯、production build |
| 目前登入帳號不可在管理頁自行停用 | 同上 | 元件測試、Angular 模板編譯、production build |

## Validation record

| 檢查 | 結果 | 證據／說明 |
| --- | --- | --- |
| Angular 模板編譯 | PASS | `ngc.cmd -p tsconfig.app.json --noEmit` 成功。 |
| 測試 TypeScript 編譯 | PASS | `tsc.cmd --noEmit --project tsconfig.spec.json` 成功，包含新增的元件測試。 |
| Production build | PASS | `npm run build` 成功；僅保留既有 `demo-portal.component.scss` style budget 超出 1.95 kB 的警告。 |
| Karma unit tests | BLOCKED | `ChromeHeadless` 因 GPU process 與暫存快取檔案鎖定無法啟動，未出現測試斷言失敗。 |
| 變更差異檢查 | PASS | 目標檔案 `git diff --check` 未發現 whitespace error；僅有既有 LF→CRLF 提示。 |

## Lesson learned

- **分類：** implementation。Mock RBAC 若會在同一個元件生命週期內變更目前使用者角色或啟用狀態，必須同時重新整理前端授權快照、移除管理 UI，並導向可存取路由；只更新 in-memory 資料不會重新執行目前路由的 guard。

---

# Frontend feature：UserManagement 使用者與角色整合

- **狀態：** Done（僅前端 local Mock）
- **專案邊界：** `frontend/`；Angular UserManagement 的 UIUX 與 in-memory Mock RBAC，不修改後端、Database 或正式安全控制。
- **模式／profile／風險／深度：** build + ui／web／medium／standard。
- **範圍：** 移除殘留 RoleManagement 導覽／模板，於 UserManagement 整合角色卡、建立／編輯角色 Modal、使用者表、搜尋、角色篩選及既有建立／編輯使用者 Modal。
- **非範圍：** 新 Route、角色刪除、密碼重設、Avatar、活動紀錄、額外權限種類或後端持久化。
- **假設：** 角色編輯可修改顯示名稱、說明與既有四項報表權限，但不變更內部 Key 或既有管理員核准規則。

## Traceability

| 驗收條件 | 實作位置 | 預計驗證 |
| --- | --- | --- |
| RoleManagement 已整合、無側欄入口 | `demo-portal.component.html`、`app.routes.ts` | Angular 模板編譯、原始碼檢查 |
| 角色卡與建立／編輯角色 Modal 可更新 Mock 資料 | `demo-portal.component.*`、`mock-rbac.service.ts` | service／component spec、build |
| 使用者搜尋、角色篩選、Modal 與原管理員限制維持有效 | `demo-portal.component.*`、既有 Mock RBAC | component spec、build |

## Validation record

| 檢查 | 結果 | 證據／說明 |
| --- | --- | --- |
| RoleManagement 移除檢查 | PASS | `rg` 未找到 `RoleManagement` 或 `/admin/roles` 的前端原始碼參照。 |
| Angular 模板編譯 | PASS | `ngc.cmd -p tsconfig.app.json --noEmit` 成功。 |
| 測試 TypeScript 編譯 | PASS | `tsc.cmd --noEmit --project tsconfig.spec.json` 成功，包含角色建立／編輯的 service 與 component specs。 |
| Production build | PASS | `npm run build` 成功。既有 `demo-portal.component.scss` style budget 超出 1.95 kB 警告仍存在，未新增 component style。 |
| Karma unit tests | BLOCKED | `ChromeHeadless` 因 GPU process 與暫存快取檔案鎖定無法啟動；browser bundle 已完成編譯，未執行 assertion。 |
| 差異檢查 | PASS | 目標檔案 `git diff --check` 未發現 whitespace error；僅有既有 LF→CRLF 提示。 |

## Lesson learned

- **分類：** implementation。角色的顯示名稱／說明與報表權限都屬同一份 Mock role state；卡片、篩選選項與報表權限編輯器必須讀取同一服務，才能在 Modal 儲存後立即一致更新，而不需要新增頁面或 Route。
