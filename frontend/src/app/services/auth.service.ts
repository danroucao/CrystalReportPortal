import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { MockCategoryPermission, MockManagementPermission, MockRole, MockRoleKey } from '../mock/mock-permissions';
import { MockReport, MockReportKey } from '../mock/mock-reports';
import { MockRbacService, MockReportSearchCriteria } from './mock-rbac.service';
import { API_BASE_URL } from './api.config';

export interface LoginRequest {
  account: string;
  password: string;
}

export interface LoginUser {
  // Backend API fields
  userId: number;
  account: string;
  employeeNo: string;
  userName: string;
  roles: string[];

  // 舊 Demo Portal 相容欄位
  Account: string;
  DisplayName: string;
  Roles: readonly MockRoleKey[];
}

export interface LoginResponse {
  success: boolean;
  message: string;
  passwordExpired: boolean;
  token?: string;
  expiresAt?: string;
  user?: LoginUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly ApiUrl = `${API_BASE_URL}/auth`;

  private CurrentLoginUser: LoginUser | null = null;
  private Token: string | null = null;

  private ActiveRolesOverride: readonly MockRoleKey[] | null = null;

  constructor(
    private readonly Http: HttpClient,
    private readonly MockRbac: MockRbacService,
  ) {
    this.RestoreSession();
  }

  get IsDemoAuthenticationEnabled(): boolean {
    return this.MockRbac.IsEnabled;
  }

  get DemoUsers() {
    return this.MockRbac.Users;
  }

  get CurrentUser(): LoginUser | null {
    return this.CurrentLoginUser;
  }

  get IsAuthenticated(): boolean {
    return (
      this.CurrentLoginUser !== null &&
      this.Token !== null
    );
  }

  get IsAdmin(): boolean {
    return (
      this.CurrentLoginUser?.roles.includes('ADMIN') ??
      false
    );
  }

  get AccessToken(): string | null {
    return this.Token;
  }

  Login(
    Account: string,
    Password: string,
  ): Observable<LoginResponse> {
    const request: LoginRequest = {
      account: Account,
      password: Password,
    };

    return this.Http
      .post<LoginResponse>(
        `${this.ApiUrl}/login`,
        request,
      )
      .pipe(
        tap((response) => {
          if (
            !response.success ||
            !response.token ||
            !response.user
          ) {
            return;
          }

          const user: LoginUser = {
            ...response.user,

            Account: response.user.account,
            DisplayName: response.user.userName,
            Roles:
              response.user.roles as MockRoleKey[],
          };

          this.Token = response.token;
          this.CurrentLoginUser = user;
          this.ActiveRolesOverride = null;

          this.MockRbac.ClearSelectedReport();

          sessionStorage.setItem(
            'crystal-report-token',
            response.token,
          );

          sessionStorage.setItem(
            'crystal-report-user',
            JSON.stringify(user),
          );
        }),
      );
  }

  Logout(): void {
    this.Token = null;
    this.CurrentLoginUser = null;
    this.ActiveRolesOverride = null;

    this.MockRbac.ClearSelectedReport();

    sessionStorage.removeItem(
      'crystal-report-token',
    );

    sessionStorage.removeItem(
      'crystal-report-user',
    );
  }

  RefreshCurrentUser(
    PreviousAccount: string,
    CurrentAccount: string,
  ): void {
    if (
      this.CurrentLoginUser?.Account !==
      PreviousAccount
    ) {
      return;
    }

    const mockUser =
      this.MockRbac.GetUser(CurrentAccount);

    if (!mockUser) {
      return;
    }

    this.CurrentLoginUser = {
      ...this.CurrentLoginUser,
      Account: mockUser.Account,
      DisplayName: mockUser.DisplayName,
      Roles: mockUser.Roles,
    };

    if (!this.IsAdmin) {
      this.ActiveRolesOverride = null;
    }

    sessionStorage.setItem(
      'crystal-report-user',
      JSON.stringify(this.CurrentLoginUser),
    );
  }

  private RestoreSession(): void {
    const token =
      sessionStorage.getItem(
        'crystal-report-token',
      );

    const userJson =
      sessionStorage.getItem(
        'crystal-report-user',
      );

    if (!token || !userJson) {
      return;
    }

    try {
      this.Token = token;
      this.CurrentLoginUser =
        JSON.parse(userJson) as LoginUser;
    } catch {
      this.Logout();
    }
  }

  // ===== 暫時保留的 Mock RBAC 相容功能 =====

  get CanSwitchDemoRole(): boolean {
    return this.IsAdmin;
  }

  get ActiveRoles(): readonly MockRoleKey[] {
    return (
      this.ActiveRolesOverride ??
      this.CurrentLoginUser?.Roles ??
      []
    );
  }

  get ActiveRoleNames(): string {
    return this.ActiveRoles
      .map(
        (role) =>
          this.MockRbac.GetRole(role)
            ?.DisplayName ?? role,
      )
      .join('、');
  }

  get DemoRoles(): readonly MockRole[] {
    return this.MockRbac.Roles;
  }

  get AccessibleReports():
    readonly MockReport[] {
    return this.MockRbac.GetAccessibleReports(
      this.ActiveRoles,
    );
  }

  get SelectedReport(): MockReport | null {
    return this.MockRbac.GetSelectedReport(
      this.ActiveRoles,
    );
  }

  get SelectedReportSearchCriteria():
    MockReportSearchCriteria | null {
    return this.MockRbac
      .GetSelectedReportSearchCriteria();
  }

  SwitchDemoRole(Role: MockRoleKey): void {
    if (this.CanSwitchDemoRole) {
      this.ActiveRolesOverride = [Role];
    }
  }

  SelectReport(
    ReportKey: MockReportKey,
    SearchCriteria:
      MockReportSearchCriteria | null = null,
  ): void {
    this.MockRbac.SelectReport(
      ReportKey,
      SearchCriteria,
    );
  }

  get SelectedReportCategoryPermission():
    MockCategoryPermission {
    return this.SelectedReport
      ? this.MockRbac
          .GetEffectiveCategoryPermission(
            this.ActiveRoles,
            this.SelectedReport.Category,
          )
      : {
          CanExecute: false,
          CanExportPdf: false,
          CanPrint: false,
        };
  }

  HasManagementPermission(
    Permission: MockManagementPermission,
  ): boolean {
    return (
      this.IsAdmin &&
      this.MockRbac.HasManagementPermission(
        'ADMIN',
        Permission,
      )
    );
  }
}