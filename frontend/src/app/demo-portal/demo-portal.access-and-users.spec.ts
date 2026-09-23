import { DemoPortalComponent } from './demo-portal.component';
import { ReportPreviewPageComponent } from './report-preview-page/report-preview-page.component';
import { UserManagementPageComponent } from './user-management-page/user-management-page.component';
import {
  ActivatedRoute,
  AuthService,
  ConfigureDemoPortalTestBed,
  LoginBoundBackOfficeOperator,
  LoginFrontManager,
  MockRbacService,
  NotificationService,
  Router,
  TestBed,
} from './testing/demo-portal.spec-helpers';

describe('portal access and user-management boundaries', () => {
  ConfigureDemoPortalTestBed();

  it('requires identity binding before the portal exposes back-office content', () => {
    const auth = TestBed.inject(AuthService);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    expect(auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.back-office-binding-modal')).not.toBeNull();
    component.ReturnToLoginFromBackOfficeBinding();
    expect(auth.IsAuthenticated).toBeFalse();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('lets an operator show and hide the identity-binding password without clearing it', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    const password = fixture.nativeElement.querySelector<HTMLInputElement>(
      'input[name="backOfficeBindingPassword"]',
    )!;
    const passwordLabel = fixture.nativeElement.querySelector<HTMLLabelElement>(
      'label[for="backOfficeBindingPassword"]',
    )!;
    const toggle = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '.password-toggle',
    )!;
    password.value = 'user123';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(password.type).toBe('password');
    expect(passwordLabel.control).toBe(password);
    toggle.click();
    fixture.detectChanges();

    expect(password.type).toBe('text');
    expect(password.value).toBe('user123');
    expect(toggle.getAttribute('aria-label')).toBe('隱藏密碼');
  });

  it('renders a bound operator user-management page and keeps its role dialog in the child component', () => {
    expect(LoginBoundBackOfficeOperator(TestBed.inject(AuthService))).toBeTrue();
    const fixture = TestBed.createComponent(UserManagementPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.OpenCreateRoleDialog();
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
    expect(component.MockNotice).toContain('PDF');

    const permissions = rbac.GetCategoryPermissionEntries('FINANCE');
    permissions.find((entry) => entry.CategoryId === 'FINANCE')!.Permission = {
      CanExecute: true,
      CanExport: false,
      CanPrint: false,
    };
    rbac.SaveCategoryPermissions('FINANCE', permissions);
    component.MockNotice = '';
    component.ToggleExportMenu();
    component.TogglePrintMenu();
    expect(component.IsExportMenuOpen).toBeFalse();
    expect(component.IsPrintMenuOpen).toBeFalse();
    expect(component.MockNotice).toContain('權限');
  });

  it('logs out and queues the global success notification for the login page', () => {
    const auth = TestBed.inject(AuthService);
    const notifications = TestBed.inject(NotificationService);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    expect(auth.Login('user@example.com', 'user123')).toBeTrue();
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
    expect(auth.Login('user@example.com', 'user123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('.account-summary') as HTMLElement;
    expect(header.textContent).toContain(auth.CurrentUser?.DisplayName);
    expect(header.querySelector('.role-switcher')).toBeNull();
  });
});
