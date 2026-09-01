import { Injectable } from '@angular/core';

import { MockAuthenticationProvider } from '../mock/mock-authentication.provider';
import { MockReport, MockReportKey, MockReports } from '../mock/mock-reports';
import { InitialMockRoleReportPermissions, MockManagementPermission, MockReportPermission, MockReportPermissionEntry, MockRole, MockRoleKey, MockRoles } from '../mock/mock-permissions';
import { MockUser, MockUserCredential } from '../mock/mock-users';

export interface MockUserDraft {
  Account: string;
  DisplayName: string;
  InitialPassword: string;
  Roles: MockRoleKey[];
  Enabled: boolean;
}

export interface MockUserEditDraft {
  Roles: MockRoleKey[];
  Enabled: boolean;
}

export interface MockAccountSettingsDraft {
  DisplayName: string;
  NewPassword: string;
}

export interface MockRoleDraft {
  DisplayName: string;
  Permissions: MockReportPermissionEntry[];
}

export type MockRoleSaveResult = 'updated' | 'not-found' | 'invalid' | 'duplicate-name';
export type MockDeleteRoleResult =
  | 'deleted'
  | 'not-found'
  | 'built-in-role'
  | 'role-in-use';
export type MockRoleChangeRequestStatus = 'Pending' | 'Approved' | 'Rejected';
export type MockAccountSettingsResult = 'updated' | 'not-found' | 'invalid';
export type MockDeleteUserResult = 'deleted' | 'not-found' | 'minimum-admins';

export interface MockRoleChangeRequest {
  readonly Id: number;
  RequesterAccount: string;
  TargetAccount: string;
  readonly PreviousRoles: readonly MockRoleKey[];
  readonly RequestedRoles: readonly MockRoleKey[];
  readonly RequestedEnabled: boolean;
  readonly RequestedAt: string;
  Status: MockRoleChangeRequestStatus;
}

export type MockUserEditResult =
  | 'updated'
  | 'role-change-requested'
  | 'not-found'
  | 'invalid'
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

const EmptyPermission = (): MockReportPermission => ({
  CanExecute: false,
  CanExportPdf: false,
  CanPrint: false,
});

@Injectable({ providedIn: 'root' })
export class MockRbacService {
  private readonly UsersStore: MockUserCredential[] = MockAuthenticationProvider.GetInitialUsers().map((User) => this.CloneCredential(User));
  private readonly RoleStore: MockRole[] = MockRoles.map((Role) => ({ ...Role, ManagementPermissions: [...Role.ManagementPermissions] }));
  private readonly ReportStore: MockReport[] = MockReports.map((Report) => ({ ...Report }));
  private readonly RoleChangeRequestsStore: MockRoleChangeRequest[] = [];
  private NextRoleChangeRequestId = 1;
  private NextCustomRoleSequence = 1;
  private readonly PermissionStore: Record<string, Record<MockReportKey, MockReportPermission>> = this.CloneInitialPermissions();
  private SelectedReportKey: MockReportKey = 'AccountBalance';

  get IsEnabled(): boolean { return MockAuthenticationProvider.IsEnabled; }
  get Users(): readonly MockUser[] { return this.UsersStore.map((User) => this.ToReadModel(User)); }
  get RoleChangeRequests(): readonly MockRoleChangeRequest[] {
    return this.RoleChangeRequestsStore.map((Request) => ({ ...Request, PreviousRoles: [...Request.PreviousRoles], RequestedRoles: [...Request.RequestedRoles] }));
  }
  get AdminCount(): number { return this.UsersStore.filter((User) => User.Roles.includes('ADMIN')).length; }
  get Roles(): readonly MockRole[] { return this.RoleStore.map((Role) => ({ ...Role, ManagementPermissions: [...Role.ManagementPermissions] })); }
  get Reports(): readonly MockReport[] { return this.ReportStore.map((Report) => ({ ...Report })); }

