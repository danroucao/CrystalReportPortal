import { Injectable } from '@angular/core';

import { MockCategoryPermission, MockManagementPermission, MockRole, MockRoleKey } from '../mock/mock-permissions';
import { MockReportKey, MockReportReadModel } from '../mock/mock-reports';
import { MockUser } from '../mock/mock-users';
import { MockRbacService, MockReportSearchCriteria } from './mock-rbac.service';

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
  get AccessibleReports(): readonly MockReportReadModel[] {
    return this.MockRbac.GetAccessibleReports(this.ActiveRoles);
  }
  get SelectedReport(): MockReportReadModel | null {
    return this.MockRbac.GetSelectedReport(this.ActiveRoles);
  }
  get SelectedReportSearchCriteria(): MockReportSearchCriteria | null {
    return this.MockRbac.GetSelectedReportSearchCriteria();
  }

  Login(Account: string, Password: string): boolean {
    const AuthenticatedUser = this.MockRbac.Authenticate(Account, Password);
    this.CurrentMockUser = AuthenticatedUser;
    this.ActiveRolesOverride = null;
    this.MockRbac.ClearSelectedReport();
    return AuthenticatedUser !== null;
  }

  Logout(): void {
    this.CurrentMockUser = null;
    this.ActiveRolesOverride = null;
    this.MockRbac.ClearSelectedReport();
  }

  RefreshCurrentUser(PreviousAccount: string, CurrentAccount: string): void {
    if (this.CurrentMockUser?.Account !== PreviousAccount) return;
    this.CurrentMockUser = this.MockRbac.GetUser(CurrentAccount);
    if (!this.IsAdmin) this.ActiveRolesOverride = null;
  }

  SwitchDemoRole(Role: MockRoleKey): void { if (this.CanSwitchDemoRole) this.ActiveRolesOverride = [Role]; }
  SelectReport(
    ReportKey: MockReportKey,
    SearchCriteria: MockReportSearchCriteria | null = null,
  ): void { this.MockRbac.SelectReport(ReportKey, SearchCriteria); }

  get SelectedReportCategoryPermission(): MockCategoryPermission {
    return this.SelectedReport
      ? this.MockRbac.GetEffectiveCategoryPermission(
          this.ActiveRoles,
          this.SelectedReport.CategoryId,
        )
      : { CanExecute: false, CanExportPdf: false, CanPrint: false };
  }

  HasManagementPermission(Permission: MockManagementPermission): boolean {
    return this.IsAdmin && this.MockRbac.HasManagementPermission('ADMIN', Permission);
  }
}
