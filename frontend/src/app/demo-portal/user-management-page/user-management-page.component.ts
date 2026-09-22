import { CommonModule } from '@angular/common';
import {
  AfterRenderPhase,
  Component,
  ElementRef,
  HostListener,
  Injector,
  ViewChild,
  afterNextRender,
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
  MockRbacService,
  MockRoleDraft,
  MockUserEditDraft,
} from '../../services/mock-rbac.service';
import { NotificationService } from '../../services/notification.service';
import { BoringAvatarComponent } from '../../shared/boring-avatar.component';
import { PortalPaginationComponent } from '../../shared/portal-pagination.component';
import { PortalTab, PortalTabsComponent } from '../../shared/portal-tabs.component';

type EditUserValidationErrors = Partial<Record<'Roles' | 'Form', string>>;

@Component({
  selector: 'app-user-management-page',
  standalone: true,
  imports: [CommonModule, FormsModule, BoringAvatarComponent, PortalPaginationComponent, PortalTabsComponent],
  templateUrl: './user-management-page.component.html',
  styleUrl: './user-management-page.component.scss',
})
export class UserManagementPageComponent {
  readonly PaginationPageSize = 10;
  readonly Auth = inject(AuthService);
  readonly MockRbac = inject(MockRbacService);
  readonly Notifications = inject(NotificationService);
  readonly NotificationCenter = inject(MockNotificationCenterService);
  readonly AuditLog = inject(MockAuditLogService);
  private readonly injector = inject(Injector);

  UserSearchText = '';
  UserCurrentPage = 1;
  UserRoleFilter: MockRoleKey | null = null;
  EditingAccount: string | null = null;
  EditingUser: MockUserEditDraft | null = null;
  EditUserValidationErrors: EditUserValidationErrors = {};

  IsCreateRoleDialogOpen = false;
  IsEditRoleDialogOpen = false;
  EditingRoleKey: MockRoleKey | null = null;
  DeletingRole: MockRole | null = null;
  RoleDraft: MockRoleDraft = this.CreateRoleDraft();
  RoleDraftError = '';
  IsReportManagementExpanded = true;
  IsOperationLogExpanded = true;
  RoleCardHasOverflow = false;
  CanScrollRoleCardsLeft = false;
  CanScrollRoleCardsRight = false;

  @ViewChild('activeModal')
  private activeModal?: ElementRef<HTMLElement>;

  @ViewChild('roleCardViewport')
  private roleCardViewport?: ElementRef<HTMLElement>;

