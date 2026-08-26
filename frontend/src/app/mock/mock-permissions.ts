export type MockRole = 'MEMBER' | 'ADMIN';

export type MockManagementPermission =
  | 'UserManagement'
  | 'RoleManagement'
  | 'ReportPermission'
  | 'RptManagement'
  | 'ReportParameterSetting'
  | 'DatabaseConnection'
  | 'OperationLog';

export interface MockReportPermission {
  readonly CanView: boolean;
  readonly CanExecute: boolean;
  readonly CanExportPdf: boolean;
  readonly CanPrint: boolean;
}

export interface MockRolePermission {
  readonly ReportPermission: MockReportPermission;
  readonly ManagementPermissions: readonly MockManagementPermission[];
}

export const MockRolePermissions: Readonly<
  Record<MockRole, MockRolePermission>
> = {
  MEMBER: {
    ReportPermission: {
      CanView: true,
      CanExecute: true,
      CanExportPdf: true,
      CanPrint: true,
    },
    ManagementPermissions: [],
  },
  ADMIN: {
    ReportPermission: {
      CanView: true,
      CanExecute: true,
      CanExportPdf: true,
      CanPrint: true,
    },
    ManagementPermissions: [
      'UserManagement',
      'RoleManagement',
      'ReportPermission',
      'RptManagement',
      'ReportParameterSetting',
      'DatabaseConnection',
      'OperationLog',
    ],
  },
};
