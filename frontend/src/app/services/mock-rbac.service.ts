import { Injectable } from '@angular/core';

import { MockAuthenticationProvider } from '../mock/mock-authentication.provider';
import { MockReport, MockReportKey, MockReports } from '../mock/mock-reports';
import { InitialMockRoleReportPermissions, MockManagementPermission, MockReportPermission, MockReportPermissionEntry, MockRole, MockRoleKey, MockRoles } from '../mock/mock-permissions';
import { MockUser } from '../mock/mock-users';

export interface MockUserDraft {
  Account: string;
  DisplayName: string;
  InitialPassword: string;
  Role: MockRoleKey;
  Enabled: boolean;
}

export interface MockUserEditDraft {
  Account: string;
  DisplayName: string;
  Role: MockRoleKey;
  Enabled: boolean;
}

export interface MockRoleDraft {
  DisplayName: string;
  Description: string;
  Permissions: MockReportPermissionEntry[];
}

export type MockRoleSaveResult = 'updated' | 'not-found' | 'invalid' | 'duplicate-name';

export type MockRoleChangeRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface MockRoleChangeRequest {
  readonly Id: number;
  RequesterAccount: string;
  TargetAccount: string;
  readonly PreviousRole: MockRoleKey;
  readonly RequestedRole: MockRoleKey;
  readonly RequestedAt: string;
  Status: MockRoleChangeRequestStatus;
}

export type MockUserEditResult =
  | 'updated'
  | 'role-change-requested'
  | 'not-found'
  | 'invalid'
  | 'duplicate-account'
  | 'self-disable-not-allowed'
  | 'self-role-change-not-allowed'
  | 'minimum-admins'
  | 'pending-request-exists';

export type MockRoleChangeResponseResult =
  | 'approved'
  | 'rejected'
  | 'not-found'
  | 'not-target'
  | 'not-pending'
  | 'minimum-admins';

@Injectable({ providedIn: 'root' })
export class MockRbacService {
  private readonly UsersStore: MockUser[] = MockAuthenticationProvider.DemoUsers.map((MockUser) => ({ ...MockUser }));
  private readonly RoleStore: MockRole[] = MockRoles.map((Role) => ({ ...Role, ManagementPermissions: [...Role.ManagementPermissions] }));
  private readonly ReportStore: MockReport[] = MockReports.map((Report) => ({ ...Report }));
  private readonly RoleChangeRequestsStore: MockRoleChangeRequest[] = [];
  private NextRoleChangeRequestId = 1;
  private NextCustomRoleId = 1;
  private readonly PermissionStore: Record<string, Record<MockReportKey, MockReportPermission>> = this.CloneInitialPermissions();
  private SelectedReportKey: MockReportKey = 'AccountBalance';

  get IsEnabled(): boolean { return MockAuthenticationProvider.IsEnabled; }
  get Users(): readonly MockUser[] { return this.UsersStore.map((MockUser) => ({ ...MockUser })); }
  get RoleChangeRequests(): readonly MockRoleChangeRequest[] { return this.RoleChangeRequestsStore.map((Request) => ({ ...Request })); }
  get AdminCount(): number { return this.UsersStore.filter((User) => User.Role === 'ADMIN').length; }
  get Roles(): readonly MockRole[] { return this.RoleStore.map((Role) => ({ ...Role, ManagementPermissions: [...Role.ManagementPermissions] })); }
  get Reports(): readonly MockReport[] { return this.ReportStore.map((Report) => ({ ...Report })); }

  GetRoleUserCount(RoleKey: MockRoleKey): number {
    return this.UsersStore.filter((User) => User.Role === RoleKey).length;
  }

  GetUser(Account: string): MockUser | null {
    const User = this.UsersStore.find((Entry) => Entry.Account === Account);
    return User ? { ...User } : null;
  }

  Authenticate(Account: string, Password: string): MockUser | null {
    const AuthenticatedUser = this.UsersStore.find((MockUser) => MockUser.Account === Account && MockUser.Password === Password && MockUser.Enabled === true);
    return AuthenticatedUser ? { ...AuthenticatedUser } : null;
  }

