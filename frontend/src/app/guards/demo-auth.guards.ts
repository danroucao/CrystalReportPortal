import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MockManagementPermission } from '../mock/mock-permissions';
import { AuthService } from '../services/auth.service';

function CheckAccess(Allowed: (Auth: AuthService) => boolean) {
  const Auth = inject(AuthService);
  const RouterService = inject(Router);

  if (!Auth.IsAuthenticated) {
    return RouterService.createUrlTree(['/login'], {
      queryParams: { state: 'session-expired' },
    });
  }

  return Allowed(Auth)
    ? true
    : RouterService.createUrlTree([Auth.HomeRoute], {
        queryParams: { state: 'permission-denied' },
      });
}

export const FrontOfficeGuard: CanActivateFn = () =>
  CheckAccess((Auth) => Auth.IsFrontOffice);

export const BackOfficeGuard: CanActivateFn = () =>
  CheckAccess((Auth) => Auth.IsBackOffice && Auth.CanOperateBackOffice);

export const FrontOfficePermissionGuard: CanActivateFn = (Route) =>
  CheckAccess((Auth) =>
    Auth.HasManagementPermission(
      Route.data['Permission'] as MockManagementPermission,
    ),
  );

export const ReportPreviewGuard: CanActivateFn = () => {
  const Auth = inject(AuthService);
  const RouterService = inject(Router);

  if (Auth.IsFrontOffice && !Auth.SelectedReport) {
    return RouterService.createUrlTree(['/reports/parameters'], {
      queryParams: { state: 'report-unavailable' },
    });
  }

  return CheckAccess(
    (CurrentAuth) =>
      CurrentAuth.IsFrontOffice && CurrentAuth.SelectedReport !== null,
  );
};
