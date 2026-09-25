export interface AuditLogApiItem {
  auditLogId: number;
  userId: number | null;
  userAccount: string | null;
  userName: string | null;
  reportId: number | null;
  reportCode: string | null;
  reportName: string | null;
  executionId: string | null;
  action: string;
  result: string;
  details: string | null;
  errorMessage: string | null;
  ipAddress: string | null;
  source: 'BackOffice' | 'FrontOffice';
  category: 'AccountManagement' | 'PermissionChange' | 'DataSourceManagement' | 'ReportAction';
  createdAt: string;
}

export interface AuditLogApiResponse {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  items: readonly AuditLogApiItem[];
}
