import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  DoCheck,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';

import {
  MockCategoryPermissionEntry,
  MockRole,
  MockRoleKey,
  MockManagementPermission,
} from '../mock/mock-permissions';
import { MockReportCategory } from '../mock/mock-report-categories';
import { MockReportKey, MockReportReadModel } from '../mock/mock-reports';
import { AuthService } from '../services/auth.service';
import {
  MockAccountSettingsDraft,
  MockCreatedUserCredentials,
  MockFavoriteReport,
  MockRbacService,
  MockRoleDraft,
  MockUserDraft,
  MockUserEditDraft,
} from '../services/mock-rbac.service';
import { MockUser } from '../mock/mock-users';
import {
  MockLovStatus,
  MockParameterDefaultValue,
  MockParameterInputType,
  MockReportParameterDefinition,
} from '../mock/mock-report-parameters';
import { NotificationService } from '../services/notification.service';
import {
  MockCenterNotification,
  MockNotificationCenterService,
} from '../services/mock-notification-center.service';
import {
  MockDatabaseConnectionDraft,
  MockDatabaseConnectionService,
} from '../services/mock-database-connection.service';
import { MockReportParameterService } from '../services/mock-report-parameter.service';
import {
  MockAuditLogCategory,
  MockAuditLogEntry,
  MockAuditLogService,
  MockAuditLogSource,
} from '../services/mock-audit-log.service';
import { BoringAvatarComponent } from '../shared/boring-avatar.component';

type DemoPortalPage =
  | 'ReportList'
  | 'ReportParameter'
  | 'ReportPreview'
  | 'AccountSettings'
  | 'UserManagement'
  | 'RptManagement'
  | 'ReportUpload'
  | 'DatabaseConnection'
  | 'OperationLog'
  | 'NotificationCenter';

interface MockExportOption {
  readonly Label: string;
  readonly FormatKey: string;
  readonly Enabled: boolean;
  readonly MockOnly: boolean;
  readonly RequiresBackendConfirmation: boolean;
}

type MockParameterFormValue =
  | string
  | number
  | boolean
  | string[]
  | { Start: string | number | null; End: string | number | null }
  | null;

type ParameterReportSortField = 'ReportName' | 'CreatedAt' | 'UpdatedAt';
type ParameterReportSortDirection = 'asc' | 'desc';
type FavoriteReportSortField = 'ReportName' | 'FavoritedAt' | 'LastUsedAt';
type FavoriteReportSortDirection = 'asc' | 'desc';
type ReportManagementSortField = 'ReportName' | 'CreatedAt' | 'UpdatedAt';
type ReportManagementSortDirection = 'asc' | 'desc';
type ReportPreviewOrigin = 'all' | 'favorites';
type OperationLogCategoryFilter = MockAuditLogCategory | 'ALL';
type OperationLogSourceFilter = MockAuditLogSource | 'ALL';
type OperationLogSortField = 'OccurredAt' | 'UserId';
type OperationLogSortDirection = 'asc' | 'desc';

interface OperationLogCategoryOption {
  readonly Value: OperationLogCategoryFilter;
  readonly Label: string;
}

interface ParameterReportCategoryTab {
  readonly CategoryId: string;
  readonly CategoryName: string;
  readonly Count: number;
}

interface ParameterReportSearchState {
  readonly CategoryId: string;
  readonly SearchText: string;
  readonly SortField: ParameterReportSortField | null;
  readonly SortDirection: ParameterReportSortDirection;
  readonly StartDate: string;
  readonly EndDate: string;
}

interface ReportEditorDraft {
  ReportName: string;
  Description: string;
  CategoryId: string;
  Enabled: boolean;
}

type ReportUploadStep = 'Form' | 'Confirm' | 'Complete';

type CreateUserField = 'Account' | 'DisplayName' | 'Roles';
type CreateUserValidationErrors = Partial<Record<CreateUserField, string>>;
type EditUserValidationErrors = Partial<Record<'Roles' | 'Form', string>>;