  GetRoleUserCount(RoleKey: MockRoleKey): number {
    return this.UsersStore.filter((User) => User.Roles.includes(RoleKey)).length;
  }

  GetUser(Account: string): MockUser | null {
    const User = this.UsersStore.find((Entry) => Entry.Account === Account);
    return User ? this.ToReadModel(User) : null;
  }

  Authenticate(Account: string, Password: string): MockUser | null {
    const User = this.UsersStore.find((Entry) => Entry.Account === Account && Entry.Password === Password && Entry.Enabled);
    return User ? this.ToReadModel(User) : null;
  }

  NormalizeRoles(Roles: readonly MockRoleKey[]): MockRoleKey[] {
    const ValidRoles = [...new Set(Roles)].filter((RoleKey) => this.RoleStore.some((Role) => Role.Key === RoleKey));
    return ValidRoles.includes('ADMIN') ? ['ADMIN'] : ValidRoles;
  }

  CreateUser(Draft: MockUserDraft): boolean {
    const Roles = this.NormalizeRoles(Draft.Roles);
    if (!Draft.Account.trim() || !Draft.DisplayName.trim() || !Draft.InitialPassword || !Roles.length) return false;
    if (this.UsersStore.some((User) => User.Account === Draft.Account.trim())) return false;
    const Timestamp = this.GetTimestamp();
    this.UsersStore.push({
      Account: Draft.Account.trim(),
      DisplayName: Draft.DisplayName.trim(),
      Password: Draft.InitialPassword,
      Roles,
      Enabled: Draft.Enabled,
      CreatedAt: Timestamp,
      UpdatedAt: Timestamp,
    });
    return true;
  }

  SaveUserEdit(OriginalAccount: string, Draft: MockUserEditDraft, RequesterAccount: string): MockUserEditResult {
    const ExistingUser = this.UsersStore.find((User) => User.Account === OriginalAccount);
    const Roles = this.NormalizeRoles(Draft.Roles);
    if (!ExistingUser) return 'not-found';
    if (!Roles.length) return 'invalid';
    if (RequesterAccount === OriginalAccount && !Draft.Enabled) return 'self-disable-not-allowed';

    const IsAdminDemotion = ExistingUser.Roles.includes('ADMIN') && !Roles.includes('ADMIN');
    if (IsAdminDemotion) {
      if (RequesterAccount === OriginalAccount) return 'self-role-change-not-allowed';
      if (this.AdminCount <= 1) return 'minimum-admins';
      if (this.RoleChangeRequestsStore.some((Request) => Request.TargetAccount === OriginalAccount && Request.Status === 'Pending')) return 'pending-request-exists';
      this.RoleChangeRequestsStore.push({
        Id: this.NextRoleChangeRequestId++,
        RequesterAccount,
        TargetAccount: ExistingUser.Account,
        PreviousRoles: [...ExistingUser.Roles],
        RequestedRoles: [...Roles],
        RequestedEnabled: Draft.Enabled,
        RequestedAt: this.GetTimestamp(),
        Status: 'Pending',
      });
      return 'role-change-requested';
    }

    ExistingUser.Roles = Roles;
    ExistingUser.Enabled = Draft.Enabled;
    this.Touch(ExistingUser);
    return 'updated';
  }

  UpdateOwnAccount(Account: string, Draft: MockAccountSettingsDraft): MockAccountSettingsResult {
    const User = this.UsersStore.find((Entry) => Entry.Account === Account);
    if (!User) return 'not-found';
    if (!Draft.DisplayName.trim()) return 'invalid';
    User.DisplayName = Draft.DisplayName.trim();
    if (Draft.NewPassword) User.Password = Draft.NewPassword;
    this.Touch(User);
    return 'updated';
  }

  DeleteUser(Account: string): MockDeleteUserResult {
    const UserIndex = this.UsersStore.findIndex((User) => User.Account === Account);
    if (UserIndex < 0) return 'not-found';
    if (this.UsersStore[UserIndex].Roles.includes('ADMIN') && this.AdminCount <= 1) return 'minimum-admins';
    this.UsersStore.splice(UserIndex, 1);
    return 'deleted';
  }

