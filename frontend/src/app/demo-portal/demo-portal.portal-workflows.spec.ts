import { DemoPortalComponent } from './demo-portal.component';
import { ReportPreviewPageComponent } from './report-preview-page/report-preview-page.component';
import { UserManagementPageComponent } from './user-management-page/user-management-page.component';
import {
  ActivatedRoute,
  AuthService,
  ConfigureDemoPortalTestBed,
  FormControl,
  FormGroup,
  LoginBoundBackOfficeOperator,
  LoginFrontManager,
  Router,
  TestBed,
} from './testing/demo-portal.spec-helpers';
import { ReportParameterPageComponent } from './report-parameter-page/report-parameter-page.component';

describe('portal workflows after page extraction', () => {
  ConfigureDemoPortalTestBed();

  it('paginates the UserManagement table in the user-management child page', () => {
    expect(LoginBoundBackOfficeOperator(TestBed.inject(AuthService))).toBeTrue();
    const fixture = TestBed.createComponent(UserManagementPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.GoToUserPage(999);
    expect(component.UserCurrentPage).toBe(component.UserTotalPages);
    component.SetUserRoleFilter('FINANCE');
    expect(component.UserCurrentPage).toBe(1);
  });

  it('keeps preview menus and escape handling in the report-preview child page', () => {
    const auth = TestBed.inject(AuthService);
    expect(LoginFrontManager(auth)).toBeTrue();
    auth.SelectReport('AccountBalance');
    const fixture = TestBed.createComponent(ReportPreviewPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.ToggleExportMenu();
    expect(component.IsExportMenuOpen).toBeTrue();
    component.CloseMenuOnEscape();
    expect(component.IsExportMenuOpen).toBeFalse();
    component.TogglePrintMenu();
    component.SelectOutputAction('FixedPrinterPrint');
    expect(component.IsPrintMenuOpen).toBeFalse();
    expect(component.MockNotice).toBeTruthy();
  });

  it('does not prefill a database password when an administrator edits a connection', () => {
    const auth = TestBed.inject(AuthService);
    const route = TestBed.inject(ActivatedRoute) as unknown as { snapshot: { data: { Page: string } } };
    route.snapshot.data.Page = 'DatabaseConnection';
    expect(LoginFrontManager(auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.OpenEditDatabaseConnection(component.DatabaseConnections.Connections[0].Key);
    fixture.detectChanges();

    const password = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLInputElement>('#database-password');
    expect(password?.value).toBe('');
  });

  it('validates a report parameter range before generating a report', () => {
    const auth = TestBed.inject(AuthService);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    expect(LoginFrontManager(auth)).toBeTrue();
    const fixture = TestBed.createComponent(ReportParameterPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.SelectReportForParameters('InventoryTransferHana');

    (component.ReportParameterForm.get('ItemCodes') as unknown as FormControl<string[]>)
      .setValue(['A-100']);
    const quantity = component.ReportParameterForm.get('Quantity') as unknown as FormGroup;
    quantity.get('Start')!.setValue(10);
    quantity.get('End')!.setValue(9);
    expect(component.CanGenerateReport).toBeFalse();
    quantity.get('End')!.setValue(10);
    component.ExecuteReport();
    expect(navigate).toHaveBeenCalledWith(['/reports/preview']);
  });
});
