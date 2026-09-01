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
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';

import {
  MockReportPermissionEntry,
  MockRole,
  MockRoleKey,
} from '../mock/mock-permissions';
import { MockReportKey } from '../mock/mock-reports';
import { AuthService } from '../services/auth.service';
import {
  MockAccountSettingsDraft,
  MockRbacService,
  MockRoleChangeRequestStatus,
  MockRoleDraft,
  MockUserDraft,
  MockUserEditDraft,
} from '../services/mock-rbac.service';
import { MockUser } from '../mock/mock-users';
import { NotificationService } from '../services/notification.service';
import {
  MockDatabaseConnectionDraft,
  MockDatabaseConnectionService,
} from '../services/mock-database-connection.service';

type DemoPortalPage =
  | 'ReportList'
  | 'ReportParameter'
  | 'ReportPreview'
  | 'AccountSettings'
  | 'UserManagement'
  | 'ReportPermission'
  | 'RptManagement'
  | 'ReportParameterSetting'
  | 'DatabaseConnection'
  | 'OperationLog';

interface MockExportOption {
  readonly Label: string;
  readonly FormatKey: string;
  readonly Enabled: boolean;
  readonly MockOnly: boolean;
  readonly RequiresBackendConfirmation: boolean;
}

@Component({
  selector: 'app-demo-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './demo-portal.component.html',
  styleUrl: './demo-portal.component.scss',
})
export class DemoPortalComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly Auth = inject(AuthService);
  readonly MockRbac = inject(MockRbacService);
  readonly DatabaseConnections = inject(MockDatabaseConnectionService);
  readonly Notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly Page = this.route.snapshot.data['Page'] as DemoPortalPage;
  SearchText = '';
  SelectedCategory = '全部';
  readonly StatusOptions = ['未收款', '已收款'];
  SelectedStatuses: string[] = [];
  ReportStartDate = '';
  ReportEndDate = '';
  ReportDateRangeError = '';
  MockNotice = '';
  IsExportMenuOpen = false;
  readonly ExportOptions: readonly MockExportOption[] = [
    { Label: 'PDF', FormatKey: 'Pdf', Enabled: true, MockOnly: true, RequiresBackendConfirmation: false },
    { Label: 'Excel', FormatKey: 'Excel', Enabled: true, MockOnly: true, RequiresBackendConfirmation: true },
    { Label: 'Word', FormatKey: 'Word', Enabled: true, MockOnly: true, RequiresBackendConfirmation: true },
    { Label: 'CSV', FormatKey: 'Csv', Enabled: true, MockOnly: true, RequiresBackendConfirmation: true },
    { Label: 'RTF', FormatKey: 'Rtf', Enabled: true, MockOnly: true, RequiresBackendConfirmation: true },
    { Label: '文字檔', FormatKey: 'Text', Enabled: true, MockOnly: true, RequiresBackendConfirmation: true },
  ];
  ManagementNotice = '';
  SelectedRoleKey: MockRoleKey = 'FINANCE';
  EditablePermissions: MockReportPermissionEntry[] = [];
  EditingAccount: string | null = null;
  UserDraft: MockUserDraft = this.CreateUserDraft();
  EditingUser: MockUserEditDraft | null = null;
  DeletingUser: MockUser | null = null;
  AccountSettingsDraft: MockAccountSettingsDraft = this.CreateAccountSettingsDraft();
  AccountSettingsConfirmation = '';
  AccountSettingsNotice = '';
  UserSearchText = '';
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
  @ViewChild('roleCardViewport')
  private roleCardViewport?: ElementRef<HTMLElement>;
  private roleCardResizeObserver?: ResizeObserver;

  ngOnInit(): void {
    this.LoadPermissionEditor();
    this.LoadAccountSettings();
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
      ReportList: '我的報表',
      ReportParameter: '報表條件',
      ReportPreview: '報表預覽',
      AccountSettings: '帳號設定',
      UserManagement: '使用者管理',
      ReportPermission: '報表權限管理',
      RptManagement: 'RPT 報表管理',
      ReportParameterSetting: '報表參數設定',
      DatabaseConnection: 'MSSQL 資料庫連線管理',
      OperationLog: '操作紀錄查詢',
    };
    return PageTitles[this.Page];
  }

  get FilteredReports() {
    const NormalizedSearchText = this.SearchText.trim().toLowerCase();
    return this.Auth.AccessibleReports.filter(
      (MockReport) =>
        MockReport.Enabled &&
        (this.SelectedCategory === '全部' ||
          MockReport.Category === this.SelectedCategory) &&
        (!NormalizedSearchText ||
          `${MockReport.ReportName} ${MockReport.Description}`
            .toLowerCase()
            .includes(NormalizedSearchText)),
    );
  }

  get Categories(): readonly string[] {
    return ['全部', ...new Set(this.Auth.AccessibleReports.map((MockReport) => MockReport.Category))];
  }

  get AdminDescription(): string {
    const Descriptions: Partial<Record<DemoPortalPage, string>> = {
      UserManagement: '檢視使用者帳號、角色與啟用狀態的 Mock 清單。',
      ReportPermission:
        '檢視執行、PDF、列印的 Mock 權限矩陣。',
      RptManagement: '檢視 RPT 報表名稱、分類與啟用狀態的 Mock 資料。',
      ReportParameterSetting: '檢視 RPT 參數顯示設定的 Mock 資料。',
      DatabaseConnection: '檢視資料庫連線設定畫面；不會顯示或連線真實帳密。',
      OperationLog: '檢視操作紀錄畫面與 180 天 保存標示的 Mock 資料。',
    };
    return Descriptions[this.Page] ?? '';
  }

  SelectReport(): void {
    const Report = this.FilteredReports[0];
    if (!Report) return;
    this.Auth.SelectReport(Report.ReportKey);
    void this.router.navigate(['/reports/parameters']);
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

  get StatusSelectionLabel(): string {
    return this.SelectedStatuses.length
      ? this.SelectedStatuses.join('、')
      : '請選擇狀態';
  }

  IsStatusSelected(Status: string): boolean {
    return this.SelectedStatuses.includes(Status);
  }

  SetStatusSelection(Status: string, IsSelected: boolean): void {
    this.SelectedStatuses = IsSelected
      ? [...this.SelectedStatuses, Status]
      : this.SelectedStatuses.filter(
          (SelectedStatus) => SelectedStatus !== Status,
        );
  }

  SelectReportByKey(ReportKey: MockReportKey): void {
    const Report = this.Auth.AccessibleReports.find((Entry) => Entry.ReportKey === ReportKey);
    if (!Report?.Enabled) return;
    this.Auth.SelectReport(ReportKey);
    void this.router.navigate(['/reports/parameters']);
  }

  SetReportStartDate(DateValue: string): void {
    this.ReportStartDate = DateValue;
    this.CorrectReportDateRange();
  }

  SetReportEndDate(DateValue: string): void {
    this.ReportEndDate = DateValue;
    this.CorrectReportDateRange();
  }

  ExecuteReport(): void {
    if (!this.IsReportDateRangeValid) {
      this.CorrectReportDateRange();
      return;
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
    const IsSaved = this.MockRbac.CreateUser(this.UserDraft);
    this.ManagementNotice = IsSaved
      ? ''
      : '請確認帳號、名稱與初始密碼，且帳號不可重複。';
    if (IsSaved) {
      this.CloseCreateUserDialog();
      this.ShowSuccessToast('新增使用者成功！');
    }
  }

  OpenCreateUserDialog(): void {
    this.UserDraft = this.CreateUserDraft();
    this.IsCreateUserDialogOpen = true;
  }

  CloseCreateUserDialog(): void {
    this.IsCreateUserDialogOpen = false;
    this.UserDraft = this.CreateUserDraft();
  }

  SetUserRoleFilter(RoleKey: MockRoleKey | null): void {
    this.UserRoleFilter = RoleKey;
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
    else if (this.EditingUser) this.CancelEditUser();
    else if (this.DeletingUser) this.CloseDeleteUserDialog();
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
      Permissions: this.MockRbac.GetReportPermissionEntries(Role.Key),
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
    if (this.SelectedRoleKey === Role.Key) {
      this.SelectedRoleKey = this.MockRbac.Roles[0]?.Key ?? 'ADMIN';
      this.LoadPermissionEditor();
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
    this.SelectedRoleKey = Role.Key;
    this.LoadPermissionEditor();
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
    this.SelectedRoleKey = this.EditingRoleKey;
    this.LoadPermissionEditor();
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

  LoadPermissionEditor(): void {
    this.EditablePermissions = this.MockRbac.GetReportPermissionEntries(
      this.SelectedRoleKey,
    );
  }
  SavePermissions(): void {
    this.MockRbac.SaveReportPermissions(
      this.SelectedRoleKey,
      this.EditablePermissions,
    );
    this.ManagementNotice = 'Mock 報表權限已儲存，將立即套用於目前測試角色。';
  }

  SetPermissionCanExecute(Entry: MockReportPermissionEntry, CanExecute: boolean): void {
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

  private get IsReportDateRangeValid(): boolean {
    const StartDate = this.ParseDateOnly(this.ReportStartDate);
    const EndDate = this.ParseDateOnly(this.ReportEndDate);
    return !StartDate || !EndDate || EndDate.getTime() >= StartDate.getTime();
  }

  private CorrectReportDateRange(): void {
    if (this.IsReportDateRangeValid) {
      this.ReportDateRangeError = '';
      return;
    }

    this.ReportEndDate = this.ReportStartDate;
    this.ReportDateRangeError =
      '結束日期不得早於開始日期，已同步為開始日期，請重新選擇。';
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
      Roles: ['FINANCE'],
      Enabled: false,
    };
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
      Permissions: this.MockRbac.GetEmptyReportPermissionEntries(),
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

  private ScheduleRoleCardNavigationUpdate(): void {
    window.setTimeout(() => this.UpdateRoleCardNavigation());
  }
}
