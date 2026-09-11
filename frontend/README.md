# Crystal Reports 外部報表查詢與列印系統｜Frontend

此目錄是 Crystal Reports 外部報表查詢與列印系統的 Angular 前端專案，主要負責 Desktop UI／UX、登入畫面、報表查詢流程與管理介面之展示與前端互動。

## 技術環境

| 項目 | 實際設定 |
| --- | --- |
| Framework | Angular `17.2.4` |
| Angular CLI / Build | `17.2.3` |
| TypeScript | `~5.3.2`（專案鎖定版本為 5.3.x） |
| Package Manager | npm（`package-lock.json` lockfile v3） |
| Node.js | Angular Build 依賴要求 `^18.13.0` 或 `>=20.9.0`；本工作區驗證使用 `v20.19.3`。 |
| npm | 本工作區驗證使用 `10.8.2`。 |
| UI Library | Angular standalone components 與 SCSS；裝飾頭像採 `ngx-boring-avatars`。 |
| 主要套件 | Angular Router、Reactive Forms、RxJS、Zone.js、Karma/Jasmine。 |

## 安裝與啟動

```bash
npm install
npm start
```

`npm start` 會使用 Angular development configuration，預設網址為 `http://localhost:4200/`。

## Build

```bash
npm run build
```

預設為 production build，輸出至 `dist/crystal-report-portal-ui/`。如需明確驗證 Development Mock build，可執行：

```bash
npm run build -- --configuration development
```

## Demo 與 API 狀態

### 已完成的前端 Demo UI

- `UserLogin`：表單驗證、錯誤提示、密碼顯示切換與本機 Mock 登入。
- `ReportList`、`ReportSearch`、`ReportCategory`：以 Mock 報表資料展示清單、搜尋與分類。
- `ReportParameter`、`ReportPreview`：Mock 條件輸入與 PDF／列印操作入口。
- `PdfExport`、`BrowserPrint`、`FixedPrinterPrint`：僅展示前端 Mock 操作入口；固定印表機細節仍為 TBD。
- `AccountSettings`：登入者可在 Frontend Mock 中修改自己的名稱與新密碼；不包含角色、啟用狀態或帳號修改。
- 後台「系統設定」：僅有使用者管理及操作紀錄查詢；角色與權限統一在使用者管理的角色卡片／Modal 編輯。
- 前台：所有報表、收藏的報表、帳號設定；依 Role 的全域權限顯示報表管理及資料庫連線管理。
- 五種權限採方案 B：全域「資料庫連線管理」`DatabaseConnection`、「報表管理」`RptManagement`，以及各分類的「預覽」`CanExecute`、「匯出」`CanExport`、「列印」`CanPrint`；多角色採 OR／Allow-Wins。管理權限不會額外授予報表預覽權限。「預覽」涵蓋選取、產生及預覽流程，內部判斷仍使用 `CanExecute`。

### 尚未串接的項目

- 尚未串接 ASP.NET Core Login API、正式 Session、Token、Cookie、API Authorization 或正式 RBAC。
- `api.config.ts` 保留本機 API Base URL，舊 API Service 尚未接入目前 Mock 登入／權限流程；正式認證與授權契約仍需後端提供。
- 報表資料、使用者、角色、權限與管理頁內容目前皆使用 `src/app/mock/` 的 Mock Data；公開的 User Read Model 不包含 Password。
- PDF 產生、瀏覽器列印與固定印表機服務均未串接後端。

正式 API 完成後，應以實際 API Service 替換 `AuthService` 所使用的 Mock Provider，不應把 Mock Authentication 視為正式安全機制。

## Demo 帳號

僅供 Development／Local Demo 使用，禁止用於正式環境。

| 帳號 | 身分／角色 | 行為 |
| --- | --- | --- |
| `user@example.com` | `FINANCE` | 可檢視已授權的一般報表 UI；無管理導覽及管理路由權限。 |
| `admin@example.com` | 獨立後台「系統設定」帳號 | 登入使用者管理；不屬於 User 或 Role，不參與收藏或前台報表操作。 |

沿用單一 `/login`。登入後依身分進入前台 `/reports/parameters` 或後台 `/admin/users`；目前 App 記憶體只保存一個身分，重新登入（含失敗）及登出會清除前一身分和選取的報表。重新整理會回到未登入及預設 Mock 資料；正式跨分頁／裝置 Session 失效由後端實作。

一般角色的兩種全域管理權限預設皆未勾選。Demo 驗證方式：以後台帳號登入 → 編輯「財務人員」角色 → 勾選功能權限並儲存 → 登出 → 以 `user@example.com` 登入，即可看到對應管理入口。報表權限仍依分類設定；「匯出」統一控制既有 PDF、Excel、Word、CSV、RTF、文字檔的 Mock 入口。

UserManagement 只包含前台使用者；建立時設定帳號、名稱、角色與啟用狀態，初始密碼由後端隨機產生並以一次性建立結果回傳。後續名稱／密碼由使用者在帳號設定自助修改。Development Mock 以瀏覽器安全亂數模擬此回傳，production configuration 透過 `angular.json` 的 file replacement 改用 `mock-authentication.provider.production.ts`，不提供任何 Demo 登入帳號。

詳細路由、決策覆蓋與驗收紀錄見 [前後台分流實作紀錄](docs/ai-team/front-back-office-migration.md)。舊 `/admin/reports`、`/admin/database-connections` 轉址至受權限保護的前台管理頁；已移除的角色／權限／參數設定獨立頁不再提供入口。

## 前端目錄結構

```text
frontend/
├─ docs/ai-team/       前端 Demo／驗收紀錄
├─ src/
│  ├─ app/
│  │  ├─ demo-portal/  一般報表與管理 UI 的共用 Demo Portal
│  │  ├─ guards/       Development Mock 路由 Guard
│  │  ├─ login/        登入 UI
│  │  ├─ mock/         Mock User、Permission、Report 與 Authentication Provider
│  │  └─ services/     AuthService
│  ├─ assets/          Angular 靜態資產
│  ├─ main.ts          啟動點
│  └─ styles.scss      全域樣式
├─ angular.json        Angular CLI 與 production file replacement 設定
├─ package.json        scripts 與套件版本
└─ package-lock.json   npm 鎖定檔
```

## 注意事項

- 開發前先執行 `npm install`。
- `node_modules/`、`dist/`、`.angular/cache/` 屬本機依賴或產物，依 `.gitignore` 規則不應提交 Git。
- 請勿將 Demo 帳密、Mock User 或 Mock Authentication 用於 production；正式帳密、Session 與授權應由後端處理。
- UI／UX 需求與設計文件位於上層 [docs](../docs/)；本目錄只保存前端程式與前端驗收紀錄。
