import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { MockRbacService, MockUserDraft } from '../services/mock-rbac.service';
import { MockReportParameterService } from '../services/mock-report-parameter.service';
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

  it('renders only the current user favorites, supports category and date sorting, and keeps report selection flow', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
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

    expect(fixture.nativeElement.querySelectorAll('.favorite-report-table tbody tr').length).toBe(5);
    expect(component.FavoriteReports).toHaveSize(5);
    expect(component.FavoriteCategoryTabs).toEqual([
      { Category: '全部', Count: 5 },
      { Category: '財務', Count: 1 },
      { Category: '活動', Count: 1 },
      { Category: '庫存', Count: 1 },
      { Category: '生產', Count: 1 },
      { Category: '服務', Count: 1 },
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('最近使用報表');
    expect(fixture.nativeElement.textContent).not.toContain('常用報表');
    expect(fixture.nativeElement.textContent).not.toContain('Documents v2 (With Serial And Batch Details - invoice show data from delivery as well)');
    expect(fixture.nativeElement.textContent).not.toContain('AccountBalance.rpt');
    expect(fixture.nativeElement.querySelector('.favorite-report-table th')?.parentElement?.textContent).toContain('收藏');
    expect(fixture.nativeElement.querySelector('.favorite-report-table th')?.parentElement?.textContent).toContain('最近使用日期 ↓');

    component.SetFavoriteCategory('財務');
    expect(component.DisplayedFavoriteReports.map(({ Report }) => Report.ReportName)).toEqual(['AccountBalance']);
    component.SetFavoriteCategory('全部');
    component.ToggleFavoriteLastUsedSort();
    expect(component.GetFavoriteLastUsedSortIndicator()).toBe('↑');
    expect(component.DisplayedFavoriteReports.at(-1)?.Report.ReportName).toBe('InventoryTransfer_HANA');

    component.SelectReportByKey('AccountBalance');
    expect(Auth.SelectedReport?.ReportKey).toBe('AccountBalance');
    expect(Navigate).toHaveBeenCalledWith(['/reports/parameters'], {
      state: { OpenReportParameters: true },
    });

    component.RemoveFavoriteReport(
      component.FavoriteReports.find(
        ({ Report }) => Report.ReportKey === 'Activity',
      )!,
    );
    fixture.detectChanges();
    expect(component.FavoriteReports).toHaveSize(4);
    expect(MockRbac.GetFavoriteReports('user@example.com', ['FINANCE'])).toHaveSize(2);
  });

  it('filters favorites through existing report access and renders a table-free empty state', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportList';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    MockRbac.SetReportEnabled('AccountBalance', false);
    expect(component.FavoriteReports.map(({ Report }) => Report.ReportKey)).not.toContain(
      'AccountBalance',
    );

    [...component.FavoriteReports].forEach((Favorite) =>
      component.RemoveFavoriteReport(Favorite),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.favorite-report-table')).toBeNull();
    expect(fixture.nativeElement.querySelector('.favorite-empty-state')?.textContent).toContain(
      '目前沒有收藏的報表。',
    );
  });

  it('provides report search, single-column sorting, selection, and return on the ReportParameter page', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportParameter';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const Host = fixture.nativeElement as HTMLElement;

    expect(component.IsReportParameterMode).toBeFalse();
    expect(Host.querySelector('h1')?.textContent).toContain('報表搜尋 / 報表條件');
    expect(
      Array.from(Host.querySelectorAll('.portal-nav > a')).map((Link) =>
        Link.textContent?.trim(),
      ),
    ).toEqual(['報表搜尋 / 報表條件', '收藏的報表', '報表預覽', '帳號設定']);
    expect(
      Array.from(Host.querySelectorAll('.parameter-report-table th')).map((Header) =>
        Header.textContent?.replace(/[↕↑↓]/g, '').trim(),
      ),
    ).toEqual(['報表名稱', '分類', '操作']);
    expect(component.DisplayedParameterReports).toHaveSize(5);
    expect(Host.textContent).not.toContain('RptFileName');
    expect(Host.textContent).not.toContain('RptFilePath');

    component.ParameterReportSearchText = 'Account';
    fixture.detectChanges();
    expect(component.DisplayedParameterReports.map((Report) => Report.ReportName)).toEqual([
      'AccountBalance',
    ]);
    component.ToggleParameterReportSort('ReportName');
    expect(component.GetParameterReportSortIndicator('ReportName')).toBe('↑');
    expect(component.ParameterReportSearchText).toBe('Account');

    component.ParameterReportSearchText = '';
    component.ToggleParameterReportSort('ReportName');
    expect(component.GetParameterReportSortIndicator('ReportName')).toBe('↓');
    expect(component.DisplayedParameterReports.map((Report) => Report.ReportName)).toEqual([
      ...component.ParameterAccessibleReports,
    ]
      .map((Report) => Report.ReportName)
      .sort((Left, Right) => Right.localeCompare(Left, 'zh-Hant')));
    component.ToggleParameterReportSort('Category');
    expect(component.GetParameterReportSortIndicator('Category')).toBe('↑');

    component.SelectReportForParameters('AccountBalance');
    fixture.detectChanges();
    expect(component.IsReportParameterMode).toBeTrue();
    expect(Host.textContent).toContain('已選擇報表');
    expect(Host.textContent).toContain('AccountBalance / 財務');
    expect(Host.querySelector('.parameter-report-table')).toBeNull();

    component.ReturnToParameterReportSearch();
    fixture.detectChanges();
    expect(component.IsReportParameterMode).toBeFalse();
    expect(Host.querySelector('.parameter-report-table')).not.toBeNull();
  });

  it('distinguishes a report search empty state from no accessible reports', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportParameter';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.ParameterReportSearchText = 'no-match';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('找不到符合條件的報表。');

    component.ParameterReportSearchText = '';
    MockRbac.Reports.forEach((Report) =>
      MockRbac.SetReportEnabled(Report.ReportKey, false),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('目前沒有可使用的報表。');
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
    expect(Table.querySelectorAll('[role="switch"]').length).toBe(7);
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

  it('uses localized category permission labels in the EditRole dialog', () => {
    const Auth = TestBed.inject(AuthService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.componentInstance.OpenEditRoleDialog('FINANCE');
    fixture.detectChanges();

    const Headers = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.role-permission-table th',
      ),
    ).map((Header) => Header.textContent?.trim());
    expect(Headers).toEqual(['報表分類', '執行', '匯出', '列印']);
    expect(fixture.nativeElement.textContent).toContain('財務');
    expect(fixture.nativeElement.textContent).not.toContain('AccountBalance');
    expect(fixture.nativeElement.textContent).not.toContain('CanExecute');
    expect(fixture.nativeElement.textContent).not.toContain('CanExportPdf');
    expect(fixture.nativeElement.textContent).not.toContain('CanPrint');
  });

  it('removes the standalone permission navigation and makes SystemAdmin category rows read-only', () => {
    const Auth = TestBed.inject(AuthService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    component.OpenEditRoleDialog('ADMIN');
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    expect(Host.textContent).not.toContain('報表權限管理');
    expect(Host.querySelectorAll('.role-permission-table input:disabled').length).toBeGreaterThan(0);
    expect(Host.textContent).toContain('系統管理員擁有所有報表分類權限，設定為唯讀。');
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

  it('renders the selected report definition and automatically synchronizes an invalid date range', () => {
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
    fixture.detectChanges();
    component.SelectReportForParameters('AccountBalance');
    fixture.detectChanges();

    expect(component.VisibleReportParameters.map((Definition) => Definition.ParameterName)).toEqual([
      'PostingDate',
      'CustomerCode',
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('UserCode@');

    const PostingDate = component.ReportParameterForm.get(
      'PostingDate',
    ) as unknown as FormGroup;
    PostingDate.get('Start')!.setValue('2026-08-30');
    PostingDate.get('End')!.setValue('2026-08-31');
    component.OnRangeValueChange(component.VisibleReportParameters[0]);
    expect(PostingDate.get('End')!.value).toBe('2026-08-31');

    PostingDate.get('End')!.setValue('2026-08-29');
    component.OnRangeValueChange(component.VisibleReportParameters[0]);
    expect(PostingDate.get('End')!.value).toBe('2026-08-30');
    expect(component.ParameterRangeErrors['PostingDate']).toBe(
      '結束日期不得早於開始日期，已同步為開始日期，請重新選擇。',
    );

    PostingDate.get('End')!.setValue('2026-09-02');
    component.OnRangeValueChange(component.VisibleReportParameters[0]);
    expect(component.ParameterRangeErrors['PostingDate']).toBeUndefined();
    component.ExecuteReport();
    expect(Navigate).toHaveBeenCalledWith(['/reports/preview']);
  });

  it('renders the complete Activity input-type set with typed defaults', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportParameter';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    Auth.SelectReport('Activity');

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.SelectReportForParameters('Activity');
    fixture.detectChanges();

    expect(component.VisibleReportParameters.map((Definition) => Definition.DisplayName)).toEqual([
      '活動時間',
      '關鍵字',
      '備註',
      '筆數上限',
      '最小金額',
      '包含停用項目',
    ]);
    expect(component.ReportParameterForm.get('ResultLimit')!.value).toBe(100);
    expect(component.ReportParameterForm.get('MinimumAmount')!.value).toBe(0.5);
    expect(component.ReportParameterForm.get('IncludeInactive')!.value).toBeFalse();

    const Host = fixture.nativeElement as HTMLElement;
    expect(Host.querySelector('input[type="datetime-local"]')).not.toBeNull();
    expect(Host.querySelector('textarea')).not.toBeNull();
    expect(Host.querySelectorAll('input[type="number"]').length).toBe(2);
    expect(Host.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('blocks invalid generation, supports multi-select, and validates a numeric range', () => {
    const Auth = TestBed.inject(AuthService);
    const RouterService = TestBed.inject(Router);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    Route.snapshot.data.Page = 'ReportParameter';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    Auth.SelectReport('InventoryTransferHana');

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.SelectReportForParameters('InventoryTransferHana');
    fixture.detectChanges();

    expect(component.CanGenerateReport).toBeFalse();
    component.ExecuteReport();
    expect(Navigate).not.toHaveBeenCalled();

    (
      component.ReportParameterForm.get(
        'ItemCodes',
      ) as unknown as FormControl<string[]>
    ).setValue(['A-100', 'B-200']);
    const Quantity = component.ReportParameterForm.get('Quantity') as unknown as FormGroup;
    Quantity.get('Start')!.setValue(10);
    Quantity.get('End')!.setValue(10);
    expect(component.CanGenerateReport).toBeTrue();

    Quantity.get('End')!.setValue(9);
    expect(component.CanGenerateReport).toBeFalse();
    expect(Quantity.hasError('range')).toBeTrue();

    Quantity.get('End')!.setValue(10);
    component.ExecuteReport();
    expect(Navigate).toHaveBeenCalledWith(['/reports/preview']);
    expect(component.LastMockExecutionParameters?.['ItemCodes']).toEqual([
      'A-100',
      'B-200',
    ]);
    expect(component.LastMockExecutionParameters?.['Quantity']).toEqual({
      Start: 10,
      End: 10,
    });
  });

  it('renders SQL LOV loading, empty, error, and retry states without rendering UserCode@', () => {
    const Auth = TestBed.inject(AuthService);
    const ParameterService = TestBed.inject(MockReportParameterService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportParameter';
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    Auth.SelectReport('AccountBalance');

    ParameterService.SetLovStatus('AccountBalance', 'CustomerCode', 'loading');
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.SelectReportForParameters('AccountBalance');
    fixture.detectChanges();
    const Host = fixture.nativeElement as HTMLElement;
    expect(Host.textContent).toContain('載入選項中…');
    expect(Host.textContent).not.toContain('UserCode@');

    ParameterService.SetLovStatus('AccountBalance', 'CustomerCode', 'empty');
    fixture.detectChanges();
    expect(Host.textContent).toContain('目前無可選項。');

    ParameterService.SetLovStatus('AccountBalance', 'CustomerCode', 'error');
    fixture.detectChanges();
    expect(Host.textContent).toContain('無法載入選項，請重試。');
    component.RetryLov(component.VisibleReportParameters[1]);
    fixture.detectChanges();
    expect(Host.textContent).not.toContain('無法載入選項，請重試。');
    expect(ParameterService.GetLovStatus('AccountBalance', 'CustomerCode')).toBe('success');
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
