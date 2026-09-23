import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
import { MockAuditLogService } from '../services/mock-audit-log.service';
import { BoringAvatarComponent } from '../shared/boring-avatar.component';
import { PortalPaginationComponent } from '../shared/portal-pagination.component';
import { FavoriteReportPageComponent } from './favorite-report-page/favorite-report-page.component';
import { OperationLogPageComponent } from './operation-log-page/operation-log-page.component';
import { PortalNavigationComponent } from './portal-navigation/portal-navigation.component';
import { ReportEditorFormComponent } from './report-editor-form/report-editor-form.component';
import { ReportManagementPageComponent } from './report-management-page/report-management-page.component';
import { ReportParameterPageComponent } from './report-parameter-page/report-parameter-page.component';
import { ReportPreviewPageComponent } from './report-preview-page/report-preview-page.component';
import { UserManagementPageComponent } from './user-management-page/user-management-page.component';
import { ReportEditorDraft } from './report-editor-form/report-editor-form.model';
import { DataSourceService } from '../services/data-source.service';
import { ReportService } from '../services/report.service';
import {
  DataSourceConnectionTestResponse,
  DataSourceManagementModel,
} from '../services/data-source-api.models';

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

interface PublishedUploadSummary {
  readonly ReportName: string;
  readonly CategoryName: string;
  readonly FileName: string;
  readonly CreatedAt: string;
}

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
    BoringAvatarComponent,
    PortalPaginationComponent,
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
  readonly DataSourcesApi = inject(DataSourceService);
  readonly ReportsApi = inject(ReportService);
  ApiDataSources: DataSourceManagementModel[] = [];
  IsDataSourcesLoading = false;
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
  NotificationPopoverTab: 'All' | 'Unread' = 'All';
  AccountSettingsDraft: MockAccountSettingsDraft =
    this.CreateAccountSettingsDraft();
  AccountSettingsConfirmation = '';
  AccountProfileNotice = '';
  AccountPasswordNotice = '';
  IsPasswordChangeSuccessModalOpen = false;
  DatabaseConnectionDraft: MockDatabaseConnectionDraft =
    this.CreateDatabaseConnectionDraft();
  EditingDatabaseConnectionKey: string | null = null;
  IsDatabaseConnectionEditorOpen = false;
  DatabaseConnectionFormError = '';
  DatabaseAuthenticationType: 'Windows' | 'SqlServer' = 'SqlServer';
  TestingDataSourceId: number | null = null;
  DataSourceTestResult: DataSourceConnectionTestResponse | null = null;
  DataSourceTestError = '';
  IsReportDiscardConfirmationOpen = false;
  IsReportCategoryQuickAddOpen = false;
  QuickAddCategoryName = '';
  QuickAddCategoryError = '';
  EditingReportKey: MockReportKey | null = null;
  ReportEditorDraft: ReportEditorDraft = this.CreateReportEditorDraft();
  SelectedReportFileName = '';
  SelectedReportFile: File | null = null;
  ReportUploadCategories: MockReportCategory[] = [];
  ReportEditorError = '';
  IsReportFileInvalid = false;
  IsReportUploadPublishing = false;
  ReportUploadStep: ReportUploadStep = 'Form';
  PublishedUploadedReport: PublishedUploadSummary | null = null;
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
  @ViewChild('mobileNavigationTrigger')
  private mobileNavigationTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('notificationDetailCloseButton')
  private notificationDetailCloseButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('reportEditorDialog')
  private reportEditorDialog?: ElementRef<HTMLElement>;
  @ViewChild('reportDiscardDialog')
  private reportDiscardDialog?: ElementRef<HTMLElement>;
  @ViewChild('reportDiscardContinueButton')
  private reportDiscardContinueButton?: ElementRef<HTMLButtonElement>;
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
    this.LoadAccountSettings();
      if (this.Page === 'ReportUpload') {
        this.InitializeReportUploadFlow();
        this.LoadReportUploadCategories();
      }
      if (this.Page === 'DatabaseConnection') this.LoadDataSources();
    const NavigationState =
      this.router.getCurrentNavigation()?.extras.state ?? history.state;
    if (NavigationState?.['NotificationCenterTab'] === 'Unread')
      this.NotificationCenterTab = 'Unread';
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
    this.Auth.VerifyBackOfficeOperator(
      this.BackOfficeBindingAccount,
      this.BackOfficeBindingPassword,
    ).subscribe({
      next: () => {
        this.AuditLog.RecordBackOfficeAction('後台身分綁定', '完成後台操作 session 的前台身分驗證。');
        this.Notifications.ShowSuccess('身分驗證成功，已進入後台。');
        this.userManagementPage?.LoadApiManagementData();
        this.BackOfficeBindingAccount = '';
        this.BackOfficeBindingPassword = '';
      },
      error: (VerificationError: unknown) => {
        this.BackOfficeBindingError = VerificationError instanceof Error
          ? VerificationError.message
          : '帳號或密碼不正確，請重新輸入。';
      },
    });
  }

  ReturnToLoginFromBackOfficeBinding(): void {
    if (!this.Auth.RequiresBackOfficeIdentityBinding) return;
    this.Auth.Logout();
    void this.router.navigate(['/login']);
  }


  get ReportEditorCategories() {
    if (this.IsReportUploadFlow) return this.ReportUploadCategories;
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
    this.IsReportUploadPublishing = true;
    this.ReportsApi.CreateManagedReportWithRpt(
      {
        reportCode: this.ReportEditorDraft.ReportCode!.trim(),
        reportName: this.ReportEditorDraft.ReportName.trim(),
        description: this.ReportEditorDraft.Description.trim(),
        categoryId: Number(this.ReportEditorDraft.CategoryId),
        dataSourceId: null,
        credentialType: 'ReadOnly',
      },
      this.SelectedReportFile!,
    ).subscribe({
      next: (result) => {
        this.PublishedUploadedReport = {
          ReportName: this.ReportEditorDraft.ReportName.trim(),
          CategoryName: this.ReportUploadCategoryName,
          FileName: result.data.fileName,
          CreatedAt: new Date().toISOString(),
        };
        this.ReportUploadStep = 'Complete';
        this.RememberInitialReportEditorState();
        this.IsReportUploadPublishing = false;
      },
      error: (error: unknown) => {
        this.ReportEditorError = this.GetApiErrorMessage(error);
        this.ReportUploadStep = 'Form';
        this.IsReportUploadPublishing = false;
      },
    });
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
    this.IsReportDiscardConfirmationOpen = false;
    this.ShouldFocusReportDiscardContinue = false;
    this.ScheduleReportEditorFocus(this.ReportDiscardConfirmationReturnFocus);
    this.ReportDiscardConfirmationReturnFocus = null;
  }

  DiscardReportEditorChanges(): void {
    if (!this.IsReportDiscardConfirmationOpen) return;
    this.IsReportDiscardConfirmationOpen = false;
    this.ReturnToReportManagement();
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
      this.SelectedReportFile = null;
      this.ReportEditorError = '僅允許上傳 .rpt 報表檔案。';
      this.IsReportFileInvalid = true;
      Input.value = '';
      return;
    }
    this.SelectedReportFileName = File.name;
    this.SelectedReportFile = File;
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
  }


  OpenCreateDatabaseConnection(): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    this.EditingDatabaseConnectionKey = null;
    this.DatabaseConnectionDraft = this.CreateDatabaseConnectionDraft();
    this.DatabaseAuthenticationType = 'SqlServer';
    this.DatabaseConnectionFormError = '';
    this.IsDatabaseConnectionEditorOpen = true;
  }

  LoadDataSources(): void {
    this.IsDataSourcesLoading = true;
    this.DataSourcesApi.getDataSources().subscribe({
      next: (sources) => {
        this.ApiDataSources = [...sources];
        this.IsDataSourcesLoading = false;
      },
      error: (error: unknown) => {
        this.IsDataSourcesLoading = false;
        this.DatabaseConnectionFormError = error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message : '無法取得資料庫連線清單。';
      },
    });
  }

  OpenEditDatabaseConnection(Key: string): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    const Connection = this.ApiDataSources.find((entry) => String(entry.dataSourceId) === Key);
    if (!Connection) return;
    this.EditingDatabaseConnectionKey = Key;
    this.DatabaseConnectionDraft = {
      DataSourceName: Connection.dataSourceName,
      ServerHost: Connection.serverHost,
      Port: String(Connection.port),
      DatabaseName: Connection.databaseName,
      Username: Connection.username,
      ConnectionType: 'ReadOnly',
      Enabled: Connection.isEnabled,
      Password: '',
    };
    this.DatabaseAuthenticationType = Connection.authenticationType === 'Windows'
      ? 'Windows'
      : 'SqlServer';
    this.DatabaseConnectionFormError = '';
    this.IsDatabaseConnectionEditorOpen = true;
  }

  TestDataSourceConnection(dataSourceId: number): void {
    if (this.TestingDataSourceId !== null) return;

    this.TestingDataSourceId = dataSourceId;
    this.DataSourceTestResult = null;
    this.DataSourceTestError = '';

    this.DataSourcesApi.testConnection(dataSourceId).subscribe({
      next: (result) => {
        this.DataSourceTestResult = result;
        this.TestingDataSourceId = null;
      },
      error: (error: unknown) => {
        this.DataSourceTestError =
          error instanceof HttpErrorResponse &&
          typeof error.error?.message === 'string'
            ? error.error.message
            : '資料庫連線測試失敗。';
        this.TestingDataSourceId = null;
      },
    });
  }

  CloseDatabaseConnectionEditor(): void {
    this.IsDatabaseConnectionEditorOpen = false;
    this.EditingDatabaseConnectionKey = null;
    this.DatabaseConnectionDraft = this.CreateDatabaseConnectionDraft();
    this.DatabaseAuthenticationType = 'SqlServer';
    this.DatabaseConnectionFormError = '';
  }

  SaveDatabaseConnection(): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    this.DatabaseConnectionFormError = '';
    const Draft = this.DatabaseConnectionDraft;
    const RequiresSqlCredentials = this.DatabaseAuthenticationType === 'SqlServer';
    if (!Draft.DataSourceName.trim() || !Draft.ServerHost.trim() || !Draft.DatabaseName.trim() || !Draft.Port || (RequiresSqlCredentials && (!Draft.Username.trim() || (!this.EditingDatabaseConnectionKey && !Draft.Password)))) {
      this.DatabaseConnectionFormError = RequiresSqlCredentials
        ? '請確認資料來源、主機、連接埠、資料庫、帳號與密碼。'
        : '請確認資料來源、主機、連接埠與資料庫名稱。';
      return;
    }
    const request = {
      dataSourceName: Draft.DataSourceName.trim(),
      serverHost: Draft.ServerHost.trim(),
      port: Number(Draft.Port),
      databaseName: Draft.DatabaseName.trim(),
      isEnabled: Draft.Enabled,
      authenticationType: this.DatabaseAuthenticationType,
      username: RequiresSqlCredentials ? Draft.Username.trim() : undefined,
      password: RequiresSqlCredentials ? Draft.Password : undefined,
    };
    this.DataSourcesApi.saveManagedDataSource(
      request,
      this.EditingDatabaseConnectionKey
        ? Number(this.EditingDatabaseConnectionKey)
        : undefined,
    ).subscribe({
      next: () => {
        this.CloseDatabaseConnectionEditor();
        this.LoadDataSources();
        this.ShowSuccessToast('MSSQL 資料庫連線已儲存。');
      },
      error: (error: unknown) => this.DatabaseConnectionFormError = error instanceof HttpErrorResponse && typeof error.error?.message === 'string' ? error.error.message : '儲存資料庫連線失敗。',
    });
  }

  SaveAccountProfile(): void {
    const CurrentUser = this.Auth.CurrentUser;
    if (!CurrentUser) return;
    this.AccountProfileNotice = '';
    this.Auth.UpdateProfile({
      userName: this.AccountSettingsDraft.DisplayName,
    }).subscribe({
      next: (response) => {
        this.AccountProfileNotice = response.message;
        this.LoadAccountSettings();
      },
      error: (error: unknown) => {
        this.AccountProfileNotice = error instanceof HttpErrorResponse &&
          typeof error.error?.message === 'string'
          ? error.error.message
          : '無法儲存個人資料。';
      },
    });
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
    this.Auth.ChangePassword({
      currentPassword: this.AccountSettingsDraft.OldPassword,
      newPassword: this.AccountSettingsDraft.NewPassword,
    }).subscribe({
      next: () => {
        this.LoadAccountSettings();
        this.IsPasswordChangeSuccessModalOpen = true;
      },
      error: (error: unknown) => {
        this.AccountPasswordNotice = error instanceof HttpErrorResponse &&
          typeof error.error?.message === 'string'
          ? error.error.message
          : '無法更新密碼，請稍後再試。';
      },
    });
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
    this.SelectedReportFile = null;
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
    this.IsReportUploadPublishing = false;
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
    if (this.IsReportUploadFlow && !this.ReportEditorDraft.ReportCode?.trim()) {
      return '請輸入報表代碼。';
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
    if (!this.EditingReportKey && !this.SelectedReportFile) {
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

  private LoadReportUploadCategories(): void {
    this.ReportsApi.GetManagedReportCategories().subscribe({
      next: (categories) => {
        this.ReportUploadCategories = categories.map((category) => ({
          CategoryId: String(category.categoryId),
          CategoryName: category.categoryName,
          IsSystemReserved: false,
        }));
      },
      error: (error: unknown) => {
        this.ReportEditorError = this.GetApiErrorMessage(error);
      },
    });
  }

  private GetApiErrorMessage(error: unknown): string {
    return error instanceof HttpErrorResponse &&
      typeof error.error?.message === 'string'
      ? error.error.message
      : '服務暫時無法使用，請稍後再試。';
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


}
