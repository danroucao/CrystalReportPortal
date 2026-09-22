import { UserManagementPageComponent } from './user-management-page/user-management-page.component';
import {
  AuthService,
  ConfigureDemoPortalTestBed,
  LoginBoundBackOfficeOperator,
  MockRbacService,
  TestBed,
} from './testing/demo-portal.spec-helpers';

describe('UserManagementPageComponent', () => {
  ConfigureDemoPortalTestBed();

  function createPage(): UserManagementPageComponent {
    expect(LoginBoundBackOfficeOperator(TestBed.inject(AuthService))).toBeTrue();
    const Fixture = TestBed.createComponent(UserManagementPageComponent);
    Fixture.detectChanges();
    return Fixture.componentInstance;
  }

  it('keeps account identity read-only while saving only role changes', () => {
    const Component = createPage();
    const Rbac = TestBed.inject(MockRbacService);
    const Original = Rbac.GetUser('user@example.com')!;

    Component.EditUser('user@example.com');
    Component.ToggleEditingUserRole('PURCHASE', true);
    expect(Rbac.GetUser('user@example.com')?.Roles).toEqual(['FINANCE']);

    Component.SaveEditedUser();
    const Updated = Rbac.GetUser('user@example.com')!;
    expect(Updated.Account).toBe(Original.Account);
    expect(Updated.DisplayName).toBe(Original.DisplayName);
    expect(Updated.Roles).toEqual(['FINANCE', 'PURCHASE']);
  });

  it('keeps fixed Mock users searchable and pageable', () => {
    const Component = createPage();
    expect(Component.UserTotalPages).toBe(2);
    Component.GoToUserPage(2);
    expect(Component.PagedUsers).toHaveSize(3);
    Component.SetUserRoleFilter('FINANCE');
    expect(Component.UserCurrentPage).toBe(1);
  });

  it('renders three management permissions, keeps deletion exclusive to edit mode, and enforces report permission dependencies', () => {
    expect(LoginBoundBackOfficeOperator(TestBed.inject(AuthService))).toBeTrue();
    const Fixture = TestBed.createComponent(UserManagementPageComponent);
    const Component = Fixture.componentInstance;

    Component.OpenCreateRoleDialog();
    Fixture.detectChanges();
    const CreateHost = Fixture.nativeElement as HTMLElement;
    expect(CreateHost.querySelectorAll('.role-global-permissions input[type="checkbox"]')).toHaveSize(3);
    expect(CreateHost.querySelector('.role-delete-button')).toBeNull();
    expect(CreateHost.querySelector('.role-permission-hint')?.textContent).toContain('請先勾選「閱覽」');
    expect(CreateHost.querySelectorAll('.role-permission-table input:disabled')).toHaveSize(
      Component.RoleDraft.Permissions.length * 2,
    );

    const FirstPermission = Component.RoleDraft.Permissions[0];
    Component.SetPermissionCanExecute(FirstPermission, true);
    FirstPermission.Permission.CanExport = true;
    FirstPermission.Permission.CanPrint = true;
    Component.SetPermissionCanExecute(FirstPermission, false);
    Fixture.detectChanges();
    expect(FirstPermission.Permission).toEqual({
      CanExecute: false,
      CanExport: false,
      CanPrint: false,
    });

    Component.CloseRoleDialog();
    Component.OpenEditRoleDialog('FINANCE');
    Fixture.detectChanges();
    expect((Fixture.nativeElement as HTMLElement).querySelector('.role-delete-button')).not.toBeNull();
  });

  it('removes export and print when report-category viewing is removed', () => {
    const Component = createPage();
    Component.OpenEditRoleDialog('FINANCE');
    const Entry = Component.RoleDraft.Permissions[0];
    Entry.Permission = { CanExecute: true, CanExport: true, CanPrint: true };

    Component.SetPermissionCanExecute(Entry, false);

    expect(Entry.Permission).toEqual({ CanExecute: false, CanExport: false, CanPrint: false });
    expect(TestBed.inject(NotificationService).SuccessMessage).toContain('匯出、列印');
  });

});
