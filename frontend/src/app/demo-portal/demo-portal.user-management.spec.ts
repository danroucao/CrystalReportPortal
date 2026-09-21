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

  it('exposes both archived-data permissions through the role editor', () => {
    const Component = createPage();
    Component.OpenEditRoleDialog('FINANCE');
    expect(Component.RoleDraft.ManagementPermissions).toContain('ArchivedFormData');
    expect(Component.RoleDraft.ManagementPermissions).toContain('ArchivedOperationLog');
  });

  it('requires parent permissions before archived-data permissions can be granted', () => {
    const Component = createPage();
    Component.OpenEditRoleDialog('FINANCE');

    Component.ToggleManagementPermission('RptManagement', false);
    expect(Component.RoleDraft.ManagementPermissions).not.toContain('ArchivedFormData');
    expect(Component.CanAssignManagementPermission('ArchivedFormData')).toBeFalse();
    expect(TestBed.inject(NotificationService).SuccessMessage).toContain('檢視已封存表單資料');
    Component.ToggleManagementPermission('ArchivedFormData', true);
    expect(Component.RoleDraft.ManagementPermissions).not.toContain('ArchivedFormData');

    Component.ToggleManagementPermission('OperationLog', false);
    expect(Component.RoleDraft.ManagementPermissions).not.toContain('ArchivedOperationLog');
    expect(Component.CanAssignManagementPermission('ArchivedOperationLog')).toBeFalse();
    Component.ToggleManagementPermission('ArchivedOperationLog', true);
    expect(Component.RoleDraft.ManagementPermissions).not.toContain('ArchivedOperationLog');
  });
});
