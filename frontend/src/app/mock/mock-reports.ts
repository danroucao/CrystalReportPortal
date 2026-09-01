export interface MockReport {
  readonly ReportKey: MockReportKey;
  readonly ReportName: string;
  readonly Category: string;
  readonly Description: string;
  readonly FileName: string;
  readonly Enabled: boolean;
}

export type MockReportKey =
  | 'AccountBalance'
  | 'MonthlyRevenue'
  | 'Activity'
  | 'InventoryTransferHana'
  | 'DocumentsV2WithSerialAndBatchDetails'
  | 'ProductionOrder'
  | 'ServiceContract';

// Metadata only: no RPT file is read, copied, or bundled into the Angular application.
export const MockReports: readonly MockReport[] = [
  {
    ReportKey: 'AccountBalance',
    ReportName: 'AccountBalance',
    Category: '財務',
    Description: '模擬帳戶餘額與期間結餘資訊的 ReportList Metadata。',
    FileName: 'AccountBalance.rpt',
    Enabled: true,
  },
  {
    ReportKey: 'MonthlyRevenue',
    ReportName: 'MonthlyRevenue',
    Category: '財務',
    Description: '新增至財務分類的月營收報表，用於驗證分類權限自動套用。',
    FileName: 'MonthlyRevenue.rpt',
    Enabled: true,
  },
  {
    ReportKey: 'Activity',
    ReportName: 'Activity',
    Category: '活動',
    Description: '模擬活動紀錄查詢用的報表 Metadata。',
    FileName: 'Activity.rpt',
    Enabled: true,
  },
  {
    ReportKey: 'InventoryTransferHana',
    ReportName: 'InventoryTransfer_HANA',
    Category: '庫存',
    Description: '模擬 SAP HANA 庫存調撥資料的報表 Metadata。',
    FileName: 'InventoryTransfer_HANA.rpt',
    Enabled: true,
  },
  {
    ReportKey: 'DocumentsV2WithSerialAndBatchDetails',
    ReportName: 'Documents v2 (With Serial And Batch Details - invoice show data from delivery as well)',
    Category: '文件與發票',
    Description: '長名稱測試資料：模擬文件、序號、批號與由交貨單帶入發票資料的報表 Metadata。',
    FileName: 'Documents v2 (With Serial And Batch Details - invoice show data from delivery as well).rpt',
    Enabled: false,
  },
  {
    ReportKey: 'ProductionOrder',
    ReportName: 'ProductionOrder',
    Category: '生產',
    Description: '模擬生產訂單與製程進度的報表 Metadata。',
    FileName: 'ProductionOrder.rpt',
    Enabled: true,
  },
  {
    ReportKey: 'ServiceContract',
    ReportName: 'ServiceContract',
    Category: '服務',
    Description: '模擬服務合約、到期日與客戶服務狀態的報表 Metadata。',
    FileName: 'ServiceContract.rpt',
    Enabled: true,
  },
];
