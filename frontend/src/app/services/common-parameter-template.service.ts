import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './api.config';
import {
  CommonParameterTemplate,
  SaveCommonParameterTemplateRequest,
} from './common-parameter-template-api.models';

@Injectable({ providedIn: 'root' })
export class CommonParameterTemplateService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${API_BASE_URL}/backoffice/common-parameter-templates`;

  getTemplates(isEnabled?: boolean): Observable<readonly CommonParameterTemplate[]> {
    const params = isEnabled === undefined
      ? undefined
      : new HttpParams().set('isEnabled', isEnabled);
    return this.http.get<readonly CommonParameterTemplate[]>(this.endpoint, { params });
  }

  createTemplate(
    request: SaveCommonParameterTemplateRequest,
  ): Observable<CommonParameterTemplate> {
    return this.http.post<CommonParameterTemplate>(this.endpoint, request);
  }

  updateTemplate(
    templateId: number,
    request: SaveCommonParameterTemplateRequest,
  ): Observable<CommonParameterTemplate> {
    return this.http.put<CommonParameterTemplate>(
      `${this.endpoint}/${templateId}`,
      request,
    );
  }

  updateStatus(
    templateId: number,
    isEnabled: boolean,
  ): Observable<CommonParameterTemplate> {
    return this.http.patch<CommonParameterTemplate>(
      `${this.endpoint}/${templateId}/status`,
      { isEnabled },
    );
  }
}
