import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
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
} from '../mock/mock-permissions';
import { MockReport, MockReportKey } from '../mock/mock-reports';
import { AuthService } from '../services/auth.service';
import {
  MockAccountSettingsDraft,
  MockFavoriteReport,
  MockRbacService,
  MockRoleChangeRequestStatus,
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
  MockDatabaseConnectionDraft,
  MockDatabaseConnectionService,
} from '../services/mock-database-connection.service';
import { MockReportParameterService } from '../services/mock-report-parameter.service';

type DemoPortalPage =
  | 'ReportList'
  | 'ReportParameter'
  | 'ReportPreview'
  | 'AccountSettings'
  | 'UserManagement'
  | 'RptManagement'
  | 'DatabaseConnection'
  | 'OperationLog';

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

type ParameterReportSortField = 'ReportName' | 'Category';
type ParameterReportSortDirection = 'asc' | 'desc';

interface FavoriteCategoryTab {
  readonly Category: string;
  readonly Count: number;
}

interface ParameterReportCategoryTab {
  readonly Category: string;
  readonly Count: number;
}

interface ParameterReportSearchState {
  readonly Category: string;
  readonly SearchText: string;
  readonly SortField: ParameterReportSortField | null;
  readonly SortDirection: ParameterReportSortDirection;
  readonly StartDate: string;
  readonly EndDate: string;
}

interface ReportEditorDraft {
  ReportName: string;
  Category: string;
  Enabled: boolean;
}

type CreateUserField = 'Account' | 'DisplayName' | 'InitialPassword' | 'Roles';
type CreateUserValidationErrors = Partial<Record<CreateUserField, string>>;

interface CreatedUserCredentials {
  readonly Account: string;
  readonly InitialPassword: string;
}

