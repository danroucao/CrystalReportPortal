import { Injectable } from '@angular/core';

import { MockAuthenticationProvider } from '../mock/mock-authentication.provider';
import { EmptyMockCategoryPermission, MockCategoryPermission, MockManagementPermission, MockRoleKey } from '../mock/mock-permissions';
import { MockReportKey, MockReportReadModel } from '../mock/mock-reports';
import { MockUser } from '../mock/mock-users';
import { AuthIdentity } from './auth-identity';
import { MockRbacService, MockReportSearchCriteria } from './mock-rbac.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private Identity: AuthIdentity | null = null;
  private BoundBackOfficeUserAccount: string | null = null;
  private BackOfficeIdentityBindingFailure: 'invalid-credentials' | null = null;

  constructor(private readonly MockRbac: MockRbacService) {}

  get IsDemoAuthenticationEnabled(): boolean { return this.MockRbac.IsEnabled; }
  get CurrentIdentity(): AuthIdentity | null {
    if (this.Identity?.Kind === 'FrontUser' && !this.CurrentUser) return null;
    return this.Identity;
  }
  get CurrentUser(): MockUser | null {
    if (this.Identity?.Kind !== 'FrontUser') return null;
    const User = this.MockRbac.GetUser(this.Identity.Account);
    return User;
  }
  get IsAuthenticated(): boolean { return this.CurrentIdentity !== null; }
  get IsFrontOffice(): boolean { return this.CurrentUser !== null; }
  get IsBackOffice(): boolean { return this.Identity?.Kind === 'BackOffice'; }
  get IsBackOfficeIdentityBound(): boolean {
    return this.IsBackOffice && this.BoundBackOfficeUser !== null;
  }
  get RequiresBackOfficeIdentityBinding(): boolean {
    return this.IsBackOffice && !this.IsBackOfficeIdentityBound;
  }
  get BoundBackOfficeUser(): MockUser | null {
    if (!this.IsBackOffice || !this.BoundBackOfficeUserAccount) return null;
    const User = this.MockRbac.GetUser(this.BoundBackOfficeUserAccount);
    return User;
  }
  get BoundBackOfficeUserId(): string | null {
    return this.BoundBackOfficeUser?.Account ?? null;
  }
  get LastBackOfficeIdentityBindingFailure(): 'invalid-credentials' | null {
    return this.BackOfficeIdentityBindingFailure;
  }
  get CanOperateBackOffice(): boolean { return this.IsBackOfficeIdentityBound; }
  get DisplayName(): string {
    return this.Identity?.Kind === 'BackOffice'
      ? this.Identity.DisplayName : this.CurrentUser?.DisplayName ?? '';
  }
  get HomeRoute(): string { return this.IsBackOffice ? '/admin/users' : '/reports/parameters'; }
  get ActiveRoles(): readonly MockRoleKey[] { return this.CurrentUser?.Roles ?? []; }
  get ActiveRoleNames(): string {
    return this.ActiveRoles.map((Role) => this.MockRbac.GetRole(Role)?.DisplayName ?? Role).join('、');
  }
  get AccessibleReports(): readonly MockReportReadModel[] {
    return this.IsFrontOffice ? this.MockRbac.GetAccessibleReports(this.ActiveRoles) : [];
  }
  get SelectedReport(): MockReportReadModel | null {
    return this.IsFrontOffice ? this.MockRbac.GetSelectedReport(this.ActiveRoles) : null;
  }
  get SelectedReportSearchCriteria(): MockReportSearchCriteria | null {
    return this.SelectedReport ? this.MockRbac.GetSelectedReportSearchCriteria() : null;
  }

  Login(Account: string, Password: string): boolean {
    // A login attempt replaces the previous identity, even on failure.
    this.Logout();
    if (!this.IsDemoAuthenticationEnabled) return false;
    const BackOffice = MockAuthenticationProvider.AuthenticateBackOffice(Account, Password);
    if (BackOffice) {
      this.Identity = { Kind: 'BackOffice', ...BackOffice };
      return true;
    }
    const User = this.MockRbac.Authenticate(Account, Password);
    if (!User) return false;
    this.Identity = { Kind: 'FrontUser', Account: User.Account };
    return true;
  }
  BindBackOfficeIdentity(Account: string, Password: string): boolean {
    this.BackOfficeIdentityBindingFailure = null;
    if (!this.IsBackOffice || !this.IsDemoAuthenticationEnabled) {
      this.BackOfficeIdentityBindingFailure = 'invalid-credentials';
      return false;
    }
    const RequestedUser = this.MockRbac.GetUser(Account);
    if (!RequestedUser) {
      this.BackOfficeIdentityBindingFailure = 'invalid-credentials';
      return false;
    }
    const User = this.MockRbac.Authenticate(Account, Password);
    if (!User) {
      this.BackOfficeIdentityBindingFailure = 'invalid-credentials';
      return false;
    }
    this.BoundBackOfficeUserAccount = User.Account;
    return true;
  }
  Logout(): void {
    this.Identity = null;
    this.BoundBackOfficeUserAccount = null;
    this.MockRbac.ClearSelectedReport();
  }
  CanExecuteReport(ReportKey: MockReportKey): boolean {
    return this.AccessibleReports.some((Report) => Report.ReportKey === ReportKey);
  }
  SelectReport(ReportKey: MockReportKey, SearchCriteria: MockReportSearchCriteria | null = null): void {
    this.MockRbac.ClearSelectedReport();
    if (this.CanExecuteReport(ReportKey)) this.MockRbac.SelectReport(ReportKey, SearchCriteria);
  }
  get SelectedReportCategoryPermission(): MockCategoryPermission {
    const Report = this.SelectedReport;
    return Report
      ? this.MockRbac.GetEffectiveCategoryPermission(this.ActiveRoles, Report.CategoryId)
      : EmptyMockCategoryPermission();
  }
  HasManagementPermission(Permission: MockManagementPermission): boolean {
    return this.IsFrontOffice && this.ActiveRoles.some((Role) =>
      this.MockRbac.HasManagementPermission(Role, Permission));
  }
}
