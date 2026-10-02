# CrystalReportPortal

一套以 **Angular** 與 **ASP.NET Core** 建置的 Web 化 Crystal Reports 系統，支援報表查詢、預覽、PDF 匯出與列印。

---

## 目錄

- [專案概述](#專案概述)
- [系統架構](#系統架構)
- [主要功能](#主要功能)
- [技術棧](#技術棧)
- [相依套件與執行需求](#相依套件與執行需求)
- [專案結構](#專案結構)
- [設定檔說明](#設定檔說明)
- [開發環境安裝](#開發環境安裝)
  - [方案 A：一鍵初始化（建議）](#方案-a一鍵初始化建議)
  - [方案 B：手動安裝](#方案-b手動安裝)
- [執行方式](#執行方式)
- [建置與測試](#建置與測試)
- [部署注意事項](#部署注意事項)
- [安全性建議](#安全性建議)
- [疑難排解](#疑難排解)
- [貢獻方式](#貢獻方式)
- [授權](#授權)

---

## 專案概述

**CrystalReportPortal** 提供企業報表使用流程的 Web 入口，核心流程包含：

- 報表參數輸入與查詢
- 報表預覽
- PDF 匯出
- 列印輸出

系統採前後端分離，並透過獨立 Crystal Service 與 Crystal Reports 引擎整合。

---

## 系統架構

- `frontend/`  
  Angular 17 前端（UI、路由、報表參數頁面、預覽頁）

- `backend/CrystalReportPortal.Api/`  
  ASP.NET Core API（`net10.0`），負責驗證、商業邏輯與流程協調

- `crystal-service/CrystalReportPortal.CrystalService/`  
  .NET Framework 4.8 可執行服務，負責 Crystal Reports 相關解析與輸出

### 一般流程

1. 使用者在前端輸入報表參數。
2. 前端呼叫 API。
3. API 驗證請求並呼叫 Crystal Service。
4. 回傳預覽或 PDF 結果給前端。

---

## 主要功能

- 參數化報表查詢
- 報表預覽流程
- PDF 匯出
- 列印支援
- JWT 驗證機制
- SQL Server（EF Core）資料存取

---

## 技術棧

### 前端
- Angular `17.2.4`
- TypeScript `~5.3.2`
- RxJS `~7.8.0`
- Zone.js `~0.14.3`
- Karma + Jasmine 測試框架

### 後端 API
- ASP.NET Core (`Microsoft.NET.Sdk.Web`)
- Target Framework: `net10.0`
- EF Core SQL Server `10.0.11`
- JWT Bearer `10.0.11`
- OpenAPI `10.0.11`
- BCrypt.Net-Next `4.2.0`

### Crystal Service
- .NET Framework `4.8`（Debug 為 x64）
- SAP Crystal Reports 組件 `13.0.4000.0`

---

## 相依套件與執行需求

依 `project-dependencies.json` 與專案檔整理：

1. **.NET SDK 10.0.x**  
   API 與測試專案需要（`net10.0`）。

2. **.NET Framework Developer Pack 4.8**  
   Crystal Service 建置需要。

3. **SAP Crystal Reports for .NET（x64）**  
   Crystal 組件版本 `13.0.4000.0`。

4. **Microsoft SQL Server**  
   API 預設需可連線 SQL Server（開發環境預設 `localhost,1433`）。

5. **Node.js（Angular 17 相容 LTS）**  
   前端建置與開發伺服器需要。

6. **Poppler (`pdftoppm`)**  
   用於安全 PDF 預覽轉圖；可放入 PATH 或設定絕對路徑。

---

## 專案結構

```text
CrystalReportPortal/
├─ frontend/
│  ├─ package.json
│  └─ ...
├─ backend/
│  ├─ CrystalReportPortal.Api/
│  │  ├─ CrystalReportPortal.Api.csproj
│  │  ├─ appsettings.json
│  │  └─ appsettings.Development.json
│  └─ CrystalReportPortal.Api.Tests/
├─ crystal-service/
│  └─ CrystalReportPortal.CrystalService/
│     ├─ CrystalReportPortal.CrystalService.csproj
│     └─ ...
├─ scripts/
│  └─ setup-development.ps1
└─ project-dependencies.json
```

---

## 設定檔說明

### API 設定（`backend/CrystalReportPortal.Api/appsettings.json`）
- `DataProtection:KeyRingPath`
- `Jwt:Issuer`
- `Jwt:Audience`
- `Jwt:ExpireMinutes`
- `PdfPreview:RendererPath`
- `Logging`
- `AllowedHosts`

### 開發環境覆寫（`appsettings.Development.json`）
- `ConnectionStrings:DefaultConnection`
- `CrystalService:ExePath`
- `BackOffice:Account`
- `BackOffice:PasswordHash`

> 請勿將真實密碼或憑證提交到版本庫；建議使用環境變數、User Secrets 或 CI/CD Secret。

---

## 開發環境安裝

## 方案 A：一鍵初始化（建議）

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-development.ps1
```

僅驗證模式：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-development.ps1 -ValidateOnly
```

此腳本會還原 npm/NuGet 套件並建置 Crystal Service；不會代裝 SAP Crystal Runtime 或 SQL Server。

## 方案 B：手動安裝

### 1) 前端

```bash
npm ci --prefix frontend
```

### 2) 後端 API

```bash
dotnet restore backend/CrystalReportPortal.Api/CrystalReportPortal.Api.csproj
dotnet build backend/CrystalReportPortal.Api/CrystalReportPortal.Api.csproj
```

### 3) Crystal Service

```bash
dotnet build crystal-service/CrystalReportPortal.CrystalService/CrystalReportPortal.CrystalService.csproj
```

---

## 執行方式

### 啟動 Backend API

```bash
dotnet run --project backend/CrystalReportPortal.Api/CrystalReportPortal.Api.csproj
```

### 啟動 Frontend

```bash
npm start --prefix frontend
```

前端預設開發位址通常為 `http://localhost:4200`。

---

## 建置與測試

### 前端建置

```bash
npm run build --prefix frontend
```

### 前端測試

```bash
npm test --prefix frontend
```

### API 測試

```bash
dotnet test backend/CrystalReportPortal.Api.Tests/CrystalReportPortal.Api.Tests.csproj
```

---

## 部署注意事項

- Frontend 與 API 請分別部署。
- 確認 `CrystalService:ExePath` 在目標環境有效。
- 目標主機需安裝 SAP Crystal Runtime。
- 確認 `pdftoppm` 可執行（PATH 或絕對路徑）。
- 確認 SQL 連線權限與帳號權限。
- 確認 key ring 與暫存目錄權限可讀寫。

---

## 安全性建議

- 依角色分權控管查詢/匯出/列印操作。
- 嚴格驗證報表輸入參數。
- SQL 走參數化查詢，避免 Injection。
- 定期清理暫存檔。
- 針對預覽、匯出、列印保留稽核紀錄。

---

## 疑難排解

1. **Crystal 相關功能失敗**
   - 檢查 SAP Crystal Runtime 是否正確安裝（x64）
   - 檢查 `CrystalService:ExePath`
   - 檢查 CrystalDecisions 組件解析

2. **預覽轉換失敗**
   - 檢查 `PdfPreview:RendererPath` 是否指向 `pdftoppm`
   - 檢查執行權限與 PATH

3. **資料庫連線失敗**
   - 檢查 `DefaultConnection`
   - 檢查 SQL Server 是否啟動、帳號是否有權限

4. **前端無法呼叫 API**
   - 檢查前端 API Base URL
   - 檢查 CORS 設定

---

## 貢獻方式

1. 建立功能分支
2. 小步且清楚提交 commit
3. 變更行為時補齊測試
4. 開 PR 並附上驗證步驟

---

## 授權

目前未定義授權條款。  
若計畫開源，請新增 `LICENSE`（例如 MIT、Apache-2.0）。
