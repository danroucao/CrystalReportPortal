import { Injectable } from '@angular/core';

import { MockAuthenticationProvider } from '../mock/mock-authentication.provider';
import {
  MockReportCategories,
  SystemUncategorizedCategoryId,
} from '../mock/mock-report-categories';
import type {
  MockReportCategory,
  MockReportCategoryId,
} from '../mock/mock-report-categories';
import {
  MockReport,
  MockReportKey,
  MockReportReadModel,
  MockReports,
} from '../mock/mock-reports';
import {
  EmptyMockCategoryPermission,
  FullMockCategoryPermission,
  InitialMockRoleCategoryPermissions,
  MockCategoryPermission,
  MockCategoryPermissionEntry,
  MockManagementPermission,
  MockRole,
  MockRoleKey,
  MockRoles,
} from '../mock/mock-permissions';
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
  Permissions: MockCategoryPermissionEntry[];
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

export interface MockFavoriteReport {
  readonly Report: MockReportReadModel;
  readonly FavoritedAt: string | null;
  readonly LastUsedAt: string | null;
}

type MockCategoryPermissionRecord = Record<
  MockReportCategoryId,
  MockCategoryPermission
>;

export interface MockReportSearchCriteria {
  readonly StartDate: string;
  readonly EndDate: string;
}

interface MockFavoriteReportState {
  IsFavorite: boolean;
  FavoritedAt: string | null;
  LastUsedAt: string | null;
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

export type MockCreateCategoryResult =
  | { Status: 'created'; Category: MockReportCategory }
  | {
      Status: 'invalid-name' | 'duplicate-name' | 'system-reserved-name';
      Category: null;
    };

export type MockRenameCategoryResult =
  | { Status: 'renamed'; Category: MockReportCategory }
  | {
      Status:
        | 'not-found'
        | 'invalid-name'
        | 'duplicate-name'
        | 'system-reserved';
      Category: null;
    };

export type MockDeleteCategoryResult =
  | {
      Status: 'deleted';
      DeletedCategoryName: string;
      MovedReportCount: number;
    }
  | {
      Status: 'not-found' | 'system-reserved';
      DeletedCategoryName: null;
      MovedReportCount: 0;
    };

@Injectable({ providedIn: 'root' })
export class MockRbacService {
  private readonly MinimumAdminCount = 3;
  private readonly UsersStore: MockUserCredential[] = MockAuthenticationProvider.GetInitialUsers().map((User) => this.CloneCredential(User));
  private readonly RoleStore: MockRole[] = MockRoles.map((Role) => ({ ...Role, ManagementPermissions: [...Role.ManagementPermissions] }));
  private readonly CategoryStore: MockReportCategory[] = MockReportCategories.map(
    (Category) => ({ ...Category }),
  );
  private readonly ReportStore: MockReport[] = MockReports.map((Report) => ({ ...Report }));
  private readonly FavoriteReportStore: Record<
    string,
    Partial<Record<MockReportKey, MockFavoriteReportState>>
  > = this.CreateInitialFavoriteStore();
  private readonly RoleChangeRequestsStore: MockRoleChangeRequest[] = [];
  private NextRoleChangeRequestId = 1;
  private NextCustomRoleSequence = 1;
  private NextCustomCategorySequence = 1;
  private NextUploadedReportSequence = 1;
  private readonly PermissionStore: Record<string, MockCategoryPermissionRecord> = this.CloneInitialPermissions();
  private SelectedReportKey: MockReportKey | null = null;
  private SelectedReportSearchCriteria: MockReportSearchCriteria | null = null;

  get IsEnabled(): boolean { return MockAuthenticationProvider.IsEnabled; }
  get Users(): readonly MockUser[] { return this.UsersStore.map((User) => this.ToReadModel(User)); }
  get RoleChangeRequests(): readonly MockRoleChangeRequest[] {
    return this.RoleChangeRequestsStore.map((Request) => ({ ...Request, PreviousRoles: [...Request.PreviousRoles], RequestedRoles: [...Request.RequestedRoles] }));
  }
  get AdminCount(): number { return this.UsersStore.filter((User) => User.Roles.includes('ADMIN')).length; }
  get Roles(): readonly MockRole[] { return this.RoleStore.map((Role) => ({ ...Role, ManagementPermissions: [...Role.ManagementPermissions] })); }
  get Reports(): readonly MockReportReadModel[] {
    return this.ReportStore.map((Report) => this.ToReportReadModel(Report));
  }

  GetCategories(): readonly MockReportCategory[] {
    return this.CategoryStore.map((Category) => ({ ...Category }));
  }

