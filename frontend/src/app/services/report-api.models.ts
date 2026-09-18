import { MockReportReadModel } from '../mock/mock-reports';

export interface ReportPermissionsResponse {
  canExecute: boolean;
  canExport: boolean;
  canPrint: boolean;
  canUpload: boolean;
  canMaintain: boolean;
  canSetParameters: boolean;
  canEnableDisable: boolean;
}

export interface ReportListItemResponse {
  reportId: number;
  reportCode: string;
  reportName: string;
  description: string;
  category: {
    categoryId: number;
    categoryName: string;
  };
  permissions: ReportPermissionsResponse;
}

export interface ReportListResponse {
  success: boolean;
  count: number;
  reports: ReportListItemResponse[];
}

export interface ReportExecutionRequest {
  parameters: readonly {
    parameterId: number;
    values: readonly string[];
  }[];
}

export type PortalReport = MockReportReadModel;