  CreateUser(Draft: MockUserDraft): boolean {
    if (!Draft.Account.trim() || !Draft.DisplayName.trim() || !Draft.InitialPassword) return false;
    if (this.UsersStore.some((MockUser) => MockUser.Account === Draft.Account.trim())) return false;
    this.UsersStore.push({ Account: Draft.Account.trim(), DisplayName: Draft.DisplayName.trim(), Password: Draft.InitialPassword, Role: Draft.Role, Enabled: Draft.Enabled });
    return true;
  }

  CreateRole(Draft: MockRoleDraft): MockRole | null {
    const DisplayName = Draft.DisplayName.trim();
    if (!DisplayName || this.RoleStore.some((Role) => Role.DisplayName === DisplayName)) return null;
    const Key = `CUSTOM_${this.NextCustomRoleId++}`;
    const Role: MockRole = {
      Key,
      DisplayName,
      Description: Draft.Description.trim() || '前端 Mock 建立的自訂角色。',
      ManagementPermissions: [],
    };
    this.RoleStore.push(Role);
    this.PermissionStore[Key] = Object.fromEntries(
      Draft.Permissions.map((Entry) => [Entry.ReportKey, { ...Entry.Permission }]),
    ) as Record<MockReportKey, MockReportPermission>;
    return { ...Role, ManagementPermissions: [...Role.ManagementPermissions] };
  }

  UpdateRole(RoleKey: MockRoleKey, Draft: MockRoleDraft): MockRoleSaveResult {
    const RoleIndex = this.RoleStore.findIndex((Role) => Role.Key === RoleKey);
    const DisplayName = Draft.DisplayName.trim();
    if (RoleIndex < 0) return 'not-found';
    if (!DisplayName) return 'invalid';
    if (this.RoleStore.some((Role) => Role.Key !== RoleKey && Role.DisplayName === DisplayName)) {
      return 'duplicate-name';
    }

    const ExistingRole = this.RoleStore[RoleIndex];
    this.RoleStore[RoleIndex] = {
      ...ExistingRole,
      DisplayName,
      Description: Draft.Description.trim() || ExistingRole.Description,
    };
    this.SaveReportPermissions(RoleKey, Draft.Permissions);
    return 'updated';
  }

  SaveUserEdit(OriginalAccount: string, Draft: MockUserEditDraft, RequesterAccount: string): MockUserEditResult {
    const ExistingUser = this.UsersStore.find((User) => User.Account === OriginalAccount);
    const Account = Draft.Account.trim();
    if (!ExistingUser) return 'not-found';
    if (!Account || !Draft.DisplayName.trim()) return 'invalid';
    if (Account !== OriginalAccount && this.UsersStore.some((User) => User.Account === Account)) return 'duplicate-account';
    if (RequesterAccount === OriginalAccount && !Draft.Enabled) return 'self-disable-not-allowed';

    if (ExistingUser.Role === 'ADMIN' && Draft.Role !== 'ADMIN') {
      if (RequesterAccount === OriginalAccount) return 'self-role-change-not-allowed';
      if (this.AdminCount <= 3) return 'minimum-admins';
      if (this.RoleChangeRequestsStore.some((Request) => Request.TargetAccount === OriginalAccount && Request.Status === 'Pending')) return 'pending-request-exists';
      this.UpdateAccount(ExistingUser, Account);
      ExistingUser.Enabled = Draft.Enabled;
      this.RoleChangeRequestsStore.push({
        Id: this.NextRoleChangeRequestId++,
        RequesterAccount,
        TargetAccount: ExistingUser.Account,
        PreviousRole: 'ADMIN',
        RequestedRole: Draft.Role,
        RequestedAt: new Date().toLocaleString('zh-TW'),
        Status: 'Pending',
      });
      return 'role-change-requested';
    }

    this.UpdateAccount(ExistingUser, Account);
    if (ExistingUser.Role !== 'ADMIN') ExistingUser.DisplayName = Draft.DisplayName.trim();
    ExistingUser.Role = Draft.Role;
    ExistingUser.Enabled = Draft.Enabled;
    return 'updated';
  }