  GetCategoryUsageCount(CategoryId: string): number | null {
    return this.IsValidCategoryId(CategoryId)
      ? this.ReportStore.filter((Report) => Report.CategoryId === CategoryId)
          .length
      : null;
  }

  CreateCategory(CategoryName: string): MockCreateCategoryResult {
    const Name = CategoryName.trim();
    if (!Name) return { Status: 'invalid-name', Category: null };

    const ExistingCategory = this.GetStoredCategoryByName(Name);
    if (ExistingCategory?.IsSystemReserved) {
      return { Status: 'system-reserved-name', Category: null };
    }
    if (ExistingCategory) return { Status: 'duplicate-name', Category: null };

    const Category: MockReportCategory = {
      CategoryId: this.GetNextCustomCategoryId(),
      CategoryName: Name,
      IsSystemReserved: false,
    };
    this.CategoryStore.push(Category);
    return { Status: 'created', Category: { ...Category } };
  }

  RenameCategory(
    CategoryId: string,
    CategoryName: string,
  ): MockRenameCategoryResult {
    const Category = this.GetStoredCategory(CategoryId);
    if (!Category) return { Status: 'not-found', Category: null };
    if (Category.IsSystemReserved) {
      return { Status: 'system-reserved', Category: null };
    }

    const Name = CategoryName.trim();
    if (!Name) return { Status: 'invalid-name', Category: null };
    const ExistingCategory = this.GetStoredCategoryByName(Name);
    if (ExistingCategory && ExistingCategory.CategoryId !== CategoryId) {
      return { Status: 'duplicate-name', Category: null };
    }

    const CategoryIndex = this.CategoryStore.findIndex(
      (Entry) => Entry.CategoryId === CategoryId,
    );
    const RenamedCategory: MockReportCategory = {
      ...Category,
      CategoryName: Name,
    };
    this.CategoryStore[CategoryIndex] = RenamedCategory;
    return { Status: 'renamed', Category: { ...RenamedCategory } };
  }

  DeleteCategory(CategoryId: string): MockDeleteCategoryResult {
    const Category = this.GetStoredCategory(CategoryId);
    if (!Category) {
      return {
        Status: 'not-found',
        DeletedCategoryName: null,
        MovedReportCount: 0,
      };
    }
    if (Category.IsSystemReserved) {
      return {
        Status: 'system-reserved',
        DeletedCategoryName: null,
        MovedReportCount: 0,
      };
    }

    const MovedReports = this.ReportStore.filter(
      (Report) => Report.CategoryId === CategoryId,
    );
    if (MovedReports.length) {
      const Timestamp = this.GetTimestamp();
      this.ReportStore.forEach((Report, Index) => {
        if (Report.CategoryId !== CategoryId) return;
        this.ReportStore[Index] = {
          ...Report,
          CategoryId: SystemUncategorizedCategoryId,
          UpdatedAt: Timestamp,
        };
      });
    }

    Object.values(this.PermissionStore).forEach((Permissions) => {
      delete Permissions[CategoryId];
    });
    this.CategoryStore.splice(
      this.CategoryStore.findIndex((Entry) => Entry.CategoryId === CategoryId),
      1,
    );

    return {
      Status: 'deleted',
      DeletedCategoryName: Category.CategoryName,
      MovedReportCount: MovedReports.length,
    };
  }

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
    this.FavoriteReportStore[Draft.Account.trim()] = this.CreateEmptyFavoriteState();
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
      if (this.AdminCount <= this.MinimumAdminCount) return 'minimum-admins';
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
    if (this.UsersStore[UserIndex].Roles.includes('ADMIN') && this.AdminCount <= this.MinimumAdminCount) return 'minimum-admins';
    this.UsersStore.splice(UserIndex, 1);
    return 'deleted';
  }

  RespondToRoleChangeRequest(RequestId: number, ResponderAccount: string, Approve: boolean): MockRoleChangeResponseResult {
    const Request = this.RoleChangeRequestsStore.find((Entry) => Entry.Id === RequestId);
    if (!Request) return 'not-found';
    if (Request.Status !== 'Pending') return 'not-pending';
    if (Request.TargetAccount !== ResponderAccount) return 'not-target';
    if (Approve && Request.PreviousRoles.includes('ADMIN') && !Request.RequestedRoles.includes('ADMIN') && this.AdminCount <= this.MinimumAdminCount) return 'minimum-admins';
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
    this.PermissionStore[Key] = this.ToCategoryPermissionRecord(Draft.Permissions);
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
    this.SaveCategoryPermissions(RoleKey, Draft.Permissions);
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
    if (ReportIndex >= 0) {
      this.ReportStore[ReportIndex] = {
        ...this.ReportStore[ReportIndex],
        Enabled,
        UpdatedAt: this.GetTimestamp(),
      };
    }
  }

