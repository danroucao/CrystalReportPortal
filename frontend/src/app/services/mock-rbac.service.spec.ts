import {
  MockRbacService,
  MockRoleDraft,
  MockUserDraft,
} from './mock-rbac.service';
import {
  IsMockReportCategoryId,
  SystemUncategorizedCategoryId,
} from '../mock/mock-report-categories';

describe('MockRbacService', () => {
  let Service: MockRbacService;

  beforeEach(() => {
    Service = new MockRbacService();
  });

  it('uses Enabled and the effective CanExecute permission for the four required report-list cases', () => {
    Service.SetReportEnabled('DocumentsV2WithSerialAndBatchDetails', true);

    expect(Service.GetAccessibleReports(['FINANCE']).map((Report) => Report.ReportKey)).toEqual([
      'AccountBalance', 'MonthlyRevenue', 'Activity', 'ActivityAttendance', 'CampaignPerformance',
    ]);
    expect(Service.GetAccessibleReports(['PURCHASE']).map((Report) => Report.ReportKey)).toEqual([
      'DocumentsV2WithSerialAndBatchDetails', 'ProductionOrder', 'ProductionYield', 'DocumentArchive',
    ]);
    expect(Service.GetAccessibleReports(['PURCHASE', 'WAREHOUSE']).map((Report) => Report.ReportKey)).toEqual([
      'InventoryTransferHana', 'DocumentsV2WithSerialAndBatchDetails', 'ProductionOrder', 'InventoryAging', 'ProductionYield', 'DocumentArchive',
    ]);
    expect(Service.GetAccessibleReports(['WAREHOUSE']).map((Report) => Report.ReportKey)).toEqual([
      'InventoryTransferHana', 'InventoryAging',
    ]);
  });

  it('calculates a union of category permissions across ordinary roles', () => {
    expect(Service.GetEffectiveCategoryPermission(['PURCHASE', 'WAREHOUSE'], 'INVENTORY')).toEqual({
      CanExecute: true,
      CanExportPdf: true,
      CanPrint: true,
    });
    expect(Service.GetEffectiveCategoryPermission(['PURCHASE', 'WAREHOUSE'], 'PRODUCTION').CanExecute).toBeTrue();
    expect(Service.GetEffectiveCategoryPermission(['PURCHASE', 'WAREHOUSE'], 'FINANCE').CanExecute).toBeFalse();
  });

  it('automatically grants a newly added report when its category is already executable', () => {
    const FinanceReports = Service.GetAccessibleReports(['FINANCE']);

    expect(FinanceReports.map((Report) => Report.ReportKey)).toContain('MonthlyRevenue');
    expect(Service.GetCategoryPermission('FINANCE', 'FINANCE').CanExecute).toBeTrue();
  });

  it('keeps SystemAdmin category permissions fully allowed without persisted checkbox state', () => {
    expect(Service.GetCategoryPermissionEntries('ADMIN')).toEqual(
      jasmine.arrayContaining([
        jasmine.objectContaining({
          CategoryId: 'FINANCE',
          CategoryName: '財務',
          Permission: { CanExecute: true, CanExportPdf: true, CanPrint: true },
        }),
      ]),
    );
  });

  it('normalizes SystemAdmin as the only assigned role', () => {
    const Draft: MockUserDraft = {
      Account: 'role-test@example.com',
      DisplayName: '多角色測試',
      InitialPassword: 'role123',
      Roles: ['PURCHASE'],
      Enabled: true,
    };

    expect(Service.CreateUser(Draft)).toBeTrue();
    expect(Service.GetUser(Draft.Account)?.Roles).toEqual(['PURCHASE']);

    expect(Service.SaveUserEdit(Draft.Account, {
      Roles: ['PURCHASE', 'WAREHOUSE'],
      Enabled: true,
    }, 'admin@example.com')).toBe('updated');
    expect(Service.GetUser(Draft.Account)?.Roles).toEqual(['PURCHASE', 'WAREHOUSE']);

    expect(Service.SaveUserEdit(Draft.Account, {
      Roles: ['PURCHASE', 'ADMIN', 'WAREHOUSE'],
      Enabled: true,
    }, 'admin@example.com')).toBe('updated');
    expect(Service.GetUser(Draft.Account)?.Roles).toEqual(['ADMIN']);

    expect(Service.SaveUserEdit(Draft.Account, {
      Roles: ['ADMIN', 'FINANCE'],
      Enabled: true,
    }, 'admin@example.com')).toBe('updated');
    expect(Service.GetUser(Draft.Account)?.Roles).toEqual(['ADMIN']);
  });

  it('clears output permissions whenever CanExecute is removed', () => {
    const Entries = Service.GetCategoryPermissionEntries('FINANCE');
    const Entry = Entries.find((Permission) => Permission.CategoryId === 'FINANCE')!;
    Entry.Permission = { CanExecute: false, CanExportPdf: true, CanPrint: true };

    Service.SaveCategoryPermissions('FINANCE', Entries);

    expect(Service.GetCategoryPermission('FINANCE', 'FINANCE')).toEqual({
      CanExecute: false,
      CanExportPdf: false,
      CanPrint: false,
    });
    expect(Service.GetAccessibleReports(['FINANCE']).map((Report) => Report.ReportKey)).toEqual([
      'Activity', 'ActivityAttendance', 'CampaignPerformance',
    ]);
  });

  it('creates roles and retains only executable category output settings', () => {
    const Permissions = Service.GetEmptyCategoryPermissionEntries();
    Permissions[0].Permission = { CanExecute: true, CanExportPdf: true, CanPrint: false };
    const Draft: MockRoleDraft = {
      DisplayName: '業務人員',
      Permissions,
    };

    const CreatedRole = Service.CreateRole(Draft);

    expect(CreatedRole?.DisplayName).toBe('業務人員');
    expect(Service.GetCategoryPermission(CreatedRole!.Key, Permissions[0].CategoryId)).toEqual(Permissions[0].Permission);
    expect(Service.CreateRole(Draft)).toBeNull();
  });

  it('locks the built-in role name while allowing custom roles to be renamed', () => {
    const AdminName = Service.GetRole('ADMIN').DisplayName;
    const Permissions = Service.GetCategoryPermissionEntries('ADMIN');

    expect(Service.UpdateRole('ADMIN', {
      DisplayName: '不應套用的名稱',
      Permissions,
    })).toBe('updated');
    expect(Service.GetRole('ADMIN').DisplayName).toBe(AdminName);

    const CreatedRole = Service.CreateRole({
      DisplayName: 'admin123',
      Permissions: Service.GetEmptyCategoryPermissionEntries(),
    })!;
    expect(Service.UpdateRole(CreatedRole.Key, {
      DisplayName: '自訂管理角色',
      Permissions: Service.GetCategoryPermissionEntries(CreatedRole.Key),
    })).toBe('updated');
    expect(Service.GetRole(CreatedRole.Key).Key).toBe(CreatedRole.Key);
    expect(Service.GetRole(CreatedRole.Key).DisplayName).toBe('自訂管理角色');
  });

  it('deletes only unused custom roles and preserves built-in or assigned roles', () => {
    const CreatedRole = Service.CreateRole({
      DisplayName: 'admin123',
      Permissions: Service.GetEmptyCategoryPermissionEntries(),
    })!;

    expect(Service.DeleteRole('ADMIN')).toBe('built-in-role');
    expect(Service.DeleteRole('FINANCE')).toBe('role-in-use');
    expect(Service.DeleteRole(CreatedRole.Key)).toBe('deleted');
    expect(Service.Roles.some((Role) => Role.Key === CreatedRole.Key)).toBeFalse();
  });

  it('keeps all reports in management while excluding disabled reports from the normal report list', () => {
    expect(Service.Reports).toHaveSize(13);
    expect(Service.Reports.every((Report) => Report.ReportKey && Report.FileName && Report.CategoryId && Report.CategoryName && Report.Description)).toBeTrue();
    expect(Service.GetAccessibleReports(['ADMIN']).some((Report) => Report.ReportKey === 'DocumentsV2WithSerialAndBatchDetails')).toBeFalse();

    Service.SetReportEnabled('DocumentsV2WithSerialAndBatchDetails', true);

    expect(Service.GetAccessibleReports(['ADMIN']).some((Report) => Report.ReportKey === 'DocumentsV2WithSerialAndBatchDetails')).toBeTrue();
  });

  it('uses only CategoryIds that exist in the Category Master', () => {
    expect(Service.Reports.every((Report) => IsMockReportCategoryId(Report.CategoryId))).toBeTrue();
    expect(Service.CreateReport({
      ReportName: 'Invalid category',
      CategoryId: 'UNKNOWN_CATEGORY',
      Enabled: true,
      FileName: 'InvalidCategory.rpt',
    })).toBeNull();
  });

  it('uses Category Master entries for filter and report-editor options, including zero-report categories', () => {
    expect(Service.GetReportFilterCategories(['ADMIN']).map(
      (Category) => Category.CategoryId,
    )).toContain('MARKETING');
    expect(Service.GetReportFilterCategories(['ADMIN']).map(
      (Category) => Category.CategoryId,
    )).not.toContain(SystemUncategorizedCategoryId);
    expect(Service.GetReportManagementCategories().map(
      (Category) => Category.CategoryId,
    )).toEqual(jasmine.arrayContaining(['MARKETING', SystemUncategorizedCategoryId]));
    expect(Service.GetReportEditorCategories().map(
      (Category) => Category.CategoryId,
    )).toContain('MARKETING');
    expect(Service.GetReportEditorCategories().map(
      (Category) => Category.CategoryId,
    )).not.toContain(SystemUncategorizedCategoryId);
  });

  it('creates an empty category with an immutable generated CategoryId and no ordinary-role permission', () => {
    const Result = Service.CreateCategory('  業務分析  ');

    expect(Result.Status).toBe('created');
    if (Result.Status !== 'created') return;
    expect(Result.Category).toEqual({
      CategoryId: 'CUSTOM_CATEGORY_1',
      CategoryName: '業務分析',
      IsSystemReserved: false,
    });
    expect(Service.GetCategoryUsageCount(Result.Category.CategoryId)).toBe(0);
    expect(Service.GetCategories()).toEqual(
      jasmine.arrayContaining([Result.Category]),
    );
    expect(Service.GetCategoryPermission('FINANCE', Result.Category.CategoryId)).toEqual({
      CanExecute: false,
      CanExportPdf: false,
      CanPrint: false,
    });
  });

  it('rejects empty, duplicate, and system-reserved category names', () => {
    expect(Service.CreateCategory('   ').Status).toBe('invalid-name');
    expect(Service.CreateCategory(' 財務 ').Status).toBe('duplicate-name');
    expect(Service.CreateCategory('未分類').Status).toBe(
      'system-reserved-name',
    );
  });

  it('renames a regular category without changing report or permission CategoryIds', () => {
    const Before = Service.GetCategoryPermission('FINANCE', 'FINANCE');
    const Result = Service.RenameCategory('FINANCE', '財務報表');

    expect(Result.Status).toBe('renamed');
    if (Result.Status !== 'renamed') return;
    expect(Result.Category.CategoryId).toBe('FINANCE');
    expect(Result.Category.CategoryName).toBe('財務報表');
    expect(
      Service.Reports.filter((Report) => Report.ReportKey === 'AccountBalance')[0]
        .CategoryId,
    ).toBe('FINANCE');
    expect(Service.GetCategoryPermission('FINANCE', 'FINANCE')).toEqual(Before);
    expect(Service.GetReport('AccountBalance')?.CategoryName).toBe('財務報表');
  });

  it('rejects a rename of the system-reserved category', () => {
    expect(
      Service.RenameCategory(SystemUncategorizedCategoryId, '重新命名').Status,
    ).toBe('system-reserved');
  });

  it('deletes an empty category and removes its role permission reference', () => {
    const Created = Service.CreateCategory('暫存分類');
    if (Created.Status !== 'created') {
      fail('應建立暫存分類');
      return;
    }
    const CreatedCategory = Created.Category;
    const Entries = Service.GetCategoryPermissionEntries('FINANCE');
    const Entry = Entries.find(
      (Permission) => Permission.CategoryId === CreatedCategory.CategoryId,
    )!;
    Entry.Permission = { CanExecute: true, CanExportPdf: true, CanPrint: true };
    Service.SaveCategoryPermissions('FINANCE', Entries);

    const Result = Service.DeleteCategory(CreatedCategory.CategoryId);
    const PermissionStore = (
      Service as unknown as {
        PermissionStore: Record<string, Record<string, unknown>>;
      }
    ).PermissionStore;

    expect(Result).toEqual({
      Status: 'deleted',
      DeletedCategoryName: '暫存分類',
      MovedReportCount: 0,
    });
    expect(Service.GetCategories().some(
      (Category) => Category.CategoryId === CreatedCategory.CategoryId,
    )).toBeFalse();
    expect(PermissionStore['FINANCE'][CreatedCategory.CategoryId]).toBeUndefined();
  });

  it('moves reports to the reserved category, clears permissions, and deletes a used category', () => {
    const Result = Service.DeleteCategory('FINANCE');
    const PermissionStore = (
      Service as unknown as {
        PermissionStore: Record<string, Record<string, unknown>>;
      }
    ).PermissionStore;

    expect(Result).toEqual({
      Status: 'deleted',
      DeletedCategoryName: '財務',
      MovedReportCount: 2,
    });
    expect(Service.Reports.filter(
      (Report) => ['AccountBalance', 'MonthlyRevenue'].includes(Report.ReportKey),
    ).every(
      (Report) => Report.CategoryId === SystemUncategorizedCategoryId,
    )).toBeTrue();
    expect(Service.GetCategories().some(
      (Category) => Category.CategoryId === 'FINANCE',
    )).toBeFalse();
    expect(PermissionStore['FINANCE']['FINANCE']).toBeUndefined();
  });

  it('rejects deletion of the system-reserved category', () => {
    expect(Service.DeleteCategory(SystemUncategorizedCategoryId)).toEqual({
      Status: 'system-reserved',
      DeletedCategoryName: null,
      MovedReportCount: 0,
    });
  });

  it('excludes the reserved category from ordinary-role permissions and report visibility', () => {
    const Report = Service.CreateReport({
      ReportName: 'Needs recategorization',
      CategoryId: SystemUncategorizedCategoryId,
      Enabled: true,
      FileName: 'NeedsRecategorization.rpt',
    });

    expect(Report).not.toBeNull();
    expect(Service.GetCategoryPermissionEntries('FINANCE').some(
      (Entry) => Entry.CategoryId === SystemUncategorizedCategoryId,
    )).toBeFalse();
    expect(Service.GetCategoryPermission('FINANCE', SystemUncategorizedCategoryId)).toEqual({
      CanExecute: false,
      CanExportPdf: false,
      CanPrint: false,
    });
    expect(Service.GetAccessibleReports(['FINANCE']).some(
      (Entry) => Entry.ReportKey === Report!.ReportKey,
    )).toBeFalse();
    expect(Service.GetAccessibleReports(['ADMIN']).some(
      (Entry) => Entry.ReportKey === Report!.ReportKey,
    )).toBeTrue();
  });

  it('keeps passwords out of user read models and lets only the user change their own name and Mock password', () => {
    const Before = Service.GetUser('user@example.com')!;

    expect('Password' in Before).toBeFalse();
    expect(Service.UpdateOwnAccount('user@example.com', {
      DisplayName: '財務人員已更新',
      NewPassword: 'changed-user-password',
    })).toBe('updated');

    const Updated = Service.GetUser('user@example.com')!;
    expect(Updated.DisplayName).toBe('財務人員已更新');
    expect(Updated.Roles).toEqual(['FINANCE']);
    expect(Updated.Enabled).toBeTrue();
    expect(Updated.CreatedAt).toBe(Before.CreatedAt);
    expect(Updated.UpdatedAt).not.toBe(Before.UpdatedAt);
    expect(Service.Authenticate('user@example.com', 'user123')).toBeNull();
    expect(Service.Authenticate('user@example.com', 'changed-user-password')?.DisplayName).toBe('財務人員已更新');
  });

  it('updates timestamps for administrative role or enabled changes without letting the admin edit a user name', () => {
    const Before = Service.GetUser('warehouse@example.com')!;

    expect(Service.SaveUserEdit('warehouse@example.com', {
      Roles: ['PURCHASE', 'WAREHOUSE'],
      Enabled: false,
    }, 'admin@example.com')).toBe('updated');

    const Updated = Service.GetUser('warehouse@example.com')!;
    expect(Updated.DisplayName).toBe(Before.DisplayName);
    expect(Updated.Roles).toEqual(['PURCHASE', 'WAREHOUSE']);
    expect(Updated.Enabled).toBeFalse();
    expect(Updated.UpdatedAt).not.toBe(Before.UpdatedAt);
  });

  it('keeps at least three SystemAdmins and requires the affected Admin to confirm a permitted demotion', () => {
    const Demotion = { Roles: ['FINANCE'], Enabled: false };
    const AdditionalAdmin: MockUserDraft = {
      Account: 'admin4@example.com',
      DisplayName: '系統管理員 D',
      InitialPassword: 'admin456',
      Roles: ['ADMIN'],
      Enabled: true,
    };

    expect(Service.SaveUserEdit('admin2@example.com', Demotion, 'admin@example.com')).toBe('minimum-admins');
    expect(Service.DeleteUser('admin3@example.com')).toBe('minimum-admins');
    expect(Service.CreateUser(AdditionalAdmin)).toBeTrue();
    expect(Service.AdminCount).toBe(4);
    expect(Service.SaveUserEdit('admin2@example.com', Demotion, 'admin@example.com')).toBe('role-change-requested');
    const Request = Service.RoleChangeRequests[0];
    expect(Service.GetUser('admin2@example.com')?.Roles).toEqual(['ADMIN']);
    expect(Service.GetUser('admin2@example.com')?.Enabled).toBeTrue();
    expect(Service.RespondToRoleChangeRequest(Request.Id, 'admin@example.com', true)).toBe('not-target');
    expect(Service.RespondToRoleChangeRequest(Request.Id, 'admin2@example.com', false)).toBe('rejected');
    expect(Service.GetUser('admin2@example.com')?.Roles).toEqual(['ADMIN']);

    expect(Service.SaveUserEdit('admin2@example.com', Demotion, 'admin@example.com')).toBe('role-change-requested');
    expect(Service.RespondToRoleChangeRequest(Service.RoleChangeRequests[1].Id, 'admin2@example.com', true)).toBe('approved');
    expect(Service.GetUser('admin2@example.com')?.Roles).toEqual(['FINANCE']);
    expect(Service.GetUser('admin2@example.com')?.Enabled).toBeFalse();

    expect(Service.AdminCount).toBe(3);
    expect(Service.SaveUserEdit('admin@example.com', Demotion, 'admin2@example.com')).toBe('minimum-admins');
    expect(Service.DeleteUser('admin@example.com')).toBe('minimum-admins');
  });

  it('deletes an ordinary user only after the UI confirmation delegates to the Mock service', () => {
    expect(Service.DeleteUser('warehouse@example.com')).toBe('deleted');
    expect(Service.GetUser('warehouse@example.com')).toBeNull();
  });
});