  RespondToRoleChangeRequest(RequestId: number, ResponderAccount: string, Approve: boolean): MockRoleChangeResponseResult {
    const Request = this.RoleChangeRequestsStore.find((Entry) => Entry.Id === RequestId);
    if (!Request) return 'not-found';
    if (Request.Status !== 'Pending') return 'not-pending';
    if (Request.TargetAccount !== ResponderAccount) return 'not-target';
    if (Approve && Request.PreviousRole === 'ADMIN' && Request.RequestedRole !== 'ADMIN' && this.AdminCount <= 3) return 'minimum-admins';
    if (Approve) {
      const Target = this.UsersStore.find((User) => User.Account === Request.TargetAccount);
      if (!Target) return 'not-found';
      Target.Role = Request.RequestedRole;
      Request.Status = 'Approved';
      return 'approved';
    }
    Request.Status = 'Rejected';
    return 'rejected';
  }

  SetUserEnabled(Account: string, Enabled: boolean): void {
    const ExistingUser = this.UsersStore.find((MockUser) => MockUser.Account === Account);
    if (ExistingUser) ExistingUser.Enabled = Enabled;
  }

  SetReportEnabled(ReportKey: MockReportKey, Enabled: boolean): void {
    const ReportIndex = this.ReportStore.findIndex(
      (Entry) => Entry.ReportKey === ReportKey,
    );
    if (ReportIndex >= 0) {
      this.ReportStore[ReportIndex] = {
        ...this.ReportStore[ReportIndex],
        Enabled,
      };
    }
  }

  GetAccessibleReports(Role: MockRoleKey): readonly MockReport[] {
    return this.ReportStore
      .filter(
        (MockReport) =>
          MockReport.Enabled &&
          this.PermissionStore[Role][MockReport.ReportKey].CanView,
      )
      .map((MockReport) => ({ ...MockReport }));
  }

  GetReportPermission(Role: MockRoleKey, ReportKey: MockReportKey): MockReportPermission {
    return { ...this.PermissionStore[Role][ReportKey] };
  }

  GetReportPermissionEntries(Role: MockRoleKey): MockReportPermissionEntry[] {
    return this.Reports.map((MockReport) => ({ ReportKey: MockReport.ReportKey, ReportName: MockReport.ReportName, Permission: this.GetReportPermission(Role, MockReport.ReportKey) }));
  }

  GetEmptyReportPermissionEntries(): MockReportPermissionEntry[] {
    return this.Reports.map((MockReport) => ({
      ReportKey: MockReport.ReportKey,
      ReportName: MockReport.ReportName,
      Permission: { CanView: false, CanExecute: false, CanExportPdf: false, CanPrint: false },
    }));
  }

  SaveReportPermissions(Role: MockRoleKey, Entries: readonly MockReportPermissionEntry[]): void {
    Entries.forEach((Entry) => { this.PermissionStore[Role][Entry.ReportKey] = { ...Entry.Permission }; });
  }

  GetRole(RoleKey: MockRoleKey): MockRole { return this.RoleStore.find((MockRole) => MockRole.Key === RoleKey)!; }
  HasManagementPermission(Role: MockRoleKey, Permission: MockManagementPermission): boolean { return this.GetRole(Role).ManagementPermissions.includes(Permission); }
  SelectReport(ReportKey: MockReportKey): void { this.SelectedReportKey = ReportKey; }
  GetSelectedReport(Role: MockRoleKey): MockReport | null {
    const Reports = this.GetAccessibleReports(Role);
    return Reports.find((MockReport) => MockReport.ReportKey === this.SelectedReportKey) ?? Reports[0] ?? null;
  }

  private CloneInitialPermissions(): Record<string, Record<MockReportKey, MockReportPermission>> {
    return Object.fromEntries(Object.entries(InitialMockRoleReportPermissions).map(([Role, Permissions]) => [Role, Object.fromEntries(Object.entries(Permissions).map(([ReportKey, Permission]) => [ReportKey, { ...Permission }]))])) as Record<string, Record<MockReportKey, MockReportPermission>>;
  }

  private UpdateAccount(User: MockUser, Account: string): void {
    if (User.Account === Account) return;
    const PreviousAccount = User.Account;
    User.Account = Account;
    this.RoleChangeRequestsStore.forEach((Request) => {
      if (Request.RequesterAccount === PreviousAccount) Request.RequesterAccount = Account;
      if (Request.TargetAccount === PreviousAccount) Request.TargetAccount = Account;
    });
  }
}
