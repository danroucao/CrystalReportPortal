import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';

import { API_BASE_URL } from './api.config';
import {
  CreateManagedReportRequest,
  ManagedReport,
  ManagedReportCategoryOption,
  ManagedReportDataSourceOption,
  ManagedReportParameterOptionsResponse,
  ManagedReportParameter,
  ManagedReportParametersResponse,
  UpdateManagedReportParameterRequest,
  CompleteManagedReportParametersResult,
  ReportTestPreviewRequest,
  ApproveReportConfigurationResult,
  RptUploadResult,
  UpdateReportStatusResult,
  ManagedRole,
  RoleReportPermission,
} from './managed-report-api.models';
import {
  PortalReport,
  ReportExecutionRequest,
  ReportListResponse,
} from './report-api.models';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly managementEndpoint = `${API_BASE_URL}/backoffice/reports`;

  constructor(private readonly Http: HttpClient) {}

  GetReports(): Observable<PortalReport[]> {
    return this.Http.get<ReportListResponse>(`${API_BASE_URL}/Reports`).pipe(
      map((Response) =>
        Response.reports.map((Report) => ({
          ReportId: Report.reportId,
          ReportKey: Report.reportId.toString(),
          ReportCode: Report.reportCode,
          ReportName: Report.reportName,
          CategoryId: Report.category.categoryId.toString(),
          CategoryName: Report.category.categoryName,
          Description: Report.description ?? '',
          FileName: '',
          Enabled: true,
          CreatedAt: Report.createdAt,
          UpdatedAt: Report.updatedAt ?? Report.createdAt,
          Permissions: {
            CanExecute: Report.permissions.canExecute,
            CanExport: Report.permissions.canExport,
            CanPrint: Report.permissions.canPrint,
            CanUpload: Report.permissions.canUpload,
            CanMaintain: Report.permissions.canMaintain,
            CanSetParameters: Report.permissions.canSetParameters,
            CanEnableDisable: Report.permissions.canEnableDisable,
          },
        })),
      ),
    );
  }

  ExecuteReport(
    reportId: number,
    request: ReportExecutionRequest,
  ): Observable<Blob> {
    return this.Http.post(`${API_BASE_URL}/reports/${reportId}/execute`, request, {
      responseType: 'blob',
    });
  }

  GetReportPreview(reportId: number): Observable<Blob> {
    return this.Http.get(`${API_BASE_URL}/Reports/${reportId}/preview`, {
      responseType: 'blob',
    });
  }

  GetManagedReports(): Observable<readonly ManagedReport[]> {
    return this.Http.get<readonly ManagedReport[]>(this.managementEndpoint);
  }

  GetManagedReportCategories(): Observable<readonly ManagedReportCategoryOption[]> {
    return this.Http.get<readonly ManagedReportCategoryOption[]>(
      `${this.managementEndpoint}/categories`,
    );
  }

  GetManagedReportDataSources(): Observable<readonly ManagedReportDataSourceOption[]> {
    return this.Http.get<readonly ManagedReportDataSourceOption[]>(
      `${this.managementEndpoint}/data-sources`,
    );
  }

  CreateManagedReport(request: CreateManagedReportRequest): Observable<ManagedReport> {
    return this.Http.post<ManagedReport>(this.managementEndpoint, request);
  }

  UploadRpt(reportId: number, file: File): Observable<RptUploadResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.Http.post<RptUploadResult>(
      `${API_BASE_URL}/Reports/${reportId}/rpt`,
      formData,
    );
  }

  CreateManagedReportWithRpt(
    request: CreateManagedReportRequest,
    file: File,
  ): Observable<RptUploadResult> {
    return this.CreateManagedReport(request).pipe(
      switchMap((report) =>
        this.UploadRpt(report.reportId, file).pipe(
          catchError((uploadError: unknown) =>
            this.DeleteManagedReport(report.reportId).pipe(
              catchError(() => of(undefined)),
              switchMap(() => throwError(() => uploadError)),
            ),
          ),
        ),
      ),
    );
  }

  UpdateManagedReportStatus(
    reportId: number,
    isEnabled: boolean,
  ): Observable<UpdateReportStatusResult> {
    return this.Http.patch<UpdateReportStatusResult>(
      `${API_BASE_URL}/Reports/${reportId}/status`,
      { isEnabled },
    );
  }

  DeleteManagedReport(reportId: number): Observable<void> {
    return this.Http.delete<void>(`${this.managementEndpoint}/${reportId}`);
  }

  GetManagedReportParameters(
    reportId: number,
  ): Observable<ManagedReportParametersResponse> {
    return this.Http.get<ManagedReportParametersResponse>(
      `${this.managementEndpoint}/${reportId}/parameters`,
    );
  }

  GetManagedReportParameterOptions(
    reportId: number,
    parameterId: number,
  ): Observable<ManagedReportParameterOptionsResponse> {
    return this.Http.get<ManagedReportParameterOptionsResponse>(
      `${this.managementEndpoint}/${reportId}/parameters/${parameterId}/options`,
    );
  }

  UpdateManagedReportParameter(
    reportId: number,
    parameterId: number,
    request: UpdateManagedReportParameterRequest,
  ): Observable<ManagedReportParameter> {
    return this.Http.put<ManagedReportParameter>(
      `${this.managementEndpoint}/${reportId}/parameters/${parameterId}`,
      request,
    );
  }

  CompleteManagedReportParameters(
    reportId: number,
  ): Observable<CompleteManagedReportParametersResult> {
    return this.Http.post<CompleteManagedReportParametersResult>(
      `${this.managementEndpoint}/${reportId}/parameters/complete`,
      {},
    );
  }

  TestPreviewManagedReport(
    reportId: number,
    request: ReportTestPreviewRequest,
    useSavedDataOnly = false,
  ): Observable<Blob> {
    return this.Http.post(
      `${this.managementEndpoint}/${reportId}/test-preview`,
      request,
      {
        params: useSavedDataOnly
          ? { useSavedDataOnly: 'true' }
          : {},
        responseType: 'blob',
      },
    );
  }

  ApproveManagedReportConfiguration(
    reportId: number,
  ): Observable<ApproveReportConfigurationResult> {
    return this.Http.post<ApproveReportConfigurationResult>(
      `${this.managementEndpoint}/${reportId}/configuration/approve`,
      {},
    );
  }

  GetBackOfficeRoles(): Observable<readonly ManagedRole[]> {
    return this.Http.get<readonly ManagedRole[]>(`${API_BASE_URL}/backoffice/roles`);
  }

  GetRoleReportPermissions(roleId: number): Observable<readonly RoleReportPermission[]> {
    return this.Http.get<readonly RoleReportPermission[]>(
      `${API_BASE_URL}/backoffice/report-permissions/roles/${roleId}/reports`,
    );
  }

  UpdateRoleReportPermission(
    roleId: number,
    reportId: number,
    permission: Pick<RoleReportPermission, 'canExecute' | 'canExport' | 'canPrint'>,
  ): Observable<RoleReportPermission> {
    return this.Http.put<RoleReportPermission>(
      `${API_BASE_URL}/backoffice/report-permissions/roles/${roleId}/reports/${reportId}`,
      {
        ...permission,
        canUpload: false,
        canMaintain: false,
        canSetParameters: false,
        canEnableDisable: false,
      },
    );
  }
}