  GetReport(ReportKey: MockReportKey): MockReportReadModel | null {
    const Report = this.ReportStore.find((Entry) => Entry.ReportKey === ReportKey);
    return Report ? this.ToReportReadModel(Report) : null;
  }

  CreateReport(Draft: {
    ReportName: string;
    Description: string;
    CategoryId: string;
    Enabled: boolean;
    FileName: string;
  }): MockReportReadModel | null {
    const ReportName = Draft.ReportName.trim();
    const Description = Draft.Description.trim();
    const CategoryId = Draft.CategoryId.trim();
    const FileName = Draft.FileName.trim();
    if (!ReportName || !Description || !this.IsValidCategoryId(CategoryId) || !FileName) return null;
    const Timestamp = this.GetTimestamp();
    const Report: MockReport = {
      ReportKey: `UploadedReport${this.NextUploadedReportSequence++}` as MockReportKey,
      ReportName,
      CategoryId,
      Description,
      FileName,
      Enabled: Draft.Enabled,
      CreatedAt: Timestamp,
      UpdatedAt: Timestamp,
    };
    this.ReportStore.push(Report);
    return this.ToReportReadModel(Report);
  }

  UpdateReport(
    ReportKey: MockReportKey,
    Draft: {
      ReportName: string;
      Description: string;
      CategoryId: string;
      Enabled: boolean;
      FileName?: string;
    },
  ): boolean {
    const ReportIndex = this.ReportStore.findIndex((Report) => Report.ReportKey === ReportKey);
    if (
      ReportIndex < 0 ||
      !Draft.ReportName.trim() ||
      !Draft.Description.trim() ||
      !this.IsValidCategoryId(Draft.CategoryId.trim())
    ) {
      return false;
    }
    const Current = this.ReportStore[ReportIndex];
    this.ReportStore[ReportIndex] = {
      ...Current,
      ReportName: Draft.ReportName.trim(),
      Description: Draft.Description.trim(),
      CategoryId: Draft.CategoryId.trim(),
      Enabled: Draft.Enabled,
      FileName: Draft.FileName?.trim() || Current.FileName,
      UpdatedAt: this.GetTimestamp(),
    };
    return true;
  }

  DeleteReport(ReportKey: MockReportKey): boolean {
    const ReportIndex = this.ReportStore.findIndex((Report) => Report.ReportKey === ReportKey);
    if (ReportIndex < 0) return false;
    this.ReportStore.splice(ReportIndex, 1);
    if (this.SelectedReportKey === ReportKey) {
      this.SelectedReportKey = null;
      this.SelectedReportSearchCriteria = null;
    }
    return true;
  }

  GetAccessibleReports(Roles: readonly MockRoleKey[]): readonly MockReportReadModel[] {
    const NormalizedRoles = this.NormalizeRoles(Roles);
    return this.ReportStore
      .filter(
        (Report) =>
          Report.Enabled &&
          this.IsValidCategoryId(Report.CategoryId) &&
          (!this.IsSystemReservedCategory(Report.CategoryId) ||
            NormalizedRoles.includes('ADMIN')) &&
          this.GetEffectiveCategoryPermission(
            NormalizedRoles,
            Report.CategoryId,
          ).CanExecute,
      )
      .map((Report) => this.ToReportReadModel(Report));
  }

  GetFavoriteReports(
    Account: string,
    Roles: readonly MockRoleKey[],
  ): readonly MockFavoriteReport[] {
    const Favorites = this.FavoriteReportStore[Account] ?? {};
    return this.GetAccessibleReports(Roles)
      .filter((Report) => Favorites[Report.ReportKey]?.IsFavorite)
      .map((Report) => ({
        Report,
        FavoritedAt: Favorites[Report.ReportKey]?.FavoritedAt ?? null,
        LastUsedAt: Favorites[Report.ReportKey]?.LastUsedAt ?? null,
      }));
  }

  RemoveFavoriteReport(Account: string, ReportKey: MockReportKey): boolean {
    const Favorite = this.FavoriteReportStore[Account]?.[ReportKey];
    if (!Favorite?.IsFavorite) return false;
    Favorite.IsFavorite = false;
    return true;
  }

