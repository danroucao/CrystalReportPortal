import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from './api.config';
import {
  PortalReport,
  ReportListResponse,
} from './report-api.models';

@Injectable({ providedIn: 'root' })
export class ReportService {
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
          CreatedAt: '',
          UpdatedAt: '',
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
}
