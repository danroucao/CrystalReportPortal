import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  MockCategoryPermissionEntry,
  MockManagementPermission,
  MockRole,
  MockRoleKey,
} from '../../mock/mock-permissions';
import { MockUser } from '../../mock/mock-users';
import { AuthService } from '../../services/auth.service';
import { MockAuditLogService } from '../../services/mock-audit-log.service';
import { MockNotificationCenterService } from '../../services/mock-notification-center.service';
import {
  MockCreatedUserCredentials,
  MockRbacService,
  MockRoleDraft,
  MockUserDraft,
  MockUserEditDraft,
} from '../../services/mock-rbac.service';
import { NotificationService } from '../../services/notification.service';
import { BoringAvatarComponent } from '../../shared/boring-avatar.component';
import { PortalPaginationComponent } from '../../shared/portal-pagination.component';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, finalize, switchMap } from 'rxjs';
import { UserManagementService } from '../../services/user-management.service';
import { ManagedRoleApiModel, ManagedUserApiModel } from '../../services/user-management-api.models';

type CreateUserField = 'Account' | 'DisplayName' | 'Roles';
type CreateUserValidationErrors = Partial<Record<CreateUserField, string>>;
type EditUserValidationErrors = Partial<Record<'Roles' | 'Form', string>>;

/**
 * Standalone implementation of the back-office user and role management UI.
 * The parent page remains responsible for route-level access and page chrome.
 */
@Component({
  selector: 'app-user-management-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BoringAvatarComponent,
    PortalPaginationComponent,
  ],
  templateUrl: './user-management-page.component.html',
  styleUrl: './user-management-page.component.scss',
})
export class UserManagementPageComponent implements AfterViewInit, OnDestroy, OnInit {
  readonly PaginationPageSize = 10;
  readonly Auth = inject(AuthService);
  readonly MockRbac = inject(MockRbacService);
  readonly Notifications = inject(NotificationService);
  readonly NotificationCenter = inject(MockNotificationCenterService);
  readonly AuditLog = inject(MockAuditLogService);
  private readonly UserManagementApi = inject(UserManagementService);

  ApiUsers: ManagedUserApiModel[] = [];
  ApiRoles: ManagedRoleApiModel[] = [];
  IsApiLoading = false;
  ApiLoadError = '';
  CreateEmployeeNo = '';
  CreateInitialPassword = '';

  ManagementNotice = '';
  UserSearchText = '';
  UserCurrentPage = 1;
  UserRoleFilter: MockRoleKey | null = null;
  UserDraft: MockUserDraft = this.CreateUserDraft();
  CreateUserValidationErrors: CreateUserValidationErrors = {};
  CreatedUserCredentials: MockCreatedUserCredentials | null = null;
  CreatedUserCopyNotice = '';
  EditingAccount: string | null = null;
  EditingUser: MockUserEditDraft | null = null;
  EditUserValidationErrors: EditUserValidationErrors = {};
  DeletingUser: MockUser | null = null;
  DeleteUserError = '';
  IsCreateUserDialogOpen = false;

  RoleCardHasOverflow = false;
  CanScrollRoleCardsLeft = false;
  CanScrollRoleCardsRight = false;
  IsRoleCardAtStart = true;
  IsRoleCardAtEnd = true;
  IsCreateRoleDialogOpen = false;
  ReturnToCreateUserAfterRole = false;
  IsEditRoleDialogOpen = false;
  EditingRoleKey: MockRoleKey | null = null;
  DeletingRole: MockRole | null = null;
  RoleDraft: MockRoleDraft = this.CreateRoleDraft();
  RoleDraftError = '';

  @ViewChild('roleCardViewport')
  private roleCardViewport?: ElementRef<HTMLElement>;
  @ViewChild('activeModal')
  private activeModal?: ElementRef<HTMLElement>;