@Component({
  selector: 'app-demo-portal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './demo-portal.component.html',
  styleUrl: './demo-portal.component.scss',
})
export class DemoPortalComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly PaginationPageSize = 10;
  readonly Auth = inject(AuthService);
  readonly MockRbac = inject(MockRbacService);
  readonly ReportParameters = inject(MockReportParameterService);
  readonly DatabaseConnections = inject(MockDatabaseConnectionService);
  readonly Notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly Page = this.route.snapshot.data['Page'] as DemoPortalPage;
  SelectedFavoriteCategory = '全部';
  SelectedParameterReportCategory = '全部';
  FavoriteLastUsedSortDirection: 'asc' | 'desc' = 'desc';
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
  LastMockExecutionParameters: Readonly<Record<string, MockParameterFormValue>> | null =
    null;
  MockNotice = '';
  IsExportMenuOpen = false;
  private ReturnToParameterSearchState: ParameterReportSearchState | null = null;
  readonly ExportOptions: readonly MockExportOption[] = [
    { Label: 'PDF', FormatKey: 'Pdf', Enabled: true, MockOnly: true, RequiresBackendConfirmation: false },
    { Label: 'Excel', FormatKey: 'Excel', Enabled: true, MockOnly: true, RequiresBackendConfirmation: true },
    { Label: 'Word', FormatKey: 'Word', Enabled: true, MockOnly: true, RequiresBackendConfirmation: true },
    { Label: 'CSV', FormatKey: 'Csv', Enabled: true, MockOnly: true, RequiresBackendConfirmation: true },
    { Label: 'RTF', FormatKey: 'Rtf', Enabled: true, MockOnly: true, RequiresBackendConfirmation: true },
    { Label: '文字檔', FormatKey: 'Text', Enabled: true, MockOnly: true, RequiresBackendConfirmation: true },
  ];
  ManagementNotice = '';
  EditingAccount: string | null = null;
  UserDraft: MockUserDraft = this.CreateUserDraft();
  CreateUserValidationErrors: CreateUserValidationErrors = {};
  CreatedUserCredentials: CreatedUserCredentials | null = null;
  CreatedUserCopyNotice = '';
  EditingUser: MockUserEditDraft | null = null;
  DeletingUser: MockUser | null = null;
  AccountSettingsDraft: MockAccountSettingsDraft = this.CreateAccountSettingsDraft();
  AccountSettingsConfirmation = '';
  AccountSettingsNotice = '';
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
  DatabaseConnectionNotice = '';
  ReportManagementStartDate = '';
  ReportManagementEndDate = '';
  ReportManagementDateNotice = '';
  ReportManagementCategory = '全部';
  ReportManagementSearchText = '';
  ReportManagementCurrentPage = 1;
  IsUploadReportDialogOpen = false;
  EditingReportKey: MockReportKey | null = null;
  DeletingReport: MockReport | null = null;
  ReportEditorDraft: ReportEditorDraft = this.CreateReportEditorDraft();
  SelectedReportFileName = '';
  ReportEditorError = '';
  IsReportFileInvalid = false;
  @ViewChild('roleCardViewport')
  private roleCardViewport?: ElementRef<HTMLElement>;
  private roleCardResizeObserver?: ResizeObserver;

  ngOnInit(): void {
    this.LoadAccountSettings();
    const NavigationState = this.router.getCurrentNavigation()?.extras.state;
    if (this.Page === 'ReportParameter') {
      this.RestoreParameterSearchState(
        NavigationState?.['ParameterSearchState'],
      );
      this.ParameterReportSelectionNotice = NavigationState?.['ReportSelectionRequired']
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
      this.ReturnToParameterSearchState = this.ToParameterSearchState(
        NavigationState?.['ParameterSearchState'],
      );
    }
    this.IsReportParameterMode =
      this.Page === 'ReportParameter' &&
      this.router.getCurrentNavigation()?.extras.state?.['OpenReportParameters'] ===
        true;
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

  ngOnDestroy(): void {
    this.roleCardResizeObserver?.disconnect();
  }

  get SuccessToastMessage(): string {
    return this.Notifications.SuccessMessage;
  }

  get PageTitle(): string {
    const PageTitles: Readonly<Record<DemoPortalPage, string>> = {
      ReportList: '收藏的報表',
      ReportParameter: '報表搜尋 / 報表條件',
      ReportPreview: '報表預覽',
      AccountSettings: '帳號設定',
      UserManagement: '使用者管理',
      RptManagement: '報表管理',
      DatabaseConnection: 'MSSQL 資料庫連線管理',
      OperationLog: '操作紀錄查詢',
    };
    return PageTitles[this.Page];
  }

  get FavoriteReports(): readonly MockFavoriteReport[] {
    const Account = this.Auth.CurrentUser?.Account;
    return Account
      ? this.MockRbac.GetFavoriteReports(Account, this.Auth.ActiveRoles)
      : [];
  }

  get FavoriteCategoryTabs(): readonly FavoriteCategoryTab[] {
    const FavoriteReports = this.FavoriteReports;
    const Categories = [...new Set(FavoriteReports.map(({ Report }) => Report.Category))];
    return [
      { Category: '全部', Count: FavoriteReports.length },
      ...Categories.map((Category) => ({
        Category,
        Count: FavoriteReports.filter(({ Report }) => Report.Category === Category)
          .length,
      })),
    ];
  }

  get DisplayedFavoriteReports(): readonly MockFavoriteReport[] {
    const Direction = this.FavoriteLastUsedSortDirection === 'asc' ? 1 : -1;
    return this.FavoriteReports
      .filter(
        ({ Report }) =>
          this.SelectedFavoriteCategory === '全部' ||
          Report.Category === this.SelectedFavoriteCategory,
      )
      .sort((Left, Right) => {
        if (!Left.LastUsedAt && !Right.LastUsedAt) {
          return Left.Report.ReportName.localeCompare(
            Right.Report.ReportName,
            'zh-Hant',
          );
        }
        if (!Left.LastUsedAt) return 1;
        if (!Right.LastUsedAt) return -1;
        return (
          (new Date(Left.LastUsedAt).getTime() -
            new Date(Right.LastUsedAt).getTime()) *
          Direction
        );
      });
  }

  SetFavoriteCategory(Category: string): void {
    this.SelectedFavoriteCategory = Category;
  }

  ToggleFavoriteLastUsedSort(): void {
    this.FavoriteLastUsedSortDirection =
      this.FavoriteLastUsedSortDirection === 'asc' ? 'desc' : 'asc';
  }

  GetFavoriteLastUsedSortIndicator(): string {
    return this.FavoriteLastUsedSortDirection === 'asc' ? '↑' : '↓';
  }

  GetFavoriteLastUsedAriaSort(): 'ascending' | 'descending' {
    return this.FavoriteLastUsedSortDirection === 'asc'
      ? 'ascending'
      : 'descending';
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

  RemoveFavoriteReport(Favorite: MockFavoriteReport): void {
    const Account = this.Auth.CurrentUser?.Account;
    if (!Account) return;
    if (!this.MockRbac.RemoveFavoriteReport(Account, Favorite.Report.ReportKey)) {
      return;
    }
    if (
      this.SelectedFavoriteCategory !== '全部' &&
      !this.FavoriteCategoryTabs.some(
        (Tab) => Tab.Category === this.SelectedFavoriteCategory,
      )
    ) {
      this.SelectedFavoriteCategory = '全部';
    }
    this.ShowSuccessToast(`已取消收藏「${Favorite.Report.ReportName}」。`);
  }

  IsFavoriteReport(ReportKey: MockReportKey): boolean {
    const Account = this.Auth.CurrentUser?.Account;
    return Account ? this.MockRbac.IsFavoriteReport(Account, ReportKey) : false;
  }

  ToggleFavoriteReport(ReportKey: MockReportKey): void {
    const Account = this.Auth.CurrentUser?.Account;
    if (!Account) return;
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

  get ParameterAccessibleReports() {
    return this.Auth.AccessibleReports.filter((Report) => Report.Enabled);
  }

  get ParameterReportCategoryTabs(): readonly ParameterReportCategoryTab[] {
    const Reports = this.ParameterAccessibleReports;
    const Categories = [...new Set(Reports.map((Report) => Report.Category))];
    return [
      { Category: '全部', Count: Reports.length },
      ...Categories.map((Category) => ({
        Category,
        Count: Reports.filter((Report) => Report.Category === Category).length,
      })),
    ];
  }

  SetParameterReportCategory(Category: string): void {
    this.SelectedParameterReportCategory = Category;
    this.ResetParameterReportPagination();
  }

  get ParameterReportCategories(): readonly string[] {
    return this.ParameterReportCategoryTabs.slice(1).map((Tab) => Tab.Category);
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
    const SearchText = this.ParameterReportSearchText.trim().toLocaleLowerCase();
    const Reports = this.ParameterAccessibleReports.filter(
      (Report) =>
        (this.SelectedParameterReportCategory === '全部' ||
          Report.Category === this.SelectedParameterReportCategory) &&
        (!SearchText ||
          `${Report.ReportName} ${Report.Category} ${Report.Description}`
            .toLocaleLowerCase()
            .includes(SearchText)),
    );
    if (!this.ParameterReportSortField) return Reports;

    const SortField = this.ParameterReportSortField;
    const Direction = this.ParameterReportSortDirection === 'asc' ? 1 : -1;
    return [...Reports].sort(
      (Left, Right) =>
        Left[SortField].localeCompare(Right[SortField], 'zh-Hant') * Direction,
    );
  }

  get HasParameterReportSearchText(): boolean {
    return Boolean(this.ParameterReportSearchText.trim());
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

  GetParameterReportAriaSort(Field: ParameterReportSortField):
    | 'ascending'
    | 'descending'
    | 'none' {
    if (this.ParameterReportSortField !== Field) return 'none';
    return this.ParameterReportSortDirection === 'asc'
      ? 'ascending'
      : 'descending';
  }

  get AdminDescription(): string {
    const Descriptions: Partial<Record<DemoPortalPage, string>> = {
      UserManagement: '檢視使用者帳號、角色與啟用狀態的 Mock 清單。',
      DatabaseConnection: '檢視資料庫連線設定畫面；不會顯示或連線真實帳密。',
      OperationLog: '檢視操作紀錄畫面與 180 天 保存標示的 Mock 資料。',
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
    return this.ReportParameterDefinitions
      .filter((Definition) => Definition.IsVisible)
      .sort((Left, Right) => Left.DisplayOrder - Right.DisplayOrder);
  }

  get SelectedReportKey(): MockReportKey | null {
    return this.Auth.SelectedReport?.ReportKey ?? null;
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

  GetControlKind(Definition: MockReportParameterDefinition):
    | 'range'
    | 'textarea'
    | 'checkbox'
    | 'select'
    | 'input' {
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
      : Definition.Options ?? [];
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
    Object.keys(this.ParameterRangeErrors).forEach((Key) =>
      delete this.ParameterRangeErrors[Key],
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
    const Report = this.Auth.AccessibleReports.find((Entry) => Entry.ReportKey === ReportKey);
    if (!Report?.Enabled) return;
    this.Auth.SelectReport(ReportKey);
    const Account = this.Auth.CurrentUser?.Account;
    if (Account) this.MockRbac.RecordReportExecution(Account, ReportKey);
    void this.router.navigate(['/reports/preview']);
  }

  SelectReportForParameters(ReportKey: MockReportKey): void {
    const Report = this.ParameterAccessibleReports.find(
      (Entry) => Entry.ReportKey === ReportKey,
    );
    if (!Report) return;
    this.Auth.SelectReport(ReportKey);
    this.IsReportParameterMode = true;
    this.LoadReportParameterForm();
  }

  SelectReportForPreview(ReportKey: MockReportKey): void {
    const Report = this.ParameterAccessibleReports.find(
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
      state: { ParameterSearchState: this.CreateParameterSearchState() },
    });
  }

  ReturnToReportList(): void {
    void this.router.navigate(['/reports/parameters'], {
      state: this.ReturnToParameterSearchState
        ? { ParameterSearchState: this.ReturnToParameterSearchState }
        : undefined,
    });
  }

  ReturnToParameterReportSearch(): void {
    this.IsReportParameterMode = false;
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
    this.IsExportMenuOpen = !this.IsExportMenuOpen;
  }

  SelectExportOption(Option: MockExportOption): void {
    if (!Option.Enabled) return;
    this.IsExportMenuOpen = false;
    this.MockNotice = `${Option.Label} 匯出目前為前端 Mock 操作，尚未串接正式報表匯出服務。`;
  }

  SelectOutputAction(ActionName: 'BrowserPrint' | 'FixedPrinterPrint'): void {
    const ActionLabel = ActionName === 'BrowserPrint' ? '瀏覽器列印' : '固定印表機列印';
    this.MockNotice = `${ActionLabel}目前為前端 Mock 操作，尚未串接正式列印服務。`;
  }

  Logout(): void {
    this.Auth.Logout();
    this.Notifications.ShowSuccess('登出成功！');
    void this.router.navigate(['/login']);
  }

  SwitchDemoRole(Role: MockRoleKey): void {
    this.Auth.SwitchDemoRole(Role);
    if (!this.Auth.IsAdmin && this.IsAdministrationPage)
      void this.router.navigate(['/reports']);
  }

  EditUser(Account: string): void {
    const User = this.MockRbac.Users.find(
      (MockUser) => MockUser.Account === Account,
    );
    if (!User) return;
    this.EditingAccount = User.Account;
    this.EditingUser = {
      Roles: [...User.Roles],
      Enabled: User.Enabled,
    };
  }

  SaveUser(): void {
    this.CreateUserValidationErrors = this.GetCreateUserValidationErrors();
    if (Object.keys(this.CreateUserValidationErrors).length) return;

    const CreatedUserCredentials: CreatedUserCredentials = {
      Account: this.UserDraft.Account.trim(),
      InitialPassword: this.UserDraft.InitialPassword,
    };
    const IsSaved = this.MockRbac.CreateUser(this.UserDraft);
    this.ManagementNotice = '';
    if (!IsSaved) {
      this.CreateUserValidationErrors = {
        Account: '此使用者帳號已存在。',
      };
      return;
    }
    if (IsSaved) {
      this.EnsureUserPagination();
      this.CloseCreateUserDialog();
      this.CreatedUserCredentials = CreatedUserCredentials;
      this.CreatedUserCopyNotice = '';
    }
  }

  OpenCreateUserDialog(): void {
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
    return Roles.map((RoleKey) => this.MockRbac.GetRole(RoleKey)?.DisplayName ?? RoleKey).join('、');
  }

  IsRoleSelected(Roles: readonly MockRoleKey[], RoleKey: MockRoleKey): boolean {
    return Roles.includes(RoleKey);
  }

  IsRoleOptionDisabled(Roles: readonly MockRoleKey[], RoleKey: MockRoleKey): boolean {
    return RoleKey !== 'ADMIN' && Roles.includes('ADMIN');
  }

  ToggleUserRole(Draft: MockUserDraft | MockUserEditDraft, RoleKey: MockRoleKey, IsSelected: boolean): void {
    if (RoleKey === 'ADMIN') {
      Draft.Roles = IsSelected ? ['ADMIN'] : [];
      return;
    }
    if (Draft.Roles.includes('ADMIN')) return;
    Draft.Roles = IsSelected
      ? this.MockRbac.NormalizeRoles([...Draft.Roles, RoleKey])
      : Draft.Roles.filter((SelectedRole) => SelectedRole !== RoleKey);
  }

  ToggleCreateUserRole(RoleKey: MockRoleKey, IsSelected: boolean): void {
    this.ToggleUserRole(this.UserDraft, RoleKey, IsSelected);
    this.ClearCreateUserValidationError('Roles');
  }

  ClearCreateUserValidationError(Field: CreateUserField): void {
    delete this.CreateUserValidationErrors[Field];
  }

  CanEditEditingUserRoles(): boolean {
    return this.Auth.IsAdmin && !this.IsEditingSelf();
  }

  ToggleEditingUserRole(RoleKey: MockRoleKey, IsSelected: boolean): void {
    if (!this.EditingUser || !this.CanEditEditingUserRoles()) return;
    this.ToggleUserRole(this.EditingUser, RoleKey, IsSelected);
  }

  IsAdminUser(Account: string | null): boolean {
    return Account !== null && this.MockRbac.GetUser(Account)?.Roles.includes('ADMIN') === true;
  }

  OpenDeleteUserDialog(Account: string): void {
    this.DeletingUser = this.MockRbac.GetUser(Account);
  }

  CloseDeleteUserDialog(): void {
    this.DeletingUser = null;
  }

  ConfirmDeleteUser(): void {
    if (!this.DeletingUser) return;
    const Account = this.DeletingUser.Account;
    const Result = this.MockRbac.DeleteUser(Account);
    const Messages: Record<string, string> = {
      deleted: 'Mock 使用者已刪除。',
      'minimum-admins': '系統至少必須保留 1 位系統管理員，無法刪除最後一位管理員。',
      'not-found': '找不到要刪除的使用者。',
    };
    this.ManagementNotice = Messages[Result];
    if (Result === 'deleted') this.EnsureUserPagination();
    this.CloseDeleteUserDialog();
    if (Result === 'deleted' && Account === this.Auth.CurrentUser?.Account) {
      this.Auth.Logout();
      void this.router.navigate(['/login']);
    }
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
    if (!this.EditingAccount || !this.EditingUser || !this.Auth.CurrentUser)
      return;
    const OriginalAccount = this.EditingAccount;
    const Result = this.MockRbac.SaveUserEdit(
      OriginalAccount,
      this.EditingUser,
      this.Auth.CurrentUser.Account,
    );
    const Messages: Record<string, string> = {
      updated: 'Mock 使用者資料已更新。',
      'role-change-requested':
        '系統管理員角色變更申請已建立，等待異動對象同意或拒絕。',
      'self-role-change-not-allowed': '系統管理員不可修改自己的角色。',
      'minimum-admins': '系統至少必須保留 1 位系統管理員，無法建立此角色變更。',
      'pending-request-exists': '此使用者已有待處理的角色變更申請。',
      'duplicate-account': '帳號已存在，請使用其他帳號。',
      'self-disable-not-allowed': '目前登入的使用者不可將自己停用。',
      invalid: '請至少選擇一個角色。',
      'not-found': '找不到要編輯的使用者。',
    };
    this.ManagementNotice = Messages[Result];
    if (Result === 'updated' || Result === 'role-change-requested') {
      if (Result === 'updated') this.EnsureUserPagination();
      if (Result === 'updated') this.ShowSuccessToast('使用者資料已更新。');
      this.Auth.RefreshCurrentUser(
        OriginalAccount,
        OriginalAccount,
      );
      this.CancelEditUser();
    }
  }

  CancelEditUser(): void {
    this.EditingAccount = null;
    this.EditingUser = null;
  }

  @HostListener('document:keydown.escape')
  CloseEditUserOnEscape(): void {
    if (this.IsExportMenuOpen) this.IsExportMenuOpen = false;
    else if (this.IsUploadReportDialogOpen) this.CloseReportEditor();
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
    if (!this.IsExportMenuOpen) return;
    const Target = Event.target;
    if (Target instanceof Element && Target.closest('.export-dropdown')) return;
    this.IsExportMenuOpen = false;
  }

  SetUserEnabled(Account: string, Enabled: boolean): void {
    if (!Enabled && Account === this.Auth.CurrentUser?.Account) {
      this.ManagementNotice = '目前登入的使用者不可將自己停用。';
      return;
    }
    this.MockRbac.SetUserEnabled(Account, Enabled);
  }

  SetReportEnabled(ReportKey: MockReportKey, Enabled: boolean): void {
    this.MockRbac.SetReportEnabled(ReportKey, Enabled);
    this.ShowSuccessToast(Enabled ? '報表已在 Mock 資料中啟用。' : '報表已在 Mock 資料中停用。');
  }

  get ReportManagementCategories(): readonly string[] {
    return this.MockRbac.ReportCategories;
  }

  get DisplayedManagedReports(): readonly MockReport[] {
    const SearchText = this.ReportManagementSearchText.trim().toLocaleLowerCase();
    return this.MockRbac.Reports.filter(
      (Report) =>
        (this.ReportManagementCategory === '全部' ||
          Report.Category === this.ReportManagementCategory) &&
        (!SearchText ||
          `${Report.ReportName} ${Report.Description}`
            .toLocaleLowerCase()
            .includes(SearchText)),
    );
  }

  get ReportManagementTotalPages(): number {
    return this.GetTotalPages(this.DisplayedManagedReports.length);
  }

  get ReportManagementPageNumbers(): readonly number[] {
    return this.GetPageNumbers(this.ReportManagementTotalPages);
  }

  get PagedManagedReports(): readonly MockReport[] {
    return this.GetPagedItems(
      this.DisplayedManagedReports,
      this.ReportManagementCurrentPage,
    );
  }

  OnReportManagementSearchChange(): void {
    this.ResetReportManagementPagination();
  }

  SetReportManagementCategory(Category: string): void {
    this.ReportManagementCategory = Category;
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

  OpenUploadReportDialog(): void {
    this.EditingReportKey = null;
    this.ReportEditorDraft = this.CreateReportEditorDraft();
    this.SelectedReportFileName = '';
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
    this.IsUploadReportDialogOpen = true;
  }

  OpenEditReportDialog(ReportKey: MockReportKey): void {
    const Report = this.MockRbac.GetReport(ReportKey);
    if (!Report) return;
    this.EditingReportKey = Report.ReportKey;
    this.ReportEditorDraft = {
      ReportName: Report.ReportName,
      Category: Report.Category,
      Enabled: Report.Enabled,
    };
    this.SelectedReportFileName = Report.FileName;
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
    this.IsUploadReportDialogOpen = true;
  }

  CloseReportEditor(): void {
    this.IsUploadReportDialogOpen = false;
    this.EditingReportKey = null;
    this.ReportEditorDraft = this.CreateReportEditorDraft();
    this.SelectedReportFileName = '';
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
  }

  OnReportFileSelected(Event: Event): void {
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
    const Error = this.GetReportEditorValidationError();
    if (Error) {
      this.ReportEditorError = Error;
      return;
    }
    const IsEditing = this.EditingReportKey !== null;
    const IsSaved = IsEditing
      ? this.MockRbac.UpdateReport(this.EditingReportKey!, {
          ...this.ReportEditorDraft,
          FileName: this.SelectedReportFileName,
        })
      : Boolean(
          this.MockRbac.CreateReport({
            ...this.ReportEditorDraft,
            FileName: this.SelectedReportFileName,
          }),
        );
    if (!IsSaved) {
      this.ReportEditorError = '儲存報表失敗，請重新確認欄位。';
      return;
    }
    this.EnsureReportManagementPagination();
    this.CloseReportEditor();
    this.ShowSuccessToast(IsEditing ? 'Mock 報表已更新。' : 'Mock 報表已上傳。');
  }

  OpenDeleteReportDialog(ReportKey: MockReportKey): void {
    this.DeletingReport = this.MockRbac.GetReport(ReportKey);
  }

  CloseDeleteReportDialog(): void {
    this.DeletingReport = null;
  }

  ConfirmDeleteReport(): void {
    if (!this.DeletingReport) return;
    const ReportName = this.DeletingReport.ReportName;
    if (this.MockRbac.DeleteReport(this.DeletingReport.ReportKey)) {
      this.EnsureReportManagementPagination();
      this.ShowSuccessToast(`Mock 報表「${ReportName}」已刪除。`);
    }
    this.CloseDeleteReportDialog();
  }

  OpenCreateDatabaseConnection(): void {
    this.EditingDatabaseConnectionKey = null;
    this.DatabaseConnectionDraft = this.CreateDatabaseConnectionDraft();
    this.DatabaseConnectionNotice = '';
    this.IsDatabaseConnectionEditorOpen = true;
  }

  OpenEditDatabaseConnection(Key: string): void {
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
    this.DatabaseConnectionNotice = '';
    this.IsDatabaseConnectionEditorOpen = true;
  }

  CloseDatabaseConnectionEditor(): void {
    this.IsDatabaseConnectionEditorOpen = false;
    this.EditingDatabaseConnectionKey = null;
    this.DatabaseConnectionDraft = this.CreateDatabaseConnectionDraft();
  }

  SaveDatabaseConnection(): void {
    const IsEditing = this.EditingDatabaseConnectionKey !== null;
    const IsSaved = IsEditing
      ? this.DatabaseConnections.Update(
          this.EditingDatabaseConnectionKey!,
          this.DatabaseConnectionDraft,
        )
      : this.DatabaseConnections.Create(this.DatabaseConnectionDraft);
    if (!IsSaved) {
      this.DatabaseConnectionNotice = IsEditing
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

  RespondToRoleChangeRequest(RequestId: number, Approve: boolean): void {
    const CurrentAccount = this.Auth.CurrentUser?.Account;
    if (!CurrentAccount) return;
    const Result = this.MockRbac.RespondToRoleChangeRequest(
      RequestId,
      CurrentAccount,
      Approve,
    );
    const Messages: Record<string, string> = {
      approved:
        '角色變更申請已在 Mock 資料中核准。正式環境仍須由後端再次驗證。',
      rejected: '角色變更申請已拒絕，原角色維持不變。',
      'not-target': '只有角色異動對象可以回應此申請。',
      'minimum-admins': '系統至少必須保留 1 位系統管理員，無法核准此角色變更。',
      'not-pending': '此申請已處理。',
      'not-found': '找不到此角色變更申請。',
    };
    this.ManagementNotice = Messages[Result];
    if (Result === 'approved') {
      this.Auth.RefreshCurrentUser(CurrentAccount, CurrentAccount);
      if (!this.Auth.IsAdmin && this.IsAdministrationPage) {
        void this.router.navigate(['/reports']);
      }
    }
  }

  OpenCreateRoleDialog(): void {
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
    const Role = this.MockRbac.GetRole(RoleKey);
    this.EditingRoleKey = Role.Key;
    this.RoleDraft = {
      DisplayName: Role.DisplayName,
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

  IsBuiltInRole(RoleKey: MockRoleKey | null): boolean {
    return RoleKey === 'ADMIN';
  }

  OpenDeleteRoleDialog(): void {
    if (!this.EditingRoleKey || this.IsBuiltInRole(this.EditingRoleKey)) return;
    const Role = this.MockRbac.GetRole(this.EditingRoleKey);
    if (this.MockRbac.GetRoleUserCount(Role.Key) > 0) {
      this.RoleDraftError = '此角色仍有使用者使用，請先移除使用者的角色後再刪除。';
      return;
    }
    this.DeletingRole = Role;
  }

  CloseDeleteRoleDialog(): void {
    this.DeletingRole = null;
  }

  ConfirmDeleteRole(): void {
    const Role = this.DeletingRole;
    if (!Role) return;
    const Result = this.MockRbac.DeleteRole(Role.Key);
    const Messages: Record<Exclude<typeof Result, 'deleted'>, string> = {
      'built-in-role': '系統內建角色不可刪除。',
      'role-in-use': '此角色仍有使用者使用，請先移除使用者的角色後再刪除。',
      'not-found': '找不到要刪除的角色。',
    };
    if (Result !== 'deleted') {
      this.RoleDraftError = Messages[Result];
      this.CloseDeleteRoleDialog();
      return;
    }
    if (this.UserRoleFilter === Role.Key) this.UserRoleFilter = null;
    this.CloseDeleteRoleDialog();
    this.CloseEditRoleDialog();
    this.ScheduleRoleCardNavigationUpdate();
    this.ShowSuccessToast(`角色「${Role.DisplayName}」已刪除。`);
  }

  ClearRoleDraftError(): void {
    this.RoleDraftError = '';
  }

  SaveRole(): void {
    const Role = this.MockRbac.CreateRole(this.RoleDraft);
    if (!Role) {
      this.RoleDraftError = '角色名稱已存在，請輸入未重複的角色名稱。';
      return;
    }
    this.CloseCreateRoleDialog();
    this.ScheduleRoleCardNavigationUpdate();
    this.ShowSuccessToast(`新增角色「${Role.DisplayName}」，成功！`);
  }

  SaveEditedRole(): void {
    if (!this.EditingRoleKey) return;
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
    this.CloseEditRoleDialog();
    this.ShowSuccessToast(`角色「${DisplayName}」已更新。`);
  }

  IsEditingSelf(): boolean {
    return this.EditingAccount === this.Auth.CurrentUser?.Account;
  }
  CanRespondToRoleChangeRequest(
    TargetAccount: string,
    Status: MockRoleChangeRequestStatus,
  ): boolean {
    return (
      Status === 'Pending' && TargetAccount === this.Auth.CurrentUser?.Account
    );
  }

  SetPermissionCanExecute(Entry: MockCategoryPermissionEntry, CanExecute: boolean): void {
    if (this.IsBuiltInRole(this.EditingRoleKey)) return;
    Entry.Permission.CanExecute = CanExecute;
    if (!CanExecute) {
      Entry.Permission.CanExportPdf = false;
      Entry.Permission.CanPrint = false;
    }
  }

  SaveAccountSettings(): void {
    const CurrentUser = this.Auth.CurrentUser;
    if (!CurrentUser) return;
    if (this.AccountSettingsDraft.NewPassword !== this.AccountSettingsConfirmation) {
      this.AccountSettingsNotice = '新密碼與確認密碼不一致。';
      return;
    }
    const Result = this.MockRbac.UpdateOwnAccount(
      CurrentUser.Account,
      this.AccountSettingsDraft,
    );
    const Messages: Record<string, string> = {
      updated: '帳號設定已在前端 Mock 中更新。正式密碼驗證仍需後端支援。',
      invalid: '請輸入使用者名稱。',
      'not-found': '找不到目前登入的使用者。',
    };
    this.AccountSettingsNotice = Messages[Result];
    if (Result === 'updated') {
      this.Auth.RefreshCurrentUser(CurrentUser.Account, CurrentUser.Account);
      this.AccountSettingsDraft = this.CreateAccountSettingsDraft();
      this.LoadAccountSettings();
      this.AccountSettingsConfirmation = '';
    }
  }

  get IsAdministrationPage(): boolean {
    return (
      this.Page !== 'ReportList' &&
      this.Page !== 'ReportParameter' &&
      this.Page !== 'ReportPreview' &&
      this.Page !== 'AccountSettings'
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
    Object.keys(this.ParameterRangeErrors).forEach((Key) =>
      delete this.ParameterRangeErrors[Key],
    );
    this.LastMockExecutionParameters = null;
  }

  private CreateReportEditorDraft(): ReportEditorDraft {
    return {
      ReportName: '',
      Category: '',
      Enabled: false,
    };
  }

  private GetReportEditorValidationError(): string {
    if (this.IsReportFileInvalid) {
      return '僅允許上傳 .rpt 報表檔案。';
    }
    if (!this.ReportEditorDraft.ReportName.trim()) {
      return '請輸入報表名稱。';
    }
    if (!this.ReportEditorDraft.Category) {
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
    if (Definition.DataType === 'Integer') Validators.push(this.IntegerValidator);
    if (Definition.DataType === 'Float') Validators.push(this.NumberValidator);
    if (Definition.DataType === 'Date') Validators.push(this.DateValidator);
    if (Definition.DataType === 'DateTime') Validators.push(this.DateTimeValidator);
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
    return Boolean(EndDate && StartDate && EndDate.getTime() < StartDate.getTime());
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
      InitialPassword: '',
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
    if (!this.UserDraft.InitialPassword) Errors.InitialPassword = '請設定初始密碼。';
    if (!this.UserDraft.Roles.length) Errors.Roles = '請至少選擇一個角色。';
    return Errors;
  }
  private CreateAccountSettingsDraft(): MockAccountSettingsDraft {
    return {
      DisplayName: '',
      NewPassword: '',
    };
  }
  private LoadAccountSettings(): void {
    this.AccountSettingsDraft = {
      DisplayName: this.Auth.CurrentUser?.DisplayName ?? '',
      NewPassword: '',
    };
    this.AccountSettingsConfirmation = '';
  }
  private CreateRoleDraft(): MockRoleDraft {
    return {
      DisplayName: '',
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
      Category: this.SelectedParameterReportCategory,
      SearchText: this.ParameterReportSearchText,
      SortField: this.ParameterReportSortField,
      SortDirection: this.ParameterReportSortDirection,
      StartDate: this.ParameterReportStartDate,
      EndDate: this.ParameterReportEndDate,
    };
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
    return Math.min(
      Math.max(1, RequestedPage),
      this.GetTotalPages(ItemCount),
    );
  }

  private RestoreParameterSearchState(State: unknown): void {
    const SearchState = this.ToParameterSearchState(State);
    if (!SearchState) return;
    this.SelectedParameterReportCategory = SearchState.Category;
    this.ParameterReportSearchText = SearchState.SearchText;
    this.ParameterReportSortField = SearchState.SortField;
    this.ParameterReportSortDirection = SearchState.SortDirection;
    this.ParameterReportStartDate = SearchState.StartDate;
    this.ParameterReportEndDate = SearchState.EndDate;
  }

  private ToParameterSearchState(State: unknown): ParameterReportSearchState | null {
    if (!State || typeof State !== 'object') return null;
    const Value = State as Partial<ParameterReportSearchState>;
    if (
      typeof Value.Category !== 'string' ||
      typeof Value.SearchText !== 'string' ||
      (Value.SortField !== null &&
        Value.SortField !== 'ReportName' &&
        Value.SortField !== 'Category') ||
      (Value.SortDirection !== 'asc' && Value.SortDirection !== 'desc') ||
      typeof Value.StartDate !== 'string' ||
      typeof Value.EndDate !== 'string'
    ) {
      return null;
    }
    return {
      Category: Value.Category,
      SearchText: Value.SearchText,
      SortField: Value.SortField,
      SortDirection: Value.SortDirection,
      StartDate: Value.StartDate,
      EndDate: Value.EndDate,
    };
  }

  private ScheduleRoleCardNavigationUpdate(): void {
    window.setTimeout(() => this.UpdateRoleCardNavigation());
  }
}
