import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import {
  BackOfficeGuard,
  FrontOfficeGuard,
  FrontOfficePermissionGuard,
  ReportPreviewGuard,
} from './demo-auth.guards';
import { AuthService } from '../services/auth.service';

describe('Front/back-office route guards', () => {
  const authStub = {
    IsAuthenticated: false,
    IsFrontOffice: false,
    IsBackOffice: false,
    CanOperateBackOffice: false,
    HomeRoute: '/reports/parameters',
    SelectedReport: null as object | null,
    HasManagementPermission: jasmine
      .createSpy('HasManagementPermission')
      .and.returnValue(false),
  };

  let router: Router;

  const state = {} as RouterStateSnapshot;

  function route(data: Record<string, unknown> = {}): ActivatedRouteSnapshot {
    return { data } as unknown as ActivatedRouteSnapshot;
  }

  function runGuard(
    guard: typeof FrontOfficeGuard,
    currentRoute = route(),
  ): boolean | UrlTree {
    return TestBed.runInInjectionContext(
      () => guard(currentRoute, state) as boolean | UrlTree,
    );
  }

  function url(result: boolean | UrlTree): string {
    expect(result instanceof UrlTree).toBeTrue();
    return router.serializeUrl(result as UrlTree);
  }

  beforeEach(() => {
    authStub.IsAuthenticated = false;
    authStub.IsFrontOffice = false;
    authStub.IsBackOffice = false;
    authStub.CanOperateBackOffice = false;
    authStub.HomeRoute = '/reports/parameters';
    authStub.SelectedReport = null;
    authStub.HasManagementPermission.calls.reset();
    authStub.HasManagementPermission.and.returnValue(false);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authStub,
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('redirects an unauthenticated visitor to login', () => {
    const result = runGuard(FrontOfficeGuard);

    expect(url(result)).toBe('/login?state=session-expired');
  });

  it('allows an authenticated front-office user', () => {
    authStub.IsAuthenticated = true;
    authStub.IsFrontOffice = true;

    expect(runGuard(FrontOfficeGuard)).toBeTrue();
  });

  it('redirects the wrong identity to its home route', () => {
    authStub.IsAuthenticated = true;
    authStub.IsFrontOffice = false;
    authStub.HomeRoute = '/reports/parameters';

    const result = runGuard(FrontOfficeGuard);

    expect(url(result)).toBe(
      '/reports/parameters?state=permission-denied',
    );
  });

  it('allows back-office access only after operator binding', () => {
    authStub.IsAuthenticated = true;
    authStub.IsBackOffice = true;
    authStub.CanOperateBackOffice = true;

    expect(runGuard(BackOfficeGuard)).toBeTrue();
  });

it('allows an unbound back-office identity to complete operator binding', () => {
  authStub.IsAuthenticated = true;
  authStub.IsBackOffice = true;
  authStub.CanOperateBackOffice = false;

  expect(runGuard(BackOfficeGuard)).toBeTrue();
});

  it('checks the management permission declared by the route', () => {
    authStub.IsAuthenticated = true;
    authStub.IsFrontOffice = true;
    authStub.HasManagementPermission.and.returnValue(true);

    const result = runGuard(
      FrontOfficePermissionGuard,
      route({ Permission: 'RptManagement' }),
    );

    expect(result).toBeTrue();
    expect(authStub.HasManagementPermission).toHaveBeenCalledWith(
      'RptManagement',
    );
  });

  it('redirects when a management permission is missing', () => {
    authStub.IsAuthenticated = true;
    authStub.IsFrontOffice = true;
    authStub.HasManagementPermission.and.returnValue(false);

    const result = runGuard(
      FrontOfficePermissionGuard,
      route({ Permission: 'OperationLog' }),
    );

    expect(url(result)).toBe(
      '/reports/parameters?state=permission-denied',
    );
  });

  it('redirects preview when no report is selected', () => {
    authStub.IsAuthenticated = true;
    authStub.IsFrontOffice = true;
    authStub.SelectedReport = null;

    const result = runGuard(ReportPreviewGuard);

    expect(url(result)).toBe(
      '/reports/parameters?state=report-unavailable',
    );
  });

  it('allows preview for a selected front-office report', () => {
    authStub.IsAuthenticated = true;
    authStub.IsFrontOffice = true;
    authStub.SelectedReport = {};

    expect(runGuard(ReportPreviewGuard)).toBeTrue();
  });
});
