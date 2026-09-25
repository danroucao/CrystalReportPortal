export interface ManagedReport {
  readonly reportId: number;
  readonly reportCode: string;
  readonly reportName: string;
  readonly description: string | null;
  readonly categoryId: number;
  readonly categoryName: string;
  readonly dataSourceId: number | null;
  readonly dataSourceName: string;
  readonly credentialType: string;
  readonly isEnabled: boolean;
  readonly configurationStatus: 'Draft' | 'PendingConfiguration' | 'PendingReview' | 'Ready' | string;
  readonly rptFileName: string;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

export interface ManagedReportCategoryOption {
  readonly categoryId: number;
  readonly categoryName: string;
}

export interface ManagedReportDataSourceOption {
  readonly dataSourceId: number;
  readonly dataSourceName: string;
}

export interface ManagedRole {
  readonly roleId: number;
  readonly roleCode: string;
  readonly roleName: string;
  readonly isEnabled: boolean;
}

export interface RoleReportPermission {
  readonly roleId: number;
  readonly roleCode: string;
  readonly roleName: string;
  readonly reportId: number;
  readonly reportCode: string;
  readonly reportName: string;
  canExecute: boolean;
  canExport: boolean;
  canPrint: boolean;
  canUpload: boolean;
  canMaintain: boolean;
  canSetParameters: boolean;
  canEnableDisable: boolean;
}

export interface ReportColumnHeaderMapping {
  sourceText: string;
  displayName: string;
}

export interface ManagedReportCategory {
  readonly categoryId: number;
  readonly categoryName: string;
  readonly reportCount: number;
}

export interface SaveManagedReportCategoryRequest {
  categoryName: string;
}

export interface RoleCategoryPermission {
  readonly roleId: number;
  readonly roleCode: string;
  readonly roleName: string;
  readonly categoryId: number;
  readonly categoryName: string;
  canExecute: boolean;
  canExport: boolean;
  canPrint: boolean;
}

export interface CreateManagedReportRequest {
  reportCode: string;
  reportName: string;
  description: string | null;
  categoryId: number;
  dataSourceId: number | null;
  credentialType: 'ReadOnly';
}

export interface RptUploadResult {
  readonly success: boolean;
  readonly message: string;
  readonly data: {
    readonly reportId: number;
    readonly fileName: string;
    readonly parameterCount: number;
    readonly parameters: readonly {
      readonly name: string;
      readonly displayName: string;
      readonly dataType: string;
      readonly inputType: string;
      readonly valueSource: string;
      readonly multiple: boolean;
    }[];
  };
}

export interface UpdateReportStatusResult {
  readonly success: boolean;
  readonly reportId: number;
  readonly reportName: string;
  readonly isEnabled: boolean;
  readonly message: string;
}

export interface ManagedReportParameter {
  readonly parameterId: number;
  readonly parameterName: string;
  readonly displayName: string;
  readonly dataType: string;
  readonly inputType: string;
  readonly valueSourceType: string;
  readonly isRequired: boolean;
  readonly allowMultipleValues: boolean;
  readonly allowRangeValues: boolean;
  readonly isVisible: boolean;
  readonly defaultValue: string | null;
  readonly displayOrder: number;
  readonly isConfigured: boolean;
  readonly description: string | null;
  readonly commonTemplateId: number | null;
  readonly commonTemplateName: string | null;
  readonly dataSourceId: number | null;
  readonly sqlQuery: string | null;
  readonly valueField: string | null;
  readonly displayField: string | null;
}

export interface ManagedReportParametersResponse {
  readonly reportId: number;
  readonly reportCode: string;
  readonly reportName: string;
  readonly configurationStatus: string;
  readonly isEnabled: boolean;
  readonly allParametersConfigured: boolean;
  readonly parameters: readonly ManagedReportParameter[];
}

export interface UpdateManagedReportParameterRequest {
  readonly displayName: string;
  readonly dataType: string;
  readonly inputType: string;
  readonly valueSourceType: string;
  readonly isRequired: boolean;
  readonly allowMultipleValues: boolean;
  readonly allowRangeValues: boolean;
  readonly isVisible: boolean;
  readonly defaultValue: string | null;
  readonly description: string | null;
  readonly dataSourceId: number | null;
  readonly sqlQuery: string | null;
  readonly valueField: string | null;
  readonly displayField: string | null;
  readonly addToCommonTemplates: boolean;
}

export interface CompleteManagedReportParametersResult {
  readonly success: boolean;
  readonly reportId: number;
  readonly configurationStatus: 'PendingReview' | string;
  readonly isEnabled: boolean;
  readonly message: string;
}

export interface ManagedReportParameterOption {
  readonly value: string;
  readonly label: string;
}

export interface ManagedReportParameterOptionsResponse {
  readonly success: boolean;
  readonly data: readonly ManagedReportParameterOption[];
}

export interface ReportTestPreviewRequest {
  readonly parameters: readonly {
    readonly parameterId: number;
    readonly values: readonly string[];
  }[];
}

export interface ApproveReportConfigurationResult {
  readonly success: boolean;
  readonly reportId: number;
  readonly configurationStatus: 'Ready';
  readonly isEnabled: false;
  readonly message: string;
}
