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
  MockRoleKey,
} from '../mock/mock-permissions';
import { MockReportKey } from '../mock/mock-reports';
import { AuthService } from '../services/auth.service';
import {
  MockRbacService,
  MockRoleChangeRequestStatus,
  MockRoleDraft,
  MockUserDraft,
  MockUserEditDraft,
} from '../services/mock-rbac.service';
import { NotificationService } from '../services/notification.service';
import {
  MockDatabaseConnectionDraft,
  MockDatabaseConnectionService,
} from '../services/mock-database-connection.service';

type DemoPortalPage =
  | 'ReportList'
  | 'ReportParameter'
  | 'ReportPreview'
  | 'UserManagement'
  | 'ReportPermission'
  | 'RptManagement'
  | 'ReportParameterSetting'
  | 'DatabaseConnection'
  | 'OperationLog';

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
  ManagementNotice = '';
  SelectedRoleKey: MockRoleKey = 'FINANCE';
  EditablePermissions: MockReportPermissionEntry[] = [];
  EditingAccount: string | null = null;
  UserDraft: MockUserDraft = this.CreateUserDraft();
  EditingUser: MockUserEditDraft | null = null;
  UserSearchText = '';
  IsCreateUserDialogOpen = false;
  UserRoleFilter: MockRoleKey | null = null;
  RoleCardHasOverflow = false;
  IsRoleCardAtStart = true;
  IsRoleCardAtEnd = true;
  IsCreateRoleDialogOpen = false;
  IsEditRoleDialogOpen = false;
  EditingRoleKey: MockRoleKey | null = null;
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
        '檢視 CanView、CanExecute、CanExportPdf、CanPrint 的 Mock 權限矩陣。',
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
        (!this.UserRoleFilter || User.Role === this.UserRoleFilter) &&
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
    if (this.IsReportDateRangeValid) {
      this.ReportDateRangeError = '';
      return;
    }
    this.ReportEndDate = '';
    this.ReportDateRangeError = '結束日期不得早於開始日期。';
  }

  SetReportEndDate(DateValue: string): void {
    this.ReportEndDate = DateValue;
    if (this.IsReportDateRangeValid) {
      this.ReportDateRangeError = '';
      return;
    }
    this.ReportEndDate = '';
    this.ReportDateRangeError = '結束日期不得早於開始日期。';
  }

  ExecuteReport(): void {
    if (!this.IsReportDateRangeValid) {
      this.ReportDateRangeError = '結束日期不得早於開始日期。';
      return;
    }
    void this.router.navigate(['/reports/preview']);
  }

  SelectOutputAction(ActionName: string): void {
    this.MockNotice = `${ActionName} 為前端 Mock 操作，未連接 PDF 或印表機服務。`;
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
      Account: User.Account,
      DisplayName: User.DisplayName,
      Role: User.Role,
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

  ScrollRoleCards(Direction: -1 | 1): void {
    const Viewport = this.roleCardViewport?.nativeElement;
    if (!Viewport) return;
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
      this.IsRoleCardAtStart = true;
      this.IsRoleCardAtEnd = true;
      return;
    }
    const MaximumScrollLeft = Math.max(
      0,
      Viewport.scrollWidth - Viewport.clientWidth,
    );
    this.RoleCardHasOverflow = MaximumScrollLeft > 1;
    this.IsRoleCardAtStart = Viewport.scrollLeft <= 1;
    this.IsRoleCardAtEnd = Viewport.scrollLeft >= MaximumScrollLeft - 1;
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
      'minimum-admins': '系統至少必須保留 3 位系統管理員，無法建立此角色變更。',
      'pending-request-exists': '此使用者已有待處理的角色變更申請。',
      'duplicate-account': '帳號已存在，請使用其他帳號。',
      'self-disable-not-allowed': '目前登入的使用者不可將自己停用。',
      invalid: '請確認帳號與名稱。',
      'not-found': '找不到要編輯的使用者。',
    };
    this.ManagementNotice = Messages[Result];
    if (Result === 'updated' || Result === 'role-change-requested') {
      this.Auth.RefreshCurrentUser(
        OriginalAccount,
        this.EditingUser.Account.trim(),
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
    if (this.EditingUser) this.CancelEditUser();
    else if (this.IsCreateUserDialogOpen) this.CloseCreateUserDialog();
    else if (this.IsCreateRoleDialogOpen) this.CloseCreateRoleDialog();
    else if (this.IsEditRoleDialogOpen) this.CloseEditRoleDialog();
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
      'minimum-admins': '系統至少必須保留 3 位系統管理員，無法核准此角色變更。',
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
      Description: Role.Description,
      Permissions: this.MockRbac.GetReportPermissionEntries(Role.Key),
    };
    this.RoleDraftError = '';
    this.IsEditRoleDialogOpen = true;
  }

  CloseEditRoleDialog(): void {
    this.IsEditRoleDialogOpen = false;
    this.EditingRoleKey = null;
    this.RoleDraft = this.CreateRoleDraft();
    this.RoleDraftError = '';
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
    const DisplayName = this.RoleDraft.DisplayName.trim();
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

  get IsAdministrationPage(): boolean {
    return (
      this.Page !== 'ReportList' &&
      this.Page !== 'ReportParameter' &&
      this.Page !== 'ReportPreview'
    );
  }

  private get IsReportDateRangeValid(): boolean {
    return !this.ReportStartDate || !this.ReportEndDate || this.ReportEndDate >= this.ReportStartDate;
  }

  private CreateUserDraft(): MockUserDraft {
    return {
      Account: '',
      DisplayName: '',
      InitialPassword: '',
      Role: 'FINANCE',
      Enabled: false,
    };
  }
  private CreateRoleDraft(): MockRoleDraft {
    return {
      DisplayName: '',
      Description: '',
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
