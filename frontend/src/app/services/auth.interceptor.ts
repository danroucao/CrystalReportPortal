import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';

import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(API_BASE_URL)) return next(request);

  const Auth = inject(AuthService);
  if (Auth.RequiresBackOfficeIdentityBinding) {
    return throwError(() => new Error('後台操作尚未完成前台身分綁定。'));
  }

  const token = sessionStorage.getItem('crystal-report-token');
  return next(token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request);
};