  private roleCardResizeObserver?: ResizeObserver;
  private modalOpener: HTMLElement | null = null;
  private pendingFocus: HTMLElement | null = null;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.Auth.CanOperateBackOffice) {
      this.LoadApiManagementData();
    }
  }

  LoadApiManagementData(): void {
    this.IsApiLoading = true;
    this.ApiLoadError = '';
    forkJoin({
      users: this.UserManagementApi.getUsers(),
      roles: this.UserManagementApi.getRoles(),
    }).pipe(finalize(() => (this.IsApiLoading = false))).subscribe({
      next: ({ users, roles }) => {
        this.ApiUsers = users;
        this.ApiRoles = roles;
      },
      error: (error: unknown) => {
        this.ApiLoadError = this.ApiErrorMessage(error);
      },
    });
  }

  get DisplayUsers(): readonly MockUser[] {
    return this.ApiUsers.map((user) => ({
      Account: user.account,
      DisplayName: user.userName,
      Roles: [...user.roleCodes],
      Enabled: user.isEnabled,
      CreatedAt: '',
      UpdatedAt: '',
    }));
  }

  get DisplayRoles(): readonly MockRole[] {
    return this.ApiRoles.map((role) => ({
      Key: role.roleCode,
      DisplayName: role.roleName,
      Description: role.description ?? '',
      ManagementPermissions: this.ToMockManagementPermissions(role.permissionCodes),
    }));
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined' && this.roleCardViewport) {
      this.roleCardResizeObserver = new ResizeObserver(() =>
        this.UpdateRoleCardNavigation(),
      );
      this.roleCardResizeObserver.observe(this.roleCardViewport.nativeElement);
    }
    this.ScheduleRoleCardNavigationUpdate();
  }

  ngOnDestroy(): void {
    this.roleCardResizeObserver?.disconnect();
    if (this.focusTimer) clearTimeout(this.focusTimer);
  }

  get FilteredUsers(): readonly MockUser[] {
    const search = this.UserSearchText.trim().toLowerCase();
    return this.DisplayUsers.filter(
      (user) =>
        (!this.UserRoleFilter || user.Roles.includes(this.UserRoleFilter)) &&
        (!search || `${user.Account} ${user.DisplayName}`.toLowerCase().includes(search)),
    );
  }

  get UserTotalPages(): number {
    return this.GetTotalPages(this.FilteredUsers.length);
  }

  get UserPageNumbers(): readonly number[] {
    return Array.from({ length: this.UserTotalPages }, (_, index) => index + 1);
  }

  get PagedUsers(): readonly MockUser[] {
    const start = (this.UserCurrentPage - 1) * this.PaginationPageSize;
    return this.FilteredUsers.slice(start, start + this.PaginationPageSize);
  }

  GetRoleAvatarUsers(roleKey: MockRoleKey): readonly MockUser[] {
    return this.DisplayUsers.filter((user) => user.Roles.includes(roleKey)).slice(0, 4);
  }

  GetApiRoleUserCount(roleKey: MockRoleKey): number {
    return this.DisplayUsers.filter((user) => user.Roles.includes(roleKey)).length;
  }

  OnUserSearchChange(): void {
    this.UserCurrentPage = 1;
  }

  SetUserRoleFilter(roleKey: MockRoleKey | null): void {
    this.UserRoleFilter = roleKey;
    this.UserCurrentPage = 1;
  }

  GoToUserPage(page: number): void {
    this.UserCurrentPage = this.ClampUserPage(page);
  }

  GetRoleNames(roles: readonly MockRoleKey[]): string {
    return roles
      .map((roleKey) =>
        this.ApiRoles.find((role) => role.roleCode === roleKey)?.roleName ??
        this.MockRbac.GetRole(roleKey)?.DisplayName ??
        roleKey,
      )
      .join('、');
  }

  EditUser(account: string): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const user = this.DisplayUsers.find((entry) => entry.Account === account);
    if (!user) return;
    this.RememberModalOpener();
    this.EditingAccount = user.Account;
    this.EditingUser = { Roles: [...user.Roles], Enabled: user.Enabled };
    this.EditUserValidationErrors = {};
    this.FocusModalSoon();
  }

  OpenCreateUserDialog(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.RememberModalOpener();
    this.UserDraft = this.CreateUserDraft();
    this.CreateEmployeeNo = '';
    this.CreateInitialPassword = this.GenerateInitialPassword();
    this.CreateUserValidationErrors = {};
    this.IsCreateUserDialogOpen = true;
    this.IsCreateRoleDialogOpen = false;
    this.FocusModalSoon();
  }

  CloseCreateUserDialog(): void {
    this.IsCreateUserDialogOpen = false;
    this.UserDraft = this.CreateUserDraft();
    this.CreateUserValidationErrors = {};
    this.CreateEmployeeNo = '';
    this.CreateInitialPassword = '';
    this.RestoreModalFocus();
  }

  SaveUser(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.CreateUserValidationErrors = this.GetCreateUserValidationErrors();
    if (Object.keys(this.CreateUserValidationErrors).length) return;
    this.UserManagementApi.createUser({
      employeeNo: this.CreateEmployeeNo.trim(),
      account: this.UserDraft.Account.trim(),
      userName: this.UserDraft.DisplayName.trim(),
      initialPassword: this.CreateInitialPassword,
      roleCodes: [...this.UserDraft.Roles],
      isEnabled: this.UserDraft.Enabled,
    }).subscribe({
      next: (user) => {
        this.IsCreateUserDialogOpen = false;
        this.CreatedUserCredentials = {
          Account: user.account,
          InitialPassword: this.CreateInitialPassword,
        };
        this.CreatedUserCopyNotice = '';
        this.AuditLog.RecordBackOfficeAction('新增使用者', `建立前台使用者 ${user.account}。`);
        this.LoadApiManagementData();
        this.FocusModalSoon();
      },
      error: (error: unknown) => {
        this.CreateUserValidationErrors = { Account: this.ApiErrorMessage(error) };
      },
    });
  }

  CloseCreatedUserSuccessModal(): void {
    this.CreatedUserCredentials = null;
    this.CreatedUserCopyNotice = '';
    this.RestoreModalFocus();
  }

  async CopyCreatedUserCredentials(): Promise<void> {
    if (!this.CreatedUserCredentials) return;
    const value = `帳號：${this.CreatedUserCredentials.Account}\n初始密碼：${this.CreatedUserCredentials.InitialPassword}`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else if (!this.CopyTextWithFallback(value)) throw new Error('Clipboard unavailable');
      this.CreatedUserCopyNotice = '帳號與初始密碼已複製。';
    } catch {
      this.CreatedUserCopyNotice = '無法自動複製，請手動複製帳密。';
    }
  }

  ToggleCreateUserRole(roleKey: MockRoleKey, selected: boolean): void {
    this.ToggleUserRole(this.UserDraft, roleKey, selected);
    delete this.CreateUserValidationErrors.Roles;
  }

  ClearCreateUserValidationError(field: CreateUserField): void {
    delete this.CreateUserValidationErrors[field];
  }

  ToggleEditingUserRole(roleKey: MockRoleKey, selected: boolean): void {
    if (!this.EditingUser || !this.Auth.CanOperateBackOffice) return;
    this.ToggleUserRole(this.EditingUser, roleKey, selected);
    delete this.EditUserValidationErrors.Roles;
  }

  SaveEditedUser(): void {
    if (!this.Auth.CanOperateBackOffice || !this.EditingAccount || !this.EditingUser) return;
    if (!this.EditingUser.Roles.length) {
      this.EditUserValidationErrors = { Roles: '請至少選擇一個角色。' };
      return;
    }
    const apiUser = this.ApiUsers.find((user) => user.account === this.EditingAccount);
    if (!apiUser) {
      this.EditUserValidationErrors = { Form: '找不到要編輯的使用者。' };
      return;
    }
    forkJoin({
      roles: this.UserManagementApi.updateUserRoles(apiUser.userId, { roleCodes: [...this.EditingUser.Roles] }),
      user: this.UserManagementApi.updateUser(apiUser.userId, {
        employeeNo: apiUser.employeeNo,
        account: apiUser.account,
        userName: apiUser.userName,
        isEnabled: this.EditingUser.Enabled,
      }),
    }).subscribe({
      next: () => {
        this.AuditLog.RecordBackOfficeAction('更新使用者權限', `更新前台使用者 ${this.EditingAccount} 的角色或啟用狀態。`);
        this.CancelEditUser();
        this.LoadApiManagementData();
        this.Notifications.ShowSuccess('使用者資料已更新。');
      },
      error: (error: unknown) => (this.EditUserValidationErrors = { Form: this.ApiErrorMessage(error) }),
    });
  }

  CancelEditUser(): void {
    this.EditingAccount = null;
    this.EditingUser = null;
    this.EditUserValidationErrors = {};
    this.RestoreModalFocus();
  }

  OpenDeleteUserDialog(account: string): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const user = this.DisplayUsers.find((entry) => entry.Account === account);
    if (!user) return;
    this.RememberModalOpener();
    this.DeletingUser = user;
    this.DeleteUserError = '';
    this.FocusModalSoon();
  }

  CloseDeleteUserDialog(): void {
    this.DeletingUser = null;
    this.DeleteUserError = '';
    this.RestoreModalFocus();
  }

  ConfirmDeleteUser(): void {
    if (!this.Auth.CanOperateBackOffice || !this.DeletingUser) return;
    const account = this.DeletingUser.Account;
    const apiUser = this.ApiUsers.find((user) => user.account === account);
    if (!apiUser) {
      this.DeleteUserError = '找不到要刪除的使用者。';
      return;
    }
    this.UserManagementApi.deleteUser(apiUser.userId).subscribe({
      next: () => {
        this.AuditLog.RecordBackOfficeAction('刪除使用者', `刪除前台使用者 ${account}。`);
        this.CloseDeleteUserDialog();
        this.LoadApiManagementData();
        this.Notifications.ShowSuccess('使用者已刪除。');
      },
      error: (error: unknown) => (this.DeleteUserError = this.ApiErrorMessage(error)),
    });
  }

  SetUserEnabled(account: string, enabled: boolean): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const user = this.ApiUsers.find((entry) => entry.account === account);
    if (!user) return;
    this.UserManagementApi.updateUser(user.userId, {
      employeeNo: user.employeeNo,
      account: user.account,
      userName: user.userName,
      isEnabled: enabled,
    }).subscribe({
      next: () => this.LoadApiManagementData(),
      error: (error: unknown) => (this.ManagementNotice = this.ApiErrorMessage(error)),
    });
  }

  OpenCreateRoleDialog(): void {
    this.OpenCreateRoleDialogFrom(false);
  }

  OpenCreateRoleDialogFromUser(): void {
    this.OpenCreateRoleDialogFrom(true);
  }

  private OpenCreateRoleDialogFrom(returnToUser: boolean): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.RememberModalOpener();
    this.ReturnToCreateUserAfterRole = returnToUser;
    this.RoleDraft = this.CreateRoleDraft();
    this.RoleDraftError = '';
    this.IsCreateRoleDialogOpen = true;
    this.IsCreateUserDialogOpen = false;
    this.FocusModalSoon();
  }

  CloseCreateRoleDialog(): void {
    this.IsCreateRoleDialogOpen = false;
    this.RoleDraft = this.CreateRoleDraft();
    this.RoleDraftError = '';
    this.ReturnToCreateUserAfterRole = false;
    this.RestoreModalFocus();
  }

  OpenEditRoleDialog(roleKey: MockRoleKey): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const role = this.DisplayRoles.find((entry) => entry.Key === roleKey);
    if (!role) return;
    this.RememberModalOpener();
    this.EditingRoleKey = role.Key;
    this.RoleDraft = {
      DisplayName: role.DisplayName,
      ManagementPermissions: [...role.ManagementPermissions],
      Permissions: this.MockRbac.GetCategoryPermissionEntries(role.Key),
    };
    this.RoleDraftError = '';
    this.IsEditRoleDialogOpen = true;
    this.FocusModalSoon();
  }

  CloseEditRoleDialog(): void {
    this.IsEditRoleDialogOpen = false;
    this.EditingRoleKey = null;
    this.DeletingRole = null;
    this.RoleDraft = this.CreateRoleDraft();
    this.RoleDraftError = '';
    this.RestoreModalFocus();
  }

  SaveRole(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const name = this.RoleDraft.DisplayName.trim();
    if (!name) return this.SetRoleDraftError('請輸入角色名稱。');
    if (this.DisplayRoles.some((role) => role.DisplayName === name)) {
      return this.SetRoleDraftError('角色名稱已存在，請輸入未重複的角色名稱。');
    }
    if (!this.HasAnyRolePermission()) return this.SetRoleDraftError('請至少勾選一個權限。');
    const roleCode = `CUSTOM_${Date.now()}`;
    this.UserManagementApi.createRole({
      roleCode,
      roleName: name,
      description: this.RoleDraft.DisplayName,
      isEnabled: true,
    }).subscribe({
      next: (role) => {
        this.IsCreateRoleDialogOpen = false;
        this.AuditLog.RecordBackOfficeAction('新增角色', `建立角色 ${name}。`);
        this.LoadApiManagementData();
        if (this.ReturnToCreateUserAfterRole) {
          this.IsCreateUserDialogOpen = true;
        }
        this.ReturnToCreateUserAfterRole = false;
        this.ScheduleRoleCardNavigationUpdate();
        this.RestoreModalFocus();
        this.Notifications.ShowSuccess(`新增角色「${name}」成功。`);
      },
      error: (error: unknown) => this.SetRoleDraftError(this.ApiErrorMessage(error)),
    });
  }

  SaveEditedRole(): void {
    if (!this.Auth.CanOperateBackOffice || !this.EditingRoleKey) return;
    const apiRole = this.ApiRoles.find((role) => role.roleCode === this.EditingRoleKey);
    if (!apiRole) {
      this.SetRoleDraftError('找不到要編輯的角色。');
      return;
    }
    const displayName = this.RoleDraft.DisplayName.trim();
    if (!displayName) {
      this.SetRoleDraftError('請輸入角色名稱。');
      return;
    }
    this.UserManagementApi.updateRole(apiRole.roleId, {
      roleName: displayName,
      description: apiRole.description,
      isEnabled: apiRole.isEnabled,
    }).pipe(
      switchMap(() => this.UserManagementApi.updateRolePermissions(
        apiRole.roleId,
        { permissionCodes: this.GetApiPermissionCodes() },
      )),
    ).subscribe({
      next: () => {
        this.CloseEditRoleDialog();
        this.LoadApiManagementData();
        this.Notifications.ShowSuccess(`角色「${displayName}」已更新。`);
      },
      error: (error: unknown) => this.SetRoleDraftError(this.ApiErrorMessage(error)),
    });
  }

  OpenDeleteRoleDialog(): void {
    if (!this.Auth.CanOperateBackOffice || !this.EditingRoleKey) return;
    const role = this.DisplayRoles.find((entry) => entry.Key === this.EditingRoleKey);
    if (!role) return;
    if (this.GetApiRoleUserCount(role.Key) > 0) {
      this.SetRoleDraftError('此角色仍有使用者使用，請先移除使用者的角色後再刪除。');
      return;
    }
    this.DeletingRole = role;
    this.FocusModalSoon();
  }

  CloseDeleteRoleDialog(): void {
    this.DeletingRole = null;
    this.FocusModalSoon();
  }

  ConfirmDeleteRole(): void {
    if (!this.Auth.CanOperateBackOffice || !this.DeletingRole) return;
    const role = this.DeletingRole;
    const apiRole = this.ApiRoles.find((entry) => entry.roleCode === role.Key);
    if (!apiRole) {
      this.SetRoleDraftError('找不到要刪除的角色。');
      return;
    }
    this.UserManagementApi.deleteRole(apiRole.roleId).subscribe({
      next: () => {
        if (this.UserRoleFilter === role.Key) this.UserRoleFilter = null;
        this.AuditLog.RecordBackOfficeAction('刪除角色', `刪除角色 ${role.DisplayName}。`);
        this.CloseEditRoleDialog();
        this.LoadApiManagementData();
        this.ScheduleRoleCardNavigationUpdate();
        this.Notifications.ShowSuccess(`角色「${role.DisplayName}」已刪除。`);
      },
      error: (error: unknown) => this.SetRoleDraftError(this.ApiErrorMessage(error)),
    });
  }

  ClearRoleDraftError(): void { this.RoleDraftError = ''; }

  ToggleManagementPermission(permission: MockManagementPermission, enabled: boolean): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.RoleDraft.ManagementPermissions = enabled
      ? [...new Set([...this.RoleDraft.ManagementPermissions, permission])]
      : this.RoleDraft.ManagementPermissions.filter((value) => value !== permission);
  }

  private GetApiPermissionCodes(): string[] {
    const codes: string[] = [];
    if (this.RoleDraft.ManagementPermissions.includes('RptManagement')) {
      codes.push(
        'Report.Upload',
        'Report.Maintain',
        'Report.SetParameters',
        'Report.EnableDisable',
      );
    }
    if (this.RoleDraft.ManagementPermissions.includes('DatabaseConnection')) {
      codes.push('DataSource.Manage');
    }
    if (this.RoleDraft.ManagementPermissions.includes('OperationLog')) {
      codes.push('AuditLog.View');
    }
    return codes;
  }

  SetPermissionCanExecute(entry: MockCategoryPermissionEntry, enabled: boolean): void {
    if (!this.Auth.CanOperateBackOffice) return;
    entry.Permission.CanExecute = enabled;
    if (!enabled) {
      entry.Permission.CanExport = false;
      entry.Permission.CanPrint = false;
    }
  }

  ScrollRoleCards(direction: -1 | 1): void {
    const viewport = this.roleCardViewport?.nativeElement;
    if (!viewport || (direction === -1 && !this.CanScrollRoleCardsLeft) || (direction === 1 && !this.CanScrollRoleCardsRight)) return;
    viewport.scrollBy({ left: direction * Math.max(viewport.clientWidth * 0.8, 240), behavior: 'smooth' });
    window.setTimeout(() => this.UpdateRoleCardNavigation(), 250);
  }

  UpdateRoleCardNavigation(): void {
    const viewport = this.roleCardViewport?.nativeElement;
    if (!viewport) return this.SetRoleNavigationState(false, true, true);
    this.RoleCardHasOverflow = viewport.scrollWidth > viewport.clientWidth;
    if (!this.RoleCardHasOverflow) {
      viewport.scrollLeft = 0;
      this.SetRoleNavigationState(false, true, true);
      return;
    }
    const atStart = viewport.scrollLeft <= 2;
    const atEnd = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 2;
    this.SetRoleNavigationState(true, atStart, atEnd);
  }

  TrackUserByAccount(_: number, user: { Account: string }): string { return user.Account; }
  TrackRoleByKey(_: number, role: MockRole): MockRoleKey { return role.Key; }
  TrackByCategoryPermissionEntry(_: number, entry: MockCategoryPermissionEntry): string { return entry.CategoryId; }

  @HostListener('document:keydown.escape')
  CloseTopModalOnEscape(): void {
    if (this.DeletingRole) this.CloseDeleteRoleDialog();
    else if (this.DeletingUser) this.CloseDeleteUserDialog();
    else if (this.CreatedUserCredentials) this.CloseCreatedUserSuccessModal();
    else if (this.EditingUser) this.CancelEditUser();
    else if (this.IsCreateUserDialogOpen) this.CloseCreateUserDialog();
    else if (this.IsEditRoleDialogOpen) this.CloseEditRoleDialog();
    else if (this.IsCreateRoleDialogOpen) this.CloseCreateRoleDialog();
  }

  @HostListener('document:keydown', ['$event'])
  KeepFocusInTopModal(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const dialog = this.activeModal?.nativeElement;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  private CreateUserDraft(): MockUserDraft { return { Account: '', DisplayName: '', Roles: [], Enabled: false }; }
  private CreateRoleDraft(): MockRoleDraft { return { DisplayName: '', ManagementPermissions: [], Permissions: this.MockRbac.GetEmptyCategoryPermissionEntries() }; }
  private ToggleUserRole(draft: MockUserDraft | MockUserEditDraft, roleKey: MockRoleKey, selected: boolean): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const availableRoleKeys = new Set(this.DisplayRoles.map((role) => role.Key));
    draft.Roles = selected
      ? [...new Set([...draft.Roles, roleKey])].filter((key) => availableRoleKeys.has(key))
      : draft.Roles.filter((key) => key !== roleKey);
  }
  private GetCreateUserValidationErrors(): CreateUserValidationErrors {
    const errors: CreateUserValidationErrors = {};
    if (!this.UserDraft.Account.trim()) errors.Account = '請輸入使用者帳號。';
    else if (this.ApiUsers.some((user) => user.account === this.UserDraft.Account.trim())) errors.Account = '此使用者帳號已存在。';
    if (!this.CreateEmployeeNo.trim()) errors.Account = '請輸入員工編號。';
    if (!this.CreateInitialPassword || this.CreateInitialPassword.length < 8) errors.Account = '初始密碼至少需要 8 個字元。';
    if (!this.UserDraft.DisplayName.trim()) errors.DisplayName = '請輸入使用者名稱。';
    if (!this.UserDraft.Roles.length) errors.Roles = '請至少選擇一個角色。';
    return errors;
  }
  private GenerateInitialPassword(): string { return `Temp${Math.random().toString(36).slice(2, 8)}1`; }
  private ApiErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') return error.error.message;
    return '後台服務暫時無法使用，請稍後再試。';
  }
  private ToMockManagementPermissions(codes: readonly string[]): MockManagementPermission[] {
    const permissions: MockManagementPermission[] = [];
    if (codes.some((code) => code.startsWith('Report.'))) permissions.push('RptManagement');
    if (codes.includes('DataSource.Manage')) permissions.push('DatabaseConnection');
    if (codes.includes('AuditLog.View')) permissions.push('OperationLog');
    return permissions;
  }
  private GetTotalPages(count: number): number { return Math.max(1, Math.ceil(count / this.PaginationPageSize)); }
  private ClampUserPage(page: number): number { return Math.min(Math.max(1, page), this.UserTotalPages); }
  private EnsureUserPagination(): void { this.UserCurrentPage = this.ClampUserPage(this.UserCurrentPage); }
  private HasAnyRolePermission(): boolean { return this.RoleDraft.ManagementPermissions.length > 0 || this.RoleDraft.Permissions.some((entry) => entry.Permission.CanExecute || entry.Permission.CanExport || entry.Permission.CanPrint); }
  private SetRoleDraftError(message: string): void { this.RoleDraftError = message; }
  private SetRoleNavigationState(hasOverflow: boolean, atStart: boolean, atEnd: boolean): void {
    this.RoleCardHasOverflow = hasOverflow;
    this.IsRoleCardAtStart = atStart;
    this.IsRoleCardAtEnd = atEnd;
    this.CanScrollRoleCardsLeft = hasOverflow && !atStart;
    this.CanScrollRoleCardsRight = hasOverflow && !atEnd;
  }
  private ScheduleRoleCardNavigationUpdate(): void { window.setTimeout(() => this.UpdateRoleCardNavigation()); }
  private RememberModalOpener(): void { this.modalOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null; }
  private FocusModalSoon(): void {
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => this.activeModal?.nativeElement.focus());
  }
  private RestoreModalFocus(): void {
    this.pendingFocus = this.modalOpener;
    this.modalOpener = null;
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => this.pendingFocus?.focus());
  }
  private CopyTextWithFallback(value: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }
}
