import { AuthService } from './auth.service';
import { MockRbacService } from './mock-rbac.service';
import { MockAuthenticationProvider as ProductionProvider } from '../mock/mock-authentication.provider.production';

describe('Front/back-office authentication and permissions', () => {
  let Auth: AuthService;
  let Rbac: MockRbacService;
  beforeEach(() => { Rbac = new MockRbacService(); Auth = new AuthService(Rbac); });

  it('authenticates the back-office account independently of users and roles', () => {
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    expect(Auth.CurrentIdentity?.Kind).toBe('BackOffice');
    expect(Auth.RequiresBackOfficeIdentityBinding).toBeTrue();
    expect(Auth.CanOperateBackOffice).toBeFalse();
    expect(Auth.CurrentUser).toBeNull();
    expect(Auth.ActiveRoles).toEqual([]);
    expect(Auth.HomeRoute).toBe('/admin/users');
    expect(Rbac.GetUser('admin@example.com')).toBeNull();
    expect(Rbac.Roles.some((Role) => Role.Key === 'ADMIN')).toBeFalse();
    expect(Auth.AccessibleReports).toEqual([]);
    expect(Auth.HasManagementPermission('RptManagement')).toBeFalse();
    expect(Rbac.ToggleFavoriteReport('admin@example.com', 'AccountBalance')).toBeFalse();
    expect(Rbac.SaveUserEdit('admin@example.com', { Roles: ['FINANCE'] })).toBe('not-found');
    expect(Auth.BindBackOfficeIdentity('user@example.com', 'wrong')).toBeFalse();
    expect(Auth.LastBackOfficeIdentityBindingFailure).toBe('invalid-credentials');
    expect(Auth.BoundBackOfficeUserId).toBeNull();
    expect(Auth.BindBackOfficeIdentity('inventory-clerk@example.com', 'inventoryclerk123')).toBeTrue();
    expect(Auth.BindBackOfficeIdentity('user@example.com', 'user123')).toBeTrue();
    expect(Auth.LastBackOfficeIdentityBindingFailure).toBeNull();
    expect(Auth.CanOperateBackOffice).toBeTrue();
    expect(Auth.BoundBackOfficeUserId).toBe('user@example.com');
  });

  it('replaces the current identity and selected report on login, failure and logout', () => {
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();
    Auth.SelectReport('AccountBalance', { StartDate: '2026-09-01', EndDate: '2026-09-10' });
    expect(Auth.SelectedReport).not.toBeNull();
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    expect(Auth.IsFrontOffice).toBeFalse();
    expect(Auth.SelectedReport).toBeNull();
    expect(Rbac.GetSelectedReportSearchCriteria()).toBeNull();
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();
    expect(Auth.IsBackOffice).toBeFalse();
    expect(Auth.SelectedReport).toBeNull();
    expect(Auth.Login('admin@example.com', 'wrong')).toBeFalse();
    expect(Auth.IsAuthenticated).toBeFalse();
    Auth.Login('admin@example.com', 'admin123');
    Auth.BindBackOfficeIdentity('user@example.com', 'user123');
    Auth.Logout();
    expect(Auth.CurrentIdentity).toBeNull();
    expect(Auth.BoundBackOfficeUserId).toBeNull();
    expect(Auth.Login('admin2@example.com', 'admin234')).toBeFalse();
  });

  it('grants the primary local front-office Demo account all three management permissions by default', () => {
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();
    expect(Auth.HasManagementPermission('RptManagement')).toBeTrue();
    expect(Auth.HasManagementPermission('DatabaseConnection')).toBeTrue();
    expect(Auth.HasManagementPermission('OperationLog')).toBeTrue();
  });

  it('unions global permissions across roles without granting back-office or report access', () => {
    Rbac.UpdateRole('PURCHASE', { DisplayName: '採購人員', ManagementPermissions: ['RptManagement'], Permissions: Rbac.GetEmptyCategoryPermissionEntries() });
    Rbac.UpdateRole('WAREHOUSE', { DisplayName: '倉管人員', ManagementPermissions: ['DatabaseConnection', 'OperationLog'], Permissions: Rbac.GetEmptyCategoryPermissionEntries() });
    Rbac.SaveUserEdit('user@example.com', { Roles: ['PURCHASE', 'WAREHOUSE'] });
    Auth.Login('user@example.com', 'user123');
    expect(Auth.HasManagementPermission('RptManagement')).toBeTrue();
    expect(Auth.HasManagementPermission('DatabaseConnection')).toBeTrue();
    expect(Auth.HasManagementPermission('OperationLog')).toBeTrue();
    expect(Auth.IsBackOffice).toBeFalse();
    expect(Auth.AccessibleReports).toEqual([]);
    Auth.SelectReport('AccountBalance');
    expect(Auth.SelectedReport).toBeNull();
    Rbac.SaveUserEdit('user@example.com', { Roles: ['WAREHOUSE'] });
    expect(Auth.HasManagementPermission('RptManagement')).toBeFalse();
    expect(Auth.HasManagementPermission('DatabaseConnection')).toBeTrue();
    expect(Auth.HasManagementPermission('OperationLog')).toBeTrue();
  });

  it('unions report flags within each category and immediately reflects revocation', () => {
    const Execute = Rbac.GetEmptyCategoryPermissionEntries();
    Execute.find((Entry) => Entry.CategoryId === 'FINANCE')!.Permission = { CanExecute: true, CanExport: false, CanPrint: true };
    const Export = Rbac.GetEmptyCategoryPermissionEntries();
    Export.find((Entry) => Entry.CategoryId === 'FINANCE')!.Permission = { CanExecute: true, CanExport: true, CanPrint: false };
    Rbac.SaveCategoryPermissions('PURCHASE', Execute);
    Rbac.SaveCategoryPermissions('WAREHOUSE', Export);
    Rbac.SaveUserEdit('user@example.com', { Roles: ['PURCHASE', 'WAREHOUSE'] });
    Auth.Login('user@example.com', 'user123');
    Auth.SelectReport('AccountBalance');
    expect(Auth.SelectedReportCategoryPermission).toEqual({ CanExecute: true, CanExport: true, CanPrint: true });
    expect(Auth.CanExecuteReport('Activity')).toBeFalse();
    Rbac.SaveCategoryPermissions('PURCHASE', Rbac.GetEmptyCategoryPermissionEntries());
    Rbac.SaveCategoryPermissions('WAREHOUSE', Rbac.GetEmptyCategoryPermissionEntries());
    expect(Auth.SelectedReport).toBeNull();
    expect(Auth.SelectedReportCategoryPermission).toEqual({ CanExecute: false, CanExport: false, CanPrint: false });
  });

  it('invalidates a selected report and its favorite when disabled or moved to the reserved category', () => {
    Auth.Login('user@example.com', 'user123');
    Auth.SelectReport('AccountBalance');
    Rbac.ToggleFavoriteReport('user@example.com', 'AccountBalance');
    Rbac.SetReportEnabled('AccountBalance', false);
    expect(Auth.SelectedReport).toBeNull();
    expect(Rbac.GetFavoriteReports('user@example.com')).toEqual([]);
    Rbac.SetReportEnabled('AccountBalance', true);
    Rbac.DeleteCategory('FINANCE');
    expect(Auth.CanExecuteReport('AccountBalance')).toBeFalse();
    expect(Rbac.GetFavoriteReports('user@example.com')).toEqual([]);
  });

  it('excludes both credential sets from the production authentication provider', () => {
    expect(ProductionProvider.IsEnabled).toBeFalse();
    expect(ProductionProvider.GetInitialUsers()).toEqual([]);
    expect(ProductionProvider.BackOfficeAccount).toBeNull();
    expect(ProductionProvider.AuthenticateBackOffice('admin@example.com', 'admin123')).toBeNull();
    expect(ProductionProvider.Authenticate('user@example.com', 'user123')).toBeNull();
  });
});
