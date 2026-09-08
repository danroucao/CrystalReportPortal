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
| UI Library | 未使用 Angular Material 或其他第三方 UI Component Library；採 Angular standalone components 與 SCSS。 |
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
- 管理 UI：`UserManagement`、`RoleManagement`、`ReportPermission`、`RptManagement`、`ReportParameterSetting`、`DatabaseConnection`、`OperationLog`。
- Development Mock Role／Permission：MEMBER 可使用一般報表流程；ADMIN 額外可檢視管理導覽與管理頁面。

### 尚未串接的項目

- 尚未串接 ASP.NET Core Login API、正式 Session、Token、Cookie、API Authorization 或正式 RBAC。
- 尚未有 API Base URL；專案沒有 `src/environments/` 目錄或正式 API endpoint 設定。
- 報表資料、使用者、角色、權限與管理頁內容目前皆使用 `src/app/mock/` 的 Mock Data；公開的 User Read Model 不包含 Password。
- PDF 產生、瀏覽器列印與固定印表機服務均未串接後端。

正式 API 完成後，應以實際 API Service 替換 `AuthService` 所使用的 Mock Provider，不應把 Mock Authentication 視為正式安全機制。

## Demo 帳號

僅供 Development／Local Demo 使用，禁止用於正式環境。

| 帳號 | 角色 | 行為 |
| --- | --- | --- |
| `user@example.com` | `FINANCE` | 可檢視已授權的一般報表 UI；無管理導覽及管理路由權限。 |
| `admin@example.com` | `ADMIN` | 可檢視一般報表 UI 與所有現有管理 UI。 |

`CanExecute`、`CanExportPdf`、`CanPrint` 目前由 `src/app/mock/mock-permissions.ts` 模擬；只有啟用且具有 `CanExecute` 的報表會出現在「我的報表」。UserManagement 顯示 Account、UserName、Roles、IsEnabled、CreatedAt、UpdatedAt 與 Edit／Delete；管理員僅可在建立時設定初始名稱與密碼。production configuration 透過 `angular.json` 的 file replacement 改用 `mock-authentication.provider.production.ts`，不提供 Demo 帳號。

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
