import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { MockRbacService, MockUserDraft } from '../services/mock-rbac.service';
import { NotificationService } from '../services/notification.service';
import { DemoPortalComponent } from './demo-portal.component';

describe('DemoPortalComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DemoPortalComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { Page: 'UserManagement' } } },
        },
      ],
    }).compileComponents();
  });

  it('logs out and queues a success notification for the login page', () => {
    const Auth = TestBed.inject(AuthService);
    const Notifications = TestBed.inject(NotificationService);
    const RouterService = TestBed.inject(Router);
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.componentInstance.Logout();

    expect(Auth.IsAuthenticated).toBeFalse();
    expect(Notifications.SuccessMessage).toBe('登出成功！');
    expect(Navigate).toHaveBeenCalledWith(['/login']);
  });

  it('shows the signed-in account and role without a Demo role switcher in the header', () => {
    const Auth = TestBed.inject(AuthService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    const Header = fixture.nativeElement.querySelector('.account-summary') as HTMLElement;
    expect(Header.textContent).toContain(Auth.CurrentUser?.DisplayName);
    expect(Header.textContent).toContain(Auth.ActiveRoleNames);
    expect(Header.querySelector('.role-switcher')).toBeNull();
    expect(Header.querySelector('select')).toBeNull();
    expect(Header.querySelector('button')?.textContent).toContain('登出');
  });

  it('keeps the UserManagement table frame and header for normal, one-user, and empty results', () => {
    const Auth = TestBed.inject(AuthService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const TableFrame = Host.querySelector('.user-table-content-area');
    expect(Host.querySelector('.demo-banner')).toBeNull();
    expect(TableFrame).not.toBeNull();
    expect(Host.querySelector('.user-management-table thead')).not.toBeNull();
    expect(
      Host.querySelectorAll('.user-management-table tbody tr').length,
    ).toBeGreaterThan(1);

    component.UserSearchText = component.FilteredUsers[0].Account;
    fixture.detectChanges();
    expect(
      Host.querySelectorAll('.user-management-table tbody tr').length,
    ).toBe(1);
    expect(Host.querySelector('.user-table-content-area')).toBe(TableFrame);

    component.UserSearchText = 'no-user-match';
    fixture.detectChanges();
    expect(Host.querySelector('.user-management-table thead')).not.toBeNull();
    expect(Host.querySelector('.user-empty-state')?.textContent).toContain(
      '找不到符合條件的使用者。',
    );
    expect(Host.querySelector('.user-table-content-area')).toBe(TableFrame);
  });

  it('renders the approved user management fields, icon actions, and a delete confirmation', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const Headers = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.user-management-table th'),
    ).map((Header) => Header.textContent?.trim());
    expect(Headers).toEqual(['帳號', '名稱', '角色', '啟用狀態', '建立時間', '更新時間', '操作']);
    expect(fixture.nativeElement.querySelector('[aria-label="編輯 user@example.com"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="刪除 user@example.com"]')).not.toBeNull();

    component.OpenDeleteUserDialog('warehouse@example.com');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('確定要刪除使用者「warehouse@example.com」嗎？');
    component.ConfirmDeleteUser();
    expect(MockRbac.GetUser('warehouse@example.com')).toBeNull();
  });

  it('keeps account and user name read-only in the administrator edit dialog', () => {
    const Auth = TestBed.inject(AuthService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    component.EditUser('warehouse@example.com');
    fixture.detectChanges();

    const Inputs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('.edit-user-modal input');
    expect(Inputs[0].disabled).toBeTrue();
    expect(Inputs[1].disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('.edit-user-modal input[type="password"]')).toBeNull();
    expect((component.EditingUser as unknown as { DisplayName?: string }).DisplayName).toBeUndefined();
  });

  it('updates the EditUser role draft from native checkbox clicks and saves only on confirmation', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    component.EditUser('user@example.com');
    fixture.detectChanges();

    const RoleCheckbox = (RoleName: string) => {
      const Option = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLLabelElement>('.edit-user-role-option'),
      ).find((Entry) => Entry.textContent?.includes(RoleName))!;
      return Option.querySelector<HTMLInputElement>('input')!;
    };

    expect(component.CanEditEditingUserRoles()).toBeTrue();
    expect(RoleCheckbox('採購人員').disabled).toBeFalse();
    RoleCheckbox('採購人員').click();
    fixture.detectChanges();
    expect(component.EditingUser?.Roles).toEqual(['FINANCE', 'PURCHASE']);

    RoleCheckbox('倉管人員').click();
    fixture.detectChanges();
    expect(component.EditingUser?.Roles).toEqual(['FINANCE', 'PURCHASE', 'WAREHOUSE']);

    RoleCheckbox('財務人員').click();
    fixture.detectChanges();
    expect(component.EditingUser?.Roles).toEqual(['PURCHASE', 'WAREHOUSE']);

    RoleCheckbox('系統管理者').click();
    fixture.detectChanges();
    expect(component.EditingUser?.Roles).toEqual(['ADMIN']);

    component.CancelEditUser();
    expect(MockRbac.GetUser('user@example.com')?.Roles).toEqual(['FINANCE']);

    component.EditUser('user@example.com');
    fixture.detectChanges();
    expect(component.EditingUser?.Roles).toEqual(['FINANCE']);

    RoleCheckbox('採購人員').click();
    fixture.detectChanges();
    expect(component.EditingUser?.Roles).toEqual(['FINANCE', 'PURCHASE']);

    component.SaveEditedUser();
    expect(MockRbac.GetUser('user@example.com')?.Roles).toEqual(['FINANCE', 'PURCHASE']);
    expect(component.SuccessToastMessage).toBe('使用者資料已更新。');

    component.EditUser('user@example.com');
    expect(component.EditingUser?.Roles).toEqual(['FINANCE', 'PURCHASE']);
  });

  it('lets the signed-in user update only their own name and Mock password in AccountSettings', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'AccountSettings';
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.AccountSettingsDraft.DisplayName = '財務本人設定';
    component.AccountSettingsDraft.NewPassword = 'self-service-password';
    component.AccountSettingsConfirmation = 'self-service-password';
    component.SaveAccountSettings();

    expect(Auth.CurrentUser?.DisplayName).toBe('財務本人設定');
    expect(Auth.CurrentUser?.Roles).toEqual(['FINANCE']);
    expect(Auth.CurrentUser?.Enabled).toBeTrue();
    expect(MockRbac.Authenticate('user@example.com', 'self-service-password')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Frontend Mock Only');
  });

  it('renders only enabled CanExecute reports without RPT file names', () => {
    const Auth = TestBed.inject(AuthService);
    const RouterService = TestBed.inject(Router);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    Route.snapshot.data.Page = 'ReportList';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.report-list-table tbody tr').length).toBe(5);
    expect(fixture.nativeElement.textContent).not.toContain('Documents v2 (With Serial And Batch Details - invoice show data from delivery as well)');
    expect(fixture.nativeElement.textContent).not.toContain('AccountBalance.rpt');
    expect(fixture.nativeElement.querySelector('.report-list-table th')?.parentElement?.textContent).not.toContain('檔案名稱');

    component.SelectReportByKey('AccountBalance');
    expect(Auth.SelectedReport?.ReportKey).toBe('AccountBalance');
    expect(Navigate).toHaveBeenCalledWith(['/reports/parameters']);

    component.SearchText = 'no-match';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.report-list-table td[colspan="4"]')?.textContent).toContain('目前條件下沒有符合的報表。');
  });

  it('shows enabled and disabled reports with safe file names to an administrator in RptManagement', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'RptManagement';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const Table = Host.querySelector('.report-management-table') as HTMLTableElement;
    expect(Table.querySelectorAll('tbody tr').length).toBe(6);
    expect(
      Array.from(Table.querySelectorAll('th')).map((Header) => Header.textContent?.trim()),
    ).toEqual(['報表名稱', '分類', 'RPT 檔名', '啟用狀態']);
    expect(Table.querySelectorAll('[role="switch"]').length).toBe(6);
    expect(Host.textContent).toContain('Documents v2 (With Serial And Batch Details - invoice show data from delivery as well).rpt');
    expect(Host.textContent).toContain('停用');
    expect(Host.textContent).not.toContain('RptFilePath');

    const FirstSwitch = Table.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(FirstSwitch.getAttribute('aria-checked')).toBe('false');
    FirstSwitch.click();
    fixture.detectChanges();
    expect(FirstSwitch.getAttribute('aria-checked')).toBe('true');
  });

  it('does not prefill a database password when an administrator edits a connection', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'DatabaseConnection';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.OpenEditDatabaseConnection(component.DatabaseConnections.Connections[0].Key);
    fixture.detectChanges();

    const PasswordInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#database-password');
    expect(PasswordInput?.value).toBe('');
    expect(PasswordInput?.placeholder).toBe('••••••••');
    expect(fixture.nativeElement.textContent).toContain('若不修改密碼請保持空白。');
  });

  it('uses localized permission labels throughout the ReportPermission UI', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportPermission';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    const Headers = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.permission-matrix th',
      ),
    ).map((Header) => Header.textContent?.trim());
    expect(Headers).toEqual(['報表', '執行', '匯出', '列印']);
    expect(fixture.nativeElement.textContent).not.toContain('CanExecute');
    expect(fixture.nativeElement.textContent).not.toContain('CanExportPdf');
    expect(fixture.nativeElement.textContent).not.toContain('CanPrint');
  });

  it('opens the export menu, closes it after selection, and shows the selected Mock format', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportPreview';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const Trigger = Host.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    expect(Trigger.textContent).toContain('匯出');
    expect(Trigger.getAttribute('aria-expanded')).toBe('false');

    Trigger.click();
    fixture.detectChanges();
    expect(Trigger.getAttribute('aria-expanded')).toBe('true');
    expect(
      Array.from(Host.querySelectorAll('[role="menuitem"]')).map((Item) => Item.textContent?.trim()),
    ).toEqual(['PDF', 'Excel', 'Word', 'CSV', 'RTF', '文字檔']);

    document.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect(Host.querySelector('[role="menu"]')).toBeNull();

    Trigger.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(Host.querySelector('[role="menu"]')).toBeNull();

    Trigger.click();
    fixture.detectChanges();

    (Host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1]).click();
    fixture.detectChanges();
    expect(Host.querySelector('[role="menu"]')).toBeNull();
    expect(Host.querySelector('.mock-notice')?.textContent).toContain(
      'Excel 匯出目前為前端 Mock 操作',
    );
  });

  it('automatically synchronizes an invalid report date range', () => {
    const Auth = TestBed.inject(AuthService);
    const RouterService = TestBed.inject(Router);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    Route.snapshot.data.Page = 'ReportParameter';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    component.SetReportStartDate('2026-08-30');
    fixture.detectChanges();

    const DateInputs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type="date"]');
    expect(DateInputs[1].min).toBe('2026-08-30');

    component.SetReportEndDate('2026-08-31');
    expect(component.ReportEndDate).toBe('2026-08-31');
    expect(component.ReportDateRangeError).toBe('');

    component.SetReportEndDate('2026-08-29');
    expect(component.ReportEndDate).toBe('2026-08-30');
    expect(component.ReportDateRangeError).toBe(
      '結束日期不得早於開始日期，已同步為開始日期，請重新選擇。',
    );

    component.SetReportEndDate('2026-08-30');
    expect(component.ReportDateRangeError).toBe('');

    component.SetReportStartDate('2026-09-01');
    expect(component.ReportEndDate).toBe('2026-09-01');
    expect(component.ReportDateRangeError).toBe(
      '結束日期不得早於開始日期，已同步為開始日期，請重新選擇。',
    );

    component.SetReportEndDate('2026-09-02');
    expect(component.ReportDateRangeError).toBe('');
    component.ExecuteReport();
    expect(Navigate).toHaveBeenCalledWith(['/reports/preview']);
  });

  it('redirects an administrator to reports after approving their own demotion', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const RouterService = TestBed.inject(Router);
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    const AdditionalAdmin: MockUserDraft = {
      Account: 'admin4@example.com',
      DisplayName: '系統管理員 D',
      InitialPassword: 'admin456',
      Roles: ['ADMIN'],
      Enabled: true,
    };
    const Demotion = {
      Account: 'admin2@example.com',
      DisplayName: '系統管理員 B',
      Roles: ['FINANCE'],
      Enabled: true,
    };

    expect(Auth.Login('admin2@example.com', 'admin234')).toBeTrue();
    expect(MockRbac.CreateUser(AdditionalAdmin)).toBeTrue();
    expect(
      MockRbac.SaveUserEdit(
        'admin2@example.com',
        Demotion,
        'admin@example.com',
      ),
    ).toBe('role-change-requested');

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.componentInstance.RespondToRoleChangeRequest(
      MockRbac.RoleChangeRequests[0].Id,
      true,
    );

    expect(Auth.IsAdmin).toBeFalse();
    expect(Navigate).toHaveBeenCalledWith(['/reports']);
  });

  it('disables and defends the current administrator account against self-disable', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();
    const CurrentUserSwitch = Array.from(
      (
        fixture.nativeElement as HTMLElement
      ).querySelectorAll<HTMLButtonElement>('.account-status-switch'),
    ).find(
      (Button) =>
        Button.getAttribute('aria-label') === '目前登入的使用者不可停用',
    );

    expect(CurrentUserSwitch?.disabled).toBeTrue();

    fixture.componentInstance.SetUserEnabled('admin@example.com', false);

    expect(MockRbac.GetUser('admin@example.com')?.Enabled).toBeTrue();
    expect(fixture.componentInstance.ManagementNotice).toBe(
      '目前登入的使用者不可將自己停用。',
    );

    fixture.componentInstance.EditUser('admin@example.com');
    fixture.detectChanges();
    const EditingUserSwitch = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>(
      '.edit-user-modal .account-status-switch',
    );
    expect(EditingUserSwitch?.disabled).toBeTrue();

    fixture.componentInstance.EditingUser!.Enabled = false;
    fixture.componentInstance.SaveEditedUser();

    expect(MockRbac.GetUser('admin@example.com')?.Enabled).toBeTrue();
    expect(fixture.componentInstance.ManagementNotice).toBe(
      '目前登入的使用者不可將自己停用。',
    );
  });

  it('creates a role from the UserManagement dialog state and makes it available in role cards', () => {
    const Auth = TestBed.inject(AuthService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;

    component.OpenCreateRoleDialog();
    component.RoleDraft.DisplayName = '業務人員';
    component.RoleDraft.Permissions[0].Permission.CanExecute = true;
    component.SaveRole();
    fixture.detectChanges();

    expect(component.IsCreateRoleDialogOpen).toBeFalse();
    expect(component.SuccessToastMessage).toBe('新增角色「業務人員」，成功！');
    expect(fixture.nativeElement.textContent).toContain('業務人員');
    expect(fixture.nativeElement.textContent).toContain('前端 Mock 建立的自訂角色。');
    expect(
      fixture.nativeElement.querySelectorAll('.role-filter-tabs button').length,
    ).toBe(component.MockRbac.Roles.length + 1);
  });

  it('edits an existing role from the UserManagement dialog state', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;

    component.OpenEditRoleDialog('FINANCE');
    component.RoleDraft.DisplayName = '財務分析人員';
    component.RoleDraft.Permissions[1].Permission.CanExecute = true;
    component.SaveEditedRole();
    fixture.detectChanges();

    expect(component.IsEditRoleDialogOpen).toBeFalse();
    expect(component.SuccessToastMessage).toBe('角色「財務分析人員」已更新。');
    expect(MockRbac.GetRole('FINANCE').DisplayName).toBe('財務分析人員');
  });

  it('locks SystemAdmin in the EditRole dialog and does not render a delete action', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    const AdminName = MockRbac.GetRole('ADMIN').DisplayName;

    component.OpenEditRoleDialog('ADMIN');
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const NameInput = Host.querySelector<HTMLInputElement>('.role-name-field input')!;
    expect(NameInput.readOnly).toBeTrue();
    expect(Host.querySelector('.role-description-field')).toBeNull();
    expect(Host.querySelector('[aria-label="刪除角色"]')).toBeNull();

    component.RoleDraft.DisplayName = '不應套用的名稱';
    component.SaveEditedRole();
    expect(MockRbac.GetRole('ADMIN').DisplayName).toBe(AdminName);
  });

  it('cancels custom role renames and deletes a zero-user role only after confirmation', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;

    component.OpenCreateRoleDialog();
    component.RoleDraft.DisplayName = 'admin123';
    component.SaveRole();
    const RoleKey = MockRbac.Roles.find((Role) => Role.DisplayName === 'admin123')!.Key;

    component.OpenEditRoleDialog(RoleKey);
    component.RoleDraft.DisplayName = '取消後不應套用';
    component.CloseEditRoleDialog();
    expect(MockRbac.GetRole(RoleKey).DisplayName).toBe('admin123');

    component.OpenEditRoleDialog(RoleKey);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.role-name-field input')!.readOnly,
    ).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-label="刪除角色"]')).not.toBeNull();

    component.OpenDeleteRoleDialog();
    expect(component.DeletingRole?.Key).toBe(RoleKey);
    component.ConfirmDeleteRole();
    expect(MockRbac.Roles.some((Role) => Role.Key === RoleKey)).toBeFalse();
    expect(component.SuccessToastMessage).toBe('角色「admin123」已刪除。');
  });

  it('blocks deletion of a role that is still assigned to users', () => {
    const Auth = TestBed.inject(AuthService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;

    component.OpenEditRoleDialog('FINANCE');
    component.OpenDeleteRoleDialog();

    expect(component.DeletingRole).toBeNull();
    expect(component.RoleDraftError).toContain('此角色仍有使用者使用');
  });

  it('derives role filter tabs and user counts from the current Mock data', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const RoleTabButtons = fixture.nativeElement.querySelectorAll(
      '.role-filter-tabs button',
    );
    expect(RoleTabButtons.length).toBe(MockRbac.Roles.length + 1);

    const Role = MockRbac.Roles[0];
    const RoleUsers = MockRbac.Users.filter((User) => User.Roles.includes(Role.Key));
    component.SetUserRoleFilter(Role.Key);
    expect(component.FilteredUsers).toEqual(RoleUsers);

    component.UserSearchText = RoleUsers[0].Account;
    expect(component.FilteredUsers).toEqual([RoleUsers[0]]);

    component.SetUserRoleFilter(null);
    expect(component.FilteredUsers).toEqual([RoleUsers[0]]);
  });

  it('supports ordinary multi-role assignment while keeping SystemAdmin exclusive', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;

    component.OpenCreateUserDialog();
    component.UserDraft.Account = 'role-flow@example.com';
    component.UserDraft.DisplayName = '角色流程測試';
    component.UserDraft.InitialPassword = 'roleflow123';
    component.UserDraft.Roles = [];
    component.ToggleUserRole(component.UserDraft, 'PURCHASE', true);
    component.SaveUser();
    expect(MockRbac.GetUser('role-flow@example.com')?.Roles).toEqual(['PURCHASE']);

    component.EditUser('role-flow@example.com');
    component.ToggleUserRole(component.EditingUser!, 'WAREHOUSE', true);
    component.SaveEditedUser();
    expect(MockRbac.GetUser('role-flow@example.com')?.Roles).toEqual(['PURCHASE', 'WAREHOUSE']);

    component.EditUser('role-flow@example.com');
    component.ToggleUserRole(component.EditingUser!, 'ADMIN', true);
    expect(component.EditingUser?.Roles).toEqual(['ADMIN']);
    expect(component.IsRoleOptionDisabled(component.EditingUser!.Roles, 'FINANCE')).toBeTrue();
    component.ToggleUserRole(component.EditingUser!, 'FINANCE', true);
    component.SaveEditedUser();
    expect(MockRbac.GetUser('role-flow@example.com')?.Roles).toEqual(['ADMIN']);
  });

  it('clears and disables output permissions when CanExecute is removed', () => {
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    const Entry = component.RoleDraft.Permissions[0];
    Entry.Permission.CanExportPdf = true;
    Entry.Permission.CanPrint = true;

    component.SetPermissionCanExecute(Entry, false);

    expect(Entry.Permission).toEqual({
      CanExecute: false,
      CanExportPdf: false,
      CanPrint: false,
    });
  });

  it('shows carousel navigation only when the role cards overflow their viewport', () => {
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    const Viewport = {
      clientWidth: 300,
      scrollWidth: 900,
      scrollLeft: 0,
    } as HTMLElement;
    const ComponentWithViewport = component as unknown as {
      roleCardViewport: { nativeElement: HTMLElement };
    };
    ComponentWithViewport.roleCardViewport = { nativeElement: Viewport };

    Object.defineProperty(Viewport, 'scrollWidth', {
      configurable: true,
      value: 300,
    });
    component.UpdateRoleCardNavigation();
    expect(component.RoleCardHasOverflow).toBeFalse();
    expect(component.CanScrollRoleCardsLeft).toBeFalse();
    expect(component.CanScrollRoleCardsRight).toBeFalse();
    expect(component.IsRoleCardAtStart).toBeTrue();
    expect(component.IsRoleCardAtEnd).toBeTrue();

    Object.defineProperty(Viewport, 'scrollWidth', {
      configurable: true,
      value: 900,
    });
    component.UpdateRoleCardNavigation();
    expect(component.RoleCardHasOverflow).toBeTrue();
    expect(component.CanScrollRoleCardsLeft).toBeFalse();
    expect(component.CanScrollRoleCardsRight).toBeTrue();
    expect(component.IsRoleCardAtStart).toBeTrue();
    expect(component.IsRoleCardAtEnd).toBeFalse();

    Object.defineProperty(Viewport, 'scrollLeft', {
      configurable: true,
      value: 300,
      writable: true,
    });
    component.UpdateRoleCardNavigation();
    expect(component.CanScrollRoleCardsLeft).toBeTrue();
    expect(component.CanScrollRoleCardsRight).toBeTrue();

    Viewport.scrollLeft = 600;
    component.UpdateRoleCardNavigation();
    expect(component.CanScrollRoleCardsLeft).toBeTrue();
    expect(component.CanScrollRoleCardsRight).toBeFalse();
    expect(component.IsRoleCardAtEnd).toBeTrue();

    Object.defineProperty(Viewport, 'scrollWidth', {
      configurable: true,
      value: 300,
    });
    component.UpdateRoleCardNavigation();
    expect(Viewport.scrollLeft).toBe(0);
    expect(component.RoleCardHasOverflow).toBeFalse();
    expect(component.CanScrollRoleCardsLeft).toBeFalse();
    expect(component.CanScrollRoleCardsRight).toBeFalse();
  });

  it('keeps the create actions in their section headers rather than in role cards or search', () => {
    const Auth = TestBed.inject(AuthService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const RoleSection = Host.querySelector('[aria-labelledby="role-management-title"]')!;
    const UserSection = Host.querySelector('[aria-labelledby="user-management-title"]')!;
    const RoleCreateAction = RoleSection.querySelector<HTMLButtonElement>('.management-card-heading button')!;
    const UserCreateAction = UserSection.querySelector<HTMLButtonElement>('.management-card-heading button')!;

    expect(RoleSection.querySelector('.role-card-grid .section-header-action')).toBeNull();
    expect(UserSection.querySelector('.user-management-toolbar .section-header-action')).toBeNull();

    RoleCreateAction.click();
    expect(component.IsCreateRoleDialogOpen).toBeTrue();
    component.CloseCreateRoleDialog();

    UserCreateAction.click();
    expect(component.IsCreateUserDialogOpen).toBeTrue();
  });
});
