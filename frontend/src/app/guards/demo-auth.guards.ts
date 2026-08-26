import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const DemoAuthGuard: CanActivateFn = () => {
  const Auth = inject(AuthService);
  const RouterService = inject(Router);
  return Auth.IsAuthenticated
    ? true
    : RouterService.createUrlTree(['/login'], {
        queryParams: { state: 'session-expired' },
      });
};

export const DemoAdminGuard: CanActivateFn = () => {
  const Auth = inject(AuthService);
  const RouterService = inject(Router);

  if (!Auth.IsAuthenticated) {
    return RouterService.createUrlTree(['/login'], {
      queryParams: { state: 'session-expired' },
    });
  }

  return Auth.IsAdmin
    ? true
    : RouterService.createUrlTree(['/reports'], {
        queryParams: { state: 'permission-denied' },
      });
};
