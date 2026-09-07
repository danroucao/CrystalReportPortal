import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface AdminReport { reportId: number; reportCode: string; reportName: string; description?: string; isEnabled: boolean; rptFileName: string; }
export interface CategoryOption { categoryId: number; categoryName: string; }
export interface DataSourceOption { dataSourceId: number; dataSourceName: string; }
export interface CreateReportRequest { reportCode: string; reportName: string; description?: string; categoryId: number; dataSourceId: number; credentialType: string; }

@Injectable({ providedIn: 'root' })
export class AdminReportService {
  constructor(private readonly http: HttpClient) {}
  getReports(): Observable<AdminReport[]> { return this.http.get<AdminReport[]>(`${API_BASE_URL}/admin/reports`); }
  getCategories(): Observable<CategoryOption[]> { return this.http.get<CategoryOption[]>(`${API_BASE_URL}/admin/reports/categories`); }
  getDataSources(): Observable<DataSourceOption[]> { return this.http.get<DataSourceOption[]>(`${API_BASE_URL}/admin/reports/data-sources`); }
  create(request: CreateReportRequest): Observable<AdminReport> { return this.http.post<AdminReport>(`${API_BASE_URL}/admin/reports`, request); }
  uploadRtp(reportId: number, file: File): Observable<unknown> { const form = new FormData(); form.append('file', file); return this.http.post(`${API_BASE_URL}/reports/${reportId}/rpt`, form); }
}
