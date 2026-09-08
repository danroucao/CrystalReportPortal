export interface MockReportCategory {
  readonly CategoryId: MockReportCategoryId;
  readonly CategoryName: string;
  readonly IsSystemReserved: boolean;
}

export type MockReportCategoryId = string;

export const SystemUncategorizedCategoryId = 'SYSTEM_UNCATEGORIZED';

// This is the single source of truth for report-category master data.
// Report storage and role permissions use CategoryId; CategoryName is display-only.
export const MockReportCategories: readonly MockReportCategory[] = [
  { CategoryId: 'FINANCE', CategoryName: '財務', IsSystemReserved: false },
  { CategoryId: 'ACTIVITY', CategoryName: '活動', IsSystemReserved: false },
  { CategoryId: 'INVENTORY', CategoryName: '庫存', IsSystemReserved: false },
  {
    CategoryId: 'DOCUMENT_INVOICE',
    CategoryName: '文件與發票',
    IsSystemReserved: false,
  },
  { CategoryId: 'PRODUCTION', CategoryName: '生產', IsSystemReserved: false },
  { CategoryId: 'SERVICE', CategoryName: '服務', IsSystemReserved: false },
  { CategoryId: 'MARKETING', CategoryName: '行銷', IsSystemReserved: false },
  {
    CategoryId: SystemUncategorizedCategoryId,
    CategoryName: '未分類',
    IsSystemReserved: true,
  },
];

export function GetMockReportCategory(
  CategoryId: string,
): MockReportCategory | null {
  return (
    MockReportCategories.find((Category) => Category.CategoryId === CategoryId) ??
    null
  );
}

export function IsMockReportCategoryId(CategoryId: string): boolean {
  return GetMockReportCategory(CategoryId) !== null;
}