  RespondToRoleChangeRequest(RequestId: number, ResponderAccount: string, Approve: boolean): MockRoleChangeResponseResult {
    const Request = this.RoleChangeRequestsStore.find((Entry) => Entry.Id === RequestId);
    if (!Request) return 'not-found';
    if (Request.Status !== 'Pending') return 'not-pending';
    if (Request.TargetAccount !== ResponderAccount) return 'not-target';
    if (Approve && Request.PreviousRoles.includes('ADMIN') && !Request.RequestedRoles.includes('ADMIN') && this.AdminCount <= 1) return 'minimum-admins';
    if (Approve) {
      const Target = this.UsersStore.find((User) => User.Account === Request.TargetAccount);
      if (!Target) return 'not-found';
      Target.Roles = this.NormalizeRoles(Request.RequestedRoles);
      Target.Enabled = Request.RequestedEnabled;
      this.Touch(Target);
      Request.Status = 'Approved';
      return 'approved';
    }
    Request.Status = 'Rejected';
    return 'rejected';
  }

  SetUserEnabled(Account: string, Enabled: boolean): void {
    const ExistingUser = this.UsersStore.find((User) => User.Account === Account);
    if (!ExistingUser) return;
    ExistingUser.Enabled = Enabled;
    this.Touch(ExistingUser);
  }

  CreateRole(Draft: MockRoleDraft): MockRole | null {
    const DisplayName = Draft.DisplayName.trim();
    if (!DisplayName || this.RoleStore.some((Role) => Role.DisplayName === DisplayName)) return null;
    const Key = `CUSTOM_${this.NextCustomRoleSequence++}`;
    const Role: MockRole = {
      Key,
      DisplayName,
      Description: '前端 Mock 建立的自訂角色。',
      ManagementPermissions: [],
    };
    this.RoleStore.push(Role);
    this.PermissionStore[Key] = Object.fromEntries(Draft.Permissions.map((Entry) => [Entry.ReportKey, this.NormalizePermission(Entry.Permission)])) as Record<MockReportKey, MockReportPermission>;
    return { ...Role, ManagementPermissions: [...Role.ManagementPermissions] };
  }

  UpdateRole(RoleKey: MockRoleKey, Draft: MockRoleDraft): MockRoleSaveResult {
    const RoleIndex = this.RoleStore.findIndex((Role) => Role.Key === RoleKey);
    if (RoleIndex < 0) return 'not-found';
    const ExistingRole = this.RoleStore[RoleIndex];
    const DisplayName = RoleKey === 'ADMIN'
      ? ExistingRole.DisplayName
      : Draft.DisplayName.trim();
    if (!DisplayName) return 'invalid';
    if (this.RoleStore.some((Role) => Role.Key !== RoleKey && Role.DisplayName === DisplayName)) return 'duplicate-name';
    this.RoleStore[RoleIndex] = { ...ExistingRole, DisplayName };
    this.SaveReportPermissions(RoleKey, Draft.Permissions);
    return 'updated';
  }

  DeleteRole(RoleKey: MockRoleKey): MockDeleteRoleResult {
    const RoleIndex = this.RoleStore.findIndex((Role) => Role.Key === RoleKey);
    if (RoleIndex < 0) return 'not-found';
    if (RoleKey === 'ADMIN') return 'built-in-role';
    if (this.GetRoleUserCount(RoleKey) > 0) return 'role-in-use';
    this.RoleStore.splice(RoleIndex, 1);
    delete this.PermissionStore[RoleKey];
    return 'deleted';
  }

  SetReportEnabled(ReportKey: MockReportKey, Enabled: boolean): void {
    const ReportIndex = this.ReportStore.findIndex((Report) => Report.ReportKey === ReportKey);
    if (ReportIndex >= 0) this.ReportStore[ReportIndex] = { ...this.ReportStore[ReportIndex], Enabled };
  }

