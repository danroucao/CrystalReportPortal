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
    const host = fixture.nativeElement as HTMLElement;
    const page = host.querySelector('app-notification-center-page');
    expect(page).not.toBeNull();
    expect(page?.querySelectorAll('.center-item')).toHaveSize(10);
    expect(component.NotificationCenterTotalPages).toBe(2);
    expect(component.PagedDisplayedNotifications).toHaveSize(10);
    page?.querySelector<HTMLButtonElement>('app-portal-pagination button[aria-label="第 2 頁"]')?.click();
    fixture.detectChanges();
    expect(component.NotificationCenterCurrentPage).toBe(2);
    expect(component.PagedDisplayedNotifications).toHaveSize(4);
    const unread = component.NotificationBadgeCount;
    page?.querySelectorAll<HTMLButtonElement>('app-portal-tabs button')[1]?.click();
    fixture.detectChanges();
    expect(component.NotificationCenterTab).toBe('Unread');
    expect(component.NotificationCenterCurrentPage).toBe(1);
    page?.querySelector<HTMLElement>('.center-item')?.click();
    fixture.detectChanges();
    expect(host.querySelector('.notification-detail-modal')).not.toBeNull();
    host.querySelector<HTMLButtonElement>('.notification-detail-modal .modal-close-button')?.click();
    fixture.detectChanges();
    expect(host.querySelector('.notification-detail-modal')).toBeNull();

    expect(component.DisplayedNotifications).toHaveSize(unread - 1);
    page?.querySelectorAll<HTMLButtonElement>('app-portal-tabs button')[0]?.click();
    fixture.detectChanges();
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

  it('shows historical operation logs without an archive permission or inclusion control', () => {
    expect(LoginFrontManager(TestBed.inject(AuthService))).toBeTrue();
    const fixture = TestBed.createComponent(OperationLogPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    component.OperationLogStartDate = '';
    component.OnOperationLogDateChange();

    expect(component.FilteredOperationLogs.some((entry) => entry.OccurredAt < new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())).toBeTrue();
    const HistoricalEntry = component.FilteredOperationLogs.find((entry) => entry.OccurredAt < new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())!;
    component.OpenOperationLogDetail(HistoricalEntry);
    expect(component.SelectedOperationLog).toBe(HistoricalEntry);

    component.ToggleOperationLogSort('UserId');
    expect(component.OperationLogSortDirection).toBe('asc');
    component.CloseOperationLogDetail();
    expect(component.SelectedOperationLog).toBeNull();
  });

  it('does not render an archive view switcher for operation-log readers', () => {
    expect(LoginFrontManager(TestBed.inject(AuthService))).toBeTrue();
    const fixture = TestBed.createComponent(OperationLogPageComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.CanAccessOperationLog).toBeTrue();
    expect(host.querySelector('.operation-log-view-switcher')).toBeNull();
    expect(host.querySelector('app-portal-two-tab-segmented-control')).toBeNull();
  });

  it('resets an incompatible category when the source changes', () => {
    expect(LoginFrontManager(TestBed.inject(AuthService))).toBeTrue();
    const fixture = TestBed.createComponent(OperationLogPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.OperationLogSourceFilter = 'FrontOffice';
    component.OperationLogCategoryFilter = 'SystemManagement';
    component.OnOperationLogSourceChange();

    expect(component.OperationLogCategoryFilter).toBe('ALL');
    expect(component.FilteredOperationLogs.every((entry) => entry.Source === 'FrontOffice')).toBeTrue();
    const host = fixture.nativeElement as HTMLElement;
    const categories = host.querySelectorAll<HTMLSelectElement>('.operation-log-filters select')[1];
    expect(Array.from(categories.options, (option) => option.value)).toEqual([
      'ALL', 'PermissionChange', 'ReportAction',
    ]);
  });
});
