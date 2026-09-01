import { Injectable } from '@angular/core';

import { MockManagementPermission, MockReportPermission, MockRole, MockRoleKey } from '../mock/mock-permissions';
import { MockReport, MockReportKey } from '../mock/mock-reports';
import { MockUser } from '../mock/mock-users';
import { MockRbacService } from './mock-rbac.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private CurrentMockUser: MockUser | null = null;
  private ActiveRolesOverride: readonly MockRoleKey[] | null = null;

  constructor(private readonly MockRbac: MockRbacService) {}

  get IsDemoAuthenticationEnabled(): boolean {
    return this.MockRbac.IsEnabled;
  }

  get DemoUsers(): readonly MockUser[] {
    return this.MockRbac.Users;
  }

  get CurrentUser(): MockUser | null {
    return this.CurrentMockUser;
  }

  get IsAuthenticated(): boolean {
    return this.CurrentMockUser !== null;
  }

  get IsAdmin(): boolean {
    return this.CurrentMockUser?.Roles.includes('ADMIN') ?? false;
  }

  get CanSwitchDemoRole(): boolean { return this.IsAdmin; }
  get ActiveRoles(): readonly MockRoleKey[] { return this.ActiveRolesOverride ?? this.CurrentMockUser?.Roles ?? []; }
  get ActiveRoleNames(): string { return this.ActiveRoles.map((Role) => this.MockRbac.GetRole(Role)?.DisplayName ?? Role).join('、'); }
  get DemoRoles(): readonly MockRole[] { return this.MockRbac.Roles; }
  get AccessibleReports(): readonly MockReport[] { return this.MockRbac.GetAccessibleReports(this.ActiveRoles); }
  get SelectedReport(): MockReport | null { return this.MockRbac.GetSelectedReport(this.ActiveRoles); }

  Login(Account: string, Password: string): boolean {
    const AuthenticatedUser = this.MockRbac.Authenticate(Account, Password);
    this.CurrentMockUser = AuthenticatedUser;
    this.ActiveRolesOverride = null;
    return AuthenticatedUser !== null;
  }

  Logout(): void {
    this.CurrentMockUser = null;
    this.ActiveRolesOverride = null;
  }

  RefreshCurrentUser(PreviousAccount: string, CurrentAccount: string): void {
    if (this.CurrentMockUser?.Account !== PreviousAccount) return;
    this.CurrentMockUser = this.MockRbac.GetUser(CurrentAccount);
    if (!this.IsAdmin) this.ActiveRolesOverride = null;
  }

  SwitchDemoRole(Role: MockRoleKey): void { if (this.CanSwitchDemoRole) this.ActiveRolesOverride = [Role]; }
  SelectReport(ReportKey: MockReportKey): void { this.MockRbac.SelectReport(ReportKey); }

  get ReportPermission(): MockReportPermission {
    return this.SelectedReport ? this.MockRbac.GetEffectiveReportPermission(this.ActiveRoles, this.SelectedReport.ReportKey) : { CanExecute: false, CanExportPdf: false, CanPrint: false };
  }

  HasManagementPermission(Permission: MockManagementPermission): boolean {
    return this.IsAdmin && this.MockRbac.HasManagementPermission('ADMIN', Permission);
  }
}
