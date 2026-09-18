import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { DataSourceManagementModel, SaveDataSourceRequest } from './data-source-api.models';

@Injectable({ providedIn: 'root' })
export class DataSourceService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${API_BASE_URL}/data-sources`;

  getDataSources(): Observable<readonly DataSourceManagementModel[]> {
    return this.http.get<readonly DataSourceManagementModel[]>(this.endpoint);
  }

  createDataSource(request: SaveDataSourceRequest): Observable<DataSourceManagementModel> {
    return this.http.post<DataSourceManagementModel>(this.endpoint, request);
  }

  updateDataSource(id: number, request: SaveDataSourceRequest): Observable<DataSourceManagementModel> {
    return this.http.put<DataSourceManagementModel>(`${this.endpoint}/${id}`, request);
  }

  updateReadOnlyCredential(id: number, username: string, password: string, authenticationType = 'SqlServer') {
    return this.http.put(`${this.endpoint}/${id}/credentials/read-only`, {
      username, password: password || undefined, authenticationType,
    });
  }

  testConnection(id: number) {
    return this.http.post(`${this.endpoint}/${id}/test`, {});
  }
}
