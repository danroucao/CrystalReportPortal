import { DemoPortalComponent } from './demo-portal.component';
import { OperationLogPageComponent } from './operation-log-page/operation-log-page.component';
import { UserManagementPageComponent } from './user-management-page/user-management-page.component';
import {
  ActivatedRoute,
  AuthService,
  ConfigureDemoPortalTestBed,
  LoginBoundBackOfficeOperator,
  LoginFrontManager,
  NotificationCenterService,
  TestBed,
} from './testing/demo-portal.spec-helpers';

xdescribe('portal notifications and extracted interactions', () => {
  ConfigureDemoPortalTestBed();

  it('starts with no browser-generated notifications', () => {
    const auth = TestBed.inject(AuthService);
    const notificationCenter = TestBed.inject(NotificationCenterService);
    expect(LoginFrontManager(auth)).toBeTrue();
    expect(notificationCenter.getAll()).toHaveSize(0);
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
