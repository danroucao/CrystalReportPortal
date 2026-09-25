import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './api.config';
import { AuditLogApiResponse } from './audit-log-api.models';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${API_BASE_URL}/audit-logs`;

  getLogs(query: {
    page: number;
    pageSize: number;
    fromUtc?: string;
    toUtc?: string;
    search?: string;
    source?: 'BackOffice' | 'FrontOffice';
    category?: 'AccountManagement' | 'PermissionChange' | 'DataSourceManagement' | 'ReportAction';
  }): Observable<AuditLogApiResponse> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize);
    if (query.fromUtc) params = params.set('fromUtc', query.fromUtc);
    if (query.toUtc) params = params.set('toUtc', query.toUtc);
    if (query.search) params = params.set('search', query.search);
    if (query.source) params = params.set('source', query.source);
    if (query.category) params = params.set('category', query.category);
    return this.http.get<AuditLogApiResponse>(this.endpoint, { params });
  }
}
