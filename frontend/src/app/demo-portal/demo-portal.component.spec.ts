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
    expect(Header.textContent).toContain(Auth.ActiveRole?.DisplayName);
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

  it('renders only enabled CanView reports without RPT file names', () => {
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
    expect(Host.querySelectorAll('.report-management-table tbody tr').length).toBe(6);
    expect(Host.textContent).toContain('Documents v2 (With Serial And Batch Details - invoice show data from delivery as well).rpt');
    expect(Host.textContent).toContain('停用');
    expect(Host.textContent).not.toContain('RptFilePath');
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

  it('prevents an end date before the selected report start date', () => {
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

    component.SetReportEndDate('2026-08-29');
    expect(component.ReportEndDate).toBe('');
    expect(component.ReportDateRangeError).toContain('結束日期不得早於開始日期');

    component.ReportEndDate = '2026-08-29';
    component.ExecuteReport();
    expect(Navigate).not.toHaveBeenCalled();

    component.SetReportEndDate('2026-08-30');
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
      Role: 'ADMIN',
      Enabled: true,
    };
    const Demotion = {
      Account: 'admin2@example.com',
      DisplayName: '系統管理員 B',
      Role: 'FINANCE' as const,
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
    component.RoleDraft.Description = '可使用業務類已授權報表。';
    component.RoleDraft.Permissions[0].Permission.CanView = true;
    component.SaveRole();
    fixture.detectChanges();

    expect(component.IsCreateRoleDialogOpen).toBeFalse();
    expect(component.SuccessToastMessage).toBe('新增角色「業務人員」，成功！');
    expect(fixture.nativeElement.textContent).toContain('業務人員');
    expect(fixture.nativeElement.textContent).toContain(
      '可使用業務類已授權報表。',
    );
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
    component.RoleDraft.Description = '可使用財務及庫存分析報表。';
    component.RoleDraft.Permissions[1].Permission.CanView = true;
    component.SaveEditedRole();
    fixture.detectChanges();

    expect(component.IsEditRoleDialogOpen).toBeFalse();
    expect(component.SuccessToastMessage).toBe('角色「財務分析人員」已更新。');
    expect(MockRbac.GetRole('FINANCE').DisplayName).toBe('財務分析人員');
    expect(fixture.nativeElement.textContent).toContain(
      '可使用財務及庫存分析報表。',
    );
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
    const RoleUsers = MockRbac.Users.filter((User) => User.Role === Role.Key);
    component.SetUserRoleFilter(Role.Key);
    expect(component.FilteredUsers).toEqual(RoleUsers);

    component.UserSearchText = RoleUsers[0].Account;
    expect(component.FilteredUsers).toEqual([RoleUsers[0]]);

    component.SetUserRoleFilter(null);
    expect(component.FilteredUsers).toEqual([RoleUsers[0]]);
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

    component.UpdateRoleCardNavigation();
    expect(component.RoleCardHasOverflow).toBeTrue();
    expect(component.IsRoleCardAtStart).toBeTrue();
    expect(component.IsRoleCardAtEnd).toBeFalse();

    Object.defineProperty(Viewport, 'scrollLeft', {
      configurable: true,
      value: 600,
    });
    component.UpdateRoleCardNavigation();
    expect(component.IsRoleCardAtEnd).toBeTrue();
  });
});
