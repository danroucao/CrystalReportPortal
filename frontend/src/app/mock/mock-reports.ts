export interface MockReport {
  readonly ReportKey: MockReportKey;
  readonly ReportName: string;
  readonly Category: string;
  readonly Description: string;
  readonly FileName: string;
  readonly Enabled: boolean;
  readonly CreatedAt: string;
  readonly UpdatedAt: string;
}

export type MockReportKey =
  | 'AccountBalance'
  | 'MonthlyRevenue'
  | 'Activity'
  | 'InventoryTransferHana'
  | 'DocumentsV2WithSerialAndBatchDetails'
  | 'ProductionOrder'
  | 'ServiceContract'
  | 'ActivityAttendance'
  | 'CampaignPerformance'
  | 'InventoryAging'
  | 'ProductionYield'
  | 'ServiceTicketSummary'
  | 'DocumentArchive'
  | `UploadedReport${number}`;

// Metadata only: no RPT file is read, copied, or bundled into the Angular application.
export const MockReports: readonly MockReport[] = [
  {
    ReportKey: 'AccountBalance',
    ReportName: 'AccountBalance',
    Category: '財務',
    Description: '模擬帳戶餘額與期間結餘資訊的 ReportList Metadata。',
    FileName: 'AccountBalance.rpt',
    Enabled: true,
    CreatedAt: '2026/08/01 09:00',
    UpdatedAt: '2026/08/01 09:00',
  },
  {
    ReportKey: 'MonthlyRevenue',
    ReportName: 'MonthlyRevenue',
    Category: '財務',
    Description: '新增至財務分類的月營收報表，用於驗證分類權限自動套用。',
    FileName: 'MonthlyRevenue.rpt',
    Enabled: true,
    CreatedAt: '2026/08/02 09:00',
    UpdatedAt: '2026/08/02 09:00',
  },
  {
    ReportKey: 'Activity',
    ReportName: 'Activity',
    Category: '活動',
    Description: '模擬活動紀錄查詢用的報表 Metadata。',
    FileName: 'Activity.rpt',
    Enabled: true,
    CreatedAt: '2026/08/03 09:00',
    UpdatedAt: '2026/08/03 09:00',
  },
  {
    ReportKey: 'InventoryTransferHana',
    ReportName: 'InventoryTransfer_HANA',
    Category: '庫存',
    Description: '模擬 SAP HANA 庫存調撥資料的報表 Metadata。',
    FileName: 'InventoryTransfer_HANA.rpt',
    Enabled: true,
    CreatedAt: '2026/08/04 09:00',
    UpdatedAt: '2026/08/04 09:00',
  },
  {
    ReportKey: 'DocumentsV2WithSerialAndBatchDetails',
    ReportName: 'Documents v2 (With Serial And Batch Details - invoice show data from delivery as well)',
    Category: '文件與發票',
    Description: '長名稱測試資料：模擬文件、序號、批號與由交貨單帶入發票資料的報表 Metadata。',
    FileName: 'Documents v2 (With Serial And Batch Details - invoice show data from delivery as well).rpt',
    Enabled: false,
    CreatedAt: '2026/08/05 09:00',
    UpdatedAt: '2026/08/05 09:00',
  },
  {
    ReportKey: 'ProductionOrder',
    ReportName: 'ProductionOrder',
    Category: '生產',
    Description: '模擬生產訂單與製程進度的報表 Metadata。',
    FileName: 'ProductionOrder.rpt',
    Enabled: true,
    CreatedAt: '2026/08/06 09:00',
    UpdatedAt: '2026/08/06 09:00',
  },
  {
    ReportKey: 'ServiceContract',
    ReportName: 'ServiceContract',
    Category: '服務',
    Description: '模擬服務合約、到期日與客戶服務狀態的報表 Metadata。',
    FileName: 'ServiceContract.rpt',
    Enabled: true,
    CreatedAt: '2026/08/07 09:00',
    UpdatedAt: '2026/08/07 09:00',
  },
  {
    ReportKey: 'ActivityAttendance',
    ReportName: 'ActivityAttendance',
    Category: '活動',
    Description: '模擬活動參與紀錄與出席統計的報表 Metadata。',
    FileName: 'ActivityAttendance.rpt',
    Enabled: true,
    CreatedAt: '2026/08/08 09:00',
    UpdatedAt: '2026/08/08 09:00',
  },
  {
    ReportKey: 'CampaignPerformance',
    ReportName: 'CampaignPerformance',
    Category: '活動',
    Description: '模擬行銷活動成效、回應率與來源分布的報表 Metadata。',
    FileName: 'CampaignPerformance.rpt',
    Enabled: true,
    CreatedAt: '2026/08/09 09:00',
    UpdatedAt: '2026/08/09 09:00',
  },
  {
    ReportKey: 'InventoryAging',
    ReportName: 'InventoryAging',
    Category: '庫存',
    Description: '模擬庫齡、庫存周轉與待處理品項的報表 Metadata。',
    FileName: 'InventoryAging.rpt',
    Enabled: true,
    CreatedAt: '2026/08/10 09:00',
    UpdatedAt: '2026/08/10 09:00',
  },
  {
    ReportKey: 'ProductionYield',
    ReportName: 'ProductionYield',
    Category: '生產',
    Description: '模擬生產良率、工序耗時與異常批次的報表 Metadata。',
    FileName: 'ProductionYield.rpt',
    Enabled: true,
    CreatedAt: '2026/08/11 09:00',
    UpdatedAt: '2026/08/11 09:00',
  },
  {
    ReportKey: 'ServiceTicketSummary',
    ReportName: 'ServiceTicketSummary',
    Category: '服務',
    Description: '模擬服務案件處理時效與客戶滿意度的報表 Metadata。',
    FileName: 'ServiceTicketSummary.rpt',
    Enabled: true,
    CreatedAt: '2026/08/12 09:00',
    UpdatedAt: '2026/08/12 09:00',
  },
  {
    ReportKey: 'DocumentArchive',
    ReportName: 'DocumentArchive',
    Category: '文件與發票',
    Description: '模擬文件歸檔、發票狀態與附件完整性的報表 Metadata。',
    FileName: 'DocumentArchive.rpt',
    Enabled: true,
    CreatedAt: '2026/08/13 09:00',
    UpdatedAt: '2026/08/13 09:00',
  },
];