  private modalOpener: HTMLElement | null = null;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => this.UpdateRoleCardNavigation(), {
      injector: this.injector,
      phase: AfterRenderPhase.Read,
    });
  }

  get FilteredUsers(): readonly MockUser[] {
    const SearchText = this.UserSearchText.trim().toLocaleLowerCase();
    return this.MockRbac.Users.filter(
      (User) =>
        (!this.UserRoleFilter || User.Roles.includes(this.UserRoleFilter)) &&
        (!SearchText || `${User.Account} ${User.DisplayName}`.toLocaleLowerCase().includes(SearchText)),
    );
  }

  get UserTotalPages(): number {
    return Math.max(1, Math.ceil(this.FilteredUsers.length / this.PaginationPageSize));
  }

  get UserPageNumbers(): readonly number[] {
    return Array.from({ length: this.UserTotalPages }, (_, Index) => Index + 1);
  }

  get PagedUsers(): readonly MockUser[] {
    const Start = (this.UserCurrentPage - 1) * this.PaginationPageSize;
    return this.FilteredUsers.slice(Start, Start + this.PaginationPageSize);
  }

  get UserRoleTabs(): readonly PortalTab[] {
    return [
      { id: 'all', label: `全部 (${this.MockRbac.Users.length})` },
      ...this.MockRbac.Roles.map((Role) => ({
        id: Role.Key,
        label: `${Role.DisplayName} (${this.MockRbac.GetRoleUserCount(Role.Key)})`,
      })),
    ];
  }

  get ActiveUserRoleTab(): string {
    return this.UserRoleFilter ?? 'all';
  }

  GetRoleAvatarUsers(RoleKey: MockRoleKey): readonly MockUser[] {
    return this.MockRbac.Users.filter((User) => User.Roles.includes(RoleKey)).slice(0, 4);
  }

  GetRoleNames(Roles: readonly MockRoleKey[]): string {
    return Roles
      .map((RoleKey) => this.MockRbac.GetRole(RoleKey)?.DisplayName ?? RoleKey)
      .join('、');
  }

  OnUserSearchChange(): void {
    this.UserCurrentPage = 1;
  }

  SetUserRoleFilter(RoleKey: MockRoleKey | null): void {
    this.UserRoleFilter = RoleKey;
    this.UserCurrentPage = 1;
  }

  SetUserRoleFilterFromTab(TabId: string): void {
    this.SetUserRoleFilter(TabId === 'all' ? null : TabId as MockRoleKey);
  }

  GoToUserPage(Page: number): void {
    this.UserCurrentPage = Math.min(Math.max(1, Page), this.UserTotalPages);
  }

  EditUser(Account: string): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const User = this.MockRbac.GetUser(Account);
    if (!User) return;
    this.RememberModalOpener();
    this.EditingAccount = User.Account;
    this.EditingUser = { Roles: [...User.Roles] };
    this.EditUserValidationErrors = {};
    this.FocusModalSoon();
  }

  ToggleEditingUserRole(RoleKey: MockRoleKey, Selected: boolean): void {
    if (!this.EditingUser || !this.Auth.CanOperateBackOffice) return;
    this.EditingUser.Roles = Selected
      ? this.MockRbac.NormalizeRoles([...this.EditingUser.Roles, RoleKey])
      : this.EditingUser.Roles.filter((Key) => Key !== RoleKey);
    delete this.EditUserValidationErrors.Roles;
  }

  SaveEditedUser(): void {
    if (!this.Auth.CanOperateBackOffice || !this.EditingAccount || !this.EditingUser) return;
    const Before = this.NotificationCenter.CaptureAccess(this.EditingAccount);
    const Result = this.MockRbac.SaveUserEdit(this.EditingAccount, this.EditingUser);
    if (Result === 'invalid') {
      this.EditUserValidationErrors = { Roles: '請至少選擇一個角色。' };
      return;
    }
    if (Result === 'not-found') {
      this.EditUserValidationErrors = { Form: '找不到要編輯的使用者。' };
      return;
    }
    this.NotificationCenter.NotifyRoleAssignmentChange(this.EditingAccount, Before);
    this.AuditLog.RecordPermissionChange(
      'UPDATE_USER_ROLES',
      `更新使用者 ${this.EditingAccount} 的系統角色。`,
    );
    this.CancelEditUser();
    this.Notifications.ShowSuccess('使用者角色已更新。');
  }

  CancelEditUser(): void {
    this.EditingAccount = null;
    this.EditingUser = null;
    this.EditUserValidationErrors = {};
    this.RestoreModalFocus();
  }

  OpenCreateRoleDialog(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.RememberModalOpener();
    this.RoleDraft = this.CreateRoleDraft();
    this.RoleDraftError = '';
    this.IsReportManagementExpanded = true;
    this.IsOperationLogExpanded = true;
    this.IsCreateRoleDialogOpen = true;
    this.FocusModalSoon();
  }

  OpenEditRoleDialog(RoleKey: MockRoleKey): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const Role = this.MockRbac.GetRole(RoleKey);
    if (!Role) return;
    this.RememberModalOpener();
    this.EditingRoleKey = Role.Key;
    this.RoleDraft = {
      DisplayName: Role.DisplayName,
      ManagementPermissions: [...Role.ManagementPermissions],
      Permissions: this.MockRbac.GetCategoryPermissionEntries(Role.Key),
    };
    this.RoleDraftError = '';
    this.IsReportManagementExpanded = true;
    this.IsOperationLogExpanded = true;
    this.IsEditRoleDialogOpen = true;
    this.FocusModalSoon();
  }

  CloseRoleDialog(): void {
    this.IsCreateRoleDialogOpen = false;
    this.IsEditRoleDialogOpen = false;
    this.EditingRoleKey = null;
    this.DeletingRole = null;
    this.RoleDraft = this.CreateRoleDraft();
    this.RoleDraftError = '';
    this.RestoreModalFocus();
  }

  SaveRole(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const Role = this.MockRbac.CreateRole(this.RoleDraft);
    if (!Role) return this.SetRoleDraftError('請輸入未重複的角色名稱，並至少授予一項權限。');
    this.AuditLog.RecordPermissionChange('CREATE_ROLE', `建立角色 ${Role.DisplayName}。`);
    this.CloseRoleDialog();
    this.Notifications.ShowSuccess(`角色「${Role.DisplayName}」已建立。`);
    this.ScheduleRoleCardNavigationUpdate();
  }

  SaveEditedRole(): void {
    if (!this.Auth.CanOperateBackOffice || !this.EditingRoleKey) return;
    const Before = this.NotificationCenter.CaptureRoleUsers(this.EditingRoleKey);
    const Result = this.MockRbac.UpdateRole(this.EditingRoleKey, this.RoleDraft);
    if (Result !== 'updated') {
      const Messages: Record<Exclude<typeof Result, 'updated'>, string> = {
        invalid: '請輸入角色名稱。',
        'duplicate-name': '角色名稱已存在。',
        'not-found': '找不到要編輯的角色。',
      };
      this.SetRoleDraftError(Messages[Result]);
      return;
    }
    const DisplayName = this.MockRbac.GetRole(this.EditingRoleKey)?.DisplayName ?? this.RoleDraft.DisplayName;
    this.NotificationCenter.NotifyRoleDefinitionChange(this.EditingRoleKey, Before);
    this.AuditLog.RecordPermissionChange('UPDATE_ROLE_PERMISSION', `更新角色 ${DisplayName} 的權限。`);
    this.CloseRoleDialog();
    this.Notifications.ShowSuccess(`角色「${DisplayName}」已更新。`);
  }

  OpenDeleteRoleDialog(): void {
    if (!this.Auth.CanOperateBackOffice || !this.EditingRoleKey) return;
    const Role = this.MockRbac.GetRole(this.EditingRoleKey);
    if (!Role) return;
    if (this.MockRbac.GetRoleUserCount(Role.Key) > 0) {
      this.SetRoleDraftError('此角色仍有使用者使用，請先調整使用者角色。');
      return;
    }
    this.DeletingRole = Role;
    this.FocusModalSoon();
  }

  CloseDeleteRoleDialog(): void {
    this.DeletingRole = null;
    this.FocusModalSoon();
  }

  ConfirmDeleteRole(): void {
    if (!this.Auth.CanOperateBackOffice || !this.DeletingRole) return;
    const Role = this.DeletingRole;
    if (this.MockRbac.DeleteRole(Role.Key) !== 'deleted') {
      this.SetRoleDraftError('無法刪除目前角色。');
      this.CloseDeleteRoleDialog();
      return;
    }
    if (this.UserRoleFilter === Role.Key) this.UserRoleFilter = null;
    this.AuditLog.RecordPermissionChange('DELETE_ROLE', `刪除角色 ${Role.DisplayName}。`);
    this.CloseRoleDialog();
    this.Notifications.ShowSuccess(`角色「${Role.DisplayName}」已刪除。`);
    this.ScheduleRoleCardNavigationUpdate();
  }

  ToggleManagementPermission(Permission: MockManagementPermission, Enabled: boolean): void {
    this.RoleDraft.ManagementPermissions = Enabled
      ? [...new Set([...this.RoleDraft.ManagementPermissions, Permission])]
      : this.RoleDraft.ManagementPermissions.filter((Value) => Value !== Permission);
  }

  SetPermissionCanExecute(Entry: MockCategoryPermissionEntry, Enabled: boolean): void {
    const HadChildPermissions = !Enabled && (Entry.Permission.CanExport || Entry.Permission.CanPrint);
    Entry.Permission.CanExecute = Enabled;
    if (!Enabled) {
      Entry.Permission.CanExport = false;
      Entry.Permission.CanPrint = false;
    }
    if (HadChildPermissions) {
      this.Notifications.ShowSuccess('已同步移除相依權限：「匯出、列印」。');
    }
  }

  TrackUserByAccount(_: number, User: { Account: string }): string { return User.Account; }
  TrackRoleByKey(_: number, Role: MockRole): MockRoleKey { return Role.Key; }
  TrackByCategoryPermissionEntry(_: number, Entry: MockCategoryPermissionEntry): string { return Entry.CategoryId; }

  ScrollRoleCards(Direction: -1 | 1): void {
    const Viewport = this.roleCardViewport?.nativeElement;
    if (
      !Viewport ||
      (Direction === -1 && !this.CanScrollRoleCardsLeft) ||
      (Direction === 1 && !this.CanScrollRoleCardsRight)
    ) return;

    Viewport.scrollBy({
      left: Direction * Math.max(Viewport.clientWidth * 0.8, 240),
      behavior: 'smooth',
    });
  }

  UpdateRoleCardNavigation(): void {
    const Viewport = this.roleCardViewport?.nativeElement;
    if (!Viewport) {
      this.SetRoleCardNavigationState(false, true, true);
      return;
    }

    const MaximumScrollLeft = Math.max(0, Viewport.scrollWidth - Viewport.clientWidth);
    const HasOverflow = MaximumScrollLeft > 2;
    if (!HasOverflow) {
      Viewport.scrollLeft = 0;
      this.SetRoleCardNavigationState(false, true, true);
      return;
    }

    this.SetRoleCardNavigationState(
      true,
      Viewport.scrollLeft <= 2,
      Viewport.scrollLeft >= MaximumScrollLeft - 2,
    );
  }

  @HostListener('window:resize')
  UpdateRoleCardNavigationOnResize(): void {
    this.UpdateRoleCardNavigation();
  }

  @HostListener('document:keydown.escape')
  CloseTopModalOnEscape(): void {
    if (this.DeletingRole) this.CloseDeleteRoleDialog();
    else if (this.EditingUser) this.CancelEditUser();
    else if (this.IsCreateRoleDialogOpen || this.IsEditRoleDialogOpen) this.CloseRoleDialog();
  }

  private CreateRoleDraft(): MockRoleDraft {
    return {
      DisplayName: '',
      ManagementPermissions: [],
      Permissions: this.MockRbac.GetEmptyCategoryPermissionEntries(),
    };
  }

  private SetRoleDraftError(Message: string): void { this.RoleDraftError = Message; }

  private ScheduleRoleCardNavigationUpdate(): void {
    afterNextRender(() => this.UpdateRoleCardNavigation(), {
      injector: this.injector,
      phase: AfterRenderPhase.Read,
    });
  }

  private SetRoleCardNavigationState(HasOverflow: boolean, AtStart: boolean, AtEnd: boolean): void {
    this.RoleCardHasOverflow = HasOverflow;
    this.CanScrollRoleCardsLeft = HasOverflow && !AtStart;
    this.CanScrollRoleCardsRight = HasOverflow && !AtEnd;
  }

  private RememberModalOpener(): void {
    this.modalOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  private FocusModalSoon(): void {
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => this.activeModal?.nativeElement.focus());
  }

  private RestoreModalFocus(): void {
    const Opener = this.modalOpener;
    this.modalOpener = null;
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => Opener?.focus());
  }
}
