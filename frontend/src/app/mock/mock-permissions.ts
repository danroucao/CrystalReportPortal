import type { MockReportCategoryId } from './mock-report-categories';

export type MockRoleKey = string;

export type MockManagementPermission =
  | 'RptManagement'
  | 'DatabaseConnection'
  | 'OperationLog';

export interface MockRole {
  readonly Key: MockRoleKey;
  readonly DisplayName: string;
  readonly Description: string;
  readonly ManagementPermissions: readonly MockManagementPermission[];
}

export interface MockCategoryPermission {
  CanExecute: boolean;
  CanExport: boolean;
  CanPrint: boolean;
}

export interface MockCategoryPermissionEntry {
  readonly CategoryId: MockReportCategoryId;
  readonly CategoryName: string;
  Permission: MockCategoryPermission;
}

const FullPermission = (): MockCategoryPermission => ({ CanExecute: true, CanExport: true, CanPrint: true });
const NoPermission = (): MockCategoryPermission => ({ CanExecute: false, CanExport: false, CanPrint: false });

export const MockRoles: readonly MockRole[] = [
  { Key: 'FINANCE', DisplayName: '財務人員', Description: '可使用財務與活動分類已授權報表及所有管理功能。', ManagementPermissions: ['RptManagement', 'DatabaseConnection', 'OperationLog'] },
  { Key: 'PURCHASE', DisplayName: '採購人員', Description: '可使用採購與生產分類已授權報表。', ManagementPermissions: [] },
  { Key: 'WAREHOUSE', DisplayName: '倉管人員', Description: '可使用倉儲分類已授權報表。', ManagementPermissions: [] },
];

// Permission rows are intentionally keyed by report category, never by an individual report.
export const InitialMockRoleCategoryPermissions: Readonly<
  Record<string, Readonly<Record<MockReportCategoryId, MockCategoryPermission>>>
> = {
  FINANCE: {
    FINANCE: FullPermission(),
    ACTIVITY: FullPermission(),
  },
  PURCHASE: {
    DOCUMENT_INVOICE: FullPermission(),
    PRODUCTION: FullPermission(),
  },
  WAREHOUSE: {
    INVENTORY: FullPermission(),
  },
};

export const EmptyMockCategoryPermission = NoPermission;
export const FullMockCategoryPermission = FullPermission;
