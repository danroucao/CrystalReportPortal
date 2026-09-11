import { Injectable } from '@angular/core';

import type { MockReportCategory } from '../mock/mock-report-categories';
import type { MockRoleKey } from '../mock/mock-permissions';
import { MockRbacService } from './mock-rbac.service';

export interface MockCenterNotification {
  readonly Id: string;
  readonly RecipientAccount: string;
  readonly Title: string;
  readonly Summary: string;
  readonly Detail: string;
  readonly CreatedAt: string;
  ReadAt: string | null;
}

export interface MockWorkItem {
  readonly Id: string;
  readonly Type: 'ReportCategoryPermissionReview';
  readonly Title: string;
  readonly Summary: string;
  readonly CreatedAt: string;
  Status: 'Pending' | 'Completed' | 'Cancelled';
  Resolution: string;
  readonly CategoryId: string | null;
}

@Injectable({ providedIn: 'root' })
export class MockNotificationCenterService {
  private readonly WorkItems: MockWorkItem[] = [];
  private readonly Notifications: MockCenterNotification[] = [];
  private NextWorkItem = 1;
  private NextNotification = 1;

  constructor(private readonly rbac: MockRbacService) {}

  GetNotifications(Account: string): readonly MockCenterNotification[] {
    return this.Notifications.filter((Item) => Item.RecipientAccount === Account)
      .map((Item) => ({ ...Item }))
      .sort((Left, Right) => Right.CreatedAt.localeCompare(Left.CreatedAt));
  }

  GetWorkItems(): readonly MockWorkItem[] {
    return this.WorkItems.map((Item) => ({ ...Item }))
      .sort((Left, Right) => Right.CreatedAt.localeCompare(Left.CreatedAt));
  }

  GetUnreadNotificationCount(Account: string): number {
    return this.Notifications.filter((Item) => Item.RecipientAccount === Account && !Item.ReadAt).length;
  }

  GetOpenWorkItemCount(): number {
    return this.WorkItems.filter((Item) => Item.Status === 'Pending').length;
  }

  MarkNotificationRead(Id: string, Account: string): void {
    const Notification = this.Notifications.find((Item) => Item.Id === Id && Item.RecipientAccount === Account);
    if (Notification && !Notification.ReadAt) Notification.ReadAt = this.Now();
  }

  CreateCategoryReview(Category: MockReportCategory, CreatorAccount: string): void {
    this.WorkItems.push({
      Id: `WORK_${this.NextWorkItem++}`,
      Type: 'ReportCategoryPermissionReview',
      Title: '待檢查新報表分類權限',
      Summary: `${CreatorAccount} 新增「${Category.CategoryName}」，請確認角色授權策略。`,
      CreatedAt: this.Now(),
      Status: 'Pending',
      Resolution: '',
      CategoryId: Category.CategoryId,
    });
  }

  CompleteCategoryReview(Id: string, Resolution: string): boolean {
    const WorkItem = this.FindWorkItem(Id);
    if (!WorkItem || WorkItem.Type !== 'ReportCategoryPermissionReview' || WorkItem.Status !== 'Pending') return false;
    WorkItem.Status = 'Completed';
    WorkItem.Resolution = Resolution.trim() || '已確認暫不授權。';
    return true;
  }

  CaptureAccess(Account: string): string {
    const User = this.rbac.GetUser(Account);
    return User ? this.GetAccessSummary(Account, User.Roles) : '';
  }

  NotifyRoleAssignmentChange(Account: string, Before: string): void {
    const User = this.rbac.GetUser(Account);
    if (!User) return;
    const After = this.GetAccessSummary(Account, User.Roles);
    this.CreateNotification(Account, '角色設定已更新', Before === After ? '角色指派已調整，目前可使用的功能未變。' : '角色指派已調整，目前可使用的功能已更新。', this.AccessDiffDetail(Before, After));
  }

  NotifyRoleDefinitionChange(RoleKey: MockRoleKey, BeforeByAccount: ReadonlyMap<string, string>): void {
    for (const [Account, Before] of BeforeByAccount) {
      const User = this.rbac.GetUser(Account);
      if (!User || !User.Roles.includes(RoleKey)) continue;
      const After = this.GetAccessSummary(Account, User.Roles);
      this.CreateNotification(Account, '權限設定已更新', Before === After ? '角色權限已更新，目前可使用的功能未變。' : '角色權限已更新，目前可使用的功能已更新。', this.AccessDiffDetail(Before, After));
    }
  }

  CaptureRoleUsers(RoleKey: MockRoleKey): ReadonlyMap<string, string> {
    return new Map(this.rbac.Users.filter((User) => User.Roles.includes(RoleKey)).map((User) => [User.Account, this.GetAccessSummary(User.Account, User.Roles)]));
  }

  private GetAccessSummary(_Account: string, Roles: readonly MockRoleKey[]): string {
    const Management = (['DatabaseConnection', 'RptManagement', 'OperationLog'] as const).filter((Permission) => Roles.some((Role) => this.rbac.HasManagementPermission(Role, Permission))).join('、');
    const Categories = this.rbac.GetCategories().filter((Category) => !Category.IsSystemReserved).map((Category) => {
      const Permission = this.rbac.GetEffectiveCategoryPermission(Roles, Category.CategoryId);
      const Capabilities = [Permission.CanExecute && '預覽', Permission.CanExport && '匯出', Permission.CanPrint && '列印'].filter(Boolean).join('、');
      return Capabilities ? `${Category.CategoryName}：${Capabilities}` : '';
    }).filter(Boolean).join('；');
    return [Categories, Management && `管理功能：${Management}`].filter(Boolean).join('；') || '目前沒有可使用的報表或管理功能';
  }

  private AccessDiffDetail(Before: string, After: string): string {
    return Before === After ? '有效權限未變。' : `目前可使用功能：${After}`;
  }

  private CreateNotification(Account: string, Title: string, Summary: string, Detail: string): void {
    this.Notifications.push({ Id: `NOTICE_${this.NextNotification++}`, RecipientAccount: Account, Title, Summary, Detail, CreatedAt: this.Now(), ReadAt: null });
  }

  private FindWorkItem(Id: string): MockWorkItem | undefined { return this.WorkItems.find((Item) => Item.Id === Id); }
  private Now(): string { return new Date().toISOString(); }
}
