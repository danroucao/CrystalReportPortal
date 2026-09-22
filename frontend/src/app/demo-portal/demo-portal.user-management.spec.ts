import { UserManagementPageComponent } from './user-management-page/user-management-page.component';
import {
  AuthService,
  ConfigureDemoPortalTestBed,
  LoginBoundBackOfficeOperator,
  MockRbacService,
  NotificationService,
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

  it('shows a neutral avatar placeholder for roles without users', () => {
    expect(LoginBoundBackOfficeOperator(TestBed.inject(AuthService))).toBeTrue();
    const Rbac = TestBed.inject(MockRbacService);
    Rbac.CreateRole({
      DisplayName: '尚未指派',
      ManagementPermissions: [],
      Permissions: Rbac.GetEmptyCategoryPermissionEntries(),
    });
    const Fixture = TestBed.createComponent(UserManagementPageComponent);
    Fixture.detectChanges();

    expect((Fixture.nativeElement as HTMLElement).querySelector('.role-avatar-placeholder')).not.toBeNull();
  });

  it('only exposes role-card navigation in directions that overflow', () => {
    expect(LoginBoundBackOfficeOperator(TestBed.inject(AuthService))).toBeTrue();
    const Fixture = TestBed.createComponent(UserManagementPageComponent);
    const Component = Fixture.componentInstance;
    Fixture.detectChanges();
    const Viewport = (Fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.role-card-viewport')!;

    Object.defineProperties(Viewport, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 900 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    });

    Component.UpdateRoleCardNavigation();
    Fixture.detectChanges();
    expect(Component.RoleCardHasOverflow).toBeTrue();
    expect((Fixture.nativeElement as HTMLElement).querySelector('.role-carousel-nav.is-previous')).toBeNull();
    expect((Fixture.nativeElement as HTMLElement).querySelector('.role-carousel-nav.is-next')).not.toBeNull();

    Viewport.scrollLeft = 300;
    Component.UpdateRoleCardNavigation();
    Fixture.detectChanges();
    expect((Fixture.nativeElement as HTMLElement).querySelector('.role-carousel-nav.is-previous')).not.toBeNull();
    expect((Fixture.nativeElement as HTMLElement).querySelector('.role-carousel-nav.is-next')).not.toBeNull();

    Viewport.scrollLeft = 600;
    Component.UpdateRoleCardNavigation();
    Fixture.detectChanges();
    expect((Fixture.nativeElement as HTMLElement).querySelector('.role-carousel-nav.is-next')).toBeNull();
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

  it('requires at least one permission before creating or updating a role', () => {
    const Component = createPage();

    Component.OpenCreateRoleDialog();
    Component.RoleDraft.DisplayName = '無權限角色';
    Component.SaveRole();

    expect(Component.RoleDraftError).toBe('請至少勾選一項權限。');
    expect(Component.IsCreateRoleDialogOpen).toBeTrue();

    Component.CloseRoleDialog();
    Component.OpenEditRoleDialog('FINANCE');
    Component.RoleDraft.ManagementPermissions = [];
    Component.RoleDraft.Permissions.forEach((Entry) => {
      Entry.Permission = { CanExecute: false, CanExport: false, CanPrint: false };
    });
    Component.SaveEditedRole();

    expect(Component.RoleDraftError).toBe('請至少勾選一項權限。');
    expect(Component.IsEditRoleDialogOpen).toBeTrue();
  });

  it('rejects duplicate role names before creating or updating a role', () => {
    const Component = createPage();
    const ExistingRole = Component.MockRbac.Roles.find((Role) => Role.Key !== 'FINANCE')!;

    Component.OpenCreateRoleDialog();
    Component.RoleDraft.DisplayName = ExistingRole.DisplayName;
    Component.RoleDraft.ManagementPermissions = ['RptManagement'];
    Component.SaveRole();

    expect(Component.RoleDraftError).toBe('角色姓名不得重復，請重新命名。');
    expect(Component.IsCreateRoleDialogOpen).toBeTrue();

    Component.CloseRoleDialog();
    Component.OpenEditRoleDialog('FINANCE');
    Component.RoleDraft.DisplayName = ExistingRole.DisplayName;
    Component.RoleDraft.ManagementPermissions = ['RptManagement'];
    Component.SaveEditedRole();

    expect(Component.RoleDraftError).toBe('角色姓名不得重復，請重新命名。');
    expect(Component.IsEditRoleDialogOpen).toBeTrue();
  });

});
