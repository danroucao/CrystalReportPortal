import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './api.config';

export interface ReportPermission {
  canExecute: boolean;
  canExport: boolean;
  canPrint: boolean;
}

export interface ReportSummary {
  reportId: number;
  reportCode: string;
  reportName: string;
  description: string | null;
  category: { categoryId: number; categoryName: string };
  permissions: ReportPermission;
}

export interface ReportParameter {
  parameterId: number;
  name: string;
  displayName: string;
  dataType: string;
  inputType: string;
  required: boolean;
  multiple: boolean;
  range: boolean;
  valueSource: string;
  visible: boolean;
  displayOrder: number;
}

interface ReportListResponse {
  success: boolean;
  reports: ReportSummary[];
}

interface ReportParameterResponse {
  success: boolean;
  data: ReportParameter[];
}

interface ParameterOptionResponse {
  success: boolean;
  data: { value: string; label: string }[];
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly selectedReportStorageKey = 'crystal-report-selected-report';

  constructor(private readonly http: HttpClient) {}

  get selectedReport(): ReportSummary | null {
    const serialized = sessionStorage.getItem(this.selectedReportStorageKey);
    if (!serialized) return null;
    try {
      return JSON.parse(serialized) as ReportSummary;
    } catch {
      sessionStorage.removeItem(this.selectedReportStorageKey);
      return null;
    }
  }

  selectReport(report: ReportSummary): void {
    sessionStorage.setItem(this.selectedReportStorageKey, JSON.stringify(report));
  }

  getReports(): Observable<ReportListResponse> {
    return this.http.get<ReportListResponse>(`${API_BASE_URL}/reports`);
  }

  getParameters(reportId: number): Observable<ReportParameterResponse> {
    return this.http.get<ReportParameterResponse>(`${API_BASE_URL}/reports/${reportId}/parameters`);
  }

  getParameterOptions(reportId: number, parameterId: number): Observable<ParameterOptionResponse> {
    return this.http.get<ParameterOptionResponse>(`${API_BASE_URL}/reports/${reportId}/parameters/${parameterId}/options`);
  }
}
