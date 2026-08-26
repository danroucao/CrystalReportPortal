export interface MockReport {
  readonly ReportName: string;
  readonly Category: string;
  readonly Description: string;
}

export const MockReports: readonly MockReport[] = [
  {
    ReportName: '應收帳款報表',
    Category: '財務',
    Description: '檢視客戶應收帳款與到期資訊。',
  },
  {
    ReportName: '庫存明細',
    Category: '倉儲',
    Description: '檢視品項庫存、倉別與可用數量。',
  },
  {
    ReportName: '採購進度報表',
    Category: '採購',
    Description: '檢視採購單與交期進度。',
  },
];
