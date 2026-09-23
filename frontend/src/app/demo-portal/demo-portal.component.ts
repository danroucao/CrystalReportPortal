import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  DoCheck,
  ElementRef,
  HostListener,
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
} from '@angular/router';
import { Observable, Subject, take } from 'rxjs';

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
  MockRbacService,
  MockRoleDraft,
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
  MockDatabaseConnection,
  MockDatabaseConnectionDraft,
  MockDatabaseConnectionService,
} from '../services/mock-database-connection.service';
import { MockReportParameterService } from '../services/mock-report-parameter.service';
import { MockAuditLogService } from '../services/mock-audit-log.service';
import { BoringAvatarComponent } from '../shared/boring-avatar.component';
import { PortalPaginationComponent } from '../shared/portal-pagination.component';
import { PortalTab, PortalTabsComponent } from '../shared/portal-tabs.component';
import { UnsavedChangesDialogComponent } from '../shared/unsaved-changes-dialog.component';
import { FavoriteReportPageComponent } from './favorite-report-page/favorite-report-page.component';
import { OperationLogPageComponent } from './operation-log-page/operation-log-page.component';
import { PortalNavigationComponent } from './portal-navigation/portal-navigation.component';
import { ReportEditorFormComponent } from './report-editor-form/report-editor-form.component';
import { ReportManagementPageComponent } from './report-management-page/report-management-page.component';
import { ReportParameterPageComponent } from './report-parameter-page/report-parameter-page.component';
import { ReportPreviewPageComponent } from './report-preview-page/report-preview-page.component';
import { UserManagementPageComponent } from './user-management-page/user-management-page.component';
import { ReportEditorDraft } from './report-editor-form/report-editor-form.model';

type DemoPortalPage =
  | 'ReportList'
  | 'ReportParameter'
  | 'ReportPreview'
  | 'UserManagement'
  | 'RptManagement'
  | 'ReportEdit'
  | 'ReportUpload'
  | 'DatabaseConnection'
  | 'OperationLog'
  | 'NotificationCenter';

type MockParameterFormValue =
  | string
  | number
  | boolean
  | string[]
  | { Start: string | number | null; End: string | number | null }
  | null;

type ParameterReportSortField = 'ReportName' | 'CreatedAt' | 'UpdatedAt';
type ParameterReportSortDirection = 'asc' | 'desc';
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

type ReportUploadStep = 'Form' | 'Confirm' | 'Complete';




