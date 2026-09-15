import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
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
export class UserManagementPageComponent implements AfterViewInit, OnDestroy {
  readonly PaginationPageSize = 10;
  readonly Auth = inject(AuthService);
  readonly MockRbac = inject(MockRbacService);
  readonly Notifications = inject(NotificationService);
  readonly NotificationCenter = inject(MockNotificationCenterService);
  readonly AuditLog = inject(MockAuditLogService);

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
    return this.MockRbac.Users.filter(
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
    return this.MockRbac.Users.filter((user) => user.Roles.includes(roleKey)).slice(0, 4);
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
      .map((roleKey) => this.MockRbac.GetRole(roleKey)?.DisplayName ?? roleKey)
      .join('、');
  }

  EditUser(account: string): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const user = this.MockRbac.GetUser(account);
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
    this.CreateUserValidationErrors = {};
    this.IsCreateUserDialogOpen = true;
    this.FocusModalSoon();
  }

  CloseCreateUserDialog(): void {
    this.IsCreateUserDialogOpen = false;
    this.UserDraft = this.CreateUserDraft();
    this.CreateUserValidationErrors = {};
    this.RestoreModalFocus();
  }

  SaveUser(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.CreateUserValidationErrors = this.GetCreateUserValidationErrors();
    if (Object.keys(this.CreateUserValidationErrors).length) return;
    const credentials = this.MockRbac.CreateUser(this.UserDraft);
    if (!credentials) {
      this.CreateUserValidationErrors = { Account: '使用者帳號已存在。' };
      return;
    }
    this.EnsureUserPagination();
    this.IsCreateUserDialogOpen = false;
    this.CreatedUserCredentials = credentials;
    this.CreatedUserCopyNotice = '';
    this.AuditLog.RecordBackOfficeAction('新增使用者', `建立前台使用者 ${credentials.Account}。`);
    this.FocusModalSoon();
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
    const before = this.NotificationCenter.CaptureAccess(this.EditingAccount);
    const result = this.MockRbac.SaveUserEdit(this.EditingAccount, this.EditingUser);
    if (result === 'invalid') {
      this.EditUserValidationErrors = { Roles: '請至少選擇一個角色。' };
      return;
    }
    if (result === 'not-found') {
      this.EditUserValidationErrors = { Form: '找不到要編輯的使用者。' };
      return;
    }
    this.EnsureUserPagination();
    this.NotificationCenter.NotifyRoleAssignmentChange(this.EditingAccount, before);
    this.AuditLog.RecordBackOfficeAction('更新使用者權限', `更新前台使用者 ${this.EditingAccount} 的角色或啟用狀態。`);
    this.CancelEditUser();
    this.Notifications.ShowSuccess('使用者資料已更新。');
  }

  CancelEditUser(): void {
    this.EditingAccount = null;
    this.EditingUser = null;
    this.EditUserValidationErrors = {};
    this.RestoreModalFocus();
  }

  OpenDeleteUserDialog(account: string): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const user = this.MockRbac.GetUser(account);
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
    if (this.MockRbac.DeleteUser(account) !== 'deleted') {
      this.DeleteUserError = '找不到要刪除的使用者。';
      return;
    }
    this.EnsureUserPagination();
    this.AuditLog.RecordBackOfficeAction('刪除使用者', `刪除前台使用者 ${account}。`);
    this.CloseDeleteUserDialog();
    this.Notifications.ShowSuccess('使用者已刪除。');
  }

  SetUserEnabled(account: string, enabled: boolean): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.MockRbac.SetUserEnabled(account, enabled);
  }

  OpenCreateRoleDialog(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.RememberModalOpener();
    this.RoleDraft = this.CreateRoleDraft();
    this.RoleDraftError = '';
    this.IsCreateRoleDialogOpen = true;
    this.FocusModalSoon();
  }

  CloseCreateRoleDialog(): void {
    this.IsCreateRoleDialogOpen = false;
    this.RoleDraft = this.CreateRoleDraft();
    this.RoleDraftError = '';
    this.RestoreModalFocus();
  }

  OpenEditRoleDialog(roleKey: MockRoleKey): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const role = this.MockRbac.GetRole(roleKey);
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
    if (this.MockRbac.Roles.some((role) => role.DisplayName === name)) {
      return this.SetRoleDraftError('角色名稱已存在，請輸入未重複的角色名稱。');
    }
    if (!this.HasAnyRolePermission()) return this.SetRoleDraftError('請至少勾選一個權限。');
    const role = this.MockRbac.CreateRole(this.RoleDraft);
    if (!role) return this.SetRoleDraftError('角色名稱已存在，請輸入未重複的角色名稱。');
    this.IsCreateRoleDialogOpen = false;
    this.AuditLog.RecordBackOfficeAction('新增角色', `建立角色 ${role.DisplayName}。`);
    this.ScheduleRoleCardNavigationUpdate();
    this.RestoreModalFocus();
    this.Notifications.ShowSuccess(`新增角色「${role.DisplayName}」成功。`);
  }

  SaveEditedRole(): void {
    if (!this.Auth.CanOperateBackOffice || !this.EditingRoleKey) return;
    const before = this.NotificationCenter.CaptureRoleUsers(this.EditingRoleKey);
    const result = this.MockRbac.UpdateRole(this.EditingRoleKey, this.RoleDraft);
    if (result !== 'updated') {
      const messages: Record<Exclude<typeof result, 'updated'>, string> = {
        invalid: '請輸入角色名稱。',
        'duplicate-name': '角色名稱已存在，請使用其他名稱。',
        'not-found': '找不到要編輯的角色。',
      };
      this.SetRoleDraftError(messages[result]);
      return;
    }
    const displayName = this.MockRbac.GetRole(this.EditingRoleKey)?.DisplayName ?? this.RoleDraft.DisplayName;
    this.NotificationCenter.NotifyRoleDefinitionChange(this.EditingRoleKey, before);
    this.AuditLog.RecordBackOfficeAction('更新角色權限', `更新角色 ${displayName} 的功能或報表分類權限。`);
    this.CloseEditRoleDialog();
    this.Notifications.ShowSuccess(`角色「${displayName}」已更新。`);
  }

  OpenDeleteRoleDialog(): void {
    if (!this.Auth.CanOperateBackOffice || !this.EditingRoleKey) return;
    const role = this.MockRbac.GetRole(this.EditingRoleKey);
    if (!role) return;
    if (this.MockRbac.GetRoleUserCount(role.Key) > 0) {
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
    const result = this.MockRbac.DeleteRole(role.Key);
    if (result !== 'deleted') {
      this.SetRoleDraftError(result === 'role-in-use' ? '此角色仍有使用者使用，請先移除使用者的角色後再刪除。' : '找不到要刪除的角色。');
      this.CloseDeleteRoleDialog();
      return;
    }
    if (this.UserRoleFilter === role.Key) this.UserRoleFilter = null;
    this.AuditLog.RecordBackOfficeAction('刪除角色', `刪除角色 ${role.DisplayName}。`);
    this.CloseEditRoleDialog();
    this.ScheduleRoleCardNavigationUpdate();
    this.Notifications.ShowSuccess(`角色「${role.DisplayName}」已刪除。`);
  }

  ClearRoleDraftError(): void { this.RoleDraftError = ''; }

  ToggleManagementPermission(permission: MockManagementPermission, enabled: boolean): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.RoleDraft.ManagementPermissions = enabled
      ? [...new Set([...this.RoleDraft.ManagementPermissions, permission])]
      : this.RoleDraft.ManagementPermissions.filter((value) => value !== permission);
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
    draft.Roles = selected ? this.MockRbac.NormalizeRoles([...draft.Roles, roleKey]) : draft.Roles.filter((key) => key !== roleKey);
  }
  private GetCreateUserValidationErrors(): CreateUserValidationErrors {
    const errors: CreateUserValidationErrors = {};
    if (!this.UserDraft.Account.trim()) errors.Account = '請輸入使用者帳號。';
    else if (this.MockRbac.GetUser(this.UserDraft.Account.trim())) errors.Account = '此使用者帳號已存在。';
    if (!this.UserDraft.DisplayName.trim()) errors.DisplayName = '請輸入使用者名稱。';
    if (!this.UserDraft.Roles.length) errors.Roles = '請至少選擇一個角色。';
    return errors;
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
