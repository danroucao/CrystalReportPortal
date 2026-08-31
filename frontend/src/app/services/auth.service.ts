import { Injectable } from '@angular/core';

import { MockManagementPermission, MockReportPermission, MockRole, MockRoleKey } from '../mock/mock-permissions';
import { MockReport, MockReportKey } from '../mock/mock-reports';
import { MockUser } from '../mock/mock-users';
import { MockRbacService } from './mock-rbac.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private CurrentMockUser: MockUser | null = null;
  private ActiveRoleOverride: MockRoleKey | null = null;

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
    return this.ActiveRoleKey === 'ADMIN';
  }

  get CanSwitchDemoRole(): boolean { return this.CurrentMockUser?.Role === 'ADMIN'; }
  get ActiveRoleKey(): MockRoleKey | null { return this.ActiveRoleOverride ?? this.CurrentMockUser?.Role ?? null; }
  get ActiveRole(): MockRole | null { return this.ActiveRoleKey ? this.MockRbac.GetRole(this.ActiveRoleKey) : null; }
  get DemoRoles(): readonly MockRole[] { return this.MockRbac.Roles; }
  get AccessibleReports(): readonly MockReport[] { return this.ActiveRoleKey ? this.MockRbac.GetAccessibleReports(this.ActiveRoleKey) : []; }
  get SelectedReport(): MockReport | null { return this.ActiveRoleKey ? this.MockRbac.GetSelectedReport(this.ActiveRoleKey) : null; }

  Login(Account: string, Password: string): boolean {
    const AuthenticatedUser = this.MockRbac.Authenticate(Account, Password);
    this.CurrentMockUser = AuthenticatedUser;
    this.ActiveRoleOverride = null;
    return AuthenticatedUser !== null;
  }

  Logout(): void {
    this.CurrentMockUser = null;
    this.ActiveRoleOverride = null;
  }

  RefreshCurrentUser(PreviousAccount: string, CurrentAccount: string): void {
    if (this.CurrentMockUser?.Account !== PreviousAccount) return;
    this.CurrentMockUser = this.MockRbac.GetUser(CurrentAccount);
    if (this.CurrentMockUser?.Role !== 'ADMIN') this.ActiveRoleOverride = null;
  }

  SwitchDemoRole(Role: MockRoleKey): void { if (this.CanSwitchDemoRole) this.ActiveRoleOverride = Role; }
  SelectReport(ReportKey: MockReportKey): void { this.MockRbac.SelectReport(ReportKey); }

  get ReportPermission(): MockReportPermission {
    return this.ActiveRoleKey && this.SelectedReport ? this.MockRbac.GetReportPermission(this.ActiveRoleKey, this.SelectedReport.ReportKey) : { CanView: false, CanExecute: false, CanExportPdf: false, CanPrint: false };
  }

  HasManagementPermission(Permission: MockManagementPermission): boolean {
    return this.ActiveRoleKey ? this.MockRbac.HasManagementPermission(this.ActiveRoleKey, Permission) : false;
  }
}