  IsFavoriteReport(Account: string, ReportKey: MockReportKey): boolean {
    return this.FavoriteReportStore[Account]?.[ReportKey]?.IsFavorite === true;
  }

  ToggleFavoriteReport(Account: string, ReportKey: MockReportKey): boolean {
    const Favorites =
      this.FavoriteReportStore[Account] ?? (this.FavoriteReportStore[Account] = {});
    const Favorite =
      Favorites[ReportKey] ??
      (Favorites[ReportKey] = {
        IsFavorite: false,
        FavoritedAt: null,
        LastUsedAt: null,
      });
    Favorite.IsFavorite = !Favorite.IsFavorite;
    if (Favorite.IsFavorite) Favorite.FavoritedAt = new Date().toISOString();
    return Favorite.IsFavorite;
  }

  RecordReportExecution(Account: string, ReportKey: MockReportKey): void {
    const Favorite = this.FavoriteReportStore[Account]?.[ReportKey];
    if (Favorite?.IsFavorite) Favorite.LastUsedAt = new Date().toISOString();
  }

  GetCategoryPermission(Role: MockRoleKey, CategoryId: string): MockCategoryPermission {
    if (
      !this.IsValidCategoryId(CategoryId) ||
      (this.IsSystemReservedCategory(CategoryId) && Role !== 'ADMIN')
    ) {
      return EmptyMockCategoryPermission();
    }
    if (Role === 'ADMIN') return FullMockCategoryPermission();
    return {
      ...(this.PermissionStore[Role]?.[CategoryId] ?? EmptyMockCategoryPermission()),
    };
  }

  GetEffectiveCategoryPermission(
    Roles: readonly MockRoleKey[],
    CategoryId: string,
  ): MockCategoryPermission {
    if (!this.IsValidCategoryId(CategoryId)) return EmptyMockCategoryPermission();
    return this.NormalizeRoles(Roles).reduce<MockCategoryPermission>((Effective, Role) => {
      const Permission = this.GetCategoryPermission(Role, CategoryId);
      return {
        CanExecute: Effective.CanExecute || Permission.CanExecute,
        CanExportPdf: Effective.CanExportPdf || Permission.CanExportPdf,
        CanPrint: Effective.CanPrint || Permission.CanPrint,
      };
    }, EmptyMockCategoryPermission());
  }

  GetCategoryPermissionEntries(Role: MockRoleKey): MockCategoryPermissionEntry[] {
    return this.GetPermissionCategories().map((Category) => ({
      CategoryId: Category.CategoryId,
      CategoryName: Category.CategoryName,
      Permission: this.GetCategoryPermission(Role, Category.CategoryId),
    }));
  }

  GetEmptyCategoryPermissionEntries(): MockCategoryPermissionEntry[] {
    return this.GetPermissionCategories().map((Category) => ({
      CategoryId: Category.CategoryId,
      CategoryName: Category.CategoryName,
      Permission: EmptyMockCategoryPermission(),
    }));
  }

  SaveCategoryPermissions(Role: MockRoleKey, Entries: readonly MockCategoryPermissionEntry[]): void {
    if (Role === 'ADMIN') return;
    this.PermissionStore[Role] = this.ToCategoryPermissionRecord(Entries);
  }

  GetRole(RoleKey: MockRoleKey): MockRole { return this.RoleStore.find((Role) => Role.Key === RoleKey)!; }
  HasManagementPermission(Role: MockRoleKey, Permission: MockManagementPermission): boolean { return this.GetRole(Role).ManagementPermissions.includes(Permission); }
  SelectReport(
    ReportKey: MockReportKey,
    SearchCriteria: MockReportSearchCriteria | null = null,
  ): void {
    this.SelectedReportKey = ReportKey;
    this.SelectedReportSearchCriteria = SearchCriteria ? { ...SearchCriteria } : null;
  }
  ClearSelectedReport(): void {
    this.SelectedReportKey = null;
    this.SelectedReportSearchCriteria = null;
  }
  GetSelectedReportSearchCriteria(): MockReportSearchCriteria | null {
    return this.SelectedReportSearchCriteria
      ? { ...this.SelectedReportSearchCriteria }
      : null;
  }
  GetSelectedReport(Roles: readonly MockRoleKey[]): MockReportReadModel | null {
    const Reports = this.GetAccessibleReports(Roles);
    return Reports.find((Report) => Report.ReportKey === this.SelectedReportKey) ?? null;
  }

  private NormalizePermission(Permission: MockCategoryPermission): MockCategoryPermission {
    return Permission.CanExecute ? { ...Permission } : EmptyMockCategoryPermission();
  }

