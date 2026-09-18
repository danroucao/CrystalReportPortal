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
  }): Observable<AuditLogApiResponse> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize);
    if (query.fromUtc) params = params.set('fromUtc', query.fromUtc);
    if (query.toUtc) params = params.set('toUtc', query.toUtc);
    return this.http.get<AuditLogApiResponse>(this.endpoint, { params });
  }
}