  GetAccessibleReports(Roles: readonly MockRoleKey[]): readonly MockReport[] {
    return this.ReportStore
      .filter((Report) => Report.Enabled && this.GetEffectiveReportPermission(Roles, Report.ReportKey).CanExecute)
      .map((Report) => ({ ...Report }));
  }

  GetReportPermission(Role: MockRoleKey, ReportKey: MockReportKey): MockReportPermission {
    return { ...(this.PermissionStore[Role]?.[ReportKey] ?? EmptyPermission()) };
  }

  GetEffectiveReportPermission(Roles: readonly MockRoleKey[], ReportKey: MockReportKey): MockReportPermission {
    return this.NormalizeRoles(Roles).reduce<MockReportPermission>((Effective, Role) => {
      const Permission = this.GetReportPermission(Role, ReportKey);
      return {
        CanExecute: Effective.CanExecute || Permission.CanExecute,
        CanExportPdf: Effective.CanExportPdf || Permission.CanExportPdf,
        CanPrint: Effective.CanPrint || Permission.CanPrint,
      };
    }, EmptyPermission());
  }

  GetReportPermissionEntries(Role: MockRoleKey): MockReportPermissionEntry[] {
    return this.Reports.map((Report) => ({ ReportKey: Report.ReportKey, ReportName: Report.ReportName, Permission: this.GetReportPermission(Role, Report.ReportKey) }));
  }

  GetEmptyReportPermissionEntries(): MockReportPermissionEntry[] {
    return this.Reports.map((Report) => ({ ReportKey: Report.ReportKey, ReportName: Report.ReportName, Permission: EmptyPermission() }));
  }

  SaveReportPermissions(Role: MockRoleKey, Entries: readonly MockReportPermissionEntry[]): void {
    if (!this.PermissionStore[Role]) return;
    Entries.forEach((Entry) => { this.PermissionStore[Role][Entry.ReportKey] = this.NormalizePermission(Entry.Permission); });
  }

  GetRole(RoleKey: MockRoleKey): MockRole { return this.RoleStore.find((Role) => Role.Key === RoleKey)!; }
  HasManagementPermission(Role: MockRoleKey, Permission: MockManagementPermission): boolean { return this.GetRole(Role).ManagementPermissions.includes(Permission); }
  SelectReport(ReportKey: MockReportKey): void { this.SelectedReportKey = ReportKey; }
  GetSelectedReport(Roles: readonly MockRoleKey[]): MockReport | null {
    const Reports = this.GetAccessibleReports(Roles);
    return Reports.find((Report) => Report.ReportKey === this.SelectedReportKey) ?? Reports[0] ?? null;
  }

  private NormalizePermission(Permission: MockReportPermission): MockReportPermission {
    return Permission.CanExecute ? { ...Permission } : EmptyPermission();
  }

  private CloneInitialPermissions(): Record<string, Record<MockReportKey, MockReportPermission>> {
    return Object.fromEntries(Object.entries(InitialMockRoleReportPermissions).map(([Role, Permissions]) => [Role, Object.fromEntries(Object.entries(Permissions).map(([ReportKey, Permission]) => [ReportKey, this.NormalizePermission(Permission)]))])) as Record<string, Record<MockReportKey, MockReportPermission>>;
  }

  private ToReadModel({ Password: _, Roles, ...User }: MockUserCredential): MockUser {
    return { ...User, Roles: [...Roles] };
  }

  private CloneCredential(User: MockUserCredential): MockUserCredential {
    return { ...User, Roles: [...User.Roles] };
  }

  private Touch(User: MockUserCredential): void {
    User.UpdatedAt = this.GetTimestamp();
  }

  private GetTimestamp(): string {
    const Now = new Date();
    const Pad = (Value: number) => Value.toString().padStart(2, '0');
    return `${Now.getFullYear()}/${Pad(Now.getMonth() + 1)}/${Pad(Now.getDate())} ${Pad(Now.getHours())}:${Pad(Now.getMinutes())}`;
  }
}