@Component({
  selector: 'app-demo-portal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    BoringAvatarComponent,
    PortalPaginationComponent,
    PortalTabsComponent,
    UnsavedChangesDialogComponent,
    PortalNavigationComponent,
    FavoriteReportPageComponent,
    OperationLogPageComponent,
    ReportEditorFormComponent,
    ReportManagementPageComponent,
    ReportParameterPageComponent,
    ReportPreviewPageComponent,
    UserManagementPageComponent,
  ],
  templateUrl: './demo-portal.component.html',
  styleUrl: './demo-portal.component.scss',
})
export class DemoPortalComponent
  implements OnInit, AfterViewChecked, DoCheck
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
  IsNotificationPanelOpen = false;
  IsMobileNavigationOpen = false;
  IsCompactNavigation = false;
  SelectedCenterNotification: MockCenterNotification | null = null;
  IsProfileMenuOpen = false;
  BackOfficeBindingAccount = '';
  BackOfficeBindingPassword = '';
  BackOfficeBindingError = '';
  NotificationCenterTab: 'All' | 'Unread' = 'All';
  NotificationCenterCurrentPage = 1;
  NotificationPopoverTab: 'All' | 'Unread' = 'All';
  DatabaseConnectionDraft: MockDatabaseConnectionDraft =
    this.CreateDatabaseConnectionDraft();
  EditingDatabaseConnectionKey: string | null = null;
  IsDatabaseConnectionEditorOpen = false;
  IsDatabaseConnectionDiscardConfirmationOpen = false;
  IsPageDiscardConfirmationOpen = false;
  DatabaseConnectionFormError = '';
  IsReportDiscardConfirmationOpen = false;
  IsReportCategoryQuickAddOpen = false;
  QuickAddCategoryName = '';
  QuickAddCategoryError = '';
  EditingReportKey: MockReportKey | null = null;
  ReportEditorDraft: ReportEditorDraft = this.CreateReportEditorDraft();
  SelectedReportFileName = '';
  ReportEditorError = '';
  IsReportFileInvalid = false;
  ReportUploadStep: ReportUploadStep = 'Form';
  PublishedUploadedReport: MockReportReadModel | null = null;
  private ReportEditorInitialDraft: ReportEditorDraft | null = null;
  private pendingReportRouteLeave: Subject<boolean> | null = null;
  private pendingPageRouteLeave: Subject<boolean> | null = null;
  private allowReportRouteLeave = false;
  private DatabaseConnectionInitialDraft: MockDatabaseConnectionDraft | null = null;
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
  @ViewChild('mobileNavigationTrigger')
  private mobileNavigationTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('notificationDetailCloseButton')
  private notificationDetailCloseButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('reportEditorDialog')
  private reportEditorDialog?: ElementRef<HTMLElement>;
  @ViewChild('reportDiscardDialog')
  private reportDiscardDialog?: UnsavedChangesDialogComponent;
  @ViewChild(ReportManagementPageComponent)
  private reportManagementPage?: ReportManagementPageComponent;
  @ViewChild(UserManagementPageComponent)
  private userManagementPage?: UserManagementPageComponent;
  private ShouldFocusMobileNavigationTrigger = false;

  get AccessNotice(): string {
    const State = this.route.snapshot.queryParamMap?.get('state');
    return State === 'permission-denied'
      ? '目前帳號沒有此功能的使用權限。'
      : State === 'report-unavailable'
        ? '請選擇目前有預覽權限的報表。'
        : '';
  }

  ngOnInit(): void {
    this.UpdateCompactNavigationState();
    if (this.Page === 'ReportUpload') this.InitializeReportUploadFlow();
    const NavigationState =
      this.router.getCurrentNavigation()?.extras.state ?? history.state;
    if (NavigationState?.['NotificationCenterTab'] === 'Unread')
      this.SetNotificationCenterTab('Unread');
  }

  ngAfterViewChecked(): void {
    if (this.ShouldFocusMobileNavigationTrigger) {
      const Trigger = this.mobileNavigationTrigger?.nativeElement;
      if (Trigger) {
        Trigger.focus();
        this.ShouldFocusMobileNavigationTrigger = false;
      }
    }
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
      if (this.reportDiscardDialog) {
        this.reportDiscardDialog.FocusContinueButton();
        this.ShouldFocusReportDiscardContinue = false;
      }
    }
    if (this.PendingReportEditorFocus?.isConnected) {
      this.PendingReportEditorFocus.focus();
      this.PendingReportEditorFocus = null;
    }
  }

  get SuccessToastMessage(): string {
    return this.Notifications.SuccessMessage;
  }

  get PageTitle(): string {
    const PageTitles: Readonly<Record<DemoPortalPage, string>> = {
      ReportList: '收藏的報表',
      ReportParameter: '所有報表',
      ReportPreview: '報表預覽',
      UserManagement: '使用者管理',
      RptManagement: '報表管理',
      ReportEdit: '編輯報表',
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

  get NotificationPopoverTabs(): readonly PortalTab[] {
    return [
      { id: 'All', label: `全部 (${this.CurrentNotifications.length})` },
      { id: 'Unread', label: `未讀 (${this.NotificationBadgeCount})` },
    ];
  }

  get NotificationCenterTabs(): readonly PortalTab[] {
    return [
      { id: 'All', label: `全部 (${this.CurrentNotifications.length})` },
      { id: 'Unread', label: `未讀 (${this.NotificationBadgeCount})` },
    ];
  }

  get NotificationCenterTotalPages(): number {
    return Math.max(
      1,
      Math.ceil(this.DisplayedNotifications.length / this.PaginationPageSize),
    );
  }

  get NotificationCenterPageNumbers(): readonly number[] {
    return Array.from(
      { length: this.NotificationCenterTotalPages },
      (_, Index) => Index + 1,
    );
  }

  get PagedDisplayedNotifications(): readonly MockCenterNotification[] {
    const StartIndex =
      (this.NotificationCenterCurrentPage - 1) * this.PaginationPageSize;
    return this.DisplayedNotifications.slice(
      StartIndex,
      StartIndex + this.PaginationPageSize,
    );
  }



  get AdminDescription(): string {
    const Descriptions: Partial<Record<DemoPortalPage, string>> = {
      DatabaseConnection: '檢視資料庫連線設定畫面；不會顯示或連線真實帳密。',
    };
    return Descriptions[this.Page] ?? '';
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

  @HostListener('window:resize')
  OnWindowResize(): void {
    this.UpdateCompactNavigationState();
  }

  @HostListener('document:keydown.escape')
  OnEscapeKey(): void {
    if (this.SelectedCenterNotification) {
      this.CloseNotificationDetail();
      return;
    }
    if (this.IsMobileNavigationOpen) {
      this.CloseMobileNavigation();
      return;
    }
    this.IsNotificationPanelOpen = false;
    this.IsProfileMenuOpen = false;
  }

  ToggleMobileNavigation(): void {
    if (!this.IsCompactNavigation) return;
    this.IsNotificationPanelOpen = false;
    this.IsProfileMenuOpen = false;
    this.IsMobileNavigationOpen = !this.IsMobileNavigationOpen;
  }

  CloseMobileNavigation(): void {
    if (!this.IsMobileNavigationOpen) return;
    this.IsMobileNavigationOpen = false;
    this.ShouldFocusMobileNavigationTrigger = true;
  }

  private UpdateCompactNavigationState(): void {
    this.IsCompactNavigation =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    if (!this.IsCompactNavigation) this.IsMobileNavigationOpen = false;
  }

  SetNotificationPopoverTab(
    Tab: 'All' | 'Unread',
  ): void {
    this.NotificationPopoverTab = Tab;
  }

  SetNotificationPopoverTabFromId(Tab: string): void {
    if (Tab === 'All' || Tab === 'Unread') this.SetNotificationPopoverTab(Tab);
  }

  SetNotificationCenterTab(Tab: 'All' | 'Unread'): void {
    this.NotificationCenterTab = Tab;
    this.NotificationCenterCurrentPage = 1;
  }

  SetNotificationCenterTabFromId(Tab: string): void {
    if (Tab === 'All' || Tab === 'Unread') this.SetNotificationCenterTab(Tab);
  }

  GoToNotificationCenterPage(Page: number): void {
    this.NotificationCenterCurrentPage = Math.min(
      Math.max(1, Page),
      this.NotificationCenterTotalPages,
    );
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
    if (Account) {
      this.NotificationCenter.MarkNotificationRead(Id, Account);
      this.GoToNotificationCenterPage(this.NotificationCenterCurrentPage);
    }
  }

  OpenNotificationDetail(Notification: MockCenterNotification): void {
    if (this.Auth.RequiresBackOfficeIdentityBinding) return;
    this.NotificationDetailOpener = this.GetActiveHTMLElement();
    this.IsNotificationPanelOpen = false;
    this.SelectedCenterNotification = Notification;
    this.MarkCenterNotificationRead(Notification.Id);
    this.ShouldFocusNotificationDetailClose = true;
  }

  TrackNotificationById(
    _: number,
    Notification: MockCenterNotification,
  ): string {
    return Notification.Id;
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
      this.BackOfficeBindingError = '帳號或密碼不正確，請重新輸入。';
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


  OpenCategoryManagementDialog(): void {
    this.reportManagementPage?.OpenCategoryManagementDialog();
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
  }

  ReturnToReportManagement(): void {
    void this.router.navigate(['/report-management']);
  }


  RequestCloseReportEditor(): void {
    if (!this.IsReportUploadFlow) return;
    if (!this.IsReportEditorDirty()) {
      this.ReturnToReportManagement();
      return;
    }
    this.ReportDiscardConfirmationReturnFocus = this.GetActiveHTMLElement();
    this.IsReportDiscardConfirmationOpen = true;
    this.ShouldFocusReportDiscardContinue = true;
  }

  ContinueEditingReport(): void {
    if (!this.IsReportDiscardConfirmationOpen) return;
    if (this.pendingReportRouteLeave) {
      this.pendingReportRouteLeave.next(false);
      this.pendingReportRouteLeave.complete();
      this.pendingReportRouteLeave = null;
      this.IsReportDiscardConfirmationOpen = false;
      this.ShouldFocusReportDiscardContinue = false;
      return;
    }
    this.IsReportDiscardConfirmationOpen = false;
    this.ShouldFocusReportDiscardContinue = false;
    this.ScheduleReportEditorFocus(this.ReportDiscardConfirmationReturnFocus);
    this.ReportDiscardConfirmationReturnFocus = null;
  }

  DiscardReportEditorChanges(): void {
    if (!this.IsReportDiscardConfirmationOpen) return;
    if (this.pendingReportRouteLeave) {
      this.pendingReportRouteLeave.next(true);
      this.pendingReportRouteLeave.complete();
      this.pendingReportRouteLeave = null;
      this.IsReportDiscardConfirmationOpen = false;
      return;
    }
    this.IsReportDiscardConfirmationOpen = false;
    this.allowReportRouteLeave = true;
    this.ReturnToReportManagement();
  }

  CanLeavePage(): boolean | Observable<boolean> {
    if (this.allowReportRouteLeave) return true;
    if (this.IsReportUploadFlow && this.IsReportEditorDirty()) {
      if (!this.pendingReportRouteLeave) {
        this.pendingReportRouteLeave = new Subject<boolean>();
        this.IsReportDiscardConfirmationOpen = true;
        this.ShouldFocusReportDiscardContinue = true;
      }
      return this.pendingReportRouteLeave.pipe(take(1));
    }
    if (!this.HasOtherUnsavedChanges()) return true;
    if (!this.pendingPageRouteLeave) {
      this.pendingPageRouteLeave = new Subject<boolean>();
      this.IsPageDiscardConfirmationOpen = true;
    }
    return this.pendingPageRouteLeave.pipe(take(1));
  }

  ContinueEditingPageChanges(): void {
    if (!this.pendingPageRouteLeave) return;
    this.pendingPageRouteLeave.next(false);
    this.pendingPageRouteLeave.complete();
    this.pendingPageRouteLeave = null;
    this.IsPageDiscardConfirmationOpen = false;
  }

  DiscardPageChanges(): void {
    if (!this.pendingPageRouteLeave) return;
    this.pendingPageRouteLeave.next(true);
    this.pendingPageRouteLeave.complete();
    this.pendingPageRouteLeave = null;
    this.IsPageDiscardConfirmationOpen = false;
  }

  OpenReportCategoryQuickAdd(): void {
    if (
      !this.Auth.HasManagementPermission('RptManagement') ||
      !this.IsReportUploadFlow
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


  OpenCreateDatabaseConnection(): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    this.EditingDatabaseConnectionKey = null;
    this.DatabaseConnectionDraft = this.CreateDatabaseConnectionDraft();
    this.DatabaseConnectionInitialDraft = { ...this.DatabaseConnectionDraft };
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
    this.DatabaseConnectionInitialDraft = { ...this.DatabaseConnectionDraft };
    this.IsDatabaseConnectionEditorOpen = true;
  }

  ToggleDatabaseConnectionEnabled(Connection: MockDatabaseConnection): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    const Enabled = !Connection.Enabled;
    const IsUpdated = this.DatabaseConnections.Update(Connection.Key, {
      ...Connection,
      Enabled,
      Password: '',
    });
    if (!IsUpdated) return;
    this.ShowSuccessToast(`資料庫連線「${Connection.DataSourceName}」已${Enabled ? '啟用' : '停用'}。`);
  }

  TrackDatabaseConnection(_: number, Connection: MockDatabaseConnection): string {
    return Connection.Key;
  }

  RequestCloseDatabaseConnectionEditor(): void {
    if (!this.IsDatabaseConnectionEditorDirty()) {
      this.CloseDatabaseConnectionEditor();
      return;
    }
    this.IsDatabaseConnectionDiscardConfirmationOpen = true;
  }

  ContinueEditingDatabaseConnection(): void {
    this.IsDatabaseConnectionDiscardConfirmationOpen = false;
  }

  DiscardDatabaseConnectionChanges(): void {
    this.IsDatabaseConnectionDiscardConfirmationOpen = false;
    this.CloseDatabaseConnectionEditor();
  }

  CloseDatabaseConnectionEditor(): void {
    this.IsDatabaseConnectionEditorOpen = false;
    this.IsDatabaseConnectionDiscardConfirmationOpen = false;
    this.EditingDatabaseConnectionKey = null;
    this.DatabaseConnectionDraft = this.CreateDatabaseConnectionDraft();
    this.DatabaseConnectionInitialDraft = null;
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

  get IsManagementPage(): boolean {
    return [
      'UserManagement',
      'OperationLog',
      'RptManagement',
      'ReportEdit',
      'DatabaseConnection',
    ].includes(this.Page);
  }

  get CanAccessPage(): boolean {
    if (this.Page === 'NotificationCenter') return this.Auth.IsAuthenticated;
    if (this.Page === 'UserManagement') return this.Auth.IsBackOffice;
    if (this.Page === 'RptManagement' || this.Page === 'ReportEdit')
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

  private IsDatabaseConnectionEditorDirty(): boolean {
    const Initial = this.DatabaseConnectionInitialDraft;
    const Draft = this.DatabaseConnectionDraft;
    return Boolean(
      Initial &&
        (Initial.DataSourceName !== Draft.DataSourceName ||
          Initial.ServerHost !== Draft.ServerHost ||
          Initial.Port !== Draft.Port ||
          Initial.DatabaseName !== Draft.DatabaseName ||
          Initial.Username !== Draft.Username ||
          Initial.ConnectionType !== Draft.ConnectionType ||
          Initial.Enabled !== Draft.Enabled ||
          Initial.Password !== Draft.Password),
    );
  }

  private HasOtherUnsavedChanges(): boolean {
    return (
      (this.IsDatabaseConnectionEditorOpen && this.IsDatabaseConnectionEditorDirty()) ||
      this.reportManagementPage?.HasUnsavedChanges() === true ||
      this.userManagementPage?.HasUnsavedChanges() === true
    );
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


}
