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
    const fixture = TestBed.createComponent(UserManagementPageComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('creates, validates, and closes a user draft through the extracted page', () => {
    const component = createPage();

    component.OpenCreateUserDialog();
    expect(component.IsCreateUserDialogOpen).toBeTrue();
    component.SaveUser();
    expect(component.CreateUserValidationErrors.Account).toBeTruthy();

    component.UserDraft.Account = 'new-user@example.com';
    component.UserDraft.DisplayName = 'New user';
    component.ToggleCreateUserRole('FINANCE', true);
    component.SaveUser();

    expect(component.IsCreateUserDialogOpen).toBeFalse();
    expect(component.CreatedUserCredentials?.Account).toBe('new-user@example.com');
    expect(TestBed.inject(MockRbacService).GetUser('new-user@example.com')).not.toBeNull();
    component.CloseCreatedUserSuccessModal();
    expect(component.CreatedUserCredentials).toBeNull();
  });

  it('keeps user edits isolated until confirmation and records role checkbox changes', () => {
    const component = createPage();
    const rbac = TestBed.inject(MockRbacService);

    component.EditUser('user@example.com');
    expect(component.EditingUser?.Roles).toEqual(['FINANCE']);
    component.ToggleEditingUserRole('PURCHASE', true);
    expect(component.EditingUser?.Roles).toEqual(['FINANCE', 'PURCHASE']);
    expect(rbac.GetUser('user@example.com')?.Roles).toEqual(['FINANCE']);

    component.SaveEditedUser();
    expect(rbac.GetUser('user@example.com')?.Roles).toEqual(['FINANCE', 'PURCHASE']);
    expect(component.EditingUser).toBeNull();
  });

  it('filters and paginates users without changing the role-card data source', () => {
    const component = createPage();
    const rbac = TestBed.inject(MockRbacService);

    expect(rbac.Users).toHaveSize(13);
    expect(component.UserTotalPages).toBe(2);
    expect(component.PagedUsers).toHaveSize(10);
    component.GoToUserPage(2);
    expect(component.PagedUsers).toHaveSize(3);
    component.SetUserRoleFilter('FINANCE');
    expect(component.UserCurrentPage).toBe(1);
    expect(component.GetRoleAvatarUsers('FINANCE').length).toBeLessThanOrEqual(4);
  });

  it('creates and edits role permissions in the extracted page', () => {
    const component = createPage();

    component.OpenEditRoleDialog('FINANCE');
    expect(component.IsEditRoleDialogOpen).toBeTrue();
    component.ToggleManagementPermission('RptManagement', true);
    component.SetPermissionCanExecute(component.RoleDraft.Permissions[0], false);
    expect(component.RoleDraft.Permissions[0].Permission.CanExport).toBeFalse();
    component.SaveEditedRole();

    expect(component.IsEditRoleDialogOpen).toBeFalse();
    expect(TestBed.inject(MockRbacService).GetRole('FINANCE')?.ManagementPermissions)
      .toContain('RptManagement');
  });

  it('deletes a user only after confirmation', () => {
    const component = createPage();
    const rbac = TestBed.inject(MockRbacService);

    component.OpenDeleteUserDialog('warehouse@example.com');
    expect(component.DeletingUser?.Account).toBe('warehouse@example.com');
    component.ConfirmDeleteUser();
    expect(rbac.GetUser('warehouse@example.com')).toBeNull();
  });
});
