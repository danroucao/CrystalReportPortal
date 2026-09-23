import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { MockRbacService } from './mock-rbac.service';

describe('AuthService API authentication', () => {
  let Auth: AuthService;
  let HttpTesting: HttpTestingController;

  const LoginResponse = {
    success: true,
    message: '登入成功',
    passwordExpired: false,
    token: 'jwt-token',
    expiresAt: '2099-09-17T03:00:00Z',
    user: {
      userId: 1,
      account: 'admin@example.com',
      employeeNo: 'TEST001',
      userName: '測試管理員',
      roles: ['FINANCE_MANAGER'],
      permissions: [
        'AuditLog.View',
        'DataSource.Manage',
        'Report.EnableDisable',
        'Report.Maintain',
        'Report.SetParameters',
        'Report.Upload',
      ],
    },
  };

  beforeEach(() => {
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        MockRbacService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    Auth = TestBed.inject(AuthService);
    HttpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    HttpTesting.verify();
    sessionStorage.clear();
  });

  it('logs in through the API and stores the JWT session', () => {
    let Completed = false;

    Auth.Login('admin@example.com', 'admin123').subscribe(() => {
      Completed = true;
    });

    const Request = HttpTesting.expectOne(
      'http://localhost:5181/api/auth/login',
    );
    expect(Request.request.method).toBe('POST');
    expect(Request.request.body).toEqual({
      account: 'admin@example.com',
      password: 'admin123',
    });
    Request.flush(LoginResponse);

    expect(Completed).toBeTrue();
    expect(Auth.IsAuthenticated).toBeTrue();
    expect(Auth.IsFrontOffice).toBeTrue();
    expect(Auth.DisplayName).toBe('測試管理員');
    expect(Auth.ActiveRoles).toEqual(['FINANCE_MANAGER']);
    expect(sessionStorage.getItem('crystal-report-token')).toBe('jwt-token');
  });

  it('maps backend permissions to frontend management features', () => {
    Auth.Login('admin@example.com', 'admin123').subscribe();
    HttpTesting.expectOne(
      'http://localhost:5181/api/auth/login',
    ).flush(LoginResponse);

    expect(Auth.HasManagementPermission('RptManagement')).toBeTrue();
    expect(Auth.HasManagementPermission('DatabaseConnection')).toBeTrue();
    expect(Auth.HasManagementPermission('OperationLog')).toBeTrue();
  });

  it('restores an unexpired session from session storage', () => {
    Auth.Login('admin@example.com', 'admin123').subscribe();
    HttpTesting.expectOne(
      'http://localhost:5181/api/auth/login',
    ).flush(LoginResponse);

    const Restored = TestBed.runInInjectionContext(
      () => new AuthService(
        TestBed.inject(HttpClient),
        TestBed.inject(MockRbacService),
      ),
    );

    expect(Restored.IsAuthenticated).toBeTrue();
    expect(Restored.DisplayName).toBe('測試管理員');
  });

  it('clears local authentication data during logout', () => {
    Auth.Login('admin@example.com', 'admin123').subscribe();
    HttpTesting.expectOne(
      'http://localhost:5181/api/auth/login',
    ).flush(LoginResponse);

    Auth.Logout();
    HttpTesting.expectOne(
      'http://localhost:5181/api/auth/logout',
    ).flush({ success: true });

    expect(Auth.IsAuthenticated).toBeFalse();
    expect(sessionStorage.getItem('crystal-report-token')).toBeNull();
  });

  it('keeps credentials enabled throughout the back-office session flow', () => {
    Auth.LoginBackOffice('admin', 'shared-password').subscribe();
    const SharedLogin = HttpTesting.expectOne(
      'http://localhost:5181/api/backoffice-auth/login',
    );
    expect(SharedLogin.request.withCredentials).toBeTrue();
    SharedLogin.flush({ success: true, message: 'Shared login complete.' });

    Auth.VerifyBackOfficeOperator('admin@example.com', 'operator-password')
      .subscribe();
    const OperatorVerification = HttpTesting.expectOne(
      'http://localhost:5181/api/backoffice-auth/verify-operator',
    );
    expect(OperatorVerification.request.withCredentials).toBeTrue();
    OperatorVerification.flush({
      success: true,
      message: 'Operator verified.',
      passwordExpired: false,
      operator: {
        userId: 1,
        account: 'admin@example.com',
        userName: 'Test Admin',
      },
    });

    expect(Auth.CanOperateBackOffice).toBeTrue();
  });
});
