import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';

const TOKEN_STORAGE_KEY = 'crystal-report-token';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(API_BASE_URL)) return next(request);

  const Auth = inject(AuthService);
  const IsBackOfficeRequest = request.url.includes('/backoffice');
  const IsUnsafeBackOfficeRequest = IsBackOfficeRequest &&
    !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(request.method);
  const Token = sessionStorage.getItem(TOKEN_STORAGE_KEY);

  const AuthorizedRequest = request.clone({
    withCredentials: IsBackOfficeRequest,
    setHeaders: {
      ...(Token ? { Authorization: `Bearer ${Token}` } : {}),
      ...(IsUnsafeBackOfficeRequest && Auth.BackOfficeAntiForgeryToken
        ? { 'X-CSRF-TOKEN': Auth.BackOfficeAntiForgeryToken }
        : {}),
    },
  });

  return next(AuthorizedRequest).pipe(
    catchError((Error: unknown) => {
      const IsLoginRequest =
        request.url.endsWith('/auth/login') ||
        request.url.endsWith('/backoffice-auth/login') ||
        request.url.endsWith('/backoffice-auth/verify-operator');

      if (
        Error instanceof HttpErrorResponse &&
        Error.status === 401 &&
        !IsLoginRequest
      ) {
        Auth.ClearSession();
      }

      return throwError(() => Error);
    }),
  );
};
