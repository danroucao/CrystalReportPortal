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
  private readonly Notifications: MockCenterNotification[] = [
    {
      Id: 'NOTICE_6',
      RecipientAccount: 'admin@example.com',
      Title: '新增報表分類待開權限',
      Summary: '「海外分公司損益分析」已新增，請確認需要授權的角色。',
      Detail:
        '前台使用者已新增報表分類「海外分公司損益分析」。請前往「使用者管理 > 編輯角色」，確認相關角色設定報表查閱、匯出及列印權限。',
      CreatedAt: '2026-09-13T10:15:00.000Z',
      ReadAt: null,
    },
    {
      Id: 'NOTICE_5',
      RecipientAccount: 'admin@example.com',
      Title: '系統維護提醒',
      Summary: '本週六凌晨將進行例行維護，請預先通知相關使用者。',
      Detail:
        '例行維護預計於本週六 01:00 至 03:00 進行。維護期間請避免調整角色權限與執行大量資料匯出。',
      CreatedAt: '2026-09-12T16:00:00.000Z',
      ReadAt: null,
    },
    {
      Id: 'NOTICE_4',
      RecipientAccount: 'user@example.com',
      Title: '月結報表已完成',
      Summary: '2026 年 8 月月結報表已產生，可開始查閱。',
      Detail:
        '財務月結作業已完成。請先確認資料期間與部門篩選條件，再匯出或列印所需報表。',
      CreatedAt: '2026-09-13T09:30:00.000Z',
      ReadAt: null,
    },
    {
      Id: 'NOTICE_3',
      RecipientAccount: 'user@example.com',
      Title: '權限設定已更新',
      Summary: '你的報表查閱權限已依最新角色設定調整。',
      Detail:
        '系統已更新你的角色權限。若預期可使用的報表沒有出現在清單中，請聯絡系統管理員確認分類授權。',
      CreatedAt: '2026-09-12T08:45:00.000Z',
      ReadAt: null,
    },
    {
      Id: 'NOTICE_2',
      RecipientAccount: 'user@example.com',
      Title: '應收帳款明細已更新',
      Summary: '最新資料已同步完成，可預覽「應收帳款明細」。',
      Detail:
        '應收帳款明細已完成資料同步。建議先以資料期間篩選本月範圍，再預覽報表內容。',
      CreatedAt: '2026-09-11T15:20:00.000Z',
      ReadAt: null,
    },
    {
      Id: 'NOTICE_1',
      RecipientAccount: 'user@example.com',
      Title: '例行系統維護通知',
      Summary: '本週六凌晨將進行例行維護，服務可能短暫中斷。',
      Detail:
        '例行維護預計於本週六 01:00 至 03:00 進行。維護期間請避免執行大量匯出作業。',
      CreatedAt: '2026-09-10T10:00:00.000Z',
      ReadAt: '2026-09-10T10:05:00.000Z',
    },
  ];
  private NextWorkItem = 1;
  private NextNotification = 7;

  constructor(private readonly rbac: MockRbacService) {}

  GetNotifications(Account: string): readonly MockCenterNotification[] {
    return this.Notifications.filter(
      (Item) => Item.RecipientAccount === Account,
    )
      .map((Item) => ({ ...Item }))
      .sort((Left, Right) => Right.CreatedAt.localeCompare(Left.CreatedAt));
  }

  GetWorkItems(): readonly MockWorkItem[] {
    return this.WorkItems.map((Item) => ({ ...Item })).sort((Left, Right) =>
      Right.CreatedAt.localeCompare(Left.CreatedAt),
    );
  }

  GetUnreadNotificationCount(Account: string): number {
    return this.Notifications.filter(
      (Item) => Item.RecipientAccount === Account && !Item.ReadAt,
    ).length;
  }

  GetOpenWorkItemCount(): number {
    return this.WorkItems.filter((Item) => Item.Status === 'Pending').length;
  }

  MarkNotificationRead(Id: string, Account: string): void {
    const Notification = this.Notifications.find(
      (Item) => Item.Id === Id && Item.RecipientAccount === Account,
    );
    if (Notification && !Notification.ReadAt) Notification.ReadAt = this.Now();
  }

  CreateCategoryReview(
    Category: MockReportCategory,
    CreatorAccount: string,
  ): void {
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
    this.CreateNotification(
      'admin@example.com',
      '新增報表分類待開權限',
      `「${Category.CategoryName}」已新增，請確認需要授權的角色。`,
      `前台使用者 ${CreatorAccount} 已新增報表分類「${Category.CategoryName}」。請前往「 使用者管理 > 編輯角色」，確認分類後為相關角色設定報表查閱、匯出及列印權限。`,
    );
  }

  CompleteCategoryReview(Id: string, Resolution: string): boolean {
    const WorkItem = this.FindWorkItem(Id);
    if (
      !WorkItem ||
      WorkItem.Type !== 'ReportCategoryPermissionReview' ||
      WorkItem.Status !== 'Pending'
    )
      return false;
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
    this.CreateNotification(
      Account,
      '角色設定已更新',
      Before === After
        ? '角色指派已調整，目前可使用的功能未變。'
        : '角色指派已調整，目前可使用的功能已更新。',
      this.AccessDiffDetail(Before, After),
    );
  }

  NotifyRoleDefinitionChange(
    RoleKey: MockRoleKey,
    BeforeByAccount: ReadonlyMap<string, string>,
  ): void {
    for (const [Account, Before] of BeforeByAccount) {
      const User = this.rbac.GetUser(Account);
      if (!User || !User.Roles.includes(RoleKey)) continue;
      const After = this.GetAccessSummary(Account, User.Roles);
      this.CreateNotification(
        Account,
        '權限設定已更新',
        Before === After
          ? '角色權限已更新，目前可使用的功能未變。'
          : '角色權限已更新，目前可使用的功能已更新。',
        this.AccessDiffDetail(Before, After),
      );
    }
  }

  CaptureRoleUsers(RoleKey: MockRoleKey): ReadonlyMap<string, string> {
    return new Map(
      this.rbac.Users.filter((User) => User.Roles.includes(RoleKey)).map(
        (User) => [
          User.Account,
          this.GetAccessSummary(User.Account, User.Roles),
        ],
      ),
    );
  }

  private GetAccessSummary(
    _Account: string,
    Roles: readonly MockRoleKey[],
  ): string {
    const Management = (
      ['DatabaseConnection', 'RptManagement', 'OperationLog'] as const
    )
      .filter((Permission) =>
        Roles.some((Role) =>
          this.rbac.HasManagementPermission(Role, Permission),
        ),
      )
      .join('、');
    const Categories = this.rbac
      .GetCategories()
      .filter((Category) => !Category.IsSystemReserved)
      .map((Category) => {
        const Permission = this.rbac.GetEffectiveCategoryPermission(
          Roles,
          Category.CategoryId,
        );
        const Capabilities = [
          Permission.CanExecute && '預覽',
          Permission.CanExport && '匯出',
          Permission.CanPrint && '列印',
        ]
          .filter(Boolean)
          .join('、');
        return Capabilities ? `${Category.CategoryName}：${Capabilities}` : '';
      })
      .filter(Boolean)
      .join('；');
    return (
      [Categories, Management && `管理功能：${Management}`]
        .filter(Boolean)
        .join('；') || '目前沒有可使用的報表或管理功能'
    );
  }

  private AccessDiffDetail(Before: string, After: string): string {
    return Before === After ? '有效權限未變。' : `目前可使用功能：${After}`;
  }

  private CreateNotification(
    Account: string,
    Title: string,
    Summary: string,
    Detail: string,
  ): void {
    this.Notifications.push({
      Id: `NOTICE_${this.NextNotification++}`,
      RecipientAccount: Account,
      Title,
      Summary,
      Detail,
      CreatedAt: this.Now(),
      ReadAt: null,
    });
  }

  private FindWorkItem(Id: string): MockWorkItem | undefined {
    return this.WorkItems.find((Item) => Item.Id === Id);
  }
  private Now(): string {
    return new Date().toISOString();
  }
}
