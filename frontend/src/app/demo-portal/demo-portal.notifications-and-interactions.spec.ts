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

xdescribe('portal notifications and extracted interactions', () => {
  ConfigureDemoPortalTestBed();

  it('filters front-office notifications between all and unread tabs', () => {
    const auth = TestBed.inject(AuthService);
    const notificationCenter = TestBed.inject(MockNotificationCenterService);
    const route = TestBed.inject(ActivatedRoute) as unknown as { snapshot: { data: { Page: string } } };
    route.snapshot.data.Page = 'NotificationCenter';
    expect(LoginFrontManager(auth)).toBeTrue();
    notificationCenter.NotifyRoleAssignmentChange(
      'user@example.com',
      notificationCenter.CaptureAccess('user@example.com'),
    );

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const unread = component.NotificationBadgeCount;
    component.NotificationCenterTab = 'Unread';
    component.MarkCenterNotificationRead(component.CurrentNotifications[0].Id);

    expect(component.DisplayedNotifications).toHaveSize(unread - 1);
    component.NotificationCenterTab = 'All';
    expect(component.DisplayedNotifications.length).toBeGreaterThanOrEqual(unread);
  });

  it('opens user rows while the row switch does not bubble to the editor handler', () => {
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
    host.querySelector<HTMLButtonElement>('.user-management-table [role="switch"]')!.click();
    expect(editUser).not.toHaveBeenCalled();
  });

  it('paginates, filters, sorts, and opens details through the operation-log page', () => {
    expect(LoginFrontManager(TestBed.inject(AuthService))).toBeTrue();
    const fixture = TestBed.createComponent(OperationLogPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.OperationLogStartDate).toBe('');
    expect(component.OperationLogEndDate).toBe('');
    expect(component.FilteredOperationLogs).toHaveSize(15);
    expect(component.PagedOperationLogs).toHaveSize(10);
    expect(component.PagedOperationLogs[0]).toEqual(
      jasmine.objectContaining({
        OccurredAt: jasmine.stringMatching(/^2026-09-12T/),
        Action: 'REPORT_DOWNLOAD',
        Summary: '下載「月結損益表.rpt」（PDF）',
      }),
    );
    component.GoToOperationLogPage(2);
    expect(component.PagedOperationLogs).toHaveSize(5);
    component.OperationLogCategoryFilter = 'ReportAction';
    component.OnOperationLogFilterChange();
    expect(component.OperationLogCurrentPage).toBe(1);
    expect(component.PagedOperationLogs.every((entry) => entry.Category === 'ReportAction')).toBeTrue();

    component.ToggleOperationLogSort('UserId');
    expect(component.OperationLogSortDirection).toBe('asc');
    component.OpenOperationLogDetail(component.PagedOperationLogs[0]);
    expect(component.SelectedOperationLog).not.toBeNull();
    component.CloseOperationLogDetail();
    expect(component.SelectedOperationLog).toBeNull();
  });
});
