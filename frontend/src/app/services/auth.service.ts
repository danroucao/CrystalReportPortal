import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, tap, throwError } from 'rxjs';

import {
  EmptyMockCategoryPermission,
  MockCategoryPermission,
  MockManagementPermission,
  MockRoleKey,
} from '../mock/mock-permissions';
import { MockReportKey, MockReportReadModel } from '../mock/mock-reports';
import { MockUser } from '../mock/mock-users';
import { API_BASE_URL } from './api.config';
import {
  AuthenticatedUser,
  BackOfficeLoginResponse,
  BackOfficeOperatorResponse,
  LoginRequest,
  LoginResponse,
  ChangePasswordRequest,
  UpdateProfileRequest,
} from './auth-api.models';
import { AuthIdentity } from './auth-identity';
import {
  MockRbacService,
  MockReportSearchCriteria,
} from './mock-rbac.service';

const TOKEN_STORAGE_KEY = 'crystal-report-token';
const USER_STORAGE_KEY = 'crystal-report-user';
const EXPIRES_AT_STORAGE_KEY = 'crystal-report-token-expires-at';

const MANAGEMENT_PERMISSION_MAP: Readonly<
  Record<MockManagementPermission, readonly string[]>
> = {
  RptManagement: [
    'Report.Upload',
    'Report.Maintain',
    'Report.SetParameters',
    'Report.EnableDisable',
  ],
  DatabaseConnection: ['DataSource.Manage'],
  OperationLog: ['AuditLog.View'],
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private Identity: AuthIdentity | null = null;
  private AuthenticatedUser: AuthenticatedUser | null = null;
  private ApiReports: MockReportReadModel[] | null = null;
  private SelectedApiReportKey: MockReportKey | null = null;
  private SelectedApiReportSearchCriteria: MockReportSearchCriteria | null = null;
  private BoundBackOfficeUserAccount: string | null = null;
  private BoundBackOfficeOperator: BackOfficeOperatorResponse['operator'] | null = null;
  private BackOfficeIdentityBindingFailure:
    | 'invalid-credentials'
    | 'disabled'
    | null = null;

  constructor(
    private readonly Http: HttpClient,
    private readonly MockRbac: MockRbacService,
  ) {
    this.RestoreSession();
  }

  get IsDemoAuthenticationEnabled(): boolean {
    return true;
  }

  get CurrentIdentity(): AuthIdentity | null {
    return this.Identity;
  }

  get CurrentUser(): MockUser | null {
    const User = this.AuthenticatedUser;
    if (!User || this.Identity?.Kind !== 'FrontUser') return null;

    return {
      Account: User.account,
      DisplayName: User.userName,
      Roles: [...User.roles],
      Enabled: true,
      CreatedAt: '',
      UpdatedAt: '',
    };
  }

  get IsAuthenticated(): boolean {
    return this.Identity !== null;
  }

  get IsFrontOffice(): boolean {
    return this.Identity?.Kind === 'FrontUser' && this.AuthenticatedUser !== null;
  }

  get IsBackOffice(): boolean {
    return this.Identity?.Kind === 'BackOffice';
  }

  get IsBackOfficeIdentityBound(): boolean {
    return this.IsBackOffice && this.BoundBackOfficeUser !== null;
  }

  get RequiresBackOfficeIdentityBinding(): boolean {
    return this.IsBackOffice && !this.IsBackOfficeIdentityBound;
  }

  get BoundBackOfficeUser(): MockUser | null {
    if (!this.IsBackOffice || !this.BoundBackOfficeOperator) return null;
    const Operator = this.BoundBackOfficeOperator;
    return {
      Account: Operator.account,
      DisplayName: Operator.userName,
      Roles: [],
      Enabled: true,
      CreatedAt: '',
      UpdatedAt: '',
    };
  }

  get BoundBackOfficeUserId(): string | null {
    return this.BoundBackOfficeUser?.Account ?? null;
  }

  get LastBackOfficeIdentityBindingFailure():
    | 'invalid-credentials'
    | 'disabled'
    | null {
    return this.BackOfficeIdentityBindingFailure;
  }

  get CanOperateBackOffice(): boolean {
    return this.IsBackOfficeIdentityBound;
  }

  get DisplayName(): string {
    return this.Identity?.Kind === 'BackOffice'
      ? this.Identity.DisplayName
      : this.AuthenticatedUser?.userName ?? '';
  }

  get HomeRoute(): string {
    return this.IsBackOffice ? '/admin/users' : '/reports/parameters';
  }

  get ActiveRoles(): readonly MockRoleKey[] {
    return this.AuthenticatedUser?.roles ?? [];
  }

  get ActiveRoleNames(): string {
    return this.ActiveRoles.map(
      (Role) => this.MockRbac.GetRole(Role)?.DisplayName ?? Role,
    ).join('、');
  }

  get AccessibleReports(): readonly MockReportReadModel[] {
    if (this.ApiReports !== null) return this.ApiReports;
    return this.IsFrontOffice
      ? this.MockRbac.GetAccessibleReports(this.ActiveRoles)
      : [];
  }

  get SelectedReport(): MockReportReadModel | null {
    if (this.ApiReports !== null) {
      return this.ApiReports.find(
        (Report) => Report.ReportKey === this.SelectedApiReportKey,
      ) ?? null;
    }
    return this.IsFrontOffice
      ? this.MockRbac.GetSelectedReport(this.ActiveRoles)
      : null;
  }

  get SelectedReportSearchCriteria(): MockReportSearchCriteria | null {
    if (this.ApiReports !== null) {
      return this.SelectedApiReportSearchCriteria
        ? { ...this.SelectedApiReportSearchCriteria }
        : null;
    }
    return this.SelectedReport
      ? this.MockRbac.GetSelectedReportSearchCriteria()
      : null;
  }

  Login(Account: string, Password: string): Observable<LoginResponse> {
    this.ClearSession();

    const Request: LoginRequest = {
      account: Account.trim(),
      password: Password,
    };

    return this.Http.post<LoginResponse>(
      `${API_BASE_URL}/auth/login`,
      Request,
    ).pipe(
      tap((Response) => {
        if (
          !Response.success ||
          !Response.token ||
          !Response.user ||
          !Response.expiresAt
        ) {
          throw new Error(Response.message || '登入回應格式不完整');
        }

        this.SaveSession(
          Response.token,
          Response.expiresAt,
          Response.user,
        );
      }),
    );
  }

  ChangePassword(request: ChangePasswordRequest): Observable<LoginResponse> {
    return this.Http.post<LoginResponse>(
      `${API_BASE_URL}/auth/change-password`,
      request,
    );
  }

  UpdateProfile(request: UpdateProfileRequest): Observable<{ success: boolean; message: string }> {
    return this.Http.put<{ success: boolean; message: string }>(
      `${API_BASE_URL}/auth/me`,
      request,
    );
  }

  LoginUnified(
    Account: string,
    Password: string,
  ): Observable<LoginResponse | BackOfficeLoginResponse> {
    return this.Login(Account, Password).pipe(
      catchError((Error: unknown) => {
        if (!(Error instanceof HttpErrorResponse) || Error.status !== 401) {
          return throwError(() => Error);
        }
        return this.LoginBackOffice(Account, Password);
      }),
    );
  }

  BindBackOfficeIdentity(Account: string, Password: string): boolean {
    void Account;
    void Password;
    return false;
  }

  LoginBackOffice(
    Account: string,
    Password: string,
  ): Observable<BackOfficeLoginResponse> {
    this.ClearSession();
    return this.Http.post<BackOfficeLoginResponse>(
      `${API_BASE_URL}/backoffice-auth/login`,
      { account: Account.trim(), password: Password },
    ).pipe(
      tap((Response) => {
        if (!Response.success) {
          throw new Error(Response.message || '後台共用帳密驗證失敗');
        }
        this.Identity = {
          Kind: 'BackOffice',
          Account: Account.trim(),
          DisplayName: '後台共用帳號',
        };
      }),
    );
  }

  VerifyBackOfficeOperator(
    Account: string,
    Password: string,
  ): Observable<BackOfficeOperatorResponse> {
    return this.Http.post<BackOfficeOperatorResponse>(
      `${API_BASE_URL}/backoffice-auth/verify-operator`,
      { account: Account.trim(), password: Password },
    ).pipe(
      tap((Response) => {
        if (!Response.success || !Response.operator) {
          throw new Error(Response.message || '操作者驗證失敗');
        }
        this.BoundBackOfficeUserAccount = Response.operator.account;
        this.BoundBackOfficeOperator = Response.operator;
        this.BackOfficeIdentityBindingFailure = null;
      }),
    );
  }

  Logout(): void {
    if (this.IsBackOffice) {
      this.Http.post(`${API_BASE_URL}/backoffice-auth/logout`, {}).subscribe({
        error: () => {
          // Local state is cleared even when the server is unavailable.
        },
      });
      this.ClearSession();
      return;
    }
    const HasToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) !== null;

    if (HasToken) {
      this.Http.post(`${API_BASE_URL}/auth/logout`, {}).subscribe({
        error: () => {
          // Local session is cleared even when the server is unavailable.
        },
      });
    }

    this.ClearSession();
  }

  ClearSession(): void {
    this.Identity = null;
    this.AuthenticatedUser = null;
    this.ApiReports = null;
    this.SelectedApiReportKey = null;
    this.SelectedApiReportSearchCriteria = null;
    this.BoundBackOfficeUserAccount = null;
    this.BoundBackOfficeOperator = null;
    this.BackOfficeIdentityBindingFailure = null;
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.removeItem(EXPIRES_AT_STORAGE_KEY);
    this.MockRbac.ClearSelectedReport();
  }

  CanExecuteReport(ReportKey: MockReportKey): boolean {
    return this.AccessibleReports.some(
      (Report) => Report.ReportKey === ReportKey,
    );
  }

  SelectReport(
    ReportKey: MockReportKey,
    SearchCriteria: MockReportSearchCriteria | null = null,
  ): void {
    if (this.ApiReports !== null) {
      this.SelectedApiReportKey = this.CanExecuteReport(ReportKey)
        ? ReportKey
        : null;
      this.SelectedApiReportSearchCriteria = this.SelectedApiReportKey && SearchCriteria
        ? { ...SearchCriteria }
        : null;
      return;
    }
    this.MockRbac.ClearSelectedReport();
    if (this.CanExecuteReport(ReportKey)) {
      this.MockRbac.SelectReport(ReportKey, SearchCriteria);
    }
  }

  get SelectedReportCategoryPermission(): MockCategoryPermission {
    const Report = this.SelectedReport;
    if (Report?.Permissions) {
      return {
        CanExecute: Report.Permissions.CanExecute,
        CanExport: Report.Permissions.CanExport,
        CanPrint: Report.Permissions.CanPrint,
      };
    }
    return Report
      ? this.MockRbac.GetEffectiveCategoryPermission(
          this.ActiveRoles,
          Report.CategoryId,
        )
      : EmptyMockCategoryPermission();
  }

  HasManagementPermission(Permission: MockManagementPermission): boolean {
    if (!this.IsFrontOffice || !this.AuthenticatedUser) return false;

    const RequiredCodes = MANAGEMENT_PERMISSION_MAP[Permission];
    return RequiredCodes.some((Code) =>
      this.AuthenticatedUser!.permissions.includes(Code),
    );
  }

  SetAccessibleReports(Reports: readonly MockReportReadModel[]): void {
    this.ApiReports = [...Reports];
    if (
      this.SelectedApiReportKey &&
      !this.ApiReports.some(
        (Report) => Report.ReportKey === this.SelectedApiReportKey,
      )
    ) {
      this.SelectedApiReportKey = null;
      this.SelectedApiReportSearchCriteria = null;
    }
  }

  private SaveSession(
    Token: string,
    ExpiresAt: string,
    User: AuthenticatedUser,
  ): void {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, Token);
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(User));
    sessionStorage.setItem(EXPIRES_AT_STORAGE_KEY, ExpiresAt);
    this.AuthenticatedUser = User;
    this.Identity = { Kind: 'FrontUser', Account: User.account };
  }

  private RestoreSession(): void {
    const Token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const UserJson = sessionStorage.getItem(USER_STORAGE_KEY);
    const ExpiresAt = sessionStorage.getItem(EXPIRES_AT_STORAGE_KEY);

    if (!Token || !UserJson || !ExpiresAt) {
      this.ClearSession();
      return;
    }

    const Expiration = Date.parse(ExpiresAt);
    if (!Number.isFinite(Expiration) || Expiration <= Date.now()) {
      this.ClearSession();
      return;
    }

    try {
      const User = JSON.parse(UserJson) as AuthenticatedUser;
      if (!User.account || !Array.isArray(User.roles) || !Array.isArray(User.permissions)) {
        this.ClearSession();
        return;
      }

      this.AuthenticatedUser = User;
      this.Identity = { Kind: 'FrontUser', Account: User.account };
    } catch {
      this.ClearSession();
    }
  }
}
