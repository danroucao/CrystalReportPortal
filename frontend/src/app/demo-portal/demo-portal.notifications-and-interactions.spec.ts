import { DemoPortalComponent } from './demo-portal.component';
import { OperationLogPageComponent } from './operation-log-page/operation-log-page.component';
import { UserManagementPageComponent } from './user-management-page/user-management-page.component';
import {
  ActivatedRoute,
  AuthService,
  ConfigureDemoPortalTestBed,
  LoginBoundBackOfficeOperator,
  LoginFrontManager,
  MockNotificationCenterService,
  TestBed,
} from './testing/demo-portal.spec-helpers';

describe('portal notifications and extracted interactions', () => {
  ConfigureDemoPortalTestBed();

  it('filters front-office notifications between all and unread tabs', () => {
    const auth = TestBed.inject(AuthService);
    const notificationCenter = TestBed.inject(MockNotificationCenterService);
    const route = TestBed.inject(ActivatedRoute) as unknown as { snapshot: { data: { Page: string } } };
    route.snapshot.data.Page = 'NotificationCenter';
    expect(auth.Login('user@example.com', 'user123')).toBeTrue();
    expect(notificationCenter.GetNotifications('user@example.com')).toHaveSize(13);
    expect(notificationCenter.GetNotifications('admin@example.com')).toHaveSize(13);
    expect(
      notificationCenter.GetNotifications('user@example.com').find(
        (Item) => Item.Title === '收藏報表即將到期',
      ),
    ).toEqual(
      jasmine.objectContaining({
        Summary: '您收藏的表單即將到期，請您留意記得匯出或列印。',
      }),
    );
    notificationCenter.NotifyRoleAssignmentChange(
      'user@example.com',
      notificationCenter.CaptureAccess('user@example.com'),
    );

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.NotificationCenterTotalPages).toBe(2);
    expect(component.PagedDisplayedNotifications).toHaveSize(10);
    component.GoToNotificationCenterPage(2);
    expect(component.PagedDisplayedNotifications).toHaveSize(4);
    const unread = component.NotificationBadgeCount;
    component.SetNotificationCenterTab('Unread');
    expect(component.NotificationCenterCurrentPage).toBe(1);
    component.MarkCenterNotificationRead(component.CurrentNotifications[0].Id);

    expect(component.DisplayedNotifications).toHaveSize(unread - 1);
    component.SetNotificationCenterTab('All');
    expect(component.DisplayedNotifications.length).toBeGreaterThanOrEqual(unread);
  });

  it('opens a user row and keeps the pencil action from bubbling to that row', () => {
    expect(LoginBoundBackOfficeOperator(TestBed.inject(AuthService))).toBeTrue();
    const fixture = TestBed.createComponent(UserManagementPageComponent);
    const component = fixture.componentInstance;
    const editUser = spyOn(component, 'EditUser');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const firstUser = component.PagedUsers[0];

    host.querySelector<HTMLTableRowElement>('.user-management-table tbody tr')!.click();
    expect(editUser).toHaveBeenCalledWith(firstUser.Account);
    editUser.calls.reset();
    host.querySelector<HTMLButtonElement>('.user-management-table button')!.click();
    expect(editUser).toHaveBeenCalledTimes(1);
    expect(editUser).toHaveBeenCalledWith(firstUser.Account);
  });

  it('shows archived operation logs only after the permitted user switches views', () => {
    expect(LoginFrontManager(TestBed.inject(AuthService))).toBeTrue();
    const fixture = TestBed.createComponent(OperationLogPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(component.CanAccessArchivedOperationLogs).toBeTrue();
    expect(component.FilteredOperationLogs.every((entry) => entry.ArchivedAt === null)).toBeTrue();
    expect(host.querySelectorAll('.operation-log-table thead th')).toHaveSize(8);
    expect(Array.from(host.querySelectorAll('.operation-log-table thead th')).some((Header) => Header.textContent?.trim() === '狀態')).toBeFalse();

    component.OnOperationLogViewChange('Archived');

    expect(component.FilteredOperationLogs.every((entry) => entry.ArchivedAt !== null)).toBeTrue();
    expect(component.FilteredOperationLogs).toHaveSize(32);
    const archivedEntry = component.FilteredOperationLogs[0];
    component.OpenOperationLogDetail(archivedEntry);
    expect(component.SelectedOperationLog?.ArchivedAt).toBe(archivedEntry.ArchivedAt);

    component.ToggleOperationLogSort('UserId');
    expect(component.OperationLogSortDirection).toBe('asc');
    component.CloseOperationLogDetail();
    expect(component.SelectedOperationLog).toBeNull();
  });

  it('does not render or reserve space for the view switcher without archive-log access', () => {
    const Auth = TestBed.inject(AuthService);
    const Rbac = TestBed.inject(MockRbacService);
    expect(LoginFrontManager(Auth)).toBeTrue();
    const Permissions = Rbac.GetCategoryPermissionEntries('FINANCE');
    Rbac.UpdateRole('FINANCE', {
      DisplayName: '財務人員',
      ManagementPermissions: ['OperationLog'],
      Permissions,
    });
    const fixture = TestBed.createComponent(OperationLogPageComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.CanAccessOperationLog).toBeTrue();
    expect(fixture.componentInstance.CanAccessArchivedOperationLogs).toBeFalse();
    expect(host.querySelector('.operation-log-view-switcher')).toBeNull();
    expect(host.querySelector('app-portal-two-tab-segmented-control')).toBeNull();
  });

  it('keeps operation-log source and category filters compatible in both directions', () => {
    expect(LoginFrontManager(TestBed.inject(AuthService))).toBeTrue();
    const fixture = TestBed.createComponent(OperationLogPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.OperationLogSourceFilter = 'FrontOffice';
    component.OperationLogCategoryFilter = 'SystemManagement';
    component.OnOperationLogSourceChange();

    expect(component.OperationLogCategoryFilter).toBe('ALL');
    expect(component.IsOperationLogCategoryAvailable('PermissionChange')).toBeFalse();
    expect(component.IsOperationLogCategoryAvailable('SystemManagement')).toBeFalse();

    component.OperationLogCategoryFilter = 'Authentication';
    component.OnOperationLogCategoryChange();

    expect(component.IsOperationLogSourceAvailable('BackOffice')).toBeFalse();
    expect(component.IsOperationLogSourceAvailable('FrontOffice')).toBeTrue();
  });
});