@Component({
  selector: 'app-demo-portal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
    BoringAvatarComponent,
  ],
  templateUrl: './demo-portal.component.html',
  styleUrl: './demo-portal.component.scss',
})
export class DemoPortalComponent
  implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy, DoCheck
{
  readonly PaginationPageSize = 10;
  readonly AllCategoryFilterValue = 'ALL';
  readonly Auth = inject(AuthService);
  readonly MockRbac = inject(MockRbacService);
  readonly ReportParameters = inject(MockReportParameterService);
  readonly DatabaseConnections = inject(MockDatabaseConnectionService);
  readonly Notifications = inject(NotificationService);
  readonly NotificationCenter = inject(MockNotificationCenterService);
  readonly AuditLog = inject(MockAuditLogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly Page = this.route.snapshot.data['Page'] as DemoPortalPage;
  SelectedFavoriteCategoryId = this.AllCategoryFilterValue;
  FavoriteSearchText = '';
  SelectedParameterReportCategoryId = this.AllCategoryFilterValue;
  IsFavoriteReportSortActive = false;
  FavoriteReportSortField: FavoriteReportSortField = 'LastUsedAt';
  FavoriteReportSortDirection: FavoriteReportSortDirection = 'desc';
  ParameterReportStartDate = '';
  ParameterReportEndDate = '';
  ParameterReportDateNotice = '';
  ParameterReportSelectionNotice = '';
  ParameterReportSearchText = '';
  ParameterReportSortField: ParameterReportSortField | null = null;
  ParameterReportSortDirection: ParameterReportSortDirection = 'asc';
  ParameterReportCurrentPage = 1;
  IsReportParameterMode = false;
  ReportParameterDefinitions: MockReportParameterDefinition[] = [];
  ReportParameterForm = new FormGroup({});
  readonly ParameterRangeErrors: Record<string, string> = {};
  LastMockExecutionParameters: Readonly<
    Record<string, MockParameterFormValue>
  > | null = null;
  MockNotice = '';
  IsExportMenuOpen = false;
  IsPrintMenuOpen = false;
  IsNotificationPanelOpen = false;
  SelectedCenterNotification: MockCenterNotification | null = null;
  IsProfileMenuOpen = false;
  readonly OperationLogCategoryOptionsBySource: Readonly<
    Record<OperationLogSourceFilter, readonly OperationLogCategoryOption[]>
  > = {
    ALL: [
      { Value: 'ALL', Label: '全部分類' },
      { Value: 'PermissionChange', Label: '權限變動' },
      { Value: 'ReportAction', Label: '報表操作' },
      { Value: 'AccountManagement', Label: '帳號管理' },
    ],
    BackOffice: [
      { Value: 'ALL', Label: '全部分類' },
      { Value: 'PermissionChange', Label: '權限變動' },
      { Value: 'AccountManagement', Label: '帳號管理' },
    ],
    FrontOffice: [
      { Value: 'ALL', Label: '全部分類' },
      { Value: 'ReportAction', Label: '報表操作' },
    ],
  };
  OperationLogCategoryFilter: OperationLogCategoryFilter = 'ALL';
  OperationLogSourceFilter: OperationLogSourceFilter = 'ALL';
  OperationLogStartDate = '';
  OperationLogEndDate = '';
  OperationLogSearchText = '';
  OperationLogCurrentPage = 1;
  OperationLogSortField: OperationLogSortField = 'OccurredAt';
  OperationLogSortDirection: OperationLogSortDirection = 'desc';
  SelectedOperationLog: MockAuditLogEntry | null = null;
  BackOfficeBindingAccount = '';
  BackOfficeBindingPassword = '';
  BackOfficeBindingError = '';
  NotificationCenterTab: 'All' | 'Unread' = 'All';
  NotificationPopoverTab: 'All' | 'Unread' = 'All';
  ReportPreviewOrigin: ReportPreviewOrigin = 'all';
  private ReturnToParameterSearchState: ParameterReportSearchState | null =
    null;
  readonly ExportOptions: readonly MockExportOption[] = [
    {
      Label: 'PDF',
      FormatKey: 'Pdf',
      Enabled: true,
      MockOnly: true,
      RequiresBackendConfirmation: false,
    },
    {
      Label: 'Excel',
      FormatKey: 'Excel',
      Enabled: true,
      MockOnly: true,
      RequiresBackendConfirmation: true,
    },
    {
      Label: 'Word',
      FormatKey: 'Word',
      Enabled: true,
      MockOnly: true,
      RequiresBackendConfirmation: true,
    },
    {
      Label: 'CSV',
      FormatKey: 'Csv',
      Enabled: true,
      MockOnly: true,
      RequiresBackendConfirmation: true,
    },
    {
      Label: 'RTF',
      FormatKey: 'Rtf',
      Enabled: true,
      MockOnly: true,
      RequiresBackendConfirmation: true,
    },
    {
      Label: '文字檔',
      FormatKey: 'Text',
      Enabled: true,
      MockOnly: true,
      RequiresBackendConfirmation: true,
    },
  ];
  ManagementNotice = '';
  EditingAccount: string | null = null;
  UserDraft: MockUserDraft = this.CreateUserDraft();
  CreateUserValidationErrors: CreateUserValidationErrors = {};
  CreatedUserCredentials: MockCreatedUserCredentials | null = null;
  CreatedUserCopyNotice = '';
  EditingUser: MockUserEditDraft | null = null;
  EditUserValidationErrors: EditUserValidationErrors = {};
  DeletingUser: MockUser | null = null;
  DeleteUserError = '';
  AccountSettingsDraft: MockAccountSettingsDraft =
    this.CreateAccountSettingsDraft();
  AccountSettingsConfirmation = '';
  AccountProfileNotice = '';
  AccountPasswordNotice = '';
  IsPasswordChangeSuccessModalOpen = false;
  UserSearchText = '';
  UserCurrentPage = 1;
  IsCreateUserDialogOpen = false;
  UserRoleFilter: MockRoleKey | null = null;
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
  DatabaseConnectionDraft: MockDatabaseConnectionDraft =
    this.CreateDatabaseConnectionDraft();
  EditingDatabaseConnectionKey: string | null = null;
  IsDatabaseConnectionEditorOpen = false;
  DatabaseConnectionFormError = '';
  ReportManagementStartDate = '';
  ReportManagementEndDate = '';
  ReportManagementDateNotice = '';
  ReportManagementCategoryId = this.AllCategoryFilterValue;
  ReportManagementSearchText = '';
  ReportManagementSortField: ReportManagementSortField | null = null;
  ReportManagementSortDirection: ReportManagementSortDirection = 'asc';
  ReportManagementCurrentPage = 1;
  private readonly PinnedReportManagementKeys = new Set<MockReportKey>();
  IsCategoryManagementDialogOpen = false;
  NewCategoryName = '';
  CategoryCreateError = '';
  EditingCategoryId: string | null = null;
  EditingCategoryName = '';
  CategoryEditError = '';
  DeletingCategory: MockReportCategory | null = null;
  CategoryDeleteError = '';
  IsUploadReportDialogOpen = false;
  IsReportDiscardConfirmationOpen = false;
  IsReportCategoryQuickAddOpen = false;
  QuickAddCategoryName = '';
  QuickAddCategoryError = '';
  EditingReportKey: MockReportKey | null = null;
  DeletingReport: MockReportReadModel | null = null;
  ReportEditorDraft: ReportEditorDraft = this.CreateReportEditorDraft();
  SelectedReportFileName = '';
  ReportEditorError = '';
  IsReportFileInvalid = false;
  ReportUploadStep: ReportUploadStep = 'Form';
  PublishedUploadedReport: MockReportReadModel | null = null;
  private ReportEditorInitialDraft: ReportEditorDraft | null = null;
  private InitialReportFileName = '';
  private ReportEditorOpener: HTMLElement | null = null;
  private ReportDiscardConfirmationReturnFocus: HTMLElement | null = null;
  private PendingReportEditorFocus: HTMLElement | null = null;
  private ShouldFocusReportDiscardContinue = false;
  private NotificationDetailOpener: HTMLElement | null = null;
  private PendingNotificationDetailFocus: HTMLElement | null = null;
  private ShouldFocusNotificationDetailClose = false;
  @ViewChild('notificationDetailDialog')
  private notificationDetailDialog?: ElementRef<HTMLElement>;
  @ViewChild('notificationDetailCloseButton')
  private notificationDetailCloseButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('parameterReportSearchInput')
  private parameterReportSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('reportEditorDialog')
  private reportEditorDialog?: ElementRef<HTMLElement>;
  @ViewChild('reportDiscardDialog')
  private reportDiscardDialog?: ElementRef<HTMLElement>;
  @ViewChild('reportDiscardContinueButton')
  private reportDiscardContinueButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('roleCardViewport')
  private roleCardViewport?: ElementRef<HTMLElement>;
  private roleCardResizeObserver?: ResizeObserver;

  get AccessNotice(): string {
    const State = this.route.snapshot.queryParamMap?.get('state');
    return State === 'permission-denied'
      ? '目前帳號沒有此功能的使用權限。'
      : State === 'report-unavailable'
        ? '請選擇目前有預覽權限的報表。'
        : '';
  }

  ngOnInit(): void {
    this.LoadAccountSettings();
    if (this.Page === 'ReportUpload') this.InitializeReportUploadFlow();
    if (this.Page === 'OperationLog') this.InitializeOperationLogDateRange();
    const NavigationState =
      this.router.getCurrentNavigation()?.extras.state ?? history.state;
    if (NavigationState?.['NotificationCenterTab'] === 'Unread')
      this.NotificationCenterTab = 'Unread';
    if (this.Page === 'ReportParameter') {
      this.RestoreParameterSearchState(
        NavigationState?.['ParameterSearchState'],
      );
      this.ParameterReportSelectionNotice = NavigationState?.[
        'ReportSelectionRequired'
      ]
        ? '請先選擇報表。'
        : '';
    }
    if (this.Page === 'ReportPreview' && !this.Auth.SelectedReport) {
      void this.router.navigate(['/reports/parameters'], {
        state: { ReportSelectionRequired: true },
      });
      return;
    }
    if (this.Page === 'ReportPreview') {
      this.ReportPreviewOrigin = this.ToReportPreviewOrigin(
        NavigationState?.['ReportPreviewOrigin'],
      );
      this.ReturnToParameterSearchState = this.ToParameterSearchState(
        NavigationState?.['ParameterSearchState'],
      );
    }
    this.IsReportParameterMode =
      this.Page === 'ReportParameter' &&
      this.router.getCurrentNavigation()?.extras.state?.[
        'OpenReportParameters'
      ] === true;
    if (this.IsReportParameterMode) this.LoadReportParameterForm();
  }

  ngAfterViewInit(): void {
    this.ScheduleRoleCardNavigationUpdate();
    const Viewport = this.roleCardViewport?.nativeElement;
    if (!Viewport || typeof ResizeObserver === 'undefined') return;
    this.roleCardResizeObserver = new ResizeObserver(() =>
      this.UpdateRoleCardNavigation(),
    );
    this.roleCardResizeObserver.observe(Viewport);
  }

  ngAfterViewChecked(): void {
    if (this.ShouldFocusNotificationDetailClose) {
      const CloseButton = this.notificationDetailCloseButton?.nativeElement;
      if (CloseButton) {
        CloseButton.focus();
        this.ShouldFocusNotificationDetailClose = false;
      }
    }
    if (this.PendingNotificationDetailFocus?.isConnected) {
      this.PendingNotificationDetailFocus.focus();
      this.PendingNotificationDetailFocus = null;
    }
    if (this.ShouldFocusReportDiscardContinue) {
      const ContinueButton = this.reportDiscardContinueButton?.nativeElement;
      if (ContinueButton) {
        ContinueButton.focus();
        this.ShouldFocusReportDiscardContinue = false;
      }
    }
    if (this.PendingReportEditorFocus?.isConnected) {
      this.PendingReportEditorFocus.focus();
      this.PendingReportEditorFocus = null;
    }
  }

  ngOnDestroy(): void {
    this.roleCardResizeObserver?.disconnect();
  }

  get SuccessToastMessage(): string {
    return this.Notifications.SuccessMessage;
  }

  get PageTitle(): string {
    const PageTitles: Readonly<Record<DemoPortalPage, string>> = {
      ReportList: '收藏的報表',
      ReportParameter: '所有報表',
      ReportPreview: '報表預覽',
      AccountSettings: '帳號設定',
      UserManagement: '使用者管理',
      RptManagement: '報表管理',
      ReportUpload: '上傳報表',
      DatabaseConnection: 'MSSQL 資料庫連線管理',
      OperationLog: '操作紀錄查詢',
      NotificationCenter: '通知中心',
    };
    return PageTitles[this.Page];
  }

  get NotificationBadgeCount(): number {
    return this.CurrentNotificationAccount
      ? this.NotificationCenter.GetUnreadNotificationCount(
          this.CurrentNotificationAccount,
        )
      : 0;
  }

  get ProfileAccount(): string {
    return this.Auth.CurrentIdentity?.Account ?? '';
  }
  get RecentCenterItems(): readonly MockCenterNotification[] {
    const Notifications = this.CurrentNotifications;
    return (this.NotificationPopoverTab === 'Unread'
      ? Notifications.filter((Item) => !Item.ReadAt)
      : Notifications)
      .slice(0, 4);
  }

  get CurrentNotificationAccount(): string {
    return this.Auth.CurrentIdentity?.Account ?? '';
  }

  get CurrentNotifications() {
    return this.CurrentNotificationAccount
      ? this.NotificationCenter.GetNotifications(this.CurrentNotificationAccount)
      : [];
  }

  get DisplayedNotifications() {
    return this.NotificationCenterTab === 'Unread'
      ? this.CurrentNotifications.filter((Item) => !Item.ReadAt)
      : this.CurrentNotifications;
  }

  get FavoriteReports(): readonly MockFavoriteReport[] {
    const Account = this.Auth.CurrentUser?.Account;
    return Account && this.Auth.IsFrontOffice
      ? this.MockRbac.GetFavoriteReports(Account)
      : [];
  }

  get FavoriteReportCategories() {
    const CategoryIds = new Set(
      this.FavoriteReports.map(({ Report }) => Report.CategoryId),
    );
    return this.MockRbac.GetCategories().filter((Category) =>
      CategoryIds.has(Category.CategoryId),
    );
  }

  get DisplayedFavoriteReports(): readonly MockFavoriteReport[] {
    const Direction = this.FavoriteReportSortDirection === 'asc' ? 1 : -1;
    const SearchText =
      this.FavoriteSearchText.trim().toLocaleLowerCase('zh-Hant');
    return this.FavoriteReports.filter(
      ({ Report }) =>
        (this.SelectedFavoriteCategoryId === this.AllCategoryFilterValue ||
          Report.CategoryId === this.SelectedFavoriteCategoryId) &&
        (!SearchText ||
          Report.ReportName.toLocaleLowerCase('zh-Hant').includes(SearchText) ||
          Report.Description.toLocaleLowerCase('zh-Hant').includes(SearchText)),
    ).sort((Left, Right) => {
      if (this.FavoriteReportSortField === 'ReportName') {
        return (
          Left.Report.ReportName.localeCompare(
            Right.Report.ReportName,
            'zh-Hant',
          ) * Direction
        );
      }
      const LeftTimestamp =
        this.FavoriteReportSortField === 'FavoritedAt'
          ? Left.FavoritedAt
          : Left.LastUsedAt;
      const RightTimestamp =
        this.FavoriteReportSortField === 'FavoritedAt'
          ? Right.FavoritedAt
          : Right.LastUsedAt;
      if (!LeftTimestamp && !RightTimestamp) {
        return Left.Report.ReportName.localeCompare(
          Right.Report.ReportName,
          'zh-Hant',
        );
      }
      if (!LeftTimestamp) return 1;
      if (!RightTimestamp) return -1;
      return (
        (new Date(LeftTimestamp).getTime() -
          new Date(RightTimestamp).getTime()) *
        Direction
      );
    });
  }

  SetFavoriteCategory(CategoryId: string): void {
    this.SelectedFavoriteCategoryId = CategoryId;
  }

  ToggleFavoriteReportNameSort(): void {
    this.ToggleFavoriteReportSort('ReportName');
  }

  ToggleFavoriteAtSort(): void {
    this.ToggleFavoriteReportSort('FavoritedAt');
  }

  ToggleFavoriteLastUsedSort(): void {
    this.ToggleFavoriteReportSort('LastUsedAt');
  }

  GetFavoriteReportSortIndicator(
    Field: FavoriteReportSortField,
  ): '↕' | '↑' | '↓' {
    if (
      !this.IsFavoriteReportSortActive ||
      this.FavoriteReportSortField !== Field
    ) {
      return '↕';
    }
    return this.FavoriteReportSortDirection === 'asc' ? '↑' : '↓';
  }

  GetFavoriteReportAriaSort(
    Field: FavoriteReportSortField,
  ): 'none' | 'ascending' | 'descending' {
    if (
      !this.IsFavoriteReportSortActive ||
      this.FavoriteReportSortField !== Field
    ) {
      return 'none';
    }
    return this.FavoriteReportSortDirection === 'asc'
      ? 'ascending'
      : 'descending';
  }

  private ToggleFavoriteReportSort(Field: FavoriteReportSortField): void {
    if (this.FavoriteReportSortField === Field) {
      this.FavoriteReportSortDirection =
        this.FavoriteReportSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.FavoriteReportSortField = Field;
      this.FavoriteReportSortDirection = 'asc';
    }
    this.IsFavoriteReportSortActive = true;
  }

  FormatFavoriteLastUsedAt(LastUsedAt: string | null): string {
    if (!LastUsedAt) return '尚未使用';
    const DateValue = new Date(LastUsedAt);
    if (Number.isNaN(DateValue.getTime())) return '尚未使用';
    const Pad = (Value: number) => Value.toString().padStart(2, '0');
    return `${DateValue.getFullYear()}/${Pad(DateValue.getMonth() + 1)}/${Pad(
      DateValue.getDate(),
    )} ${Pad(DateValue.getHours())}:${Pad(DateValue.getMinutes())}`;
  }

  FormatFavoriteAt(FavoritedAt: string | null): string {
    if (!FavoritedAt) return '—';
    return this.FormatFavoriteLastUsedAt(FavoritedAt);
  }

  RemoveFavoriteReport(Favorite: MockFavoriteReport): void {
    const Account = this.Auth.CurrentUser?.Account;
    if (!Account || !this.Auth.IsFrontOffice) return;
    if (
      !this.MockRbac.RemoveFavoriteReport(Account, Favorite.Report.ReportKey)
    ) {
      return;
    }
    if (
      this.SelectedFavoriteCategoryId !== this.AllCategoryFilterValue &&
      !this.FavoriteReportCategories.some(
        (Category) => Category.CategoryId === this.SelectedFavoriteCategoryId,
      )
    ) {
      this.SelectedFavoriteCategoryId = this.AllCategoryFilterValue;
    }
    this.ShowSuccessToast(`已取消收藏「${Favorite.Report.ReportName}」。`);
  }

  IsFavoriteReport(ReportKey: MockReportKey): boolean {
    const Account = this.Auth.CurrentUser?.Account;
    return Account && this.Auth.IsFrontOffice
      ? this.MockRbac.IsFavoriteReport(Account, ReportKey)
      : false;
  }

  ToggleFavoriteReport(ReportKey: MockReportKey): void {
    const Account = this.Auth.CurrentUser?.Account;
    if (!Account || !this.Auth.IsFrontOffice) return;
    const IsFavorite = this.MockRbac.ToggleFavoriteReport(Account, ReportKey);
    const Report = this.Auth.AccessibleReports.find(
      (Entry) => Entry.ReportKey === ReportKey,
    );
    if (!Report) return;
    this.ShowSuccessToast(
      IsFavorite
        ? `已收藏「${Report.ReportName}」。`
        : `已取消收藏「${Report.ReportName}」。`,
    );
  }

  get ParameterReports() {
    return this.Auth.AccessibleReports;
  }

  get ParameterReportCategoryTabs(): readonly ParameterReportCategoryTab[] {
    const Reports = this.ParameterReports;
    return [
      {
        CategoryId: this.AllCategoryFilterValue,
        CategoryName: '全部',
        Count: Reports.length,
      },
      ...this.MockRbac.GetReportFilterCategories(this.Auth.ActiveRoles).map(
        (Category) => ({
          CategoryId: Category.CategoryId,
          CategoryName: Category.CategoryName,
          Count: Reports.filter(
            (Report) => Report.CategoryId === Category.CategoryId,
          ).length,
        }),
      ),
    ];
  }

  SetParameterReportCategory(CategoryId: string): void {
    this.SelectedParameterReportCategoryId = CategoryId;
    this.ResetParameterReportPagination();
  }

  get ParameterReportCategories() {
    return this.ParameterReportCategoryTabs.slice(1);
  }

  get ParameterReportDateValidationMessage(): string {
    return this.ParameterReportDateNotice;
  }

  OnParameterReportDateChange(): void {
    this.ResetParameterReportPagination();
    this.ParameterReportDateNotice = '';
    if (
      this.ParameterReportStartDate &&
      this.ParameterReportEndDate &&
      this.IsDateOnlyBefore(
        this.ParameterReportEndDate,
        this.ParameterReportStartDate,
      )
    ) {
      this.ParameterReportEndDate = this.ParameterReportStartDate;
      this.ParameterReportDateNotice =
        '結束日期不得早於開始日期，已同步為開始日期，請重新選擇。';
    }
  }

  get DisplayedParameterReports() {
    const SearchText =
      this.ParameterReportSearchText.trim().toLocaleLowerCase();
    const Reports = this.ParameterReports.filter(
      (Report) =>
        (this.SelectedParameterReportCategoryId ===
          this.AllCategoryFilterValue ||
          Report.CategoryId === this.SelectedParameterReportCategoryId) &&
        (!SearchText ||
          `${Report.ReportName} ${Report.CategoryName} ${Report.Description}`
            .toLocaleLowerCase()
            .includes(SearchText)),
    );
    if (!this.ParameterReportSortField) return Reports;

    const SortField = this.ParameterReportSortField;
    const Direction = this.ParameterReportSortDirection === 'asc' ? 1 : -1;
    return [...Reports].sort((Left, Right) => {
      if (SortField === 'ReportName') {
        return (
          Left.ReportName.localeCompare(Right.ReportName, 'zh-Hant') * Direction
        );
      }
      return (
        (new Date(Left[SortField]).getTime() -
          new Date(Right[SortField]).getTime()) *
        Direction
      );
    });
  }

  get HasParameterReportSearchText(): boolean {
    return Boolean(this.ParameterReportSearchText.trim());
  }

  get HasParameterReportFilters(): boolean {
    return (
      this.HasParameterReportSearchText ||
      Boolean(this.ParameterReportStartDate) ||
      Boolean(this.ParameterReportEndDate) ||
      this.SelectedParameterReportCategoryId !== this.AllCategoryFilterValue
    );
  }

  get ParameterReportFilterSummary(): string {
    const Filters: string[] = [];
    if (this.HasParameterReportSearchText)
      Filters.push(`關鍵字「${this.ParameterReportSearchText.trim()}」`);
    const Category = this.ParameterReportCategories.find(
      (Item) => Item.CategoryId === this.SelectedParameterReportCategoryId,
    );
    if (Category) Filters.push(`分類「${Category.CategoryName}」`);
    if (this.ParameterReportStartDate || this.ParameterReportEndDate) {
      Filters.push(
        `資料期間 ${this.ParameterReportStartDate || '不限'} 至 ${this.ParameterReportEndDate || '不限'}`,
      );
    }
    return Filters.join('、');
  }

  get ParameterReportTotalPages(): number {
    return this.GetTotalPages(this.DisplayedParameterReports.length);
  }

  get ParameterReportPageNumbers(): readonly number[] {
    return this.GetPageNumbers(this.ParameterReportTotalPages);
  }

  get PagedParameterReports() {
    return this.GetPagedItems(
      this.DisplayedParameterReports,
      this.ParameterReportCurrentPage,
    );
  }

  OnParameterReportSearchChange(): void {
    this.ResetParameterReportPagination();
  }

  ClearParameterReportSearch(): void {
    if (!this.ParameterReportSearchText) return;
    this.ParameterReportSearchText = '';
    this.OnParameterReportSearchChange();
    this.parameterReportSearchInput?.nativeElement.focus();
  }

  ClearParameterReportFilters(): void {
    this.ParameterReportSearchText = '';
    this.ParameterReportStartDate = '';
    this.ParameterReportEndDate = '';
    this.SelectedParameterReportCategoryId = this.AllCategoryFilterValue;
    this.ParameterReportDateNotice = '';
    this.ResetParameterReportPagination();
    this.parameterReportSearchInput?.nativeElement.focus();
  }

  ResetParameterReportPagination(): void {
    this.ParameterReportCurrentPage = 1;
  }

  GoToParameterReportPage(Page: number): void {
    this.ParameterReportCurrentPage = this.ClampPage(
      Page,
      this.DisplayedParameterReports.length,
    );
  }

  PreviousParameterReportPage(): void {
    this.GoToParameterReportPage(this.ParameterReportCurrentPage - 1);
  }

  NextParameterReportPage(): void {
    this.GoToParameterReportPage(this.ParameterReportCurrentPage + 1);
  }

  get OperationLogMinimumDate(): string {
    return this.ToDateInputValue(this.GetDateDaysAgo(179));
  }

  get OperationLogMaximumDate(): string {
    return this.ToDateInputValue(new Date());
  }

  get FilteredOperationLogs(): readonly MockAuditLogEntry[] {
    const SearchText = this.OperationLogSearchText.trim().toLocaleLowerCase();
    const FilteredLogs = this.AuditLog.OperationLogs.filter((Entry) => {
      const OccurredDate = Entry.OccurredAt.slice(0, 10);
      const MatchesDate =
        (!this.OperationLogStartDate || OccurredDate >= this.OperationLogStartDate) &&
        (!this.OperationLogEndDate || OccurredDate <= this.OperationLogEndDate);
      const MatchesSearch = !SearchText ||
        `${Entry.UserId} ${Entry.TargetId} ${Entry.IpAddress} ${Entry.Summary}`
          .toLocaleLowerCase()
          .includes(SearchText);
      return MatchesDate && MatchesSearch &&
        (this.OperationLogCategoryFilter === 'ALL' || Entry.Category === this.OperationLogCategoryFilter) &&
        (this.OperationLogSourceFilter === 'ALL' || Entry.Source === this.OperationLogSourceFilter);
    });
    const Direction = this.OperationLogSortDirection === 'asc' ? 1 : -1;
    return [...FilteredLogs].sort((Left, Right) => {
      if (this.OperationLogSortField === 'OccurredAt')
        return (new Date(Left.OccurredAt).getTime() - new Date(Right.OccurredAt).getTime()) * Direction;
      return Left.UserId.localeCompare(Right.UserId, 'zh-Hant') * Direction;
    });
  }

  get OperationLogAvailableCategoryOptions(): readonly OperationLogCategoryOption[] {
    return this.OperationLogCategoryOptionsBySource[this.OperationLogSourceFilter];
  }

  get OperationLogTotalPages(): number {
    return this.GetTotalPages(this.FilteredOperationLogs.length);
  }

  get OperationLogPageNumbers(): readonly number[] {
    return this.GetPageNumbers(this.OperationLogTotalPages);
  }

  get PagedOperationLogs(): readonly MockAuditLogEntry[] {
    return this.GetPagedItems(this.FilteredOperationLogs, this.OperationLogCurrentPage);
  }

  OnOperationLogFilterChange(): void {
    this.OperationLogCurrentPage = 1;
  }

  OnOperationLogSourceChange(): void {
    const IsCurrentCategoryAllowed = this.OperationLogAvailableCategoryOptions.some(
      (Option) => Option.Value === this.OperationLogCategoryFilter,
    );
    if (!IsCurrentCategoryAllowed) {
      this.OperationLogCategoryFilter = 'ALL';
    }
    this.OnOperationLogFilterChange();
  }

  ToggleOperationLogSort(Field: OperationLogSortField): void {
    this.OperationLogSortDirection = this.OperationLogSortField === Field
      ? (this.OperationLogSortDirection === 'asc' ? 'desc' : 'asc')
      : 'asc';
    this.OperationLogSortField = Field;
    this.OnOperationLogFilterChange();
  }

  OperationLogSortIndicator(Field: OperationLogSortField): string {
    if (this.OperationLogSortField !== Field) return '↕';
    return this.OperationLogSortDirection === 'asc' ? '↑' : '↓';
  }

  OperationLogSortAria(Field: OperationLogSortField): 'ascending' | 'descending' | 'none' {
    if (this.OperationLogSortField !== Field) return 'none';
    return this.OperationLogSortDirection === 'asc' ? 'ascending' : 'descending';
  }

  OnOperationLogDateChange(): void {
    if (this.OperationLogStartDate < this.OperationLogMinimumDate)
      this.OperationLogStartDate = this.OperationLogMinimumDate;
    if (this.OperationLogEndDate > this.OperationLogMaximumDate)
      this.OperationLogEndDate = this.OperationLogMaximumDate;
    if (this.OperationLogStartDate && this.OperationLogEndDate && this.OperationLogEndDate < this.OperationLogStartDate)
      this.OperationLogEndDate = this.OperationLogStartDate;
    this.OnOperationLogFilterChange();
  }

  GoToOperationLogPage(Page: number): void {
    this.OperationLogCurrentPage = this.ClampPage(Page, this.FilteredOperationLogs.length);
  }

  PreviousOperationLogPage(): void {
    this.GoToOperationLogPage(this.OperationLogCurrentPage - 1);
  }

  NextOperationLogPage(): void {
    this.GoToOperationLogPage(this.OperationLogCurrentPage + 1);
  }

  OpenOperationLogDetail(Entry: MockAuditLogEntry): void {
    this.SelectedOperationLog = Entry;
  }

  CloseOperationLogDetail(): void {
    this.SelectedOperationLog = null;
  }

  OperationLogCategoryLabel(Category: MockAuditLogCategory): string {
    return {
      PermissionChange: '權限變動',
      ReportAction: '報表操作',
      AccountManagement: '帳號管理',
    }[Category];
  }

  OperationLogActionLabel(Action: string): string {
    return {
      GRANT_ROLE: '授予角色',
      REVOKE_ROLE: '移除角色',
      UPDATE_ROLE_PERMISSION: '更新權限',
      REPORT_DOWNLOAD: '下載報表',
      REPORT_PREVIEW: '預覽報表',
      REPORT_EXPORT: '匯出報表',
      REPORT_PRINT: '列印報表',
      CREATE_USER: '建立帳號',
      UPDATE_USER: '更新帳號',
      DISABLE_USER: '停用帳號',
    }[Action] ?? Action;
  }

  OperationLogSourceLabel(Source: MockAuditLogSource): string {
    return Source === 'BackOffice' ? '後台' : '前台';
  }

  FormatOperationLogTime(OccurredAt: string): string {
    return new Date(OccurredAt).toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  ToggleParameterReportSort(Field: ParameterReportSortField): void {
    this.ResetParameterReportPagination();
    if (this.ParameterReportSortField === Field) {
      this.ParameterReportSortDirection =
        this.ParameterReportSortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.ParameterReportSortField = Field;
    this.ParameterReportSortDirection = 'asc';
  }

  GetParameterReportSortIndicator(Field: ParameterReportSortField): string {
    if (this.ParameterReportSortField !== Field) return '↕';
    return this.ParameterReportSortDirection === 'asc' ? '↑' : '↓';
  }

  GetParameterReportAriaSort(
    Field: ParameterReportSortField,
  ): 'ascending' | 'descending' | 'none' {
    if (this.ParameterReportSortField !== Field) return 'none';
    return this.ParameterReportSortDirection === 'asc'
      ? 'ascending'
      : 'descending';
  }

  get AdminDescription(): string {
    const Descriptions: Partial<Record<DemoPortalPage, string>> = {
      UserManagement: '檢視使用者帳號、角色與啟用狀態的 Mock 清單。',
      DatabaseConnection: '檢視資料庫連線設定畫面；不會顯示或連線真實帳密。',
    };
    return Descriptions[this.Page] ?? '';
  }

  get FilteredUsers() {
    const NormalizedSearchText = this.UserSearchText.trim().toLowerCase();
    return this.MockRbac.Users.filter(
      (User) =>
        (!this.UserRoleFilter || User.Roles.includes(this.UserRoleFilter)) &&
        (!NormalizedSearchText ||
          `${User.Account} ${User.DisplayName}`
            .toLowerCase()
            .includes(NormalizedSearchText)),
    );
  }

  GetRoleAvatarUsers(RoleKey: MockRoleKey): readonly MockUser[] {
    return this.MockRbac.Users.filter((User) =>
      User.Roles.includes(RoleKey),
    ).slice(0, 4);
  }

  get UserTotalPages(): number {
    return this.GetTotalPages(this.FilteredUsers.length);
  }

  get UserPageNumbers(): readonly number[] {
    return this.GetPageNumbers(this.UserTotalPages);
  }

  get PagedUsers(): readonly MockUser[] {
    return this.GetPagedItems(this.FilteredUsers, this.UserCurrentPage);
  }

  OnUserSearchChange(): void {
    this.ResetUserPagination();
  }

  ResetUserPagination(): void {
    this.UserCurrentPage = 1;
  }

  GoToUserPage(Page: number): void {
    this.UserCurrentPage = this.ClampPage(Page, this.FilteredUsers.length);
  }

  PreviousUserPage(): void {
    this.GoToUserPage(this.UserCurrentPage - 1);
  }

  NextUserPage(): void {
    this.GoToUserPage(this.UserCurrentPage + 1);
  }

  get VisibleReportParameters(): readonly MockReportParameterDefinition[] {
    return this.ReportParameterDefinitions.filter(
      (Definition) => Definition.IsVisible,
    ).sort((Left, Right) => Left.DisplayOrder - Right.DisplayOrder);
  }

  get SelectedReportKey(): MockReportKey | null {
    return this.Auth.SelectedReport?.ReportKey ?? null;
  }

  get ReportPreviewReturnLabel(): string {
    return this.ReportPreviewOrigin === 'favorites'
      ? '返回我的收藏'
      : '返回所有報表';
  }

  get CanGenerateReport(): boolean {
    return Boolean(
      this.Auth.SelectedReportCategoryPermission.CanExecute &&
      this.SelectedReportKey &&
      this.ReportParameterForm.valid &&
      this.VisibleReportParameters.every(
        (Definition) =>
          !this.UsesLov(Definition) ||
          this.GetLovStatus(Definition) === 'success',
      ),
    );
  }

  GetControlKind(
    Definition: MockReportParameterDefinition,
  ): 'range' | 'textarea' | 'checkbox' | 'select' | 'input' {
    if (Definition.AllowRangeValues) return 'range';
    if (Definition.InputType === 'LongText') return 'textarea';
    if (Definition.InputType === 'Checkbox') return 'checkbox';
    if (
      Definition.InputType === 'SingleSelect' ||
      Definition.InputType === 'MultiSelect'
    ) {
      return 'select';
    }
    return 'input';
  }

  GetInputHtmlType(Definition: MockReportParameterDefinition): string {
    const TypeByInputType: Readonly<
      Partial<Record<MockParameterInputType, string>>
    > = {
      Date: 'date',
      DateTime: 'datetime-local',
      Number: 'number',
      Text: 'text',
    };
    return TypeByInputType[Definition.InputType] ?? 'text';
  }

  UsesLov(Definition: MockReportParameterDefinition): boolean {
    return Definition.ValueSourceType === 'SqlLov';
  }

  GetLovStatus(Definition: MockReportParameterDefinition): MockLovStatus {
    const ReportKey = this.SelectedReportKey;
    return ReportKey
      ? this.ReportParameters.GetLovStatus(ReportKey, Definition.ParameterName)
      : 'error';
  }

  GetLovOptions(Definition: MockReportParameterDefinition) {
    const ReportKey = this.SelectedReportKey;
    if (!ReportKey) return [];
    return Definition.ValueSourceType === 'SqlLov'
      ? this.ReportParameters.GetLovOptions(ReportKey, Definition.ParameterName)
      : (Definition.Options ?? []);
  }

  RetryLov(Definition: MockReportParameterDefinition): void {
    const ReportKey = this.SelectedReportKey;
    if (!ReportKey) return;
    this.ReportParameters.RetryLov(ReportKey, Definition.ParameterName);
    this.ReportParameterForm.updateValueAndValidity();
  }

  OnRangeValueChange(Definition: MockReportParameterDefinition): void {
    if (Definition.DataType !== 'Date') return;
    const RangeControl = this.GetRangeControl(Definition);
    if (!RangeControl) return;

    const Start = RangeControl.controls['Start'].value;
    const End = RangeControl.controls['End'].value;
    if (!this.IsDateOnlyBefore(End, Start)) {
      delete this.ParameterRangeErrors[Definition.ParameterName];
      return;
    }

    RangeControl.controls['End'].setValue(Start);
    this.ParameterRangeErrors[Definition.ParameterName] =
      '結束日期不得早於開始日期，已同步為開始日期，請重新選擇。';
  }

  GetRangeStartValue(Definition: MockReportParameterDefinition): string | null {
    if (Definition.DataType !== 'Date') return null;
    const RangeControl = this.GetRangeControl(Definition);
    const StartValue = RangeControl?.controls['Start'].value;
    return typeof StartValue === 'string' && StartValue ? StartValue : null;
  }

  ResetReportParameters(): void {
    this.ReportParameterForm = this.BuildParameterForm(
      this.VisibleReportParameters,
    );
    Object.keys(this.ParameterRangeErrors).forEach(
      (Key) => delete this.ParameterRangeErrors[Key],
    );
    this.LastMockExecutionParameters = null;
  }

  GetParameterError(Definition: MockReportParameterDefinition): string {
    const Control = this.ReportParameterForm.get(Definition.ParameterName);
    if (!Control || !(Control.touched || Control.dirty)) return '';
    if (this.ParameterRangeErrors[Definition.ParameterName]) {
      return this.ParameterRangeErrors[Definition.ParameterName];
    }
    const ErrorControl = this.GetErrorControl(Control);
    if (ErrorControl.hasError('required')) return '此欄位為必填。';
    if (ErrorControl.hasError('integer')) return '請輸入整數。';
    if (ErrorControl.hasError('number')) return '請輸入有效數字。';
    if (ErrorControl.hasError('date')) return '請輸入有效日期。';
    if (ErrorControl.hasError('dateTime')) return '請輸入有效日期時間。';
    if (Control.hasError('range')) {
      return Definition.DataType === 'Date'
        ? '結束日期不得早於開始日期。'
        : '結束值不得小於開始值。';
    }
    return '';
  }

  SelectReportByKey(ReportKey: MockReportKey): void {
    const Report = this.Auth.AccessibleReports.find(
      (Entry) => Entry.ReportKey === ReportKey,
    );
    if (!Report?.Enabled) return;
    this.Auth.SelectReport(ReportKey);
    const Account = this.Auth.CurrentUser?.Account;
    if (Account) this.MockRbac.RecordReportExecution(Account, ReportKey);
    void this.router.navigate(['/reports/preview'], {
      state: { ReportPreviewOrigin: 'favorites' },
    });
  }

  SelectReportForParameters(ReportKey: MockReportKey): void {
    const Report = this.ParameterReports.find(
      (Entry) => Entry.ReportKey === ReportKey,
    );
    if (!Report) return;
    this.Auth.SelectReport(ReportKey);
    this.IsReportParameterMode = true;
    this.LoadReportParameterForm();
  }

  SelectReportForPreview(ReportKey: MockReportKey): void {
    const Report = this.ParameterReports.find(
      (Entry) => Entry.ReportKey === ReportKey,
    );
    if (!Report) return;
    this.Auth.SelectReport(
      ReportKey,
      this.ParameterReportStartDate && this.ParameterReportEndDate
        ? {
            StartDate: this.ParameterReportStartDate,
            EndDate: this.ParameterReportEndDate,
          }
        : null,
    );
    const Account = this.Auth.CurrentUser?.Account;
    if (Account) this.MockRbac.RecordReportExecution(Account, ReportKey);
    void this.router.navigate(['/reports/preview'], {
      state: {
        ReportPreviewOrigin: 'all',
        ParameterSearchState: this.CreateParameterSearchState(),
      },
    });
  }

  ReturnToReportList(): void {
    if (this.ReportPreviewOrigin === 'favorites') {
      void this.router.navigate(['/reports']);
      return;
    }
    void this.router.navigate(['/reports/parameters'], {
      state: this.ReturnToParameterSearchState
        ? { ParameterSearchState: this.ReturnToParameterSearchState }
        : undefined,
    });
  }

  ReturnToParameterReportSearch(): void {
    this.IsReportParameterMode = false;
  }

  BrowseAllReports(): void {
    if (!this.Auth.IsFrontOffice) return;
    void this.router.navigate(['/reports/parameters']);
  }

  ExecuteReport(): void {
    if (!this.CanGenerateReport) {
      this.ReportParameterForm.markAllAsTouched();
      return;
    }
    this.LastMockExecutionParameters = this.SerializeReportParameters();
    const Account = this.Auth.CurrentUser?.Account;
    if (Account && this.SelectedReportKey) {
      this.MockRbac.RecordReportExecution(Account, this.SelectedReportKey);
    }
    void this.router.navigate(['/reports/preview']);
  }

  ToggleExportMenu(): void {
    if (!this.Auth.SelectedReportCategoryPermission.CanExport) return;
    this.IsPrintMenuOpen = false;
    this.IsExportMenuOpen = !this.IsExportMenuOpen;
  }

  SelectExportOption(Option: MockExportOption): void {
    if (
      !this.Auth.SelectedReportCategoryPermission.CanExport ||
      !Option.Enabled ||
      !this.ExportOptions.includes(Option)
    )
      return;
    this.IsExportMenuOpen = false;
    this.MockNotice = `${Option.Label} 匯出目前為前端 Mock 操作，尚未串接正式報表匯出服務。`;
  }

  SelectOutputAction(ActionName: 'BrowserPrint' | 'FixedPrinterPrint'): void {
    if (!this.Auth.SelectedReportCategoryPermission.CanPrint) return;
    this.IsPrintMenuOpen = false;
    const ActionLabel =
      ActionName === 'BrowserPrint' ? '瀏覽器列印' : '固定印表機列印';
    this.MockNotice = `${ActionLabel}目前為前端 Mock 操作，尚未串接正式列印服務。`;
  }

  TogglePrintMenu(): void {
    if (!this.Auth.SelectedReportCategoryPermission.CanPrint) return;
    this.IsExportMenuOpen = false;
    this.IsPrintMenuOpen = !this.IsPrintMenuOpen;
  }

  Logout(): void {
    this.Auth.Logout();
    this.Notifications.ShowSuccess('登出成功！');
    void this.router.navigate(['/login']);
  }

  ToggleNotificationPanel(): void {
    if (this.SelectedCenterNotification) return;
    this.IsProfileMenuOpen = false;
    this.IsNotificationPanelOpen = !this.IsNotificationPanelOpen;
    if (this.IsNotificationPanelOpen) {
      this.NotificationPopoverTab = 'All';
    }
  }

  ToggleProfileMenu(): void {
    this.IsNotificationPanelOpen = false;
    this.IsProfileMenuOpen = !this.IsProfileMenuOpen;
  }

  SetNotificationPopoverTab(
    Tab: 'All' | 'Unread',
  ): void {
    this.NotificationPopoverTab = Tab;
  }

  OpenNotificationCenter(
    Tab: 'All' | 'Unread' = 'All',
  ): void {
    if (this.Auth.RequiresBackOfficeIdentityBinding) return;
    this.IsNotificationPanelOpen = false;
    void this.router.navigate(
      [
        this.Auth.IsBackOffice
          ? '/admin/notification-center'
          : '/notification-center',
      ],
      { state: { NotificationCenterTab: Tab } },
    );
  }

  MarkCenterNotificationRead(Id: string): void {
    if (this.Auth.RequiresBackOfficeIdentityBinding) return;
    const Account = this.CurrentNotificationAccount;
    if (Account) this.NotificationCenter.MarkNotificationRead(Id, Account);
  }

  OpenNotificationDetail(Notification: MockCenterNotification): void {
    if (this.Auth.RequiresBackOfficeIdentityBinding) return;
    this.NotificationDetailOpener = this.GetActiveHTMLElement();
    this.SelectedCenterNotification = Notification;
    this.MarkCenterNotificationRead(Notification.Id);
    this.ShouldFocusNotificationDetailClose = true;
  }

  CloseNotificationDetail(): void {
    if (!this.SelectedCenterNotification) return;
    this.SelectedCenterNotification = null;
    this.ShouldFocusNotificationDetailClose = false;
    this.PendingNotificationDetailFocus = this.NotificationDetailOpener;
    this.NotificationDetailOpener = null;
  }

  SubmitBackOfficeIdentityBinding(): void {
    this.BackOfficeBindingError = '';
    if (!this.BackOfficeBindingAccount || !this.BackOfficeBindingPassword) {
      this.BackOfficeBindingError = '請輸入前台帳號與密碼。';
      return;
    }
    if (!this.Auth.BindBackOfficeIdentity(
      this.BackOfficeBindingAccount,
      this.BackOfficeBindingPassword,
    )) {
      this.BackOfficeBindingError =
        this.Auth.LastBackOfficeIdentityBindingFailure === 'disabled'
          ? '此帳號已停用。'
          : '帳號或密碼不正確，請重新輸入。';
      return;
    }
    this.AuditLog.RecordBackOfficeAction('後台身分綁定', '完成後台操作 session 的前台身分驗證。');
    this.Notifications.ShowSuccess('身分驗證成功，已進入後台。');
    this.BackOfficeBindingAccount = '';
    this.BackOfficeBindingPassword = '';
  }

  ReturnToLoginFromBackOfficeBinding(): void {
    if (!this.Auth.RequiresBackOfficeIdentityBinding) return;
    this.Auth.Logout();
    void this.router.navigate(['/login']);
  }

  EditUser(Account: string): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const User = this.MockRbac.Users.find(
      (MockUser) => MockUser.Account === Account,
    );
    if (!User) return;
    this.EditingAccount = User.Account;
    this.EditingUser = {
      Roles: [...User.Roles],
      Enabled: User.Enabled,
    };
    this.EditUserValidationErrors = {};
  }

  SaveUser(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.CreateUserValidationErrors = this.GetCreateUserValidationErrors();
    if (Object.keys(this.CreateUserValidationErrors).length) return;

    const CreatedUserCredentials = this.MockRbac.CreateUser(this.UserDraft);
    this.ManagementNotice = '';
    if (!CreatedUserCredentials) {
      this.CreateUserValidationErrors = {
        Account: '此使用者帳號已存在。',
      };
      return;
    }
    this.EnsureUserPagination();
    this.CloseCreateUserDialog();
    this.CreatedUserCredentials = CreatedUserCredentials;
    this.CreatedUserCopyNotice = '';
    this.AuditLog.RecordBackOfficeAction('新增使用者', `建立前台使用者 ${CreatedUserCredentials.Account}。`);
  }

  OpenCreateUserDialog(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.UserDraft = this.CreateUserDraft();
    this.CreateUserValidationErrors = {};
    this.IsCreateUserDialogOpen = true;
  }

  CloseCreateUserDialog(): void {
    this.IsCreateUserDialogOpen = false;
    this.UserDraft = this.CreateUserDraft();
    this.CreateUserValidationErrors = {};
  }

  CloseCreatedUserSuccessModal(): void {
    this.CreatedUserCredentials = null;
    this.CreatedUserCopyNotice = '';
  }

  async CopyCreatedUserCredentials(): Promise<void> {
    if (!this.CreatedUserCredentials) return;
    const Credentials = this.CreatedUserCredentials;
    const CopyText = `帳號：${Credentials.Account}\n初始密碼：${Credentials.InitialPassword}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(CopyText);
      } else if (!this.CopyTextWithFallback(CopyText)) {
        throw new Error('Clipboard is unavailable');
      }
      this.CreatedUserCopyNotice = '帳號與初始密碼已複製。';
    } catch {
      this.CreatedUserCopyNotice = '無法自動複製，請手動複製帳密。';
    }
  }

  SetUserRoleFilter(RoleKey: MockRoleKey | null): void {
    this.UserRoleFilter = RoleKey;
    this.ResetUserPagination();
  }

  GetRoleNames(Roles: readonly MockRoleKey[]): string {
    return Roles.map(
      (RoleKey) => this.MockRbac.GetRole(RoleKey)?.DisplayName ?? RoleKey,
    ).join('、');
  }

  IsRoleSelected(Roles: readonly MockRoleKey[], RoleKey: MockRoleKey): boolean {
    return Roles.includes(RoleKey);
  }

  ToggleUserRole(
    Draft: MockUserDraft | MockUserEditDraft,
    RoleKey: MockRoleKey,
    IsSelected: boolean,
  ): void {
    if (!this.Auth.CanOperateBackOffice) return;
    Draft.Roles = IsSelected
      ? this.MockRbac.NormalizeRoles([...Draft.Roles, RoleKey])
      : Draft.Roles.filter((Key) => Key !== RoleKey);
  }

  ToggleCreateUserRole(RoleKey: MockRoleKey, IsSelected: boolean): void {
    this.ToggleUserRole(this.UserDraft, RoleKey, IsSelected);
    this.ClearCreateUserValidationError('Roles');
  }

  ClearCreateUserValidationError(Field: CreateUserField): void {
    delete this.CreateUserValidationErrors[Field];
  }

  CanEditEditingUserRoles(): boolean {
    return this.Auth.CanOperateBackOffice;
  }

  ToggleEditingUserRole(RoleKey: MockRoleKey, IsSelected: boolean): void {
    if (!this.EditingUser || !this.CanEditEditingUserRoles()) return;
    this.ToggleUserRole(this.EditingUser, RoleKey, IsSelected);
    delete this.EditUserValidationErrors.Roles;
  }

  OpenDeleteUserDialog(Account: string): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.DeletingUser = this.MockRbac.GetUser(Account);
    this.DeleteUserError = '';
  }

  CloseDeleteUserDialog(): void {
    this.DeletingUser = null;
    this.DeleteUserError = '';
  }

  ConfirmDeleteUser(): void {
    if (!this.Auth.CanOperateBackOffice || !this.DeletingUser) return;
    if (this.MockRbac.DeleteUser(this.DeletingUser.Account) !== 'deleted') {
      this.DeleteUserError = '找不到要刪除的使用者。';
      return;
    }
    this.EnsureUserPagination();
    this.AuditLog.RecordBackOfficeAction('刪除使用者', `刪除前台使用者 ${this.DeletingUser.Account}。`);
    this.CloseDeleteUserDialog();
    this.ShowSuccessToast('使用者已刪除。');
  }

  ScrollRoleCards(Direction: -1 | 1): void {
    const Viewport = this.roleCardViewport?.nativeElement;
    if (
      !Viewport ||
      (Direction === -1 && !this.CanScrollRoleCardsLeft) ||
      (Direction === 1 && !this.CanScrollRoleCardsRight)
    )
      return;
    Viewport.scrollBy({
      left: Direction * Math.max(Viewport.clientWidth * 0.8, 240),
      behavior: 'smooth',
    });
    window.setTimeout(() => this.UpdateRoleCardNavigation(), 250);
  }

  UpdateRoleCardNavigation(): void {
    const Viewport = this.roleCardViewport?.nativeElement;
    if (!Viewport) {
      this.RoleCardHasOverflow = false;
      this.CanScrollRoleCardsLeft = false;
      this.CanScrollRoleCardsRight = false;
      this.IsRoleCardAtStart = true;
      this.IsRoleCardAtEnd = true;
      return;
    }
    this.RoleCardHasOverflow = Viewport.scrollWidth > Viewport.clientWidth;
    if (!this.RoleCardHasOverflow) {
      Viewport.scrollLeft = 0;
      this.CanScrollRoleCardsLeft = false;
      this.CanScrollRoleCardsRight = false;
      this.IsRoleCardAtStart = true;
      this.IsRoleCardAtEnd = true;
      return;
    }
    const BoundaryTolerance = 2;
    this.CanScrollRoleCardsLeft = Viewport.scrollLeft > BoundaryTolerance;
    this.CanScrollRoleCardsRight =
      Viewport.scrollLeft + Viewport.clientWidth <
      Viewport.scrollWidth - BoundaryTolerance;
    this.IsRoleCardAtStart = !this.CanScrollRoleCardsLeft;
    this.IsRoleCardAtEnd = !this.CanScrollRoleCardsRight;
  }

  @HostListener('window:resize')
  UpdateRoleCardNavigationOnResize(): void {
    this.UpdateRoleCardNavigation();
  }

  SaveEditedUser(): void {
    if (!this.Auth.CanOperateBackOffice || !this.EditingAccount || !this.EditingUser)
      return;
    this.EditUserValidationErrors = {};
    const Before = this.NotificationCenter.CaptureAccess(this.EditingAccount);
    const Result = this.MockRbac.SaveUserEdit(
      this.EditingAccount,
      this.EditingUser,
    );
    if (Result === 'invalid') {
      this.EditUserValidationErrors = { Roles: '請至少選擇一個角色。' };
      return;
    }
    if (Result === 'not-found') {
      this.EditUserValidationErrors = { Form: '找不到要編輯的使用者。' };
      return;
    }
    this.EnsureUserPagination();
    this.NotificationCenter.NotifyRoleAssignmentChange(
      this.EditingAccount,
      Before,
    );
    this.AuditLog.RecordBackOfficeAction('更新使用者權限', `更新前台使用者 ${this.EditingAccount} 的角色或啟用狀態。`);
    this.CancelEditUser();
    this.ShowSuccessToast('使用者資料已更新。');
  }

  CancelEditUser(): void {
    this.EditingAccount = null;
    this.EditingUser = null;
    this.EditUserValidationErrors = {};
  }

  @HostListener('document:keydown.escape')
  CloseEditUserOnEscape(): void {
    if (this.SelectedCenterNotification) this.CloseNotificationDetail();
    else if (this.IsExportMenuOpen) this.IsExportMenuOpen = false;
    else if (this.IsPrintMenuOpen) this.IsPrintMenuOpen = false;
    else if (this.IsNotificationPanelOpen) this.IsNotificationPanelOpen = false;
    else if (this.IsProfileMenuOpen) this.IsProfileMenuOpen = false;
    else if (this.DeletingCategory) this.CloseDeleteCategoryDialog();
    else if (this.IsCategoryManagementDialogOpen)
      this.CloseCategoryManagementDialog();
    else if (this.IsReportCategoryQuickAddOpen)
      this.CloseReportCategoryQuickAdd();
    else if (this.IsReportDiscardConfirmationOpen)
      this.ContinueEditingReport();
    else if (this.IsUploadReportDialogOpen || this.IsReportUploadFlow)
      this.RequestCloseReportEditor();
    else if (this.DeletingReport) this.CloseDeleteReportDialog();
    else if (this.EditingUser) this.CancelEditUser();
    else if (this.DeletingUser) this.CloseDeleteUserDialog();
    else if (this.CreatedUserCredentials) this.CloseCreatedUserSuccessModal();
    else if (this.IsCreateUserDialogOpen) this.CloseCreateUserDialog();
    else if (this.IsCreateRoleDialogOpen) this.CloseCreateRoleDialog();
    else if (this.IsEditRoleDialogOpen) this.CloseEditRoleDialog();
  }

  @HostListener('document:click', ['$event'])
  CloseExportMenuOnOutsideClick(Event: MouseEvent): void {
    const Target = Event.target;
    if (!(Target instanceof Element)) return;
    if (this.IsExportMenuOpen && !Target.closest('.export-dropdown'))
      this.IsExportMenuOpen = false;
    if (this.IsPrintMenuOpen && !Target.closest('.print-dropdown'))
      this.IsPrintMenuOpen = false;
    if (this.IsNotificationPanelOpen && !Target.closest('.notification-menu'))
      this.IsNotificationPanelOpen = false;
    if (this.IsProfileMenuOpen && !Target.closest('.profile-menu'))
      this.IsProfileMenuOpen = false;
  }

  @HostListener('document:keydown', ['$event'])
  KeepFocusInTopModal(Event: KeyboardEvent): void {
    if (Event.key !== 'Tab') return;
    const Dialog = this.SelectedCenterNotification
      ? this.notificationDetailDialog?.nativeElement
      : this.IsReportDiscardConfirmationOpen
      ? this.reportDiscardDialog?.nativeElement
      : this.IsUploadReportDialogOpen && !this.IsReportCategoryQuickAddOpen
        ? this.reportEditorDialog?.nativeElement
        : undefined;
    if (!Dialog) return;

    const FocusableElements = Array.from(
      Dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((Element) => !Element.hasAttribute('inert'));
    if (!FocusableElements.length) return;

    const FirstElement = FocusableElements[0];
    const LastElement = FocusableElements.at(-1)!;
    const ActiveElement = document.activeElement;
    if (
      Event.shiftKey &&
      (ActiveElement === FirstElement || !Dialog.contains(ActiveElement))
    ) {
      Event.preventDefault();
      LastElement.focus();
    } else if (
      !Event.shiftKey &&
      (ActiveElement === LastElement || !Dialog.contains(ActiveElement))
    ) {
      Event.preventDefault();
      FirstElement.focus();
    }
  }

  SetUserEnabled(Account: string, Enabled: boolean): void {
    if (this.Auth.CanOperateBackOffice) this.MockRbac.SetUserEnabled(Account, Enabled);
  }

  SetReportEnabled(ReportKey: MockReportKey, Enabled: boolean): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    this.MockRbac.SetReportEnabled(ReportKey, Enabled);
    this.ShowSuccessToast(
      Enabled ? '報表已在 Mock 資料中啟用。' : '報表已在 Mock 資料中停用。',
    );
  }

  get ReportManagementCategories() {
    return this.MockRbac.GetReportManagementCategories();
  }

  get CategoryManagementCategories(): readonly MockReportCategory[] {
    const Categories = this.MockRbac.GetCategories();
    return [
      ...Categories.filter((Category) => !Category.IsSystemReserved),
      ...Categories.filter((Category) => Category.IsSystemReserved),
    ];
  }

  get ReportEditorCategories() {
    return this.MockRbac.GetReportEditorCategories(
      this.ReportEditorDraft.CategoryId,
    );
  }

  get IsReportUploadFlow(): boolean {
    return this.Page === 'ReportUpload';
  }

  get ReportUploadStepNumber(): number {
    return this.ReportUploadStep === 'Form'
      ? 1
      : this.ReportUploadStep === 'Confirm'
        ? 2
        : 3;
  }

  get ReportUploadCategoryName(): string {
    return (
      this.ReportEditorCategories.find(
        (Category) => Category.CategoryId === this.ReportEditorDraft.CategoryId,
      )?.CategoryName ?? '未分類'
    );
  }

  get DisplayedManagedReports(): readonly MockReportReadModel[] {
    const SearchText =
      this.ReportManagementSearchText.trim().toLocaleLowerCase();
    const PinPositions = new Map(
      [...this.PinnedReportManagementKeys].map((ReportKey, Index) => [
        ReportKey,
        Index,
      ]),
    );
    const Reports = this.MockRbac.Reports.filter(
      (Report) =>
        (this.ReportManagementCategoryId === this.AllCategoryFilterValue ||
          Report.CategoryId === this.ReportManagementCategoryId) &&
        (!SearchText ||
          `${Report.ReportName} ${Report.Description}`
            .toLocaleLowerCase()
            .includes(SearchText)),
    );
    return [...Reports].sort((Left, Right) => {
      const LeftPinPosition = PinPositions.get(Left.ReportKey) ?? -1;
      const RightPinPosition = PinPositions.get(Right.ReportKey) ?? -1;
      if (LeftPinPosition !== RightPinPosition) {
        if (LeftPinPosition < 0) return 1;
        if (RightPinPosition < 0) return -1;
        return RightPinPosition - LeftPinPosition;
      }
      if (!this.ReportManagementSortField) return 0;

      const SortField = this.ReportManagementSortField;
      const Direction = this.ReportManagementSortDirection === 'asc' ? 1 : -1;
      if (SortField === 'ReportName') {
        return (
          Left.ReportName.localeCompare(Right.ReportName, 'zh-Hant') * Direction
        );
      }
      return (
        (new Date(Left[SortField]).getTime() -
          new Date(Right[SortField]).getTime()) *
        Direction
      );
    });
  }

  get ReportManagementTotalPages(): number {
    return this.GetTotalPages(this.DisplayedManagedReports.length);
  }

  get ReportManagementPageNumbers(): readonly number[] {
    return this.GetPageNumbers(this.ReportManagementTotalPages);
  }

  get PagedManagedReports(): readonly MockReportReadModel[] {
    return this.GetPagedItems(
      this.DisplayedManagedReports,
      this.ReportManagementCurrentPage,
    );
  }

  OnReportManagementSearchChange(): void {
    this.ResetReportManagementPagination();
  }

  IsReportManagementPinned(ReportKey: MockReportKey): boolean {
    return this.PinnedReportManagementKeys.has(ReportKey);
  }

  ToggleReportManagementPin(ReportKey: MockReportKey): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    if (this.PinnedReportManagementKeys.has(ReportKey)) {
      this.PinnedReportManagementKeys.delete(ReportKey);
    } else {
      this.PinnedReportManagementKeys.add(ReportKey);
    }
    this.ResetReportManagementPagination();
  }

  ToggleReportManagementSort(Field: ReportManagementSortField): void {
    this.ResetReportManagementPagination();
    if (this.ReportManagementSortField === Field) {
      this.ReportManagementSortDirection =
        this.ReportManagementSortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.ReportManagementSortField = Field;
    this.ReportManagementSortDirection = 'asc';
  }

  GetReportManagementSortIndicator(
    Field: ReportManagementSortField,
  ): '↕' | '↑' | '↓' {
    if (this.ReportManagementSortField !== Field) return '↕';
    return this.ReportManagementSortDirection === 'asc' ? '↑' : '↓';
  }

  GetReportManagementAriaSort(
    Field: ReportManagementSortField,
  ): 'none' | 'ascending' | 'descending' {
    if (this.ReportManagementSortField !== Field) return 'none';
    return this.ReportManagementSortDirection === 'asc'
      ? 'ascending'
      : 'descending';
  }

  SetReportManagementCategory(CategoryId: string): void {
    this.ReportManagementCategoryId = CategoryId;
    this.ResetReportManagementPagination();
  }

  ResetReportManagementPagination(): void {
    this.ReportManagementCurrentPage = 1;
  }

  GoToReportManagementPage(Page: number): void {
    this.ReportManagementCurrentPage = this.ClampPage(
      Page,
      this.DisplayedManagedReports.length,
    );
  }

  PreviousReportManagementPage(): void {
    this.GoToReportManagementPage(this.ReportManagementCurrentPage - 1);
  }

  NextReportManagementPage(): void {
    this.GoToReportManagementPage(this.ReportManagementCurrentPage + 1);
  }

  OnReportManagementDateChange(): void {
    this.ResetReportManagementPagination();
    this.ReportManagementDateNotice = '';
    if (
      this.ReportManagementStartDate &&
      this.ReportManagementEndDate &&
      this.IsDateOnlyBefore(
        this.ReportManagementEndDate,
        this.ReportManagementStartDate,
      )
    ) {
      this.ReportManagementEndDate = this.ReportManagementStartDate;
      this.ReportManagementDateNotice =
        '結束日期不得早於開始日期，已同步為開始日期，請重新選擇。';
    }
  }

  OpenCategoryManagementDialog(): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    this.NewCategoryName = '';
    this.CategoryCreateError = '';
    this.CancelCategoryEdit();
    this.CategoryDeleteError = '';
    this.IsCategoryManagementDialogOpen = true;
  }

  CloseCategoryManagementDialog(): void {
    this.IsCategoryManagementDialogOpen = false;
    this.NewCategoryName = '';
    this.CategoryCreateError = '';
    this.CancelCategoryEdit();
    this.CategoryDeleteError = '';
  }

  CreateManagedCategory(): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    const Result = this.MockRbac.CreateCategory(this.NewCategoryName);
    const Messages: Record<Exclude<typeof Result.Status, 'created'>, string> = {
      'invalid-name': '請輸入分類名稱。',
      'duplicate-name': '分類名稱已存在，請使用其他名稱。',
      'system-reserved-name': '此名稱為系統保留分類，不可建立。',
    };
    if (Result.Status !== 'created') {
      this.CategoryCreateError = Messages[Result.Status];
      return;
    }
    this.NewCategoryName = '';
    this.CategoryCreateError = '';
    this.NotificationCenter.CreateCategoryReview(
      Result.Category,
      this.Auth.CurrentUser?.Account ?? '前台使用者',
    );
    this.ShowSuccessToast(
      `新增報表分類「${Result.Category.CategoryName}」成功！`,
    );
  }

  StartCategoryEdit(Category: MockReportCategory): void {
    if (
      !this.Auth.HasManagementPermission('RptManagement') ||
      Category.IsSystemReserved
    )
      return;
    this.EditingCategoryId = Category.CategoryId;
    this.EditingCategoryName = Category.CategoryName;
    this.CategoryEditError = '';
  }

  CancelCategoryEdit(): void {
    this.EditingCategoryId = null;
    this.EditingCategoryName = '';
    this.CategoryEditError = '';
  }

  SaveCategoryEdit(): void {
    if (
      !this.Auth.HasManagementPermission('RptManagement') ||
      !this.EditingCategoryId
    )
      return;
    const Result = this.MockRbac.RenameCategory(
      this.EditingCategoryId,
      this.EditingCategoryName,
    );
    const Messages: Record<Exclude<typeof Result.Status, 'renamed'>, string> = {
      'not-found': '找不到要編輯的報表分類。',
      'invalid-name': '請輸入分類名稱。',
      'duplicate-name': '分類名稱已存在，請使用其他名稱。',
      'system-reserved': '系統保留分類不可重新命名。',
    };
    if (Result.Status !== 'renamed') {
      this.CategoryEditError = Messages[Result.Status];
      return;
    }
    this.CancelCategoryEdit();
    this.ShowSuccessToast(
      `報表分類已更新為「${Result.Category.CategoryName}」。`,
    );
  }

  OpenDeleteCategoryDialog(CategoryId: string): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    const Category = this.MockRbac.GetCategories().find(
      (Entry) => Entry.CategoryId === CategoryId,
    );
    if (!Category || Category.IsSystemReserved) return;
    this.CategoryDeleteError = '';
    this.DeletingCategory = Category;
  }

  CloseDeleteCategoryDialog(): void {
    this.DeletingCategory = null;
    this.CategoryDeleteError = '';
  }

  ConfirmDeleteCategory(): void {
    if (
      !this.Auth.HasManagementPermission('RptManagement') ||
      !this.DeletingCategory
    )
      return;
    const CategoryId = this.DeletingCategory.CategoryId;
    const Result = this.MockRbac.DeleteCategory(CategoryId);
    const Messages: Record<Exclude<typeof Result.Status, 'deleted'>, string> = {
      'not-found': '找不到要刪除的報表分類。',
      'system-reserved': '系統保留分類不可刪除。',
    };
    if (Result.Status !== 'deleted') {
      this.CategoryDeleteError = Messages[Result.Status];
      return;
    }
    if (this.ReportManagementCategoryId === CategoryId) {
      this.SetReportManagementCategory(this.AllCategoryFilterValue);
    }
    if (this.EditingCategoryId === CategoryId) this.CancelCategoryEdit();
    this.CloseDeleteCategoryDialog();
    this.ShowSuccessToast(
      Result.MovedReportCount
        ? `分類「${Result.DeletedCategoryName}」已刪除。${Result.MovedReportCount} 份報表已移至「未分類」，請重新設定報表分類。`
        : `分類「${Result.DeletedCategoryName}」已刪除。`,
    );
  }

  GetCategoryUsageCount(CategoryId: string): number {
    return this.MockRbac.GetCategoryUsageCount(CategoryId) ?? 0;
  }

  GetCategoryUsageLabel(Category: MockReportCategory): string {
    const UsageCount = this.GetCategoryUsageCount(Category.CategoryId);
    if (Category.IsSystemReserved && UsageCount > 0) {
      return `${UsageCount} 份報表待重新分類`;
    }
    return `${UsageCount} 份報表使用中`;
  }

  OpenUploadReportDialog(): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    this.RememberReportEditorOpener();
    this.EditingReportKey = null;
    this.ReportEditorDraft = this.CreateReportEditorDraft();
    this.SelectedReportFileName = '';
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
    this.IsReportDiscardConfirmationOpen = false;
    this.CloseReportCategoryQuickAdd();
    this.IsUploadReportDialogOpen = true;
    this.RememberInitialReportEditorState();
  }

  StartReportUpload(): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    void this.router.navigate(['/report-management/upload']);
  }

  ContinueReportUpload(): void {
    if (!this.IsReportUploadFlow) return;
    const Error = this.GetReportEditorValidationError();
    if (Error) {
      this.ReportEditorError = Error;
      return;
    }
    this.ReportEditorError = '';
    this.ReportUploadStep = 'Confirm';
  }

  ReturnToReportUploadForm(): void {
    if (!this.IsReportUploadFlow || this.ReportUploadStep !== 'Confirm') return;
    this.ReportUploadStep = 'Form';
  }

  PublishReportUpload(): void {
    if (!this.IsReportUploadFlow || this.ReportUploadStep !== 'Confirm') return;
    const Error = this.GetReportEditorValidationError();
    if (Error) {
      this.ReportEditorError = Error;
      this.ReportUploadStep = 'Form';
      return;
    }
    const PublishedReport = this.MockRbac.CreateReport({
      ReportName: this.ReportEditorDraft.ReportName,
      Description: this.ReportEditorDraft.Description,
      CategoryId: this.ReportEditorDraft.CategoryId,
      Enabled: this.ReportEditorDraft.Enabled,
      FileName: this.SelectedReportFileName,
    });
    if (!PublishedReport) {
      this.ReportEditorError = '發佈報表失敗，請重新確認欄位。';
      this.ReportUploadStep = 'Form';
      return;
    }
    this.PublishedUploadedReport = PublishedReport;
    this.ReportUploadStep = 'Complete';
    this.RememberInitialReportEditorState();
    this.EnsureReportManagementPagination();
  }

  ReturnToReportManagement(): void {
    void this.router.navigate(['/report-management']);
  }

  OpenEditReportDialog(ReportKey: MockReportKey): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    const Report = this.MockRbac.GetReport(ReportKey);
    if (!Report) return;
    this.RememberReportEditorOpener();
    this.EditingReportKey = Report.ReportKey;
    this.ReportEditorDraft = {
      ReportName: Report.ReportName,
      Description: Report.Description,
      CategoryId: Report.CategoryId,
      Enabled: Report.Enabled,
    };
    this.SelectedReportFileName = Report.FileName;
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
    this.IsReportDiscardConfirmationOpen = false;
    this.CloseReportCategoryQuickAdd();
    this.IsUploadReportDialogOpen = true;
    this.RememberInitialReportEditorState();
  }

  CloseReportEditor(): void {
    this.IsUploadReportDialogOpen = false;
    this.IsReportDiscardConfirmationOpen = false;
    this.EditingReportKey = null;
    this.ReportEditorDraft = this.CreateReportEditorDraft();
    this.SelectedReportFileName = '';
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
    this.CloseReportCategoryQuickAdd();
    this.ReportEditorInitialDraft = null;
    this.InitialReportFileName = '';
    this.ShouldFocusReportDiscardContinue = false;
    this.ScheduleReportEditorFocus(this.ReportEditorOpener);
    this.ReportEditorOpener = null;
    this.ReportDiscardConfirmationReturnFocus = null;
  }

  RequestCloseReportEditor(): void {
    if (!this.IsUploadReportDialogOpen && !this.IsReportUploadFlow) return;
    if (!this.IsReportEditorDirty()) {
      if (this.IsReportUploadFlow) this.ReturnToReportManagement();
      else this.CloseReportEditor();
      return;
    }
    this.ReportDiscardConfirmationReturnFocus = this.GetActiveHTMLElement();
    this.IsReportDiscardConfirmationOpen = true;
    this.ShouldFocusReportDiscardContinue = true;
  }

  ContinueEditingReport(): void {
    if (!this.IsReportDiscardConfirmationOpen) return;
    this.IsReportDiscardConfirmationOpen = false;
    this.ShouldFocusReportDiscardContinue = false;
    this.ScheduleReportEditorFocus(this.ReportDiscardConfirmationReturnFocus);
    this.ReportDiscardConfirmationReturnFocus = null;
  }

  DiscardReportEditorChanges(): void {
    if (!this.IsReportDiscardConfirmationOpen) return;
    if (this.IsReportUploadFlow) {
      this.IsReportDiscardConfirmationOpen = false;
      this.ReturnToReportManagement();
      return;
    }
    this.CloseReportEditor();
  }

  OpenReportCategoryQuickAdd(): void {
    if (
      !this.Auth.HasManagementPermission('RptManagement') ||
      (!this.IsUploadReportDialogOpen && !this.IsReportUploadFlow)
    )
      return;
    this.QuickAddCategoryName = '';
    this.QuickAddCategoryError = '';
    this.IsReportCategoryQuickAddOpen = true;
  }

  CloseReportCategoryQuickAdd(): void {
    this.IsReportCategoryQuickAddOpen = false;
    this.QuickAddCategoryName = '';
    this.QuickAddCategoryError = '';
  }

  CreateReportCategoryQuickAdd(): void {
    if (
      !this.Auth.HasManagementPermission('RptManagement') ||
      !this.IsReportCategoryQuickAddOpen
    )
      return;
    const Result = this.MockRbac.CreateCategory(this.QuickAddCategoryName);
    const Messages: Record<Exclude<typeof Result.Status, 'created'>, string> = {
      'invalid-name': '請輸入報表分類名稱。',
      'duplicate-name': '此報表分類已存在。',
      'system-reserved-name': '此名稱為系統保留分類，不可建立。',
    };
    if (Result.Status !== 'created') {
      this.QuickAddCategoryError = Messages[Result.Status];
      return;
    }
    this.ReportEditorDraft.CategoryId = Result.Category.CategoryId;
    this.NotificationCenter.CreateCategoryReview(
      Result.Category,
      this.Auth.CurrentUser?.Account ?? '前台使用者',
    );
    this.CloseReportCategoryQuickAdd();
    this.ShowSuccessToast(
      `新增報表分類「${Result.Category.CategoryName}」成功！`,
    );
  }

  OnReportFileSelected(Event: Event): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    const Input = Event.target as HTMLInputElement;
    const File = Input.files?.item(0);
    if (!File) return;
    if (!File.name.toLocaleLowerCase().endsWith('.rpt')) {
      this.SelectedReportFileName = '';
      this.ReportEditorError = '僅允許上傳 .rpt 報表檔案。';
      this.IsReportFileInvalid = true;
      Input.value = '';
      return;
    }
    this.SelectedReportFileName = File.name;
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
  }

  SaveReport(): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    const Error = this.GetReportEditorValidationError();
    if (Error) {
      this.ReportEditorError = Error;
      return;
    }
    const IsEditing = this.EditingReportKey !== null;
    const IsSaved = IsEditing
      ? this.MockRbac.UpdateReport(this.EditingReportKey!, {
          ReportName: this.ReportEditorDraft.ReportName,
          Description: this.ReportEditorDraft.Description,
          CategoryId: this.ReportEditorDraft.CategoryId,
          Enabled: this.ReportEditorDraft.Enabled,
          FileName: this.SelectedReportFileName,
        })
      : Boolean(
          this.MockRbac.CreateReport({
            ReportName: this.ReportEditorDraft.ReportName,
            Description: this.ReportEditorDraft.Description,
            CategoryId: this.ReportEditorDraft.CategoryId,
            Enabled: this.ReportEditorDraft.Enabled,
            FileName: this.SelectedReportFileName,
          }),
        );
    if (!IsSaved) {
      this.ReportEditorError = '儲存報表失敗，請重新確認欄位。';
      return;
    }
    this.EnsureReportManagementPagination();
    this.CloseReportEditor();
    this.ShowSuccessToast(
      IsEditing ? 'Mock 報表已更新。' : 'Mock 報表已上傳。',
    );
  }

  OpenDeleteReportDialog(ReportKey: MockReportKey): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    this.DeletingReport = this.MockRbac.GetReport(ReportKey);
  }

  CloseDeleteReportDialog(): void {
    this.DeletingReport = null;
  }

  ConfirmDeleteReport(): void {
    if (!this.Auth.HasManagementPermission('RptManagement')) return;
    if (!this.DeletingReport) return;
    const ReportName = this.DeletingReport.ReportName;
    if (this.MockRbac.DeleteReport(this.DeletingReport.ReportKey)) {
      this.PinnedReportManagementKeys.delete(this.DeletingReport.ReportKey);
      this.EnsureReportManagementPagination();
      this.ShowSuccessToast(`Mock 報表「${ReportName}」已刪除。`);
    }
    this.CloseDeleteReportDialog();
  }

  OpenCreateDatabaseConnection(): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    this.EditingDatabaseConnectionKey = null;
    this.DatabaseConnectionDraft = this.CreateDatabaseConnectionDraft();
    this.DatabaseConnectionFormError = '';
    this.IsDatabaseConnectionEditorOpen = true;
  }

  OpenEditDatabaseConnection(Key: string): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    const Connection = this.DatabaseConnections.GetConnection(Key);
    if (!Connection) return;
    this.EditingDatabaseConnectionKey = Key;
    this.DatabaseConnectionDraft = {
      DataSourceName: Connection.DataSourceName,
      ServerHost: Connection.ServerHost,
      Port: Connection.Port,
      DatabaseName: Connection.DatabaseName,
      Username: Connection.Username,
      ConnectionType: Connection.ConnectionType,
      Enabled: Connection.Enabled,
      Password: '',
    };
    this.DatabaseConnectionFormError = '';
    this.IsDatabaseConnectionEditorOpen = true;
  }

  CloseDatabaseConnectionEditor(): void {
    this.IsDatabaseConnectionEditorOpen = false;
    this.EditingDatabaseConnectionKey = null;
    this.DatabaseConnectionDraft = this.CreateDatabaseConnectionDraft();
    this.DatabaseConnectionFormError = '';
  }

  SaveDatabaseConnection(): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    this.DatabaseConnectionFormError = '';
    const IsEditing = this.EditingDatabaseConnectionKey !== null;
    const IsSaved = IsEditing
      ? this.DatabaseConnections.Update(
          this.EditingDatabaseConnectionKey!,
          this.DatabaseConnectionDraft,
        )
      : this.DatabaseConnections.Create(this.DatabaseConnectionDraft);
    if (!IsSaved) {
      this.DatabaseConnectionFormError = IsEditing
        ? '請確認資料來源、主機、連接埠、資料庫與帳號。'
        : '建立連線時請填寫資料來源、主機、連接埠、資料庫、帳號與密碼。';
      return;
    }
    this.CloseDatabaseConnectionEditor();
    this.ShowSuccessToast(
      IsEditing
        ? 'Mock 資料庫連線已更新；既有密碼未回填或保存於前端。'
        : 'Mock 資料庫連線已建立；密碼不會保存於前端 Mock 資料。',
    );
  }

  TrackUserByAccount(_: number, User: { Account: string }): string {
    return User.Account;
  }

  // Roles returns fresh read models. Preserve views so NgModel initialization
  // cannot keep scheduling change detection by recreating its controls.
  TrackRoleByKey(_: number, Role: MockRole): MockRoleKey {
    return Role.Key;
  }

  TrackReportByKey(_: number, Report: MockReportReadModel): MockReportKey {
    return Report.ReportKey;
  }

  OpenCreateRoleDialog(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.RoleDraft = this.CreateRoleDraft();
    this.RoleDraftError = '';
    this.IsCreateRoleDialogOpen = true;
  }

  CloseCreateRoleDialog(): void {
    this.IsCreateRoleDialogOpen = false;
    this.RoleDraft = this.CreateRoleDraft();
    this.RoleDraftError = '';
  }

  OpenEditRoleDialog(RoleKey: MockRoleKey): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const Role = this.MockRbac.GetRole(RoleKey);
    this.EditingRoleKey = Role.Key;
    this.RoleDraft = {
      DisplayName: Role.DisplayName,
      ManagementPermissions: [...Role.ManagementPermissions],
      Permissions: this.MockRbac.GetCategoryPermissionEntries(Role.Key),
    };
    this.RoleDraftError = '';
    this.IsEditRoleDialogOpen = true;
  }

  CloseEditRoleDialog(): void {
    this.IsEditRoleDialogOpen = false;
    this.EditingRoleKey = null;
    this.DeletingRole = null;
    this.RoleDraft = this.CreateRoleDraft();
    this.RoleDraftError = '';
  }

  OpenDeleteRoleDialog(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    if (!this.EditingRoleKey) return;
    const Role = this.MockRbac.GetRole(this.EditingRoleKey);
    if (this.MockRbac.GetRoleUserCount(Role.Key) > 0) {
      this.RoleDraftError =
        '此角色仍有使用者使用，請先移除使用者的角色後再刪除。';
      return;
    }
    this.DeletingRole = Role;
  }

  CloseDeleteRoleDialog(): void {
    this.DeletingRole = null;
  }

  ConfirmDeleteRole(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const Role = this.DeletingRole;
    if (!Role) return;
    const Result = this.MockRbac.DeleteRole(Role.Key);
    const Messages: Record<Exclude<typeof Result, 'deleted'>, string> = {
      'role-in-use': '此角色仍有使用者使用，請先移除使用者的角色後再刪除。',
      'not-found': '找不到要刪除的角色。',
    };
    if (Result !== 'deleted') {
      this.RoleDraftError = Messages[Result];
      this.CloseDeleteRoleDialog();
      return;
    }
    if (this.UserRoleFilter === Role.Key) this.UserRoleFilter = null;
    this.AuditLog.RecordBackOfficeAction('刪除角色', `刪除角色 ${Role.DisplayName}。`);
    this.CloseDeleteRoleDialog();
    this.CloseEditRoleDialog();
    this.ScheduleRoleCardNavigationUpdate();
    this.ShowSuccessToast(`角色「${Role.DisplayName}」已刪除。`);
  }

  ClearRoleDraftError(): void {
    this.RoleDraftError = '';
  }

  SaveRole(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    const DisplayName = this.RoleDraft.DisplayName.trim();
    if (!DisplayName) {
      this.RoleDraftError = '請輸入角色名稱。';
      return;
    }
    if (this.MockRbac.Roles.some((Role) => Role.DisplayName === DisplayName)) {
      this.RoleDraftError = '角色名稱已存在，請輸入未重複的角色名稱。';
      return;
    }
    if (!this.HasAnyRolePermission(this.RoleDraft)) {
      this.RoleDraftError = '請至少勾選一個權限。';
      return;
    }
    const Role = this.MockRbac.CreateRole(this.RoleDraft);
    if (!Role) {
      this.RoleDraftError = '角色名稱已存在，請輸入未重複的角色名稱。';
      return;
    }
    this.CloseCreateRoleDialog();
    this.AuditLog.RecordBackOfficeAction('新增角色', `建立角色 ${Role.DisplayName}。`);
    this.ScheduleRoleCardNavigationUpdate();
    this.ShowSuccessToast(`新增角色「${Role.DisplayName}」，成功！`);
  }

  SaveEditedRole(): void {
    if (!this.Auth.CanOperateBackOffice) return;
    if (!this.EditingRoleKey) return;
    const BeforeByAccount = this.NotificationCenter.CaptureRoleUsers(
      this.EditingRoleKey,
    );
    const Result = this.MockRbac.UpdateRole(
      this.EditingRoleKey,
      this.RoleDraft,
    );
    const Messages: Record<Exclude<typeof Result, 'updated'>, string> = {
      invalid: '請輸入角色名稱。',
      'duplicate-name': '角色名稱已存在，請使用其他名稱。',
      'not-found': '找不到要編輯的角色。',
    };
    if (Result !== 'updated') {
      this.RoleDraftError = Messages[Result];
      return;
    }
    const DisplayName = this.MockRbac.GetRole(this.EditingRoleKey).DisplayName;
    this.NotificationCenter.NotifyRoleDefinitionChange(
      this.EditingRoleKey,
      BeforeByAccount,
    );
    this.AuditLog.RecordBackOfficeAction('更新角色權限', `更新角色 ${DisplayName} 的功能或報表分類權限。`);
    this.CloseEditRoleDialog();
    this.ShowSuccessToast(`角色「${DisplayName}」已更新。`);
  }

  SetPermissionCanExecute(
    Entry: MockCategoryPermissionEntry,
    CanExecute: boolean,
  ): void {
    if (!this.Auth.CanOperateBackOffice) return;
    Entry.Permission.CanExecute = CanExecute;
    if (!CanExecute) {
      Entry.Permission.CanExport = false;
      Entry.Permission.CanPrint = false;
    }
  }

  private HasAnyRolePermission(Draft: MockRoleDraft): boolean {
    return (
      Draft.ManagementPermissions.length > 0 ||
      Draft.Permissions.some(
        (Entry) =>
          Entry.Permission.CanExecute ||
          Entry.Permission.CanExport ||
          Entry.Permission.CanPrint,
      )
    );
  }

  TrackByCategoryPermissionEntry(
    _Index: number,
    Entry: MockCategoryPermissionEntry,
  ): string {
    return Entry.CategoryId;
  }

  SaveAccountProfile(): void {
    const CurrentUser = this.Auth.CurrentUser;
    if (!CurrentUser) return;
    this.AccountProfileNotice = '';
    const Result = this.MockRbac.UpdateOwnAccount(
      CurrentUser.Account,
      {
        DisplayName: this.AccountSettingsDraft.DisplayName,
        OldPassword: '',
        NewPassword: '',
      },
    );
    const Messages: Record<string, string> = {
      updated: '個人資料已儲存。',
      invalid: '請輸入使用者名稱。',
      'not-found': '找不到目前登入的使用者。',
    };
    if (Result === 'updated') {
      this.LoadAccountSettings();
      this.AccountProfileNotice = Messages['updated'];
      return;
    }
    this.AccountProfileNotice = Messages[Result] ?? '無法儲存個人資料。';
  }

  ChangePassword(): void {
    const CurrentUser = this.Auth.CurrentUser;
    if (!CurrentUser) return;
    this.AccountPasswordNotice = '';
    if (!this.AccountSettingsDraft.OldPassword) {
      this.AccountPasswordNotice = '請輸入目前密碼。';
      return;
    }
    if (!this.AccountSettingsDraft.NewPassword) {
      this.AccountPasswordNotice = '請輸入新密碼。';
      return;
    }
    if (this.AccountSettingsDraft.NewPassword.length < 8) {
      this.AccountPasswordNotice = '新密碼需至少 8 碼。';
      return;
    }
    if (this.AccountSettingsDraft.NewPassword !== this.AccountSettingsConfirmation) {
      this.AccountPasswordNotice = '新密碼與確認新密碼不一致。';
      return;
    }
    const Result = this.MockRbac.UpdateOwnAccount(CurrentUser.Account, {
      DisplayName: CurrentUser.DisplayName,
      OldPassword: this.AccountSettingsDraft.OldPassword,
      NewPassword: this.AccountSettingsDraft.NewPassword,
    });
    if (Result === 'password-updated') {
      this.LoadAccountSettings();
      this.IsPasswordChangeSuccessModalOpen = true;
      return;
    }
    const Messages: Partial<Record<typeof Result, string>> = {
      'incorrect-password': '目前密碼不正確。',
      'not-found': '找不到目前登入的使用者。',
      invalid: '無法更新密碼，請稍後再試。',
    };
    this.AccountPasswordNotice =
      Messages[Result] ?? '無法更新密碼，請稍後再試。';
  }

  ConfirmPasswordChangeAndLogout(): void {
    if (!this.IsPasswordChangeSuccessModalOpen) return;
    this.IsPasswordChangeSuccessModalOpen = false;
    this.Logout();
  }

  get IsManagementPage(): boolean {
    return [
      'UserManagement',
      'OperationLog',
      'RptManagement',
      'DatabaseConnection',
    ].includes(this.Page);
  }

  get CanAccessPage(): boolean {
    if (this.Page === 'NotificationCenter') return this.Auth.IsAuthenticated;
    if (this.Page === 'UserManagement') return this.Auth.IsBackOffice;
    if (this.Page === 'RptManagement')
      return this.Auth.HasManagementPermission('RptManagement');
    if (this.Page === 'ReportUpload')
      return this.Auth.HasManagementPermission('RptManagement');
    if (this.Page === 'DatabaseConnection')
      return this.Auth.HasManagementPermission('DatabaseConnection');
    if (this.Page === 'OperationLog')
      return this.Auth.HasManagementPermission('OperationLog');
    return this.Auth.IsFrontOffice;
  }

  private IsAccessRedirectPending = false;

  ngDoCheck(): void {
    if (this.IsAccessRedirectPending) return;
    if (
      !this.CanAccessPage ||
      (this.Page === 'ReportPreview' && !this.Auth.SelectedReport)
    ) {
      this.IsAccessRedirectPending = true;
      void this.router.navigate(
        [this.Auth.IsAuthenticated ? this.Auth.HomeRoute : '/login'],
        {
          queryParams: { state: 'permission-denied' },
        },
      );
    }
  }

  ToggleManagementPermission(
    Permission: MockManagementPermission,
    Enabled: boolean,
  ): void {
    if (!this.Auth.CanOperateBackOffice) return;
    this.RoleDraft.ManagementPermissions = Enabled
      ? [...new Set([...this.RoleDraft.ManagementPermissions, Permission])]
      : this.RoleDraft.ManagementPermissions.filter(
          (Value) => Value !== Permission,
        );
  }

  private LoadReportParameterForm(): void {
    const ReportKey = this.SelectedReportKey;
    this.ReportParameterDefinitions = ReportKey
      ? this.ReportParameters.GetDefinitions(ReportKey)
      : [];
    this.ReportParameterForm = this.BuildParameterForm(
      this.VisibleReportParameters,
    );
    Object.keys(this.ParameterRangeErrors).forEach(
      (Key) => delete this.ParameterRangeErrors[Key],
    );
    this.LastMockExecutionParameters = null;
  }

  private CreateReportEditorDraft(): ReportEditorDraft {
    return {
      ReportName: '',
      Description: '',
      CategoryId: '',
      Enabled: false,
    };
  }

  private InitializeReportUploadFlow(): void {
    this.EditingReportKey = null;
    this.ReportEditorDraft = this.CreateReportEditorDraft();
    this.SelectedReportFileName = '';
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
    this.ReportUploadStep = 'Form';
    this.PublishedUploadedReport = null;
    this.IsReportDiscardConfirmationOpen = false;
    this.CloseReportCategoryQuickAdd();
    this.RememberInitialReportEditorState();
  }

  private RememberReportEditorOpener(): void {
    this.ReportEditorOpener = this.GetActiveHTMLElement();
  }

  private RememberInitialReportEditorState(): void {
    this.ReportEditorInitialDraft = { ...this.ReportEditorDraft };
    this.InitialReportFileName = this.SelectedReportFileName;
  }

  private IsReportEditorDirty(): boolean {
    const InitialDraft = this.ReportEditorInitialDraft;
    if (!InitialDraft) return false;
    return (
      InitialDraft.ReportName !== this.ReportEditorDraft.ReportName ||
      InitialDraft.Description !== this.ReportEditorDraft.Description ||
      InitialDraft.CategoryId !== this.ReportEditorDraft.CategoryId ||
      InitialDraft.Enabled !== this.ReportEditorDraft.Enabled ||
      this.InitialReportFileName !== this.SelectedReportFileName
    );
  }

  private GetActiveHTMLElement(): HTMLElement | null {
    const ActiveElement = document.activeElement;
    return ActiveElement instanceof HTMLElement ? ActiveElement : null;
  }

  private ScheduleReportEditorFocus(Target: HTMLElement | null): void {
    this.PendingReportEditorFocus = Target;
  }

  private GetReportEditorValidationError(): string {
    if (this.IsReportFileInvalid) {
      return '僅允許上傳 .rpt 報表檔案。';
    }
    if (!this.ReportEditorDraft.ReportName.trim()) {
      return '請輸入報表名稱。';
    }
    if (!this.ReportEditorDraft.Description.trim()) {
      return '請輸入報表說明。';
    }
    if (!this.ReportEditorDraft.CategoryId) {
      return '請選擇報表分類。';
    }
    if (!this.EditingReportKey && !this.SelectedReportFileName) {
      return '請選擇 RPT 報表檔案。';
    }
    if (
      this.SelectedReportFileName &&
      !this.SelectedReportFileName.toLocaleLowerCase().endsWith('.rpt')
    ) {
      return '僅允許上傳 .rpt 報表檔案。';
    }
    return '';
  }

  private BuildParameterForm(
    Definitions: readonly MockReportParameterDefinition[],
  ): FormGroup {
    const Form = new FormGroup({});
    Definitions.forEach((Definition) => {
      if (Definition.AllowRangeValues) {
        const DefaultValue = this.GetRangeDefaultValue(Definition.DefaultValue);
        Form.addControl(
          Definition.ParameterName,
          new FormGroup(
            {
              Start: new FormControl(
                DefaultValue.Start,
                this.GetValueValidators(Definition),
              ),
              End: new FormControl(
                DefaultValue.End,
                this.GetValueValidators(Definition),
              ),
            },
            { validators: this.CreateRangeValidator(Definition) },
          ),
        );
        return;
      }

      Form.addControl(
        Definition.ParameterName,
        new FormControl(
          this.GetDefaultValue(Definition),
          this.GetValueValidators(Definition),
        ),
      );
    });
    return Form;
  }

  private GetDefaultValue(
    Definition: MockReportParameterDefinition,
  ): string | number | boolean | string[] | null {
    const DefaultValue = Definition.DefaultValue;
    if (Definition.AllowMultipleValues) {
      return Array.isArray(DefaultValue) ? [...DefaultValue] : [];
    }
    if (Definition.DataType === 'Boolean') {
      return DefaultValue === true;
    }
    if (Definition.DataType === 'Integer' || Definition.DataType === 'Float') {
      return typeof DefaultValue === 'number' ? DefaultValue : null;
    }
    return typeof DefaultValue === 'string' ? DefaultValue : '';
  }

  private GetRangeDefaultValue(DefaultValue: MockParameterDefaultValue): {
    Start: string | number | null;
    End: string | number | null;
  } {
    if (
      typeof DefaultValue === 'object' &&
      DefaultValue !== null &&
      !Array.isArray(DefaultValue) &&
      'Start' in DefaultValue &&
      'End' in DefaultValue
    ) {
      return { Start: DefaultValue.Start, End: DefaultValue.End };
    }
    return { Start: null, End: null };
  }

  private GetValueValidators(
    Definition: MockReportParameterDefinition,
  ): ValidatorFn[] {
    const Validators: ValidatorFn[] = [];
    if (Definition.IsRequired) Validators.push(this.RequiredParameterValidator);
    if (Definition.DataType === 'Integer')
      Validators.push(this.IntegerValidator);
    if (Definition.DataType === 'Float') Validators.push(this.NumberValidator);
    if (Definition.DataType === 'Date') Validators.push(this.DateValidator);
    if (Definition.DataType === 'DateTime')
      Validators.push(this.DateTimeValidator);
    return Validators;
  }

  private readonly RequiredParameterValidator: ValidatorFn = (
    Control: AbstractControl,
  ): ValidationErrors | null => {
    const Value = Control.value;
    return Value === null ||
      Value === undefined ||
      Value === '' ||
      (Array.isArray(Value) && Value.length === 0)
      ? { required: true }
      : null;
  };

  private readonly IntegerValidator: ValidatorFn = (
    Control: AbstractControl,
  ): ValidationErrors | null => {
    const Value = Control.value;
    if (Value === null || Value === '') return null;
    return Number.isInteger(Number(Value)) ? null : { integer: true };
  };

  private readonly NumberValidator: ValidatorFn = (
    Control: AbstractControl,
  ): ValidationErrors | null => {
    const Value = Control.value;
    if (Value === null || Value === '') return null;
    return Number.isFinite(Number(Value)) ? null : { number: true };
  };

  private readonly DateValidator: ValidatorFn = (
    Control: AbstractControl,
  ): ValidationErrors | null => {
    const Value = Control.value;
    if (Value === null || Value === '') return null;
    return this.ParseDateOnly(String(Value)) ? null : { date: true };
  };

  private readonly DateTimeValidator: ValidatorFn = (
    Control: AbstractControl,
  ): ValidationErrors | null => {
    const Value = Control.value;
    if (Value === null || Value === '') return null;
    return Number.isNaN(Date.parse(String(Value))) ? { dateTime: true } : null;
  };

  private CreateRangeValidator(
    Definition: MockReportParameterDefinition,
  ): ValidatorFn {
    return (Control: AbstractControl): ValidationErrors | null => {
      const RangeValue = Control.value as {
        Start?: string | number | null;
        End?: string | number | null;
      };
      if (
        RangeValue?.Start === null ||
        RangeValue?.Start === '' ||
        RangeValue?.End === null ||
        RangeValue?.End === ''
      ) {
        return null;
      }

      if (Definition.DataType === 'Date') {
        const Start = this.ParseDateOnly(String(RangeValue.Start));
        const End = this.ParseDateOnly(String(RangeValue.End));
        return !Start || !End || Start.getTime() <= End.getTime()
          ? null
          : { range: true };
      }

      const Start = Number(RangeValue.Start);
      const End = Number(RangeValue.End);
      return !Number.isFinite(Start) || !Number.isFinite(End) || Start <= End
        ? null
        : { range: true };
    };
  }

  private GetRangeControl(
    Definition: MockReportParameterDefinition,
  ): FormGroup | null {
    const Control = this.ReportParameterForm.get(Definition.ParameterName);
    return Control instanceof FormGroup ? Control : null;
  }

  private GetErrorControl(Control: AbstractControl): AbstractControl {
    if (!(Control instanceof FormGroup)) return Control;
    return (
      Object.values(Control.controls).find((Child) => Child.invalid) ?? Control
    );
  }

  private SerializeReportParameters(): Readonly<
    Record<string, MockParameterFormValue>
  > {
    return Object.fromEntries(
      this.VisibleReportParameters.map((Definition) => [
        Definition.ParameterName,
        this.SerializeParameterValue(
          Definition,
          this.ReportParameterForm.get(Definition.ParameterName)?.value,
        ),
      ]),
    );
  }

  private SerializeParameterValue(
    Definition: MockReportParameterDefinition,
    Value: unknown,
  ): MockParameterFormValue {
    if (Definition.AllowRangeValues) {
      const RangeValue = Value as {
        Start: string | number | null;
        End: string | number | null;
      };
      return {
        Start: this.SerializeScalarValue(Definition, RangeValue.Start),
        End: this.SerializeScalarValue(Definition, RangeValue.End),
      } as { Start: string | number | null; End: string | number | null };
    }
    if (Definition.AllowMultipleValues) {
      return Array.isArray(Value) ? Value.map(String) : [];
    }
    return this.SerializeScalarValue(Definition, Value);
  }

  private SerializeScalarValue(
    Definition: MockReportParameterDefinition,
    Value: unknown,
  ): string | number | boolean | null {
    if (Value === null || Value === '') return null;
    if (Definition.DataType === 'Boolean') return Boolean(Value);
    if (Definition.DataType === 'Integer' || Definition.DataType === 'Float') {
      return Number(Value);
    }
    return String(Value);
  }

  private IsDateOnlyBefore(
    EndDateValue: unknown,
    StartDateValue: unknown,
  ): boolean {
    const EndDate = this.ParseDateOnly(String(EndDateValue ?? ''));
    const StartDate = this.ParseDateOnly(String(StartDateValue ?? ''));
    return Boolean(
      EndDate && StartDate && EndDate.getTime() < StartDate.getTime(),
    );
  }

  private ParseDateOnly(DateValue: string): Date | null {
    const Match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(DateValue);
    if (!Match) return null;

    const Year = Number(Match[1]);
    const Month = Number(Match[2]);
    const Day = Number(Match[3]);
    const DateValueAsDate = new Date(Year, Month - 1, Day);
    return DateValueAsDate.getFullYear() === Year &&
      DateValueAsDate.getMonth() === Month - 1 &&
      DateValueAsDate.getDate() === Day
      ? DateValueAsDate
      : null;
  }

  private CreateUserDraft(): MockUserDraft {
    return {
      Account: '',
      DisplayName: '',
      Roles: [],
      Enabled: false,
    };
  }

  private GetCreateUserValidationErrors(): CreateUserValidationErrors {
    const Errors: CreateUserValidationErrors = {};
    const Account = this.UserDraft.Account.trim();
    if (!Account) Errors.Account = '請輸入使用者帳號。';
    else if (this.MockRbac.GetUser(Account))
      Errors.Account = '此使用者帳號已存在。';
    if (!this.UserDraft.DisplayName.trim())
      Errors.DisplayName = '請輸入使用者名稱。';
    if (!this.UserDraft.Roles.length) Errors.Roles = '請至少選擇一個角色。';
    return Errors;
  }
  private CreateAccountSettingsDraft(): MockAccountSettingsDraft {
    return {
      DisplayName: '',
      OldPassword: '',
      NewPassword: '',
    };
  }
  private LoadAccountSettings(): void {
    this.AccountSettingsDraft = {
      DisplayName: this.Auth.CurrentUser?.DisplayName ?? '',
      OldPassword: '',
      NewPassword: '',
    };
    this.AccountSettingsConfirmation = '';
  }
  private CreateRoleDraft(): MockRoleDraft {
    return {
      DisplayName: '',
      ManagementPermissions: [],
      Permissions: this.MockRbac.GetEmptyCategoryPermissionEntries(),
    };
  }
  private CreateDatabaseConnectionDraft(): MockDatabaseConnectionDraft {
    return {
      DataSourceName: '',
      ServerHost: '',
      Port: '1433',
      DatabaseName: '',
      Username: '',
      ConnectionType: 'ReadOnly',
      Enabled: true,
      Password: '',
    };
  }
  private ShowSuccessToast(Message: string): void {
    this.Notifications.ShowSuccess(Message);
  }

  private CopyTextWithFallback(Text: string): boolean {
    const TextArea = document.createElement('textarea');
    TextArea.value = Text;
    TextArea.setAttribute('readonly', '');
    TextArea.style.position = 'fixed';
    TextArea.style.opacity = '0';
    document.body.append(TextArea);
    TextArea.select();
    const IsCopied = document.execCommand('copy');
    TextArea.remove();
    return IsCopied;
  }

  private CreateParameterSearchState(): ParameterReportSearchState {
    return {
      CategoryId: this.SelectedParameterReportCategoryId,
      SearchText: this.ParameterReportSearchText,
      SortField: this.ParameterReportSortField,
      SortDirection: this.ParameterReportSortDirection,
      StartDate: this.ParameterReportStartDate,
      EndDate: this.ParameterReportEndDate,
    };
  }

  private InitializeOperationLogDateRange(): void {
    this.OperationLogEndDate = this.OperationLogMaximumDate;
    this.OperationLogStartDate = this.ToDateInputValue(this.GetDateDaysAgo(6));
  }

  private GetDateDaysAgo(DaysAgo: number): Date {
    const DateValue = new Date();
    DateValue.setDate(DateValue.getDate() - DaysAgo);
    return DateValue;
  }

  private ToDateInputValue(DateValue: Date): string {
    const Year = DateValue.getFullYear();
    const Month = String(DateValue.getMonth() + 1).padStart(2, '0');
    const Day = String(DateValue.getDate()).padStart(2, '0');
    return `${Year}-${Month}-${Day}`;
  }

  private EnsureUserPagination(): void {
    this.UserCurrentPage = this.ClampPage(
      this.UserCurrentPage,
      this.FilteredUsers.length,
    );
  }

  private EnsureReportManagementPagination(): void {
    this.ReportManagementCurrentPage = this.ClampPage(
      this.ReportManagementCurrentPage,
      this.DisplayedManagedReports.length,
    );
  }

  private GetTotalPages(ItemCount: number): number {
    return Math.max(1, Math.ceil(ItemCount / this.PaginationPageSize));
  }

  private GetPageNumbers(TotalPages: number): readonly number[] {
    return Array.from({ length: TotalPages }, (_, Index) => Index + 1);
  }

  private GetPagedItems<T>(
    Items: readonly T[],
    CurrentPage: number,
  ): readonly T[] {
    const StartIndex = (CurrentPage - 1) * this.PaginationPageSize;
    return Items.slice(StartIndex, StartIndex + this.PaginationPageSize);
  }

  private ClampPage(RequestedPage: number, ItemCount: number): number {
    return Math.min(Math.max(1, RequestedPage), this.GetTotalPages(ItemCount));
  }

  private RestoreParameterSearchState(State: unknown): void {
    const SearchState = this.ToParameterSearchState(State);
    if (!SearchState) return;
    this.SelectedParameterReportCategoryId = SearchState.CategoryId;
    this.ParameterReportSearchText = SearchState.SearchText;
    this.ParameterReportSortField = SearchState.SortField;
    this.ParameterReportSortDirection = SearchState.SortDirection;
    this.ParameterReportStartDate = SearchState.StartDate;
    this.ParameterReportEndDate = SearchState.EndDate;
  }

  private ToParameterSearchState(
    State: unknown,
  ): ParameterReportSearchState | null {
    if (!State || typeof State !== 'object') return null;
    const Value = State as Partial<ParameterReportSearchState>;
    if (
      typeof Value.CategoryId !== 'string' ||
      typeof Value.SearchText !== 'string' ||
      (Value.SortField !== null &&
        Value.SortField !== 'ReportName' &&
        Value.SortField !== 'CreatedAt' &&
        Value.SortField !== 'UpdatedAt') ||
      (Value.SortDirection !== 'asc' && Value.SortDirection !== 'desc') ||
      typeof Value.StartDate !== 'string' ||
      typeof Value.EndDate !== 'string'
    ) {
      return null;
    }
    return {
      CategoryId: Value.CategoryId,
      SearchText: Value.SearchText,
      SortField: Value.SortField,
      SortDirection: Value.SortDirection,
      StartDate: Value.StartDate,
      EndDate: Value.EndDate,
    };
  }

  private ToReportPreviewOrigin(State: unknown): ReportPreviewOrigin {
    return State === 'favorites' ? 'favorites' : 'all';
  }

  private ScheduleRoleCardNavigationUpdate(): void {
    window.setTimeout(() => this.UpdateRoleCardNavigation());
  }
}