  private CloneInitialPermissions(): Record<string, MockCategoryPermissionRecord> {
    return Object.fromEntries(
      Object.entries(InitialMockRoleCategoryPermissions).map(
        ([Role, Permissions]) => [
          Role,
          Object.fromEntries(
            Object.entries(Permissions)
              .filter(([CategoryId]) => this.IsValidCategoryId(CategoryId))
              .map(([CategoryId, Permission]) => [
                CategoryId,
                this.NormalizePermission(Permission),
              ]),
          ),
        ],
      ),
    ) as Record<string, MockCategoryPermissionRecord>;
  }

  private CreateInitialFavoriteStore(): Record<
    string,
    Partial<Record<MockReportKey, MockFavoriteReportState>>
  > {
    return Object.fromEntries(
      this.UsersStore.map((User) => [
        User.Account,
        this.CreateEmptyFavoriteState(),
      ]),
    ) as Record<
      string,
      Partial<Record<MockReportKey, MockFavoriteReportState>>
    >;
  }

  private CreateEmptyFavoriteState(): Partial<
    Record<MockReportKey, MockFavoriteReportState>
  > {
    return Object.fromEntries(
      this.ReportStore.map((Report) => [
        Report.ReportKey,
        { IsFavorite: false, FavoritedAt: null, LastUsedAt: null },
      ]),
    ) as Partial<Record<MockReportKey, MockFavoriteReportState>>;
  }

  private ToCategoryPermissionRecord(
    Entries: readonly MockCategoryPermissionEntry[],
  ): MockCategoryPermissionRecord {
    return Object.fromEntries(
      Entries
        .filter(
          (Entry) =>
            this.IsValidCategoryId(Entry.CategoryId) &&
            !this.IsSystemReservedCategory(Entry.CategoryId),
        )
        .map((Entry) => [
          Entry.CategoryId,
          this.NormalizePermission(Entry.Permission),
        ]),
    ) as MockCategoryPermissionRecord;
  }

  GetReportFilterCategories(
    Roles: readonly MockRoleKey[],
  ): readonly MockReportCategory[] {
    return this.CategoryStore.filter(
      (Category) =>
        !Category.IsSystemReserved &&
        this.GetEffectiveCategoryPermission(Roles, Category.CategoryId).CanExecute,
    ).map((Category) => ({ ...Category }));
  }

  GetReportManagementCategories(): readonly MockReportCategory[] {
    return this.GetCategories();
  }

  GetReportEditorCategories(
    CurrentCategoryId = '',
  ): readonly MockReportCategory[] {
    return this.CategoryStore.filter(
      (Category) =>
        !Category.IsSystemReserved || Category.CategoryId === CurrentCategoryId,
    ).map((Category) => ({ ...Category }));
  }

  private GetPermissionCategories(): readonly MockReportCategory[] {
    return this.CategoryStore.filter(
      (Category) => !Category.IsSystemReserved,
    );
  }

  private GetCategoryName(CategoryId: MockReportCategoryId): string {
    return this.GetStoredCategory(CategoryId)?.CategoryName ?? '未知分類';
  }

  private IsValidCategoryId(CategoryId: string): CategoryId is MockReportCategoryId {
    return this.GetStoredCategory(CategoryId) !== null;
  }

  private IsSystemReservedCategory(CategoryId: MockReportCategoryId): boolean {
    return this.GetStoredCategory(CategoryId)?.IsSystemReserved === true;
  }

  private GetStoredCategory(CategoryId: string): MockReportCategory | null {
    return (
      this.CategoryStore.find((Category) => Category.CategoryId === CategoryId) ??
      null
    );
  }

  private GetStoredCategoryByName(CategoryName: string): MockReportCategory | null {
    const NormalizedName = this.NormalizeCategoryName(CategoryName);
    return (
      this.CategoryStore.find(
        (Category) =>
          this.NormalizeCategoryName(Category.CategoryName) === NormalizedName,
      ) ?? null
    );
  }

  private GetNextCustomCategoryId(): MockReportCategoryId {
    let CategoryId = '';
    do {
      CategoryId = `CUSTOM_CATEGORY_${this.NextCustomCategorySequence++}`;
    } while (this.GetStoredCategory(CategoryId));
    return CategoryId;
  }

  private NormalizeCategoryName(CategoryName: string): string {
    return CategoryName.trim().toLocaleLowerCase('zh-Hant');
  }

  private ToReportReadModel(Report: MockReport): MockReportReadModel {
    return {
      ...Report,
      CategoryName: this.GetCategoryName(Report.CategoryId),
    };
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
