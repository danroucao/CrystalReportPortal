import { MockReportKey } from './mock-reports';

export type MockRoleKey = string;

export type MockManagementPermission =
  | 'UserManagement'
  | 'ReportPermission'
  | 'RptManagement'
  | 'ReportParameterSetting'
  | 'DatabaseConnection'
  | 'OperationLog';

export interface MockRole {
  readonly Key: MockRoleKey;
  readonly DisplayName: string;
  readonly Description: string;
  readonly ManagementPermissions: readonly MockManagementPermission[];
}

export interface MockReportPermission {
  CanView: boolean;
  CanExecute: boolean;
  CanExportPdf: boolean;
  CanPrint: boolean;
}

export interface MockReportPermissionEntry {
  readonly ReportKey: MockReportKey;
  readonly ReportName: string;
  Permission: MockReportPermission;
}

const AllManagementPermissions: readonly MockManagementPermission[] = [
  'UserManagement', 'ReportPermission', 'RptManagement',
  'ReportParameterSetting', 'DatabaseConnection', 'OperationLog',
];

const FullPermission = (): MockReportPermission => ({ CanView: true, CanExecute: true, CanExportPdf: true, CanPrint: true });
const NoPermission = (): MockReportPermission => ({ CanView: false, CanExecute: false, CanExportPdf: false, CanPrint: false });

export const MockRoles: readonly MockRole[] = [
  { Key: 'ADMIN', DisplayName: '系統管理者', Description: '可檢視一般報表與所有現有管理 UI。', ManagementPermissions: AllManagementPermissions },
  { Key: 'FINANCE', DisplayName: '財務人員', Description: '可使用財務類已授權報表。', ManagementPermissions: [] },
  { Key: 'PURCHASING', DisplayName: '採購人員', Description: '可使用採購類已授權報表。', ManagementPermissions: [] },
  { Key: 'WAREHOUSE', DisplayName: '倉管人員', Description: '可使用倉儲類已授權報表。', ManagementPermissions: [] },
];

export const InitialMockRoleReportPermissions: Readonly<Record<string, Record<MockReportKey, MockReportPermission>>> = {
  ADMIN: {
    AccountBalance: FullPermission(), Activity: FullPermission(), InventoryTransferHana: FullPermission(),
    DocumentsV2WithSerialAndBatchDetails: FullPermission(), ProductionOrder: FullPermission(), ServiceContract: FullPermission(),
  },
  FINANCE: {
    AccountBalance: FullPermission(), Activity: FullPermission(), InventoryTransferHana: NoPermission(),
    DocumentsV2WithSerialAndBatchDetails: NoPermission(), ProductionOrder: NoPermission(), ServiceContract: NoPermission(),
  },
  PURCHASING: {
    AccountBalance: NoPermission(), Activity: NoPermission(), InventoryTransferHana: NoPermission(),
    DocumentsV2WithSerialAndBatchDetails: FullPermission(), ProductionOrder: FullPermission(), ServiceContract: NoPermission(),
  },
  WAREHOUSE: {
    AccountBalance: NoPermission(), Activity: NoPermission(), InventoryTransferHana: FullPermission(),
    DocumentsV2WithSerialAndBatchDetails: NoPermission(), ProductionOrder: NoPermission(), ServiceContract: NoPermission(),
  },
};
