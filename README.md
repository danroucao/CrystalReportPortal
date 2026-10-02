# CrystalReportPortal

A web-based Crystal Reports system for query, preview, PDF export, and printing, built with Angular and ASP.NET Core.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Language Composition](#language-composition)
- [Dependencies and Runtime Requirements](#dependencies-and-runtime-requirements)
- [Repository Structure](#repository-structure)
- [Configuration](#configuration)
- [Development Setup](#development-setup)
  - [Option A: Bootstrap Script (Recommended)](#option-a-bootstrap-script-recommended)
  - [Option B: Manual Setup](#option-b-manual-setup)
- [Run the Application](#run-the-application)
- [Build and Test](#build-and-test)
- [Deployment Notes](#deployment-notes)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**CrystalReportPortal** provides a browser-based workflow for Crystal Reports operations:

- Report query with parameters
- Report preview
- PDF export
- Printing support

The system uses:
- **Angular** for frontend UI
- **ASP.NET Core API** for backend logic
- A dedicated **Crystal Service** (.NET Framework 4.8) for Crystal Reports processing

---

## Architecture

- `frontend/`  
  Angular 17 application (UI, routing, report parameter forms, preview pages)

- `backend/CrystalReportPortal.Api/`  
  ASP.NET Core (`net10.0`) API, authentication, data access, orchestration

- `crystal-service/CrystalReportPortal.CrystalService/`  
  .NET Framework 4.8 executable for Crystal Reports engine interaction (`CrystalDecisions.*`)

### Runtime Flow (Typical)

1. User submits report parameters in Angular UI.
2. API validates request and authorization.
3. API invokes Crystal Service for report metadata/rendering/export.
4. API returns preview/PDF output to frontend.

---

## Key Features

- Parameterized report querying
- Crystal report preview workflow
- PDF export pipeline
- Printing-oriented output handling
- JWT-based API authentication support
- SQL Server integration via EF Core

---

## Technology Stack

### Frontend
- Angular `17.2.4`
- TypeScript `~5.3.2`
- RxJS `~7.8.0`
- Zone.js `~0.14.3`
- Karma + Jasmine test stack

### Backend API
- ASP.NET Core (`Microsoft.NET.Sdk.Web`)
- Target Framework: `net10.0`
- EF Core SQL Server `10.0.11`
- JWT Bearer Auth `10.0.11`
- OpenAPI package `10.0.11`
- BCrypt.Net-Next `4.2.0`

### Crystal Service
- .NET Framework `4.8` (x64 target in Debug)
- SAP Crystal Reports assemblies `13.0.4000.0`

---

## Language Composition

- C#: 45.7%
- TypeScript: 28.1%
- SCSS: 13.2%
- HTML: 12.1%
- T-SQL: 0.6%
- PowerShell: 0.2%
- JavaScript: 0.1%

---

## Dependencies and Runtime Requirements

From `project-dependencies.json` and project files:

1. **.NET SDK 10.0.x**  
   Required for API and API tests (`net10.0`).

2. **.NET Framework Developer Pack 4.8**  
   Required to build Crystal Service.

3. **SAP Crystal Reports for .NET (x64)**  
   Assembly version `13.0.4000.0` required by Crystal Service.

4. **Microsoft SQL Server**  
   API expects reachable SQL Server instance (dev default references `localhost,1433`).

5. **Node.js (Angular 17 compatible LTS)**  
   Required for frontend build and dev server.

6. **Poppler (`pdftoppm`)**  
   Used for secure in-page PDF preview.  
   Configure via `PdfPreview:RendererPath` or ensure binary is on `PATH`.

---

## Repository Structure

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

## Configuration

### API (`backend/CrystalReportPortal.Api/appsettings.json`)
- `DataProtection:KeyRingPath`
- `Jwt:Issuer`
- `Jwt:Audience`
- `Jwt:ExpireMinutes`
- `PdfPreview:RendererPath`
- `Logging`
- `AllowedHosts`

### Development Overrides (`appsettings.Development.json`)
- `ConnectionStrings:DefaultConnection`
- `CrystalService:ExePath`
- `BackOffice:Account`
- `BackOffice:PasswordHash`

> **Important:** Never commit real secrets.  
> Use environment variables, user secrets, or CI/CD secret providers.

---

## Development Setup

## Option A: Bootstrap Script (Recommended)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-development.ps1
```

Validation-only mode:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-development.ps1 -ValidateOnly
```

This script restores npm/NuGet packages and builds Crystal Service, but does **not** install external system dependencies (SAP Crystal runtime, SQL Server, etc.).

## Option B: Manual Setup

### 1) Frontend

```bash
npm ci --prefix frontend
```

### 2) Backend API

```bash
dotnet restore backend/CrystalReportPortal.Api/CrystalReportPortal.Api.csproj
dotnet build backend/CrystalReportPortal.Api/CrystalReportPortal.Api.csproj
```

### 3) Crystal Service

```bash
dotnet build crystal-service/CrystalReportPortal.CrystalService/CrystalReportPortal.CrystalService.csproj
```

---

## Run the Application

### Start Backend API

```bash
dotnet run --project backend/CrystalReportPortal.Api/CrystalReportPortal.Api.csproj
```

### Start Frontend

```bash
npm start --prefix frontend
```

Frontend default dev URL is typically `http://localhost:4200`.

---

## Build and Test

### Frontend Build

```bash
npm run build --prefix frontend
```

### Frontend Tests

```bash
npm test --prefix frontend
```

### API Tests

```bash
dotnet test backend/CrystalReportPortal.Api.Tests/CrystalReportPortal.Api.Tests.csproj
```

---

## Deployment Notes

- Deploy API (`net10.0`) and frontend artifacts separately.
- Ensure Crystal Service executable path is valid in deployed environment.
- Install SAP Crystal Reports runtime on target hosts.
- Install/configure `pdftoppm` for preview conversion.
- Confirm SQL connectivity and permissions for runtime account.
- Verify filesystem access for data protection keys and temp/output directories.

---

## Security Notes

- JWT settings are configured under `Jwt`.
- `BackOffice:PasswordHash` uses BCrypt hash format.
- Apply strict role/permission checks for report export/print endpoints.
- Sanitize and validate all report input parameters.
- Keep secret material out of source control.

---

## Troubleshooting

1. **Crystal report operations fail**
   - Verify SAP Crystal runtime installation and x64 compatibility.
   - Verify `CrystalService:ExePath` is correct.
   - Verify CrystalDecisions assemblies are resolvable.

2. **Preview conversion fails**
   - Verify `PdfPreview:RendererPath` points to `pdftoppm`.
   - Verify process permissions and executable availability.

3. **Database connection issues**
   - Verify `DefaultConnection` string and SQL Server availability.
   - Verify account/auth mode and database existence.

4. **Frontend cannot call API**
   - Verify API base URL in frontend environment settings.
   - Verify CORS and host/port exposure.

---

## Contributing

1. Create a feature branch.
2. Keep commits focused and descriptive.
3. Add or update tests when behavior changes.
4. Open a Pull Request with implementation notes and validation steps.

---

## License

No license file is currently defined in the provided project metadata.  
Add a `LICENSE` file (e.g., MIT or Apache-2.0) if open-source distribution is intended.
