import { DemoPortalComponent } from './demo-portal.component';
import { ReportPreviewPageComponent } from './report-preview-page/report-preview-page.component';
import { UserManagementPageComponent } from './user-management-page/user-management-page.component';
import {
  ActivatedRoute,
  AuthService,
  ConfigureDemoPortalTestBed,
  LoginBoundBackOfficeOperator,
  LoginBackOffice,
  LoginFrontManager,
  MockRbacService,
  NotificationService,
  Router,
  TestBed,
} from './testing/demo-portal.spec-helpers';

xdescribe('portal access and user-management boundaries', () => {
  ConfigureDemoPortalTestBed();

  it('requires identity binding before the portal exposes back-office content', () => {
    const auth = TestBed.inject(AuthService);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    expect(LoginBackOffice(auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.back-office-binding-modal')).not.toBeNull();
    component.ReturnToLoginFromBackOfficeBinding();
    expect(auth.IsAuthenticated).toBeFalse();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('renders a bound operator user-management page and keeps its dialogs in the child component', () => {
    expect(LoginBoundBackOfficeOperator(TestBed.inject(AuthService))).toBeTrue();
    const fixture = TestBed.createComponent(UserManagementPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.OpenCreateUserDialog();
    expect(component.IsCreateUserDialogOpen).toBeTrue();
    component.OpenCreateRoleDialog();
    expect(component.IsCreateUserDialogOpen).toBeFalse();
    expect(component.IsCreateRoleDialogOpen).toBeTrue();
  });

  it('blocks preview export and print actions after live permission revocation', () => {
    const auth = TestBed.inject(AuthService);
    const rbac = TestBed.inject(MockRbacService);
    expect(LoginFrontManager(auth)).toBeTrue();
    auth.SelectReport('AccountBalance');
    const fixture = TestBed.createComponent(ReportPreviewPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.SelectExportOption(component.ExportOptions[0]);
    expect(component.PreviewNotice).toContain('PDF');

    const permissions = rbac.GetCategoryPermissionEntries('FINANCE');
    permissions.find((entry) => entry.CategoryId === 'FINANCE')!.Permission = {
      CanExecute: true,
      CanExport: false,
      CanPrint: false,
    };
    rbac.SaveCategoryPermissions('FINANCE', permissions);
    component.PreviewNotice = '';
    component.ToggleExportMenu();
    component.TogglePrintMenu();
    expect(component.IsExportMenuOpen).toBeFalse();
    expect(component.IsPrintMenuOpen).toBeFalse();
    expect(component.PreviewNotice).toContain('權限');
  });

  it('logs out and queues the global success notification for the login page', () => {
    const auth = TestBed.inject(AuthService);
    const notifications = TestBed.inject(NotificationService);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    expect(LoginFrontManager(auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);

    fixture.componentInstance.Logout();
    expect(auth.IsAuthenticated).toBeFalse();
    expect(notifications.SuccessMessage).toBeTruthy();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('shows the signed-in account without a demo role switcher', () => {
    const auth = TestBed.inject(AuthService);
    const route = TestBed.inject(ActivatedRoute) as unknown as { snapshot: { data: { Page: string } } };
    route.snapshot.data.Page = 'ReportParameter';
    expect(LoginFrontManager(auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('.account-summary') as HTMLElement;
    expect(header.textContent).toContain(auth.CurrentUser?.DisplayName);
    expect(header.querySelector('.role-switcher')).toBeNull();
  });
});
