# CrystalReportPortal
Web-based Crystal Reports query, preview, PDF export, and printing system built with Angular and ASP.NET Core.

## Requirement Governance

後續需求判定與變更請使用 [Project Decision Register](docs/requirements/Project-Decisions.md)。只有其中 `Status: APPROVED` 的 Decision 能覆蓋既有需求；`PROPOSED`、`PENDING`、`REJECTED` 與 `SUPERSEDED` 不具覆蓋效力。

### Requirement Priority

1. Approved Project Decisions
2. [0818_廠商回復.md](docs/requirements/0818_廠商回復.md)
3. ERD (`CrystalReportERD_中文.png`／`CrystalReportERD.jpg`)
4. [fronted_reauest.md](docs/requirements/fronted_reauest.md)
5. Current Angular Implementation
6. Best Practice

### Requirement Change Process

`提出問題` → `建立 PROPOSED / PENDING Decision` → `團隊討論` → `APPROVED` → `正式覆蓋舊需求` → `同步受影響文件 / UI / API / ERD`

請保留 `0818_廠商回復.md` 作為歷史需求來源；新的正式調整應建立新的 Project Decision，並以 `Supersedes` 指向被覆蓋內容。若核准決策與 ERD 或 Angular 不一致，先在 register 標記 `ERD Update Required` 或 `Frontend Update Required`，再另開變更任務。
